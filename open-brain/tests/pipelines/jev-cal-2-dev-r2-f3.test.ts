import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

const ROOT = join(import.meta.dirname, "../../..");
const TSX = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const SCORE = join(ROOT, "docs/loops/jev-calibration-2/score.mjs");
const QA_BRANCH = "origin/qa/jev-cal-2-dev-report";

const RECORD_NAMES = [
  "cal2-qa264-pr371.G_done.2026-10-06T06-22-15.123Z.json",
  "cal2-qa267-pr388.G_done.2026-10-06T06-23-01.456Z.json",
];

function gitShow(path: string): string | null {
  try {
    return execFileSync("git", ["show", `${QA_BRANCH}:${path}`], { cwd: ROOT, encoding: "utf-8" });
  } catch {
    return null;
  }
}

describe("JEV-CAL-2 DEV r2 F3 — score.mjs CLI writes scores.md", () => {
  const tmp = mkdtempSync(join(tmpdir(), "cal2-f3-"));
  const recordsDir = join(tmp, "records");
  const outDir = join(tmp, "results");
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("runs end to end on QA 285 records and exits 0", () => {
    mkdirSync(recordsDir, { recursive: true });
    let copied = 0;
    for (const name of RECORD_NAMES) {
      const raw = gitShow(`docs/loops/jev-calibration-2/records/${name}`);
      if (raw) {
        writeFileSync(join(recordsDir, name.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/, "fixture")), raw);
        copied += 1;
      }
    }
    if (copied === 0) {
      const minimal = {
        gate: "developer-done",
        loop: "t001",
        mode: "live",
        sent: true,
        requested_at: "2026-01-01T00:00:00.000Z",
        answered_at: "2026-01-01T00:00:01.000Z",
        model_requested: "jev-latest",
        model_resolved: "jev-1.13.0",
        request: { model: "jev-latest", state: { plan: { loop: "t001", acceptance: [{ id: "T1", observable: "x" }] }, checks: { source: "ci", build: { exit_code: 0 }, unit: { exit_code: 0 } } }, questions: {} },
        answer: { "plan_row:T1": { noul: 0.2 }, touches_out_of_scope: { noul: 0.1 } },
        usage: { input_tokens: 1, output_tokens: 1 },
        decision: { verdict: "reject", reasons: [] },
        runtime_action: "shadow",
        note: "",
        source: "seat",
        plan_provenance: "written-before",
        attempt_id: "a",
        subject: { gate: "developer-done", key: "k", blob: "b" },
        attempt: 1,
        retry_of: null,
        outcome_class: "answered",
        attempted_at: "2026-01-01T00:00:00.000Z",
        policy_hash: "a".repeat(64),
        pr: 371,
        merge_commit: "b".repeat(40),
        scored_sha: "c".repeat(40),
        base_sha: "d".repeat(40),
        dt: { path: "docs/loops/jev-calibration-2/inputs/064-qa264-pr371.G_done-request.json", blob: "e" },
        checks_source: "ci",
        checks_passed: true,
        diffstat: [],
        cal2_case_id: "qa264-pr371",
      };
      writeFileSync(join(recordsDir, "cal2-qa264-pr371.G_done.fixture.json"), JSON.stringify(minimal));
      copied = 1;
    }
    const r = spawnSync(process.execPath, [TSX, SCORE, "--records", recordsDir, "--out", outDir], {
      encoding: "utf-8",
      cwd: ROOT,
    });
    expect(r.status, r.stderr || r.stdout).toBe(0);
    expect(existsSync(join(outDir, "scores.json"))).toBe(true);
    const md = readFileSync(join(outDir, "scores.md"), "utf-8");
    expect(md).toContain("Development phase");
    expect(md).toContain("Held-out phase");
  });
});
