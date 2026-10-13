/**
 * D-119 owner for the heavy suite.
 *
 * The owner is resolved live: liveOwnerProbe walks the ancestors of the
 * wrapper's parent with #427's findCursorAgentHostPid (shared/process-session.ts)
 * and falls back to the nearest claude.exe. On Windows the walk reads one
 * Win32 process table. Tests inject the walk through resolveOwnerWalk or
 * resolveOwnerFromAncestry.
 */

import {
  findCursorAgentHostPid,
  loadWin32ProcessTable,
  readProcessParent,
  type ProcessParentInfo,
  type Win32TableResult,
} from "./shared/process-session.js";

export type OwnerSource = "cursor-agent" | "claude.exe" | "flag" | "none";

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
 * Production binding. startPid is only where the walk starts (process.ppid);
 * it is never the owner by default, and CLAUDE_PID is never read (a nested
 * session inherits the outer one's). On win32, or when loadTable is passed,
 * the table is loaded once; readProcessParent would reload it per step.
 */
export function liveOwnerProbe(startPid: number, loadTable?: () => Win32TableResult): ResolvedOwner {
  if (loadTable !== undefined || process.platform === "win32") {
    const loaded = (loadTable ?? loadWin32ProcessTable)();
    if (!loaded.ok) {
      const reason = loaded.reason.startsWith("Win32 process table:")
        ? loaded.reason
        : `Win32 process table: ${loaded.reason}`;
      return { pid: null, source: "none", reason };
    }
    return resolveOwnerWalk(startPid, (p) => loaded.table.get(p) ?? null);
  }
  return resolveOwnerWalk(startPid, readProcessParent);
}
