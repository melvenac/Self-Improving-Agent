import { randomUUID } from "node:crypto";
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { basename } from "node:path";
import { GREETING_METRICS_SCHEMA, greetingMetricsPath } from "./greeting-metrics.js";

/**
 * T-324 S2 (dashboard T-054): what a session did after its greeting, appended by SessionEnd to the same
 * greeting-metrics.jsonl as one schema-2 `outcome` row. Append-only: the greeting row is never edited, and a session
 * that ends twice (a resume) appends a second outcome row for the same greeting; the newest per `greeting_id` wins.
 * No greeting row for this session (metrics off, or no /start) means no outcome row.
 *
 * Core side, like greeting-metrics.ts: it must not import any MEMORY_SIDE file.
 */
export const GREETING_OUTCOME_SCHEMA = 2;
/** At most this many ids in `first_action.ids`, the same cap as a greeting row's `pick_up_ids`. */
export const FIRST_ACTION_IDS_CAP = 10;
const ACTION_ID = /\b[TV]-\d+\b|#\d+\b/g;
/** The greeting's own plumbing, which is not the session's first action. */
const PLUMBING = /^(?:ToolSearch|TodoWrite)$|(?:^|__)ob_(?:set_session|start)$/;
const TAIL_BYTES = 256 * 1024;

/**
 * T-324 S3 (dashboard T-054 item 3): this session's recall-trigger fires, counts only (no query text). asked = rows the
 * store was asked for (state not 'not-asked'); injected = state 'injected'; the other three count rows whose query
 * carries that token (trigger/run.ts writes them as space-separated `seat-skip:<ids>`, `path-match:<ids>`,
 * `error-match:<ids>`). The caller reads trigger_fires (memory side) and passes the rows in; this file stays core.
 */
export interface TriggerCounts {
  asked: number;
  injected: number;
  seat_skip: number;
  path_match: number;
  error_match: number;
}

const hasToken = (query: string, token: string): boolean => query.split(/\s+/).some((t) => t.startsWith(token));

export function triggerCounts(rows: ReadonlyArray<{ state: string; query: string }>): TriggerCounts {
  const c: TriggerCounts = { asked: 0, injected: 0, seat_skip: 0, path_match: 0, error_match: 0 };
  for (const r of rows) {
    if (r.state !== "not-asked") c.asked++;
    if (r.state === "injected") c.injected++;
    if (hasToken(r.query, "seat-skip:")) c.seat_skip++;
    if (hasToken(r.query, "path-match:")) c.path_match++;
    if (hasToken(r.query, "error-match:")) c.error_match++;
  }
  return c;
}

export interface FirstAction {
  /** The tool_use line's timestamp. */
  t: string;
  tool: string;
  /** T-, V- and #ids in the tool's input, de-duplicated in order, at most FIRST_ACTION_IDS_CAP. */
  ids: string[];
}

export interface GreetingOutcomeRow {
  schema: number;
  kind: "outcome";
  id: string;
  ts: string;
  greeting_id: string;
  /** The greeting row's `session` (the session number), copied so the row reads alone. */
  session: number | null;
  first_action: FirstAction | null;
  first_action_match: boolean | null;
  ended: boolean;
  /** T-324 S3: the session's uuid, when the hook knows it. */
  session_uuid?: string;
  /** T-324 S3: absent = the trigger store was not read (no DB, no uuid); all zeros = read, and nothing fired. */
  trigger?: TriggerCounts;
}

/** T-324 S3: optional fields, appended after `ended` only when known. */
export interface OutcomeExtras {
  sessionUuid?: string;
  trigger?: TriggerCounts;
}

/** The greeting-row fields an outcome needs. */
export type GreetingRowRef = { id: string; ts: string; session: number | null; pick_up_ids?: unknown };

/** The first main-thread tool_use strictly after `after` that is not plumbing, or null. */
export function firstActionAfter(transcript: string, after: string): FirstAction | null {
  const since = Date.parse(after);
  for (const line of transcript.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry?.type !== "assistant" || entry.isSidechain === true || !Array.isArray(entry.message?.content)) continue;
    const t = typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) : NaN;
    if (Number.isNaN(t) || !(t > since)) continue;
    for (const item of entry.message.content) {
      if (item?.type !== "tool_use" || typeof item.name !== "string" || PLUMBING.test(item.name)) continue;
      const ids = [...new Set(JSON.stringify(item.input ?? {}).match(ACTION_ID) ?? [])].slice(0, FIRST_ACTION_IDS_CAP);
      return { t: new Date(t).toISOString(), tool: item.name, ids };
    }
  }
  return null;
}

/** true: an id of the first action is in pick_up_ids; false: none is (or it has none); null: nothing to judge. */
export function matchFirstAction(pickUpIds: unknown, action: FirstAction | null): boolean | null {
  if (!Array.isArray(pickUpIds) || pickUpIds.length === 0 || action === null) return null;
  return action.ids.some((id) => pickUpIds.includes(id));
}

/** The EARLIEST schema-1 greeting row of this checkout at or after the session's start: the greeting it acted on. */
export function findGreetingRow(metrics: string, checkout: string, sessionStart: string): GreetingRowRef | null {
  const since = Date.parse(sessionStart);
  for (const line of metrics.split("\n")) {
    if (line.trim() === "") continue;
    let row: any;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row?.schema !== GREETING_METRICS_SCHEMA || row.checkout !== checkout || typeof row.id !== "string") continue;
    const ts = typeof row.ts === "string" ? Date.parse(row.ts) : NaN;
    if (Number.isNaN(ts) || ts < since) continue;
    return { id: row.id, ts: row.ts, session: typeof row.session === "number" ? row.session : null, pick_up_ids: row.pick_up_ids };
  }
  return null;
}

export function buildGreetingOutcomeRow(
  greeting: GreetingRowRef,
  action: FirstAction | null,
  ended: boolean,
  now: Date,
  extra: OutcomeExtras = {},
): GreetingOutcomeRow {
  const row: GreetingOutcomeRow = {
    schema: GREETING_OUTCOME_SCHEMA,
    kind: "outcome",
    id: randomUUID(),
    ts: now.toISOString(),
    greeting_id: greeting.id,
    session: greeting.session,
    first_action: action,
    first_action_match: matchFirstAction(greeting.pick_up_ids, action),
    ended,
  };
  if (extra.sessionUuid) row.session_uuid = extra.sessionUuid;
  if (extra.trigger) row.trigger = extra.trigger;
  return row;
}

function readTail(path: string): string {
  const size = statSync(path).size;
  const start = Math.max(0, size - TAIL_BYTES);
  const buf = Buffer.alloc(size - start);
  const fd = openSync(path, "r");
  try {
    readSync(fd, buf, 0, buf.length, start);
  } finally {
    closeSync(fd);
  }
  return buf.toString("utf8");
}

export interface GreetingOutcomeInput {
  projectDir: string;
  transcriptPath: string;
  /** sessionStartFromTranscript(transcriptPath). */
  sessionStart: string | null;
  /** ob_end ran in this session (its stamp names this session). */
  ended: boolean;
  /** T-324 S3: copied to the row when set. */
  sessionUuid?: string;
  /** T-324 S3: counts from trigger_fires for this session; omit when the store was not read. */
  trigger?: TriggerCounts;
}

/** Find this session's greeting row, build and append the outcome. Never throws. */
export function recordGreetingOutcome(
  input: GreetingOutcomeInput,
  env: NodeJS.ProcessEnv = process.env,
): { written: GreetingOutcomeRow } | { skipped: string } | { failed: string } {
  try {
    if (input.sessionStart === null) return { skipped: "no session start in the transcript" };
    const path = greetingMetricsPath(env);
    if (!existsSync(path)) return { skipped: "no greeting-metrics file" };
    const greeting = findGreetingRow(readTail(path), basename(input.projectDir), input.sessionStart);
    if (greeting === null) return { skipped: "no greeting row for this session" };
    const action = firstActionAfter(readFileSync(input.transcriptPath, "utf8"), greeting.ts);
    const row = buildGreetingOutcomeRow(greeting, action, input.ended, new Date(), {
      sessionUuid: input.sessionUuid,
      trigger: input.trigger,
    });
    appendFileSync(path, JSON.stringify(row) + "\n");
    return { written: row };
  } catch (err) {
    return { failed: ((err as Error).message ?? String(err)).split("\n")[0] || "unknown error" };
  }
}
