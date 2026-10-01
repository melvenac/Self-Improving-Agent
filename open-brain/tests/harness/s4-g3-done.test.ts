/**
 * Slice four, G3 — the 4.3 done-gate runner, out of loop, in shadow (S4-4, S4-6d.1, S4-3b.1).
 *
 * No live Jev call: every transport is a fake and every environment is constructed.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { runShadowDoneGate, NO_CHECKS, SHADOW_RUNTIME_ACTION, checksFromEvidence } from "../../src/harness/shadow-gates.js";
import { countAttempts, validateGateRecord } from "../../src/harness/gate-records.js";
import { GateCallFailed, JEV_KEY_VAR, jevModelAtLeast, type GateAnswer, type GatePayload, type GateTransport } from "../../src/harness/gate.js";
import { makeRepo, rawGit, requireGit, type RepoFixture } from "./fixture.js";
import { harnessEnv, hostileFetch, makeCanary, scanForCanary, scanKnownPositive, type SeenRequest } from "./s4-canary.js";

const TSX = resolve(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const CLI = resolve(__dirname, "../../src/harness/cli.ts");
const POLICY_DIR = resolve(__dirname, "../../src/harness/policies");

const PROCEED: Record<string, unknown> = {
  diff_matches_plan: { noul: 0.95 },
  touches_out_of_scope: { noul: 0.01 },
  local_tests_support_claim: { noul: 0.95 },
  stuck_repeating_prior_failure: { noul: 0.01 },
  risk_of_regression: { score: 0, confidence: 0.9 },
};
const REJECT: Record<string, unknown> = { ...PROCEED, diff_matches_plan: { noul: 0.0 } };

function fakeTransport(answers: Record<string, unknown> | null, seen: GatePayload[] = []): GateTransport {
  return {
    name: "fake",
    async dispatch(p: GatePayload): Promise<GateAnswer> {
      seen.push(p);
      return { gate: p.gate, answers, consulted: answers !== null, note: "fake", resolvedModel: "jev-1.13.0", usage: { input_tokens: 1, output_tokens: 1 } };
    },
  };
}

interface Diff {
  base: string;
  scored: string;
  merge: string;
}

describe("G3 — the 4.3 shadow done-gate runner", () => {
  let repo: RepoFixture;
  let diff: Diff;
  let side: string;
  const DT = "docs/loops/15-x.D_t.json";
  const RECORDS = "docs/loops/loop-15-slice-4-records";

  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("s4g3-");
    side = mkdtempSync(join(tmpdir(), "s4g3-side-"));
    repo.write(
      DT,
      JSON.stringify({
        loop: "15-x",
        objective: "Add a thing.",
        tasks: ["add src/a.ts"],
        out_of_scope: ["src/b.ts"],
        preserve: ["the suite"],
        acceptance: [{ id: "A1", observable: "a.ts exists", type: "blackbox" }],
        repair_targets: ["a known gap"],
        new_capability: "a thing",
      }),
    );
    repo.write("docs/loops/x.E_t.json", JSON.stringify({ runtime_checks: { build: { exit_code: 0 }, unit: { exit_code: 0 } } }));
    repo.write("docs/loops/qa-report.md", "VERDICT: ACCEPT\n");
    repo.write("docs/loops/shadow-merge/ledger.jsonl", '{"row":1}\n');
    repo.write("docs/loops/shadow-merge/c/shadow_merge.json", '{"verdict":"x"}\n');
    const base = repo.commitAll("base");
    rawGit(repo.root, ["checkout", "-q", "-b", "feature"]);
    repo.write("src/a.ts", "export const a = 1;\n");
    const scored = repo.commitAll("scored");
    rawGit(repo.root, ["checkout", "-q", "main"]);
    repo.write("docs/other.md", "unrelated change on main\n");
    repo.commitAll("main moves on");
    rawGit(repo.root, ["merge", "--no-ff", "-q", "-m", "merge feature", "feature"]);
    diff = { base, scored, merge: repo.sha() };
  });
  afterEach(async () => {
    process.exitCode = undefined;
    await repo.cleanup();
  });

  const run = (over: Record<string, unknown> = {}) =>
    runShadowDoneGate({
      repoRoot: repo.root,
      pr: 209,
      mergeCommit: diff.merge,
      scoredSha: diff.scored,
      baseSha: diff.base,
      dtPath: join(repo.root, DT),
      checks: NO_CHECKS,
      mode: "live",
      env: harnessEnv({ [JEV_KEY_VAR]: makeCanary() }),
      transport: fakeTransport(PROCEED),
      ledgerPath: join(side, "attempts.jsonl"),
      at: new Date("2026-10-01T00:00:00.000Z"),
      ...over,
    });

  /* S4-4.2, 4.3, 4.4, 4.5 ----------------------------------------------- */

  it("D1 the record names pr, merge_commit, scored_sha, base_sha and the D_t by path and blob", async () => {
    const seen: GatePayload[] = [];
    const r = await run({ transport: fakeTransport(PROCEED, seen) });
    const rec = JSON.parse(readFileSync(r.recordPath, "utf-8"));
    expect(validateGateRecord(rec).ok).toBe(true);
    expect([rec.pr, rec.merge_commit, rec.scored_sha, rec.base_sha]).toEqual([209, diff.merge, diff.scored, diff.base]);
    expect(rec.dt.path).toBe(DT);
    expect(rec.dt.blob).toBe(rawGit(repo.root, ["rev-parse", `HEAD:${DT}`]));
    expect(rec.source).toBe("seat");
    expect(rec.plan_provenance).toBe("reconstructed-after");
    expect(rec.policy_hash).toBe(createHash("sha256").update(readFileSync(join(POLICY_DIR, "developer-done.json"))).digest("hex"));
    expect(jevModelAtLeast(rec.model_resolved)).toBe(true);
    // The gate asked its five questions in ONE request.
    expect(seen).toHaveLength(1);
    expect(seen[0]!.questions.map((q) => q.id)).toEqual([
      "diff_matches_plan",
      "touches_out_of_scope",
      "local_tests_support_claim",
      "stuck_repeating_prior_failure",
      "risk_of_regression",
    ]);
  });

  it("D2 the diffstat is recomputed from base_sha..scored_sha, not read from the merge", async () => {
    const r = await run();
    expect(r.record.diffstat).toEqual(["src/a.ts"]);
    // base..merge also holds the unrelated change main made meanwhile; a diffstat taken from the
    // merge instead of from base..scored would carry it.
    expect(rawGit(repo.root, ["diff", "--name-only", diff.base, diff.merge])).toContain("docs/other.md");
    expect(r.record.diffstat).not.toContain("docs/other.md");
    expect(JSON.stringify(r.record.request)).toContain("src/a.ts");
  });

  it("D3 checks_source none means checksPassed false, and the exit codes come from a recorded source, never from Jev", async () => {
    const none = await run();
    expect(none.record.checks_source).toBe("none");
    expect(none.record.checks_passed).toBe(false);
    expect(none.decision?.verdict).toBe("reject");
    expect(none.decision?.reasons.join(" ")).toContain("deterministic checks failed");

    const checks = checksFromEvidence(join(repo.root, "docs/loops/x.E_t.json"));
    expect(checks.source).toMatch(/^E_t:.*x\.E_t\.json@[0-9a-f]{40}$/);
    const green = await run({ checks, at: new Date("2026-10-01T00:00:01.000Z"), ledgerPath: join(side, "second.jsonl") });
    expect(green.record.checks_passed).toBe(true);
    expect(green.decision?.verdict).toBe("proceed");
    // No question asks whether the tests passed (HOH-JEV section 4).
    const prompts = (green.record.request as { questions: Record<string, { instructions: string }> }).questions;
    for (const q of Object.values(prompts)) expect(q.instructions).not.toMatch(/did the tests pass|do the tests pass/i);
  });

  it("D4 runtime_action says no outcome was changed, and never reads 'failed the loop'", async () => {
    for (const answers of [PROCEED, REJECT]) {
      const r = await run({ transport: fakeTransport(answers), ledgerPath: join(side, `${Math.random()}.jsonl`), at: new Date(Date.now() + Math.random() * 1e6) });
      expect(r.record.runtime_action).toBe(SHADOW_RUNTIME_ACTION);
      expect(r.record.runtime_action).not.toMatch(/failed the loop/);
    }
  });

  /* S4-6d.1 — the flip test ------------------------------------------------ */

  const trackedHashes = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const f of rawGit(repo.root, ["ls-files"]).split("\n")) {
      out[f] = createHash("sha256").update(readFileSync(join(repo.root, f))).digest("hex");
    }
    return out;
  };
  const untracked = (): string[] =>
    rawGit(repo.root, ["status", "--porcelain", "--untracked-files=all"]).split("\n").filter((l) => l !== "");

  it("D5 the flip test: proceed and reject give the same exit code (0), the same files, and only a new record", async () => {
    const before = trackedHashes();
    process.exitCode = undefined;

    const first = await run({ transport: fakeTransport(PROCEED), checks: checksFromEvidence(join(repo.root, "docs/loops/x.E_t.json")) });
    const statusAfterFirst = untracked();
    const exitAfterFirst = process.exitCode;

    const second = await run({
      transport: fakeTransport(REJECT),
      checks: checksFromEvidence(join(repo.root, "docs/loops/x.E_t.json")),
      at: new Date("2026-10-01T00:05:00.000Z"),
      ledgerPath: join(side, "second.jsonl"),
    });
    const statusAfterSecond = untracked();

    expect(first.decision?.verdict).toBe("proceed");
    expect(second.decision?.verdict).toBe("reject");
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(exitAfterFirst ?? 0).toBe(0);
    expect(process.exitCode ?? 0).toBe(0);

    // Only the new gate records exist beyond the committed tree, one per run, and no tracked file moved.
    expect(statusAfterFirst).toEqual([`?? ${RECORDS}/pr-209.G_done.2026-10-01T00-00-00.000Z.json`]);
    expect(statusAfterSecond).toHaveLength(2);
    expect(statusAfterSecond.every((l) => l.startsWith("?? "))).toBe(true);
    expect(trackedHashes()).toEqual(before);
    // The named immutable inputs are among them.
    for (const f of ["docs/loops/x.E_t.json", "docs/loops/qa-report.md", "docs/loops/shadow-merge/ledger.jsonl", "docs/loops/shadow-merge/c/shadow_merge.json"]) {
      expect(before[f], `${f} was not part of the comparison`).toBeDefined();
    }
    for (const f of ["developer-done.json", "plan-gate.json", "merge.json"]) {
      expect(existsSync(join(POLICY_DIR, f))).toBe(true);
    }
  });

  /* S4-7 — write-ahead and the retry chain through the runner ----------------- */

  it("D6 a transport failure is a retryable record; the retry links to it; a re-roll after an answer is caught", async () => {
    const ledger = join(side, "chain.jsonl");
    const failing: GateTransport = {
      name: "fail",
      async dispatch(): Promise<GateAnswer> {
        throw new GateCallFailed("transport", null, "connection reset");
      },
    };
    const a = await run({ transport: failing, ledgerPath: ledger, at: new Date("2026-10-01T01:00:00.000Z") });
    expect(a.exitCode).toBe(1);
    expect(a.record.outcome_class).toBe("transport");
    expect(a.record.attempt).toBe(1);
    const b = await run({ transport: fakeTransport(PROCEED), ledgerPath: ledger, at: new Date("2026-10-01T01:00:05.000Z") });
    expect(b.record.attempt).toBe(2);
    expect(b.record.retry_of).toBe(`${RECORDS}/pr-209.G_done.2026-10-01T01-00-00.000Z.json`);
    expect(b.record.outcome_class).toBe("answered");
    expect(countAttempts({ ledger, recordsDir: join(repo.root, "docs/loops"), repoRoot: repo.root }).violations).toEqual([]);
    // A third call for the same subject after an answer is a re-roll.
    await run({ transport: fakeTransport(PROCEED), ledgerPath: ledger, at: new Date("2026-10-01T01:00:10.000Z") });
    expect(countAttempts({ ledger, recordsDir: join(repo.root, "docs/loops"), repoRoot: repo.root }).violations.join("\n")).toContain("re-roll");
  });

  it("D7 an unreachable gate (no key) is recorded as `unavailable`, which is not a call", async () => {
    const ledger = join(side, "nokey.jsonl");
    const noKey = harnessEnv();
    expect(JEV_KEY_VAR in noKey).toBe(false);
    const { JevTransport } = await import("../../src/harness/gate.js");
    const r = await run({ env: noKey, transport: new JevTransport({ env: noKey, fetchImpl: (() => { throw new Error("no network"); }) as unknown as typeof fetch }), ledgerPath: ledger });
    expect(r.exitCode).toBe(1);
    expect(r.record.outcome_class).toBe("unavailable");
    expect(countAttempts({ ledger, repoRoot: repo.root }).total).toBe(0);
  });

  /* S4-3b.1 — the key reaches nothing else ---------------------------------- */

  it("K0 the scan can fail: a planted canary is found exactly once", () => {
    expect(scanKnownPositive(makeCanary())).toBe(1);
  });

  for (const status of [200, 422] as const) {
    it(`K1 a hostile fake that echoes the Authorization header as a ${status} leaves the canary in no output`, async () => {
      const canary = makeCanary();
      const seen: SeenRequest[] = [];
      const realFetch = globalThis.fetch;
      globalThis.fetch = (() => {
        throw new Error("must not reach the network");
      }) as unknown as typeof fetch;
      try {
        const ledger = join(side, `canary-${status}.jsonl`);
        const r = await run({
          transport: undefined,
          fetchImpl: hostileFetch(status, seen),
          env: harnessEnv({ [JEV_KEY_VAR]: canary }),
          ledgerPath: ledger,
          checks: checksFromEvidence(join(repo.root, "docs/loops/x.E_t.json")),
        });
        expect(seen).toHaveLength(1);
        expect(seen[0]!.authorization).toBe(`Bearer ${canary}`);
        const thrown = r.record.note + JSON.stringify(r.record);
        const scan = scanForCanary(canary, { dirs: [repo.root, side], strings: { note: thrown } });
        expect(scan.filesRead, "the scan read no files").toBeGreaterThan(5);
        expect(scan.hits, `the canary reached: ${scan.where.join(", ")}`).toBe(0);
        expect(readFileSync(r.recordPath, "utf-8").length).toBeGreaterThan(100);
        if (status === 422) expect(r.record.outcome_class).toBe("request-invalid");
      } finally {
        globalThis.fetch = realFetch;
      }
    });
  }

  it("K2 the spawned CLI, with a constructed env that holds the canary, prints and writes none of it", () => {
    const canary = makeCanary();
    const r = spawnSync(
      process.execPath,
      [TSX, CLI, "shadow-done", "--pr", "209", "--merge-commit", diff.merge, "--scored-sha", diff.scored, "--dt", DT, "--checks", "none", "--mode", "dry-run", "--repo", repo.root],
      { cwd: repo.root, encoding: "utf-8", shell: false, timeout: 120_000, env: harnessEnv({ [JEV_KEY_VAR]: canary }) },
    );
    if (r.error) throw r.error;
    expect(r.status, `${r.stderr}\n${r.stdout}`).toBe(0);
    expect(r.stdout).toContain("decision: none (shadow: recorded only)");
    const scan = scanForCanary(canary, { dirs: [repo.root], strings: { stdout: r.stdout ?? "", stderr: r.stderr ?? "" } });
    expect(scan.filesRead).toBeGreaterThan(5);
    expect(scan.hits, `the canary reached: ${scan.where.join(", ")}`).toBe(0);
    // base_sha was computed (no --base-sha given): git merge-base scored merge^1.
    const rec = JSON.parse(readFileSync(r.stdout.split("\n")[0]!, "utf-8"));
    expect(rec.base_sha).toBe(diff.base);
    expect(rec.sent).toBe(false);
    expect(rec.attempted_at).toBeNull();
  });

  it("C1 the CLI refuses a bad sha and a missing checks source, and creates no record", () => {
    const base = ["shadow-done", "--pr", "209", "--dt", DT, "--mode", "dry-run", "--repo", repo.root];
    const run1 = spawnSync(process.execPath, [TSX, CLI, ...base, "--merge-commit", "abc", "--scored-sha", diff.scored, "--checks", "none"], { cwd: repo.root, encoding: "utf-8", shell: false, env: harnessEnv() });
    expect(run1.status).toBe(2);
    const run2 = spawnSync(process.execPath, [TSX, CLI, ...base, "--merge-commit", diff.merge, "--scored-sha", diff.scored], { cwd: repo.root, encoding: "utf-8", shell: false, env: harnessEnv() });
    expect(run2.status).toBe(2);
    expect(existsSync(join(repo.root, "docs/loops/loop-15-slice-4-records"))).toBe(false);
  });
});
