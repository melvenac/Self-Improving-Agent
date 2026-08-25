// Shadow-recall session-end stage.
//
// Runs after feedback has been recorded, so the session's own relevance labels
// exist. Appends one JSONL line per evaluated session, then reports how the
// variants compare across every session collected so far.
//
// Nothing here is shown to the agent mid-session and nothing affects live
// ranking — hence "shadow". Changing production constants stays a human
// decision; this only supplies the evidence.

import type Database from "better-sqlite3";
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { dirname } from "path";
import { evaluateSession, type SessionEvaluation, type StrategyScore } from "./evaluate.js";
import { SHADOW_STRATEGIES } from "./strategies.js";

export interface ShadowLogEntry {
  date: string;
  session_uuid: string;
  queries: string[];
  label_counts: Record<string, number>;
  scores: StrategyScore[];
}

export interface ShadowStageResult {
  evaluated: boolean;
  skipped?: string;
  strategies: number;
  queries: number;
  /** Strategy with the best nDCG this session, or null when not evaluated. */
  leader: string | null;
}

export function appendShadowLog(logPath: string, entry: ShadowLogEntry): void {
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, JSON.stringify(entry) + "\n");
}

export function readShadowLog(logPath: string): ShadowLogEntry[] {
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, "utf-8")
    .split("\n")
    .filter((line) => line.trim())
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as ShadowLogEntry];
      } catch {
        return []; // a torn line must not poison the whole history
      }
    });
}

export interface AggregateRow {
  strategy: string;
  sessions: number;
  meanNdcg: number;
  meanMrr: number;
  harmful: number;
}

/** Mean scores per strategy across every logged session. */
export function aggregateShadowLog(entries: ShadowLogEntry[]): AggregateRow[] {
  const acc = new Map<string, { n: number; ndcg: number; mrr: number; harmful: number }>();

  for (const entry of entries) {
    for (const score of entry.scores ?? []) {
      const row = acc.get(score.strategy) ?? { n: 0, ndcg: 0, mrr: 0, harmful: 0 };
      row.n++;
      row.ndcg += score.ndcg;
      row.mrr += score.mrr;
      row.harmful += score.harmful;
      acc.set(score.strategy, row);
    }
  }

  return [...acc.entries()]
    .map(([strategy, r]) => ({
      strategy,
      sessions: r.n,
      meanNdcg: r.ndcg / r.n,
      meanMrr: r.mrr / r.n,
      harmful: r.harmful,
    }))
    .sort((a, b) => b.meanNdcg - a.meanNdcg);
}

/**
 * Minimum sessions before a difference between strategies means anything.
 *
 * The v1 harness collected 7 sessions and no conclusion was ever drawn from it.
 * At the current cadence this takes a while to reach, which is the honest
 * situation — better to state the sample is too small than to act on noise.
 */
export const MIN_SESSIONS_FOR_VERDICT = 10;

export function formatShadowReport(entries: ShadowLogEntry[]): string {
  const rows = aggregateShadowLog(entries);
  if (rows.length === 0) return "Shadow recall: no evaluated sessions yet.";

  const sessions = Math.max(...rows.map((r) => r.sessions));
  const lines = [`Shadow recall — ${sessions} session(s) evaluated`];

  for (const row of rows) {
    lines.push(
      `  ${row.strategy.padEnd(16)} nDCG ${row.meanNdcg.toFixed(3)}  MRR ${row.meanMrr.toFixed(3)}  harmful ${row.harmful}`
    );
  }

  if (sessions < MIN_SESSIONS_FOR_VERDICT) {
    lines.push(
      `  (sample too small — ${MIN_SESSIONS_FOR_VERDICT} sessions needed before acting on a difference)`
    );
  } else {
    const [best] = rows;
    const live = rows.find((r) => r.strategy === "live");
    if (live && best.strategy !== "live" && best.meanNdcg > live.meanNdcg) {
      lines.push(`  Candidate: ${best.strategy} beats live on nDCG. Your call whether to adopt.`);
    } else {
      // Not the same as "live is best" — labels are drawn from what live
      // returned, so live is handicapped in its favour. See evaluate.ts.
      lines.push("  No variant beats live (which the metric favours — not proof live is optimal).");
    }
  }

  return lines.join("\n");
}

export interface ShadowStageInput {
  db: Database.Database;
  sessionUuid: string;
  logPath: string;
  limit?: number;
}

export function runShadowStage(input: ShadowStageInput): ShadowStageResult {
  const { db, sessionUuid, logPath, limit } = input;

  if (!sessionUuid) {
    return { evaluated: false, skipped: "no session uuid", strategies: 0, queries: 0, leader: null };
  }

  let evaluation: SessionEvaluation;
  try {
    evaluation = evaluateSession(db, sessionUuid, { limit });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { evaluated: false, skipped: message, strategies: 0, queries: 0, leader: null };
  }

  if (evaluation.skipped) {
    return {
      evaluated: false,
      skipped: evaluation.skipped,
      strategies: 0,
      queries: evaluation.queries.length,
      leader: null,
    };
  }

  try {
    appendShadowLog(logPath, {
      date: new Date().toISOString().slice(0, 10),
      session_uuid: sessionUuid,
      queries: evaluation.queries,
      label_counts: evaluation.labelCounts,
      scores: evaluation.scores,
    });
  } catch {
    // Losing one line of history is not worth failing session end over.
  }

  const leader = [...evaluation.scores].sort((a, b) => b.ndcg - a.ndcg)[0];

  return {
    evaluated: true,
    strategies: evaluation.scores.length,
    queries: evaluation.queries.length,
    leader: leader?.strategy ?? null,
  };
}

export { SHADOW_STRATEGIES };
