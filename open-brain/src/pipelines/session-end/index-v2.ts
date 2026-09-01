import Database from "better-sqlite3";
import { join } from "path";
import { writeSummary } from "../../vault-writer.js";
import { updateFeedbackV2, recordFeedbackEvent, type RatingOrigin } from "../../db-v2.js";
import { flagReflectionClusters } from "./reflection.js";
import { getSessionSummary } from "./session-summary.js";
import { logInvocations } from "./invocation-logger.js";
import { runSkillScanPipeline } from "./skill-scan-runner.js";
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
   * The tag-match fallback below can only answer "did the summary mention this
   * entry's tags", which has no way to express that a recalled entry was acted
   * on and turned out to be wrong. That left `harmful` unreachable on the only
   * path that runs at scale, and an unreachable rating made the apoptosis
   * threshold unsatisfiable rather than merely unmet. Entries absent from this
   * map still fall back to the heuristic, so a session that supplies nothing
   * behaves exactly as before.
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
}

interface SessionEndV2Result {
  summary: { written: boolean; selfGenerated: boolean };
  feedback: { processed: number; ratings: Array<{ id: number; rating: string }> };
  reflection: { flagged: number };
  invocations: { logged: number; skippedSessions: number };
  skillScan: { clusters: number; pendingProposals: number; approaching: number };
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
  if (!sessionSummary) {
    const result = getSessionSummary(sessionId || undefined);
    if (result) {
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
  const ratings: Array<{ id: number; rating: string }> = [];
  const summaryLower = sessionSummary.toLowerCase();

  for (const id of recalledEntryIds) {
    const row = db
      .prepare(`SELECT id, vault_path, tags FROM knowledge_index WHERE id = ?`)
      .get(id) as KnowledgeIndexRow | undefined;

    if (!row) continue;

    const tags = row.tags
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    // An explicit judgment always wins over the substring heuristic — it is the
    // only input that can carry a negative signal.
    const supplied = input.entryRatings?.[id];
    const matched = tags.some((tag) => summaryLower.includes(tag.toLowerCase()));
    const rating: FeedbackRating = supplied ?? (matched ? "helpful" : "neutral");

    updateFeedbackV2(db, row.vault_path, rating);
    // This path bypasses ob_feedback, so log the event explicitly — otherwise
    // auto-feedback labels never reach the shadow harness and most sessions
    // would score as having no ground truth at all.
    if (sessionId) {
      try {
        recordFeedbackEvent(db, sessionId, id, rating, input.recalledOrigin);
      } catch { /* non-critical */ }
    }
    ratings.push({ id, rating });
  }

  // ── Stage 3: Reflection flagging ─────────────────────────────────────────────
  let flagged = 0;
  if (!dryRun) {
    const queuePath = join(agentsDir, "reflection-queue.json");
    const result = flagReflectionClusters(db, queuePath);
    flagged = result.flagged;
  }

  // ── Stage 4: Invocation logging ──────────────────────────────────────────────
  const invocationResult = dryRun ? { logged: 0, skippedSessions: 0 } : logInvocations();

  // ── Stage 5: Skill scan ─────────────────────────────────────────────────────
  const skillScanResult = dryRun
    ? { clusters: 0, pendingProposals: 0, approaching: 0 }
    : runSkillScanPipeline();

  // ── Stage 6: Shadow recall ──────────────────────────────────────────────────
  // Must run after Stage 2 so this session's own relevance labels already exist.
  const shadow =
    dryRun || !input.shadowLogPath
      ? {
          evaluated: false,
          skipped: dryRun ? "dry run" : "no shadow log path",
          strategies: 0,
          queries: 0,
          leader: null,
        }
      : runShadowStage({ db, sessionUuid: sessionId, logPath: input.shadowLogPath });

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
    summary: { written: summaryWritten, selfGenerated },
    feedback: { processed: ratings.length, ratings },
    reflection: { flagged },
    invocations: invocationResult,
    skillScan: skillScanResult,
    shadow,
    topics,
  };
}
