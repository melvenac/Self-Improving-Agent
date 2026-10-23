import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
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
): string {
  const prevDate = prevSessionDate(state, sessionNumber, checkout);
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

  if (paths.length === 0) return ownCount > 0 ? `READS OWED: none (${ownCount} written by this seat)` : "READS OWED: none";
  const shown = paths.slice(0, 6);
  const rest = paths.length - shown.length;
  const tail = rest > 0 ? ` · +${rest} more` : "";
  return `READS OWED (${paths.length}): ${shown.join(" · ")}${tail}`;
}
