/**
 * T-207: a push to a mutant ref does not start CI.
 *
 * A mutant branch is never evidence (D-061: QA re-applies mutants locally), and every push to
 * `loop/**` or `qa/**` started a tcm run: about 40 mutant pushes on 2026-09-30 filled both
 * runners and the TG-2 fix on master waited 20 minutes. The workflow's push `branches` list now
 * carries negated patterns.
 *
 * `matchesPushFilter` implements the part of GitHub's filter-pattern rules the workflow uses, in
 * order: `*` matches any characters except `/`, `**` matches any characters, a leading `!` removes
 * what an earlier pattern matched, and the LAST pattern that matches decides. Anything else in a
 * pattern is matched literally, and the test fails if the workflow uses a pattern character this
 * matcher does not model, rather than passing on a guess.
 *
 * The ref names below are copied from `git ls-remote` (2026-09-30), not read from the network.
 * The live behaviour is proved separately by a real push, recorded in the T-207 handoff.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const workflowPath = join(import.meta.dirname, "../../../../.github/workflows/ci.yml");

const MODELLED = /^[A-Za-z0-9_./*!-]+$/;

export function globToRegExp(pattern: string): RegExp {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      out += ".*";
      i++;
    } else if (c === "*") {
      out += "[^/]*";
    } else {
      out += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${out}$`);
}

export function matchesPushFilter(patterns: string[], branch: string): boolean {
  let included = false;
  for (const p of patterns) {
    const negated = p.startsWith("!");
    if (globToRegExp(negated ? p.slice(1) : p).test(branch)) included = !negated;
  }
  return included;
}

function pushBranches(text: string): string[] {
  const wf = parse(text) as { on?: { push?: { branches?: string[] } } };
  const branches = wf.on?.push?.branches;
  if (!Array.isArray(branches)) throw new Error("ci.yml has no on.push.branches list");
  return branches;
}

/** Real mutant refs from `git ls-remote --heads origin`, across the naming shapes in use. */
const MUTANTS = [
  "loop/t201-mut-m1-drop-block",
  "loop/t201-mut-m10-any-seat-gets-block",
  "loop/tg2-mut-drop-scan",
  "loop/t203-seat-by-checkout-mut-e-wrong-basename",
  "loop/t203-seat-by-checkout-mut-f-main-not-mapped",
  "loop/t199-missing-handoff-mut-a-never",
  "loop/t200-mut-m1-always-local",
  "loop/15-slice-3-a10-mut-r79-a",
  "loop/15-slice-3-a13-mut-r95",
  "qa/b2-mut-cli-widen",
  "qa/b2-mut-nowrite",
];

/** Refs that MUST still run CI, including ones that only look like mutants. */
const REAL = [
  "master",
  "loop/t201-assignment",
  "loop/t200-record-from-master",
  "loop/t207-ci-skip-mutants",
  "loop/15-slice-3-candidate-a10",
  "loop/15-slice-3-b-step1-candidate",
  "loop/t199-missing-handoff",
  "qa/b-criteria-load",
  "qa/b-step1-cand",
];

/** Shapes the filter does NOT cover, named so the limit is in the test and not only in a comment. */
const NOT_COVERED = ["loop/15-slice-3-a10-redcheck", "qa/b-step1-mutant"];

describe("T-207: ci.yml's push filter skips mutant refs", () => {
  const text = readFileSync(workflowPath, "utf8");

  it("every pattern in the workflow is one this matcher models", () => {
    for (const p of pushBranches(text)) expect(p, p).toMatch(MODELLED);
  });

  it("excludes every real mutant ref", () => {
    const patterns = pushBranches(text);
    for (const ref of MUTANTS) expect(matchesPushFilter(patterns, ref), ref).toBe(false);
  });

  it("still runs master, candidates and QA candidate refs", () => {
    const patterns = pushBranches(text);
    for (const ref of REAL) expect(matchesPushFilter(patterns, ref), ref).toBe(true);
  });

  it("states its limit: -redcheck and -mutant names still run", () => {
    const patterns = pushBranches(text);
    for (const ref of NOT_COVERED) expect(matchesPushFilter(patterns, ref), ref).toBe(true);
  });

  it("leaves workflow_dispatch and pull_request unfiltered by branch", () => {
    const wf = parse(text) as { on: Record<string, unknown> };
    expect(wf.on.workflow_dispatch).toBeDefined();
    const pr = wf.on.pull_request as { branches?: unknown };
    expect(pr.branches).toBeUndefined();
  });

  // T-156: a detector is validated against a known positive and a known negative in the same test.
  it("KNOWN POSITIVE: the same workflow without the negation lets a mutant ref through", () => {
    const withoutNegation = text
      .split("\n")
      .filter((l) => !/^\s*- "!(loop|qa)\/\*\*-mut-\*"\s*$/.test(l))
      .join("\n");
    expect(withoutNegation).not.toBe(text);
    const patterns = pushBranches(withoutNegation);
    expect(matchesPushFilter(patterns, "loop/tg2-mut-drop-scan")).toBe(true);
    expect(matchesPushFilter(patterns, "qa/b2-mut-nowrite")).toBe(true);
  });

  it("KNOWN NEGATIVE: the matcher itself excludes only what a negation names, in order", () => {
    expect(matchesPushFilter(["loop/**", "!loop/**-mut-*"], "loop/a-mut-b")).toBe(false);
    expect(matchesPushFilter(["loop/**", "!loop/**-mut-*"], "loop/a-b")).toBe(true);
    // Order decides: a positive AFTER the negation re-includes.
    expect(matchesPushFilter(["!loop/**-mut-*", "loop/**"], "loop/a-mut-b")).toBe(true);
    // `*` does not cross `/`; `**` does.
    expect(matchesPushFilter(["loop/*"], "loop/a/b")).toBe(false);
    expect(matchesPushFilter(["loop/**"], "loop/a/b")).toBe(true);
  });
});
