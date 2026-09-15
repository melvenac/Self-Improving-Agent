// Recall ranking — the expression ob_recall orders by.

/**
 * Loop 10 C2 — the maturity lifecycle (E3), apoptosis (E18) and `success_rate`
 * (E4b) are gone from this file, and the as-of replay they fed (E9b) with them.
 *
 * Loop 8 R1 had suspended the first two behind flags. This loop ruled on six
 * months of their operation rather than on their design:
 *
 * - **Apoptosis never fired.** `archived_into` non-null: 0 rows. Not "rarely" —
 *   never, in the entire history of the corpus.
 * - **`success_rate` cannot discriminate.** It is `helpful / (helpful + harmful)`,
 *   which excludes neutral — and neutral is 446 of 615 ratings, 72.5%. It reads
 *   1.0 for almost everything ever rated, so it measured recall volume rather
 *   than usefulness. A number that cannot be false is not evidence, and a
 *   component emitting one cannot be kept on the strength of that path.
 * - **The maturity boosts had been at 1.0 since Loop 8**, so removing them is
 *   behaviour-preserving rather than a change to what recall returns.
 *
 * SUSPENDED, not CUT — the deletion is how suspension is expressed, because a
 * flag gates code deterministically but dormant code is a KEEP wearing a CUT's
 * label. What makes it a suspension is that the reviving observation is written
 * down and the text is recoverable.
 *
 * **REVIVING OBSERVATION: a replacement for `success_rate` that discriminates** —
 * one whose denominator accounts for neutral, or a different signal entirely.
 *
 * **If that trigger fires, E9b must be restored in the same change.** Restoring
 * maturity-weighted ranking restores the confound the as-of replay existed to
 * remove; evaluating the new ranking without it measures that ranking with the
 * evaluating session's own feedback inside it. A revival that omits E9b is not a
 * partial revival, it is one that cannot be honestly measured.
 *
 * Recover the deleted code at `bfee8c0:open-brain/src/lifecycle.ts`.
 */
export const LIFECYCLE_CONFIG = {
  /** Per-day recency decay applied to recall ranking */
  recencyDecayPerDay: 0.005,
  /** Recall ranking multiplier for entries tagged 'failure' */
  failureBoost: 1.3,
} as const;

/**
 * Widened to `number` on purpose: LIFECYCLE_CONFIG is `as const`, so deriving
 * this with Pick<> would give literal types and reject every override a shadow
 * strategy exists to supply.
 */
export type RankConfig = Record<"recencyDecayPerDay" | "failureBoost", number>;

/**
 * The stored maturity label. Nothing computes it any more — E3's promotion
 * engine is gone — but the column still holds what it held, and `ob_list` and
 * the vault frontmatter still display it. Kept as a type so those readers stay
 * honest about what they are reading: a value last written before Loop 10.
 */
export type Maturity = "progenitor" | "proven" | "mature";

/**
 * A feedback rating. The ratings path (E4) is KEEP — recording what an agent
 * judged is sound and stays. What was cut is `success_rate`, the derived number
 * built from these that excluded neutral from its own denominator.
 */
export type Rating = "helpful" | "harmful" | "neutral";

export function asOfLiteral(asOf?: string | null): string {
  if (asOf === undefined || asOf === null) return `'now'`;
  if (!/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/.test(asOf)) {
    throw new Error(`asOfLiteral: expected an ISO-8601 timestamp, got ${JSON.stringify(asOf)}`);
  }
  return `'${asOf}'`;
}

/**
 * SQL ranking expression for ob_recall, built from LIFECYCLE_CONFIG so the
 * shadow harness can sweep the same constants production reads.
 */
export function recallRankExpr(
  alias = "k",
  overrides: Partial<RankConfig> = {},
  asOf?: string | null,
): string {
  const c: RankConfig = { ...LIFECYCLE_CONFIG, ...overrides };
  // Exact tag-token match: normalize "a, b, failure" to ",a,b,failure," so we
  // match ",failure," and not substrings like "failures" or "no-failure".
  const failure =
    `(CASE WHEN ',' || REPLACE(COALESCE(${alias}.tags, ''), ' ', '') || ',' ` +
    `LIKE '%,failure,%' THEN ${c.failureBoost} ELSE 1.0 END)`;
  const ageDays = `MAX(0, julianday(${asOfLiteral(asOf)}) - julianday(${alias}.created_at))`;
  const recency = `(1.0 + ${ageDays} * ${c.recencyDecayPerDay})`;

  // Divide by the recency term: older entries get a larger divisor, pulling the
  // (negative) score toward zero so they sort later. Multiplying here — as the
  // original expression did — inverted this and promoted stale knowledge.
  return `(bm25(knowledge_fts) * ${failure} / ${recency})`;
}
