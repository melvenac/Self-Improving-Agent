/**
 * T-276: a session without Remote Control has no bridge id and gets no Claude-Session trailer from Claude Code. Its own
 * uuid counts as its trailer id when its transcript names it, /end and SessionEnd say what to write, and ob_start tells
 * it once. Namespace imports for the changed modules, so a missing export fails its rows, not the file.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { handleEnd } from "../src/server.js";
import { readObEndStamp, scanSessionWork } from "../src/shared/end-record-guard.js";
import * as hg from "../src/shared/handoff-guard.js";
import * as tc from "../src/pipelines/session-start/transcript-check.js";
import * as sr from "../src/pipelines/session-start/start-report.js";
import * as b from "../src/pipelines/session-start/briefing.js";
import {
  BEFORE,
  cleanupProof,
  commitAt,
  DURING,
  git,
  initOldLayoutRepo,
  initScratchDb,
  ME,
  ME_TRAILER,
  proveSessionWithTranscript,
  SESSION_UUID as U,
  START,
  text,
  touchNextSession,
  writeTranscript,
} from "./end-fix.harness.js";

vi.mock("../src/pipelines/session-start/hub-presence.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/pipelines/session-start/hub-presence.js")>();
  return { ...actual, describeHubPresence: async () => ({ lines: [], sourceRel: null, charCount: 0 }) };
});

const tsxCli = join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
const hookEntry = join(import.meta.dirname, "../src/cli-session-end.ts");
const STATE_FIXTURE = resolve(import.meta.dirname, "fixtures-state/state.json");
const OTHER_UUID = "00000276-0000-4000-8000-000000000002";
const U_TRAILER = `Claude-Session: ${U}`;
const NOTE = `this session has no Remote Control id, so Claude Code adds no trailer to its commits: end each one with the line Claude-Session: ${U}`;
const COMMIT_TRAILER_LINE = `COMMIT TRAILER: this session has no Remote Control id, so Claude Code adds no Claude-Session trailer to its commits and /end cannot attribute them. End every commit message in this session with the line: Claude-Session: ${U} (T-276).`;

function rc(dir: string): string {
  const p = join(dir, "rc.jsonl");
  writeFileSync(p, `{"timestamp":"${START}","sessionId":"${U}"}\n{"type":"bridge-session","bridgeSessionId":"cse_${ME}"}\n`);
  return p;
}

function nonRc(dir: string, uuid: string = U): string {
  const p = join(dir, `non-rc-${uuid}.jsonl`);
  writeFileSync(p, `{"timestamp":"${START}","sessionId":"${uuid}"}\n{"type":"user","sessionId":"${uuid}"}\n`);
  return p;
}

function lateBridge(dir: string): string {
  const p = join(dir, "late-bridge.jsonl");
  writeFileSync(
    p,
    `{"timestamp":"${START}","sessionId":"${U}","pad":"${"x".repeat(300000)}"}\n{"type":"bridge-session","bridgeSessionId":"cse_${ME}"}\n`,
  );
  return p;
}

/** T-276 r3: a late bridge whose FIRST record is short, as a real transcript's is, so the head still holds the session start. */
function lateBridgeShortHead(dir: string): string {
  const p = join(dir, "late-bridge-short-head.jsonl");
  writeFileSync(
    p,
    `{"timestamp":"${START}","sessionId":"${U}"}\n{"type":"user","pad":"${"x".repeat(300000)}"}\n{"type":"bridge-session","bridgeSessionId":"cse_${ME}"}\n`,
  );
  return p;
}

function hook(dir: string, payload: Record<string, unknown>): string {
  const r = spawnSync(process.execPath, [tsxCli, hookEntry], {
    cwd: dir,
    input: JSON.stringify({ hook_event_name: "SessionEnd", ...payload }),
    encoding: "utf8",
    timeout: 90_000,
    env: { ...process.env, CLAUDE_PROJECT_DIR: resolve(dir) },
  });
  expect(r.status, r.stdout + r.stderr).toBe(0);
  return r.stdout;
}

/** handoff-guard.test.ts's hook row: .agents/SESSIONS, base on master, loop/x. */
function loopRepo(dir: string): void {
  git(dir, "init", "-q", "-b", "master");
  mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
  const base = commitAt(dir, BEFORE, "README.md", "base");
  git(dir, "update-ref", "refs/remotes/origin/master", base);
  git(dir, "checkout", "-q", "-b", "loop/x");
}

describe("T-276: session trailer ids", { timeout: 180_000 }, () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t276-"));
    initScratchDb();
  });
  afterEach(() => {
    cleanupProof();
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("A1: a Remote Control transcript gives its bridge id, plus the uuid when a record names it", () => {
    expect(hg.sessionTrailerIds(rc(dir), U)).toEqual({ ids: [ME, U], source: "bridge" });
    expect(hg.sessionTrailerIds(writeTranscript(dir), U)).toEqual({ ids: [ME], source: "bridge" });
  });

  it("A2: a transcript with no bridge id that names the session gives its own uuid", () => {
    expect(hg.sessionTrailerIds(nonRc(dir), U)).toEqual({ ids: [U], source: "session" });
  });

  it("A3: none for another session's transcript, an empty uuid, a missing path, or no path", () => {
    const none = { ids: [], source: "none" };
    expect(hg.sessionTrailerIds(nonRc(dir, OTHER_UUID), U)).toEqual(none);
    expect(hg.sessionTrailerIds(nonRc(dir), "")).toEqual(none);
    expect(hg.sessionTrailerIds(join(dir, "gone.jsonl"), U)).toEqual(none);
    expect(hg.sessionTrailerIds(undefined, U)).toEqual(none);
  });

  it("A4: a bridge record past the 256 KB head is found; the head-only reader is unchanged", () => {
    const p = lateBridge(dir);
    expect(hg.sessionTrailerIds(p, U)).toEqual({ ids: [ME, U], source: "bridge" });
    expect(hg.sessionIdsFromTranscript(p)).toEqual([]);
  });

  it("B1: a bare-uuid trailer and the URL trailer both count, with no change to the matcher", () => {
    initOldLayoutRepo(dir);
    commitAt(dir, DURING, "src/a.ts", "uuid trailer", U_TRAILER);
    commitAt(dir, DURING, "src/b.ts", "url trailer", ME_TRAILER);
    commitAt(dir, DURING, "src/c.ts", "no trailer", null);
    const uuidOnly = scanSessionWork(dir, START, [U]);
    expect(uuidOnly.commits).toBe(1);
    expect(uuidOnly.unattributed).toBe(1);
    const both = scanSessionWork(dir, START, [ME, U]);
    expect(both.commits).toBe(2);
    expect(both.unattributed).toBe(1);
  });

  it("C1: describeCommitTrailer speaks only for a proven session whose transcript names it and has no bridge id", () => {
    expect(tc.describeCommitTrailer({ id: null, reason: "x" })).toBeNull();
    expect(tc.describeCommitTrailer({ id: U, pid: 1 })).toBeNull();
    expect(tc.describeCommitTrailer({ id: U, pid: 1, transcriptPath: rc(dir) })).toBeNull();
    expect(tc.describeCommitTrailer({ id: U, pid: 1, transcriptPath: nonRc(dir) })).toBe(COMMIT_TRAILER_LINE);
    expect(tc.describeCommitTrailer({ id: U, pid: 1, transcriptPath: nonRc(dir, OTHER_UUID) })).toBeNull();
    expect(tc.describeCommitTrailer({ id: U, pid: 1, transcriptPath: join(dir, "gone.jsonl") })).toBeNull();
  });

  it("D1: SessionEnd counts a bare-uuid trailer as this session's work", () => {
    loopRepo(dir);
    commitAt(dir, DURING, "src/a.ts", "work, no handoff", U_TRAILER);
    const out = hook(dir, { session_id: U, transcript_path: nonRc(dir) });
    expect(out).toContain(`HANDOFF MISSING: session ${U} committed 1 commit(s) on loop/x`);
    expect(out).not.toContain("handoff check NOT RUN");
  });

  it("D2: SessionEnd names the trailer to write when a non-Remote-Control session's commit has none", () => {
    loopRepo(dir);
    commitAt(dir, DURING, "src/a.ts", "work, no trailer", null);
    const out = hook(dir, { session_id: U, transcript_path: nonRc(dir) });
    expect(out).toContain(
      `[session-end] handoff check: no handoff or record update for this session; 1 commit(s) in the window carry no Claude-Session trailer: UNATTRIBUTED, not counted for any seat; ${NOTE}`,
    );
  });

  it("D3: a Remote Control session's UNATTRIBUTED line has no note", () => {
    loopRepo(dir);
    commitAt(dir, DURING, "src/a.ts", "work, no trailer", null);
    const out = hook(dir, { session_id: U, transcript_path: rc(dir) });
    expect(out).toContain("UNATTRIBUTED, not counted for any seat");
    expect(out).not.toContain("no Remote Control id");
  });

  async function endThenCommit(trailer: string | null): Promise<string> {
    initOldLayoutRepo(dir);
    const tr = nonRc(dir);
    proveSessionWithTranscript(dir, tr);
    touchNextSession(dir, DURING);
    const abs = resolve(dir);
    await handleEnd({ project_root: abs, session_id: U, dry_run: false, session_summary: "s" });
    const stampAt = readObEndStamp(abs)?.ob_end_at;
    expect(stampAt).toBeTruthy();
    commitAt(dir, new Date(Date.parse(stampAt!) + 2000).toISOString(), "src/after.ts", "after ob_end", trailer);
    return hook(dir, { session_id: U, transcript_path: tr });
  }

  it("E1: work after ob_end with a bare-uuid trailer is caught", async () => {
    const out = await endThenCommit(U_TRAILER);
    expect(out).toContain("WORK AFTER /end NOT RECORDED: 1 commit(s)");
    expect(out).not.toContain("work-after-end check NOT RUN");
  });

  it("E2: work after ob_end with no trailer is named UNATTRIBUTED, never 'no commits'", async () => {
    const out = await endThenCommit(null);
    expect(out).toContain(
      `[session-end] work-after-end check: no attributed commits after ob_end; 1 commit(s) after ob_end carry no Claude-Session trailer (UNATTRIBUTED); ${NOTE}`,
    );
    expect(out).not.toContain("work-after-end check: no commits after ob_end");
  });

  it("F1: ob_end's UNATTRIBUTED line names the trailer to write for a session without Remote Control", async () => {
    initOldLayoutRepo(dir);
    proveSessionWithTranscript(dir, nonRc(dir));
    commitAt(dir, DURING, "src/a.ts", "uuid trailer", U_TRAILER);
    commitAt(dir, DURING, "src/b.ts", "no trailer", null);
    touchNextSession(dir, DURING);
    const body = text(await handleEnd({ project_root: dir, session_id: U, dry_run: true }));
    expect(body).toContain(`1 commit(s) in the window carry no Claude-Session trailer (UNATTRIBUTED, not counted); ${NOTE}`);
  });

  it("F2: a Remote Control session's ob_end UNATTRIBUTED line has no note", async () => {
    initOldLayoutRepo(dir);
    proveSessionWithTranscript(dir, writeTranscript(dir));
    commitAt(dir, DURING, "src/a.ts", "url trailer", ME_TRAILER);
    commitAt(dir, DURING, "src/b.ts", "no trailer", null);
    touchNextSession(dir, DURING);
    const body = text(await handleEnd({ project_root: dir, session_id: U, dry_run: true }));
    expect(body).toContain("(UNATTRIBUTED, not counted)");
    expect(body).not.toContain("no Remote Control id");
  });

  it("F3 (r2): a late-bridge Remote Control session's ob_end UNATTRIBUTED line has no note, as the hook says", async () => {
    initOldLayoutRepo(dir);
    proveSessionWithTranscript(dir, lateBridgeShortHead(dir));
    commitAt(dir, DURING, "src/a.ts", "url trailer", ME_TRAILER);
    commitAt(dir, DURING, "src/b.ts", "no trailer", null);
    touchNextSession(dir, DURING);
    const body = text(await handleEnd({ project_root: dir, session_id: U, dry_run: true }));
    expect(body).toContain("1 commit(s) in the window carry no Claude-Session trailer (UNATTRIBUTED, not counted)");
    expect(body).not.toContain("no Remote Control id");
  });

  it("F4 (r4): a transcript that names another session gives source none, and ob_end prints no note", async () => {
    initOldLayoutRepo(dir);
    proveSessionWithTranscript(dir, nonRc(dir, OTHER_UUID));
    commitAt(dir, DURING, "src/a.ts", "uuid trailer", U_TRAILER);
    commitAt(dir, DURING, "src/b.ts", "no trailer", null);
    touchNextSession(dir, DURING);
    const body = text(await handleEnd({ project_root: dir, session_id: U, dry_run: true }));
    expect(body).toContain("1 commit(s) in the window carry no Claude-Session trailer (UNATTRIBUTED, not counted)");
    expect(body).not.toContain("no Remote Control id");
  });

  it("E3 (r2): work after ob_end with no trailer in a Remote Control session is UNATTRIBUTED with no note", async () => {
    initOldLayoutRepo(dir);
    const tr = rc(dir);
    proveSessionWithTranscript(dir, tr);
    touchNextSession(dir, DURING);
    const abs = resolve(dir);
    await handleEnd({ project_root: abs, session_id: U, dry_run: false, session_summary: "s" });
    const stampAt = readObEndStamp(abs)?.ob_end_at;
    expect(stampAt).toBeTruthy();
    commitAt(dir, new Date(Date.parse(stampAt!) + 2000).toISOString(), "src/after.ts", "after ob_end", null);
    const out = hook(dir, { session_id: U, transcript_path: tr });
    expect(out).toContain("[session-end] work-after-end check: no attributed commits after ob_end; 1 commit(s) after ob_end carry no Claude-Session trailer (UNATTRIBUTED)");
    expect(out).not.toContain("no Remote Control id");
  });
});

describe("C2: renderStartReport prints COMMIT TRAILER in the header, not the Briefing", { timeout: 120_000 }, () => {
  const made: string[] = [];
  afterAll(() => {
    for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  function tmp(prefix: string): string {
    const d = mkdtempSync(join(tmpdir(), prefix));
    made.push(d);
    return d;
  }

  function fixture(): string {
    const dir = tmp("t276-proj-");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "t276-fixture", version: "0.1.0" }));
    mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
    mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
    copyFileSync(STATE_FIXTURE, join(dir, ".agents", "state.json"));
    const g = (...a: string[]) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
    g("init", "-q");
    g("add", "-A");
    g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "fixture");
    return dir;
  }

  function split(t: string): { header: string[]; briefing: string[] } {
    const lines = t.split("\n");
    const start = lines.indexOf(b.BRIEFING_START);
    const end = lines.indexOf(b.BRIEFING_END);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return { header: lines.slice(0, start), briefing: lines.slice(start, end + 1) };
  }

  it("without Remote Control: the line right after Session ID and nowhere in the Briefing; with it: no line", async () => {
    const tmpDir = tmp("t276-tx-");
    const r = await sr.renderStartReport({
      projectRoot: fixture(),
      proven: { id: U, pid: 4242, transcriptPath: nonRc(tmpDir) },
      callerLabel: "T276",
    } as Parameters<typeof sr.renderStartReport>[0]);
    const { header, briefing } = split(r.text);
    const at = header.findIndex((l) => l.startsWith("Session ID:"));
    expect(at).toBeGreaterThan(-1);
    expect(header[at + 1]).toBe(COMMIT_TRAILER_LINE);
    expect(briefing.some((l) => l.startsWith("COMMIT TRAILER"))).toBe(false);

    const withRc = await sr.renderStartReport({
      projectRoot: fixture(),
      proven: { id: U, pid: 4242, transcriptPath: rc(tmpDir) },
      callerLabel: "T276",
    } as Parameters<typeof sr.renderStartReport>[0]);
    expect(withRc.text).not.toContain("COMMIT TRAILER");
  });

  it("C3 (r2): the log-skipped branch (no .agents/SESSIONS/) also prints COMMIT TRAILER right after Session ID", async () => {
    const tmpDir = tmp("t276-tx-");
    const dir = fixture();
    rmSync(join(dir, ".agents", "SESSIONS"), { recursive: true, force: true });
    const r = await sr.renderStartReport({
      projectRoot: dir,
      proven: { id: U, pid: 4242, transcriptPath: nonRc(tmpDir) },
      callerLabel: "T276",
    } as Parameters<typeof sr.renderStartReport>[0]);
    const { header } = split(r.text);
    const at = header.findIndex((l) => l.startsWith("Session ID:"));
    expect(at).toBeGreaterThan(-1);
    expect(header[at + 1]).toBe(COMMIT_TRAILER_LINE);
  });
});
