/**
 * Slice four's scope guards (S4-5b, S4-5c, S4-8 clause 3, S4-9), checked against the base by sha.
 *
 * The base is origin/master 2448a6ea. Every check reads git, so each is shown to fire on a planted
 * input as well as to hold on the real tree: a guard that cannot fail proves nothing.
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "../../..");
const BASE = "2448a6ea";

const git = (args: string[]): string => execFileSync("git", args, { cwd: REPO, encoding: "utf-8", shell: false, maxBuffer: 256 * 1024 * 1024 });

/** Added lines (without the leading plus) of `git diff BASE -- <paths>`, working tree included. */
function addedLines(paths: string[]): string[] {
  return git(["diff", "--unified=0", BASE, "--", ...paths])
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1));
}

// Spelled in pieces so this file does not contain what it scans for.
const FORBIDDEN_WORD = new RegExp(`\\b${"calibrat"}${"ed"}\\b`, "i");
const JEV_MCP = new RegExp(`${"jev"}-${"mcp"}|${"mcp__"}${"jev"}`);
const SKIPS = new RegExp(`\\.(${"sk"}${"ip"}|${"to"}${"do"})\\b|${"sk"}${"ipIf"}|${"run"}${"If"}`);

const hits = (re: RegExp, lines: string[]): string[] => lines.filter((l) => re.test(l));

describe("slice four guards", () => {
  it("G0 the scans fire on a planted line and stay quiet on a clean one", () => {
    expect(hits(FORBIDDEN_WORD, [`the values are ${"calibrat"}${"ed"}`])).toHaveLength(1);
    expect(hits(FORBIDDEN_WORD, ["the values are PROVISIONAL"])).toHaveLength(0);
    expect(hits(JEV_MCP, [`import x from "${"jev"}-${"mcp"}"`])).toHaveLength(1);
    expect(hits(JEV_MCP, ["import x from 'gate.js'"])).toHaveLength(0);
    expect(hits(SKIPS, [`it.${"sk"}${"ip"}("x", () => {})`])).toHaveLength(1);
    expect(hits(SKIPS, ["it('x', () => {})"])).toHaveLength(0);
    // And the diff reader really returns added lines: this very file is one of them once it is committed or staged.
    expect(addedLines(["open-brain/src/harness/gate-records.ts"]).length).toBeGreaterThan(50);
  });

  it("S4-5b no added line, anywhere in the slice's diff, contains the forbidden word (whole word, any case)", () => {
    const lines = addedLines([".", ":(exclude).agents"]);
    expect(lines.length).toBeGreaterThan(500);
    expect(hits(FORBIDDEN_WORD, lines)).toEqual([]);
  });

  it("S4-9.1 no added line in open-brain/src references the other Jev client", () => {
    expect(hits(JEV_MCP, addedLines(["open-brain/src"]))).toEqual([]);
  });

  it("S4-9.2 no skip, todo, skipIf or runIf is added, and no test file loses a test", () => {
    expect(hits(SKIPS, addedLines(["open-brain/tests"]))).toEqual([]);
    expect(git(["diff", "--diff-filter=D", "--name-only", BASE, "--", "open-brain/tests"]).trim()).toBe("");
    const changed = git(["diff", "--diff-filter=M", "--name-only", BASE, "--", "open-brain/tests"])
      .split("\n")
      .filter((f) => /\.test\.ts$/.test(f));
    const count = (text: string): number => (text.match(/^\s*(?:it|test)(?:\.each\([^)]*\))?\(/gm) ?? []).length;
    for (const f of changed) {
      const before = count(git(["show", `${BASE}:${f}`]));
      const after = count(git(["show", `HEAD:${f}`]));
      expect(after, `${f} lost a test`).toBeGreaterThanOrEqual(before);
    }
  });

  it("S4-5c.1 the three policy files are unchanged, and qa-score.json is the one added policy", () => {
    const three = ["developer-done.json", "plan-gate.json", "merge.json"].map((f) => `open-brain/src/harness/policies/${f}`);
    expect(git(["diff", "--name-only", BASE, "--", ...three]).trim()).toBe("");
    const added = git(["diff", "--diff-filter=A", "--name-only", BASE, "--", "open-brain/src/harness/policies"]).trim();
    expect(added).toBe("open-brain/src/harness/policies/qa-score.json");
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
