import type { Candidate, CandidateKind, DreamReport, Omission } from "./types.js";

/**
 * Assembling the report a human actually reads.
 *
 * The hard requirement is that the reader can trust the shape of what they are
 * shown. An uncapped list of 86 staleness proposals reads as noise and gets
 * ignored wholesale; a capped list that says nothing about the cap reads as
 * "this is everything" and produces a false sense of a clean corpus. Neither is
 * acceptable, so sections are capped *and* the omission is stated.
 */

export interface BuildReportInput {
  candidates: Candidate[];
  /** Passed in rather than read from the clock, so a run is reproducible. */
  generatedAt: string;
  /** Window lower bound, or "all" for a full-corpus audit. */
  since: string;
  sessionsExamined: string[];
  entriesExamined: number;
  /** Per-kind cap. Omit for no cap. */
  maxPerKind?: number;
  /** Candidates below this are dropped entirely, before capping. */
  minConfidence?: number;
}

export function buildReport(input: BuildReportInput): DreamReport {
  const minConfidence = input.minConfidence ?? 0;
  const byKind = new Map<CandidateKind, Candidate[]>();

  for (const c of input.candidates) {
    if (c.confidence < minConfidence) continue;
    const list = byKind.get(c.kind) ?? [];
    list.push(c);
    byKind.set(c.kind, list);
  }

  const candidates: Candidate[] = [];
  const omissions: Omission[] = [];

  for (const [kind, list] of byKind) {
    // Stable: confidence descending, then entry id, so two runs over unchanged
    // input produce byte-identical reports. Without the tiebreak, equal-scoring
    // candidates could swap places and make a no-op run look like a change.
    list.sort((a, b) => b.confidence - a.confidence || (a.targetIds[0] ?? 0) - (b.targetIds[0] ?? 0));

    const cap = input.maxPerKind ?? list.length;
    const shown = list.slice(0, cap);
    candidates.push(...shown);

    if (list.length > shown.length) {
      omissions.push({
        kind,
        shown: shown.length,
        omitted: list.length - shown.length,
        highestOmittedConfidence: list[shown.length].confidence,
      });
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence || (a.targetIds[0] ?? 0) - (b.targetIds[0] ?? 0));

  return {
    generatedAt: input.generatedAt,
    since: input.since,
    sessionsExamined: input.sessionsExamined,
    entriesExamined: input.entriesExamined,
    candidates,
    omissions,
  };
}

/** Plain-text rendering for a terminal or an overnight log. */
export function formatReport(report: DreamReport): string {
  const lines: string[] = [];
  lines.push(`dream — ${report.generatedAt}`);
  lines.push(
    `window: ${report.since} · ${report.sessionsExamined.length} session(s) · ${report.entriesExamined} entries`,
  );

  if (report.candidates.length === 0) {
    lines.push("");
    lines.push("No candidates. Nothing to reconcile.");
    return lines.join("\n");
  }

  const byKind = new Map<CandidateKind, Candidate[]>();
  for (const c of report.candidates) {
    const list = byKind.get(c.kind) ?? [];
    list.push(c);
    byKind.set(c.kind, list);
  }

  let n = 0;
  for (const [kind, list] of byKind) {
    lines.push("");
    lines.push(`## ${kind} (${list.length})`);
    for (const c of list) {
      n++;
      lines.push("");
      lines.push(`${n}. [${c.confidence.toFixed(2)}] ${c.summary}`);
      for (const e of c.evidence) {
        const where =
          e.source === "transcript"
            ? `${e.sessionId.slice(0, 8)}:${e.line}`
            : `entry ${e.entryId}`;
        lines.push(`     ${where} — "${e.quote}"`);
      }
    }
    const omission = report.omissions.find((o) => o.kind === kind);
    if (omission) {
      lines.push("");
      lines.push(
        `   … and ${omission.omitted} more ${kind} candidate(s) not shown ` +
          `(highest omitted confidence ${omission.highestOmittedConfidence.toFixed(2)}).`,
      );
    }
  }

  // Repeated at the end because a reader who scrolls to the bottom of a long
  // report should not have to have caught the per-section note to know the list
  // was truncated.
  if (report.omissions.length > 0) {
    const total = report.omissions.reduce((sum, o) => sum + o.omitted, 0);
    lines.push("");
    lines.push(`${total} candidate(s) omitted across ${report.omissions.length} section(s).`);
  }

  return lines.join("\n");
}
