import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseState, type State } from "../../shared/state-schema.js";
import { gitLine, gitShow } from "./git-read.js";
import { readLastFetchAt, revisionOf } from "./tree-currency.js";
import { resolveUpstreamRef } from "./upstream-ref.js";

/**
 * Which record does `/start` brief from? (T-200, planner ruling session 149.)
 *
 * D-062: the record reaches seats through origin/master. Nothing made `/start` READ
 * master, so a seat whose checkout was behind briefed from its own stale record: on
 * 2026-09-30 a developer greeted from rev 140 while master held rev 163, and told the
 * planner an objective ("PR #182 awaits merge") that had merged three days earlier.
 *
 * RULING: READ FROM MASTER, DO NOT REFUSE. A developer resuming on its own branch is
 * legitimately behind master, and refusing to brief would block real work. When the
 * local record's revision is below master's, the State block and the role files come
 * from `origin/master`, and ONE line says so.
 *
 * ## The line is never absent
 *
 * Every outcome prints a `record source:` / `record read from` line, including the
 * quiet ones, so "read from master", "read locally because level" and "read locally
 * because master could not be read" can never render alike. The last one is the
 * dangerous one: it is the case where the seat may be briefing from a stale record
 * and the reason it is doing so is a failure, so the cause is in the line.
 *
 * ## What "unreadable" covers
 *
 * No such ref; no state.json at the ref; a blob larger than the read buffer; text
 * that is not valid JSON or does not validate (a cut file parses as neither); a
 * schema_version this build does not know. **Master's text is parsed before it is
 * trusted** — git returning bytes proves nothing about them being the whole record.
 *
 * ## The limit
 *
 * Reads the remote-tracking ref, never the network (the greeting must not do network
 * I/O), so "master" here is whatever the last fetch left. The line carries the fetch
 * time. Fetching is not this module's job.
 */
export type RecordSource =
  | {
      kind: "master";
      upstreamRef: string;
      sha: string;
      revMaster: number;
      revHere: number | null;
      state: State;
      /** master's state.json exactly as read, for the size block. */
      text: string;
      line: string;
    }
  | { kind: "local"; upstreamRef: string; unreadableCause: string | null; line: string };

const STATE_REL = ".agents/state.json";

export function resolveRecordSource(projectRoot: string, upstreamRef = resolveUpstreamRef(projectRoot)): RecordSource {
  const local = (unreadableCause: string | null, line: string): RecordSource => ({
    kind: "local",
    upstreamRef,
    unreadableCause,
    line,
  });
  const unreadable = (cause: string) =>
    local(cause, `record source: LOCAL (${upstreamRef} unreadable: ${cause}). Rendering this tree's own record, which may be older than master's.`);

  const sha = gitLine(projectRoot, ["rev-parse", "--verify", "--quiet", `${upstreamRef}^{commit}`]);
  if (!sha) {
    return unreadable(`${upstreamRef} does not exist in this checkout (no remote, or nothing fetched)`);
  }

  const shown = gitShow(projectRoot, upstreamRef, STATE_REL);
  if (!shown.ok) return unreadable(shown.cause);

  const parsed = parseState(shown.text);
  if (!parsed.ok) {
    return unreadable(`${STATE_REL} at ${upstreamRef} is not a record this build can read — ${parsed.error}`);
  }
  const revMaster = parsed.data.revision;
  const revHere = readLocalRevision(projectRoot);

  if (revHere !== null && revHere >= revMaster) {
    return local(null, `record source: LOCAL (rev ${revHere}, at or ahead of ${upstreamRef} rev ${revMaster})`);
  }

  const fetched = readLastFetchAt(projectRoot) ?? "fetch time unknown";
  const here = revHere === null ? "no readable record" : `rev ${revHere}`;
  return {
    kind: "master",
    upstreamRef,
    sha: sha.slice(0, 7),
    revMaster,
    revHere,
    state: parsed.data,
    text: shown.text,
    line: `record read from ${upstreamRef} ${sha.slice(0, 7)} rev ${revMaster}; this tree holds ${here}; last fetch ${fetched}`,
  };
}

function readLocalRevision(projectRoot: string): number | null {
  const path = join(projectRoot, STATE_REL);
  if (!existsSync(path)) return null;
  try {
    return revisionOf(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
