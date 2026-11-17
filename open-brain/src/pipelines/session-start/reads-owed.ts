import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { endRecordProjectDir } from "../../shared/end-record-store.js";
import { sessionTrailerIds } from "../../shared/handoff-guard.js";
import type { Seat, State } from "../../shared/state-schema.js";
import { ownHandoff, questionText, watchText } from "../../shared/state-schema.js";
import { latestBriefPath } from "./latest-brief.js";

const MD_PATH_RE = /(?:docs|\.agents)\/[A-Za-z0-9._/-]+\.md\b/g;

function commitDate(projectRoot: string, relPath: string): string | null {
  const gitPath = relPath.replace(/\\/g, "/");
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", gitPath], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return out === "" ? null : out;
  } catch {
    return null;
  }
}

/** The newest commit's `Claude-Session:` trailer values for one path, space-joined; "" when none or unreadable. */
function newestTrailer(projectRoot: string, relPath: string): string {
  try {
    return execFileSync("git", ["log", "-1", "--format=%(trailers:key=Claude-Session,valueonly,separator=%x20)", "--", relPath.replace(/\\/g, "/")], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

/**
 * G-062 (a): the `Claude-Session:` trailer ids this seat's own commits carry, so READS OWED does not list a file the seat
 * wrote itself. Every commit's git author is Aaron, so authorship comes from the trailer (T-276's reading): this
 * session's ids from its proven transcript, plus the newest other session of this checkout, whose transcript sits beside
 * this one as `<uuid>.jsonl`. That one is read head-only (147 MB measured): a Remote Control id switched on late in it is
 * missed, and its files are then listed, as before. No proof or no transcript path: no ids, so nothing is left out.
 */
export function ownTrailerIds(state: State, sessionUuid: string | null, transcriptPath: string | undefined, checkout: string | null | undefined): string[] {
  if (sessionUuid === null || transcriptPath === undefined || transcriptPath === "") return [];
  const ids = new Set(sessionTrailerIds(transcriptPath, sessionUuid).ids);
  let prev: State["sessions"][number] | undefined;
  for (const row of state.sessions) {
    if (checkout == null || row.checkout !== checkout || row.uuid === null || row.uuid === sessionUuid) continue;
    if (prev === undefined || (row.first_rev ?? -1) > (prev.first_rev ?? -1)) prev = row;
  }
  if (prev !== undefined && prev.uuid !== null) {
    for (const id of sessionTrailerIds(join(dirname(transcriptPath), `${prev.uuid}.jsonl`), prev.uuid, { headOnly: true }).ids) ids.add(id);
  }
  return [...ids];
}

/**
 * T-348: the READS OWED line was advice with nothing behind it. On 2026-11-17 two of six planner sessions greeted with
 * owed briefs unread and did not say so. ob_start now keeps the list it printed, for the session that started, and that
 * session's first ob_state write repeats it once.
 *
 * It is a reminder, not a check: nothing in SIA records that a file was opened (the role-reads store records what
 * ob_start itself printed, and the PostToolUse hook is not registered for Read), so the line asks the seat to confirm
 * and is printed whether or not the files were read.
 *
 * The record is one file in the per-project end-record directory (outside the repo, beside the other once-shown
 * markers), holding the LAST started session only: a second session started in the same checkout replaces the first
 * one's list. Every failure is silent and means no reminder; the state write is never refused or delayed by it.
 */
const READS_OWED_FILE = ".reads-owed.json";

interface ReadsOwedRecord {
  session: string;
  paths: string[];
  reminded: boolean;
}

function readReadsOwedRecord(projectRoot: string): ReadsOwedRecord | null {
  try {
    const raw: unknown = JSON.parse(readFileSync(join(endRecordProjectDir(projectRoot), READS_OWED_FILE), "utf8"));
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as { session?: unknown; paths?: unknown; reminded?: unknown };
    if (typeof r.session !== "string" || !Array.isArray(r.paths) || !r.paths.every((p) => typeof p === "string")) return null;
    return { session: r.session, paths: r.paths as string[], reminded: r.reminded === true };
  } catch {
    return null;
  }
}

/**
 * T-348: ob_start's owed list for `sessionId`, an empty one included. A session that has already been reminded keeps its
 * record, so a second /start in the same session does not arm the reminder again.
 */
export function recordReadsOwed(projectRoot: string, sessionId: string, paths: readonly string[]): void {
  try {
    const prev = readReadsOwedRecord(projectRoot);
    if (prev !== null && prev.session === sessionId && prev.reminded) return;
    writeFileSync(join(endRecordProjectDir(projectRoot), READS_OWED_FILE), `${JSON.stringify({ session: sessionId, paths: [...paths], reminded: false })}\n`);
  } catch {
    /* best effort: no record means no reminder */
  }
}

/**
 * T-348: the one line ob_state appends to the first write of a session that started with owed reads, else null. A dry
 * run gets no line and leaves the reminder armed. No proven session, another session's record, or none: null.
 */
export function readsOwedReminder(projectRoot: string, sessionId: string | null, dryRun: boolean): string | null {
  if (sessionId === null || dryRun) return null;
  const rec = readReadsOwedRecord(projectRoot);
  if (rec === null || rec.session !== sessionId || rec.reminded || rec.paths.length === 0) return null;
  try {
    writeFileSync(join(endRecordProjectDir(projectRoot), READS_OWED_FILE), `${JSON.stringify({ session: rec.session, paths: rec.paths, reminded: true })}\n`);
  } catch {
    /* the line still prints; it may print again on the next write */
  }
  const shown = rec.paths.slice(0, 6);
  const rest = rec.paths.length - shown.length;
  return `READS OWED at start (${rec.paths.length}), confirm each was read: ${shown.join(", ")}${rest > 0 ? `, +${rest} more` : ""}`;
}

function prevSessionDate(state: State, sessionNumber: number | null, checkout: string | null | undefined): string | null {
  if (sessionNumber === null || checkout == null) return null;
  let best: string | null = null;
  for (const row of state.sessions) {
    if (row.checkout !== checkout || row.n >= sessionNumber) continue;
    if (best === null || row.date > best) best = row.date;
  }
  return best;
}

function owedByDate(commit: string | null, prevDate: string | null): boolean {
  if (prevDate === null) return true;
  if (commit === null) return false;
  return commit >= prevDate;
}

function collectHandoffPaths(state: State, seat: Seat | null, checkout: string | null | undefined): string[] {
  const own = ownHandoff(state.handoffs, seat, checkout ?? undefined);
  if (!own) return [];
  const texts = [own.pick_up, ...own.watch_out.map(watchText), ...own.open_questions.map(questionText)];
  const found: string[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    MD_PATH_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MD_PATH_RE.exec(text)) !== null) {
      const p = m[0];
      if (!seen.has(p)) {
        seen.add(p);
        found.push(p);
      }
    }
  }
  return found;
}

export function describeReadsOwed(
  projectRoot: string,
  state: State,
  sessionNumber: number | null,
  seat: Seat | null,
  checkout: string | null | undefined,
  /** G-062 (a): ownTrailerIds(); a path whose newest commit carries one of them is not owed. Empty: nothing is left out. */
  ownIds: readonly string[] = [],
  /** T-348: when given, every owed path is pushed onto it (all of them, not only the six the line shows). */
  collect?: string[],
): string {
  const prevDate = prevSessionDate(state, sessionNumber, checkout);
  // T-329 (N4): no earlier session of this checkout in the record (a fresh import writes its row with no checkout), so the
  // list is a first reading, not a debt. An unknown session number or checkout is not a first session.
  const firstSession = sessionNumber !== null && checkout != null && prevDate === null;
  const paths: string[] = [];
  const seen = new Set<string>();
  const own = ownIds.filter((id) => id !== "");
  let ownCount = 0;

  const absFromRel = (rel: string): string => join(projectRoot, ...rel.split("/"));

  const add = (rel: string) => {
    if (seen.has(rel)) return;
    if (!existsSync(absFromRel(rel))) return;
    seen.add(rel);
    if (own.length > 0) {
      const trailer = newestTrailer(projectRoot, rel);
      if (trailer !== "" && own.some((id) => trailer.includes(id))) {
        ownCount++;
        return;
      }
    }
    paths.push(rel);
  };

  const brief = latestBriefPath(projectRoot);
  if (brief !== null && owedByDate(brief.date.slice(0, 10), prevDate)) add(brief.path);

  for (const p of collectHandoffPaths(state, seat, checkout)) {
    if (!owedByDate(commitDate(projectRoot, p), prevDate)) continue;
    add(p);
  }

  // D-162: domains.json is retired, so it is never owed.
  for (const rel of [".agents/AGENT.md", ".agents/AGENT.local.md"]) {
    if (!owedByDate(commitDate(projectRoot, rel), prevDate)) continue;
    add(rel);
  }

  if (collect) collect.push(...paths);
  if (paths.length === 0) return ownCount > 0 ? `READS OWED: none (${ownCount} written by this seat)` : "READS OWED: none";
  const shown = paths.slice(0, 6);
  const rest = paths.length - shown.length;
  const tail = rest > 0 ? ` · +${rest} more` : "";
  return `${firstSession ? "READS FIRST" : "READS OWED"} (${paths.length}): ${shown.join(" · ")}${tail}`;
}
