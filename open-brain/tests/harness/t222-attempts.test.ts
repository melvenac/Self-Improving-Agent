/**
 * T-222 (D-093, D-092 ruling 3) — an attempt after an UNANSWERED non-retryable outcome is a fresh
 * attempt: not a re-roll, not a retry, still counted toward the cap. No test calls Jev.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { checksFromEvidence } from "../../src/harness/shadow-gates.js";
import { buildCloseoutTables } from "../../src/harness/closeout-tables.js";
import { countAttempts, beginAttempt, endAttempt } from "../../src/harness/gate-records.js";

const TSX = resolve(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const CLI = resolve(__dirname, "../../src/harness/cli.ts");
const REPO = resolve(__dirname, "../../..");
const SLICE = "docs/loops/loop-15-slice-4-records";

function harness(args: readonly string[], cwd: string) {
  const r = spawnSync(process.execPath, [TSX, CLI, ...args], {
    cwd,
    encoding: "utf-8",
    shell: false,
    timeout: 120_000,
    env: { PATH: process.env.PATH ?? "", ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) },
  });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

describe("T-222 F5 — count-attempts after an unanswered auth attempt", { timeout: 120_000 }, () => {
  it("F5.1 a copy of slice four's ledger and records exits 0, with no record edited", () => {
    const dir = mkdtempSync(join(tmpdir(), "t222-slice-"));
    const copy = (rel: string) => {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      copyFileSync(join(REPO, rel), join(dir, rel));
    };
    const ledgerRows = readLedgerPaths(join(REPO, SLICE, "attempts.jsonl"));
    copy(`${SLICE}/attempts.jsonl`);
    for (const rel of ledgerRows) copy(rel);
    const r = harness(["count-attempts", "--repo", dir], dir);
    expect(r.stdout + r.stderr).not.toContain("VIOLATION");
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });

  let dir: string;
  let ledger: string;
  let n = 0;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t222-"));
    mkdirSync(join(dir, "recs"), { recursive: true });
    ledger = join(dir, "attempts.jsonl");
  });
  const subject = (k: string) => ({ gate: "plan", key: k, blob: "b" });
  /** A ledger line AND the record file it names (the counter reads `answer` from the record). */
  const attempt = (k: string, outcome: string, opts: { retryOf?: string | null; attempt?: number; answer?: object | null } = {}): string => {
    n += 1;
    const record_path = `recs/${k}-${n}.json`;
    beginAttempt(ledger, {
      attempt_id: `id-${n}`,
      gate: "plan",
      subject: subject(k),
      attempt: opts.attempt ?? 1,
      retry_of: opts.retryOf ?? null,
      record_path,
      attempted_at: "2026-10-01T00:00:00.000Z",
      mode: "live",
    });
    endAttempt(ledger, { attempt_id: `id-${n}`, outcome_class: outcome as never, completed_at: "2026-10-01T00:00:01.000Z" });
    writeFileSync(join(dir, record_path), JSON.stringify({ sent: false, answer: opts.answer ?? null, outcome_class: outcome }));
    return record_path;
  };

  it("F5.2 an unanswered auth, then a fresh attempt that names it, is no violation and is not a retry", () => {
    const a = attempt("s1", "auth");
    attempt("s1", "answered", { retryOf: a, attempt: 2 });
    const r = countAttempts({ ledger, repoRoot: dir });
    expect(r.violations).toEqual([]);
    expect(r.retries).toBe(0);
    expect(r.total).toBe(2); // still counts toward the cap
  });

  it("F5.3 a fresh attempt still counts toward the cap", () => {
    const a = attempt("s1", "auth");
    attempt("s1", "answered", { retryOf: a, attempt: 2 });
    expect(countAttempts({ ledger, repoRoot: dir, max: 1 }).violations.join("\n")).toContain("ceiling");
  });

  it("F5.4 a retry of an auth that DID get an answer is still a VIOLATION", () => {
    const a = attempt("s1", "auth", { answer: { status: 401 } });
    attempt("s1", "answered", { retryOf: a, attempt: 2 });
    expect(countAttempts({ ledger, repoRoot: dir }).violations.join("\n")).toContain("only transport");
  });

  it("F5.5 a retry whose parent record cannot be read stays a VIOLATION (unanswered is not assumed)", () => {
    const a = attempt("s1", "request-invalid");
    attempt("s1", "answered", { retryOf: a, attempt: 2 });
    rmRecord(dir, a);
    expect(countAttempts({ ledger, repoRoot: dir }).violations.join("\n")).toContain("only transport");
  });

  it("F5.6 a re-roll after an answer is still a VIOLATION", () => {
    const a = attempt("s1", "answered", { answer: { ok: true } });
    attempt("s1", "answered", { retryOf: a, attempt: 2, answer: { ok: true } });
    expect(countAttempts({ ledger, repoRoot: dir }).violations.join("\n")).toContain("re-roll");
  });

  it("F5.7 a transport retry beyond 3 is still a VIOLATION", () => {
    let prev = attempt("s1", "transport");
    for (let i = 2; i <= 5; i += 1) prev = attempt("s1", i === 5 ? "answered" : "transport", { retryOf: prev, attempt: i });
    expect(countAttempts({ ledger, repoRoot: dir }).violations.join("\n")).toContain("4 retries");
  });
});

function readLedgerPaths(file: string): string[] {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const out = new Set<string>();
  for (const line of readFileSync(file, "utf-8").split("\n")) {
    if (line.trim() === "") continue;
    const row = JSON.parse(line) as { record_path?: string };
    if (row.record_path) out.add(row.record_path);
  }
  return [...out];
}

function rmRecord(dir: string, rel: string): void {
  const { rmSync } = require("node:fs") as typeof import("node:fs");
  rmSync(join(dir, rel));
}

describe("T-222 F7 and F8", { timeout: 120_000 }, () => {
  it("F7 an E_t outside the repo is named by its blob alone, never by a machine path", () => {
    const dir = mkdtempSync(join(tmpdir(), "t222-et-"));
    const file = join(dir, "x.E_t.json");
    writeFileSync(file, JSON.stringify({ runtime_checks: { build: { exit_code: 0 }, unit: { exit_code: 0 } } }));
    const repo = mkdtempSync(join(tmpdir(), "t222-repo-"));
    const outside = checksFromEvidence(file, repo).source;
    expect(outside).toMatch(/^E_t:@[0-9a-f]{40}$/);
    expect(outside).not.toContain(dir);
    mkdirSync(join(repo, "docs"), { recursive: true });
    const inside = join(repo, "docs", "x.E_t.json");
    copyFileSync(file, inside);
    expect(checksFromEvidence(inside, repo).source).toMatch(/^E_t:docs\/x\.E_t\.json@[0-9a-f]{40}$/);
  });

  it("F8 the 4.4 table's SHA column is E_t commit; the 4.3 column keeps scored SHA", () => {
    const md = buildCloseoutTables({ recordsDir: join(REPO, SLICE) }).markdown;
    const headers = md.split("\n").filter((l) => l.startsWith("| PR | ") && l.includes("model_resolved"));
    expect(headers).toEqual(["| PR | scored SHA | model_resolved |", "| PR | E_t commit | model_resolved |"]);
  });
});
