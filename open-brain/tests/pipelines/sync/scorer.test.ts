import { describe, it, expect } from "vitest";
import {
  scoreConfigStructure,
  scoreKnowledgeQuality,
  scoreStaleness,
  scoreCoverage,
  scorePipelineHealth,
} from "../../../src/pipelines/sync/scorer.js";
import type { CheckResult } from "../../../src/pipelines/sync/types.js";

describe("scoreConfigStructure", () => {
  it("scores 25/25 when all checks pass", () => {
    const checks: CheckResult[] = [
      { name: "a", severity: "pass", message: "" },
      { name: "b", severity: "pass", message: "" },
      { name: "c", severity: "pass", message: "" },
      { name: "d", severity: "pass", message: "" },
    ];
    const result = scoreConfigStructure(checks);
    expect(result.score).toBe(25);
    expect(result.max).toBe(25);
  });

  it("gives half credit for warnings", () => {
    const checks: CheckResult[] = [
      { name: "a", severity: "pass", message: "" },
      { name: "b", severity: "warn", message: "" },
    ];
    const result = scoreConfigStructure(checks);
    expect(result.score).toBe(Math.round((1 + 0.5) / 2 * 25));
  });

  it("scores 0/25 when all checks fail", () => {
    const checks: CheckResult[] = [
      { name: "a", severity: "issue", message: "" },
      { name: "b", severity: "issue", message: "" },
    ];
    const result = scoreConfigStructure(checks);
    expect(result.score).toBe(0);
  });

  it("treats fixed as passed", () => {
    const checks: CheckResult[] = [
      { name: "a", severity: "fixed", message: "", autoFixed: true },
      { name: "b", severity: "fixed", message: "", autoFixed: true },
    ];
    const result = scoreConfigStructure(checks);
    expect(result.score).toBe(25);
  });

  it("returns 0 for empty checks", () => {
    const result = scoreConfigStructure([]);
    expect(result.score).toBe(0);
  });
});

describe("scoreKnowledgeQuality", () => {
  it("scores based on precision, coverage, and dedup", () => {
    const result = scoreKnowledgeQuality({
      helpful: 80, harmful: 10, neutral: 10,
      totalEntries: 100, ratedEntries: 80, duplicateClusters: 0,
    });
    expect(result.max).toBe(25);
    // Precision: 80/100 * 10 = 8, Coverage: 80/100 * 8 = 6.4, Dedup: 7
    expect(result.score).toBe(Math.round(8 + 6.4 + 7));
  });

  it("handles zero ratings", () => {
    const result = scoreKnowledgeQuality({
      helpful: 0, harmful: 0, neutral: 0,
      totalEntries: 0, ratedEntries: 0, duplicateClusters: 0,
    });
    expect(result.score).toBe(7); // 0 + 0 + 7 (no dupes)
  });
});

describe("scoreStaleness", () => {
  it("scores based on stale ratio, low success, summary gaps", () => {
    const result = scoreStaleness({
      staleRatio: 0.1, lowSuccessCount: 1,
      summarizedSessions: 8, eligibleSessions: 10,
    });
    expect(result.max).toBe(20);
    // Stale: (1 - 0.2) * 10 = 8, Low: 4, Summary: 4
    expect(result.score).toBe(Math.round(8 + 4 + 4));
  });
});

describe("scoreCoverage", () => {
  it("scores based on domain coverage, maturity, skill conversion", () => {
    const result = scoreCoverage({
      domainsWithEntries: 8, totalDomains: 10,
      matureCount: 5, provenCount: 10, totalEntries: 100,
      skillsImplemented: 3, proposalClusters: 10,
    });
    expect(result.max).toBe(20);
  });
});

describe("scorePipelineHealth", () => {
  it("scores full marks for recent, improving, active", () => {
    const now = new Date();
    const result = scorePipelineHealth({
      lastHookRun: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      scoreTrend: "improving",
      lastShadowRecall: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(result.max).toBe(10);
    expect(result.score).toBe(10);
  });

  it("scores 0 with all nulls and unknown", () => {
    const result = scorePipelineHealth({
      lastHookRun: null,
      scoreTrend: "unknown",
      lastShadowRecall: null,
    });
    expect(result.score).toBe(0);
  });
});
