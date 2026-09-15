import Database from "better-sqlite3";
import { join } from "path";
import { writeSummary } from "../../vault-writer.js";
import {
  updateFeedbackV2,
  recordFeedbackEvent,
  captureLifecycleSnapshot,
  type RatingOrigin,
  type RatingMethod,
} from "../../db-v2.js";
import { flagReflectionClusters } from "./reflection.js";
import { getSessionSummary } from "./session-summary.js";
import { logInvocations } from "./invocation-logger.js";
import { runSkillScanPipeline } from "./skill-scan-runner.js";
import { SKILL_SCAN_ENABLED } from "../../shared/skill-scan-flag.js";
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
   * Whether the tag-substring fallback may rate entries it was given no
   * judgment for. **Default false — the arm is off.**
   *
   * It was off by accident for the whole life of the `rating_method` column:
   * the hook could not read its own session uuid, so Stage 2 never ran and this
   * arm wrote nothing (see cli-session-end.ts and
   * ~/Obsidian Vault v2/Research/loop-7-c1-reconciliation-2026-09-15.md §2).
   * Fixing the uuid
   * would have switched it on as a side effect, on the very next session end.
   *
   * That is not a safe thing to do silently. The arm emits `helpful` on a tag
   * substring appearing in the session summary — mentioned, not worked — and
   * those ratings feed `success_rate`, which gates maturity and apoptosis. The
   * per-entry mean helpful rate is 0.311 against an apoptosis threshold of 0.3
   * (injection-ablation prereg §10), so flooding a knife-edge scoring system
   * with topic-mention signal is exactly the change that should not happen as a
   * by-product of a bug fix.
   *
   * So the repair and the switch-on are separated: the uuid is correct now, and
   * this stays false until Loop 7's C2 rules on whether session-start injection
   * and its rating machinery are kept. Flip it in one place, deliberately.
   */
  enableHeuristicRatings?: boolean;
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
  // Capture lifecycle state BEFORE any rating is written. Stage 6 scores this
  // session's ranking against this session's labels, and Stage 2 is what creates
  // those labels — so without this capture the shadow harness compares strategies
  // against maturity values its own ground truth has just moved, and an entry
  // rated helpful here is measured as though it had already been promoted.
  //
  // `recalledEntryIds` is the exact and complete set of ids Stage 2 can touch, so
  // a wider snapshot would cost more and pin nothing extra.
  const preFeedbackSnapshot = captureLifecycleSnapshot(db, recalledEntryIds);

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

    // Gate: with no explicit judgment and the fallback arm off, this entry is
    // not rated at all — no counter bump, no event row. Skipping rather than
    // recording a neutral matters: a neutral here would be indistinguishable
    // from a rater's considered "retrieved and not used", which is the one
    // signal the corpus still has.
    if (supplied === undefined && !input.enableHeuristicRatings) continue;

    const matched = tags.some((tag) => summaryLower.includes(tag.toLowerCase()));
    const rating: FeedbackRating = supplied ?? (matched ? "helpful" : "neutral");

    // Which arm produced this rating, recorded rather than inferred. Without it
    // a `neutral` from a judging agent and a `neutral` from the fallback are one
    // row shape, and those two demand opposite fixes.
    const method: RatingMethod = supplied ? "supplied" : "heuristic";

    updateFeedbackV2(db, row.vault_path, rating);
    // This path bypasses ob_feedback, so log the event explicitly — otherwise
    // auto-feedback labels never reach the shadow harness and most sessions
    // would score as having no ground truth at all.
    if (sessionId) {
      try {
        recordFeedbackEvent(db, sessionId, id, rating, input.recalledOrigin, method);
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
  // Loop 9 R1: off by ruling. The generator does not run, so nothing writes
  // .skill-proposals-pending.json. Reversible by SKILL_SCAN_ENABLED alone; the
  // vault notes it clusters over are untouched either way.
  const skillScanResult =
    dryRun || !SKILL_SCAN_ENABLED
      ? { clusters: 0, pendingProposals: 0, approaching: 0 }
      : runSkillScanPipeline();

  // ── Stage 6: Shadow recall ──────────────────────────────────────────────────
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
          snapshot: preFeedbackSnapshot,
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
    summary: { written: summaryWritten, selfGenerated },
    feedback: { processed: ratings.length, ratings },
    reflection: { flagged },
    invocations: invocationResult,
    skillScan: skillScanResult,
    shadow,
    topics,
  };
}
