import { describe, it, expect } from "vitest";
import { formatApoptosisQueue, apoptosisFlaggedExpr, type ApoptosisCandidate } from "../src/lifecycle.js";

function candidate(over: Partial<ApoptosisCandidate> = {}): ApoptosisCandidate {
  return { id: 1, key: "some-entry", helpful: 1, harmful: 5, success_rate: 0.17, ...over };
}

describe("formatApoptosisQueue", () => {
  // The regression this function exists for: v0.14.0 gated the whole block on
  // a non-empty queue, so "none flagged" and "server too old to report it"
  // printed identically and neither could be asserted.
  it("reports the count at zero rather than printing nothing", () => {
    const lines = formatApoptosisQueue([]);

    expect(lines.join("\n")).toContain("Apoptosis candidates awaiting review: 0");
  });

  it("omits the removal hint at zero — there is nothing to remove", () => {
    const lines = formatApoptosisQueue([]);

    expect(lines.join("\n")).not.toContain("ob_forget");
  });

  it("lists each candidate with counts and rate", () => {
    const lines = formatApoptosisQueue([candidate({ id: 42, key: "bad-advice" })]);
    const text = lines.join("\n");

    expect(text).toContain("Apoptosis candidates awaiting review: 1");
    expect(text).toContain("[42] bad-advice — 1 helpful, 5 harmful, rate 0.17");
    expect(text).toContain("Manual entries are never auto-pruned");
  });

  it("falls back to 'no key' for a keyless entry", () => {
    const lines = formatApoptosisQueue([candidate({ key: null })]);

    expect(lines.join("\n")).toContain("[1] no key —");
  });

  it("truncates past the limit and says how many were withheld", () => {
    const rows = Array.from({ length: 13 }, (_, i) => candidate({ id: i + 1 }));
    const lines = formatApoptosisQueue(rows);
    const text = lines.join("\n");

    expect(text).toContain("Apoptosis candidates awaiting review: 13");
    expect(text).toContain("... +3 more");
    expect(lines.filter(l => /^ {2}\[\d+\]/.test(l))).toHaveLength(10);
  });
});

describe("apoptosisFlaggedExpr", () => {
  it("counts only non-neutral ratings, matching evaluateLifecycle", () => {
    const sql = apoptosisFlaggedExpr("k");

    expect(sql).toContain("k.helpful + k.harmful");
    expect(sql).not.toContain("neutral");
  });

  it("restricts to manual entries — anything else is already auto-pruned", () => {
    expect(apoptosisFlaggedExpr("k")).toContain("k.source = 'manual'");
  });

  it("applies the alias to every column so it can be joined", () => {
    const sql = apoptosisFlaggedExpr("other");

    expect(sql).not.toMatch(/(?<![\w.])(source|success_rate|helpful|harmful)\b/);
  });
});
