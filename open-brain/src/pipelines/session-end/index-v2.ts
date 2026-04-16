import Database from "better-sqlite3";
import { join } from "path";
import { writeSummary } from "../../vault-writer.js";
import { updateFeedbackV2 } from "../../db-v2.js";
import { flagReflectionClusters } from "./reflection.js";
import { getSessionSummary } from "./session-summary.js";

export interface SessionEndV2Input {
  db: Database.Database;
  vaultDir: string;
  agentsDir: string;
  sessionId: string;
  sessionSummary: string;
  project: string;
  recalledEntryIds: number[];
  dryRun: boolean;
}

interface SessionEndV2Result {
  summary: { written: boolean; selfGenerated: boolean };
  feedback: { processed: number; ratings: Array<{ id: number; rating: string }> };
  reflection: { flagged: number };
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

    const matched = tags.some((tag) => summaryLower.includes(tag.toLowerCase()));
    const rating: "helpful" | "neutral" = matched ? "helpful" : "neutral";

    updateFeedbackV2(db, row.vault_path, rating);
    ratings.push({ id, rating });
  }

  // ── Stage 3: Reflection flagging ─────────────────────────────────────────────
  let flagged = 0;
  if (!dryRun) {
    const queuePath = join(agentsDir, "reflection-queue.json");
    const result = flagReflectionClusters(db, queuePath);
    flagged = result.flagged;
  }

  return {
    summary: { written: summaryWritten, selfGenerated },
    feedback: { processed: ratings.length, ratings },
    reflection: { flagged },
  };
}
