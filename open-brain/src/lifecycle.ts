// Lifecycle engine — evaluates maturity transitions and apoptosis
// Adapted from STEM Agent thresholds for session-based cadence

export const LIFECYCLE_CONFIG = {
  /** Minimum non-neutral ratings before judging */
  apoptosisMinActivations: 5,
  /** Success rate below this = apoptosis candidate */
  apoptosisThreshold: 0.3,
  /** Helpful ratings needed for progenitor → proven */
  provenMinHelpful: 3,
  /** Helpful ratings needed for proven → mature */
  matureMinHelpful: 7,
  /** Minimum success rate to advance maturity */
  advanceMinSuccessRate: 0.5,
  /** Recall ranking multiplier for mature entries */
  matureBoost: 1.5,
  /** Recall ranking multiplier for proven entries */
  provenBoost: 1.2,
  /** Recall ranking penalty for entries below the apoptosis threshold */
  lowSuccessPenalty: 0.5,
  /** Per-day recency decay applied to recall ranking */
  recencyDecayPerDay: 0.005,
  /** Recall ranking multiplier for entries tagged 'failure' */
  failureBoost: 1.3,
} as const;

export type Maturity = "progenitor" | "proven" | "mature";
export type Rating = "helpful" | "harmful" | "neutral";

export interface FeedbackEntry {
  id: number;
  helpful: number;
  harmful: number;
  neutral: number;
  success_rate: number | null;
  maturity: Maturity;
  source: string;
}

export interface LifecycleResult {
  newSuccessRate: number | null;
  newMaturity: Maturity;
  apoptosis: boolean;
  /** true = auto-delete, false = flag for approval */
  autoDelete: boolean;
  transitionMessage: string | null;
}

export function evaluateLifecycle(
  entry: FeedbackEntry,
  rating: Rating,
): LifecycleResult {
  // Increment counts
  const helpful = entry.helpful + (rating === "helpful" ? 1 : 0);
  const harmful = entry.harmful + (rating === "harmful" ? 1 : 0);
  const nonNeutral = helpful + harmful;

  // Recalculate success rate (null if only neutral ratings)
  const newSuccessRate = nonNeutral > 0 ? helpful / nonNeutral : null;

  // Check apoptosis
  const apoptosis =
    nonNeutral >= LIFECYCLE_CONFIG.apoptosisMinActivations &&
    newSuccessRate !== null &&
    newSuccessRate < LIFECYCLE_CONFIG.apoptosisThreshold;

  const autoDelete = apoptosis && entry.source !== "manual";

  // Evaluate maturity advancement (only if not being pruned)
  let newMaturity = entry.maturity;
  let transitionMessage: string | null = null;

  if (apoptosis) {
    if (autoDelete) {
      transitionMessage = `Apoptosis: auto-pruned (${helpful} helpful, ${harmful} harmful, rate ${newSuccessRate!.toFixed(2)}, source: ${entry.source})`;
    } else {
      transitionMessage = `Apoptosis candidate: flagged for review (${helpful} helpful, ${harmful} harmful, rate ${newSuccessRate!.toFixed(2)}, source: manual)`;
    }
  } else if (newSuccessRate !== null && newSuccessRate >= LIFECYCLE_CONFIG.advanceMinSuccessRate) {
    if (entry.maturity === "progenitor" && helpful >= LIFECYCLE_CONFIG.provenMinHelpful) {
      newMaturity = "proven";
      transitionMessage = `Promoted: progenitor → proven (${helpful} helpful, rate ${newSuccessRate.toFixed(2)})`;
    } else if (entry.maturity === "proven" && helpful >= LIFECYCLE_CONFIG.matureMinHelpful) {
      newMaturity = "mature";
      transitionMessage = `Promoted: proven → mature (${helpful} helpful, rate ${newSuccessRate.toFixed(2)})`;
    }
  }

  return { newSuccessRate, newMaturity, apoptosis, autoDelete, transitionMessage };
}

/**
 * Maturity boost multiplier for ob_recall ranking.
 * Applied to BM25 weighted_rank (lower = better match, so we divide by boost).
 */
export function maturityBoost(maturity: Maturity, successRate: number | null): number {
  let boost = 1.0;
  if (maturity === "mature") boost = LIFECYCLE_CONFIG.matureBoost;
  else if (maturity === "proven") boost = LIFECYCLE_CONFIG.provenBoost;

  // Penalty for low success rate (but not yet at apoptosis)
  if (successRate !== null && successRate < LIFECYCLE_CONFIG.apoptosisThreshold) {
    boost *= LIFECYCLE_CONFIG.lowSuccessPenalty;
  }

  return boost;
}

/**
 * SQL ranking expression for ob_recall, built from LIFECYCLE_CONFIG so the
 * query and maturityBoost() cannot drift apart.
 *
 * bm25() is NEGATIVE and more-negative means a better match, and the query
 * sorts ASCENDING. So a factor that should IMPROVE rank must make the value
 * more negative (multiply), and a factor that should DEMOTE must make it less
 * negative (divide).
 */
export function recallRankExpr(alias = "k"): string {
  const c = LIFECYCLE_CONFIG;
  const maturity =
    `(CASE ${alias}.maturity ` +
    `WHEN 'mature' THEN ${c.matureBoost} ` +
    `WHEN 'proven' THEN ${c.provenBoost} ` +
    `ELSE 1.0 END)`;
  const penalty =
    `(CASE WHEN ${alias}.success_rate IS NOT NULL ` +
    `AND ${alias}.success_rate < ${c.apoptosisThreshold} ` +
    `THEN ${c.lowSuccessPenalty} ELSE 1.0 END)`;
  // Exact tag-token match: normalize "a, b, failure" to ",a,b,failure," so we
  // match ",failure," and not substrings like "failures" or "no-failure".
  const failure =
    `(CASE WHEN ',' || REPLACE(COALESCE(${alias}.tags, ''), ' ', '') || ',' ` +
    `LIKE '%,failure,%' THEN ${c.failureBoost} ELSE 1.0 END)`;
  const ageDays = `MAX(0, julianday('now') - julianday(${alias}.created_at))`;
  const recency = `(1.0 + ${ageDays} * ${c.recencyDecayPerDay})`;

  // Divide by the recency term: older entries get a larger divisor, pulling the
  // (negative) score toward zero so they sort later. Multiplying here — as the
  // original expression did — inverted this and promoted stale knowledge.
  return `(bm25(knowledge_fts) * ${maturity} * ${penalty} * ${failure} / ${recency})`;
}
