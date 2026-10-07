/**
 * T179-2: a session that ends with committed loop work and no handoff says so.
 *
 * Aaron, record session 109: "before clear, always have the agent write the
 * handoff". The case that prompted it: a sia-infra session built T-183 round 2
 * (dd68ece, six mutants and their CI runs) and was cleared before writing
 * t183-r2-developer-handoff.md, so its reasoning is lost. `/clear` fires
 * SessionEnd, so the SessionEnd hook is where this is checked.
 *
 * IT WARNS AND NEVER BLOCKS. A hook that fails at /clear traps the user, so
 * every path here is caught and the hook exits 0 whatever happens. The warning
 * is printed, and appended to a local marker that the NEXT session's
 * SessionStart greeting prints once — the durable half, because whether a
 * SessionEnd hook's output reaches a human is up to the host.
 *
 * ## How "this session's" commits are found — and what that misses
 *
 * By TIME AND TRAILER (T-212): the session's start is the first timestamp in its own
 * transcript (the hook payload's `transcript_path`), and a commit is this session's
 * when its committer date is at or after that start, it is on a local `loop/*`
 * branch and not on origin/master, AND its `Claude-Session:` trailer names this
 * session. A commit with no trailer is UNATTRIBUTED: counted apart, never assigned
 * to the checkout's seat by git identity (seats share one identity). What this misses,
 * stated rather than hidden:
 * - a commit made without the trailer by this session is not counted as its work;
 * - a commit whose committer date predates the window (amended or rebased from
 *   older work) is not counted;
 * - a handoff committed under a name that does not end `-handoff.md`, or outside
 *   `docs/loops/`, is not recognised, and the session is warned anyway;
 * - an UNCOMMITTED handoff does not count: it is not in the record either;
 * - no transcript (the per-launch failure in G-044's amendment) means no start
 *   time, and the check says it did not run rather than passing.
 *
 * The rule is per SESSION, not per branch: a session that committed on
 * `loop/x-redcheck` and `loop/x-mut-*` and wrote its handoff on `loop/x` is
 * fine. Checking per branch would warn on every red-check and mutant branch.
 */
import { appendFileSync, existsSync, openSync, readSync, closeSync, readFileSync, unlinkSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { checkRecordUpdated, scanSessionWork } from "./end-record-guard.js";

export const MARKER_REL = ".agents/SESSIONS/.missing-handoff.jsonl";
const SHOWN_REL = ".agents/SESSIONS/.missing-handoff.shown.jsonl";
const HANDOFF_RE = /^docs\/loops\/.*-handoff\.md$/;

export interface HandoffCheck {
  /** ok: work with a handoff · missing: work, no handoff · no-work: nothing committed on loop/* · unknown: could not run */
  status: "ok" | "missing" | "no-work" | "unknown";
  since: string | null;
  /** loop/* branches holding at least one of this session's commits. */
  branches: string[];
  /** Distinct commits counted (a commit on two branches counts once). */
  commits: number;
  /** docs/loops/*-handoff.md paths this session's commits added or modified. */
  handoffs: string[];
  /** Commits in the window on loop/* with NO Claude-Session trailer: reported, never counted for any seat (T-212). */
  unattributed: number;
  reason?: string;
}

/**
 * The session's start: the first `timestamp` in its transcript. Reads the head
 * of the file only — a transcript can be tens of megabytes.
 */
export function sessionStartFromTranscript(path: unknown): string | null {
  if (typeof path !== "string" || !path || !existsSync(path)) return null;
  let text = "";
  try {
    const fd = openSync(path, "r");
    try {
      const buf = Buffer.alloc(256 * 1024);
      const n = readSync(fd, buf, 0, buf.length, 0);
      text = buf.subarray(0, n).toString("utf8");
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const t = (JSON.parse(line) as { timestamp?: unknown }).timestamp;
      if (typeof t === "string" && !Number.isNaN(Date.parse(t))) return new Date(t).toISOString();
    } catch {
      /* a truncated last line in the buffer; keep looking */
    }
  }
  return null;
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
}

/**
 * The ids a commit's `Claude-Session:` trailer can carry for this session (T-212).
 * The trailer is `https://claude.ai/code/session_<X>`; the transcript records the
 * same session as a `bridge-session` line whose `bridgeSessionId` is `cse_<X>`.
 * Reads the head of the file only, like sessionStartFromTranscript.
 */
export function sessionIdsFromTranscript(path: unknown): string[] {
  if (typeof path !== "string" || !path || !existsSync(path)) return [];
  const ids = new Set<string>();
  try {
    const fd = openSync(path, "r");
    try {
      const buf = Buffer.alloc(256 * 1024);
      const n = readSync(fd, buf, 0, buf.length, 0);
      for (const m of buf.subarray(0, n).toString("utf8").matchAll(/"bridgeSessionId"\s*:\s*"cse_([A-Za-z0-9]+)"/g)) ids.add(m[1]!);
    } finally {
      closeSync(fd);
    }
  } catch {
    return [];
  }
  return [...ids];
}

/** Did this session commit work (E1, any branch), and is the record or a loop handoff in place? */
export function checkSessionHandoff(
  projectDir: string,
  since: string | null,
  sessionIds: readonly string[] = [],
  sessionUuid: string = "",
): HandoffCheck {
  const base: HandoffCheck = { status: "unknown", since, branches: [], commits: 0, handoffs: [], unattributed: 0 };
  const work = scanSessionWork(projectDir, since, sessionIds);
  if (work.status === "unknown") return { ...base, reason: work.reason };
  const handoffs = new Set<string>();
  if (work.status === "ok" && sessionUuid) {
    const record = checkRecordUpdated(projectDir, since, sessionUuid, sessionIds);
    if (record.updated) {
      handoffs.add(record.detail);
      return {
        ...base,
        status: "ok",
        branches: work.branches,
        commits: work.commits,
        handoffs: [...handoffs].sort(),
        unattributed: work.unattributed,
      };
    }
  }
  if (work.status === "ok" && since !== null && sessionIds.filter(Boolean).length > 0) {
    let loopBranches: string[];
    try {
      loopBranches = git(projectDir, ["for-each-ref", "--format=%(refname:short)", "refs/heads/loop/"]).split(/\r?\n/).filter(Boolean);
    } catch {
      return { ...base, reason: "git could not list local loop branches here" };
    }
    const ids = sessionIds.filter(Boolean);
    for (const b of loopBranches) {
      const rows = git(projectDir, ["log", `--since=${since}`, "--format=%H%x1f%(trailers:key=Claude-Session,valueonly,separator=%x20)%x1e", b]);
      for (const row of rows.split("\x1e")) {
        const [sha, trailer = ""] = row.trim().split("\x1f");
        if (!sha || !ids.some((id) => trailer.includes(id))) continue;
        const names = git(projectDir, ["show", "--format=", "--name-only", "--diff-filter=AM", sha, "--", "docs/loops"]);
        for (const n of names.split(/\r?\n/)) if (HANDOFF_RE.test(n.trim())) handoffs.add(n.trim());
      }
    }
  }
  const status = work.commits === 0 ? "no-work" : handoffs.size > 0 ? "ok" : "missing";
  return {
    ...base,
    status,
    branches: work.branches,
    commits: work.commits,
    handoffs: [...handoffs].sort(),
    unattributed: work.unattributed,
  };
}

/** The warning, in words a human reading a hook's output can act on. */
export function describeMissing(c: HandoffCheck, sessionId: string): string {
  return (
    `HANDOFF MISSING: session ${sessionId || "(no id)"} committed ${c.commits} commit(s) on ${c.branches.join(", ")} ` +
    `since ${c.since} and committed no docs/loops/*-handoff.md. Its reasoning is not in any file. ` +
    `Write and push the handoff before the next /clear (Aaron, record session 109).`
  );
}

/** Append the warning where the next session's greeting will show it. Never throws. */
export function recordMissingHandoff(projectDir: string, sessionId: string, c: HandoffCheck): void {
  try {
    const path = join(projectDir, MARKER_REL);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify({ at: new Date().toISOString(), session: sessionId || null, message: describeMissing(c, sessionId), branches: c.branches, commits: c.commits, since: c.since }) + "\n");
  } catch {
    /* best effort — the printed warning still stands */
  }
}

/**
 * The recorded warnings, for the greeting — each shown ONCE: the marker is moved
 * aside after reading, so a warning is not repeated into every later session.
 * Never throws.
 */
export function takeMissingHandoffNotices(projectDir: string): string[] {
  const path = join(projectDir, MARKER_REL);
  if (!existsSync(path)) return [];
  try {
    const out: string[] = [];
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const m = (JSON.parse(line) as { message?: unknown }).message;
        if (typeof m === "string") out.push(m);
      } catch {
        out.push(`HANDOFF MISSING (unreadable marker line): ${line.slice(0, 200)}`);
      }
    }
    appendFileSync(join(projectDir, SHOWN_REL), text);
    unlinkSync(path);
    return out;
  } catch {
    return [];
  }
}
