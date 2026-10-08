/**
 * T-246 END-FIX: /end must leave a record that matches the session (E1–E4).
 *
 * E1 — session work on any local branch (Claude-Session trailer), plus tags and
 * package.json version bumps. E2 — record updated (new layout handoff / sessions[],
 * old layout next-session.md mtime, loop docs/loops handoff). E3 — ob_end refuses
 * when there is work and no record (unless record_ok). E4 — SessionEnd re-checks
 * from ob_end time and marks work-after-/end without blocking.
 */
import { createHash } from "node:crypto";
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
import { join } from "node:path";
import type { State } from "./state-schema.js";
import { readState } from "./state-writer.js";
import { endRecordProjectDir } from "./end-record-store.js";

const WORK_AFTER_MARKER = ".work-after-end.jsonl";
const WORK_AFTER_SHOWN = ".work-after-end.shown.jsonl";
const RECORD_OK_MARKER = ".record-ok.jsonl";
const RECORD_OK_SHOWN = ".record-ok.shown.jsonl";
const OB_END_STAMP = ".ob-end-stamp.json";
const SHOWN_MAX_LINES = 200;

/** @deprecated paths are outside the repo; use store helpers */
export const WORK_AFTER_MARKER_REL = ".agents/SESSIONS/.work-after-end.jsonl";
export const OB_END_STAMP_REL = ".agents/SESSIONS/.ob-end-stamp.json";

function storePath(projectDir: string, name: string): string {
  return join(endRecordProjectDir(projectDir), name);
}

export function appendEndRecordShownCapped(shownPath: string, movedText: string): void {
  const prev = existsSync(shownPath) ? readFileSync(shownPath, "utf8") : "";
  const lines = (prev + movedText).split(/\r?\n/).filter((l) => l.trim());
  const kept = lines.slice(-SHOWN_MAX_LINES).join("\n");
  writeFileSync(shownPath, kept ? `${kept}\n` : "", "utf8");
}

function normalizeNextSessionText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Shared old-layout digest (stamp write and E4 check must use this). */
export function hashOldLayoutNextSessionText(raw: string): string {
  const normalized = normalizeNextSessionText(raw);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/** New-layout digest for one session only (no revision; no other sessions). */
export function hashNewLayoutSessionRecord(state: State, sessionUuid: string): string {
  const h = state.handoffs.find((x) => x.session_uuid === sessionUuid);
  const handoff =
    h === undefined
      ? null
      : {
          loop_state: h.loop_state,
          open_questions: h.open_questions,
          pick_up: h.pick_up,
          watch_out: h.watch_out,
        };
  const row = state.sessions.find((x) => x.uuid === sessionUuid);
  const session =
    row === undefined
      ? null
      : {
          checkout: row.checkout,
          date: row.date,
          first_rev: row.first_rev,
          n: row.n,
          seat: row.seat,
          uuid: row.uuid,
        };
  const payload = { handoff, session };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/** Old layout when there is no state.json but next-session.md exists. */
export function isOldLayoutProject(projectDir: string): boolean {
  if (existsSync(join(projectDir, ".agents", "state.json"))) return false;
  return existsSync(join(projectDir, ".agents", "SESSIONS", "next-session.md"));
}

export type RecordContentHash = { ok: true; hash: string; layout: "new" | "old" } | { ok: false; error: string };

/** Content fingerprint stored in the ob_end stamp (R1). */
export function computeRecordContentHash(projectDir: string, sessionUuid: string): RecordContentHash {
  const statePath = join(projectDir, ".agents", "state.json");
  if (existsSync(statePath)) {
    const stateRead = readState(projectDir);
    if (!stateRead.ok) return { ok: false, error: stateRead.error };
    const s = stateRead.data;
    const hash = hashNewLayoutSessionRecord(s, sessionUuid);
    return { ok: true, hash, layout: "new" };
  }
  const nextPath = join(projectDir, ".agents", "SESSIONS", "next-session.md");
  if (!existsSync(nextPath)) return { ok: false, error: "no record file for this layout" };
  const hash = createHash("sha256").update(nextPath).digest("hex");
  return { ok: true, hash, layout: "old" };
}

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

/** Why E4 work-after scan cannot run (R2). */
export function sessionWorkScanBlockedReason(since: string | null, sessionIds: readonly string[]): string | null {
  if (since === null) {
    return "this session's start could not be read from its transcript, so its commits cannot be told from anyone else's";
  }
  return sessionIdsOk(sessionIds);
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

function oldLayoutNextSessionUpdated(projectDir: string, since: string, changesAfter?: string | null): RecordCheck {
  const nextPath = join(projectDir, ".agents", "SESSIONS", "next-session.md");
  const nextRel = ".agents/SESSIONS/next-session.md";
  const anchor = changesAfter ?? since;
  if (!existsSync(nextPath) || anchor === null) {
    return { updated: false, layout: "old", detail: "next-session.md missing or session start unknown" };
  }
  let committedAfterAnchor = false;
  try {
    committedAfterAnchor =
      git(projectDir, ["log", `--since=${anchor}`, "--format=%H", "--", nextRel]).trim().length > 0;
  } catch {
    /* not a git repo */
  }
  let dirty = false;
  try {
    dirty = git(projectDir, ["status", "--porcelain", "--", nextRel]).trim().length > 0;
  } catch {
    /* ignore */
  }
  const mtimeMs = statSync(nextPath).mtimeMs;
  const anchorMs = Date.parse(anchor);
  const mtimeAfterAnchor = !Number.isNaN(anchorMs) && mtimeMs >= anchorMs;
  if (committedAfterAnchor || (dirty && mtimeAfterAnchor)) {
    return {
      updated: true,
      layout: "old",
      detail: dirty && !committedAfterAnchor
        ? `next-session.md modified after ${anchor}`
        : `next-session.md committed after ${anchor}`,
    };
  }
  return {
    updated: false,
    layout: "old",
    detail: `next-session.md not modified after ${anchor}`,
  };
}

function newLayoutRecordUpdated(
  projectDir: string,
  sessionUuid: string,
  since: string | null,
  sessionIds: readonly string[],
  changesAfter?: string | null,
): RecordCheck {
  const stateRead = readState(projectDir);
  if (!stateRead.ok) {
    return {
      updated: false,
      layout: "new",
      detail: `.agents/state.json unreadable (${stateRead.error})`,
    };
  }
  const s = stateRead.data;
  const handoff = s.handoffs.some((h) => h.session_uuid === sessionUuid);
  const sessionRow = s.sessions.some((row) => row.uuid === sessionUuid);
  const loopHandoffs = loopHandoffsFromSessionCommits(projectDir, changesAfter ?? since, sessionIds);

  if (handoff) {
    return { updated: true, layout: "new", detail: `set_handoff for session ${sessionUuid}` };
  }
  if (sessionRow) {
    return { updated: true, layout: "new", detail: `record revision with session ${sessionUuid} in sessions[]` };
  }
  if (loopHandoffs.length > 0) {
    return { updated: true, layout: "new", detail: `loop handoff committed (${loopHandoffs.join(", ")})` };
  }
  return {
    updated: false,
    layout: "new",
    detail: `no set_handoff for session ${sessionUuid} and no sessions[] row for this session`,
  };
}

export type CheckRecordUpdatedOptions = { /** E4: only writes after ob_end (not before). */ changesAfter?: string | null };

/**
 * E2 — whether the project record reflects this session (E3), or was updated after ob_end (E4).
 */
export function checkRecordUpdated(
  projectDir: string,
  since: string | null,
  sessionUuid: string,
  sessionIds: readonly string[] = [],
  options: CheckRecordUpdatedOptions = {},
): RecordCheck {
  const statePath = join(projectDir, ".agents", "state.json");
  if (existsSync(statePath)) {
    return newLayoutRecordUpdated(projectDir, sessionUuid, since, sessionIds, options.changesAfter);
  }

  if (since !== null) {
    const old = oldLayoutNextSessionUpdated(projectDir, since);
    if (old.updated) return old;
    const loopHandoffs = loopHandoffsFromSessionCommits(projectDir, since, sessionIds);
    if (loopHandoffs.length > 0) {
      return { updated: true, layout: "old", detail: `loop handoff committed (${loopHandoffs.join(", ")})` };
    }
    return old;
  }

  const loopHandoffs = loopHandoffsFromSessionCommits(projectDir, since, sessionIds);
  if (loopHandoffs.length > 0) {
    return { updated: true, layout: "none", detail: `loop handoff committed (${loopHandoffs.join(", ")})` };
  }

  const nextPath = join(projectDir, ".agents", "SESSIONS", "next-session.md");
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
  /** R1: record content at ob_end; E4 compares current content to this hash. */
  record_content_hash?: string;
}

/** True when record content differs from the stamp; false when equal; null when unknown. */
export function recordContentChangedSinceStamp(
  projectDir: string,
  sessionUuid: string,
  stamp: ObEndStamp,
): boolean | null {
  if (!stamp.record_content_hash) return null;
  const current = computeRecordContentHash(projectDir, sessionUuid);
  if (!current.ok) return null;
  return current.hash !== stamp.record_content_hash;
}

export function writeObEndStamp(projectDir: string, stamp: ObEndStamp): void {
  const hashRes = stamp.record_content_hash
    ? null
    : computeRecordContentHash(projectDir, stamp.session);
  const full: ObEndStamp = {
    ...stamp,
    record_content_hash:
      stamp.record_content_hash ?? (hashRes && hashRes.ok ? hashRes.hash : undefined),
  };
  const path = storePath(projectDir, OB_END_STAMP);
  writeFileSync(path, JSON.stringify(full, null, 2) + "\n", "utf8");
}

export function readObEndStamp(projectDir: string): ObEndStamp | null {
  const path = storePath(projectDir, OB_END_STAMP);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ObEndStamp;
  } catch {
    return null;
  }
}

export function recordRecordOkNotice(projectDir: string, sessionId: string, reason: string): void {
  try {
    const path = storePath(projectDir, RECORD_OK_MARKER);
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
  const path = storePath(projectDir, RECORD_OK_MARKER);
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
    appendEndRecordShownCapped(storePath(projectDir, RECORD_OK_SHOWN), text);
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
    const path = storePath(projectDir, WORK_AFTER_MARKER);
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
  const path = storePath(projectDir, WORK_AFTER_MARKER);
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
    appendEndRecordShownCapped(storePath(projectDir, WORK_AFTER_SHOWN), text);
    unlinkSync(path);
    return out;
  } catch {
    return [];
  }
}
