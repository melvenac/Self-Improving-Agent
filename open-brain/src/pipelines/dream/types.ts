/**
 * `dream` — cross-session memory reconciliation.
 *
 * Design: `.agents/SYSTEM/dream-design.md`.
 *
 * The pass reads recent session transcripts, compares them against stored
 * memory, and proposes corrections. It exists to catch what in-band memory
 * writes structurally cannot — patterns *across* sessions. session-end already
 * handles within-session capture; this is reconciliation.
 */

/** A single conversational turn, the unit evidence is quoted from. */
export interface TranscriptTurn {
  /** Session UUID — the transcript filename, and the id used in Summaries/. */
  sessionId: string;
  /** Project directory name under ~/.claude/projects. */
  project: string;
  /** 1-based line number in the .jsonl. Half of an evidence anchor. */
  line: number;
  role: "user" | "assistant";
  text: string;
}

export interface SessionTranscript {
  sessionId: string;
  project: string;
  path: string;
  mtimeMs: number;
  turns: TranscriptTurn[];
}

/** Enough to locate and order a transcript without parsing its contents. */
export interface TranscriptRef {
  sessionId: string;
  project: string;
  path: string;
  mtimeMs: number;
}

export type CandidateKind =
  | "duplicate"
  | "contradiction"
  /**
   * Cites infrastructure that no longer exists. Preferred over inferring
   * worthlessness from disuse: recall was broken until July 2026, so a low
   * recall count may mean an entry was unfindable rather than unwanted. A
   * missing file is checkable; disuse is not.
   */
  | "obsolete-reference"
  /**
   * A state fact whose current value is recorded somewhere else, leaving two
   * live answers to one question.
   *
   * Distinct from `duplicate` on one axis: a duplicate says the *same* thing
   * twice, a supersession says a *different* thing about the same subject. High
   * subject overlap with low content overlap separates them.
   */
  | "superseded"
  /**
   * Filed in the wrong store. A different axis from everything else here —
   * nothing is wrong with the content, it is the location that contradicts
   * policy, so the fix is a move rather than a rewrite.
   */
  | "misfiled"
  | "stale"
  | "correction"
  | "unstored";

/**
 * Re-exported from the schema layer, where the column lives.
 *
 * `db-v2.ts` owns the definition because `knowledge_index.fact_kind` is what
 * makes it real; a pipeline importing downward is the right direction, and the
 * reverse would leave the schema depending on one of its consumers.
 */
export type { FactKind } from "../../db-v2.js";

/**
 * A verbatim quote plus the location it came from.
 *
 * No candidate may be raised without one. A proposal a human cannot check is a
 * proposal they can only accept on trust, which defeats the review step — so
 * evidence is required by the type, not by convention.
 *
 * Two origins, because not every candidate comes from a conversation:
 * `correction` and `unstored` are read out of transcripts, while `duplicate`
 * and `stale` are derived from what is already stored and have no transcript
 * line to point at. Both still have to say where they came from.
 */
export type Evidence =
  | { source: "transcript"; sessionId: string; line: number; quote: string }
  | { source: "entry"; entryId: number; key: string | null; quote: string };

export interface Candidate {
  kind: CandidateKind;
  /** Rows in knowledge_index this concerns. Empty for `unstored`. */
  targetIds: number[];
  /** Human-readable statement of what is being proposed and why. */
  summary: string;
  evidence: Evidence[];
  /** 0–1. Deterministic rules set this; the model may revise it. */
  confidence: number;
}

/**
 * What a capped section left out.
 *
 * A report that silently truncates reads as "this is everything", which is a
 * worse failure than a long report — the reader draws a conclusion the data
 * does not support. Anything dropped is counted here and stated in the output.
 */
export interface Omission {
  kind: CandidateKind;
  shown: number;
  omitted: number;
  /** Confidence of the highest-scoring candidate that did not make the cut. */
  highestOmittedConfidence: number;
}

export interface DreamReport {
  /** ISO timestamp, passed in rather than read from the clock, so runs are reproducible. */
  generatedAt: string;
  /** Lower bound of the window examined; "all" for a full-corpus audit. */
  since: string;
  sessionsExamined: string[];
  entriesExamined: number;
  candidates: Candidate[];
  omissions: Omission[];
}
