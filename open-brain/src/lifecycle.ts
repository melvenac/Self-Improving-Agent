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

/**
 * `archived_into` value for an entry retired with no successor.
 *
 * The column was designed for merges — "this entry was folded into entry N" —
 * so every live-row filter reads `archived_into IS NULL` and the dream pipeline
 * treats a non-NULL value as "already resolved". Apoptosis has no successor to
 * point at, but it still needs a non-NULL value or the row stays live.
 *
 * Zero is not a valid `knowledge_index.id` (AUTOINCREMENT starts at 1), so it
 * cannot collide with a real merge target, and it satisfies every existing
 * `IS NULL` filter without touching one of them.
 */
export const ARCHIVED_NO_SUCCESSOR = 0;

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
 * The subset of LIFECYCLE_CONFIG that shapes recall ranking.
 *
 * Widened to `number` on purpose: LIFECYCLE_CONFIG is `as const`, so deriving
 * this with Pick<> would give literal types (`0.005`, `1.5`) and reject every
 * override a shadow strategy exists to supply.
 */
export type RankConfig = Record<
  | "matureBoost"
  | "provenBoost"
  | "lowSuccessPenalty"
  | "apoptosisThreshold"
  | "recencyDecayPerDay"
  | "failureBoost",
  number
>;

/**
 * SQL ranking expression for ob_recall, built from LIFECYCLE_CONFIG so the
 * query and maturityBoost() cannot drift apart.
 *
 * bm25() is NEGATIVE and more-negative means a better match, and the query
 * sorts ASCENDING. So a factor that should IMPROVE rank must make the value
 * more negative (multiply), and a factor that should DEMOTE must make it less
 * negative (divide).
 *
 * `overrides` exists so the shadow-recall harness can evaluate alternative
 * weightings without a second ranking implementation — a strategy that does not
 * share this code path measures something users never see. Overrides are merged
 * into a fresh object; LIFECYCLE_CONFIG is never mutated.
 */
/**
 * SQL predicate for entries flagged for apoptosis but still present.
 *
 * `evaluateLifecycle` reports "Apoptosis candidate: flagged for review" in the
 * single `ob_feedback` response that crosses the threshold, and nothing records
 * it: no column changes, `archived_into` stays NULL. So "flagged for approval"
 * described a review step whose queue could not be listed. Derived rather than
 * stored, because the inputs are already columns and a stored flag would be a
 * second source of truth that can fall out of step with them.
 *
 * Only `source = 'manual'` can appear: everything else is auto-pruned on the
 * rating that crosses the threshold, so a surviving candidate is manual by
 * construction. Built from LIFECYCLE_CONFIG so this and evaluateLifecycle
 * cannot drift — and note it counts `helpful + harmful`, excluding neutral,
 * matching `nonNeutral` there.
 */
export function apoptosisFlaggedExpr(alias = "k"): string {
  return `${alias}.source = 'manual' AND ${lowSuccessExpr(alias)}`;
}

/**
 * SQL predicate for "has been judged enough times to be judged at all".
 *
 * Counts `helpful + harmful` and excludes neutral, matching `nonNeutral` in
 * `evaluateLifecycle`. Extracted because it was written out twice with two
 * different arithmetics: `db-v2.ts` gated on `helpful + harmful + neutral`,
 * so `ob_stats` reported on a population 2.4x the one the pruner would act on
 * (56 entries vs 23 in the 2026-09-01 snapshot). Both surfaces returned zero,
 * which is why the disagreement went unseen — and both zeros were the
 * structurally-unreachable kind, not the healthy kind.
 */
export function apoptosisGateExpr(alias = "k"): string {
  return `(${alias}.helpful + ${alias}.harmful) >= ${LIFECYCLE_CONFIG.apoptosisMinActivations}`;
}

/**
 * SQL predicate for "rated badly enough to be an apoptosis candidate",
 * independent of `source`.
 *
 * The review queue adds `source = 'manual'` on top of this; the health stats
 * count every entry regardless of source. Those are legitimately different
 * questions, but they must not disagree about the gate arithmetic or the
 * threshold, which is why both are built from here.
 */
export function lowSuccessExpr(alias = "k"): string {
  return (
    `${alias}.success_rate IS NOT NULL ` +
    `AND ${alias}.success_rate < ${LIFECYCLE_CONFIG.apoptosisThreshold} ` +
    `AND ${apoptosisGateExpr(alias)}`
  );
}

export interface ApoptosisCandidate {
  id: number;
  key: string | null;
  helpful: number;
  harmful: number;
  success_rate: number;
}

/**
 * Render the apoptosis review queue as report lines — **including at zero**.
 *
 * v0.14.0 printed this block only when the queue was non-empty, so an empty
 * queue and a server too old to have the block at all produced byte-identical
 * output. That is the same "absence is indistinguishable from success" shape
 * the block was added to fix, reintroduced by the fix itself. The count line is
 * therefore unconditional; only the per-entry detail and the removal hint are
 * gated, because those genuinely have nothing to say at zero.
 */
export function formatApoptosisQueue(rows: ApoptosisCandidate[], limit = 10): string[] {
  const lines = [``, `Apoptosis candidates awaiting review: ${rows.length}`];
  for (const r of rows.slice(0, limit)) {
    lines.push(`  [${r.id}] ${r.key ?? "no key"} — ${r.helpful} helpful, ${r.harmful} harmful, rate ${r.success_rate.toFixed(2)}`);
  }
  if (rows.length > limit) lines.push(`  ... +${rows.length - limit} more`);
  if (rows.length > 0) {
    lines.push(`  Manual entries are never auto-pruned. Use ob_forget to remove one (its note moves to Archive/).`);
  }
  return lines;
}

export function recallRankExpr(alias = "k", overrides: Partial<RankConfig> = {}): string {
  const c: RankConfig = { ...LIFECYCLE_CONFIG, ...overrides };
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
