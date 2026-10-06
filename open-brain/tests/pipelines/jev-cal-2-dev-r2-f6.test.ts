import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const TSX = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const CLI = join(import.meta.dirname, "../../src/harness/cli.ts");
const RUNLIST = join(ROOT, "docs/loops/jev-calibration-2/runlist.json");

const MINIMAL_RECORD = {
  gate: "developer-done",
  loop: "t001",
  mode: "live",
  sent: true,
  requested_at: "2026-01-01T00:00:00.000Z",
  answered_at: "2026-01-01T00:00:01.000Z",
  model_requested: "jev-latest",
  model_resolved: "jev-1.13.0",
  request: { model: "jev-latest", state: { plan: { loop: "t001", acceptance: [] }, checks: { source: "ci", build: { exit_code: 0 }, unit: { exit_code: 0 } } }, questions: {} },
  answer: {},
  usage: null,
  decision: null,
  runtime_action: "shadow",
  note: "",
  source: "seat",
  plan_provenance: "written-before",
  subject: { gate: "developer-done", key: "k", blob: "b" },
  attempt: 1,
  retry_of: null,
  outcome_class: "answered",
  attempted_at: "2026-01-01T00:00:00.000Z",
  policy_hash: "a".repeat(64),
  pr: 1,
  merge_commit: "b".repeat(40),
  scored_sha: "c".repeat(40),
  base_sha: "d".repeat(40),
  dt: { path: "x", blob: "e" },
  checks_source: "ci",
  checks_passed: true,
  diffstat: [],
};

describe("JEV-CAL-2 DEV r2 F6 — count-attempts runlist ceiling", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it("defaults --max to runlist row count so 33 dev attempts do not trip ceiling 20", () => {
    const dir = mkdtempSync(join(tmpdir(), "cal2-f6-"));
    dirs.push(dir);
    const ledger = join(dir, "attempts.jsonl");
    const lines = [];
    for (let i = 0; i < 33; i += 1) {
      const recordPath = `cal2-case-${i}.G_done.json`;
      writeFileSync(
        join(dir, recordPath),
        JSON.stringify({ ...MINIMAL_RECORD, attempt_id: `id-${i}`, subject: { gate: "developer-done", key: `k${i}`, blob: `b${i}` } }),
      );
      lines.push(
        JSON.stringify({
          event: "begin",
          attempt_id: `id-${i}`,
          gate: "developer-done",
          subject: { gate: "developer-done", key: `k${i}`, blob: `b${i}` },
          record_path: recordPath,
          mode: "live",
          attempt: 1,
          retry_of: null,
          attempted_at: "2026-01-01T00:00:00.000Z",
        }),
      );
      lines.push(
        JSON.stringify({
          event: "end",
          attempt_id: `id-${i}`,
          outcome_class: "answered",
          completed_at: "2026-01-01T00:00:01.000Z",
        }),
      );
    }
    writeFileSync(ledger, `${lines.join("\n")}\n`);
    const r = spawnSync(
      process.execPath,
      [TSX, CLI, "count-attempts", "--runlist", RUNLIST, "--ledger", ledger, "--records", dir, "--repo", dir],
      { encoding: "utf-8" },
    );
    expect(r.status, r.stderr || r.stdout).toBe(0);
    expect(r.stdout).toContain("attempts: 33");
    expect(r.stdout).not.toContain("ceiling is 20");
  });
});
