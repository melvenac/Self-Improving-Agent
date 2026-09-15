import type Database from "better-sqlite3";
import { getSessionRecalledIds } from "../../db-v2.js";

/**
 * Decide which knowledge entries `/end` is allowed to rate.
 *
 * `.recalled-entries.json` is written by the startup subagent and was trusted
 * on sight. It carries a `session_id`, and nothing compared it to the session
 * being ended — so a session whose startup never rewrote the file inherited the
 * previous one's entries. On 2026-08-11 the file on disk still described
 * session 2fb67133 from 2026-08-07, two sessions back; it does not self-heal.
 *
 * That was survivable while auto-feedback only bumped a counter nobody read.
 * Since v0.15.0 the same ratings move `success_rate`, which gates apoptosis and
 * feeds `maturityBoost` ranking — so mis-attributed ratings now write wrong
 * numbers into a column that decides what gets pruned and what ranks first.
 *
 * The fix is structural rather than a validity check bolted onto the file:
 * `recall_log` already records every `ob_recall` hit against the live session
 * uuid, so when the session is known the file is not consulted at all. A stale
 * file cannot contribute because nothing reads it.
 *
 * Precedence:
 *   1. ids passed explicitly by the caller — an override stays an override
 *   2. `recall_log` for this session — authoritative when the session is known
 *   3. the file, but only when it names the session being ended (covers recalls
 *      made before `ob_set_session`, which never reached `recall_log`)
 *   4. nothing — and `reason` says which guard rejected it
 */
export interface RecalledIdsSource {
  ids: number[];
  origin: "explicit" | "recall-log" | "file" | "none";
  /** Set when a file existed but was not trusted. */
  rejected?: { path: string; fileSessionId: string | null; reason: string };
  /**
   * Why nothing resolved, when `origin` is "none" and no file was rejected —
   * the case where there was simply nothing to read.
   *
   * Loop 5 R3: `rejected` only explains a file that existed and was refused. A
   * session that never ran `ob_set_session`, or one with no recall_log rows and
   * no file, produced `origin: "none"` with no explanation at all, rated
   * nothing, and said nothing about why.
   */
  reason?: string;
}

export interface ResolveRecalledIdsInput {
  db: Database.Database;
  sessionId: string | null;
  explicitIds?: number[];
  /** Candidate `.recalled-entries.json` paths, in priority order. */
  filePaths: string[];
  /** Injected so tests never touch the real filesystem. */
  readFile: (path: string) => string | null;
}

interface RecalledFile {
  session_id?: string | null;
  entries?: Array<{ id?: number }>;
}

export function resolveRecalledIds(input: ResolveRecalledIdsInput): RecalledIdsSource {
  const { db, sessionId, explicitIds, filePaths, readFile } = input;

  if (explicitIds && explicitIds.length > 0) {
    return { ids: explicitIds, origin: "explicit" };
  }

  if (sessionId) {
    const logged = getSessionRecalledIds(db, sessionId);
    if (logged.length > 0) return { ids: logged, origin: "recall-log" };
  }

  for (const path of filePaths) {
    const raw = readFile(path);
    if (raw === null) continue;

    let parsed: RecalledFile;
    try {
      parsed = JSON.parse(raw) as RecalledFile;
    } catch {
      return {
        ids: [],
        origin: "none",
        rejected: { path, fileSessionId: null, reason: "unparseable" },
      };
    }

    const fileSessionId = parsed.session_id ?? null;
    const ids = (parsed.entries ?? [])
      .map((e) => e.id)
      .filter((id): id is number => typeof id === "number");

    // Unknown session: there is nothing to compare against, so an id-bearing
    // file cannot be shown to describe this session. Refusing is the safe
    // default now that a rating carries weight.
    if (!sessionId) {
      if (fileSessionId === null) return { ids, origin: "file" };
      return {
        ids: [],
        origin: "none",
        rejected: { path, fileSessionId, reason: "session unknown; file names a session" },
      };
    }

    if (fileSessionId === sessionId) return { ids, origin: "file" };

    return {
      ids: [],
      origin: "none",
      rejected: {
        path,
        fileSessionId,
        reason: `file describes session ${fileSessionId ?? "(none)"}, not ${sessionId}`,
      },
    };
  }

  // Nothing anywhere: no explicit ids, no recall_log rows for a known session,
  // and not one of the candidate files was readable. Say which, rather than
  // returning a bare empty result the caller has to guess about.
  return {
    ids: [],
    origin: "none",
    reason: sessionId
      ? `no recall_log rows for session ${sessionId} and no readable .recalled-entries.json (looked in ${filePaths.length} location(s))`
      : `no session id (ob_set_session never ran) and no readable .recalled-entries.json (looked in ${filePaths.length} location(s))`,
  };
}

/**
 * Render the recalled-ids resolution as report lines — **including at zero**.
 *
 * The same shape as `formatApoptosisQueue`: absence must not be
 * indistinguishable from success. Before this, a session that resolved nothing
 * rated nothing and the only visible trace was `Feedback: 0 entries`, which
 * reads identically whether there was nothing to rate, the session id was
 * missing, or a file belonging to another session was refused.
 *
 * The count-and-origin line is unconditional; the explanation is added only
 * when there is one to give.
 */
export function formatRecalledResolution(resolved: RecalledIdsSource, indent = "  "): string[] {
  const lines = [`${indent}Recalled ids: ${resolved.ids.length} from ${resolved.origin}`];
  if (resolved.rejected) {
    lines.push(`${indent}Ignored ${resolved.rejected.path}: ${resolved.rejected.reason}`);
  }
  if (resolved.origin === "none") {
    if (resolved.reason) lines.push(`${indent}Nothing rated: ${resolved.reason}`);
    else if (resolved.rejected) lines.push(`${indent}Nothing rated: the only candidate file was refused (above)`);
  }
  return lines;
}
