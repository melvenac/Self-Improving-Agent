/**
 * T-159: the not-asked fire's cheap record — one JSON line appended to a file
 * beside the store, reconciled into `trigger_fires` later by
 * `reconcilePendingFires` (fires.ts) at SessionEnd and at `ob_end`.
 *
 * Half of all fires are not-asked, and each one used to pay for better-sqlite3,
 * db-v2 and the policy loader (zod) just to INSERT one row. This module is what
 * the hook's fast path loads instead, so it imports ONLY node builtins and
 * `command-log.js` — anything heavier here puts the cost straight back.
 *
 * The RAW command is never written: the line carries `formatCommandFireLog`'s
 * program name, the same value the row would have stored (AUDIT-FIX A1 r5).
 */

import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { formatCommandFireLog, isCanonicalCommandFireLog } from "./command-log.js";

export const PENDING_FIRES_FILE = "recall-trigger-pending.jsonl";

/** The one way the hook and the reconcilers find the file: beside the store. */
export function pendingFiresPath(dbPath: string): string {
  return join(dirname(dbPath), PENDING_FIRES_FILE);
}

export interface PendingFire {
  session_uuid: string;
  created_at: string;
  command: string;
  state: "not-asked";
}

export function appendPendingNotAsked(
  path: string,
  fire: { sessionUuid: string; command: string },
  now: Date,
): void {
  const line: PendingFire = {
    session_uuid: fire.sessionUuid,
    created_at: now.toISOString(),
    command: formatCommandFireLog(fire.command),
    state: "not-asked",
  };
  appendFileSync(path, `${JSON.stringify(line)}\n`, "utf-8");
}

const KEYS = ["command", "created_at", "session_uuid", "state"];
const ISO_MS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** One line, or null when it is not exactly what `appendPendingNotAsked` writes. */
export function parsePendingFireLine(line: string): PendingFire | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (Object.keys(o).sort().join(",") !== KEYS.join(",")) return null;
  if (typeof o.session_uuid !== "string" || o.session_uuid === "") return null;
  if (typeof o.created_at !== "string" || !ISO_MS_RE.test(o.created_at)) return null;
  if (Number.isNaN(Date.parse(o.created_at))) return null;
  if (typeof o.command !== "string" || !isCanonicalCommandFireLog(o.command)) return null;
  if (o.state !== "not-asked") return null;
  return { session_uuid: o.session_uuid, created_at: o.created_at, command: o.command, state: "not-asked" };
}
