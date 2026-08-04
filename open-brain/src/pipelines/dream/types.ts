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
  | "stale"
  | "correction"
  | "unstored";

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

export interface DreamReport {
  /** ISO timestamp, passed in rather than read from the clock, so runs are reproducible. */
  generatedAt: string;
  /** Lower bound of the window examined. */
  since: string;
  sessionsExamined: string[];
  candidates: Candidate[];
}
