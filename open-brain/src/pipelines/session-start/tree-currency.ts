import { existsSync, readFileSync, statSync, writeFileSync, rmSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { parseState } from "../../shared/state-schema.js";

/**
 * Is this checkout current with the remote, and is its record current with the
 * remote's record?
 *
 * ## The condition this exists for, measured rather than imagined
 *
 * On 2026-09-20 a developer seat ran `/start` on a branch two merges behind
 * `origin/master`. The greeting was internally perfect: the tree was clean, the
 * record parsed, `Drift: none`, a valid `## State` block at revision 50. Four of
 * the claims it then reported to the planner were false at revision 52 — a stale
 * objective, three gaps that did not exist, a task count short by one, and the
 * wrong seat's handoff.
 *
 * **Nothing was broken.** Every instrument answered its own question correctly.
 * The question none of them asked was whether this tree is the current one.
 *
 * ## Why this cannot be folded into the drift line
 *
 * Drift compares the four rendered views to `state.json` **inside one tree**. It
 * is a consistency check, and a stale tree is perfectly self-consistent — which
 * is why `Drift: none` printed above a rev-50 record while master carried 52.
 * The two lines answer different questions and must be readable as different
 * questions, so every message here names `origin/master` explicitly and says the
 * word "drift" to disclaim it. A reader who sees a green drift line next to this
 * one must not be able to take either as the other's confirmation.
 *
 * ## The limit, stated in the output rather than in a comment
 *
 * **This reads the remote-tracking ref and never the network.** A greeting must
 * not do network I/O — it runs on every session, it would block on a slow or
 * absent remote, and a hook that fails a session start is worse than a stale
 * comparison. So `origin/master` here means *whatever the last `git fetch` left
 * behind*, and a tree that has not fetched for a week compares itself against a
 * week-old reference and reports "current".
 *
 * That is G-034's shape — `build-freshness` PASS means "matches this checkout",
 * not "is current" — and the only defence against repeating it is to say so in
 * the line itself. Every non-skip result carries the age of the reference it
 * used, so "current" can never be read as "current as of now".
 */

export type TreeCurrencySeverity =
  | "current"
  | "behind"
  | "ahead"
  | "diverged"
  | "record-behind"
  | "skip";

export interface TreeCurrency {
  severity: TreeCurrencySeverity;
  /**
   * Ready to print, in order. **Never empty**, including when the tree is
   * current.
   *
   * A silent pass here would make "this tree is level with master" and "this
   * check did not run" render identically, which is the one failure family this
   * repo keeps paying for. The drift line sets the precedent and states the
   * reason in `handleStart`: an explicit "none" keeps an empty result
   * observable. This follows it rather than following `derived-artifacts.ts`,
   * whose silence rule exists because that hook runs in every project on the
   * machine and most have no derived artifacts at all. Every project with a
   * record has a currency answer.
   */
  lines: string[];
  /** Commits on the upstream ref that this HEAD does not have. Null when not compared. */
  headBehind: number | null;
  /** Commits on this HEAD that the upstream ref does not have. Null when not compared. */
  headAhead: number | null;
  /** `.agents/state.json` revision in this working tree; null when absent or unparseable. */
  recordRevisionHere: number | null;
  /** The same file's revision at the upstream ref; null when absent or unparseable. */
  recordRevisionUpstream: number | null;
  upstreamRef: string;
  /** Set exactly when severity is "skip". Never null on a skip (rule: skip is not pass). */
  skipReason: string | null;
  /** ISO timestamp of the last fetch, or null when it cannot be determined. */
  lastFetchAt: string | null;
}

export interface TreeCurrencyOptions {
  /** Defaults to `origin/master`. */
  upstreamRef?: string;
  /**
   * The result of the `git fetch --prune origin` the CALLER just made (T-208).
   * Only the SessionStart hook fetches; ob_start and /sync compare against
   * whatever fetch is on disk and say so. When this is a failure, no line below
   * says `level` without the FAILED qualifier in front of it.
   */
  fetch?: FetchResult;
}

export interface FetchResult {
  ok: boolean;
  /** ISO time the fetch finished. */
  at: string;
  /** Why it failed; null when ok. */
  cause: string | null;
}

/** Bounded: a fetch that cannot finish must not hold up a session start. */
export const FETCH_TIMEOUT_MS = 15_000;

/**
 * `git fetch --prune origin`, bounded (T-208). The evidence: a /start printed
 * "level with origin/master" against a ref nobody had refreshed, while master
 * was 16 revisions ahead. The hook owns the fetch so the comparison is made
 * against a fetch that just happened, or says that it did not. --prune is part
 * of the contract: an unpruned remote-tracking ref reads a deleted branch as
 * present. Never throws; GIT_TERMINAL_PROMPT=0 so a credential prompt cannot
 * hang it.
 */
export function fetchOrigin(projectRoot: string, timeoutMs: number = FETCH_TIMEOUT_MS): FetchResult {
  // --no-write-fetch-head: git truncates FETCH_HEAD even when a fetch FAILS, which
  // made the failed attempt's time read as "the last fetch" (QA 254 rows 3b, 5).
  // The last SUCCESSFUL fetch is recorded by markFetch below instead.
  const r = spawnSync("git", ["fetch", "--prune", "--no-write-fetch-head", "origin"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: timeoutMs,
    killSignal: "SIGKILL",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  const at = new Date().toISOString();
  let result: FetchResult;
  if (r.error) {
    const timedOut = (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
    result = { ok: false, at, cause: timedOut ? `timed out after ${timeoutMs} ms` : r.error.message };
  } else if (r.status !== 0) {
    result = { ok: false, at, cause: informativeLine(r.stderr ?? "") ?? `git fetch exited ${r.status}` };
  } else {
    result = { ok: true, at, cause: null };
  }
  markFetch(projectRoot, result);
  return result;
}

/**
 * The cause of a failed fetch. git's LAST stderr line is "and the repository
 * exists." for every SSH failure and a missing path alike, which names nothing;
 * the informative line is the first `fatal:` or `error:` one.
 */
export function informativeLine(stderr: string): string | null {
  const lines = stderr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.find((l) => /^(fatal|error):/i.test(l)) ?? lines[lines.length - 1] ?? null;
}

const OK_MARKER = "sia-fetch-ok";
const FAILED_MARKER = "sia-fetch-failed";

function commonDirOf(projectRoot: string): string | null {
  const d = git(projectRoot, ["rev-parse", "--git-common-dir"]);
  return d === null ? null : isAbsolute(d) ? d : join(projectRoot, d);
}

/**
 * Persist the outcome so ob_start and /sync, which do not fetch, can tell that the
 * LAST start fetch failed. Success writes the ok marker (its mtime is the last
 * successful fetch) and clears the failure; failure writes only the failure.
 * Best effort: a marker that cannot be written degrades to the old behaviour,
 * never to a crash.
 */
function markFetch(projectRoot: string, f: FetchResult): void {
  const dir = commonDirOf(projectRoot);
  if (dir === null) return;
  try {
    if (f.ok) {
      writeFileSync(join(dir, OK_MARKER), f.at + "\n");
      rmSync(join(dir, FAILED_MARKER), { force: true });
    } else {
      writeFileSync(join(dir, FAILED_MARKER), JSON.stringify({ at: f.at, cause: f.cause }) + "\n");
    }
  } catch {
    /* see above */
  }
}

/** The last start fetch's failure, if it is newer than the last successful fetch. */
function readPersistedFailure(projectRoot: string, lastFetchAt: string | null): FetchResult | null {
  const dir = commonDirOf(projectRoot);
  if (dir === null) return null;
  try {
    const raw = JSON.parse(readFileSync(join(dir, FAILED_MARKER), "utf8")) as { at?: unknown; cause?: unknown };
    if (typeof raw.at !== "string" || typeof raw.cause !== "string") return null;
    if (lastFetchAt !== null && lastFetchAt >= raw.at) return null; // a later fetch succeeded
    return { ok: false, at: raw.at, cause: raw.cause };
  } catch {
    return null;
  }
}

const STATE_REL = ".agents/state.json";

export function describeTreeCurrency(projectRoot: string, options: TreeCurrencyOptions = {}): TreeCurrency {
  const result = compare(projectRoot, options);
  // The caller's own fetch wins; callers that do not fetch (ob_start, /sync) still
  // learn that the last start fetch FAILED from the persisted marker.
  const f = options.fetch ?? readPersistedFailure(projectRoot, result.lastFetchAt);
  if (f === null || f.ok) return result;
  // A failed fetch: the comparison is against an OLD ref. The FAILED line leads,
  // and nothing below may read as current (T-208: never 'level' unqualified).
  const failed = `fetch FAILED: ${f.cause}; currency is against a fetch from ${result.lastFetchAt ?? "an unknown time"}`;
  const rev = (n: number | null) => (n === null ? "no record" : `rev ${n}`);
  const body =
    result.severity === "current"
      ? [
          `Tree currency: no difference seen against ${result.upstreamRef} (record here ${rev(result.recordRevisionHere)}, ` +
            `at ${result.upstreamRef} ${rev(result.recordRevisionUpstream)}) as of that old fetch, and not confirmed since. ` +
            `Not the drift line: drift compares the rendered views to ${STATE_REL} within this tree.`,
        ]
      : result.lines.map((l) =>
          l
            .replace("although the commits are level with", "although the commits show no difference from")
            .replace("Not stale; local work is not yet on master.", "Not confirmed against a fresh fetch; local work is not yet on master.")
        );
  return { ...result, lines: [failed, ...body] };
}

function compare(projectRoot: string, options: TreeCurrencyOptions): TreeCurrency {
  const upstreamRef = options.upstreamRef ?? "origin/master";

  const skip = (skipReason: string): TreeCurrency => ({
    severity: "skip",
    // "not a pass" is in the text, not only in the severity, because this line
    // is read by a human in a greeting and a skip that reads like silence is
    // indistinguishable from a clean result.
    lines: [`Tree currency: NOT CHECKED — ${skipReason}. This is not a pass.`],
    headBehind: null,
    headAhead: null,
    recordRevisionHere: readRevisionFromDisk(projectRoot),
    recordRevisionUpstream: null,
    upstreamRef,
    skipReason,
    lastFetchAt: null,
  });

  if (git(projectRoot, ["rev-parse", "--is-inside-work-tree"]) !== "true") {
    return skip(`${projectRoot} is not inside a git work tree`);
  }
  if (git(projectRoot, ["rev-parse", "--verify", "--quiet", `${upstreamRef}^{commit}`]) === null) {
    return skip(`${upstreamRef} does not exist in this checkout — nothing to compare against`);
  }

  // left = commits only on upstream (we are behind by these)
  // right = commits only on HEAD (we are ahead by these)
  const counts = git(projectRoot, ["rev-list", "--left-right", "--count", `${upstreamRef}...HEAD`]);
  if (counts === null) return skip(`could not count commits between HEAD and ${upstreamRef}`);
  const parts = counts.split(/\s+/);
  const headBehind = Number.parseInt(parts[0], 10);
  const headAhead = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(headBehind) || !Number.isFinite(headAhead)) {
    return skip(`git returned an uncountable comparison against ${upstreamRef}: ${JSON.stringify(counts)}`);
  }

  const recordRevisionHere = readRevisionFromDisk(projectRoot);
  const recordRevisionUpstream = readRevisionAtRef(projectRoot, upstreamRef);
  const lastFetchAt = readLastFetchAt(projectRoot);

  const severity = classify(headBehind, headAhead, recordRevisionHere, recordRevisionUpstream);
  const lines = describe(severity, {
    headBehind,
    headAhead,
    recordRevisionHere,
    recordRevisionUpstream,
    upstreamRef,
    lastFetchAt,
  });

  return {
    severity,
    lines,
    headBehind,
    headAhead,
    recordRevisionHere,
    recordRevisionUpstream,
    upstreamRef,
    skipReason: null,
    lastFetchAt,
  };
}

function classify(
  behind: number,
  ahead: number,
  revHere: number | null,
  revUpstream: number | null
): TreeCurrencySeverity {
  if (behind > 0 && ahead > 0) return "diverged";
  if (behind > 0) return "behind";
  if (ahead > 0) return "ahead";
  // The commit graph is level. The record can still disagree — a reverted or
  // hand-edited state.json is level on commits and behind on content — so the
  // revisions are compared on their own rather than inferred from the graph.
  if (revHere !== null && revUpstream !== null && revHere < revUpstream) return "record-behind";
  return "current";
}

interface DescribeInput {
  headBehind: number;
  headAhead: number;
  recordRevisionHere: number | null;
  recordRevisionUpstream: number | null;
  upstreamRef: string;
  lastFetchAt: string | null;
}

function describe(severity: TreeCurrencySeverity, d: DescribeInput): string[] {
  const rev = (n: number | null) => (n === null ? "no record" : `rev ${n}`);
  const records = `record here ${rev(d.recordRevisionHere)}, at ${d.upstreamRef} ${rev(d.recordRevisionUpstream)}`;
  const head = `${plural(d.headBehind, "commit")} behind`;
  const lines: string[] = [];

  switch (severity) {
    case "behind":
      lines.push(
        `THIS TREE IS STALE: ${head} ${d.upstreamRef} — ${records}. ` +
          `Anything read from the record here describes an older state of the project than the one master carries.`
      );
      break;
    case "diverged":
      lines.push(
        `THIS TREE HAS DIVERGED from ${d.upstreamRef}: ${head}, ${plural(d.headAhead, "commit")} ahead — ${records}.`
      );
      break;
    case "ahead":
      lines.push(
        `This tree is ${plural(d.headAhead, "commit")} ahead of ${d.upstreamRef} and behind by none — ${records}. ` +
          `Not stale; local work is not yet on master.`
      );
      break;
    case "record-behind":
      lines.push(
        `THE RECORD HERE IS BEHIND although the commits are level with ${d.upstreamRef} — ${records}. ` +
          `The working copy of ${STATE_REL} does not match the one master carries.`
      );
      break;
    case "current":
      // One compact line rather than three: there is nothing to act on, but
      // both caveats still apply and are the reason a green here is worth less
      // than it looks. Kept on one line so a healthy greeting stays short while
      // remaining distinguishable from a check that did not run.
      lines.push(
        `Tree currency: level with ${d.upstreamRef} (${records}) — compared against the last fetch ` +
          `(${d.lastFetchAt ?? "fetch time unknown"}), not the network. Not the drift line: drift compares the ` +
          `rendered views to ${STATE_REL} within this tree.`
      );
      return lines;
  }

  // Both disclaimers ride on every ACTIONABLE result, because both are ways this
  // line can be believed further than it deserves.
  lines.push(
    `  This compares THIS CHECKOUT to ${d.upstreamRef}. It is not the drift line: ` +
      `drift compares the rendered views to ${STATE_REL} within this tree, and a stale tree is perfectly self-consistent.`
  );
  lines.push(`  Compared against the last fetch (${d.lastFetchAt ?? "fetch time unknown"}), not the network — run \`git fetch origin\` to refresh the comparison.`);
  return lines;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/** The revision in the working tree's state.json, or null when absent/unparseable. */
function readRevisionFromDisk(projectRoot: string): number | null {
  const path = join(projectRoot, STATE_REL);
  if (!existsSync(path)) return null;
  try {
    return revisionOf(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** The same file's revision at a ref, or null when absent/unparseable there. */
function readRevisionAtRef(projectRoot: string, ref: string): number | null {
  const text = git(projectRoot, ["show", `${ref}:${STATE_REL}`]);
  return text === null ? null : revisionOf(text);
}

/**
 * Null and 0 are different answers and must stay different: a missing record
 * reported as revision 0 is the silent-zero shape, and it would make an absent
 * file look like the oldest possible record rather than like no record.
 *
 * The strict schema is tried first so the number carries the same validation the
 * rest of the system applies. A file that does not validate still has a usable
 * revision for THIS comparison, so a bare numeric read is the fallback — but a
 * non-numeric or absent `revision` yields null, never a default.
 */
function revisionOf(text: string): number | null {
  const parsed = parseState(text);
  if (parsed.ok) return parsed.data.revision;
  try {
    const raw = JSON.parse(text) as { revision?: unknown };
    return typeof raw.revision === "number" && Number.isInteger(raw.revision) ? raw.revision : null;
  } catch {
    return null;
  }
}

/**
 * When the remote-tracking refs were last refreshed. FETCH_HEAD's mtime is the
 * closest thing git offers; it is resolved through `--git-path` because in a
 * LINKED WORKTREE the per-worktree git dir is not `.git` and FETCH_HEAD lives in
 * the common dir. Every seat checkout in this repo is a linked worktree, so a
 * hardcoded `.git/FETCH_HEAD` would return null in exactly the trees this runs in.
 */
function readLastFetchAt(projectRoot: string): string | null {
  // TWO candidates, and the answer is the NEWER of them. Measured, because two
  // guesses in a row were wrong here:
  //
  // 1. `--git-path FETCH_HEAD` is per-worktree. In an ordinary clone it returns
  //    the RELATIVE `.git/FETCH_HEAD`; in a linked worktree it returns an
  //    ABSOLUTE `C:/.../.git/worktrees/<name>/FETCH_HEAD` — which exists only if
  //    a fetch was run FROM that worktree. Hence `isAbsolute` rather than a
  //    leading-"/" test: a Windows absolute path does not start with "/", so the
  //    first version joined it onto the project root and reported "fetch time
  //    unknown" in every seat checkout in this repo.
  // 2. The remote-tracking refs themselves live in the COMMON dir and are updated
  //    by a fetch from ANY worktree, which also writes the common dir's
  //    FETCH_HEAD. A worktree that has never fetched on its own still has a
  //    perfectly current `origin/master` because a sibling fetched.
  //
  // Reporting only (1) would call a freshly-refreshed worktree "unknown";
  // reporting only (2) would miss a fetch run from this worktree. The newer of
  // the two is the last time THIS checkout's view of the remote moved.
  const candidates: string[] = [];
  const perWorktree = git(projectRoot, ["rev-parse", "--git-path", "FETCH_HEAD"]);
  if (perWorktree !== null) candidates.push(isAbsolute(perWorktree) ? perWorktree : join(projectRoot, perWorktree));
  const commonDir = git(projectRoot, ["rev-parse", "--git-common-dir"]);
  if (commonDir !== null) candidates.push(join(isAbsolute(commonDir) ? commonDir : join(projectRoot, commonDir), "FETCH_HEAD"));

  // The success marker (written by fetchOrigin) is a third candidate.
  if (commonDir !== null) candidates.push(join(isAbsolute(commonDir) ? commonDir : join(projectRoot, commonDir), OK_MARKER));

  let newest: number | null = null;
  for (const c of candidates) {
    try {
      const st = statSync(c);
      // An EMPTY FETCH_HEAD is a failed fetch's truncation, not a fetch (QA 254 3b).
      if (st.size === 0) continue;
      if (newest === null || st.mtimeMs > newest) newest = st.mtimeMs;
    } catch {
      /* a candidate that does not exist is not an error: none is required */
    }
  }
  return newest === null ? null : new Date(newest).toISOString();
}

/**
 * execFileSync with an args array: no shell, so arguments reach git verbatim.
 * `origin/master^{commit}` built as a shell string loses its `^` to cmd.exe —
 * the same defect checks.ts records, and this module uses that exact revspec.
 */
function git(cwd: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}
