import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { byPidDir, processStartTime, writeProcessSession } from "../src/shared/process-session.js";
import Database from "better-sqlite3";
import { initSchemaV2 } from "../src/db-v2.js";

export const ME = "01MeMeMeMeMeMeMeMeMeMeMe";
export const ME_TRAILER = `Claude-Session: https://claude.ai/code/session_${ME}`;
export const SESSION_UUID = "00000137-0000-4000-8000-00000000me01";
export const BEFORE = "2026-09-25T10:00:00Z";
export const START = "2026-09-25T12:00:00.000Z";
export const DURING = "2026-09-25T13:00:00Z";
export const AFTER_END = "2026-09-25T14:30:00Z";

let ppidStart: string | null | undefined;

export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function commitAt(
  dir: string,
  when: string,
  file: string,
  msg: string,
  trailer: string | null = ME_TRAILER,
): string {
  mkdirSync(join(dir, file, ".."), { recursive: true });
  writeFileSync(join(dir, file), `${msg}\n`);
  git(dir, "add", "-A");
  execFileSync(
    "git",
    ["-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "-q", "-m", msg, ...(trailer === null ? [] : ["-m", trailer])],
    { cwd: dir, stdio: "ignore", env: { ...process.env, GIT_COMMITTER_DATE: when, GIT_AUTHOR_DATE: when } },
  );
  return git(dir, "rev-parse", "HEAD");
}

export function initOldLayoutRepo(dir: string): void {
  git(dir, "init", "-q", "-b", "master");
  mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
  mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
  writeFileSync(join(dir, ".agents", "SESSIONS", "next-session.md"), "# Handoff\nstale\n");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "0.1.0" }));
  const base = commitAt(dir, BEFORE, "README.md", "base");
  git(dir, "update-ref", "refs/remotes/origin/master", base);
}

export function writeTranscript(dir: string): string {
  const transcript = join(dir, "session.jsonl");
  writeFileSync(
    transcript,
    `{"timestamp":"${START}"}\n{"type":"bridge-session","bridgeSessionId":"cse_${ME}"}\n`,
  );
  return transcript;
}

export function proveSessionWithTranscript(dir: string, transcript: string): void {
  if (ppidStart === undefined) ppidStart = processStartTime(process.ppid);
  writeProcessSession(byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!), {
    session_id: SESSION_UUID,
    claude_pid: process.ppid,
    proc_start: ppidStart!,
    ide: "claude",
    written_at: new Date().toISOString(),
    transcript_path: transcript,
  });
}

export function cleanupProof(): void {
  rmSync(byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!), { recursive: true, force: true });
}

export function touchNextSession(dir: string, when: string): void {
  const p = join(dir, ".agents", "SESSIONS", "next-session.md");
  writeFileSync(p, `# Handoff\nupdated ${when}\n`);
  const t = Date.parse(when);
  utimesSync(p, t / 1000, t / 1000);
}

export function initScratchDb(): void {
  const dbPath = process.env.KNOWLEDGE_V2_DB!;
  if (!existsSync(dbPath)) {
    const db = new Database(dbPath);
    initSchemaV2(db);
    db.close();
  }
}

export function text(res: { content: { text: string }[] }): string {
  return res.content[0].text;
}

export function stateFixturePath(): string {
  return join(import.meta.dirname, "fixtures-state/state.json");
}

export function initNewLayoutRepo(dir: string): void {
  initOldLayoutRepo(dir);
  mkdirSync(join(dir, ".agents", "TASKS"), { recursive: true });
  writeFileSync(join(dir, ".agents", "TASKS", "INBOX.md"), "# Inbox\n");
  writeFileSync(join(dir, ".agents", "TASKS", "task.md"), "# Task\n");
  cpSync(stateFixturePath(), join(dir, ".agents", "state.json"));
}
