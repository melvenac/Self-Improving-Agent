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
 *
 * LOOP 5 R4 — nothing writes the file any more. `/start` step 4 was removed in
 * the Loop 5 release: `recall_log` already holds every hit against the live session uuid,
 * so the file was a redundant second copy, keyed per PROJECT rather than per
 * session, and each start merged into it — so it accumulated other sessions'
 * ids without bound. On 2026-09-14 a 33-entry file held 11 entries the session
 * had actually recalled and 22 from eight earlier sessions, while wearing the
 * running session's id. It never corrupted a rating, because precedence 2 wins
 * whenever the session is known; its cost was diagnostic, and it was expensive
 * — two agents spent an evening designing a fix for a bug the file only looked
 * like it was causing.
 *
 * The read path stays for the one case it still covers: recalls made before
 * `ob_set_session` ran never reach `recall_log` with a usable session uuid, and
 * a file naming this session is the only remaining evidence of them. That case
 * is now loud rather than silent (R3), so if it ever fires, someone will see it
 * rather than inferring it from a zero. A leftover file from an older version
 * fails precedence 3 and is refused by name.
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

/**
 * T-050: observe a foreign `.recalled-entries.json` writer WITHOUT letting the file influence anything.
 *
 * v0.15.1's fix was to stop reading the file on the normal path, which made a foreign writer both unreachable and
 * uncountable: "no foreign writer" and "a foreign writer never looked at" printed the same nothing. Removing a
 * read is not counting what you no longer read. This reads the file purely to REPORT who wrote it. It returns no
 * ids and no entries, `resolveRecalledIds`' precedence is untouched, and a finding is reported, never refused.
 */
export interface ForeignWriterFinding {
  path: string;
  kind: "foreign" | "unattributed" | "unparseable";
  fileSessionId: string | null;
}

export interface ForeignWriterReport {
  /** The session the files were compared against (null when it was not known). */
  sessionId: string | null;
  /** False when the question could not be asked (no session id to compare against). */
  checked: boolean;
  notChecked?: string;
  /** Candidate locations examined. */
  looked: number;
  /** Of those, files that existed and were read. */
  present: number;
  findings: ForeignWriterFinding[];
}

export function detectForeignWriter(input: {
  sessionId: string | null;
  filePaths: string[];
  readFile: (path: string) => string | null;
}): ForeignWriterReport {
  const { sessionId, filePaths, readFile } = input;
  if (!sessionId) {
    return { sessionId, checked: false, notChecked: "no session id, so no file can be called foreign", looked: filePaths.length, present: 0, findings: [] };
  }
  const findings: ForeignWriterFinding[] = [];
  let present = 0;
  for (const path of filePaths) {
    const raw = readFile(path);
    if (raw === null) continue;
    present += 1;
    let parsed: { session_id?: unknown };
    try {
      parsed = JSON.parse(raw) as { session_id?: unknown };
    } catch {
      findings.push({ path, kind: "unparseable", fileSessionId: null });
      continue;
    }
    const named = typeof parsed.session_id === "string" ? parsed.session_id : null;
    if (named === null) findings.push({ path, kind: "unattributed", fileSessionId: null });
    else if (named !== sessionId) findings.push({ path, kind: "foreign", fileSessionId: named });
  }
  return { sessionId, checked: true, looked: filePaths.length, present, findings };
}

/** One line per finding, or one line saying what was (or was not) looked at. Never empty: absent and zero differ. */
export function formatForeignWriter(report: ForeignWriterReport, indent = "  "): string[] {
  if (!report.checked) return [`${indent}Foreign writer: not checked (${report.notChecked})`];
  if (report.findings.length === 0) {
    return report.present === 0
      ? [`${indent}Foreign writer: none present (no .recalled-entries.json in ${report.looked} location(s))`]
      : [`${indent}Foreign writer: none (${report.present} file${report.present === 1 ? "" : "s"} read, all name this session)`];
  }
  return report.findings.map((f) => {
    const what =
      f.kind === "foreign" ? `names session ${f.fileSessionId}, not ${report.sessionId}` : f.kind === "unattributed" ? "names no session" : "is not parseable JSON";
    return `${indent}Foreign writer: FOUND ${f.path} ${what} (reported, not refused; it played no part in which entries were rated)`;
  });
}

/**
 * The resolution and the observation together. `resolved` is exactly `resolveRecalledIds(input)`: the observation is
 * computed beside it and nothing flows from `foreign` into `resolved`.
 */
export function resolveRecalledIdsObserved(input: ResolveRecalledIdsInput): { resolved: RecalledIdsSource; foreign: ForeignWriterReport } {
  const resolved = resolveRecalledIds(input);
  const foreign = detectForeignWriter({ sessionId: input.sessionId, filePaths: input.filePaths, readFile: input.readFile });
  return { resolved, foreign };
}
