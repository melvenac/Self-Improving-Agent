/**
 * The trigger's query path — precision only, floor below, nothing under it.
 *
 * This module is the one thing the trigger and the store have in common, and
 * it is deliberately NOT `ob_recall`. Brief §2 deliverable 2 and ruling 4:
 * `ob_recall`'s handler broadens a conjunctive query to `OR` whenever the
 * precise attempt underfills, which is right for an agent that asked a
 * question and wrong for a channel nobody asked. An agent reading a weak hit
 * it requested discounts it; an agent handed a weak hit it did not request
 * learns to ignore the channel. So: no broadening here, ever, and below the
 * relevance floor the answer is nothing rather than the best of a bad set.
 *
 * Boundaries this module holds (brief §3):
 *   - it imports nothing from `src/harness/`, and nothing there imports it;
 *   - it never writes to the record (`.agents/state.json` is `ob_state`'s);
 *   - the store is opened read-only by the caller for this path — the fire
 *     record is a separate write, on its own connection, in its own table.
 *
 * STATUS: skeleton. `deriveQuery` and `queryStore` are stubs so that A1's test
 * fails on its ASSERTION rather than on module resolution — a red that names
 * the missing behaviour is worth more than one that names a missing file.
 * The first commit of this loop is that test failing.
 */

import type Database from "better-sqlite3";

/** One entry the trigger's query found, in the order the trigger ranked it. */
export interface TriggerHit {
  id: number;
  key: string | null;
  content: string;
  /** Lower is better, as FTS5 `rank` and `recallRankExpr` both are. */
  score: number;
}

export interface TriggerQueryInput {
  /** Opened by the caller; this path only reads. */
  db: Database.Database;
  /** The Bash command text, exactly as it appeared in the tool input. */
  command: string;
  /**
   * The relevance floor. A policy value, never a literal in the query code
   * (ruling 5) — the caller reads it from data and passes it here.
   */
  floor: number;
  /** Hits to consider before the floor is applied. */
  limit?: number;
}

/**
 * Turn a command into an FTS query, by code and by code alone.
 *
 * Deterministic and local (ruling 7): no model call, no network, no key. The
 * derivation is a pure function of the command text, which is what makes the
 * whole channel reproducible from a transcript.
 */
export function deriveQuery(_command: string): string {
  return "";
}

/**
 * Query the store for a command, precision only, floor applied.
 *
 * Returns the empty array when nothing clears the floor — and the caller
 * injects nothing at all in that case rather than saying it found nothing
 * (ruling 3: silent means silent).
 */
export function queryStore(_input: TriggerQueryInput): TriggerHit[] {
  return [];
}
