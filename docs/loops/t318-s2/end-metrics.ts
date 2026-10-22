import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { greetingMetricsPath } from "../pipelines/session-start/greeting-metrics.js";
import type { RecordCheck, SessionWorkScan } from "./end-record-guard.js";
import type { State } from "./state-schema.js";
import { readState } from "./state-writer.js";

/**
 * T-318 S2: one JSON line per ob_end call, beside greeting-metrics.jsonl, so the end half of the session scorecard is
 * data too. Same opt-in as the greeting row (greeting.json `greeting_metrics`; the caller checks it), and a dry run
 * writes nothing. The row records what ob_end's record gate decided (T-317's rule: this session's handoff written after
 * its last work); it is not a second judgment. `open-brain metrics review` lists the rows a planner reads by hand.
 */
export const END_METRICS_FILE = "end-metrics.jsonl";
export const END_METRICS_SCHEMA = 1;
/** Rotate (rename to `.1`, replacing any old `.1`) before an append that finds the file at or above this size. */
export const END_METRICS_ROTATE_BYTES = 2 * 1024 * 1024;
export const END_TEXT_MAX_CHARS = 200;

/** closed: the gate passed. refused: RECORD NOT UPDATED. record_ok: closed past the gate with a reason. not_checked: no proof or no work scan. */
export type EndOutcome = "closed" | "refused" | "record_ok" | "not_checked";

/** In the same directory as greeting-metrics.jsonl (beside the knowledge store). */
export function endMetricsPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(dirname(greetingMetricsPath(env)), END_METRICS_FILE);
}

export interface EndMetricsInput {
  projectRoot: string;
  /** The proven session id; null when the server could not prove one. */
  sessionUuid: string | null;
  outcome: EndOutcome;
  work: SessionWorkScan | null;
  record: RecordCheck | null;
  /** record_ok's trimmed reason when one was passed, else null. */
  recordOk: string | null;
  /** The RECORD NOT CHECKED reason, for outcome not_checked. */
  notChecked: string | null;
}

export interface EndMetricsRow {
  schema: number;
  id: string;
  ts: string;
  checkout: string;
  session_uuid: string | null;
  session: number | null;
  seat: string | null;
  outcome: EndOutcome;
  work: SessionWorkScan["status"] | null;
  commits: number | null;
  unattributed: number | null;
  record_rev: number | null;
  last_work_rev: number | null;
  handoff_rev: number | null;
  detail: string | null;
  record_ok: string | null;
}

const clip = (s: string | null, n: number): string | null => (s === null ? null : s.length > n ? s.slice(0, n) : s);

export function buildEndMetricsRow(input: EndMetricsInput, state: State | null, now: Date): EndMetricsRow {
  const uuid = input.sessionUuid;
  const session = uuid !== null && state !== null ? state.sessions.find((x) => x.uuid === uuid) : undefined;
  const handoff = uuid !== null && state !== null ? state.handoffs.find((h) => h.session_uuid === uuid) : undefined;
  return {
    schema: END_METRICS_SCHEMA,
    id: randomUUID(),
    ts: now.toISOString(),
    checkout: basename(input.projectRoot),
    session_uuid: uuid,
    session: session?.n ?? null,
    seat: session?.seat ?? handoff?.seat ?? null,
    outcome: input.outcome,
    work: input.work?.status ?? null,
    commits: input.work !== null && input.work.status !== "unknown" ? input.work.commits : null,
    unattributed: input.work !== null && input.work.status !== "unknown" ? input.work.unattributed : null,
    record_rev: state?.revision ?? null,
    last_work_rev: session?.last_work_rev ?? null,
    handoff_rev: handoff?.written_rev ?? null,
    detail: clip(input.outcome === "not_checked" ? input.notChecked : (input.record?.detail ?? null), END_TEXT_MAX_CHARS),
    record_ok: clip(input.recordOk, END_TEXT_MAX_CHARS),
  };
}

/** Read the record, build, rotate, append. Never throws. */
export function recordEndMetrics(input: EndMetricsInput): { ok: true } | { ok: false; why: string } {
  try {
    const path = endMetricsPath();
    const read = readState(input.projectRoot);
    const row = buildEndMetricsRow(input, read.ok ? read.data : null, new Date());
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path) && statSync(path).size >= END_METRICS_ROTATE_BYTES) {
      if (existsSync(`${path}.1`)) unlinkSync(`${path}.1`);
      renameSync(path, `${path}.1`);
    }
    appendFileSync(path, JSON.stringify(row) + "\n");
    return { ok: true };
  } catch (err) {
    return { ok: false, why: ((err as Error).message ?? String(err)).split("\n")[0] || "unknown error" };
  }
}
