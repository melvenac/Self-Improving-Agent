import type { CheckResult, CategoryScore } from "./types.js";

export interface KnowledgeQualityInput {
  helpful: number;
  harmful: number;
  neutral: number;
  totalEntries: number;
  ratedEntries: number;
  duplicateClusters: number;
}

export interface StalenessInput {
  staleRatio: number;
  lowSuccessCount: number;
  summarizedSessions: number;
  eligibleSessions: number;
}

export interface CoverageInput {
  domainsWithEntries: number;
  totalDomains: number;
  matureCount: number;
  provenCount: number;
  totalEntries: number;
  skillsImplemented: number;
  proposalClusters: number;
}

export interface PipelineHealthInput {
  lastHookRun: string | null;
  scoreTrend: "improving" | "stable" | "declining" | "unknown";
}

// Category 1: Config & Structure (25 pts max)
// Formula: round((passed + warnings*0.5) / total * 25)
// "fixed" counts as "passed" (same credit)
export function scoreConfigStructure(checks: CheckResult[]): CategoryScore {
  if (checks.length === 0) {
    return { name: "Config & Structure", score: 0, max: 25, details: { passed: 0, warned: 0, failed: 0 } };
  }

  let passed = 0;
  let warned = 0;
  let failed = 0;

  for (const check of checks) {
    if (check.severity === "pass" || check.severity === "fixed") {
      passed++;
    } else if (check.severity === "warn") {
      warned++;
    } else {
      failed++;
    }
  }

  const score = Math.min(Math.round((passed + warned * 0.5) / checks.length * 25), 25);
  return {
    name: "Config & Structure",
    score,
    max: 25,
    details: { passed, warned, failed },
  };
}

// Category 2: Knowledge Quality (25 pts max)
// Precision (10 pts): (helpful / (helpful+harmful+neutral)) * 10
// Coverage (8 pts): (ratedEntries / totalEntries) * 8
// Dedup (7 pts): 7 - min(duplicateClusters * 2, 7)
export function scoreKnowledgeQuality(input: KnowledgeQualityInput): CategoryScore {
  const { helpful, harmful, neutral, totalEntries, ratedEntries, duplicateClusters } = input;

  const totalRated = helpful + harmful + neutral;
  const precision = totalRated > 0 ? (helpful / totalRated) * 10 : 0;
  const coverage = totalEntries > 0 ? (ratedEntries / totalEntries) * 8 : 0;
  const dedup = 7 - Math.min(duplicateClusters * 2, 7);

  const score = Math.min(Math.round(precision + coverage + dedup), 25);
  return {
    name: "Knowledge Quality",
    score,
    max: 25,
    details: { precision: Math.round(precision * 10) / 10, coverage: Math.round(coverage * 10) / 10, dedup },
  };
}

// Category 3: Staleness (20 pts max)
// Stale (10 pts): round((1 - min(staleRatio*2, 1)) * 10)
// Low success (5 pts): max(0, 5 - lowSuccessCount)
// Summary gap (5 pts): (summarizedSessions / eligibleSessions) * 5
export function scoreStaleness(input: StalenessInput): CategoryScore {
  const { staleRatio, lowSuccessCount, summarizedSessions, eligibleSessions } = input;

  const stale = Math.round((1 - Math.min(staleRatio * 2, 1)) * 10);
  const lowSuccess = Math.max(0, 5 - lowSuccessCount);
  const summaryGap = eligibleSessions > 0 ? (summarizedSessions / eligibleSessions) * 5 : 5;

  const score = Math.min(Math.round(stale + lowSuccess + summaryGap), 20);
  return {
    name: "Staleness",
    score,
    max: 20,
    details: { stale, lowSuccess, summaryGap: Math.round(summaryGap * 10) / 10 },
  };
}

// Category 4: Coverage (20 pts max)
// Domain (10 pts): (domainsWithEntries / totalDomains) * 10
// Maturity (5 pts): round(min((matureCount + provenCount*0.5) / totalEntries * 2, 1) * 5)
// Skill conversion (5 pts): round(min(skillsImplemented / proposalClusters * 2, 1) * 5)
export function scoreCoverage(input: CoverageInput): CategoryScore {
  const { domainsWithEntries, totalDomains, matureCount, provenCount, totalEntries, skillsImplemented, proposalClusters } = input;

  const domain = totalDomains > 0 ? (domainsWithEntries / totalDomains) * 10 : 0;
  const maturity = totalEntries > 0
    ? Math.round(Math.min((matureCount + provenCount * 0.5) / totalEntries * 2, 1) * 5)
    : 0;
  const skillConversion = proposalClusters > 0
    ? Math.round(Math.min(skillsImplemented / proposalClusters * 2, 1) * 5)
    : 5;

  const score = Math.min(Math.round(domain + maturity + skillConversion), 20);
  return {
    name: "Coverage",
    score,
    max: 20,
    details: { domain: Math.round(domain * 10) / 10, maturity, skillConversion },
  };
}

// Category 5: Pipeline Health (10 pts max)
// Hook recency (6 pts): ≤24h → 6, ≤7d → 3, else 0
// Score trend  (4 pts): improving → 4, stable → 3, declining → 1, unknown → 0
//
// A shadow-recall component used to hold 3 of these points, but nothing has
// written shadow-recall.jsonl since the v1→v2 TypeScript port (Apr 2026), so it
// could never score above 0 and silently capped the category at 7/10. Rather
// than score a signal that no longer exists, its points were redistributed to
// the two components that are actually measured. If shadow recall is revived,
// re-add it here and rebalance.
export function scorePipelineHealth(input: PipelineHealthInput): CategoryScore {
  const { lastHookRun, scoreTrend } = input;
  const now = Date.now();
  const h24 = 24 * 60 * 60 * 1000;
  const d7 = 7 * 24 * 60 * 60 * 1000;

  let hookRecency = 0;
  if (lastHookRun !== null) {
    const age = now - new Date(lastHookRun).getTime();
    hookRecency = age <= h24 ? 6 : age <= d7 ? 3 : 0;
  }

  const trendScore =
    scoreTrend === "improving" ? 4 :
    scoreTrend === "stable" ? 3 :
    scoreTrend === "declining" ? 1 : 0;

  const score = Math.min(hookRecency + trendScore, 10);
  return {
    name: "Pipeline Health",
    score,
    max: 10,
    details: { hookRecency, trendScore },
  };
}
