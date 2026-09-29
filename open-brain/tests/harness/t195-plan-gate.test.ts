/**
 * T-195 — D_t beside briefs, validate plan, plan-gate CLI, dispatch-check.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { validatePlan, type Plan } from "../../src/harness/schema.js";
import {
  briefDtPath,
  checkBriefDispatchReady,
  checkBriefReachableFromMaster,
  listBriefGateRecords,
  nextBriefGateRecordPath,
  policyFileHash,
  runBriefDispatch,
  runBriefPlanGate,
} from "../../src/harness/brief-plan-gate.js";
import { decidePlanGate, loadPolicies, policiesDir } from "../../src/harness/policies.js";
import type { GateAnswer, GatePayload, GateTransport } from "../../src/harness/gate.js";
import { GateUnavailable, JEV_KEY_VAR } from "../../src/harness/gate.js";
import { runLoop } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, rawGit, requireGit } from "./fixture.js";

const TSX = resolve(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const CLI = resolve(__dirname, "../../src/harness/cli.ts");

const validPlan = (): Plan => ({
  loop: "t195",
  objective: "Add D_t and plan gate beside interactive briefs.",
  tasks: ["implement harness plan-gate"],
  out_of_scope: ["runtime merge path"],
  preserve: ["validate evidence unchanged"],
  acceptance: [{ id: "DT-1", observable: "harness validate plan exits 0", type: "blackbox" }],
  repair_targets: [],
  new_capability: "brief-side plan gate",
});

const PLAN_ANSWERS = {
  plan_mode: { type: "choice", choice: "mixed", confidence: 0.9 },
  scope_size: { type: "score", score: 1, confidence: 0.9 },
  preserves_validated: { type: "noul", noul: 0.9 },
  addresses_top_failures: { type: "noul", noul: 0.9 },
  has_observable_acceptance: { type: "noul", noul: 0.95 },
};

class TableTransport implements GateTransport {
  readonly name = "table";
  constructor(
    private readonly answers: Record<string, unknown> = PLAN_ANSWERS,
    private readonly fail?: (payload: GatePayload) => never,
  ) {}
  async dispatch(payload: GatePayload): Promise<GateAnswer> {
    if (this.fail) this.fail(payload);
    return {
      gate: payload.gate,
      answers: this.answers,
      consulted: true,
      note: "stub",
      resolvedModel: "jev-1.13.0",
      usage: { input_tokens: 1, output_tokens: 1 },
    };
  }
}

function harness(args: readonly string[], cwd: string, env: NodeJS.ProcessEnv = {}): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const r = spawnSync(process.execPath, [TSX, CLI, ...args], {
    cwd,
    encoding: "utf-8",
    shell: false,
    timeout: 120_000,
    env: { ...process.env, ...env },
  });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function writeBriefFixture(dir: string): { brief: string; dt: string } {
  const brief = join(dir, "sample-brief.md");
  const dt = briefDtPath(brief);
  writeFileSync(brief, "# Sample brief\n\nBuild the plan gate.\n", "utf-8");
  writeFileSync(dt, `${JSON.stringify(validPlan(), null, 2)}\n`, "utf-8");
  return { brief, dt };
}

describe("T-195 brief plan gate", { timeout: 120_000 }, () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t195-"));
  });

  describe("DT-1 validate plan", () => {
    it("exits 0 on valid, 1 with every problem on invalid, 2 on usage error", () => {
      const { dt } = writeBriefFixture(dir);
      const badPath = join(dir, "bad.json");
      const badDoc = { ...validPlan(), tasks: [] };
      writeFileSync(badPath, JSON.stringify(badDoc), "utf-8");

      expect(harness(["validate", "plan", dt], dir).status).toBe(0);

      const invalid = harness(["validate", "plan", badPath], dir);
      const expected = validatePlan(badDoc);
      expect(expected.ok).toBe(false);
      if (expected.ok) return;
      expect(invalid.status).toBe(1);
      expect(invalid.stdout.trim().split(/\r?\n/)).toEqual(expected.problems);

      expect(harness(["validate", "plan"], dir).status).toBe(2);
    });
  });

  describe("DT-2 plan-gate payload sources", () => {
    it("prints named source for each HOH-JEV field", async () => {
      const { brief, dt } = writeBriefFixture(dir);
      const result = await runBriefPlanGate({
        dtPath: dt,
        briefPath: brief,
        repoRoot: dir,
        mode: "live",
        transport: new TableTransport(),
        env: {},
      });
      expect(result.record.sources.spec_excerpt).toContain("brief markdown");
      expect(result.record.sources.plan_summary).toBe("D_t.objective");
      expect(result.record.sources.prior_failures).toContain("D_t.repair_targets");
      expect(result.record.sources.validated_behaviours).toContain("D_t.preserve");
      expect(result.record.sources.changed_area_hints).toContain("D_t.tasks");
      expect(result.record.request.state).toBeDefined();
    });
  });

  describe("DT-3 thresholds from policy file only", () => {
    it("changing plan-gate.json changes the decision without source edits", () => {
      const policies = loadPolicies();
      const ctx = { deterministicFailure: false, qaHistorySupportsStopShip: false, hasPriorFailures: false };
      const low = { ...PLAN_ANSWERS, has_observable_acceptance: { type: "noul", noul: 0.55 } };
      const strict = decidePlanGate(low, { ...policies.plan, has_observable_acceptance_min: 0.7 }, ctx);
      const lenient = decidePlanGate(low, { ...policies.plan, has_observable_acceptance_min: 0.5 }, ctx);
      expect(strict.verdict).toBe("reject");
      expect(lenient.verdict).toBe("proceed");
      expect(policyFileHash()).toHaveLength(64);
      expect(readFileSync(join(policiesDir(), "plan-gate.json"), "utf-8")).toContain("has_observable_acceptance_min");
    });
  });

  describe("DT-4 append-only decision records", () => {
    it("writes a second record without overwriting the first", async () => {
      const { brief, dt } = writeBriefFixture(dir);
      const t1 = new Date("2026-09-28T12:00:00.000Z");
      const t2 = new Date("2026-09-28T12:01:00.000Z");
      const r1 = await runBriefPlanGate({
        dtPath: dt,
        briefPath: brief,
        repoRoot: dir,
        mode: "live",
        transport: new TableTransport(),
        env: {},
        at: t1,
      });
      const r2 = await runBriefPlanGate({
        dtPath: dt,
        briefPath: brief,
        repoRoot: dir,
        mode: "live",
        transport: new TableTransport(),
        env: {},
        at: t2,
      });
      expect(r1.recordPath).not.toBe(r2.recordPath);
      expect(existsSync(r1.recordPath)).toBe(true);
      expect(existsSync(r2.recordPath)).toBe(true);
      expect(listBriefGateRecords(brief)).toHaveLength(2);
      const rec = JSON.parse(readFileSync(r1.recordPath, "utf-8")) as { policy_hash: string; model_resolved: string };
      expect(rec.policy_hash).toBe(policyFileHash());
      expect(rec.model_resolved).toBe("jev-1.13.0");
    });

    it("same timestamp allocates a second file instead of overwriting", async () => {
      const { brief, dt } = writeBriefFixture(dir);
      const at = new Date("2026-09-29T01:00:00.000Z");
      const first = await runBriefPlanGate({
        dtPath: dt,
        briefPath: brief,
        repoRoot: dir,
        mode: "live",
        transport: new TableTransport(),
        env: {},
        at,
      });
      const second = await runBriefPlanGate({
        dtPath: dt,
        briefPath: brief,
        repoRoot: dir,
        mode: "live",
        transport: new TableTransport(),
        env: {},
        at,
      });
      expect(first.recordPath).not.toBe(second.recordPath);
      expect(readFileSync(first.recordPath, "utf-8")).toContain('"sent": true');
      expect(readFileSync(second.recordPath, "utf-8")).toContain('"sent": true');
    });
  });

  describe("DT-5 feedback on rejection", () => {
    it("names failing questions with value and threshold", async () => {
      const { brief, dt } = writeBriefFixture(dir);
      await expect(
        runBriefPlanGate({
          dtPath: dt,
          briefPath: brief,
          repoRoot: dir,
          mode: "live",
          transport: new TableTransport({
            ...PLAN_ANSWERS,
            has_observable_acceptance: { type: "noul", noul: 0.55 },
          }),
          env: {},
        }),
      ).rejects.toThrow(/has_observable_acceptance.*0\.55.*0\.7|below the required 0\.7/);
    });
  });

  describe("DT-6 fails closed", () => {
    it("refuses missing TYPESAFE_API_KEY without passing", async () => {
      const { brief, dt } = writeBriefFixture(dir);
      await expect(
        runBriefPlanGate({
          dtPath: dt,
          briefPath: brief,
          repoRoot: dir,
          mode: "live",
          env: {},
        }),
      ).rejects.toThrow(/TYPESAFE_API_KEY/);
    });

    it("refuses transport and malformed envelope failures", async () => {
      const { brief, dt } = writeBriefFixture(dir);
      await expect(
        runBriefPlanGate({
          dtPath: dt,
          briefPath: brief,
          repoRoot: dir,
          mode: "live",
          transport: new TableTransport(PLAN_ANSWERS, () => {
            throw new GateUnavailable("network error simulated");
          }),
          env: { [JEV_KEY_VAR]: "sk-test-key-never-logged-1234567890" },
        }),
      ).rejects.toThrow(/network error simulated/);
    });
  });

  describe("DT-7 dispatch-check and dispatch", () => {
    it("refuses a brief without D_t or passing live gate record", async () => {
      requireGit();
      const repo = makeRepo("t195-dispatch-");
      const brief = join(repo.root, "docs/loops/sample-brief.md");
      const dt = briefDtPath(brief);
      repo.write("docs/loops/sample-brief.md", "# Sample brief\n\nBuild the plan gate.\n");
      repo.write("docs/loops/sample-brief.D_t.json", `${JSON.stringify(validPlan(), null, 2)}\n`);
      repo.commitAll("add brief sidecar");
      rawGit(repo.root, ["update-ref", "refs/remotes/origin/master", repo.sha()]);

      let check = checkBriefDispatchReady(brief, repo.root);
      expect(check.ok).toBe(false);
      expect(check.reasons.some((r) => r.includes("no plan-gate"))).toBe(true);

      await runBriefPlanGate({
        dtPath: dt,
        briefPath: brief,
        repoRoot: repo.root,
        mode: "dry-run",
        transport: new TableTransport(),
        env: {},
      });
      check = checkBriefDispatchReady(brief, repo.root);
      expect(check.ok).toBe(false);
      expect(check.reasons.some((r) => r.includes("no live plan-gate"))).toBe(true);

      await runBriefPlanGate({
        dtPath: dt,
        briefPath: brief,
        repoRoot: repo.root,
        mode: "live",
        transport: new TableTransport(),
        env: {},
        at: new Date("2026-09-28T13:00:00.000Z"),
      });
      check = checkBriefDispatchReady(brief, repo.root);
      expect(check.ok).toBe(true);

      const cli = harness(["dispatch-check", brief, "--repo", repo.root], repo.root);
      expect(cli.status).toBe(0);
      expect(cli.stdout).toContain("dispatch-check: ok");

      repo.write("docs/loops/sample-brief.D_t.json", "{}\n");
      repo.commitAll("break D_t");
      expect(harness(["dispatch-check", brief, "--repo", repo.root], repo.root).status).toBe(1);

      await repo.cleanup();
    });

    it("dispatch sends only after dispatch-check passes", async () => {
      requireGit();
      const repo = makeRepo("t195-dispatch-send-");
      const brief = join(repo.root, "docs/loops/sample-brief.md");
      const dt = briefDtPath(brief);
      repo.write("docs/loops/sample-brief.md", "# Sample brief\n\nBuild the plan gate.\n");
      repo.write("docs/loops/sample-brief.D_t.json", `${JSON.stringify(validPlan(), null, 2)}\n`);
      repo.commitAll("add brief sidecar");
      rawGit(repo.root, ["update-ref", "refs/remotes/origin/master", repo.sha()]);

      let sent = false;
      const blocked = await runBriefDispatch({
        briefPath: brief,
        message: "must not send",
        repoRoot: repo.root,
        transport: { send() { sent = true; } },
      });
      expect(blocked.ok).toBe(false);
      expect(sent).toBe(false);

      const cliBlocked = harness(["dispatch", brief, "--say", "nope", "--repo", repo.root], repo.root);
      expect(cliBlocked.status).toBe(1);
      expect(cliBlocked.stdout).not.toContain("dispatch: sent");

      await runBriefPlanGate({
        dtPath: dt,
        briefPath: brief,
        repoRoot: repo.root,
        mode: "live",
        transport: new TableTransport(),
        env: {},
        at: new Date("2026-09-28T14:00:00.000Z"),
      });

      sent = false;
      const allowed = await runBriefDispatch({
        briefPath: brief,
        message: "hello hub",
        repoRoot: repo.root,
        transport: { send(m) { sent = true; expect(m).toBe("hello hub"); } },
      });
      expect(allowed.ok).toBe(true);
      expect(sent).toBe(true);

      const cliOk = harness(["dispatch", brief, "--say", "hello hub", "--repo", repo.root], repo.root);
      expect(cliOk.status).toBe(0);
      expect(cliOk.stdout).toContain("dispatch: sent");
      expect(cliOk.stdout).toContain("hello hub");

      await repo.cleanup();
    });
  });

  describe("DT-9 brief blobs must match origin/master", () => {
    it("DT-9a refuses when the brief exists only on a side branch (absent on master)", () => {
      requireGit();
      const repo = makeRepo("t195-9a-");
      rawGit(repo.root, ["update-ref", "refs/remotes/origin/master", repo.sha()]);
      rawGit(repo.root, ["checkout", "-b", "side-brief"]);
      const brief = join(repo.root, "docs/loops/side-brief.md");
      const dt = briefDtPath(brief);
      repo.write("docs/loops/side-brief.md", "# side only\n");
      repo.write("docs/loops/side-brief.D_t.json", `${JSON.stringify(validPlan(), null, 2)}\n`);
      repo.commitAll("side brief");
      const master = rawGit(repo.root, ["rev-parse", "origin/master"]);
      const reach = checkBriefReachableFromMaster(repo.root, brief, dt);
      expect(reach.ok).toBe(false);
      expect(reach.sha).toBe(master);
      expect(reach.reasons.some((r) => r.includes("absent on origin/master"))).toBe(true);
      void repo.cleanup();
    });

    it("DT-9b refuses when HEAD is on master but the brief is edited in the working tree", () => {
      requireGit();
      const repo = makeRepo("t195-9b-");
      const brief = join(repo.root, "docs/loops/wt-brief.md");
      const dt = briefDtPath(brief);
      repo.write("docs/loops/wt-brief.md", "# on master\n");
      repo.write("docs/loops/wt-brief.D_t.json", `${JSON.stringify(validPlan(), null, 2)}\n`);
      repo.commitAll("commit brief to master");
      rawGit(repo.root, ["update-ref", "refs/remotes/origin/master", repo.sha()]);
      repo.write("docs/loops/wt-brief.md", "# edited locally\n");
      const master = rawGit(repo.root, ["rev-parse", "origin/master"]);
      const reach = checkBriefReachableFromMaster(repo.root, brief, dt);
      expect(reach.ok).toBe(false);
      expect(reach.sha).toBe(master);
      expect(reach.reasons.some((r) => r.includes("wt-brief.md: differs from origin/master"))).toBe(true);
      void repo.cleanup();
    });

    it("DT-9c refuses when D_t is absent on master", () => {
      requireGit();
      const repo = makeRepo("t195-9c-");
      const brief = join(repo.root, "docs/loops/dt-missing.md");
      const dt = briefDtPath(brief);
      repo.write("docs/loops/dt-missing.md", "# brief only on master\n");
      repo.commitAll("brief without dt on master");
      rawGit(repo.root, ["update-ref", "refs/remotes/origin/master", repo.sha()]);
      repo.write("docs/loops/dt-missing.D_t.json", `${JSON.stringify(validPlan(), null, 2)}\n`);
      const reach = checkBriefReachableFromMaster(repo.root, brief, dt);
      expect(reach.ok).toBe(false);
      expect(reach.reasons.some((r) => r.includes("D_t.json: absent on origin/master"))).toBe(true);
      void repo.cleanup();
    });

    it("DT-9d passes when brief and D_t match origin/master exactly", () => {
      requireGit();
      const repo = makeRepo("t195-9d-");
      const brief = join(repo.root, "docs/loops/ok-brief.md");
      const dt = briefDtPath(brief);
      repo.write("docs/loops/ok-brief.md", "# ok\n");
      repo.write("docs/loops/ok-brief.D_t.json", `${JSON.stringify(validPlan(), null, 2)}\n`);
      repo.commitAll("tracked brief and dt");
      rawGit(repo.root, ["update-ref", "refs/remotes/origin/master", repo.sha()]);
      expect(checkBriefReachableFromMaster(repo.root, brief, dt).ok).toBe(true);
      void repo.cleanup();
    });
  });

  describe("DT-8 preserved runtime paths", () => {
    let repo: ReturnType<typeof makeRepo>;

    beforeEach(() => {
      requireGit();
      repo = makeRepo("t195-runtime-");
    });
    afterEach(() => repo.cleanup());

    it("validate evidence and runLoop still pass unchanged", async () => {
      const validPath = join(dir, "evidence.json");
      writeFileSync(
        validPath,
        JSON.stringify({
          loop: "t001",
          candidate_git: { sha: "a".repeat(40), branch: "main", frozen_at: "2026-09-19T00:00:00.000Z" },
          runtime_checks: {
            build: { command: "node", exit_code: 0, passed: true, duration_ms: 1, detail: "ok" },
            unit: { command: "node", exit_code: 0, passed: true, duration_ms: 1, detail: "ok" },
          },
          requirements: [],
          acceptance: [{ id: "A1", status: "met", order: "shown", evidence: "ok" }],
          regressions: [],
          gaps: [],
          notes: "",
        }),
        "utf-8",
      );
      expect(harness(["validate", "evidence", validPath], dir).status).toBe(0);

      const r = await runLoop({
        repoRoot: repo.root,
        loop: "t001",
        roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() },
        checks: exitingChecks(0, 0),
        gateMode: "skip",
        log: () => {},
      });
      expect(r.status).toBe("completed");
    });
  });
});

describe("T-195 sidecar paths", () => {
  it("allocates monotonic record filenames", () => {
    const brief = join(tmpdir(), "foo-brief.md");
    const p1 = nextBriefGateRecordPath(brief, new Date("2026-09-28T10:00:00.000Z"));
    const p2 = nextBriefGateRecordPath(brief, new Date("2026-09-28T10:00:01.000Z"));
    expect(p1).not.toBe(p2);
    expect(p1).toContain("foo-brief.G_plan.");
  });
});
