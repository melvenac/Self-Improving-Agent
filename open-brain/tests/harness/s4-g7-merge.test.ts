/**
 * S4-6d.3, behaviourally (QA 242, r3 item 2): a `reject` G_done and a `reject` G_qa, written where the
 * slice's runners write them, must not move the shadow merge verdict.
 *
 * The static check only guards the CLI call site as written. This test guards the property: it runs
 * `harness shadow-verdict prepare` twice on one fixture repo, once before the records exist and once
 * after, and asserts the verdict, the reasons and the artifact's bytes are the same. Because a
 * wiring could read a record from any conventional place, the reject records are also placed under
 * the names a reader would look for, each carrying a top-level `verdict` as a gate's answer does.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { runShadowDoneGate, NO_CHECKS } from "../../src/harness/shadow-gates.js";
import { runShadowQaGate } from "../../src/harness/shadow-qa.js";
import { JEV_KEY_VAR, type GateAnswer, type GatePayload, type GateTransport } from "../../src/harness/gate.js";
import { makeRepo, rawGit, requireGit, type RepoFixture } from "./fixture.js";
import { harnessEnv, makeCanary } from "./s4-canary.js";

const TSX = resolve(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const CLI = resolve(__dirname, "../../src/harness/cli.ts");
const LOOP = "15-x";
const RECORDS = "docs/loops/loop-15-slice-4-records";
const CRITERIA = "docs/loops/15-x-criteria.md";

const CRITERIA_TEXT = ["# criteria", "", "```qa-declared", "[unrunnable]", "X-1: needs a live run", "```", ""].join("\n");

const REJECT_DONE: Record<string, unknown> = {
  diff_matches_plan: { noul: 0.0 },
  touches_out_of_scope: { noul: 0.01 },
  local_tests_support_claim: { noul: 0.95 },
  stuck_repeating_prior_failure: { noul: 0.01 },
  risk_of_regression: { score: 0, confidence: 0.9 },
};
const FAIL_QA: Record<string, unknown> = {
  "res:requirements:R1": { choice: "fail" },
  "sev:requirements:R1": { score: 2, confidence: 0.9 },
  "res:acceptance:A1": { choice: "fail" },
  "sev:acceptance:A1": { score: 2, confidence: 0.9 },
  regression_of_validated: { noul: 0.9 },
  artifact_complete_enough_to_stop: { noul: 0.1 },
};

const fake = (answers: Record<string, unknown>): GateTransport => ({
  name: "fake",
  async dispatch(p: GatePayload): Promise<GateAnswer> {
    return { gate: p.gate, answers, consulted: true, note: "fake", resolvedModel: "jev-1.13.0", usage: null };
  },
});

const check = { command: "npm run build", exit_code: 0, passed: true, duration_ms: 1, detail: "" };
const evidence = (sha: string, loop = LOOP): Record<string, unknown> => ({
  loop,
  candidate_git: { sha, branch: "loop/x", frozen_at: "2026-10-01T00:00:00Z" },
  runtime_checks: { build: check, unit: check },
  requirements: [{ id: "R1", status: "met", evidence: "ran it", severity: "minor" }],
  acceptance: [{ id: "A1", status: "met", evidence: "ran the command", order: "shown" }],
  regressions: [],
  gaps: [],
  notes: "",
});

describe("S4-6d.3 — the shadow merge verdict ignores the slice's G_done and G_qa", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  let side: string;
  let criteriaSha: string;
  let qaCommit: string;
  let base: string;
  let scored: string;

  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("s4g7-");
    side = mkdtempSync(join(tmpdir(), "s4g7-side-"));
    repo.write(CRITERIA, CRITERIA_TEXT);
    repo.write(
      "docs/loops/15-x.D_t.json",
      JSON.stringify({
        loop: LOOP,
        objective: "o",
        tasks: ["t"],
        out_of_scope: ["x"],
        preserve: ["p"],
        acceptance: [{ id: "A1", observable: "o", type: "blackbox" }],
        repair_targets: ["r"],
        new_capability: "c",
      }),
    );
    base = repo.commitAll("base");
    criteriaSha = base;
    rawGit(repo.root, ["checkout", "-q", "-b", "feature"]);
    repo.write("src/a.ts", "export const a = 1;\n");
    scored = repo.commitAll("scored");
    rawGit(repo.root, ["checkout", "-q", "main"]);
    rawGit(repo.root, ["checkout", "-q", "-b", "qa/x-report"]);
    repo.write("docs/loops/x.E_t.json", `${JSON.stringify(evidence("a".repeat(40)), null, 2)}\n`);
    qaCommit = repo.commitAll("qa report");
    rawGit(repo.root, ["checkout", "-q", "main"]);
  });
  afterEach(() => repo.cleanup());

  /** `harness shadow-verdict prepare` for one candidate sha; returns the exit code, stdout and the artifact text. */
  const prepare = (candidate: string) => {
    const evFile = join(side, `${candidate}.json`);
    writeFileSync(evFile, JSON.stringify(evidence(candidate)));
    const r = spawnSync(
      process.execPath,
      [TSX, CLI, "shadow-verdict", "prepare", "--loop", LOOP, "--candidate", candidate, "--criteria-sha", criteriaSha, "--criteria", CRITERIA, "--evidence", evFile, "--repo", repo.root],
      { cwd: repo.root, encoding: "utf-8", shell: false, timeout: 120_000, env: harnessEnv() },
    );
    if (r.error) throw r.error;
    const path = join(repo.root, "docs/loops/shadow-merge", LOOP, candidate, "shadow_merge.json");
    const text = existsSync(path) ? readFileSync(path, "utf-8") : "";
    // The only run-to-run differences are the timestamp and the candidate sha itself.
    const normal = text.replace(/"written_at": "[^"]*"/, '"written_at": "T"').split(candidate).join("CANDIDATE");
    return { status: r.status, stderr: r.stderr ?? "", artifact: text, normal, json: text === "" ? null : (JSON.parse(text) as { verdict: string; reasons: string[]; inputs: { gates: { done: unknown; plan: unknown } } }) };
  };

  it("V1 with a reject G_done and a reject G_qa on disk, prepare gives the same verdict, reasons and artifact bytes as without them", async () => {
    const without = prepare("b".repeat(40));
    expect(without.status, without.stderr).toBe(0);
    expect(without.json?.verdict).toBe("would-merge"); // a non-vacuous baseline: there is something to move
    expect(without.json?.reasons).toEqual(["A1: met"]);

    // Write the reject records where the runners write them.
    const env = harnessEnv({ [JEV_KEY_VAR]: makeCanary() });
    const done = await runShadowDoneGate({
      repoRoot: repo.root,
      pr: 9,
      mergeCommit: scored,
      scoredSha: scored,
      baseSha: base,
      dtPath: join(repo.root, "docs/loops/15-x.D_t.json"),
      checks: NO_CHECKS,
      mode: "live",
      env,
      transport: fake(REJECT_DONE),
      ledgerPath: join(side, "attempts.jsonl"),
    });
    const qa = await runShadowQaGate({
      repoRoot: repo.root,
      evidence: { branch: "qa/x-report", commit: qaCommit, path: "docs/loops/x.E_t.json" },
      stem: "pr-9",
      mode: "live",
      env,
      transport: fake(FAIL_QA),
      ledgerPath: join(side, "attempts-qa.jsonl"),
    });
    expect(done.decision?.verdict, "the done record must be a reject for this test to mean anything").toBe("reject");
    expect(qa.decision?.verdict, "the qa record must be a reject for this test to mean anything").toBe("reject");
    expect(existsSync(done.recordPath)).toBe(true);
    expect(existsSync(qa.recordPath)).toBe(true);

    // And under the names a reader of "the gate record for this loop" would try, each with a top-level verdict.
    const doneRec = JSON.parse(readFileSync(done.recordPath, "utf-8")) as Record<string, unknown>;
    const qaRec = JSON.parse(readFileSync(qa.recordPath, "utf-8")) as Record<string, unknown>;
    const plant = (rel: string, rec: Record<string, unknown>, verdict: string): void => {
      const p = join(repo.root, rel);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, `${JSON.stringify({ ...rec, verdict }, null, 2)}\n`);
    };
    for (const rel of [`${RECORDS}/${LOOP}.G_done.json`, `${RECORDS}/G_done.json`, `artifacts/iterations/${LOOP}/G_done.json`, `docs/loops/shadow-merge/${LOOP}/G_done.json`]) plant(rel, doneRec, "reject");
    for (const rel of [`${RECORDS}/${LOOP}.G_qa.json`, `${RECORDS}/G_qa.json`, `artifacts/iterations/${LOOP}/G_qa.json`, `docs/loops/shadow-merge/${LOOP}/G_qa.json`]) plant(rel, qaRec, "reject");

    // The slice's records directory is tracked: a runner's record reaches HEAD. Read from git too, not only the tree.
    repo.commitAll("commit the reject records, as a seat does");

    const withRecords = prepare("d".repeat(40));
    expect(withRecords.status, withRecords.stderr).toBe(0);
    expect(withRecords.json?.verdict).toBe(without.json?.verdict);
    expect(withRecords.json?.reasons).toEqual(without.json?.reasons);
    expect(withRecords.json?.inputs.gates).toEqual(without.json?.inputs.gates);
    expect(withRecords.normal).toBe(without.normal);
  });

  it("V2 the check is not vacuous: a verdict that DID read a reject gate would differ (the policy's own gate rule moves it)", () => {
    // Proves the baseline really is movable by a reject gate, via the pure function the CLI calls.
    return import("../../src/harness/shadow-merge.js").then(({ computeShadowMergeVerdict }) => {
      const policy = {
        required_inputs: ["runtime_checks", "E_t.acceptance"] as const,
        require_plan_gate: false,
        require_done_gate: false,
        unmet_is_would_not_merge: true,
        not_evaluated_is_would_not_merge: true,
        partial_is_would_not_merge: true,
        failed_check_is_would_not_merge: true,
        gate_reject_or_halt_is_would_not_merge: true,
      };
      const common = { evidence: evidence("e".repeat(40)), candidateSha: "e".repeat(40), loop: LOOP, criteriaText: CRITERIA_TEXT, policy: policy as never, planGate: null, gateMode: "live" as const };
      expect(computeShadowMergeVerdict({ ...common, doneGate: null }).verdict).toBe("would-merge");
      expect(computeShadowMergeVerdict({ ...common, doneGate: { verdict: "reject" } }).verdict).toBe("would-not-merge");
    });
  });
});
