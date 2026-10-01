/**
 * Slice four, G1 — records and provenance (S4-4a, S4-7a, S4-7b).
 *
 * No test here calls Jev. Every transport is a fake and every environment is constructed.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { runLoop } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { runBriefPlanGate } from "../../src/harness/brief-plan-gate.js";
import {
  GateRecordRefused,
  countAttempts,
  gateRecordJsonSchema,
  beginAttempt,
  endAttempt,
  validateGateRecord,
  writeSliceRecord,
  type ShadowDoneRecord,
} from "../../src/harness/gate-records.js";
import { serialiseSchema } from "../../src/harness/schema.js";
import type { GateAnswer, GatePayload, GateTransport } from "../../src/harness/gate.js";
import { exitingChecks, makeRepo, requireGit } from "./fixture.js";

const TSX = resolve(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const CLI = resolve(__dirname, "../../src/harness/cli.ts");
const SCHEMA_FILE = resolve(__dirname, "../../src/harness/schemas/gate-record.schema.json");
const SHA = "a".repeat(40);

/** A constructed environment: only what a spawned CLI needs, never `process.env`. */
const cleanEnv = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => ({
  PATH: process.env.PATH ?? "",
  ...(process.env.USERPROFILE !== undefined ? { USERPROFILE: process.env.USERPROFILE } : {}),
  ...(process.env.HOME !== undefined ? { HOME: process.env.HOME } : {}),
  ...(process.env.SystemRoot !== undefined ? { SystemRoot: process.env.SystemRoot } : {}),
  ...extra,
});

function harness(args: readonly string[], cwd: string) {
  const r = spawnSync(process.execPath, [TSX, CLI, ...args], { cwd, encoding: "utf-8", shell: false, timeout: 120_000, env: cleanEnv() });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const goodDone = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  gate: "developer-done",
  loop: "15-t195",
  mode: "live",
  sent: true,
  requested_at: "2026-10-01T00:00:00.000Z",
  answered_at: "2026-10-01T00:00:01.000Z",
  model_requested: "jev-latest",
  model_resolved: "jev-1.13.0",
  request: {},
  answer: {},
  usage: null,
  decision: null,
  runtime_action: "shadow: recorded only; no outcome was changed",
  note: "n",
  source: "seat",
  plan_provenance: "reconstructed-after",
  attempt_id: "id-1",
  subject: { gate: "developer-done", key: SHA, blob: "b".repeat(40) },
  attempt: 1,
  retry_of: null,
  outcome_class: "answered",
  attempted_at: "2026-10-01T00:00:00.000Z",
  policy_hash: "c".repeat(64),
  pr: 209,
  merge_commit: SHA,
  scored_sha: SHA,
  base_sha: "d".repeat(40),
  dt: { path: "docs/loops/x.D_t.json", blob: "e".repeat(40) },
  checks_source: "none",
  checks_passed: false,
  diffstat: ["a.ts"],
  ...over,
});

const goodQa = (over: Record<string, unknown> = {}): Record<string, unknown> => {
  const {
    pr: _pr, merge_commit: _m, scored_sha: _s, base_sha: _b, dt: _d, checks_source: _cs, checks_passed: _cp, diffstat: _ds,
    ...rest
  } = goodDone() as Record<string, unknown>;
  return {
    ...rest,
    gate: "qa-score",
    subject: { gate: "qa-score", key: SHA, blob: "f".repeat(40) },
    e_t_ref: { branch: "qa/t195-r2-report", commit: SHA, path: "docs/loops/x.E_t.json", blob: "f".repeat(40) },
    results: [{ id: "R1", from: "requirements", result: "pass", decided_by: "jev", severity: null }],
    missing: [],
    regression_of_validated: 0.1,
    artifact_complete_enough_to_stop: 0.9,
    ...over,
  };
};

describe("S4-4a — provenance is required, by the writer and by the validator", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "s4g1-"));
  });

  it("P1 a good G_done and a good G_qa are accepted and written once", () => {
    for (const [name, rec] of [["done", goodDone()], ["qa", goodQa()]] as const) {
      expect(validateGateRecord(rec).ok, name).toBe(true);
      const path = join(dir, `${name}.json`);
      writeSliceRecord(path, rec);
      expect(existsSync(path)).toBe(true);
      expect(() => writeSliceRecord(path, rec), "a second write").toThrow(GateRecordRefused);
    }
  });

  it("P2 the writer refuses each field missing and each field out of set, and creates no file", () => {
    const cases: [string, Record<string, unknown>][] = [];
    for (const [kind, make] of [["G_done", goodDone], ["G_qa", goodQa]] as const) {
      const noSource = make();
      delete noSource.source;
      const noProv = make();
      delete noProv.plan_provenance;
      cases.push(
        [`${kind} no source`, noSource],
        [`${kind} no plan_provenance`, noProv],
        [`${kind} source "Seat"`, make({ source: "Seat" })],
        [`${kind} plan_provenance "reconstructed"`, make({ plan_provenance: "reconstructed" })],
      );
    }
    for (const [label, rec] of cases) {
      const path = join(dir, `${label.replace(/\W+/g, "_")}.json`);
      expect(() => writeSliceRecord(path, rec), label).toThrow(GateRecordRefused);
      expect(existsSync(path), `${label}: a file was created`).toBe(false);
    }
  });

  it("P3 a strict schema refuses an unknown key", () => {
    expect(validateGateRecord(goodDone({ extra: 1 })).ok).toBe(false);
  });

  it("P4 `harness validate gate-record` exits 0 on a good record and non-zero on a hand-written bad one", () => {
    const good = join(dir, "good.json");
    const bad = join(dir, "bad.json");
    writeFileSync(good, JSON.stringify(goodDone()));
    const noSource = goodDone();
    delete noSource.source;
    writeFileSync(bad, JSON.stringify(noSource));
    expect(harness(["validate", "gate-record", good], dir).status).toBe(0);
    const r = harness(["validate", "gate-record", bad], dir);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("source");
    writeFileSync(bad, JSON.stringify(goodQa({ plan_provenance: undefined })));
    expect(harness(["validate", "gate-record", bad], dir).status).toBe(1);
  });

  it("P5 source is never inferred from the loop id: a seat record whose loop looks like a runtime id stays seat", () => {
    const rec = goodDone({ loop: "t195", source: "seat" });
    const v = validateGateRecord(rec);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect((v.value as ShadowDoneRecord).source).toBe("seat");
    const path = join(dir, "t195.json");
    writeSliceRecord(path, rec);
    expect(JSON.parse(readFileSync(path, "utf-8")).source).toBe("seat");
    // And the other way: a runtime-shaped id with source "runtime" is a different claim, not an inference.
    expect((validateGateRecord(goodDone({ loop: "15-t195", source: "runtime" })) as { value: { source: string } }).value.source).toBe("runtime");
  });

  it("P6 the derived JSON Schema file matches what zod derives", () => {
    expect(readFileSync(SCHEMA_FILE, "utf-8")).toBe(serialiseSchema(gateRecordJsonSchema()));
  });
});

describe("S4-4a.4 — the runtime's own G_done carries the provenance", () => {
  beforeAll(() => requireGit());
  let repo: ReturnType<typeof makeRepo>;
  beforeEach(() => {
    repo = makeRepo("s4g1-loop-");
  });
  afterEach(() => repo.cleanup());

  it("R1 runLoop with a fake transport writes source runtime and plan_provenance written-before", async () => {
    const answers: Record<string, unknown> = {
      plan_mode: { choice: "mixed", confidence: 0.9 },
      scope_size: { score: 1, confidence: 0.9 },
      preserves_validated: { noul: 0.95 },
      addresses_top_failures: { noul: 0.95 },
      has_observable_acceptance: { noul: 0.95 },
      diff_matches_plan: { noul: 0.95 },
      touches_out_of_scope: { noul: 0.01 },
      local_tests_support_claim: { noul: 0.95 },
      stuck_repeating_prior_failure: { noul: 0.01 },
      risk_of_regression: { score: 0, confidence: 0.9 },
    };
    const transport: GateTransport = {
      name: "fake",
      async dispatch(p: GatePayload): Promise<GateAnswer> {
        return { gate: p.gate, answers, consulted: true, note: "fake", resolvedModel: "jev-1.13.0", usage: null };
      },
    };
    const r = await runLoop({
      repoRoot: repo.root,
      loop: "t001",
      roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() },
      checks: exitingChecks(0, 0),
      gateMode: "live",
      transport,
      env: cleanEnv({ TYPESAFE_API_KEY: "S4CANARY-0123456789abcdef01234567" }),
      log: () => {},
    });
    expect(r.failure, r.failure?.reason).toBeNull();
    const rec = JSON.parse(readFileSync(join(repo.root, "artifacts/iterations/t001/G_done.json"), "utf-8"));
    expect(rec.source).toBe("runtime");
    expect(rec.plan_provenance).toBe("written-before");
    expect(validateGateRecord(rec).ok).toBe(true);
  });
});

/* ------------------------------------------------------------------------- *
 * S4-7a — write-ahead
 * ------------------------------------------------------------------------- */

describe("S4-7a — the attempt is on disk before the request leaves", () => {
  it("W1 a request that never resolves still leaves its attempt, marked incomplete", async () => {
    const dir = mkdtempSync(join(tmpdir(), "s4g1-wa-"));
    const brief = join(dir, "b-brief.md");
    writeFileSync(brief, "# b\n");
    writeFileSync(
      join(dir, "b-brief.D_t.json"),
      JSON.stringify({
        loop: "15-b",
        objective: "o",
        tasks: ["t"],
        out_of_scope: ["x"],
        preserve: ["p"],
        acceptance: [{ id: "A1", observable: "o", type: "blackbox" }],
        repair_targets: ["r"],
        new_capability: "c",
      }),
    );
    const ledger = join(dir, "attempts.jsonl");
    let reached = false;
    const never = (() => {
      reached = true;
      return new Promise(() => {});
    }) as unknown as typeof fetch;
    // Deliberately not awaited: the request never settles, which is the case under test.
    void runBriefPlanGate({
      dtPath: join(dir, "b-brief.D_t.json"),
      repoRoot: dir,
      mode: "live",
      env: cleanEnv({ TYPESAFE_API_KEY: "S4CANARY-0123456789abcdef01234567" }),
      fetchImpl: never,
      ledgerPath: ledger,
    }).catch(() => {});
    const deadline = Date.now() + 5000;
    while (!reached && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
    expect(reached, "fetch was never called").toBe(true);
    const lines = readFileSync(ledger, "utf-8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines).toHaveLength(1);
    expect(lines[0].event).toBe("begin");
    expect(lines[0].mode).toBe("live");
    expect(readdirSync(dir).filter((n) => n.includes("G_plan"))).toEqual([]);
    const report = countAttempts({ ledger, repoRoot: dir });
    expect(report.total).toBe(1);
    expect(report.incomplete).toBe(1);
  });
});

/* ------------------------------------------------------------------------- *
 * S4-7b — a retry is not a re-roll; the counting command
 * ------------------------------------------------------------------------- */

describe("S4-7a/7b — the counting command", () => {
  let dir: string;
  let ledger: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "s4g1-count-"));
    mkdirSync(join(dir, "recs"), { recursive: true });
    ledger = join(dir, "attempts.jsonl");
  });

  const subject = (k: string) => ({ gate: "developer-done", key: k, blob: "b" });
  let n = 0;
  const attempt = (k: string, outcome: string, opts: { retryOf?: string | null; attempt?: number; id?: string } = {}): string => {
    n += 1;
    const id = opts.id ?? `id-${n}`;
    const record_path = `recs/${k}-${n}.G_done.json`;
    beginAttempt(ledger, {
      attempt_id: id,
      gate: "developer-done",
      subject: subject(k),
      attempt: opts.attempt ?? 1,
      retry_of: opts.retryOf ?? null,
      record_path,
      attempted_at: "2026-10-01T00:00:00.000Z",
      mode: "live",
    });
    endAttempt(ledger, { attempt_id: id, outcome_class: outcome as never, completed_at: "2026-10-01T00:00:01.000Z" });
    return record_path;
  };

  it("C1 a legal retry chain passes: transport, then rate-limited, then answered", () => {
    const a = attempt("s1", "transport");
    const b = attempt("s1", "rate-limited", { retryOf: a, attempt: 2 });
    attempt("s1", "answered", { retryOf: b, attempt: 3 });
    attempt("s2", "answered");
    const r = countAttempts({ ledger, repoRoot: dir });
    expect(r.violations).toEqual([]);
    expect(r.total).toBe(4);
    expect(r.retries).toBe(2);
    expect(r.answered).toBe(2);
  });

  it("C2 a re-roll fails: a second answered record for the same subject", () => {
    const a = attempt("s1", "answered");
    attempt("s1", "answered", { retryOf: a, attempt: 2 });
    const r = countAttempts({ ledger, repoRoot: dir });
    expect(r.violations.join("\n")).toContain("re-roll");
  });

  it("C3 a non-first record with no retry_of fails, and so does a retry of a non-retryable outcome", () => {
    attempt("s1", "transport");
    attempt("s1", "answered", { attempt: 2 });
    const r1 = countAttempts({ ledger, repoRoot: dir });
    expect(r1.violations.join("\n")).toContain("retry_of");

    const dir2 = mkdtempSync(join(tmpdir(), "s4g1-count2-"));
    const l2 = join(dir2, "a.jsonl");
    const put = (id: string, outcome: string, retryOf: string | null, rp: string) => {
      beginAttempt(l2, { attempt_id: id, gate: "x", subject: subject("s9"), attempt: 1, retry_of: retryOf, record_path: rp, attempted_at: "t", mode: "live" });
      endAttempt(l2, { attempt_id: id, outcome_class: outcome as never, completed_at: "t" });
    };
    put("a", "request-invalid", null, "r/a.json");
    put("b", "answered", "r/a.json", "r/b.json");
    expect(countAttempts({ ledger: l2, repoRoot: dir2 }).violations.join("\n")).toContain("only transport");
  });

  it("C4 more than 3 retries fails, and so does a 21st attempt", () => {
    let prev = attempt("s1", "transport");
    for (let i = 2; i <= 5; i++) prev = attempt("s1", i === 5 ? "answered" : "transport", { retryOf: prev, attempt: i });
    expect(countAttempts({ ledger, repoRoot: dir }).violations.join("\n")).toContain("4 retries");

    const dir3 = mkdtempSync(join(tmpdir(), "s4g1-count3-"));
    const l3 = join(dir3, "a.jsonl");
    for (let i = 0; i < 21; i++) {
      beginAttempt(l3, { attempt_id: `i${i}`, gate: "x", subject: subject(`k${i}`), attempt: 1, retry_of: null, record_path: `r/${i}.json`, attempted_at: "t", mode: "live" });
      endAttempt(l3, { attempt_id: `i${i}`, outcome_class: "answered", completed_at: "t" });
    }
    const r = countAttempts({ ledger: l3, repoRoot: dir3 });
    expect(r.total).toBe(21);
    expect(r.violations.join("\n")).toContain("ceiling is 20");
  });

  it("C5 a refusal before any request (no key) is not a call, and a live record outside the ledger still counts", () => {
    attempt("s1", "unavailable");
    writeFileSync(
      join(dir, "recs", "x.G_qa.json"),
      JSON.stringify({ mode: "live", attempted_at: "2026-10-01T00:00:00.000Z", attempt_id: "only-in-record", subject: { gate: "qa-score", key: "k", blob: "b" }, attempt: 1, retry_of: null, outcome_class: "answered" }),
    );
    const r = countAttempts({ ledger, recordsDir: join(dir, "recs"), repoRoot: dir });
    expect(r.total).toBe(1);
    expect(r.files_scanned).toEqual({ ledger: 1, records: 1 });
  });

  it("C6 `harness count-attempts` exits 0 on the legal chain and 1 on a re-roll", () => {
    const a = attempt("s1", "transport");
    attempt("s1", "answered", { retryOf: a, attempt: 2 });
    const ok = harness(["count-attempts", "--ledger", ledger, "--repo", dir], dir);
    expect(ok.status, ok.stdout + ok.stderr).toBe(0);
    expect(ok.stdout).toContain("attempts: 2");
    const b = attempt("s2", "answered");
    attempt("s2", "answered", { retryOf: b, attempt: 2 });
    expect(harness(["count-attempts", "--ledger", ledger, "--repo", dir], dir).status).toBe(1);
  });
});
