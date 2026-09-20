/**
 * A5 — the gate verdicts are artifacts — and the second half of A3: the key
 * appears nowhere a reader could find it.
 *
 * A dry run's whole purpose is to show what WOULD be asked, so the record is
 * written in every mode and `sent` is what distinguishes them. A record that
 * existed only for a consulted gate could not answer the question a dry run is
 * run to answer.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { JevTransport, JEV_KEY_VAR } from "../../src/harness/gate.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";

const KEY = "sk-live-never-write-me-anywhere-9876";

interface Record_ {
  gate: string;
  mode: string;
  sent: boolean;
  request: { model: string; state: Record<string, unknown>; questions: Record<string, { type: string; instructions: string }> };
  answer: Record<string, unknown> | null;
  decision: { verdict: string } | null;
  model_resolved: string | null;
  runtime_action: string;
}

/** Every file under a directory, recursively, as [path, text]. */
function readTree(root: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) walk(abs);
      else out.push([abs, readFileSync(abs, "utf-8")]);
    }
  };
  walk(root);
  return out;
}

describe("gate artifacts", { timeout: 60_000 }, () => {
  let repo: RepoFixture;
  let lines: string[];

  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("harness-gate-art-");
    lines = [];
  });
  afterEach(() => repo.cleanup());

  const config = (over: Partial<LoopConfig> = {}): LoopConfig => ({
    repoRoot: repo.root,
    loop: "t001",
    roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() },
    checks: exitingChecks(0, 0),
    gateMode: "dry-run",
    log: (l) => lines.push(l),
    ...over,
  });

  const record = (name: "G_plan" | "G_done"): Record_ =>
    JSON.parse(readFileSync(join(repo.root, `artifacts/iterations/t001/${name}.json`), "utf-8")) as Record_;

  /* --------------------------------------------------------------------- *
   * A5 — dry run writes both records, with sent: false
   * --------------------------------------------------------------------- */

  describe("A5 — dry run", () => {
    it("writes G_plan.json and G_done.json with sent: false", async () => {
      const r = await runLoop(config());
      expect(r.failure, r.failure?.reason).toBeNull();

      for (const name of ["G_plan", "G_done"] as const) {
        const rec = record(name);
        expect(rec.sent, `${name} claims a request was sent`).toBe(false);
        expect(rec.mode).toBe("dry-run");
        expect(rec.model_resolved, `${name} names a resolved model for a request nobody made`).toBeNull();
        // A dry run decides nothing. Manufacturing a verdict out of the mode
        // whose purpose is not to decide would be the opposite of the point.
        expect(rec.decision).toBeNull();
      }
    });

    it("records the exact payload that WOULD have gone on the wire", async () => {
      await runLoop(config());
      const plan = record("G_plan");
      expect(plan.request.model).toBe("jev-latest");
      expect(Object.keys(plan.request.questions)).toEqual([
        "plan_mode",
        "scope_size",
        "preserves_validated",
        "addresses_top_failures",
        "has_observable_acceptance",
      ]);
      expect(plan.request.state.plan).toBeDefined();
    });

    it("carries the deterministic checks' EXIT CODES as data in the done-gate payload", async () => {
      await runLoop(config({ checks: exitingChecks(0, 3) }));
      const done = record("G_done");
      const checks = done.request.state.checks as {
        build: { exit_code: number };
        unit: { exit_code: number };
      };
      expect(checks.build.exit_code).toBe(0);
      expect(checks.unit.exit_code).toBe(3);
    });

    /**
     * "No question asks whether tests passed", asserted two ways.
     *
     * The STRUCTURAL assertion is the one that counts: the question set is
     * exactly §4's five ids, so there is no sixth question that could ask
     * anything at all. That is a parser over the payload, not a pattern over
     * prose.
     *
     * The text scan below is defence in depth and **states its own limit**: a
     * prohibition phrased as a question would fool it, because a sentence
     * forbidding a thing is textually identical to an instance of it (`G-040`).
     * It is validated here against a planted positive and a planted near-miss,
     * per `T-156`.
     */
    it("contains no question about whether the tests passed — structurally, then by scan", async () => {
      await runLoop(config());
      const done = record("G_done");

      expect(Object.keys(done.request.questions)).toEqual([
        "diff_matches_plan",
        "touches_out_of_scope",
        "local_tests_support_claim",
        "stuck_repeating_prior_failure",
        "risk_of_regression",
      ]);

      const asksAboutResults = (text: string): boolean =>
        /\btests?\b[^?]*\b(pass|passed|passing|green|succeed|succeeded)\b[^?]*\?/i.test(text);

      // The detector, against a known positive and a known near-miss, before
      // any negative from it is believed.
      expect(asksAboutResults("Did the tests pass?")).toBe(true);
      expect(asksAboutResults("The exit codes say whether the tests passed.")).toBe(false);

      for (const [id, q] of Object.entries(done.request.questions)) {
        expect(asksAboutResults(q.instructions), `question ${id} asks about test results`).toBe(false);
      }
    });

    it("prints the payload in a dry run and sends nothing", async () => {
      await runLoop(config());
      expect(lines.join("\n")).toContain("NOT sent");
    });
  });

  /* --------------------------------------------------------------------- *
   * A3, second half — the key is in no file and no log line
   * --------------------------------------------------------------------- */

  describe("A3 — the key reaches no artifact and no log line", () => {
    it("greps the whole iteration directory and the captured log after a live run", async () => {
      const seen: string[] = [];
      const transport = new JevTransport({
        env: { [JEV_KEY_VAR]: KEY },
        log: (l) => lines.push(l),
        fetchImpl: (async (_url: string, init: RequestInit) => {
          seen.push(String(init.body));
          return new Response(
            JSON.stringify({
              model: "jev-1.13.0",
              answers: {
                plan_mode: { type: "choice", choice: "mixed", confidence: 0.9 },
                scope_size: { type: "score", score: 1, confidence: 0.9 },
                preserves_validated: { type: "noul", noul: 0.9 },
                addresses_top_failures: { type: "noul", noul: 0.9 },
                has_observable_acceptance: { type: "noul", noul: 0.9 },
                diff_matches_plan: { type: "noul", noul: 0.9 },
                touches_out_of_scope: { type: "noul", noul: 0.02 },
                local_tests_support_claim: { type: "noul", noul: 0.9 },
                stuck_repeating_prior_failure: { type: "noul", noul: 0.02 },
                risk_of_regression: { type: "score", score: 0, confidence: 0.9 },
              },
              usage: { input_tokens: 10, output_tokens: 5 },
            }),
            { status: 200 },
          );
        }) as unknown as typeof fetch,
      });

      const r = await runLoop(config({ gateMode: "live", transport, env: { [JEV_KEY_VAR]: KEY } }));
      expect(r.failure, r.failure?.reason).toBeNull();
      expect(r.status).toBe("completed");

      // The instrument first: the key MUST be somewhere, or a clean grep proves
      // only that nothing was looked at. It is in the header we sent.
      expect(seen.length, "no request was made, so this test measured nothing").toBeGreaterThan(0);

      const files = readTree(join(repo.root, "artifacts"));
      expect(files.length, "no artifacts were written, so the grep looked at nothing").toBeGreaterThan(0);
      for (const [path, text] of files) {
        expect(text.includes(KEY), `the key is in ${path}`).toBe(false);
      }
      for (const body of seen) {
        expect(body.includes(KEY), "the key reached the request body").toBe(false);
      }
      expect(lines.join("\n").includes(KEY), "the key is in a log line").toBe(false);

      // And the record does carry what it is supposed to.
      const plan = record("G_plan");
      expect(plan.sent).toBe(true);
      expect(plan.model_resolved).toBe("jev-1.13.0");
      expect(plan.decision?.verdict).toBe("proceed");
      expect(record("G_done").sent).toBe(true);
    });
  });

  /* --------------------------------------------------------------------- *
   * Skip mode still records that nothing was asked
   * --------------------------------------------------------------------- */

  it("records a skipped gate as not consulted rather than omitting the file", async () => {
    await runLoop(config({ gateMode: "skip" }));
    const plan = record("G_plan");
    expect(plan.sent).toBe(false);
    expect(plan.decision).toBeNull();
    expect(plan.runtime_action).toContain("without consulting");
    expect(plan.note).toContain("Not an approval");
  });
});
