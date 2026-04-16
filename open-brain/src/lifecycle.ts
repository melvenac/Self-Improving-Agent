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
 * Maturity boost multiplier for kb_recall ranking.
 * Applied to BM25 weighted_rank (lower = better match, so we divide by boost).
 */
export function maturityBoost(maturity: Maturity, successRate: number | null): number {
  let boost = 1.0;
  if (maturity === "mature") boost = 1.5;
  else if (maturity === "proven") boost = 1.2;

  // Penalty for low success rate (but not yet at apoptosis)
  if (successRate !== null && successRate < LIFECYCLE_CONFIG.apoptosisThreshold) {
    boost *= 0.5;
  }

  return boost;
}
