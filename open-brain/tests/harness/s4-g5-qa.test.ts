/**
 * Slice four, G5 — the 4.4 QA-score gate as data (S4-6a, S4-6b, S4-6c, S4-6d, S4-3b.1).
 *
 * No live Jev call: every transport is a fake and every environment is constructed.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { runShadowQaGate } from "../../src/harness/shadow-qa.js";
import { SHADOW_RUNTIME_ACTION } from "../../src/harness/shadow-gates.js";
import { validateGateRecord } from "../../src/harness/gate-records.js";
import {
  QaScorePolicySchema,
  PolicyUnreadable,
  decideQaScore,
  loadQaScorePolicy,
  policyJsonSchemas,
} from "../../src/harness/policies.js";
import { serialiseSchema } from "../../src/harness/schema.js";
import { buildJevRequest, JEV_KEY_VAR, type GateAnswer, type GatePayload, type GateTransport } from "../../src/harness/gate.js";
import { makeRepo, rawGit, requireGit, type RepoFixture } from "./fixture.js";
import { harnessEnv, hostileFetch, makeCanary, scanForCanary, scanKnownPositive, type SeenRequest } from "./s4-canary.js";
import { scanThresholds, thresholdLiterals, thresholdScanRegions } from "./threshold-scan.js";

const TSX = resolve(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const CLI = resolve(__dirname, "../../src/harness/cli.ts");
const POLICY_DIR = resolve(__dirname, "../../src/harness/policies");
const SCHEMA_DIR = resolve(__dirname, "../../src/harness/schemas");
const SRC = resolve(__dirname, "../../src/harness");
const ET_PATH = "docs/loops/x.E_t.json";

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

const check = { command: "npm run build", exit_code: 0, passed: true, duration_ms: 1, detail: "" };
const evidence = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  loop: "15-t195",
  candidate_git: { sha: "a".repeat(40), branch: "loop/x", frozen_at: "2026-10-01T00:00:00Z" },
  runtime_checks: { build: check, unit: check },
  requirements: [
    { id: "R1", status: "met", evidence: "ran it and saw it", severity: "minor" },
    { id: "R2", status: "not_evaluated", evidence: "not looked at", severity: "minor" },
    { id: "R3", status: "met", evidence: "   ", severity: "minor" },
  ],
  acceptance: [
    { id: "A1", status: "met", evidence: "ran the command", order: "shown" },
    { id: "A2", status: "pending", evidence: "unfinished" },
  ],
  regressions: [],
  gaps: [],
  notes: "",
  ...over,
});
const FULL = (): Record<string, unknown> =>
  evidence({
    requirements: [{ id: "R1", status: "met", evidence: "ran it and saw it", severity: "minor" }],
    acceptance: [{ id: "A1", status: "met", evidence: "ran the command", order: "shown" }],
  });

const PASS_ALL: Record<string, unknown> = {
  "res:requirements:R1": { choice: "pass" },
  "sev:requirements:R1": { score: 0, confidence: 0.9 },
  "res:acceptance:A1": { choice: "pass" },
  "sev:acceptance:A1": { score: 0, confidence: 0.9 },
  regression_of_validated: { noul: 0.1 },
  artifact_complete_enough_to_stop: { noul: 0.9 },
};
const FAIL_R1: Record<string, unknown> = {
  ...PASS_ALL,
  "res:requirements:R1": { choice: "fail" },
  "sev:requirements:R1": { score: 2, confidence: 0.9 },
};

function fakeTransport(answers: Record<string, unknown> | null, seen: GatePayload[] = []): GateTransport {
  return {
    name: "fake",
    async dispatch(p: GatePayload): Promise<GateAnswer> {
      seen.push(p);
      return { gate: p.gate, answers, consulted: answers !== null, note: "fake", resolvedModel: "jev-1.13.0", usage: null };
    },
  };
}

describe("S4-6a — qa-score.json, its schema, and the threshold-scan guard", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "s4g5-pol-"));
  });
  const good = (): Record<string, unknown> => JSON.parse(readFileSync(join(POLICY_DIR, "qa-score.json"), "utf-8"));

  it("Q1 qa-score.json exists, loads, and its derived schema file matches what zod derives", () => {
    expect(loadQaScorePolicy().gate).toBe("qa-score");
    expect(readFileSync(join(SCHEMA_DIR, "policy-qa-score.schema.json"), "utf-8")).toBe(serialiseSchema(policyJsonSchemas().qa));
  });

  it("Q2 the derived schema says the values are a starting position chosen without data", () => {
    const text = readFileSync(join(SCHEMA_DIR, "policy-qa-score.schema.json"), "utf-8");
    expect(text).toContain("starting position chosen without data");
    expect(text).toContain("PROVISIONAL");
    expect(text).toContain("LIMIT");
  });

  it("Q3 the loader refuses a missing file, non-JSON, an unknown key, and an out-of-range probability", () => {
    expect(() => loadQaScorePolicy(dir)).toThrow(/policy file missing/);
    writeFileSync(join(dir, "qa-score.json"), "{ not json");
    expect(() => loadQaScorePolicy(dir)).toThrow(/not valid JSON/);
    writeFileSync(join(dir, "qa-score.json"), JSON.stringify({ ...good(), surprise: 1 }));
    expect(() => loadQaScorePolicy(dir)).toThrow(PolicyUnreadable);
    writeFileSync(join(dir, "qa-score.json"), JSON.stringify({ ...good(), regression_of_validated_max: 1.5 }));
    expect(() => loadQaScorePolicy(dir)).toThrow(/does not match the policy schema/);
    expect(QaScorePolicySchema.safeParse(good()).success).toBe(true);
  });

  it("Q4 the existing three policy files are byte-identical to the base's", () => {
    // S4-5c.1: `git diff --exit-code <base> <candidate> -- <the three files>` exits 0. The base is
    // origin/master 2448a6ea, named by sha so the comparison cannot drift with a branch.
    const paths = ["developer-done.json", "plan-gate.json", "merge.json"].map((f) => `open-brain/src/harness/policies/${f}`);
    for (const p of paths) expect(existsSync(resolve(__dirname, "../../..", p))).toBe(true);
    const r = spawnSync("git", ["diff", "--exit-code", "--quiet", "2448a6ea", "HEAD", "--", ...paths], {
      cwd: resolve(__dirname, "../../.."),
      encoding: "utf-8",
      shell: false,
    });
    expect(r.error).toBeUndefined();
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
    // And the working tree matches HEAD for them, so an uncommitted edit is caught too.
    const wt = spawnSync("git", ["diff", "--exit-code", "--quiet", "HEAD", "--", ...paths], { cwd: resolve(__dirname, "../../.."), shell: false });
    expect(wt.status).toBe(0);
  });

  it("Q5 the threshold scan covers the QA prompts and the decision code, and finds nothing", () => {
    const text = thresholdScanRegions().map((r) => r.text).join("\n");
    expect(text).toContain("buildQaScoreQuestions");
    expect(text).toContain("decideQaScore");
    expect(scanThresholds()).toEqual([]);
  });

  it("Q6 a literal planted in a QA prompt, or in the QA decision code, is reported by the scan", () => {
    const gate = readFileSync(join(SRC, "gate.ts"), "utf-8");
    const plantedPrompt = gate.replace('"Is the artifact complete enough,', '"Answer at least 0.6 if so. Is the artifact complete enough,');
    expect(plantedPrompt).not.toBe(gate);
    expect(thresholdLiterals(plantedPrompt)).toContain("0.6");
    const pol = readFileSync(join(SRC, "policies.ts"), "utf-8");
    const plantedDecision = pol.replace("if (input.regressionOfValidated === null)", "if (input.regressionOfValidated > 0.6 || input.regressionOfValidated === null)");
    expect(plantedDecision).not.toBe(pol);
    expect(thresholdLiterals(plantedDecision.slice(plantedDecision.lastIndexOf("Applying a policy")))).toContain("0.6");
  });

  it("Q7 the A6 property: the same answers give a different decision under a stricter qa-score.json, with no source change", () => {
    const input = {
      results: [{ id: "R1", result: "pass" as const, severity: null }],
      regressionOfValidated: 0.2,
      artifactCompleteEnoughToStop: 0.9,
      missing: [],
    };
    const shipped = loadQaScorePolicy();
    expect(decideQaScore(input, shipped).verdict).toBe("proceed");
    writeFileSync(join(dir, "qa-score.json"), JSON.stringify({ ...good(), regression_of_validated_max: 0.05 }));
    const stricter = loadQaScorePolicy(dir);
    expect(decideQaScore(input, stricter).verdict).toBe("reject");
    expect(decideQaScore(input, stricter).applied.regression_of_validated_max).toBe(0.05);
  });
});

describe("S4-6b/6c/6d — the runner", () => {
  let repo: RepoFixture;
  let commit: string;
  let side: string;
  const RECORDS = "docs/loops/loop-15-slice-4-records";

  beforeAll(() => requireGit());
  const setup = (et: Record<string, unknown>): void => {
    repo.write("docs/loops/qa-report.md", "VERDICT: ACCEPT\n");
    repo.write("docs/loops/shadow-merge/ledger.jsonl", '{"row":1}\n');
    repo.write("docs/loops/shadow-merge/c/shadow_merge.json", '{"verdict":"x"}\n');
    repo.commitAll("base");
    rawGit(repo.root, ["checkout", "-q", "-b", "qa/x-report"]);
    repo.write(ET_PATH, `${JSON.stringify(et, null, 2)}\n`);
    commit = repo.commitAll("qa report");
    rawGit(repo.root, ["checkout", "-q", "main"]);
  };
  beforeEach(() => {
    repo = makeRepo("s4g5-");
    side = mkdtempSync(join(tmpdir(), "s4g5-side-"));
  });
  afterEach(async () => {
    process.exitCode = undefined;
    await repo.cleanup();
  });

  const run = (over: Record<string, unknown> = {}) =>
    runShadowQaGate({
      repoRoot: repo.root,
      evidence: { branch: "qa/x-report", commit, path: ET_PATH },
      stem: "pr-209",
      mode: "live",
      env: harnessEnv({ [JEV_KEY_VAR]: makeCanary() }),
      transport: fakeTransport(PASS_ALL),
      ledgerPath: join(side, "attempts.jsonl"),
      at: new Date("2026-10-01T00:00:00.000Z"),
      ...over,
    });

  it("R1 question kinds are asserted on the PAYLOAD: a three-option choice and a >=2-level score per asked row, two noul", async () => {
    setup(evidence());
    const seen: GatePayload[] = [];
    await run({ transport: fakeTransport(PASS_ALL, seen) });
    expect(seen).toHaveLength(1); // one batched request
    const wire = buildJevRequest(seen[0]!).questions as Record<string, { type: string; criteria?: unknown }>;
    expect(Object.keys(wire).sort()).toEqual(
      ["artifact_complete_enough_to_stop", "regression_of_validated", "res:acceptance:A1", "res:requirements:R1", "sev:acceptance:A1", "sev:requirements:R1"].sort(),
    );
    expect(wire["res:requirements:R1"]!.type).toBe("choice");
    expect(Object.keys(wire["res:requirements:R1"]!.criteria as object).sort()).toEqual(["fail", "pass", "untested"]);
    expect(wire["sev:requirements:R1"]!.type).toBe("score");
    expect(Array.isArray(wire["sev:requirements:R1"]!.criteria)).toBe(true);
    expect((wire["sev:requirements:R1"]!.criteria as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect(wire.regression_of_validated!.type).toBe("noul");
    expect(wire.artifact_complete_enough_to_stop!.type).toBe("noul");
  });

  it("R2 missing evidence is untested by code, whatever Jev answers for a row that was not asked", async () => {
    setup(evidence());
    const hostileAnswers = {
      ...PASS_ALL,
      "res:requirements:R2": { choice: "pass" }, // not_evaluated
      "res:requirements:R3": { choice: "pass" }, // whitespace-only evidence
      "res:acceptance:A2": { choice: "pass" }, // pending
    };
    const r = await run({ transport: fakeTransport(hostileAnswers) });
    const by = Object.fromEntries(r.record.results.map((x) => [x.id, x]));
    expect(by.R1).toMatchObject({ result: "pass", decided_by: "jev" });
    expect(by.A1).toMatchObject({ result: "pass", decided_by: "jev" });
    for (const id of ["R2", "R3", "A2"]) expect(by[id], id).toMatchObject({ result: "untested", decided_by: "code", severity: null });
    expect(r.record.missing).toEqual([]);
    expect(validateGateRecord(JSON.parse(readFileSync(r.recordPath, "utf-8"))).ok).toBe(true);
  });

  it("R3 a requirement Jev did not answer is untested and named under missing; a fail with no severity is named, never defaulted", async () => {
    setup(FULL());
    const noR1 = { ...PASS_ALL };
    delete noR1["res:requirements:R1"];
    const a = await run({ transport: fakeTransport(noR1) });
    expect(a.record.results.find((x) => x.id === "R1")).toMatchObject({ result: "untested", decided_by: "code" });
    expect(a.record.missing).toContain("res:requirements:R1");
    expect(a.decision?.verdict).toBe("reject");

    const failNoSeverity = { ...PASS_ALL, "res:requirements:R1": { choice: "fail" } };
    delete failNoSeverity["sev:requirements:R1"];
    const b = await run({ transport: fakeTransport(failNoSeverity), at: new Date("2026-10-01T00:01:00.000Z"), ledgerPath: join(side, "b.jsonl") });
    expect(b.record.results.find((x) => x.id === "R1")).toMatchObject({ result: "fail", severity: null });
    expect(b.record.missing).toContain("sev:requirements:R1");
  });

  it("R4 an evidence-less row gets no question at all; with no askable row only the two noul questions go", async () => {
    setup(evidence({ requirements: [{ id: "R2", status: "not_evaluated", evidence: "n", severity: "minor" }], acceptance: [{ id: "A2", status: "pending", evidence: "u" }] }));
    const seen: GatePayload[] = [];
    await run({ transport: fakeTransport({ regression_of_validated: { noul: 0.1 }, artifact_complete_enough_to_stop: { noul: 0.9 } }, seen) });
    expect(seen[0]!.questions.map((q) => q.id)).toEqual(["regression_of_validated", "artifact_complete_enough_to_stop"]);
  });

  it("R5 the record sits beside a COPY of the E_t that is byte-identical, with e_t_ref naming the original", async () => {
    setup(FULL());
    const r = await run();
    const original = rawGit(repo.root, ["rev-parse", `${commit}:${ET_PATH}`]);
    expect(r.record.e_t_ref).toEqual({ branch: "qa/x-report", commit, path: ET_PATH, blob: original });
    expect(r.copyPath).toBe(join(repo.root, RECORDS, "pr-209.E_t.json"));
    expect(rawGit(repo.root, ["hash-object", r.copyPath])).toBe(original);
    expect(r.recordPath.startsWith(join(repo.root, RECORDS, "pr-209.G_qa."))).toBe(true);
    expect(r.record.source).toBe("seat");
    expect(r.record.plan_provenance).toBe("reconstructed-after");
  });

  it("R6 a second write to the same record path is refused (exclusive create)", async () => {
    setup(FULL());
    const a = await run();
    await expect(
      import("../../src/harness/gate-records.js").then((m) => m.writeSliceRecord(a.recordPath, a.record)),
    ).rejects.toThrow(/already exists/);
  });

  it("R7 the flip test: proceed and reject give exit code 0 both times, only new files appear, no tracked file moves, the E_t blob is unchanged", async () => {
    setup(FULL());
    const hashes = (): Record<string, string> => {
      const out: Record<string, string> = {};
      for (const f of rawGit(repo.root, ["ls-files"]).split("\n")) out[f] = sha(readFileSync(join(repo.root, f), "utf-8"));
      return out;
    };
    const porcelain = (): string[] => rawGit(repo.root, ["status", "--porcelain", "--untracked-files=all"]).split("\n").filter((l) => l !== "");
    const policyBefore = readdirSync(POLICY_DIR).map((f) => `${f}:${sha(readFileSync(join(POLICY_DIR, f), "utf-8"))}`);
    const before = hashes();
    const etBlobBefore = rawGit(repo.root, ["rev-parse", `${commit}:${ET_PATH}`]);
    process.exitCode = undefined;

    const first = await run({ transport: fakeTransport(PASS_ALL) });
    const afterFirst = porcelain();
    const exitFirst = process.exitCode;
    const second = await run({ transport: fakeTransport(FAIL_R1), at: new Date("2026-10-01T00:05:00.000Z"), ledgerPath: join(side, "s.jsonl") });
    const afterSecond = porcelain();

    expect(first.decision?.verdict).toBe("proceed");
    expect(second.decision?.verdict).toBe("reject");
    expect([first.exitCode, second.exitCode]).toEqual([0, 0]);
    expect(exitFirst ?? 0).toBe(0);
    expect(process.exitCode ?? 0).toBe(0);
    expect(first.record.runtime_action).toBe(SHADOW_RUNTIME_ACTION);
    expect(second.record.runtime_action).toBe(SHADOW_RUNTIME_ACTION);
    // Only new files: the copy and the records. Nothing tracked is modified.
    expect(afterFirst).toHaveLength(2);
    expect(afterSecond).toHaveLength(3);
    expect([...afterFirst, ...afterSecond].every((l) => l.startsWith("?? "))).toBe(true);
    expect(hashes()).toEqual(before);
    expect(rawGit(repo.root, ["rev-parse", `${commit}:${ET_PATH}`])).toBe(etBlobBefore);
    expect(readdirSync(POLICY_DIR).map((f) => `${f}:${sha(readFileSync(join(POLICY_DIR, f), "utf-8"))}`)).toEqual(policyBefore);
    // The immutable inputs named by S4-6d.1 were in the comparison.
    for (const f of ["docs/loops/qa-report.md", "docs/loops/shadow-merge/ledger.jsonl", "docs/loops/shadow-merge/c/shadow_merge.json"]) {
      expect(before[f], f).toBeDefined();
    }
  });

  it("R8 a 422 from the one batched request stops the item: one request, a request-invalid record, no second call", async () => {
    setup(FULL());
    const seen: SeenRequest[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("must not reach the network");
    }) as unknown as typeof fetch;
    try {
      const r = await run({ transport: undefined, fetchImpl: hostileFetch(422, seen) });
      expect(seen).toHaveLength(1);
      expect(r.record.outcome_class).toBe("request-invalid");
      expect(r.exitCode).toBe(1);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  /* S4-3b.1 ------------------------------------------------------------------- */

  it("K0 the scan can fail: a planted canary is found exactly once", () => {
    expect(scanKnownPositive(makeCanary())).toBe(1);
  });

  for (const status of [200, 422] as const) {
    it(`K1 a hostile fake that echoes the Authorization header as a ${status} leaves the canary in no output`, async () => {
      setup(FULL());
      const canary = makeCanary();
      const seen: SeenRequest[] = [];
      const realFetch = globalThis.fetch;
      globalThis.fetch = (() => {
        throw new Error("must not reach the network");
      }) as unknown as typeof fetch;
      try {
        const r = await run({ transport: undefined, fetchImpl: hostileFetch(status, seen), env: harnessEnv({ [JEV_KEY_VAR]: canary }) });
        expect(seen).toHaveLength(1);
        expect(seen[0]!.authorization).toBe(`Bearer ${canary}`);
        const scan = scanForCanary(canary, { dirs: [repo.root, side], strings: { note: r.record.note + JSON.stringify(r.record) } });
        expect(scan.filesRead).toBeGreaterThan(5);
        expect(scan.hits, `the canary reached: ${scan.where.join(", ")}`).toBe(0);
      } finally {
        globalThis.fetch = realFetch;
      }
    });
  }

  it("K2 the spawned CLI, with a constructed env that holds the canary, prints and writes none of it", () => {
    setup(FULL());
    const canary = makeCanary();
    const r = spawnSync(
      process.execPath,
      [TSX, CLI, "shadow-qa", "--pr", "209", "--branch", "qa/x-report", "--commit", commit, "--path", ET_PATH, "--mode", "dry-run", "--repo", repo.root],
      { cwd: repo.root, encoding: "utf-8", shell: false, timeout: 120_000, env: harnessEnv({ [JEV_KEY_VAR]: canary }) },
    );
    if (r.error) throw r.error;
    expect(r.status, `${r.stderr}\n${r.stdout}`).toBe(0);
    expect(r.stdout).toContain("decision: none (shadow: recorded only)");
    const scan = scanForCanary(canary, { dirs: [repo.root], strings: { stdout: r.stdout ?? "", stderr: r.stderr ?? "" } });
    expect(scan.filesRead).toBeGreaterThan(5);
    expect(scan.hits, `the canary reached: ${scan.where.join(", ")}`).toBe(0);
  });
});
