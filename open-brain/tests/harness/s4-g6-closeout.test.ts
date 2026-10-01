/**
 * Slice four, G6 — the close-out tables are generated from the gate records (S4-5a).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { buildCloseoutTables, provisionalLabel } from "../../src/harness/closeout-tables.js";
import { writeSliceRecord } from "../../src/harness/gate-records.js";
import { loadPolicies, loadQaScorePolicy } from "../../src/harness/policies.js";
import { harnessEnv } from "./s4-canary.js";

const TSX = resolve(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const CLI = resolve(__dirname, "../../src/harness/cli.ts");
const POLICY_DIR = resolve(__dirname, "../../src/harness/policies");
const sha = (c: string): string => c.repeat(40);

import { createHash } from "node:crypto";
const hashOf = (f: string): string => createHash("sha256").update(readFileSync(join(POLICY_DIR, f))).digest("hex");

const base = (): Record<string, unknown> => ({
  mode: "live",
  sent: true,
  requested_at: "t",
  answered_at: "t",
  model_requested: "jev-latest",
  model_resolved: "jev-1.13.0",
  request: {},
  usage: null,
  decision: null,
  runtime_action: "shadow: recorded only; no outcome was changed",
  note: "",
  source: "seat",
  plan_provenance: "reconstructed-after",
  retry_of: null,
  outcome_class: "answered",
  attempted_at: "t",
});

const done = (pr: number, scored: string, match: number, risk: number, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...base(),
  gate: "developer-done",
  loop: `15-t${pr}`,
  attempt_id: `d${pr}`,
  subject: { gate: "developer-done", key: scored, blob: "b" },
  attempt: 1,
  policy_hash: hashOf("developer-done.json"),
  answer: {
    diff_matches_plan: { noul: match },
    touches_out_of_scope: { noul: 0.1 },
    local_tests_support_claim: { noul: 0.9 },
    stuck_repeating_prior_failure: { noul: 0.1 },
    risk_of_regression: { score: risk, confidence: 0.9 },
  },
  pr,
  merge_commit: sha("c"),
  scored_sha: scored,
  base_sha: sha("0"),
  dt: { path: `docs/loops/loop-15-slice-4-records/pr-${pr}.D_t.json`, blob: "x" },
  checks_source: "none",
  checks_passed: false,
  diffstat: [],
  ...over,
});

const qa = (pr: number, commit: string, regression: number, complete: number, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...base(),
  gate: "qa-score",
  loop: `15-t${pr}`,
  attempt_id: `q${pr}`,
  subject: { gate: "qa-score", key: `${commit}:p`, blob: "b" },
  attempt: 1,
  policy_hash: hashOf("qa-score.json"),
  answer: { regression_of_validated: { noul: regression } },
  e_t_ref: { branch: "qa/x", commit, path: "p", blob: "b" },
  results: [{ id: "R1", from: "requirements", result: "fail", decided_by: "jev", severity: 1 }],
  missing: [],
  regression_of_validated: regression,
  artifact_complete_enough_to_stop: complete,
  ...over,
});

describe("G6 — the close-out tables", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "s4g6-"));
    mkdirSync(dir, { recursive: true });
    for (const pr of [10, 20, 30, 40]) writeFileSync(join(dir, `pr-${pr}.D_t.json`), "{}");
    writeSliceRecord(join(dir, "pr-10.G_done.a.json"), done(10, sha("1"), 0.95, 0));
    writeSliceRecord(join(dir, "pr-20.G_done.a.json"), done(20, sha("2"), 0.5, 1));
    writeSliceRecord(join(dir, "pr-30.G_done.a.json"), done(30, sha("3"), 0.8, 2));
    writeSliceRecord(join(dir, "pr-10.G_qa.a.json"), qa(10, sha("a"), 0.1, 0.9));
    writeSliceRecord(join(dir, "pr-20.G_qa.a.json"), qa(20, sha("b"), 0.7, 0.3));
    writeFileSync(join(dir, "pr-10.E_t.json"), "{}");
    writeFileSync(join(dir, "pr-20.E_t.json"), "{}");
  });

  it("T1 the label is computed from the records: N and the seat/runtime split come from `source`", () => {
    const t = buildCloseoutTables({ recordsDir: dir });
    expect(t.markdown).toContain("PROVISIONAL (N=3 seat-built, 0 runtime)");
    expect(t.markdown).toContain("PROVISIONAL (N=2 seat-built, 0 runtime)");
    expect(provisionalLabel([{ source: "seat" }, { source: "runtime" }, { source: "seat" }])).toBe("PROVISIONAL (N=2 seat-built, 1 runtime)");
  });

  it("T2 each threshold row names its value, N, every per-diff value, min, max and the count on each side", () => {
    const policy = loadPolicies(POLICY_DIR).done;
    const t = buildCloseoutTables({ recordsDir: dir }).markdown;
    const row = t.split("\n").find((l) => l.startsWith("| diff_matches_plan_min |"))!;
    expect(row).toBeDefined();
    const values = [0.95, 0.5, 0.8];
    const reject = values.filter((v) => v < policy.diff_matches_plan_min).length;
    expect(row).toContain(`| ${policy.diff_matches_plan_min} | below | 3 | PR 10: 0.95; PR 20: 0.5; PR 30: 0.8 | 0.5 | 0.95 | ${reject} | ${3 - reject} |`);
    const risk = t.split("\n").find((l) => l.startsWith("| risk_of_regression_rollback_at_or_above |"))!;
    const atOrAbove = [0, 1, 2].filter((v) => v >= policy.risk_of_regression_rollback_at_or_above).length;
    expect(risk).toContain(`| at-or-above | 3 | PR 10: 0; PR 20: 1; PR 30: 2 | 0 | 2 | ${atOrAbove} | ${3 - atOrAbove} |`);
  });

  it("T3 the 4.4 table uses qa-score.json's values and the scored E_t commits", () => {
    const policy = loadQaScorePolicy(POLICY_DIR);
    const t = buildCloseoutTables({ recordsDir: dir }).markdown;
    const row = t.split("\n").find((l) => l.startsWith("| regression_of_validated_max |"))!;
    const reject = [0.1, 0.7].filter((v) => v > policy.regression_of_validated_max).length;
    expect(row).toContain(`| ${policy.regression_of_validated_max} | above | 2 | PR 10: 0.1; PR 20: 0.7 | 0.1 | 0.7 | ${reject} | ${2 - reject} |`);
    expect(t).toContain(sha("a"));
    expect(t).toContain(sha("b"));
  });

  it("T4 a diff with no E_t is listed as `not scored: no E_t`, never dropped", () => {
    const t = buildCloseoutTables({ recordsDir: dir }).markdown;
    expect(t).toContain("| 10 | scored | scored |");
    expect(t).toContain("| 30 | scored | not scored: no E_t |");
    expect(t).toContain("| 40 | not scored | not scored: no E_t |");
  });

  it("T5 a record that is not live, not answered, or refused by the schema is not counted", () => {
    writeSliceRecord(join(dir, "pr-40.G_done.dry.json"), done(40, sha("4"), 0.9, 0, { mode: "dry-run", attempted_at: null }));
    writeSliceRecord(join(dir, "pr-40.G_done.fail.json"), done(40, sha("5"), 0.9, 0, { outcome_class: "transport", answer: null }));
    const bad = done(40, sha("6"), 0.9, 0);
    delete bad.source;
    writeFileSync(join(dir, "pr-40.G_done.bad.json"), JSON.stringify(bad));
    const t = buildCloseoutTables({ recordsDir: dir });
    expect(t.doneN).toBe(3);
    expect(t.refused.join("\n")).toContain("pr-40.G_done.bad.json");
  });

  it("T6 deterministic: two runs over the same records are byte-identical, and the output carries no forbidden word", () => {
    const a = buildCloseoutTables({ recordsDir: dir }).markdown;
    const b = buildCloseoutTables({ recordsDir: dir }).markdown;
    expect(a).toBe(b);
    expect(a).not.toMatch(new RegExp(`\\b${"calibrat"}${"ed"}\\b`, "i"));
  });

  it("T7 a different model_resolved across records is said out loud, and one below the minimum is named", () => {
    writeSliceRecord(join(dir, "pr-40.G_done.old.json"), done(40, sha("7"), 0.9, 0, { model_resolved: "jev-1.9.0" }));
    const t = buildCloseoutTables({ recordsDir: dir }).markdown;
    expect(t).toContain("DIFFER in model_resolved");
    expect(t).toContain("BELOW jev-1.13.0: PR 40");
  });

  it("T8 a stale policy_hash is reported as a mismatch", () => {
    writeSliceRecord(join(dir, "pr-40.G_done.stale.json"), done(40, sha("8"), 0.9, 0, { policy_hash: "0".repeat(64) }));
    expect(buildCloseoutTables({ recordsDir: dir }).markdown).toContain("MISMATCH on PR 40");
  });

  it("C1 `harness closeout-tables --check` passes on a report holding the tables verbatim and fails when one number is edited", () => {
    const tables = buildCloseoutTables({ recordsDir: dir }).markdown;
    const good = join(dir, "report-good.md");
    const edited = join(dir, "report-edited.md");
    writeFileSync(good, `# Close-out\n\n${tables}\nMore prose.\n`);
    writeFileSync(edited, `# Close-out\n\n${tables.replace("PR 10: 0.95", "PR 10: 0.96")}\n`);
    const run = (file: string) =>
      spawnSync(process.execPath, [TSX, CLI, "closeout-tables", "--records", dir, "--check", file], { encoding: "utf-8", shell: false, timeout: 120_000, env: harnessEnv() });
    const ok = run(good);
    expect(ok.status, ok.stdout + ok.stderr).toBe(0);
    const bad = run(edited);
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain("does not contain");
  });
});
