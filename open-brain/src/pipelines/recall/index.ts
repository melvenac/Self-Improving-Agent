import Database from 'better-sqlite3';
import { searchFts, getMetadata, recordRecall, type FtsResult, type KnowledgeIndexRow } from '../../db-v2.js';

export interface RecallResult {
  vault_path: string;
  key: string;
  content: string;
  score: number;
  maturity: string;
  helpful: number;
  harmful: number;
}

export type SCLookup = (query: string) => Promise<Array<{ note_path: string; content: string }>>;

export interface RecallInput {
  db: Database.Database;
  queries: string[];
  scLookup: SCLookup;
  limit: number;
}

interface RankedEntry {
  vault_path: string;
  score: number;
}

/**
 * Merges SC semantic results and FTS results, deduplicates by vault_path (highest score wins),
 * normalizes FTS BM25 ranks to 0-1, applies maturity + failure boosts, returns sorted array.
 */
export function mergeAndRank(
  scResults: Array<{ note_path: string; content: string }>,
  ftsResults: FtsResult[],
  metadata: Map<string, KnowledgeIndexRow>
): RankedEntry[] {
  const scores = new Map<string, number>();

  // SC results: treat as score 1.0 baseline (already semantic similarity)
  for (const r of scResults) {
    const existing = scores.get(r.note_path) ?? 0;
    scores.set(r.note_path, Math.max(existing, 1.0));
  }

  // FTS BM25: rank is negative, more negative = better match
  // Normalize to 0-1: find min (most negative) and max (least negative / 0)
  if (ftsResults.length > 0) {
    const ranks = ftsResults.map(r => r.rank);
    const minRank = Math.min(...ranks); // most negative = best
    const maxRank = Math.max(...ranks); // least negative = worst
    const range = maxRank - minRank; // positive or 0

    for (const r of ftsResults) {
      // normalized: 0 = worst, 1 = best
      const normalized = range === 0 ? 1.0 : (maxRank - r.rank) / range;
      const existing = scores.get(r.vault_path) ?? 0;
      scores.set(r.vault_path, Math.max(existing, normalized));
    }
  }

  // Apply maturity and failure boosts
  const result: RankedEntry[] = [];
  for (const [vault_path, baseScore] of scores) {
    const meta = metadata.get(vault_path);
    let score = baseScore;

    if (meta) {
      // Maturity boost
      if (meta.maturity === 'mature') {
        score *= 1.5;
      } else if (meta.maturity === 'proven') {
        score *= 1.2;
      }

      // Failure boost: entries tagged with type='failure'
      const tags = meta.tags ?? '';
      if (tags.split(',').map(t => t.trim()).includes('failure')) {
        score *= 1.3;
      }
    }

    result.push({ vault_path, score });
  }

  return result.sort((a, b) => b.score - a.score);
}

/**
 * Full recall pipeline: SC semantic search + FTS5 + metadata enrichment + maturity ranking.
 */
export async function recall(input: RecallInput): Promise<RecallResult[]> {
  const { db, queries, scLookup, limit } = input;

  // 1. SC lookup for each query
  const scResults: Array<{ note_path: string; content: string }> = [];
  for (const query of queries) {
    const results = await scLookup(query);
    scResults.push(...results);
  }

  // 2. FTS lookup for each query
  const ftsResults: FtsResult[] = [];
  for (const query of queries) {
    const results = searchFts(db, query);
    ftsResults.push(...results);
  }

  // 3. Collect unique paths from both sources
  const allPaths = new Set<string>();
  for (const r of scResults) allPaths.add(r.note_path);
  for (const r of ftsResults) allPaths.add(r.vault_path);

  // 4. Fetch metadata for all unique paths
  const metadata = new Map<string, KnowledgeIndexRow>();
  for (const path of allPaths) {
    const meta = getMetadata(db, path);
    if (meta) metadata.set(path, meta);
  }

  // 5. Merge and rank
  const ranked = mergeAndRank(scResults, ftsResults, metadata);

  // 6. Take top N
  const top = ranked.slice(0, limit);

  // 7. Build SC content lookup map
  const scContentMap = new Map<string, string>();
  for (const r of scResults) {
    if (!scContentMap.has(r.note_path)) {
      scContentMap.set(r.note_path, r.content);
    }
  }

  // 8. Build results with content + metadata
  const results: RecallResult[] = [];
  for (const entry of top) {
    const meta = metadata.get(entry.vault_path);
    const content = scContentMap.get(entry.vault_path) ?? meta?.key ?? '';

    results.push({
      vault_path: entry.vault_path,
      key: meta?.key ?? '',
      content,
      score: entry.score,
      maturity: meta?.maturity ?? 'progenitor',
      helpful: meta?.helpful ?? 0,
      harmful: meta?.harmful ?? 0,
    });

    // 9. Record recall
    recordRecall(db, entry.vault_path);
  }

  return results;
}
