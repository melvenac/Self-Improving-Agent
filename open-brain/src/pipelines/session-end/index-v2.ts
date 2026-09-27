import Database from "better-sqlite3";
import { join } from "path";
import { writeSummary } from "../../vault-writer.js";
import {
  updateFeedbackV2,
  recordFeedbackEvent,
  type RatingOrigin,
  type RatingMethod,
} from "../../db-v2.js";
import { getSessionSummary } from "./session-summary.js";
import { logInvocations } from "./invocation-logger.js";
import { planTopics, writeTopics, findOrphans } from "../topics/index.js";
import { runShadowStage, type ShadowStageResult } from "../shadow/index.js";

export type FeedbackRating = "helpful" | "harmful" | "neutral";

export interface SessionEndV2Input {
  db: Database.Database;
  vaultDir: string;
  agentsDir: string;
  sessionId: string;
  sessionSummary: string;
  project: string;
  recalledEntryIds: number[];
  /**
   * Per-entry ratings the agent judged explicitly at /end, keyed by entry id.
   *
   * THE ONLY INPUT THAT PRODUCES A RATING. The tag-match fallback that used to
   * stand beside this was CUT in Loop 12 (R-010): it could only answer "did the
   * summary mention this entry's tags", which cannot express that a recalled
   * entry was acted on and turned out to be wrong. That left `harmful`
   * unreachable on the only path running at scale, and an unreachable rating
   * made the apoptosis threshold unsatisfiable rather than merely unmet.
   *
   * An entry absent from this map is now SKIPPED rather than rated. A fallback
   * neutral is indistinguishable from a rater's considered "retrieved and not
   * used", which is the one signal the corpus still has.
   */
  entryRatings?: Record<number, FeedbackRating>;
  /**
   * Where `recalledEntryIds` came from, as resolveRecalledIds reported it.
   * Recorded on every rating this run creates — the resolver computed this all
   * along and it died in a log string, which is why 106 provenance-broken
   * ratings had three indistinguishable explanations.
   */
  recalledOrigin?: RatingOrigin;
  dryRun: boolean;
  /** Where the shadow-recall history is appended. Injected rather than resolved
   *  here so tests cannot write into the real ~/.claude history. */
  shadowLogPath?: string;
  /** Session .db directory for summary self-generation. Defaults to the
   *  context-mode sessions dir. Tests pass a scratch directory. */
  sessionsDir?: string;
}

interface SessionEndV2Result {
  summary: { written: boolean; selfGenerated: boolean; skip?: string };
  feedback: {
    processed: number;
    ratings: Array<{ id: number; rating: string }>;
    /** Recalled ids whose knowledge_index row is gone (SILENT 5). */
    vanished?: number[];
    /** Recalled ids present in the index with no supplied judgment (SILENT 5). */
    omitted?: number[];
    /** Ratings whose feedback_log write threw (SILENT 16). */
    notWritten?: Array<{ id: number; reason: string }>;
  };
  invocations: { logged: number; skippedSessions: number };
  topics: { written: number; removed: number; orphans: number };
  shadow: ShadowStageResult;
}

interface KnowledgeIndexRow {
  id: number;
  vault_path: string;
  tags: string;
}

export function sessionEndV2(input: SessionEndV2Input): SessionEndV2Result {
  const { db, vaultDir, agentsDir, sessionId, project, recalledEntryIds, dryRun } = input;
  let { sessionSummary } = input;

  // ── Self-generate summary if not provided ─────────────────────────────────
  let selfGenerated = false;
  let summarySkip: string | undefined;
  if (!sessionSummary) {
    const result = getSessionSummary(sessionId || undefined, input.sessionsDir);
    if (result && "skipped" in result) {
      summarySkip = result.skipped;
    } else if (result?.summary) {
      sessionSummary = result.summary;
      selfGenerated = true;
    }
  }

  // ── Stage 1: Write session summary ──────────────────────────────────────────
  let summaryWritten = false;
  if (!dryRun && sessionSummary) {
    const date = new Date().toISOString().slice(0, 10);
    const written = writeSummary(vaultDir, {
      sessionId,
      project,
      date,
      content: sessionSummary,
    });
    summaryWritten = written !== null;
  }

  // ── Stage 2: Auto-feedback ───────────────────────────────────────────────────
  // Loop 10 C2 (E9b): the pre-feedback lifecycle capture that stood here is
  // suspended and gone. It existed because the shadow stage scored this session's
  // ranking against this session's own labels, so ranking had to be pinned to the
  // state before Stage 2 wrote to it. Ranking no longer reads maturity or
  // success_rate, so there is nothing left for Stage 2 to move underneath it.
  // IF E3/E18's TRIGGER FIRES, THE CAPTURE COMES BACK IN THE SAME CHANGE.

  const ratings: Array<{ id: number; rating: string }> = [];
  const vanished: number[] = [];
  const omitted: number[] = [];
  const notWritten: Array<{ id: number; reason: string }> = [];
  const summaryLower = sessionSummary.toLowerCase();

  for (const id of recalledEntryIds) {
    const row = db
      .prepare(`SELECT id, vault_path, tags FROM knowledge_index WHERE id = ?`)
      .get(id) as KnowledgeIndexRow | undefined;

    if (!row) {
      vanished.push(id);
      continue;
    }

    const tags = row.tags
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    // The only input that can carry a negative signal, and since R-010 the only
    // input at all.
    const supplied = input.entryRatings?.[id];

    // Gate: with no explicit judgment and the fallback arm off, this entry is
    // not rated at all — no counter bump, no event row. Skipping rather than
    // recording a neutral matters: a neutral here would be indistinguishable
    // from a rater's considered "retrieved and not used", which is the one
    // signal the corpus still has.
    if (supplied === undefined) {
      omitted.push(id);
      continue;
    }

    const matched = tags.some((tag) => summaryLower.includes(tag.toLowerCase()));
    const rating: FeedbackRating = supplied ?? (matched ? "helpful" : "neutral");

    // Which arm produced this rating, recorded rather than inferred. Without it
    // a `neutral` from a judging agent and a `neutral` from the fallback are one
    // row shape, and those two demand opposite fixes.
    // Only one arm can reach this line now, so the label is a constant rather
    // than a branch. Kept because a `neutral` still has to say which arm made
    // it: the 347 pre-column rows cannot, and that is why the column exists.
    const method: RatingMethod = "supplied";

    // This path bypasses ob_feedback, so log the event explicitly — otherwise
    // auto-feedback labels never reach the shadow harness and most sessions
    // would score as having no ground truth at all. The counter moves only
    // after that write lands: a throw used to be counted anyway (SILENT 16).
    let wrote = true;
    if (sessionId) {
      try {
        recordFeedbackEvent(db, sessionId, id, rating, input.recalledOrigin, method);
      } catch (err) {
        wrote = false;
        notWritten.push({ id, reason: err instanceof Error ? err.message : String(err) });
      }
    }
    if (!wrote) continue;
    updateFeedbackV2(db, row.vault_path, rating);
    ratings.push({ id, rating });
  }

  // Loop 10 C2: the reflection queue is CUT. `reflection_log` held 0 rows after
  // six months — it never once recorded anything — so the stage that wrote it is
  // gone rather than switched off.
  //
  // Loop 10 C2: the skill scan and its proposal machinery are CUT. Loop 9 R1 had
  // already turned the generator off; six months of operation produced 0 skills
  // from 39 proposals none of which was ever acted on. The vault notes it
  // clustered over are untouched — the scan was derived, not a store.

  // ── Stage 3: Invocation logging ──────────────────────────────────────────────
  const invocationResult = dryRun ? { logged: 0, skippedSessions: 0 } : logInvocations();

  // ── Stage 4: Shadow recall ──────────────────────────────────────────────────
  // Must run after Stage 2 so this session's own relevance labels already exist:
  // evaluate.ts skips a session with no helpful ratings, so running this first
  // would skip every session forever. The order is the dependency, not an
  // accident — which is why the confound is removed with a snapshot taken before
  // Stage 2 rather than by reordering these two stages.
  const shadow =
    dryRun || !input.shadowLogPath
      ? {
          evaluated: false,
          skipped: dryRun ? "dry run" : "no shadow log path",
          strategies: 0,
          queries: 0,
          leader: null,
        }
      : runShadowStage({
          db,
          sessionUuid: sessionId,
          logPath: input.shadowLogPath,
        });

  // ── Stage 7: Topics ─────────────────────────────────────────────────────────
  // Runs last, after this session's summary and any new entries exist, so the
  // browsing layer is never a session behind. Regenerating every time is what
  // keeps "no orphans" true going forward rather than true on the day someone
  // last ran it by hand — v1's Maps of Content were correct in March and stale
  // by April for exactly that reason.
  let topics: { written: number; removed: number; orphans: number } = { written: 0, removed: 0, orphans: 0 };
  if (!dryRun) {
    try {
      const result = writeTopics(vaultDir, planTopics(db, vaultDir));
      topics = {
        written: result.written.length,
        removed: result.removed.length,
        orphans: findOrphans(db, vaultDir).length,
      };
    } catch { /* a browsing affordance must never fail a session capture */ }
  }

  return {
    summary: { written: summaryWritten, selfGenerated, skip: summarySkip },
    feedback: { processed: ratings.length, ratings, vanished, omitted, notWritten },
    invocations: invocationResult,
    shadow,
    topics,
  };
}

/** Lines the session-end hook prints. A distinction that is not on one of
 *  these lines is still the collapsed gap the audit named. */
export function formatSessionEndLines(result: SessionEndV2Result): string[] {
  const genLabel = result.summary.selfGenerated ? " (self-generated)" : "";
  const skip = !result.summary.written && result.summary.skip ? ` — ${result.summary.skip}` : "";
  const lines = [
    `Summary: ${result.summary.written ? "written" : "skipped"}${skip}${genLabel}`,
    `Feedback: ${result.feedback.processed} entries`,
  ];
  if (result.feedback.vanished?.length) {
    lines.push(
      `Feedback vanished: ${result.feedback.vanished.join(", ")} (no knowledge_index row)`,
    );
  }
  if (result.feedback.omitted?.length) {
    lines.push(`Feedback omitted: ${result.feedback.omitted.join(", ")} (no judgment)`);
  }
  if (result.feedback.notWritten?.length) {
    lines.push(
      `Feedback NOT WRITTEN: ${result.feedback.notWritten
        .map((row) => `${row.id} (${row.reason})`)
        .join(", ")}`,
    );
  }
  lines.push(`Invocations: ${result.invocations.logged} logged`);
  return lines;
}
