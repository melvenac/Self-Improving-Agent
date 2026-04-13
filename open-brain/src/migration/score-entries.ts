export interface EntryForScoring {
  helpful: number;
  harmful: number;
  neutral: number;
  recall_count: number;
  tags: string;
  content: string;
  maturity: string;
}

/**
 * Scores an old knowledge entry by value.
 *
 * Scoring rules:
 *   +2  Has feedback (helpful > 0)
 *   +2  Ever recalled (recall_count > 0)
 *   +1  Has meaningful tags (non-empty string)
 *   +1  Content length > 100 chars
 *   +3  Maturity above progenitor (proven or mature)
 *
 * Maximum possible score: 9
 */
export function scoreEntry(entry: EntryForScoring): number {
  let score = 0;

  if (entry.helpful > 0) score += 2;
  if (entry.recall_count > 0) score += 2;
  if (entry.tags && entry.tags.trim().length > 0) score += 1;
  if (entry.content && entry.content.length > 100) score += 1;
  if (entry.maturity && entry.maturity !== 'progenitor') score += 3;

  return score;
}

export interface ScoredEntry<T extends EntryForScoring> extends EntryForScoring {
  score: number;
  id: unknown;
  key: string;
}

export interface TriageResult<T extends EntryForScoring & { id: unknown; key: string }> {
  migrate: Array<T & { score: number }>;
  maybe: Array<T & { score: number }>;
  skip: Array<T & { score: number }>;
}

/**
 * Triages an array of entries into three buckets by score:
 *   migrate : score >= 3  (high value, auto-migrate)
 *   maybe   : score 1–2   (needs human review)
 *   skip    : score 0     (don't migrate)
 *
 * Each returned entry includes the computed `score` field.
 */
export function triageEntries<T extends EntryForScoring & { id: unknown; key: string }>(
  entries: T[]
): TriageResult<T> {
  const migrate: Array<T & { score: number }> = [];
  const maybe: Array<T & { score: number }> = [];
  const skip: Array<T & { score: number }> = [];

  for (const entry of entries) {
    const score = scoreEntry(entry);
    const scored = { ...entry, score };

    if (score >= 3) {
      migrate.push(scored);
    } else if (score >= 1) {
      maybe.push(scored);
    } else {
      skip.push(scored);
    }
  }

  return { migrate, maybe, skip };
}
