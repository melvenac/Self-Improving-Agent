import { describe, it, expect } from "vitest";
import {
  formatApoptosisQueue,
  apoptosisFlaggedExpr,
  evaluateLifecycle,
  LIFECYCLE_CONFIG,
  type ApoptosisCandidate,
  type FeedbackEntry,
  type LifecycleGateConfig,
} from "../src/lifecycle.js";

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

/**
 * Loop 8 R1 — the suspension itself.
 *
 * These pin behaviour that had no test before this loop: `evaluateLifecycle`'s
 * apoptosis/autoDelete decision was covered nowhere, only the review-queue SQL
 * was. That gap is why the gate could be inert in production for the whole of
 * its life without a single test noticing.
 */
describe("R1 lifecycle suspension", () => {
  /** An entry that would have tripped the pre-R1 gate: 5 rated, rate 0.2. */
  const wouldPrune: FeedbackEntry = {
    id: 1,
    helpful: 1,
    harmful: 3,
    neutral: 40,
    success_rate: 0.25,
    maturity: "progenitor",
    source: "agent",
  };

  const RESTORED: LifecycleGateConfig = { ...LIFECYCLE_CONFIG, apoptosisEnabled: true };

  it("does not fire apoptosis while the gate is suspended", () => {
    const r = evaluateLifecycle(wouldPrune, "harmful");
    expect(r.apoptosis).toBe(false);
    expect(r.autoDelete).toBe(false);
    expect(r.transitionMessage).toBeNull();
  });

  it("still fires apoptosis when the gate is restored — so the flag is the thing stopping it", () => {
    const r = evaluateLifecycle(wouldPrune, "harmful", RESTORED);
    expect(r.apoptosis).toBe(true);
    expect(r.autoDelete).toBe(true);
    expect(r.transitionMessage).toContain("Apoptosis");
  });

  it("keeps recording counters and success_rate while suspended", () => {
    // 1 helpful + 4 harmful once this rating lands: the rate must still move.
    const r = evaluateLifecycle(wouldPrune, "harmful");
    expect(r.newSuccessRate).toBeCloseTo(1 / 5, 10);
  });

  it("still promotes while suspended — the bookkeeping half stays live", () => {
    const climbing: FeedbackEntry = {
      id: 2,
      helpful: 2,
      harmful: 0,
      neutral: 0,
      success_rate: 1,
      maturity: "progenitor",
      source: "agent",
    };
    const r = evaluateLifecycle(climbing, "helpful");
    expect(r.newMaturity).toBe("proven");
    expect(r.transitionMessage).toContain("Promoted");
  });

  it("neutral ratings leave success_rate null and cannot reach the gate", () => {
    const unrated: FeedbackEntry = {
      id: 3,
      helpful: 0,
      harmful: 0,
      neutral: 12,
      success_rate: null,
      maturity: "progenitor",
      source: "agent",
    };
    // True even with the gate restored: the denominator excludes neutral, so a
    // wholly-neutral entry is unreachable by apoptosis in either config.
    expect(evaluateLifecycle(unrated, "neutral").newSuccessRate).toBeNull();
    expect(evaluateLifecycle(unrated, "neutral", RESTORED).apoptosis).toBe(false);
  });
});
