import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
    // src's functions take narrower inputs than the loose Record<string, unknown> this test feeds them
    // (it builds evidence by hand); the declared type is the test's, not src's.
    return mod as unknown as Awaited<ReturnType<typeof load>>;
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
    policy: { required_inputs: ["runtime_checks", "E_t.acceptance"], require_plan_gate: false, require_done_gate: false },
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
      policy: { required_inputs: ["runtime_checks", "E_t.acceptance"], require_plan_gate: false, require_done_gate: true },
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
      policy: { required_inputs: ["runtime_checks", "E_t.acceptance"], require_plan_gate: false, require_done_gate: true },
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

const NOT_A_SHA = ["bad", "a".repeat(39), "a".repeat(41), "A".repeat(40)];

function artifact(repo: string, id: string): string {
  return join(repo, "artifacts", "iterations", "t001", id, "shadow_merge.json");
}

function ledgerOf(repo: string): string {
  return join(repo, "docs", "loops", "shadow-merge", "ledger.jsonl");
}

function seedVerdict(repo: string, id: string): void {
  const path = artifact(repo, id);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ verdict: "would-not-merge", written_at: "2026-09-28T00:00:00.000Z" })}\n`);
}

function harness(args: string[]) {
  const cli = join(import.meta.dirname, "../../src/harness/cli.ts");
  const tsx = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
  return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8" });
}

function refusal(label: string, fn: () => void, written?: string): string[] {
  const problems: string[] = [];
  if (written) rmSync(written, { force: true });
  try {
    fn();
    problems.push(`${label}: did not throw`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/40 lowercase hex/.test(msg)) problems.push(`${label}: threw ${msg}`);
  }
  if (written && existsSync(written)) problems.push(`${label}: wrote ${written}`);
  return problems;
}

describe("record 201 r3", () => {
  it("CC-6 prepare refuses a candidate or criteria sha that is not 40 lowercase hex and writes nothing", async () => {
    const { prepareShadowVerdict } = await load();
    const repo = fixtureRepo();
    try {
      const criteriaSha = git(repo, ["rev-parse", "HEAD"]);
      const problems: string[] = [];
      for (const bad of NOT_A_SHA) {
        problems.push(...refusal(`candidate ${bad}`, () => prepareShadowVerdict({
          repo, loop: "t001", candidateSha: bad, criteriaSha, criteriaPath: "docs/loops/criteria.md",
          evidence: evidence(), gateMode: "skip",
        }), artifact(repo, bad)));
        problems.push(...refusal(`criteria ${bad}`, () => prepareShadowVerdict({
          repo, loop: "t001", candidateSha: SHA_A, criteriaSha: bad, criteriaPath: "docs/loops/criteria.md",
          evidence: evidence(), gateMode: "skip",
        }), artifact(repo, SHA_A)));
        rmSync(join(repo, "artifacts", "iterations", "t001", SHA_A), { recursive: true, force: true });
      }
      const ok = prepareShadowVerdict({
        repo, loop: "t001", candidateSha: SHA_A, criteriaSha, criteriaPath: "docs/loops/criteria.md",
        evidence: evidence(), gateMode: "skip",
      });
      expect(existsSync(ok.path)).toBe(true);
      expect(JSON.parse(readFileSync(ok.path, "utf8")).candidate_sha).toBe(SHA_A);
      expect(problems).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("CC-6 the CLI refuses the same sha shapes before prepare or decide writes", async () => {
    const repo = fixtureRepo();
    try {
      const criteriaSha = git(repo, ["rev-parse", "HEAD"]);
      const evidencePath = join(repo, "evidence.json");
      writeFileSync(evidencePath, JSON.stringify(evidence()));
      const base = ["--repo", repo, "--loop", "t001", "--criteria", "docs/loops/criteria.md", "--evidence", evidencePath];
      const problems: string[] = [];
      const cliRefusal = (label: string, args: string[], written?: string): void => {
        if (written) rmSync(written, { force: true });
        const ledgerBefore = existsSync(ledgerOf(repo)) ? readFileSync(ledgerOf(repo), "utf8") : "";
        const result = harness(args);
        if (result.status === 0) problems.push(`${label}: exit 0`);
        if (!/40 lowercase hex/.test(`${result.stderr}`)) problems.push(`${label}: stderr ${result.stderr.trim()}`);
        if (written && existsSync(written)) problems.push(`${label}: wrote ${written}`);
        const ledgerAfter = existsSync(ledgerOf(repo)) ? readFileSync(ledgerOf(repo), "utf8") : "";
        if (ledgerAfter !== ledgerBefore) problems.push(`${label}: ledger changed`);
      };
      for (const bad of NOT_A_SHA) {
        cliRefusal(`prepare --candidate ${bad}`, ["shadow-verdict", "prepare", ...base, "--candidate", bad, "--criteria-sha", criteriaSha], artifact(repo, bad));
        cliRefusal(`prepare --criteria-sha ${bad}`, ["shadow-verdict", "prepare", ...base, "--candidate", SHA_A, "--criteria-sha", bad], artifact(repo, SHA_A));
        rmSync(join(repo, "artifacts", "iterations", "t001", SHA_A), { recursive: true, force: true });
      }
      const ok = harness(["shadow-verdict", "prepare", ...base, "--candidate", SHA_A, "--criteria-sha", criteriaSha]);
      expect(ok.status, ok.stderr).toBe(0);
      expect(existsSync(artifact(repo, SHA_A))).toBe(true);
      for (const bad of NOT_A_SHA) {
        seedVerdict(repo, bad);
        cliRefusal(`decide --candidate ${bad}`, ["shadow-verdict", "decide", "--repo", repo, "--loop", "t001", "--candidate", bad, "--declined"]);
        cliRefusal(`decide --merged ${bad}`, ["shadow-verdict", "decide", "--repo", repo, "--loop", "t001", "--candidate", SHA_A, "--merged", bad]);
        cliRefusal(`decide --replaced ${bad}`, ["shadow-verdict", "decide", "--repo", repo, "--loop", "t001", "--candidate", SHA_A, "--replaced", bad]);
      }
      const beforeSummary = existsSync(ledgerOf(repo)) ? readFileSync(ledgerOf(repo), "utf8") : "";
      const summary = harness(["shadow-verdict", "summary", "--repo", repo]);
      expect(summary.status, summary.stderr).toBe(0);
      const afterSummary = existsSync(ledgerOf(repo)) ? readFileSync(ledgerOf(repo), "utf8") : "";
      expect(afterSummary).toBe(beforeSummary);
      expect(problems).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  }, 60_000);

  it("CC-6 decide refuses a non-sha candidate, merge, or replacement before the ledger", async () => {
    const { prepareShadowVerdict, decideShadowVerdict } = await load();
    const repo = fixtureRepo();
    try {
      const criteriaSha = git(repo, ["rev-parse", "HEAD"]);
      prepareShadowVerdict({
        repo, loop: "t001", candidateSha: SHA_A, criteriaSha, criteriaPath: "docs/loops/criteria.md",
        evidence: evidence(), gateMode: "skip",
      });
      const problems: string[] = [];
      for (const bad of NOT_A_SHA) {
        seedVerdict(repo, bad);
        const before = existsSync(ledgerOf(repo)) ? readFileSync(ledgerOf(repo), "utf8") : "";
        problems.push(...refusal(`candidate ${bad}`, () => decideShadowVerdict({
          repo, loop: "t001", candidateSha: bad, action: "declined",
        })));
        problems.push(...refusal(`merged ${bad}`, () => decideShadowVerdict({
          repo, loop: "t001", candidateSha: SHA_A, action: "merged", mergeCommitSha: bad,
        })));
        problems.push(...refusal(`replaced ${bad}`, () => decideShadowVerdict({
          repo, loop: "t001", candidateSha: SHA_A, action: "replaced", replacedSha: bad,
        })));
        const after = existsSync(ledgerOf(repo)) ? readFileSync(ledgerOf(repo), "utf8") : "";
        if (after !== before) problems.push(`${bad}: ledger changed`);
      }
      const ok = decideShadowVerdict({
        repo, loop: "t001", candidateSha: SHA_A, action: "declined",
      });
      expect(ok.line.candidate_sha).toBe(SHA_A);
      expect(existsSync(ledgerOf(repo))).toBe(true);
      expect(problems).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

/**
 * Record 217, candidate C r4. CC-2.2, CC-5.6, CC-13.1 and CC-17 were correct in
 * the product at 5f7c9a0 and lacked an assertion: their red is the named mutant,
 * not the base. CC-1.2 and CC-13.2 change the product and are red at the base.
 */
const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/shadow-merge/", import.meta.url));

interface ShadowFixture {
  fixture: string;
  policy: Record<string, unknown>;
  criteriaText: string;
  gateMode: string;
  doneGate: unknown;
  planGate: unknown;
  evidence: Record<string, unknown>;
  expected: { verdict: string; reason_includes: string };
}

function readFixture(name: string): ShadowFixture {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), "utf8")) as ShadowFixture;
}

function fixtureInput(f: ShadowFixture): Record<string, unknown> {
  return {
    evidence: f.evidence,
    candidateSha: SHA_A,
    loop: "t001",
    criteriaText: f.criteriaText,
    policy: f.policy,
    doneGate: f.doneGate,
    planGate: f.planGate,
    gateMode: f.gateMode,
  };
}

describe("record 217 r4", () => {
  it("CC-2.2 the three outcome fixtures exist in fixtures/shadow-merge/", () => {
    const files = readdirSync(FIXTURE_DIR).filter((n) => n.endsWith(".json")).sort();
    for (const required of ["undefined.json", "would-merge.json", "would-not-merge.json"]) {
      expect(files, `fixtures/shadow-merge/${required} is missing`).toContain(required);
    }
  });

  it.each(["would-merge", "would-not-merge", "undefined"])(
    "CC-2.2 fixtures/shadow-merge/%s.json returns its named outcome with a reason",
    async (name) => {
      const { computeShadowMergeVerdict } = await load();
      const f = readFixture(name);
      expect(f.expected.verdict).toBe(name);
      const r = computeShadowMergeVerdict(fixtureInput(f));
      expect(r.verdict).toBe(f.expected.verdict);
      expect(r.reasons.join(" ")).toContain(f.expected.reason_includes);
      if (name !== "would-merge") expect(r.reasons.length).toBeGreaterThan(0);
    },
  );

  it("CC-5.6 fixtures/shadow-merge/skipped-required-live-gate.json: a required gate skipped is undefined, and says skip", async () => {
    const { computeShadowMergeVerdict } = await load();
    const f = readFixture("skipped-required-live-gate");
    expect(f.policy.require_done_gate).toBe(true);
    expect(f.gateMode).toBe("skip");
    expect(f.doneGate).toBeNull();
    const skipped = computeShadowMergeVerdict(fixtureInput(f));
    expect(skipped.verdict).toBe("undefined");
    expect(skipped.reasons.join(" ")).toContain(f.expected.reason_includes);
    const live = computeShadowMergeVerdict({ ...fixtureInput(f), gateMode: "live" });
    expect(live.verdict).toBe("undefined");
    expect(live.reasons.join(" ")).toContain("required and missing");
    expect(live.reasons.join(" ")).not.toContain("skip");
  });

  it("CC-17 fixtures/shadow-merge/all-attributed.json: every in-scope row attributed and green is would-merge, all named", async () => {
    const { computeShadowMergeVerdict } = await load();
    const f = readFixture("all-attributed");
    const rows = f.evidence.acceptance as Array<{ id: string; order: string }>;
    expect(rows.length).toBe(3);
    expect(rows.every((row) => row.order === "attributed")).toBe(true);
    const r = computeShadowMergeVerdict(fixtureInput(f));
    expect(r.verdict).toBe("would-merge");
    expect(r.reasons.filter((reason) => reason.includes("(attributed)")).length).toBe(3);
    const fewer = computeShadowMergeVerdict(fixtureInput({ ...f, evidence: { ...f.evidence, acceptance: rows.slice(0, 2) } }));
    expect(fewer.verdict).toBe("would-merge");
  });

  it("CC-13.1 a present, non-empty, INCORRECT line_hash is the only problem reported", async () => {
    const { prepareShadowVerdict, decideShadowVerdict, checkShadowMergeLedger } = await load();
    const repo = fixtureRepo();
    try {
      const criteriaSha = git(repo, ["rev-parse", "HEAD"]);
      prepareShadowVerdict({
        repo, loop: "t001", candidateSha: SHA_A, criteriaSha, criteriaPath: "docs/loops/criteria.md",
        evidence: evidence(), gateMode: "skip",
      });
      const { line } = decideShadowVerdict({
        repo, loop: "t001", candidateSha: SHA_A, action: "declined",
      });
      const ledger = join(repo, "docs", "loops", "shadow-merge", "ledger.jsonl");
      expect(checkShadowMergeLedger(repo).severity).toBe("pass");
      const wrong = "0".repeat(64);
      expect(wrong).not.toBe(line.line_hash);
      writeFileSync(ledger, `${JSON.stringify({ ...line, line_hash: wrong })}\n`);
      const r = checkShadowMergeLedger(repo);
      expect(r.severity).toBe("issue");
      expect(r.message).toContain("line 1: line_hash does not match the line");
      expect(r.message).not.toMatch(/empty line|missing line_hash|differs from the committed|no shadow_merge\.json/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("CC-1.2 merge.json names runtime_checks and E_t.acceptance, the loader refuses a copy that drops one, and the derived schema carries the field", async () => {
    const policies = await import("../../src/harness/policies.js");
    const real = policies.loadMergePolicy();
    expect(real.required_inputs).toContain("runtime_checks");
    expect(real.required_inputs).toContain("E_t.acceptance");
    const schema = policies.policyJsonSchemas().merge as { properties: Record<string, unknown> };
    expect(schema.properties.required_inputs).toBeDefined();
    const dir = mkdtempSync(join(tmpdir(), "shadow-policy-"));
    try {
      const shipped = JSON.parse(readFileSync(join(policies.policiesDir(), "merge.json"), "utf8")) as Record<string, unknown>;
      for (const dropped of ["runtime_checks", "E_t.acceptance"]) {
        const kept = (shipped.required_inputs as string[]).filter((n) => n !== dropped);
        writeFileSync(join(dir, "merge.json"), JSON.stringify({ ...shipped, required_inputs: kept }));
        expect(() => policies.loadMergePolicy(dir), `dropping ${dropped}`).toThrow(/required_inputs/);
      }
      writeFileSync(join(dir, "merge.json"), JSON.stringify({ ...shipped, required_inputs: [...(shipped.required_inputs as string[]), "E_t.requirements"] }));
      expect(policies.loadMergePolicy(dir).required_inputs).toContain("E_t.requirements");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("CC-1.2 the verdict reads required_inputs from the policy: an extra required input that E_t lacks forces undefined", async () => {
    const { computeShadowMergeVerdict } = await load();
    const extra = { required_inputs: ["runtime_checks", "E_t.acceptance", "E_t.requirements"], require_plan_gate: false, require_done_gate: false };
    const lacking = computeShadowMergeVerdict(baseInput({ policy: extra }));
    expect(lacking.verdict).toBe("undefined");
    expect(lacking.reasons.join(" ")).toContain("E_t.requirements");
    const supplied = computeShadowMergeVerdict(baseInput({
      policy: extra,
      evidence: evidence({ requirements: [{ id: "R1", status: "met", evidence: "shown", severity: "info" }] }),
    }));
    expect(supplied.verdict).toBe("would-merge");
    const shipped = computeShadowMergeVerdict(baseInput());
    expect(shipped.verdict).toBe("would-merge");
    const unknown = computeShadowMergeVerdict(baseInput({
      policy: { required_inputs: ["runtime_checks", "E_t.acceptance", "E_t.bogus"], require_plan_gate: false, require_done_gate: false },
    }));
    expect(unknown.verdict).toBe("undefined");
  });

  describe("CC-13.2 the ledger check enumerates verdict artifacts", () => {
    const CRITERIA = "docs/loops/criteria.md";
    const LIMIT = /ancestry is read against this tree's HEAD, so a stale tree under-reports owed decides/;

    async function prepare(repo: string, loop: string, sha: string): Promise<string> {
      const { prepareShadowVerdict } = await load();
      const criteriaSha = git(repo, ["rev-parse", "HEAD"]);
      return prepareShadowVerdict({
        repo, loop, candidateSha: sha, criteriaSha, criteriaPath: CRITERIA,
        evidence: evidence({ loop, candidate_git: { sha, branch: "loop/c", frozen_at: "2026-09-28T00:00:00.000Z" } }),
        gateMode: "skip",
      }).path;
    }

    it("a decided artifact is matched, counted, and the limit is stated", async () => {
      const { decideShadowVerdict, checkShadowMergeLedger } = await load();
      const repo = fixtureRepo();
      try {
        await prepare(repo, "t001", SHA_A);
        decideShadowVerdict({ repo, loop: "t001", candidateSha: SHA_A, action: "declined" });
        const r = checkShadowMergeLedger(repo);
        expect(r.severity).toBe("pass");
        expect(r.message).toContain("1 verdict artifact(s) walked, 0 pending decide");
        expect(r.message).toMatch(LIMIT);
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    });

    it("an artifact whose candidate is an ancestor of HEAD and has NO ledger line is an issue, with the ledger absent", async () => {
      const { checkShadowMergeLedger } = await load();
      const repo = fixtureRepo();
      try {
        const head = git(repo, ["rev-parse", "HEAD"]);
        await prepare(repo, "15-slice-3", head);
        expect(existsSync(join(repo, "docs", "loops", "shadow-merge", "ledger.jsonl"))).toBe(false);
        const r = checkShadowMergeLedger(repo);
        expect(r.severity).toBe("issue");
        expect(r.message).toContain("no ledger line");
        expect(r.message).toContain("decide is owed");
        expect(r.message).toContain("1 verdict artifact(s) walked");
        expect(r.message).toMatch(LIMIT);
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    });

    it("an owed decide is an issue when the ledger exists but holds a line for a different artifact", async () => {
      const { decideShadowVerdict, checkShadowMergeLedger } = await load();
      const repo = fixtureRepo();
      try {
        const head = git(repo, ["rev-parse", "HEAD"]);
        await prepare(repo, "t001", SHA_A);
        decideShadowVerdict({ repo, loop: "t001", candidateSha: SHA_A, action: "declined" });
        await prepare(repo, "t002", head);
        const r = checkShadowMergeLedger(repo);
        expect(r.severity).toBe("issue");
        expect(r.message).toContain(head);
        expect(r.message).toContain("2 verdict artifact(s) walked");
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    });

    it("an undecided artifact whose candidate is not merged is pending: severity pass, count and SHA printed", async () => {
      const { checkShadowMergeLedger } = await load();
      const repo = fixtureRepo();
      try {
        await prepare(repo, "t001", SHA_B);
        const r = checkShadowMergeLedger(repo);
        expect(r.severity).toBe("pass");
        expect(r.message).toContain("1 verdict artifact(s) walked, 1 pending decide");
        expect(r.message).toContain(SHA_B);
        expect(r.message).toMatch(LIMIT);
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    });

    it("a malformed artifact is an issue, never skipped", async () => {
      const { checkShadowMergeLedger } = await load();
      const repo = fixtureRepo();
      try {
        const path = await prepare(repo, "t001", SHA_A);
        writeFileSync(path, "{ not json");
        const r = checkShadowMergeLedger(repo);
        expect(r.severity).toBe("issue");
        expect(r.message).toContain("unreadable");
        expect(r.message).toContain("1 verdict artifact(s) walked");
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    });

    it("a tree with no ledger and no artifacts says it walked 0", async () => {
      const { checkShadowMergeLedger } = await load();
      const repo = fixtureRepo();
      try {
        const r = checkShadowMergeLedger(repo);
        expect(r.severity).toBe("pass");
        expect(r.message).toContain("0 verdict artifacts walked");
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    });
  });
});
