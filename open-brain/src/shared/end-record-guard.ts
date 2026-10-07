/**
 * T-246 END-FIX: /end must leave a record that matches the session (E1–E4).
 *
 * E1 — session work on any local branch (Claude-Session trailer), plus tags and
 * package.json version bumps. E2 — record updated (new layout handoff / sessions[],
 * old layout next-session.md mtime, loop docs/loops handoff). E3 — ob_end refuses
 * when there is work and no record (unless record_ok). E4 — SessionEnd re-checks
 * from ob_end time and marks work-after-/end without blocking.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { readState } from "./state-writer.js";

export const WORK_AFTER_MARKER_REL = ".agents/SESSIONS/.work-after-end.jsonl";
export const WORK_AFTER_SHOWN_REL = ".agents/SESSIONS/.work-after-end.shown.jsonl";
export const RECORD_OK_MARKER_REL = ".agents/SESSIONS/.record-ok.jsonl";
export const RECORD_OK_SHOWN_REL = ".agents/SESSIONS/.record-ok.shown.jsonl";
export const OB_END_STAMP_REL = ".agents/SESSIONS/.ob-end-stamp.json";

export const OLD_LAYOUT_LINE =
  "OLD LAYOUT: nothing writes the handoff for you; update next-session.md, or import the record (state import).";

const HANDOFF_PATH_RE = /^docs\/loops\/.*-handoff\.md$/;

export interface SessionWorkScan {
  status: "ok" | "no-work" | "unknown";
  since: string | null;
  branches: string[];
  commits: number;
  commitShas: string[];
  tags: string[];
  versionBump: boolean;
  unattributed: number;
  reason?: string;
}

export interface RecordCheck {
  updated: boolean;
  layout: "new" | "old" | "none";
  detail: string;
}

export interface EndRecordEvaluation {
  work: SessionWorkScan;
  record: RecordCheck;
  needsRecord: boolean;
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function listLocalBranches(projectDir: string): string[] | null {
  try {
    return git(projectDir, ["for-each-ref", "--format=%(refname:short)", "refs/heads/"])
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return null;
  }
}

function sessionIdsOk(sessionIds: readonly string[]): string | null {
  const ids = sessionIds.filter(Boolean);
  if (ids.length === 0) {
    return "this session's Claude-Session id could not be read from its transcript, so its commits cannot be told from another seat's (a commit is attributed by its trailer, never by git identity)";
  }
  return null;
}

/**
 * E1 work measure — all local branches, not only loop/*.
 */
export function scanSessionWork(
  projectDir: string,
  since: string | null,
  sessionIds: readonly string[] = [],
): SessionWorkScan {
  const base: SessionWorkScan = {
    status: "unknown",
    since,
    branches: [],
    commits: 0,
    commitShas: [],
    tags: [],
    versionBump: false,
    unattributed: 0,
  };
  if (since === null) {
    return {
      ...base,
      reason: "this session's start could not be read from its transcript, so its commits cannot be told from anyone else's",
    };
  }
  const idErr = sessionIdsOk(sessionIds);
  if (idErr) return { ...base, reason: idErr };

  const branches = listLocalBranches(projectDir);
  if (branches === null) return { ...base, reason: "git could not list local branches here" };

  const ids = sessionIds.filter(Boolean);
  const mine = new Set<string>();
  const unattributed = new Set<string>();
  const withWork = new Set<string>();

  for (const b of branches) {
    const rows = git(projectDir, [
      "log",
      `--since=${since}`,
      "--format=%H%x1f%(trailers:key=Claude-Session,valueonly,separator=%x20)%x1e",
      b,
    ]);
    for (const row of rows.split("\x1e")) {
      const [sha, trailer = ""] = row.trim().split("\x1f");
      if (!sha) continue;
      if (trailer.trim() === "") {
        unattributed.add(sha);
        continue;
      }
      if (!ids.some((id) => trailer.includes(id))) continue;
      mine.add(sha);
      withWork.add(b);
    }
  }

  const tags: string[] = [];
  if (mine.size > 0) {
    try {
      for (const line of git(projectDir, ["tag", "-l"]).split(/\r?\n/)) {
        const tag = line.trim();
        if (!tag) continue;
        let tip: string;
        try {
          tip = git(projectDir, ["rev-parse", `${tag}^{commit}`]).trim();
        } catch {
          continue;
        }
        if (mine.has(tip)) tags.push(tag);
      }
    } catch {
      /* no tags */
    }
  }

  let versionBump = false;
  for (const sha of mine) {
    try {
      const diff = git(projectDir, ["show", "--format=", "-p", sha, "--", "package.json"]);
      if (/^[-+].*"version"\s*:/m.test(diff) || /^[-+].*version\s*:/m.test(diff)) {
        versionBump = true;
        break;
      }
    } catch {
      /* no package.json in commit */
    }
  }

  const status = mine.size === 0 ? "no-work" : "ok";
  return {
    ...base,
    status,
    branches: [...withWork].sort(),
    commits: mine.size,
    commitShas: [...mine],
    tags: tags.sort(),
    versionBump,
    unattributed: unattributed.size,
  };
}

function loopHandoffsFromSessionCommits(
  projectDir: string,
  since: string | null,
  sessionIds: readonly string[],
): string[] {
  const handoffs = new Set<string>();
  const branches = listLocalBranches(projectDir);
  if (!branches || since === null || sessionIds.filter(Boolean).length === 0) return [];
  const ids = sessionIds.filter(Boolean);
  for (const b of branches) {
    if (!b.startsWith("loop/")) continue;
    const rows = git(projectDir, [
      "log",
      `--since=${since}`,
      "--format=%H%x1f%(trailers:key=Claude-Session,valueonly,separator=%x20)%x1e",
      b,
    ]);
    for (const row of rows.split("\x1e")) {
      const [sha, trailer = ""] = row.trim().split("\x1f");
      if (!sha || !ids.some((id) => trailer.includes(id))) continue;
      const names = git(projectDir, ["show", "--format=", "--name-only", "--diff-filter=AM", sha, "--", "docs/loops"]);
      for (const n of names.split(/\r?\n/)) if (HANDOFF_PATH_RE.test(n.trim())) handoffs.add(n.trim());
    }
  }
  return [...handoffs].sort();
}

/**
 * E2 — whether the project record reflects this session.
 */
export function checkRecordUpdated(
  projectDir: string,
  since: string | null,
  sessionUuid: string,
  sessionIds: readonly string[] = [],
): RecordCheck {
  const statePath = join(projectDir, ".agents", "state.json");
  const stateRead = existsSync(statePath) ? readState(projectDir) : { ok: false as const, error: "missing" };

  if (stateRead.ok) {
    const s = stateRead.data;
    const handoff = s.handoffs.some((h) => h.session_uuid === sessionUuid);
    const sessionRow = s.sessions.some((row) => row.uuid === sessionUuid);
    if (handoff) {
      return { updated: true, layout: "new", detail: `set_handoff for session ${sessionUuid}` };
    }
    if (sessionRow) {
      return { updated: true, layout: "new", detail: `record revision with session ${sessionUuid} in sessions[]` };
    }
    const loopHandoffs = loopHandoffsFromSessionCommits(projectDir, since, sessionIds);
    if (loopHandoffs.length > 0) {
      return { updated: true, layout: "new", detail: `loop handoff committed (${loopHandoffs.join(", ")})` };
    }
    return {
      updated: false,
      layout: "new",
      detail: `no set_handoff for session ${sessionUuid} and no sessions[] row for this session`,
    };
  }

  const nextPath = join(projectDir, ".agents", "SESSIONS", "next-session.md");
  const nextRel = ".agents/SESSIONS/next-session.md";
  if (existsSync(nextPath) && since !== null) {
    let committedInWindow = false;
    let lastCommitAt: string | null = null;
    try {
      const log = git(projectDir, ["log", `-1`, "--format=%cI", "--", nextRel]);
      if (log.trim()) lastCommitAt = log.trim();
      const inWindow = git(projectDir, ["log", `--since=${since}`, "--format=%H", "--", nextRel]).trim();
      committedInWindow = inWindow.length > 0;
    } catch {
      /* not a git repo */
    }
    let dirty = false;
    try {
      const status = git(projectDir, ["status", "--porcelain", "--", nextRel]);
      dirty = status.trim().length > 0;
    } catch {
      /* ignore */
    }
    if (committedInWindow || dirty) {
      return {
        updated: true,
        layout: "old",
        detail: dirty
          ? "next-session.md has uncommitted changes"
          : `next-session.md committed during the session (since ${since})`,
      };
    }
    if (lastCommitAt && Date.parse(lastCommitAt) >= Date.parse(since)) {
      const mtime = statSync(nextPath).mtime.toISOString();
      return { updated: true, layout: "old", detail: `next-session.md last committed at ${lastCommitAt}` };
    }
    const mtime = statSync(nextPath).mtime.toISOString();
    if (Date.parse(mtime) >= Date.parse(since) && dirty) {
      return { updated: true, layout: "old", detail: `next-session.md modified at ${mtime}` };
    }
    const loopHandoffs = loopHandoffsFromSessionCommits(projectDir, since, sessionIds);
    if (loopHandoffs.length > 0) {
      return { updated: true, layout: "old", detail: `loop handoff committed (${loopHandoffs.join(", ")})` };
    }
    return { updated: false, layout: "old", detail: `next-session.md not modified since session start (${since})` };
  }

  const loopHandoffs = loopHandoffsFromSessionCommits(projectDir, since, sessionIds);
  if (loopHandoffs.length > 0) {
    return { updated: true, layout: "none", detail: `loop handoff committed (${loopHandoffs.join(", ")})` };
  }

  return {
    updated: false,
    layout: existsSync(join(projectDir, ".agents")) ? "old" : "none",
    detail: existsSync(nextPath) ? "next-session.md unchanged" : "no .agents layout detected",
  };
}

export function evaluateEndRecord(
  projectDir: string,
  since: string | null,
  sessionUuid: string,
  sessionIds: readonly string[] = [],
): EndRecordEvaluation {
  const work = scanSessionWork(projectDir, since, sessionIds);
  const record = checkRecordUpdated(projectDir, since, sessionUuid, sessionIds);
  const needsRecord = work.status === "ok" && !record.updated;
  return { work, record, needsRecord };
}

export function describeRecordNotUpdated(
  work: SessionWorkScan,
  record: RecordCheck,
  sinceAnchor: string,
): string {
  const tagPart = work.tags.length ? `, tags ${work.tags.join(", ")}` : "";
  const verPart = work.versionBump ? ", package.json version changed" : "";
  const unPart =
    work.unattributed > 0
      ? `; ${work.unattributed} commit(s) in the window carry no Claude-Session trailer (UNATTRIBUTED, not counted)`
      : "";
  return (
    `RECORD NOT UPDATED: ${work.commits} commit(s)${tagPart}${verPart} since ${sinceAnchor} (${record.detail})${unPart}. ` +
    `Update the record (ob_state set_handoff, ob_state ops that write sessions[], or next-session.md on the old layout), or pass record_ok with a reason to close anyway.`
  );
}

export interface ObEndStamp {
  session: string;
  ob_end_at: string;
  record_ok?: string | null;
}

export function writeObEndStamp(projectDir: string, stamp: ObEndStamp): void {
  const path = join(projectDir, OB_END_STAMP_REL);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(stamp, null, 2) + "\n", "utf8");
}

export function readObEndStamp(projectDir: string): ObEndStamp | null {
  const path = join(projectDir, OB_END_STAMP_REL);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ObEndStamp;
  } catch {
    return null;
  }
}

export function recordRecordOkNotice(projectDir: string, sessionId: string, reason: string): void {
  try {
    const path = join(projectDir, RECORD_OK_MARKER_REL);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(
      path,
      JSON.stringify({
        at: new Date().toISOString(),
        session: sessionId,
        message: `RECORD OK: session ${sessionId} closed without a matching record update — ${reason}`,
      }) + "\n",
    );
  } catch {
    /* best effort */
  }
}

export function takeRecordOkNotices(projectDir: string): string[] {
  const path = join(projectDir, RECORD_OK_MARKER_REL);
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
        out.push(`RECORD OK (unreadable marker line): ${line.slice(0, 200)}`);
      }
    }
    appendFileSync(join(projectDir, RECORD_OK_SHOWN_REL), text);
    unlinkSync(path);
    return out;
  } catch {
    return [];
  }
}

export function describeWorkAfterEnd(work: SessionWorkScan, since: string): string {
  const tagPart = work.tags.length ? `, tags ${work.tags.join(", ")}` : "";
  const verPart = work.versionBump ? ", package.json version changed" : "";
  const unPart =
    work.unattributed > 0
      ? `; ${work.unattributed} commit(s) after /end carry no Claude-Session trailer (UNATTRIBUTED)`
      : "";
  return (
    `WORK AFTER /end NOT RECORDED: ${work.commits} commit(s)${tagPart}${verPart} since ob_end at ${since}${unPart}. ` +
    `Update the record before the next /clear.`
  );
}

export function recordWorkAfterEnd(projectDir: string, sessionId: string, message: string, work: SessionWorkScan): void {
  try {
    const path = join(projectDir, WORK_AFTER_MARKER_REL);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(
      path,
      JSON.stringify({
        at: new Date().toISOString(),
        session: sessionId,
        message,
        commits: work.commits,
        tags: work.tags,
      }) + "\n",
    );
  } catch {
    /* best effort */
  }
}

export function takeWorkAfterEndNotices(projectDir: string): string[] {
  const path = join(projectDir, WORK_AFTER_MARKER_REL);
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
        out.push(`WORK AFTER /end (unreadable marker line): ${line.slice(0, 200)}`);
      }
    }
    appendFileSync(join(projectDir, WORK_AFTER_SHOWN_REL), text);
    unlinkSync(path);
    return out;
  } catch {
    return [];
  }
}
