/**
 * Shared fixtures for IMPORT-CMDS acceptance (temp repos only, G-051).
 */
import { spawnSync, execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runDraft, runCommit, STATE_REL } from "../../src/pipelines/state-import/index.js";

export const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
export const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
export const templateDir = join(import.meta.dirname, "../../../project-template");
export const importFixture = join(import.meta.dirname, "../fixtures-import");
export const TODAY = "2026-10-07";

export function cli(args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

const tmps: string[] = [];

export function trackTmp(dir: string): string {
  tmps.push(dir);
  return dir;
}

export function cleanupTmps(): void {
  for (const t of tmps.splice(0)) rmSync(t, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
}

/** Pre-state import path with optional OLD session commands (CRLF when opts.crlf). */
export function preStateProject(opts: { crlf?: boolean; spacedPath?: boolean } = {}): string {
  const base = opts.spacedPath ? mkdtempSync(join(tmpdir(), "import cmds ")) : mkdtempSync(join(tmpdir(), "import-cmds-"));
  const dir = trackTmp(base);
  cpSync(importFixture, dir, { recursive: true });
  const nl = opts.crlf ? "\r\n" : "\n";
  const oldStart = `# Old /start${nl}Does not call ob_start.${nl}`;
  const oldEnd = `# Old /end${nl}Legacy protocol.${nl}`;
  mkdirSync(join(dir, ".claude", "commands"), { recursive: true });
  writeFileSync(join(dir, ".claude", "commands", "start.md"), oldStart);
  writeFileSync(join(dir, ".claude", "commands", "end.md"), oldEnd);
  writeFileSync(join(dir, ".gitignore"), readFileSync(join(templateDir, "gitignore"), "utf8"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  git(dir, "config", "core.autocrlf", "true");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "before import");
  return dir;
}

/** Runs `state import --commit` only; leaves the import outputs uncommitted (IMPORT-CMDS r2 L1). */
export function importCommit(dir: string, opts: { commitRecord?: boolean } = {}): void {
  runDraft(dir, TODAY);
  runCommit(dir, TODAY, { version: "0.30.0" });
  if (opts.commitRecord) {
    git(dir, "add", STATE_REL, ".agents/SESSIONS/next-session.md", ".agents/TASKS/INBOX.md", ".agents/TASKS/task.md", ".agents/SYSTEM/SUMMARY.md");
    git(dir, "commit", "-q", "-m", "import record");
  }
}

/** install-commands refuses a dirty tree; commit its writes before a second run or after /start. */
export function commitWorkingTree(dir: string, message: string): void {
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", message);
}

export function templateBytes(rel: string): string {
  return readFileSync(join(templateDir, rel), "utf8");
}

export function commandArchiveDirs(dir: string): string[] {
  const arch = join(dir, ".agents", "archive");
  if (!existsSync(arch)) return [];
  return readdirSync(arch).filter((n) => n.startsWith("pre-bootstrap-commands-"));
}
