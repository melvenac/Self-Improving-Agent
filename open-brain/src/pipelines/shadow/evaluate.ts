// Shadow-recall evaluation.
//
// Replays a session's own queries under every ranking strategy and scores each
// against the relevance labels that same session assigned at /end.
//
// WHY SESSION-LOCAL LABELS: the v1 harness scored a strategy by how many of its
// results already carried positive feedback. That is backwards. Ratings accrue
// to entries that have been recalled before, so the metric rewards resurfacing
// old, frequently-recalled knowledge — it would have scored the age-inverted
// ranking bug as an improvement over the fix. Scoring only against ratings from
// the session being replayed removes that feedback loop.
//
// KNOWN LIMITATION — presentation bias: labels exist only for entries the live
// ranking actually showed the agent. A variant that surfaces a genuinely useful
// entry production never displayed scores it as unlabeled, not as a win. So
// these metrics compare re-orderings of a shared candidate pool; they cannot
// discover relevance that was never presented.
//
// The bias is ASYMMETRIC and favours the incumbent: every labeled entry is by
// construction something `live` returned, so `live` starts with more of its
// results labeled than any variant (observed 7/15 vs 4-6/15 on real data).
// Read results accordingly:
//   - a variant BEATING live is strong evidence, since it wins despite the handicap
//   - a variant merely tying or losing is weak evidence, and does not establish
//     that live is better
// This is why formatShadowReport only ever names a "candidate" and leaves the
// decision to the maintainer.

import type Database from "better-sqlite3";
import { recallRankExpr } from "../../lifecycle.js";
import { sanitizeFtsQuery, broadenFtsQuery } from "../../shared/fts.js";
import { getSessionQueries, getSessionLabels, type ShadowRating } from "../../db-v2.js";
import { SHADOW_STRATEGIES, type ShadowStrategy } from "./strategies.js";

export interface QueryResult {
  query: string;
  /** Knowledge ids in ranked order. */
  ids: number[];
}

export interface StrategyScore {
  strategy: string;
  /** Reciprocal rank of the first helpful entry, averaged over queries. */
  mrr: number;
  /** nDCG@k with gain 1 for helpful, 0 otherwise. */
  ndcg: number;
  /** Share of returned entries rated helpful. */
  precision: number;
  /** Count of harmful-rated entries returned. Lower is better. */
  harmful: number;
  /** How many returned entries carried any label — the honest sample size. */
  labeled: number;
  /** Total entries returned across all queries. */
  returned: number;
}

export interface SessionEvaluation {
  sessionUuid: string;
  queries: string[];
  /** Entries this session rated, by rating. */
  labelCounts: Record<ShadowRating, number>;
  scores: StrategyScore[];
  /** Set when the session cannot be scored; scores will be empty. */
  skipped?: string;
}

/**
 * Run one query under one ranking expression.
 *
 * Mirrors ob_recall: same MATCH construction, same archived filter, same
 * AND-then-OR broadening. Deliberately does NOT touch recall_count or
 * last_recalled_at — a shadow run must leave no trace in live statistics.
 */
export function runStrategyQuery(
  db: Database.Database,
  query: string,
  strategy: ShadowStrategy,
  limit: number,
): number[] {
  const sql = `
    SELECT k.id, ${recallRankExpr("k", strategy.overrides)} AS weighted_rank
    FROM knowledge_fts
    JOIN knowledge_index k ON k.id = knowledge_fts.rowid
    WHERE knowledge_fts MATCH ?
    AND k.archived_into IS NULL
    ORDER BY weighted_rank
    LIMIT ?
  `;
  const run = (matchExpr: string) =>
    db.prepare(sql).all(matchExpr, limit) as Array<{ id: number }>;

  let rows: Array<{ id: number }>;
  try {
    rows = run(sanitizeFtsQuery(query));
  } catch {
    return []; // malformed FTS expression — same failure mode as live recall
  }

  if (rows.length < limit) {
    const orQuery = broadenFtsQuery(query);
    if (orQuery) {
      const seen = new Set(rows.map((r) => r.id));
      try {
        for (const row of run(orQuery)) {
          if (rows.length >= limit) break;
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          rows.push(row);
        }
      } catch { /* keep the precise results */ }
    }
  }

  return rows.map((r) => r.id);
}

/** Ideal DCG for n relevant items — the normaliser for nDCG. */
function idealDcg(relevantCount: number, k: number): number {
  let ideal = 0;
  for (let i = 0; i < Math.min(relevantCount, k); i++) {
    ideal += 1 / Math.log2(i + 2);
  }
  return ideal;
}

export function scoreStrategy(
  strategy: string,
  results: QueryResult[],
  labels: Map<number, ShadowRating>,
): StrategyScore {
  const helpfulTotal = [...labels.values()].filter((r) => r === "helpful").length;

  let mrrSum = 0;
  let ndcgSum = 0;
  let helpfulHits = 0;
  let harmful = 0;
  let labeled = 0;
  let returned = 0;

  for (const { ids } of results) {
    let dcg = 0;
    let firstHelpfulRank = 0;

    ids.forEach((id, i) => {
      returned++;
      const label = labels.get(id);
      if (!label) return;
      labeled++;
      if (label === "harmful") harmful++;
      if (label !== "helpful") return;

      helpfulHits++;
      dcg += 1 / Math.log2(i + 2);
      if (firstHelpfulRank === 0) firstHelpfulRank = i + 1;
    });

    mrrSum += firstHelpfulRank > 0 ? 1 / firstHelpfulRank : 0;
    const ideal = idealDcg(helpfulTotal, ids.length);
    ndcgSum += ideal > 0 ? dcg / ideal : 0;
  }

  const n = results.length || 1;
  return {
    strategy,
    mrr: mrrSum / n,
    ndcg: ndcgSum / n,
    precision: returned > 0 ? helpfulHits / returned : 0,
    harmful,
    labeled,
    returned,
  };
}

export interface EvaluateOptions {
  limit?: number;
  strategies?: ShadowStrategy[];
}

export function evaluateSession(
  db: Database.Database,
  sessionUuid: string,
  options: EvaluateOptions = {},
): SessionEvaluation {
  const limit = options.limit ?? 5;
  const strategies = options.strategies ?? SHADOW_STRATEGIES;

  const queries = getSessionQueries(db, sessionUuid);
  const labels = getSessionLabels(db, sessionUuid);

  const labelCounts: Record<ShadowRating, number> = { helpful: 0, harmful: 0, neutral: 0 };
  for (const rating of labels.values()) labelCounts[rating]++;

  const base: SessionEvaluation = { sessionUuid, queries, labelCounts, scores: [] };

  if (queries.length === 0) return { ...base, skipped: "no logged queries" };
  // Without at least one helpful label every strategy scores identically zero,
  // which reads as a tie and is worse than reporting nothing.
  if (labelCounts.helpful === 0) return { ...base, skipped: "no helpful ratings to score against" };

  const scores = strategies.map((strategy) => {
    const results = queries.map((query) => ({
      query,
      ids: runStrategyQuery(db, query, strategy, limit),
    }));
    return scoreStrategy(strategy.name, results, labels);
  });

  return { ...base, scores };
}
