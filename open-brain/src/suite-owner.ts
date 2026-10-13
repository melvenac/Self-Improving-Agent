/**
 * D-119 owner for the heavy suite.
 *
 * The owner is resolved live: liveOwnerProbe walks the ancestors of the
 * wrapper's parent with #427's findCursorAgentHostPid (shared/process-session.ts)
 * and falls back to the nearest claude.exe. On Windows the walk reads one
 * Win32 process table. Tests inject the walk through resolveOwnerWalk or
 * resolveOwnerFromAncestry.
 *
 * T-268: when the walk finds no owner (Git Bash on Windows: bash's parent, the
 * MSYS launcher, has already exited, so the chain ends before claude.exe), the
 * session proof named by CLAUDE_CODE_SESSION_ID supplies it. A nested claude
 * gets its own CLAUDE_CODE_SESSION_ID (measured, T-268); CLAUDE_PID is still
 * never read.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePaths } from "./shared/paths.js";
import {
  byPidDir,
  findCursorAgentHostPid,
  loadWin32ProcessTable,
  processStartTime,
  readProcessParent,
  type ProcessParentInfo,
  type Win32TableResult,
} from "./shared/process-session.js";

export type OwnerSource = "cursor-agent" | "claude.exe" | "claude-session" | "flag" | "none";

export interface AncestorRow {
  pid: number;
  ppid: number;
  commandLine: string;
}

export interface ResolvedOwner {
  pid: number | null;
  source: OwnerSource;
  reason: string | null;
}

export const NO_OWNER_REASON =
  "no cursor-agent host and no claude.exe session in the ancestor chain";

export function isClaudeExeCommandLine(commandLine: string): boolean {
  return /(^|[\\/\s"])claude\.exe(?=$|[\s"])/i.test(commandLine);
}

/**
 * Walk ancestors of startPid, inclusive. A cursor-agent host anywhere in the
 * chain wins; otherwise the nearest claude.exe. startPid is chosen only when
 * that row itself is the host. A wrapper at startPid is never the owner.
 */
export function resolveOwnerWalk(
  startPid: number,
  readParent: (pid: number) => ProcessParentInfo | null,
): ResolvedOwner {
  const host = findCursorAgentHostPid(startPid, readParent);
  if (host !== null) return { pid: host, source: "cursor-agent", reason: null };
  let p = startPid;
  for (let i = 0; i < 64 && p > 0; i++) {
    const row = readParent(p);
    if (!row) break;
    if (isClaudeExeCommandLine(row.commandLine)) return { pid: row.pid, source: "claude.exe", reason: null };
    if (row.ppid === p) break;
    p = row.ppid;
  }
  return { pid: null, source: "none", reason: NO_OWNER_REASON };
}

export function resolveOwnerFromAncestry(startPid: number, rows: AncestorRow[]): ResolvedOwner {
  const byPid = new Map<number, AncestorRow>();
  for (const row of rows) {
    if (Number.isInteger(row.pid) && row.pid > 0) byPid.set(row.pid, row);
  }
  return resolveOwnerWalk(startPid, (p) => byPid.get(p) ?? null);
}

export function ownerFromFlag(raw: string): ResolvedOwner {
  const pid = Number(raw);
  if (!Number.isInteger(pid) || pid <= 0) {
    return { pid: null, source: "flag", reason: `--owner-pid ${raw} is not a pid` };
  }
  return { pid, source: "flag", reason: null };
}

/**
 * The fallback: exactly one proof in proofDir whose session_id is
 * CLAUDE_CODE_SESSION_ID and whose ide is "claude", naming (by file name) a
 * pid that started at the proof's proc_start and is claude.exe.
 */
function ownerFromSessionProof(
  env: NodeJS.ProcessEnv,
  proofDir: string,
  readRow: (pid: number) => ProcessParentInfo | null,
): ResolvedOwner {
  const none = (why: string): ResolvedOwner => ({ pid: null, source: "none", reason: `${NO_OWNER_REASON}; ${why}` });
  const id = env.CLAUDE_CODE_SESSION_ID;
  if (!id) return none("no CLAUDE_CODE_SESSION_ID");
  const id8 = id.slice(0, 8);
  let names: string[];
  try { names = readdirSync(proofDir); } catch { names = []; }
  const matches: Array<{ pid: number; procStart: unknown }> = [];
  for (const name of names) {
    const m = /^(\d+)\.json$/.exec(name);
    if (!m) continue;
    let proof: { session_id?: unknown; ide?: unknown; proc_start?: unknown };
    try { proof = JSON.parse(readFileSync(join(proofDir, name), "utf-8")); } catch { continue; }
    if (proof?.session_id === id && proof.ide === "claude") matches.push({ pid: Number(m[1]), procStart: proof.proc_start });
  }
  if (matches.length === 0) return none(`no session proof for CLAUDE_CODE_SESSION_ID ${id8}`);
  if (matches.length > 1) return none(`${matches.length} proofs name session ${id8}`);
  const { pid, procStart } = matches[0];
  const start = processStartTime(pid);
  if (start === null || start !== procStart) return none(`the proof for ${id8} names pid ${pid}, which is not running (or was reused)`);
  const row = readRow(pid);
  if (!row || !isClaudeExeCommandLine(row.commandLine)) return none(`the proof for ${id8} names pid ${pid}, which is not claude.exe`);
  return { pid, source: "claude-session", reason: null };
}

/**
 * Production binding. startPid is only where the walk starts (process.ppid);
 * it is never the owner by default, and CLAUDE_PID is never read (a nested
 * session inherits the outer one's). On win32, or when loadTable is passed,
 * the table is loaded once; readProcessParent would reload it per step.
 * Only when the walk finds no owner does the session proof apply (T-268).
 */
export function liveOwnerProbe(
  startPid: number,
  loadTable?: () => Win32TableResult,
  env: NodeJS.ProcessEnv = process.env,
  proofDir?: string,
): ResolvedOwner {
  let readRow: (pid: number) => ProcessParentInfo | null = readProcessParent;
  if (loadTable !== undefined || process.platform === "win32") {
    const loaded = (loadTable ?? loadWin32ProcessTable)();
    if (!loaded.ok) {
      const reason = loaded.reason.startsWith("Win32 process table:")
        ? loaded.reason
        : `Win32 process table: ${loaded.reason}`;
      return { pid: null, source: "none", reason };
    }
    readRow = (p) => loaded.table.get(p) ?? null;
  }
  const walked = resolveOwnerWalk(startPid, readRow);
  if (walked.pid !== null) return walked;
  return ownerFromSessionProof(env, proofDir ?? byPidDir(resolvePaths(process.cwd()).activeSession), readRow);
}
