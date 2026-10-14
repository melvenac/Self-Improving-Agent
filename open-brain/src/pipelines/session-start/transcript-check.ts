import { existsSync } from "node:fs";
import type { ProvenSession } from "../../shared/process-session.js";
import { sessionTrailerIds, type TrailerIds } from "../../shared/handoff-guard.js";

/**
 * T-161: does a transcript exist for THIS session's own id? On 2026-09-20 one launch lost three seats' transcripts and
 * nothing said so until a later audit. The CLAUDE_CODE_CHILD_SESSION marker once blamed for it is carried by healthy
 * sessions too, so the file itself is the check. A missing transcript means /end's transcript checks, the handoff guard
 * and the recall census cannot see the session: one loud line, and silence when all is well.
 */
export function describeTranscript(proven: ProvenSession, exists: (p: string) => boolean = existsSync): string | null {
  // No proven session: the `Session ID:` line already says why.
  if (proven.id === null) return null;
  // Some hosts send no transcript_path in the SessionStart payload, so there is nothing to check.
  if (!proven.transcriptPath) return null;
  if (exists(proven.transcriptPath)) return null;
  return `NO TRANSCRIPT: session ${proven.id} has no transcript at ${proven.transcriptPath}, so /end's transcript checks, the handoff guard and the recall census cannot see it (T-161). Relaunching is the first thing to try; the cause is unknown.`;
}

/**
 * T-276: a proven session whose transcript names it but carries no Remote Control id gets no Claude-Session trailer
 * from Claude Code, so /end cannot attribute its commits. One line saying what to write; null otherwise (unproven, no
 * transcript path, a Remote Control session, or a transcript that does not name the session).
 */
export function describeCommitTrailer(
  proven: ProvenSession,
  trailerIds: (path: unknown, sessionUuid: string) => TrailerIds = sessionTrailerIds,
): string | null {
  if (proven.id === null || !proven.transcriptPath) return null;
  if (trailerIds(proven.transcriptPath, proven.id).source !== "session") return null;
  return `COMMIT TRAILER: this session has no Remote Control id, so Claude Code adds no Claude-Session trailer to its commits and /end cannot attribute them. End every commit message in this session with the line: Claude-Session: ${proven.id} (T-276).`;
}
