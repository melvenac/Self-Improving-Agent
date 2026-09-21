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
 *   - it never writes to the store at all — this path reads.
 *
 * ## How a command becomes a query, and why not the obvious way
 *
 * The obvious derivation is "take the command's words and AND them", and it
 * is dead on arrival. FTS5 joins bare terms conjunctively, so the G-039
 * command `npx vitest run 2>&1 | tail -8; echo $?` would ask for an entry
 * containing *npx* AND *vitest* AND *run* AND *tail* AND *echo* — which
 * matches nothing in a real store, including the entry that describes that
 * exact mistake. The repair for that in `ob_recall` is to fall back to `OR`,
 * and that fallback is the one thing this path may not do.
 *
 * So the derivation is **narrow by construction rather than broad and then
 * filtered**: it recognises the risky ELEMENTS of a command and maps each to
 * the terms that name it, then ANDs those. Nothing else in the command
 * contributes. Two consequences worth stating plainly:
 *
 *   - **An unrecognised command derives no query at all**, and a trigger with
 *     no query injects nothing and says nothing. That is the fail-closed
 *     direction: the channel speaks only about acts it can name.
 *   - **The mapping is a fixed table in code, not a model call** (ruling 7).
 *     It is deterministic and local, so any fire is reproducible from the
 *     transcript alone.
 *
 * The table is small on purpose. This loop's observable is one act; a second
 * element is a later loop's evidence, not this one's speculation.
 */

import type Database from "better-sqlite3";

/** One entry the trigger's query found, in the order the trigger ranked it. */
export interface TriggerHit {
  id: number;
  key: string | null;
  content: string;
  /**
   * Relevance, HIGHER IS BETTER — the negation of FTS5's bm25, which is
   * negative and better the more negative it gets. Flipped here so that "the
   * floor is a minimum" reads the way a floor should, and so a policy file
   * never has to explain why a smaller number means a better match.
   */
  relevance: number;
}

export interface TriggerQueryInput {
  /** Opened by the caller; this path only reads. */
  db: Database.Database;
  /** The Bash command text, exactly as it appeared in the tool input. */
  command: string;
  /**
   * The relevance floor, as a minimum. A policy value, never a literal in the
   * query code (ruling 5) — the caller reads it from data and passes it here.
   */
  floor: number;
  /** Hits to consider before the floor is applied. */
  limit?: number;
}

/**
 * The recognised elements, and the terms each contributes.
 *
 * Read as: *when a command does THIS, the store is asked about THAT.* Each
 * entry is a shape this repo has an error about, not a shape that merely
 * exists.
 */
interface CommandElement {
  /** Why this element is risky — quoted into no output, kept for the reader. */
  readonly what: string;
  readonly test: (command: string) => boolean;
  readonly terms: readonly string[];
}

/**
 * A pipeline whose LAST stage trims output. `tail`, `head` and `grep` all
 * succeed on input they did not produce, so the pipeline's status stops being
 * the command's status.
 */
const TRIMMERS = ["tail", "head", "grep"] as const;

const lastPipelineStage = (command: string): string => {
  // Split on `|` but not `||`: a logical OR is not a pipeline stage.
  const stages = command.split(/\|\|/).pop()?.split("|") ?? [];
  return (stages.length > 1 ? stages[stages.length - 1] : "").trim();
};

const ELEMENTS: readonly CommandElement[] = [
  {
    what: "a pipeline whose last stage is a trimmer",
    test: (command) => {
      const last = lastPipelineStage(command);
      return TRIMMERS.some((t) => new RegExp(`(^|\\s)${t}(\\s|$)`).test(last));
    },
    terms: ["tail"],
  },
  {
    what: "a read of the shell's status variable",
    // `$?` and `${PIPESTATUS[n]}` are both status reads; only the first is a
    // mistake, and the entry that explains the difference is the one worth
    // surfacing for either.
    test: (command) => /\$\?|\$\{?PIPESTATUS/.test(command),
    terms: ["exit", "code"],
  },
];

/**
 * Turn a command into an FTS MATCH expression, by code and by code alone.
 *
 * Returns the empty string when nothing in the command is recognised — which
 * the caller must treat as "ask nothing", not as "ask for everything".
 */
export function deriveQuery(command: string): string {
  const terms: string[] = [];
  for (const element of ELEMENTS) {
    if (!element.test(command)) continue;
    for (const term of element.terms) if (!terms.includes(term)) terms.push(term);
  }
  // Conjunctive, always. The joiner is the whole difference between this path
  // and `ob_recall`'s fallback, so it is written once, here, and never
  // parameterised — a broadening mutant has to edit this line to exist.
  return terms.map((t) => `"${t.replace(/"/g, '""')}"`).join(" ");
}

/**
 * Query the store for a command, precision only, floor applied.
 *
 * Returns the empty array when nothing clears the floor — and the caller
 * injects nothing at all in that case rather than reporting that it found
 * nothing (ruling 3: silent means silent).
 */
export function queryStore(input: TriggerQueryInput): TriggerHit[] {
  const match = deriveQuery(input.command);
  if (!match) return [];

  const rows = input.db
    .prepare(
      `SELECT k.id, k.key, k.content, bm25(knowledge_fts) AS bm
         FROM knowledge_fts
         JOIN knowledge_index k ON k.id = knowledge_fts.rowid
        WHERE knowledge_fts MATCH ?
          AND k.archived_into IS NULL
        ORDER BY bm
        LIMIT ?`,
    )
    .all(match, input.limit ?? 5) as Array<{
    id: number;
    key: string | null;
    content: string;
    bm: number;
  }>;

  return rows
    .map((r) => ({ id: r.id, key: r.key, content: r.content, relevance: -r.bm }))
    .filter((h) => h.relevance >= input.floor);
}
