/**
 * Gate thresholds as data — A6, plus the `D-021` drift check and the `T-156`
 * fixtures for the source scan this file adds.
 *
 * A6 has two halves and they need different instruments:
 *
 * 1. **Changing a number in `policies/*.json` changes the runtime's decision
 *    with no source change.** Asserted through `runLoop`, not through
 *    `decidePlanGate` — a unit test of the decision function would show that
 *    the function reads its argument, which nobody doubted. What was in doubt
 *    is whether the loop reads the FILE.
 * 2. **A threshold hand-edited into a literal is caught.** Asserted by a scan
 *    over the decision region of `policies.ts`, and the scan is validated
 *    against a planted positive and a planted near-miss in the same test —
 *    `T-156`, because a sentence forbidding a thing is textually identical to
 *    an instance of it.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  decidePlanGate,
  loadPolicies,
  policiesDir,
  policyJsonSchemas,
  PolicyUnreadable,
  POLICY_FILES,
} from "../../src/harness/policies.js";
import { serialiseSchema } from "../../src/harness/schema.js";
import { policySchemaFileName, schemaDir } from "../../src/harness/cli.js";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import type { GateAnswer, GatePayload, GateTransport } from "../../src/harness/gate.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import {
  scanThresholds,
  thresholdLiterals,
  thresholdScanRegions,
  THRESHOLD_SCAN_TARGETS,
} from "./threshold-scan.js";

const PLAN_ANSWERS = {
  plan_mode: { type: "choice", choice: "mixed", confidence: 0.9 },
  scope_size: { type: "score", score: 1, confidence: 0.9 },
  preserves_validated: { type: "noul", noul: 0.9 },
  addresses_top_failures: { type: "noul", noul: 0.8 },
  has_observable_acceptance: { type: "noul", noul: 0.8 },
};

const DONE_ANSWERS = {
  diff_matches_plan: { type: "noul", noul: 0.9 },
  touches_out_of_scope: { type: "noul", noul: 0.05 },
  local_tests_support_claim: { type: "noul", noul: 0.8 },
  stuck_repeating_prior_failure: { type: "noul", noul: 0.1 },
  risk_of_regression: { type: "score", score: 0.2, confidence: 0.9 },
};

/** A transport that answers from a table. Never touches the network. */
class TableTransport implements GateTransport {
  readonly name = "table";
  readonly seen: GatePayload[] = [];
  constructor(private readonly planAnswers: Record<string, unknown> = PLAN_ANSWERS) {}
  async dispatch(payload: GatePayload): Promise<GateAnswer> {
    this.seen.push(payload);
    return {
      gate: payload.gate,
      answers: payload.gate === "plan" ? this.planAnswers : DONE_ANSWERS,
      consulted: true,
      note: "fake",
      resolvedModel: "jev-1.13.0",
      usage: { input_tokens: 1, output_tokens: 1 },
    };
  }
}

describe("gate policies", { timeout: 60_000 }, () => {
  /* --------------------------------------------------------------------- *
   * Loading — refuses rather than defaults
   * --------------------------------------------------------------------- */

  describe("loadPolicies", () => {
    let dir: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), "harness-policies-"));
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it("reads the shipped policies", () => {
      const p = loadPolicies();
      expect(p.plan.gate).toBe("plan");
      expect(p.done.gate).toBe("developer-done");
      // §4's one stated number, present where it is supposed to be.
      expect(p.plan.has_observable_acceptance_min).toBe(0.7);
    });

    it("refuses a missing directory instead of falling back to a default", () => {
      expect(() => loadPolicies(join(dir, "nope"))).toThrow(PolicyUnreadable);
      // A run with thresholds nobody chose is worse than a run that refuses.
      expect(() => loadPolicies(join(dir, "nope"))).toThrow(/no built-in default/);
    });

    it("refuses an unknown key rather than ignoring it", () => {
      // A misspelled threshold that is silently dropped is a run whose number
      // came from somewhere nobody looked.
      const good = loadPolicies();
      writeFileSync(
        join(dir, POLICY_FILES.plan),
        JSON.stringify({ ...good.plan, has_observable_acceptence_min: 0.9 }),
      );
      writeFileSync(join(dir, POLICY_FILES.done), JSON.stringify(good.done));
      expect(() => loadPolicies(dir)).toThrow(/does not match the policy schema/);
    });

    it("refuses a value outside its range", () => {
      const good = loadPolicies();
      writeFileSync(join(dir, POLICY_FILES.plan), JSON.stringify({ ...good.plan, has_observable_acceptance_min: 7 }));
      writeFileSync(join(dir, POLICY_FILES.done), JSON.stringify(good.done));
      expect(() => loadPolicies(dir)).toThrow(PolicyUnreadable);
    });

    it("refuses a file that is not JSON, and says which file", () => {
      writeFileSync(join(dir, POLICY_FILES.plan), "{ not json");
      expect(() => loadPolicies(dir)).toThrow(/plan-gate\.json is not valid JSON/);
    });
  });

  /* --------------------------------------------------------------------- *
   * D-021 — the derived schema files
   * --------------------------------------------------------------------- */

  describe("derived policy schema files", () => {
    it.each([
      ["plan", "policy-plan.schema.json"],
      ["done", "policy-developer-done.schema.json"],
    ] as const)("%s policy schema matches what zod derives", (kind, file) => {
      const onDisk = readFileSync(join(schemaDir(), file), "utf-8");
      const derived = serialiseSchema(policyJsonSchemas()[kind]);
      expect(
        onDisk,
        `${file} has drifted from src/harness/policies.ts. Regenerate: npx tsx src/harness/cli.ts schemas --write`,
      ).toBe(derived);
      expect(policySchemaFileName(kind)).toBe(file);
    });

    it("states in the file that these numbers are uncalibrated", () => {
      const text = readFileSync(join(schemaDir(), "policy-plan.schema.json"), "utf-8");
      expect(text).toContain("LIMIT");
      expect(text).toContain("PROVENANCE");
      expect(text).toContain("not a calibration");
    });

    it("shipped policy files satisfy their own derived schema's key set", () => {
      // The JSON Schema and the zod schema agree by construction; this asserts
      // the DATA files carry exactly those keys, so a file cannot go stale
      // against the shape by omission.
      const schema = policyJsonSchemas().plan as { properties: Record<string, unknown> };
      const data = JSON.parse(readFileSync(join(policiesDir(), POLICY_FILES.plan), "utf-8")) as Record<string, unknown>;
      expect(Object.keys(data).sort()).toEqual(Object.keys(schema.properties).sort());
    });
  });

  /* --------------------------------------------------------------------- *
   * A6, half one — the FILE decides
   * --------------------------------------------------------------------- */

  describe("A6 — a threshold change in the file changes the decision", () => {
    let repo: RepoFixture;
    let dir: string;

    beforeAll(() => requireGit());
    beforeEach(() => {
      repo = makeRepo("harness-a6-");
      dir = mkdtempSync(join(tmpdir(), "harness-a6-policies-"));
    });
    afterEach(async () => {
      await repo.cleanup();
      await rm(dir, { recursive: true, force: true });
    });

    const writePolicies = (planOverrides: Record<string, unknown>): void => {
      const shipped = loadPolicies();
      writeFileSync(join(dir, POLICY_FILES.plan), JSON.stringify({ ...shipped.plan, ...planOverrides }, null, 2));
      writeFileSync(join(dir, POLICY_FILES.done), JSON.stringify(shipped.done, null, 2));
    };

    const config = (): LoopConfig => ({
      repoRoot: repo.root,
      loop: "t001",
      roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() },
      checks: exitingChecks(0, 0),
      gateMode: "live",
      transport: new TableTransport(),
      policiesDir: dir,
      log: () => {},
    });

    it("proceeds with the shipped threshold and is rejected by a stricter one", async () => {
      // has_observable_acceptance comes back at 0.8 in both runs. Nothing in
      // src/ differs between them.
      writePolicies({});
      const permissive = await runLoop(config());
      expect(permissive.failure, permissive.failure?.reason).toBeNull();
      expect(permissive.status).toBe("completed");

      await repo.cleanup();
      repo = makeRepo("harness-a6-");
      writePolicies({ has_observable_acceptance_min: 0.95 });
      const strict = await runLoop(config());

      expect(strict.status).toBe("failed");
      expect(strict.failure?.code).toBe("gate-rejected");
      expect(strict.failure?.reason).toContain("has_observable_acceptance");
      expect(strict.failure?.reason).toContain("0.95");
    });

    it("refuses to run live at all when the policy directory is unreadable", async () => {
      const r = await runLoop({ ...config(), policiesDir: join(dir, "absent") });
      expect(r.status).toBe("failed");
      expect(r.failure?.code).toBe("policy-unreadable");
    });

    it("records the thresholds it applied in the gate artifact", async () => {
      writePolicies({});
      const r = await runLoop(config());
      const record = JSON.parse(
        readFileSync(join(repo.root, "artifacts/iterations/t001/G_plan.json"), "utf-8"),
      ) as { decision: { applied: Record<string, number | boolean>; verdict: string } };
      expect(record.decision.verdict).toBe("proceed");
      expect(record.decision.applied.has_observable_acceptance_min).toBe(0.7);
    });
  });

  /* --------------------------------------------------------------------- *
   * Fail-closed on absence
   * --------------------------------------------------------------------- */

  describe("a gate that did not answer is not a gate that approved", () => {
    it("rejects when a required answer is absent", () => {
      const policy = loadPolicies().plan;
      const d = decidePlanGate({ ...PLAN_ANSWERS, has_observable_acceptance: undefined }, policy, {
        deterministicFailure: false,
        qaHistorySupportsStopShip: false,
      });
      expect(d.verdict).toBe("reject");
      expect(d.missing).toContain("has_observable_acceptance");
    });

    it("rejects a score answer that arrived without confidence, rather than reading it as zero", () => {
      const policy = loadPolicies().plan;
      const d = decidePlanGate({ ...PLAN_ANSWERS, scope_size: { type: "score", score: 2 } }, policy, {
        deterministicFailure: false,
        qaHistorySupportsStopShip: false,
      });
      expect(d.missing).toContain("scope_size");
      expect(d.verdict).toBe("reject");
    });

    it("refuses a stop_ship that the deterministic checks and QA history do not support", () => {
      const policy = loadPolicies().plan;
      const unsupported = decidePlanGate(
        { ...PLAN_ANSWERS, plan_mode: { type: "choice", choice: "stop_ship", confidence: 0.99 } },
        policy,
        { deterministicFailure: false, qaHistorySupportsStopShip: false },
      );
      expect(unsupported.verdict).toBe("reject");
      expect(unsupported.reasons.join(" ")).toContain("a halt on the gate alone is refused");

      const supported = decidePlanGate(
        { ...PLAN_ANSWERS, plan_mode: { type: "choice", choice: "stop_ship", confidence: 0.99 } },
        policy,
        { deterministicFailure: true, qaHistorySupportsStopShip: true },
      );
      expect(supported.verdict).toBe("halt");
    });
  });

  /* --------------------------------------------------------------------- *
   * A6, half two + T-156 — the scan, with both fixtures
   * --------------------------------------------------------------------- */

  /* --------------------------------------------------------------------- *
   * A6 half two, second candidate — the scan's SCOPE was the defect
   *
   * QA planted `"… Answer at least 0.7 if so."` into the
   * `has_observable_acceptance` prompt in `gate.ts` and the whole harness suite
   * stayed green: 17/17 here, 234/234 overall. The detector was fine; it was
   * pointed at one region of one file. §4 says thresholds must never live in a
   * prompt, and the prompts were outside every scan.
   * --------------------------------------------------------------------- */

  describe("A6 half two — the scan covers the prompts and the gate context", () => {
    it("names gate.ts and runtime.ts in its scope, not just policies.ts", () => {
      const files = THRESHOLD_SCAN_TARGETS.map((t) => t.file).sort();
      expect(files).toEqual(["gate.ts", "policies.ts", "runtime.ts"]);
      // policies.ts is scanned from the marker down; the other two whole.
      const policies = THRESHOLD_SCAN_TARGETS.find((t) => t.file === "policies.ts");
      expect(policies?.from).toBe("Applying a policy");
      expect(THRESHOLD_SCAN_TARGETS.find((t) => t.file === "gate.ts")?.from).toBeNull();
    });

    it("fires on a threshold planted in a PROMPT, and not on a comment about one", () => {
      // The positive is QA's own plant, verbatim in shape.
      const plantedPrompt = `{ id: "has_observable_acceptance", kind: "noul", prompt: "Does every criterion name a concrete observable? Answer at least 0.7 if so." }`;
      expect(thresholdLiterals(plantedPrompt)).toEqual(["0.7"]);

      // The near-miss: a sentence forbidding the thing is textually identical
      // to an instance of it, so the scan must read code and not prose.
      expect(thresholdLiterals("// no prompt may carry a threshold such as 0.7")).toEqual([]);
      expect(thresholdLiterals("/* §4: thresholds like 0.7 live in policies/ */")).toEqual([]);

      // And it must not fire on a version string, which is not a threshold.
      expect(thresholdLiterals('const m = "jev-1.13.0";')).toEqual([]);
    });

    it("finds no threshold literal in any scanned region of the shipped source", () => {
      const offenders = scanThresholds();
      expect(
        offenders,
        `a threshold outside policies/*.json is a threshold nobody can change without a source ` +
          `edit: ${offenders.map((o) => `${o.file}: ${o.literal}`).join(", ")}`,
      ).toEqual([]);
    });

    it("proves it looked: every target exists and every region is non-empty", () => {
      // A scan over a path that does not resolve, or a marker that is gone,
      // would report a clean result having read nothing.
      for (const region of thresholdScanRegions()) {
        expect(region.text.length, `${region.file} scanned an empty region`).toBeGreaterThan(200);
      }
      expect(thresholdScanRegions()).toHaveLength(THRESHOLD_SCAN_TARGETS.length);
    });
  });

  /* --------------------------------------------------------------------- *
   * F5 — a threshold on a question with no referent
   * --------------------------------------------------------------------- */

  describe("F5 — addresses_top_failures has no referent when there are no prior failures", () => {
    const ctx = (over: Record<string, boolean> = {}) => ({
      deterministicFailure: false,
      qaHistorySupportsStopShip: false,
      hasPriorFailures: false,
      ...over,
    });

    it("does not threshold the answer when prior_failures is empty", () => {
      // The developer's accidental live call rejected the stub plan on
      // `addresses_top_failures 0.32 < 0.5` with `prior_failures: []`. Asking a
      // model whether a plan addresses the top failures when there are none,
      // and then thresholding the answer, is scoring a question with no
      // referent — and on the CLI path it makes the done gate unreachable, so
      // A7 would observe one gate rather than two.
      const answers = { ...PLAN_ANSWERS, addresses_top_failures: { type: "noul", noul: 0.32 } };
      const d = decidePlanGate(answers, loadPolicies().plan, ctx());
      expect(d.verdict).toBe("proceed");
      expect(d.reasons.join(" ")).not.toContain("addresses_top_failures");
    });

    it("still thresholds it when there ARE prior failures", () => {
      const answers = { ...PLAN_ANSWERS, addresses_top_failures: { type: "noul", noul: 0.32 } };
      const d = decidePlanGate(answers, loadPolicies().plan, ctx({ hasPriorFailures: true }));
      expect(d.verdict).toBe("reject");
      expect(d.reasons.join(" ")).toContain("addresses_top_failures");
    });

    it("records the applicability in the decision, so a reader is not left to infer it", () => {
      const answers = { ...PLAN_ANSWERS, addresses_top_failures: { type: "noul", noul: 0.32 } };
      const d = decidePlanGate(answers, loadPolicies().plan, ctx());
      expect(d.notApplicable).toContain("addresses_top_failures");
    });

    it("the done gate is REACHABLE live with stub roles and the shipped policy", async () => {
      // F5's consequence, at the runtime rather than in the decision function.
      const repo2 = makeRepo("harness-f5-");
      try {
        const transport = new TableTransport({
          ...PLAN_ANSWERS,
          addresses_top_failures: { type: "noul", noul: 0.32 },
        });
        const r = await runLoop({
          repoRoot: repo2.root,
          loop: "t001",
          roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() },
          checks: exitingChecks(0, 0),
          gateMode: "live",
          transport,
          log: () => {},
        });
        expect(r.failure, r.failure?.reason).toBeNull();
        expect(transport.seen.map((p) => p.gate)).toEqual(["plan", "developer-done"]);
      } finally {
        await repo2.cleanup();
      }
    });
  });

  describe("T-156 — no threshold hides in the decision code", () => {
    const MARKER = "Applying a policy";

    /** Strip comments, then look for a numeric literal. The detector under test. */
    const thresholdLiterals = (source: string): string[] => {
      const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, "");
      const withoutLines = withoutBlocks.replace(/(^|[^:])\/\/.*$/gm, "$1");
      return [...withoutLines.matchAll(/(?<![\w.])\d+\.\d+(?![\w.])/g)].map((m) => m[0]);
    };

    const decisionRegion = (): string => {
      const source = readFileSync(resolve(__dirname, "../../src/harness/policies.ts"), "utf-8");
      const at = source.lastIndexOf(MARKER);
      expect(at, `the "${MARKER}" marker is gone from policies.ts — this scan has nothing to scan`).toBeGreaterThan(0);
      return source.slice(at);
    };

    it("finds a planted threshold, and does NOT fire on a sentence forbidding one", () => {
      // The known positive. Without it a green scan proves nothing.
      expect(thresholdLiterals("if (a.noul < 0.7) reject();")).toEqual(["0.7"]);
      // The known near-miss. A comment about 0.7 is textually identical to an
      // instance of it, and this is the pair G-040 is about.
      expect(thresholdLiterals("// never write 0.7 here; read it from the policy")).toEqual([]);
      expect(thresholdLiterals("/* thresholds such as 0.7 live in policies/ */")).toEqual([]);
      // …and it does not fire on a version string or a property path.
      expect(thresholdLiterals('const model = "jev-1.13.0";')).toEqual([]);
    });

    it("finds no threshold literal in the decision region of policies.ts", () => {
      const found = thresholdLiterals(decisionRegion());
      expect(
        found,
        `a threshold literal in the decision code is a threshold nobody can change without a ` +
          `source edit: ${found.join(", ")}`,
      ).toEqual([]);
    });
  });
});
