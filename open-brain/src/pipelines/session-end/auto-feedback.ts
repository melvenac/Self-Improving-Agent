import type {
  FeedbackRating,
  FeedbackResult,
  AutoFeedbackResult,
  KnowledgeStore,
} from "./types.js";

/**
 * Returns true if ANY tag (comma-separated) appears in the summary (case-insensitive).
 */
export function matchTagsInSummary(tags: string, summary: string): boolean {
  if (!tags || !summary) return false;
  const tagList = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tagList.length === 0) return false;
  const lowerSummary = summary.toLowerCase();
  return tagList.some((tag) => lowerSummary.includes(tag.toLowerCase()));
}

/**
 * Evaluate maturity lifecycle transitions and apoptosis.
 *
 * Thresholds:
 *   Progenitor → Proven:  helpfulCount >= 3 AND successRate >= 0.5
 *   Proven → Mature:      helpfulCount >= 7
 *   Apoptosis:            source !== "manual" AND (helpful + harmful) >= 5 AND successRate < 0.3
 */
export function evaluateLifecycle(
  currentMaturity: string,
  helpfulCount: number,
  harmfulCount: number,
  successRate: number,
  source: string = "agent"
): { maturity: string; apoptosis: boolean } {
  // Apoptosis check (applies regardless of promotion path)
  const totalRated = helpfulCount + harmfulCount;
  const apoptosis =
    source !== "manual" && totalRated >= 5 && successRate < 0.3;

  let maturity = currentMaturity;

  if (currentMaturity === "Progenitor") {
    if (helpfulCount >= 3 && successRate >= 0.5) {
      maturity = "Proven";
    }
  } else if (currentMaturity === "Proven") {
    if (helpfulCount >= 7) {
      maturity = "Mature";
    }
  }
  // Mature stays Mature

  return { maturity, apoptosis };
}

/**
 * Run auto-feedback for a session:
 *   - For each recalled entry, match its tags against the session summary
 *   - Tag match → "helpful", no match → "neutral"
 *   - Update the store, re-read counters, evaluate lifecycle
 */
export function autoFeedback(
  recalledEntryIds: number[],
  sessionSummary: string,
  store: KnowledgeStore
): AutoFeedbackResult {
  const ratings: FeedbackResult[] = [];
  const errors: string[] = [];

  for (const id of recalledEntryIds) {
    const entry = store.getEntry(id);
    if (!entry) {
      errors.push(`Entry ${id} not found`);
      continue;
    }

    const maturityBefore = entry.maturity;
    const rating: FeedbackRating = matchTagsInSummary(
      entry.tags,
      sessionSummary
    )
      ? "helpful"
      : "neutral";

    store.updateFeedback(id, rating);

    const counters = store.getEntryCounters(id);
    if (!counters) {
      errors.push(`Could not read counters for entry ${id}`);
      continue;
    }

    const { maturity: maturityAfter, apoptosis } = evaluateLifecycle(
      counters.maturity,
      counters.helpful_count,
      counters.harmful_count,
      counters.success_rate,
      entry.source
    );

    ratings.push({
      entryId: id,
      key: entry.key,
      rating,
      maturityBefore,
      maturityAfter,
      apoptosis,
    });
  }

  return {
    processed: ratings.length,
    ratings,
    errors,
  };
}
