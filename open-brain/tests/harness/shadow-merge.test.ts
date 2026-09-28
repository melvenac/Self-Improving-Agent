import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync, execFileSync } from "node:child_process";

/**
 * Candidate C (T-155). Rows are red against the unfixed base, where the verdict
 * function does not exist. Git fixtures are throwaway repos (G-044).
 */
const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_C = "c".repeat(40);

type Verdict = { verdict: string; reasons: string[]; declared?: { unrunnable: string[]; outOfScope: string[] } };

async function load(): Promise<{
  computeShadowMergeVerdict: (input: Record<string, unknown>) => Verdict;
  prepareShadowVerdict: (input: Record<string, unknown>) => { path: string };
  decideShadowVerdict: (input: Record<string, unknown>) => { line: Record<string, unknown> };
  summariseLedger: (text: string) => { disagreements: number; evaluated: number; undefined_count: number; note: string };
  checkShadowMergeLedger: (root: string) => { severity: string; message: string };
}> {
  try {
    const mod = await import("../../src/harness/shadow-merge.js");
    if (typeof mod.computeShadowMergeVerdict !== "function") throw new Error("no verdict function");
    return mod;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("no verdict")) throw err;
    throw new Error(`no verdict function: ${msg}`);
  }
}

function check(passed: boolean) {
  return { command: "npm test", exit_code: passed ? 0 : 1, passed, duration_ms: 1, detail: "" };
}

function evidence(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    loop: "t001",
    candidate_git: { sha: SHA_A, branch: "loop/c", frozen_at: "2026-09-28T00:00:00.000Z" },
    runtime_checks: { build: check(true), unit: check(true) },
    requirements: [],
    acceptance: [
      { id: "A1", status: "met", evidence: "shown", order: "shown" },
      { id: "A2", status: "met", evidence: "attributed", order: "attributed" },
    ],
    regressions: [],
    gaps: [],
    notes: "",
    ...over,
  };
}

const EMPTY_CRITERIA = "```qa-declared\n[unrunnable]\n[out-of-scope]\n```\n";
const A4_OUT = "```qa-declared\n[unrunnable]\n[out-of-scope]\nA4: not this candidate\n```\n";

function baseInput(over: Record<string, unknown> = {}) {
  return {
    evidence: evidence(),
    candidateSha: SHA_A,
    loop: "t001",
    criteriaText: EMPTY_CRITERIA,
    policy: { require_plan_gate: false, require_done_gate: false },
    doneGate: null,
    planGate: null,
    gateMode: "skip",
    ...over,
  };
}

describe("computeShadowMergeVerdict", () => {
  it("CC-3 would-merge when in-scope rows are met, including attributed", async () => {
    const { computeShadowMergeVerdict } = await load();
    const r = computeShadowMergeVerdict(baseInput());
    expect(r.verdict).toBe("would-merge");
    expect(r.reasons.join(" ")).toContain("A2: met (attributed)");
  });

  it("CC-4.1 in-scope unmet is would-not-merge", async () => {
    const { computeShadowMergeVerdict } = await load();
    const ev = evidence({
      acceptance: [
        { id: "A1", status: "met", evidence: "shown", order: "shown" },
        { id: "A2", status: "unmet", evidence: "failed" },
      ],
    });
    expect(computeShadowMergeVerdict(baseInput({ evidence: ev })).verdict).toBe("would-not-merge");
  });

  it("CC-4.2 in-scope not_evaluated is would-not-merge", async () => {
    const { computeShadowMergeVerdict } = await load();
    const ev = evidence({
      acceptance: [
        { id: "A1", status: "met", evidence: "shown", order: "shown" },
        { id: "A9", status: "not_evaluated", evidence: "not looked at" },
      ],
    });
    expect(computeShadowMergeVerdict(baseInput({ evidence: ev })).verdict).toBe("would-not-merge");
  });

  it("CC-4.3 in-scope partial is would-not-merge", async () => {
    const { computeShadowMergeVerdict } = await load();
    const ev = evidence({
      acceptance: [
        { id: "A1", status: "met", evidence: "shown", order: "shown" },
        { id: "A3", status: "partial", evidence: "half", order: "shown" },
      ],
    });
    expect(computeShadowMergeVerdict(baseInput({ evidence: ev })).verdict).toBe("would-not-merge");
  });

  it("CC-4.4 a failed check is would-not-merge", async () => {
    const { computeShadowMergeVerdict } = await load();
    const ev = evidence();
    (ev.runtime_checks as { build: { passed: boolean } }).build.passed = false;
    expect(computeShadowMergeVerdict(baseInput({ evidence: ev })).verdict).toBe("would-not-merge");
  });

  it("CC-4.5 a required gate reject is would-not-merge", async () => {
    const { computeShadowMergeVerdict } = await load();
    const r = computeShadowMergeVerdict(baseInput({
      policy: { require_plan_gate: false, require_done_gate: true },
      doneGate: { verdict: "reject" },
      gateMode: "live",
    }));
    expect(r.verdict).toBe("would-not-merge");
  });

  it("CC-5.1 pending is undefined, never would-not-merge", async () => {
    const { computeShadowMergeVerdict } = await load();
    const ev = evidence({
      acceptance: [
        { id: "A1", status: "met", evidence: "shown", order: "shown" },
        { id: "A8", status: "pending", evidence: "waiting" },
      ],
    });
    expect(computeShadowMergeVerdict(baseInput({ evidence: ev })).verdict).toBe("undefined");
  });

  it("CC-5.2 an invalid E_t is undefined", async () => {
    const { computeShadowMergeVerdict } = await load();
    expect(computeShadowMergeVerdict(baseInput({ evidence: { loop: "nope" } })).verdict).toBe("undefined");
  });

  it("CC-5.3 a sha mismatch is undefined", async () => {
    const { computeShadowMergeVerdict } = await load();
    expect(computeShadowMergeVerdict(baseInput({ candidateSha: SHA_B })).verdict).toBe("undefined");
  });

  it("CC-5.4 an unreadable criteria block is undefined", async () => {
    const { computeShadowMergeVerdict } = await load();
    expect(computeShadowMergeVerdict(baseInput({ criteriaText: { error: "not a commit" } })).verdict).toBe("undefined");
  });

  it("CC-5.5 a required gate that is missing is undefined", async () => {
    const { computeShadowMergeVerdict } = await load();
    const r = computeShadowMergeVerdict(baseInput({
      policy: { require_plan_gate: false, require_done_gate: true },
      doneGate: "missing",
      gateMode: "live",
    }));
    expect(r.verdict).toBe("undefined");
  });

  it("CC-15 out-of-scope not_evaluated does not block would-merge, and the lists stay separate", async () => {
    const { computeShadowMergeVerdict } = await load();
    const ev = evidence({
      acceptance: [
        { id: "A1", status: "met", evidence: "shown", order: "shown" },
        { id: "A2", status: "met", evidence: "attributed", order: "attributed" },
        { id: "A4", status: "not_evaluated", evidence: "out" },
      ],
    });
    const r = computeShadowMergeVerdict(baseInput({ evidence: ev, criteriaText: A4_OUT }));
    expect(r.verdict).toBe("would-merge");
    expect(r.declared?.unrunnable).toEqual([]);
    expect(r.declared?.outOfScope).toEqual(["A4"]);
  });

  it("CC-12 undefined is not agreement", async () => {
    const { summariseLedger } = await load();
    const lines = [
      { shadow_verdict: "would-merge", aaron_action: "merged", disagreed: false },
      { shadow_verdict: "undefined", aaron_action: "merged", disagreed: null },
      { shadow_verdict: "would-not-merge", aaron_action: "declined", disagreed: false },
    ].map((l) => JSON.stringify(l)).join("\n");
    const s = summariseLedger(lines + "\n");
    expect(s.disagreements).toBe(0);
    expect(s.evaluated).toBe(2);
    expect(s.undefined_count).toBe(1);
    expect(s.note.length).toBeGreaterThan(0);
  });
});

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "shadow-c-"));
  git(root, ["init", "-q", "-b", "master"]);
  git(root, ["config", "user.email", "t@example.com"]);
  git(root, ["config", "user.name", "T"]);
  mkdirSync(join(root, "docs", "loops"), { recursive: true });
  writeFileSync(join(root, "docs", "loops", "criteria.md"), A4_OUT);
  git(root, ["add", "docs"]);
  git(root, ["commit", "-q", "-m", "criteria"]);
  const bare = join(root, "origin.git");
  git(root, ["init", "-q", "--bare", "-b", "master", bare]);
  git(root, ["remote", "add", "origin", bare]);
  git(root, ["push", "-q", "origin", "master"]);
  return root;
}

describe("shadow-verdict prepare and decide", () => {
  it("CC-7 a second prepare does not change the file", async () => {
    const { prepareShadowVerdict } = await load();
    const repo = fixtureRepo();
    try {
      const criteriaSha = git(repo, ["rev-parse", "HEAD"]);
      const first = prepareShadowVerdict({
        repo, loop: "15-slice-3", candidateSha: SHA_A, criteriaSha, criteriaPath: "docs/loops/criteria.md",
        evidence: evidence({ loop: "15-slice-3" }), gateMode: "skip",
      });
      const before = readFileSync(first.path, "utf8");
      expect(() => prepareShadowVerdict({
        repo, loop: "15-slice-3", candidateSha: SHA_A, criteriaSha, criteriaPath: "docs/loops/criteria.md",
        evidence: evidence({ loop: "15-slice-3" }), gateMode: "skip",
      })).toThrow(/already exists/);
      expect(readFileSync(first.path, "utf8")).toBe(before);
      expect(first.path.startsWith(join(repo, "docs"))).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("CC-30 decide --merged refuses a sha that is not on origin/master", async () => {
    const { prepareShadowVerdict, decideShadowVerdict } = await load();
    const repo = fixtureRepo();
    try {
      const criteriaSha = git(repo, ["rev-parse", "HEAD"]);
      prepareShadowVerdict({
        repo, loop: "t001", candidateSha: SHA_A, criteriaSha, criteriaPath: "docs/loops/criteria.md",
        evidence: evidence(), gateMode: "skip",
      });
      expect(() => decideShadowVerdict({
        repo, loop: "t001", candidateSha: SHA_A, action: "merged", mergeCommitSha: SHA_C,
      })).toThrow(/origin\/master/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("CC-9 decide --merged appends a ledger line when the sha is on origin/master", async () => {
    const { prepareShadowVerdict, decideShadowVerdict } = await load();
    const repo = fixtureRepo();
    try {
      const criteriaSha = git(repo, ["rev-parse", "HEAD"]);
      const master = git(repo, ["rev-parse", "origin/master"]);
      prepareShadowVerdict({
        repo, loop: "t001", candidateSha: SHA_A, criteriaSha, criteriaPath: "docs/loops/criteria.md",
        evidence: evidence(), gateMode: "skip",
      });
      const line = decideShadowVerdict({
        repo, loop: "t001", candidateSha: SHA_A, action: "merged", mergeCommitSha: master,
      });
      expect(line.line.aaron_action).toBe("merged");
      expect(line.line.disagreed).toBe(false);
      expect(String(line.line.decided_at) > String(line.line.written_at)).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("harness shadow-verdict CLI", () => {
  it("CC-20 help lists shadow-verdict", () => {
    const cli = join(import.meta.dirname, "../../src/harness/cli.ts");
    const tsx = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
    const r = spawnSync(process.execPath, [tsx, cli, "help"], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("shadow-verdict");
    expect(r.stdout).toContain("prepare");
    expect(r.stdout).toContain("decide");
  });

  it("CC-20 summary --bogus and an invalid --gate are refused", () => {
    const cli = join(import.meta.dirname, "../../src/harness/cli.ts");
    const tsx = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
    const bogus = spawnSync(process.execPath, [tsx, cli, "shadow-verdict", "summary", "--bogus"], { encoding: "utf8" });
    expect(bogus.status, bogus.stderr).not.toBe(0);
    expect(`${bogus.stderr}`).toMatch(/unrecognised flag "--bogus"/);
    const gate = spawnSync(process.execPath, [tsx, cli, "shadow-verdict", "prepare", "--gate", "banana"], { encoding: "utf8" });
    expect(gate.status, gate.stderr).not.toBe(0);
    expect(`${gate.stderr}`).toMatch(/--gate/);
  });

  it("CC-10 a bare --replaced is refused and is not recorded as declined", () => {
    const cli = join(import.meta.dirname, "../../src/harness/cli.ts");
    const tsx = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
    const r = spawnSync(process.execPath, [tsx, cli, "shadow-verdict", "decide", "--loop", "t001", "--candidate", SHA_A, "--replaced"], { encoding: "utf8" });
    expect(r.status, r.stderr).not.toBe(0);
    expect(`${r.stderr}`).toMatch(/--replaced/);
    expect(`${r.stdout}${r.stderr}`).not.toMatch(/"aaron_action":"declined"/);
  });
});

describe("CC-0 and CC-19 guards", () => {
  it("CC-0 does not touch the evidence schema, declared parser, or runLoop, and adds no skip", () => {
    const root = join(import.meta.dirname, "../../src/harness");
    const runtime = readFileSync(join(root, "runtime.ts"), "utf8");
    const schema = readFileSync(join(root, "schema.ts"), "utf8");
    const declared = readFileSync(join(root, "declared.ts"), "utf8");
    expect(runtime).not.toContain("prepareShadowVerdict");
    expect(runtime).not.toContain("shadow-verdict");
    expect(schema).not.toContain("would-merge");
    expect(declared).not.toContain("would-merge");
    const tests = readFileSync(join(import.meta.dirname, "shadow-merge.test.ts"), "utf8");
    expect(tests).not.toMatch(/\b(?:it|describe|test)\.skip\b/);
    expect(tests).not.toMatch(/\bskipIf\b/);
  });

  it("CC-19 the merge point is prepare, and the runtime still never merges", () => {
    const root = join(import.meta.dirname, "../../src/harness");
    const runtime = readFileSync(join(root, "runtime.ts"), "utf8");
    const cli = readFileSync(join(root, "cli.ts"), "utf8");
    const procedure = readFileSync(join(import.meta.dirname, "../../../docs/loops/shadow-merge/PROCEDURE.md"), "utf8");
    expect(runtime).not.toContain("prepareShadowVerdict");
    expect(cli).toContain("The runtime never merges, pushes, or touches a remote.");
    expect(procedure).toContain("shadow-verdict prepare");
    expect(procedure).toContain("decide");
    expect(cli).toContain('sub === "shadow-verdict"');
  });
});

describe("record 201 r2", () => {
  it("CC-6 the artifact is read back and carries acceptance and gate summaries", async () => {
    const { prepareShadowVerdict } = await load();
    const repo = fixtureRepo();
    try {
      const criteriaSha = git(repo, ["rev-parse", "HEAD"]);
      const first = prepareShadowVerdict({
        repo, loop: "t001", candidateSha: SHA_A, criteriaSha, criteriaPath: "docs/loops/criteria.md",
        evidence: evidence(), gateMode: "skip", doneGate: { verdict: "proceed" }, planGate: null,
      });
      expect(first.path.split(/[/\\]/).join("/")).toContain(`artifacts/iterations/t001/${SHA_A}/shadow_merge.json`);
      const body = JSON.parse(readFileSync(first.path, "utf8")) as {
        candidate_sha: string;
        criteria_sha: string;
        inputs: {
          runtime_checks: { build: { passed: boolean } };
          acceptance: Array<{ id: string; status: string }>;
          gates: { plan: unknown; done: unknown };
          declared: { unrunnable: string[]; outOfScope: string[] };
        };
      };
      expect(body.candidate_sha).toMatch(/^[0-9a-f]{40}$/);
      expect(body.criteria_sha).toMatch(/^[0-9a-f]{40}$/);
      expect(body.inputs.runtime_checks.build.passed).toBe(true);
      expect(body.inputs.acceptance.map((row) => row.id)).toEqual(["A1", "A2"]);
      expect(body.inputs.gates.done).toEqual({ verdict: "proceed" });
      expect(body.inputs.gates.plan).toBeNull();
      expect(body.inputs.declared.unrunnable).toEqual([]);
      expect(body.inputs.declared.outOfScope).toEqual(["A4"]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("CC-10 replaced requires a 40-hex sha and declined records disagreement", async () => {
    const { prepareShadowVerdict, decideShadowVerdict } = await load();
    const repo = fixtureRepo();
    try {
      const criteriaSha = git(repo, ["rev-parse", "HEAD"]);
      prepareShadowVerdict({
        repo, loop: "t001", candidateSha: SHA_A, criteriaSha, criteriaPath: "docs/loops/criteria.md",
        evidence: evidence(), gateMode: "skip",
      });
      expect(() => decideShadowVerdict({
        repo, loop: "t001", candidateSha: SHA_A, action: "replaced",
      })).toThrow(/40/);
      const declined = decideShadowVerdict({
        repo, loop: "t001", candidateSha: SHA_A, action: "declined",
      });
      expect(declined.line.aaron_action).toBe("declined");
      expect(declined.line.disagreed).toBe(true);
      expect(declined.line.replaced_sha).toBeNull();
      prepareShadowVerdict({
        repo, loop: "t002", candidateSha: SHA_B, criteriaSha, criteriaPath: "docs/loops/criteria.md",
        evidence: evidence({
          loop: "t002",
          candidate_git: { sha: SHA_B, branch: "loop/c", frozen_at: "2026-09-28T00:00:00.000Z" },
        }),
        gateMode: "skip",
      });
      const replaced = decideShadowVerdict({
        repo, loop: "t002", candidateSha: SHA_B, action: "replaced", replacedSha: SHA_C,
      });
      expect(replaced.line.aaron_action).toBe("replaced");
      expect(replaced.line.replaced_sha).toBe(SHA_C);
      expect(replaced.line.disagreed).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("CC-13 an empty line or a missing line_hash is an issue", async () => {
    const { checkShadowMergeLedger } = await load();
    const repo = fixtureRepo();
    try {
      const ledger = join(repo, "docs", "loops", "shadow-merge", "ledger.jsonl");
      mkdirSync(join(repo, "docs", "loops", "shadow-merge"), { recursive: true });
      writeFileSync(ledger, "{}\n");
      expect(checkShadowMergeLedger(repo).severity).toBe("issue");
      expect(checkShadowMergeLedger(repo).message).toMatch(/line_hash/);
      const line = JSON.stringify({
        shadow_verdict: "would-merge", aaron_action: "merged", disagreed: false, line_hash: "abc",
      });
      writeFileSync(ledger, `${line}\n\n`);
      const blank = checkShadowMergeLedger(repo);
      expect(blank.severity).toBe("issue");
      expect(blank.message).toMatch(/empty/);
      writeFileSync(ledger, `${line}\n`);
      git(repo, ["add", "docs/loops/shadow-merge/ledger.jsonl"]);
      git(repo, ["commit", "-q", "-m", "ledger"]);
      const stripped = JSON.stringify({ shadow_verdict: "would-merge", aaron_action: "merged", disagreed: false });
      writeFileSync(ledger, `${stripped}\n`);
      const edited = checkShadowMergeLedger(repo);
      expect(edited.severity).toBe("issue");
      expect(edited.message).toMatch(/line_hash|differs/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("CC-18 unreadable evidence still writes an undefined artifact", () => {
    const cli = join(import.meta.dirname, "../../src/harness/cli.ts");
    const tsx = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
    const repo = fixtureRepo();
    try {
      const criteriaSha = git(repo, ["rev-parse", "HEAD"]);
      const missing = join(repo, "missing-evidence.json");
      const r = spawnSync(process.execPath, [
        tsx, cli, "shadow-verdict", "prepare",
        "--repo", repo, "--loop", "t001", "--candidate", SHA_A,
        "--criteria-sha", criteriaSha, "--criteria", "docs/loops/criteria.md",
        "--evidence", missing,
      ], { encoding: "utf8" });
      expect(r.status, `${r.stderr}\n${r.stdout}`).toBe(0);
      const written = join(repo, "artifacts", "iterations", "t001", SHA_A, "shadow_merge.json");
      const body = JSON.parse(readFileSync(written, "utf8")) as { verdict: string };
      expect(body.verdict).toBe("undefined");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
