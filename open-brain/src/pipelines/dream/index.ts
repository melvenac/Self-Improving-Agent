import type Database from "better-sqlite3";
import type { KnowledgeIndexRow } from "../../db-v2.js";
import { classify } from "./classify.js";
import { buildReport } from "./report.js";
import { findDuplicates, findMisfiled, findObsoleteReferences, findSuperseded } from "./rules.js";
import { listSessionTranscripts } from "./transcripts.js";
import type { Candidate, DreamReport, FactKind } from "./types.js";

/**
 * `dream` — the deterministic leg.
 *
 * Loads stored knowledge, runs every rule that ships, and hands the union to
 * `buildReport`. No writes: the CLI's `--dry-run` default is enforced by this
 * module having no mutation path at all rather than by a flag being checked
 * correctly, which is the difference between a guarantee and an intention.
 *
 * ## What runs, and what does not
 *
 * `findStale` is built and tested but **deliberately not called**. The
 * 2026-08-04 corpus audit read all 332 entries and found that disuse does not
 * discriminate: the one genuinely harmful entry had zero recalls, and so did
 * ~130 sound ones. Shipping it would bury the real findings under false
 * positives. The code stays as a record of that measurement — deleting it would
 * invite someone to rediscover the idea and reach the same dead end.
 *
 * ## Entry-based, for now
 *
 * Every rule here reads `knowledge_index`. `transcripts.ts` is built and tested,
 * but the two rules that would consume it (`correction`, `unstored`) are not
 * written, so transcripts are read only to report which sessions the window
 * covered.
 *
 * That is also why there is no processed-session ledger yet: rules over an
 * unchanged corpus are idempotent by construction, so a repeat run converges
 * without one. `correction` will need it, since a transcript once reconciled
 * should not be re-proposed forever.
 */

export interface DreamOptions {
  db: Database.Database;
  /** Evaluation time, injected so a run is reproducible. */
  now: Date;
  /** Lower bound of the transcript window. */
  since: Date;
  /** Per-kind cap in the report. */
  maxPerKind?: number;
  minConfidence?: number;
  /** Transcript root override, for tests. */
  transcriptsRoot?: string;
}

export interface DreamResult {
  report: DreamReport;
  /** How the corpus splits by fact kind — the headline number for this pass. */
  kindCensus: KindCensus;
}

export interface KindCensus {
  state: number;
  event: number;
  unclassified: number;
  /** Of the classified, how many carry a recorded label rather than an inferred one. */
  recorded: number;
}

export function runDream(options: DreamOptions): DreamResult {
  const entries = loadLiveEntries(options.db);

  const candidates: Candidate[] = [
    ...findDuplicates(entries),
    ...findObsoleteReferences(entries),
    ...findMisfiled(entries),
    ...findSuperseded(entries),
    // findStale — see the note above. Not called.
  ];

  // Transcripts are enumerated for the report's window record only; no rule
  // reads their contents yet.
  const sessions = listSessionTranscripts({
    sinceMs: options.since.getTime(),
    root: options.transcriptsRoot,
  });

  const report = buildReport({
    candidates,
    generatedAt: options.now.toISOString(),
    since: options.since.toISOString(),
    sessionsExamined: sessions.map((s) => s.sessionId),
    entriesExamined: entries.length,
    maxPerKind: options.maxPerKind,
    minConfidence: options.minConfidence,
  });

  return { report, kindCensus: censusByKind(entries) };
}

/**
 * Live entries only — archived rows are already resolved, and every rule filters
 * them anyway. Doing it in SQL keeps the quadratic rules off rows that can never
 * produce a candidate.
 */
export function loadLiveEntries(db: Database.Database): KnowledgeIndexRow[] {
  return db
    .prepare(`SELECT * FROM knowledge_index WHERE archived_into IS NULL ORDER BY id`)
    .all() as KnowledgeIndexRow[];
}

/**
 * The state/event split across the corpus.
 *
 * Reported alongside the candidates because it is the number that says whether
 * to trust them: a classifier calling almost nothing `state` produces almost no
 * state-pair proposals, and a report of zero would otherwise read as a clean
 * corpus rather than as a silent classifier.
 */
export function censusByKind(entries: KnowledgeIndexRow[]): KindCensus {
  const census: KindCensus = { state: 0, event: 0, unclassified: 0, recorded: 0 };
  for (const e of entries) {
    if (e.fact_kind === "state" || e.fact_kind === "event") {
      census[e.fact_kind as FactKind]++;
      census.recorded++;
      continue;
    }
    const inferred = classify(e);
    if (inferred.kind === null) census.unclassified++;
    else census[inferred.kind]++;
  }
  return census;
}
