/**
 * Slice four's scope guards (S4-5b, S4-5c, S4-8 clause 3, S4-9), checked against the base by sha.
 *
 * The base is origin/master 2448a6ea. Every check reads git, so each is shown to fire on a planted
 * input as well as to hold on the real tree: a guard that cannot fail proves nothing.
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO = resolve(__dirname, "../../..");
const BASE = "2448a6ea";

/**
 * The paths each diff-based guard reads, in ONE table (r5). A guard reads only what its row names,
 * so a later planner or QA document on master (which may STATE the forbidden-word rule, and so
 * contain the word) can never fail it. S4-5b covers the candidate's code and tests, the gate
 * records, and the close-out once it exists; it does not cover planner or QA documents.
 */
export const SCOPES = {
  forbiddenWord: ["open-brain", "docs/loops/loop-15-slice-4-records", "docs/loops/loop-15-slice-4-closeout.md"],
  jevMcp: ["open-brain/src"],
  skips: ["open-brain/tests"],
  policies: ["open-brain/src/harness/policies"],
} as const;

const git = (args: string[]): string => execFileSync("git", args, { cwd: REPO, encoding: "utf-8", shell: false, maxBuffer: 256 * 1024 * 1024 });

/** Added lines (without the leading plus) of `git diff <base> -- <paths>` in `cwd`, working tree included. */
function addedLines(paths: string[], cwd: string = REPO, base: string = BASE): string[] {
  return execFileSync("git", ["diff", "--unified=0", base, "--", ...paths], { cwd, encoding: "utf-8", shell: false, maxBuffer: 256 * 1024 * 1024 })
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1));
}

// Spelled in pieces so this file does not contain what it scans for.
const FORBIDDEN_WORD = new RegExp(`\\b${"calibrat"}${"ed"}\\b`, "i");
const JEV_MCP = new RegExp(`${"jev"}-${"mcp"}|${"mcp__"}${"jev"}`);
// CALL POSITION only (r2, D1): a test function, optionally with modifiers, then the skipping modifier.
// The r1 pattern matched the word anywhere, so a test TITLE containing it was a hit.
const SKIPS = new RegExp(`\\b(it|test|describe|suite)(\\.\\w+(\\((?:[^()]|\\((?:[^()]|\\([^()]*\\))*\\))*\\))?)*\\.(${"sk"}${"ip"}|${"to"}${"do"}|${"sk"}${"ipIf"}|${"run"}${"If"})\\b`);

/** Added lines inside one guard's scope. */
const scopedAdded = (scope: keyof typeof SCOPES, cwd: string = REPO, base: string = BASE): string[] => addedLines([...SCOPES[scope]], cwd, base);

const hits = (re: RegExp, lines: string[]): string[] => lines.filter((l) => re.test(l));

/** Test calls in a file's text (it/test, optionally .each). */
const countTests = (text: string): number => (text.match(/^\s*(?:it|test)(?:\.each\([^)]*\))?\(/gm) ?? []).length;

/**
 * The ONLY way a test file may end below its BASE count (S4-9.2, ruled by atlas-sia, session 157).
 * An entry passes a file only when its before AND after counts match EXACTLY, and an entry that no
 * longer matches is itself a finding, so an allowance cannot outlive the removal it records.
 */
export interface TestLossAllowance { file: string; before: number; after: number; reason: string }
export const ALLOWED_TEST_LOSSES: readonly TestLossAllowance[] = [
  { file: "open-brain/tests/cli-flags.test.ts", before: 19, after: 18, reason: "T-215 / R-011: backfill-success-rate.mjs deleted; maturity-ordering test proved nothing" },
  { file: "open-brain/tests/ranking.test.ts", before: 11, after: 9, reason: "T-215 / R-011: backfill-success-rate.mjs deleted; maturity-ordering test proved nothing. T-152 / R-011 (atlas-sia ruling, session 160): success-rate tie row deleted, its successRate was never stored" },
];

/** Findings for modified test files (before/after counts) against an allowance table; [] means the guard holds. */
export function testCountFindings(rows: { file: string; before: number; after: number }[], allowances: readonly TestLossAllowance[]): string[] {
  const findings: string[] = [];
  for (const r of rows) {
    if (r.after >= r.before) continue;
    const a = allowances.find((x) => x.file === r.file && x.before === r.before && x.after === r.after);
    if (a === undefined) findings.push(`${r.file} lost a test (${r.before} -> ${r.after}) with no matching allowance`);
  }
  for (const a of allowances) {
    const r = rows.find((x) => x.file === a.file);
    if (r === undefined || r.before !== a.before || r.after !== a.after) {
      findings.push(`stale allowance for ${a.file}: expected ${a.before} -> ${a.after}, found ${r === undefined ? "file not modified" : `${r.before} -> ${r.after}`}`);
    }
  }
  return findings;
}

describe("slice four guards", { timeout: 120_000 }, () => {
  it("G0 the scans fire on a planted line and stay quiet on a clean one", () => {
    expect(hits(FORBIDDEN_WORD, [`the values are ${"calibrat"}${"ed"}`])).toHaveLength(1);
    expect(hits(FORBIDDEN_WORD, ["the values are PROVISIONAL"])).toHaveLength(0);
    expect(hits(JEV_MCP, [`import x from "${"jev"}-${"mcp"}"`])).toHaveLength(1);
    expect(hits(JEV_MCP, ["import x from 'gate.js'"])).toHaveLength(0);
    expect(hits(SKIPS, [`it.${"sk"}${"ip"}("x", () => {})`])).toHaveLength(1);
    expect(hits(SKIPS, [`describe.each([1]).${"sk"}${"ip"}("x", () => {})`])).toHaveLength(1);
    expect(hits(SKIPS, [`test.${"run"}${"If"}(cond)("x", () => {})`])).toHaveLength(1);
    // r3 residuals: the `suite` alias, and parentheses nested inside a modifier's arguments.
    expect(hits(SKIPS, [`suite.${"sk"}${"ip"}("x", () => {})`])).toHaveLength(1);
    expect(hits(SKIPS, [`describe.each([[1, (2)], [fn(3, (4))]]).${"sk"}${"ip"}("x", () => {})`])).toHaveLength(1);
    expect(hits(SKIPS, [`it.concurrent.${"sk"}${"ip"}("x", () => {})`])).toHaveLength(1);
    expect(hits(SKIPS, ["it('x', () => {})"])).toHaveLength(0);
    // The r1 false positive: a TITLE that names the thing is not a call.
    expect(hits(SKIPS, [`it("S4-9.2 no ${"sk"}${"ip"}, ${"to"}${"do"}, ${"sk"}${"ipIf"} or ${"run"}${"If"} is added", () => {`])).toHaveLength(0);
    // And the diff reader really returns added lines: this very file is one of them once it is committed or staged.
    expect(addedLines(["open-brain/src/harness/gate-records.ts"]).length).toBeGreaterThan(50);
  });

  it("D1 the skip scan fires on a planted skip in a COMMITTED file, and not on one in an untracked file (why r1 looked green)", () => {
    const dir = mkdtempSync(join(tmpdir(), "s4guards-"));
    const run = (args: string[]): string => execFileSync("git", args, { cwd: dir, encoding: "utf-8", shell: false }).trim();
    run(["init", "--initial-branch=main"]);
    run(["config", "user.email", "g@example.invalid"]);
    run(["config", "user.name", "g"]);
    run(["config", "commit.gpgsign", "false"]);
    mkdirSync(join(dir, "open-brain/tests"), { recursive: true });
    writeFileSync(join(dir, "open-brain/tests/a.test.ts"), "it('a', () => {});\n");
    run(["add", "-A"]);
    run(["commit", "-q", "-m", "base"]);
    const base = run(["rev-parse", "HEAD"]);
    // Untracked: `git diff <base>` does not see it, which is exactly how r1's guard stayed quiet.
    writeFileSync(join(dir, "open-brain/tests/untracked.test.ts"), `it.${"sk"}${"ip"}('u', () => {});\n`);
    expect(hits(SKIPS, addedLines(["open-brain/tests"], dir, base))).toEqual([]);
    // Committed: the same line is an added line and the scan fires.
    writeFileSync(join(dir, "open-brain/tests/b.test.ts"), `it.${"sk"}${"ip"}('b', () => {});\nit('fine', () => {});\n`);
    run(["add", "open-brain/tests/b.test.ts"]);
    run(["commit", "-q", "-m", "plant"]);
    expect(hits(SKIPS, addedLines(["open-brain/tests"], dir, base))).toHaveLength(1);
  });

  it("D1b the real tree has no untracked file under open-brain/tests, so the diff-based scans see every test", () => {
    const untracked = git(["ls-files", "--others", "--exclude-standard", "--", "open-brain/tests"]).trim();
    expect(untracked).toBe("");
  });

  it("S4-6d.3 neither shadow runner imports the shadow merge verdict, and the CLI's prepare passes no G_done or G_qa as a gate", () => {
    const read = (p: string): string => readFileSync(resolve(REPO, p), "utf-8");
    const importsMerge = (src: string): boolean => /from\s+["']\.\/shadow-merge\.js["']/.test(src);
    expect(importsMerge(`import { x } from "./shadow-merge.js";`)).toBe(true);
    expect(importsMerge(`import { x } from "./gate.js";`)).toBe(false);
    for (const f of ["shadow-gates.ts", "shadow-qa.ts", "gate-records.ts", "closeout-tables.ts"]) {
      expect(importsMerge(read(`open-brain/src/harness/${f}`)), f).toBe(false);
    }
    const cli = read("open-brain/src/harness/cli.ts");
    const at = cli.indexOf("prepareShadowVerdict({");
    expect(at).toBeGreaterThan(0);
    const call = cli.slice(at, cli.indexOf("});", at));
    expect(call.length).toBeGreaterThan(100);
    expect(call).not.toMatch(/doneGate|planGate/);
    // r3: a spread could smuggle the same wiring in under another name (QA 242's r02), so none is allowed.
    expect(call).not.toMatch(/\.\.\./);
    expect(/doneGate/.test("prepareShadowVerdict({ doneGate: x });")).toBe(true);
    expect(/\.\.\./.test("prepareShadowVerdict({ a, ...wired, });")).toBe(true);
    expect(/\.\.\./.test("prepareShadowVerdict({ a, b, });")).toBe(false);
  });

  it("F1 S4-5b's scope: fires on a committed plant in open-brain/ and in the records directory, and does NOT fire on one in a QA or planner document (r5)", () => {
    const dir = mkdtempSync(join(tmpdir(), "s4scope-"));
    const run = (args: string[]): string => execFileSync("git", args, { cwd: dir, encoding: "utf-8", shell: false }).trim();
    run(["init", "--initial-branch=main"]);
    run(["config", "user.email", "g@example.invalid"]);
    run(["config", "user.name", "g"]);
    run(["config", "commit.gpgsign", "false"]);
    mkdirSync(join(dir, "open-brain/src"), { recursive: true });
    mkdirSync(join(dir, "docs/loops/loop-15-slice-4-records"), { recursive: true });
    writeFileSync(join(dir, "open-brain/src/a.ts"), "export const a = 1;\n");
    run(["add", "-A"]);
    run(["commit", "-q", "-m", "base"]);
    const base = run(["rev-parse", "HEAD"]);
    const word = `the values are ${"calibrat"}${"ed"}\n`;

    // A rule-stating QA or planner document names the word, as master's later docs do: not a hit.
    writeFileSync(join(dir, "docs/loops/qa-238-criteria.md"), word);
    writeFileSync(join(dir, "docs/loops/loop-15-slice-4-step2-dispatch.md"), word);
    run(["add", "-A"]);
    run(["commit", "-q", "-m", "docs that state the rule"]);
    expect(hits(FORBIDDEN_WORD, scopedAdded("forbiddenWord", dir, base))).toEqual([]);
    // The same plants ARE visible to an unscoped diff, so the empty result above is the scope's doing.
    expect(hits(FORBIDDEN_WORD, addedLines(["."], dir, base))).toHaveLength(2);

    // Committed in open-brain/: fires.
    writeFileSync(join(dir, "open-brain/src/b.ts"), `// ${word}`);
    run(["add", "-A"]);
    run(["commit", "-q", "-m", "plant in code"]);
    expect(hits(FORBIDDEN_WORD, scopedAdded("forbiddenWord", dir, base))).toHaveLength(1);

    // Committed in the records directory: fires too.
    writeFileSync(join(dir, "docs/loops/loop-15-slice-4-records/pr-1.G_done.x.json"), `{"note": "${word.trim()}"}\n`);
    run(["add", "-A"]);
    run(["commit", "-q", "-m", "plant in a record"]);
    expect(hits(FORBIDDEN_WORD, scopedAdded("forbiddenWord", dir, base))).toHaveLength(2);

    // And the close-out, once it exists.
    writeFileSync(join(dir, "docs/loops/loop-15-slice-4-closeout.md"), word);
    run(["add", "-A"]);
    run(["commit", "-q", "-m", "plant in the close-out"]);
    expect(hits(FORBIDDEN_WORD, scopedAdded("forbiddenWord", dir, base))).toHaveLength(3);
  });

  it("F2 every diff-based guard reads only the paths its row names: each scope is inside open-brain/ or the slice's own records, never a bare docs path", () => {
    for (const [name, paths] of Object.entries(SCOPES)) {
      for (const p of paths) {
        expect(p === "open-brain" || p.startsWith("open-brain/") || p.startsWith("docs/loops/loop-15-slice-4-"), `${name}: ${p}`).toBe(true);
      }
    }
  });

  it("S4-5b no added line, anywhere in the slice's diff, contains the forbidden word (whole word, any case)", () => {
    const lines = scopedAdded("forbiddenWord");
    expect(lines.length).toBeGreaterThan(500);
    expect(hits(FORBIDDEN_WORD, lines)).toEqual([]);
  });

  it("S4-9.2b the allowance table: the allowed pair passes, a third loss fails, a stale or filename-only entry fails", () => {
    const table = ALLOWED_TEST_LOSSES;
    const [x, y] = table;
    const pair = [{ file: x.file, before: x.before, after: x.after }, { file: y.file, before: y.before, after: y.after }];
    expect(testCountFindings(pair, table)).toEqual([]);
    // a third file losing a test still fails
    expect(testCountFindings([...pair, { file: "open-brain/tests/other.test.ts", before: 5, after: 4 }], table)).toHaveLength(1);
    // the allowed file losing MORE than recorded fails (before/after match exactly)
    const more = testCountFindings([{ ...pair[0], after: x.after - 1 }, pair[1]], table);
    expect(more).toHaveLength(2); // BOTH: it lost a test the table does not cover, and the entry is stale
    expect(more.some((m) => m.includes("lost a test"))).toBe(true);
    // a stale entry (file restored to its base count, or no longer modified) is a finding
    expect(testCountFindings([{ ...pair[0], after: x.before }, pair[1]], table)).toHaveLength(1);
    expect(testCountFindings([pair[1]], table)).toHaveLength(1);
    // a growing file needs no allowance
    expect(testCountFindings([...pair, { file: "open-brain/tests/g.test.ts", before: 2, after: 3 }], table)).toEqual([]);
  });

  it("S4-9.1 no added line in open-brain/src references the other Jev client", () => {
    expect(hits(JEV_MCP, scopedAdded("jevMcp"))).toEqual([]);
  });

  it("S4-9.2 no skip, todo, skipIf or runIf is added, and no test file loses a test", () => {
    expect(hits(SKIPS, scopedAdded("skips"))).toEqual([]);
    expect(git(["diff", "--diff-filter=D", "--name-only", BASE, "--", ...SCOPES.skips]).trim()).toBe("");
    const changed = git(["diff", "--diff-filter=M", "--name-only", BASE, "--", ...SCOPES.skips])
      .split("\n")
      .filter((f) => /\.test\.ts$/.test(f));
    const rows = changed.map((file) => ({
      file,
      before: countTests(git(["show", `${BASE}:${file}`])),
      after: countTests(git(["show", `HEAD:${file}`])),
    }));
    expect(testCountFindings(rows, ALLOWED_TEST_LOSSES)).toEqual([]);
  });

  it("S4-5c.1 the three policy files are unchanged, and later policies are the named additions", () => {
    const three = ["developer-done.json", "plan-gate.json", "merge.json"].map((f) => `open-brain/src/harness/policies/${f}`);
    expect(git(["diff", "--name-only", BASE, "--", ...three]).trim()).toBe("");
    const added = git(["diff", "--diff-filter=A", "--name-only", BASE, "--", ...SCOPES.policies]).trim().split("\n").filter(Boolean).sort();
    // qa-score.json is slice four's addition. effort.json is T-173. developer-done-cal2-r2.json is JEV-CAL-2 round 2.
    expect(added).toEqual([
      "open-brain/src/harness/policies/developer-done-cal2-r2.json",
      "open-brain/src/harness/policies/effort.json",
      "open-brain/src/harness/policies/qa-score.json",
    ]);
  });

  it("S4-5c.3 merge.json keeps both required-gate switches false", () => {
    const merge = JSON.parse(git(["show", "HEAD:open-brain/src/harness/policies/merge.json"])) as Record<string, unknown>;
    expect(merge.require_plan_gate).toBe(false);
    expect(merge.require_done_gate).toBe(false);
  });

  it("S4-8.3 the LOOP_LIMITS string is byte-identical to the base's", () => {
    const extract = (text: string): string => {
      const start = text.indexOf("export const LOOP_LIMITS =");
      const end = text.indexOf("guarantees depend on each other.\";", start);
      expect(start).toBeGreaterThan(0);
      expect(end).toBeGreaterThan(start);
      return text.slice(start, end);
    };
    const base = extract(git(["show", `${BASE}:open-brain/src/harness/runtime.ts`]));
    const now = extract(git(["show", "HEAD:open-brain/src/harness/runtime.ts"]));
    expect(base.length).toBeGreaterThan(1500);
    expect(now).toBe(base);
  });

  it("S4-9.4 C's criteria file, shadow artifact and ledger are untouched", () => {
    const paths = ["docs/loops/loop-15-slice-3-c-criteria.md", "docs/loops/shadow-merge"];
    expect(git(["ls-tree", "-r", "--name-only", "HEAD", ...paths]).trim().split("\n").length).toBeGreaterThanOrEqual(4);
    expect(git(["diff", "--name-only", BASE, "--", ...paths]).trim()).toBe("");
  });
});
