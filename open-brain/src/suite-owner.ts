/**
 * D-119 owner for the heavy suite.
 *
 * The live walk is findCursorAgentHostPid in shared/process-session.ts (#427).
 * Until that merges, this module walks an injected ancestry table and the
 * production binding refuses rather than guessing process.ppid. Rebase the
 * binding in cli-suite-run.ts onto findCursorAgentHostPid after the merge.
 */

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

/** Same shape as #427 isCursorAgentHostCommandLine. Not an import of that file. */
export function isCursorAgentHostCommandLine(commandLine: string): boolean {
  if (!commandLine.trim()) return false;
  const win = commandLine.replace(/\//g, "\\");
  if (/\\cursor-agent\\versions\\[^\\]+\\index\.js/i.test(win)) return true;
  if (/\/cursor-agent\/versions\/[^/]+\/index\.js/i.test(commandLine)) return true;
  if (/\\cursor-agent\.ps1/i.test(win) && /powershell/i.test(win)) return true;
  if (/\\cursor-agent\.cmd(?:\s|$|")/i.test(win)) return true;
  return false;
}

export function isClaudeExeCommandLine(commandLine: string): boolean {
  return /(^|[\\/\s"])claude\.exe(?=$|[\s"])/i.test(commandLine);
}

/**
 * Walk ancestors of startPid, inclusive. The first cursor-agent host wins.
 * Otherwise the first claude.exe. startPid is chosen only when that row
 * itself is the host. A wrapper at startPid is never the owner.
 */
export function resolveOwnerFromAncestry(startPid: number, rows: AncestorRow[]): ResolvedOwner {
  const byPid = new Map<number, AncestorRow>();
  for (const row of rows) {
    if (Number.isInteger(row.pid) && row.pid > 0) byPid.set(row.pid, row);
  }
  let p = startPid;
  let claude: number | null = null;
  for (let i = 0; i < 64 && p > 0; i++) {
    const row = byPid.get(p);
    if (!row) break;
    if (isCursorAgentHostCommandLine(row.commandLine)) {
      return { pid: row.pid, source: "cursor-agent", reason: null };
    }
    if (claude === null && isClaudeExeCommandLine(row.commandLine)) claude = row.pid;
    if (row.ppid === p) break;
    p = row.ppid;
  }
  if (claude !== null) return { pid: claude, source: "claude.exe", reason: null };
  return { pid: null, source: "none", reason: NO_OWNER_REASON };
}

export function ownerFromFlag(raw: string): ResolvedOwner {
  const pid = Number(raw);
  if (!Number.isInteger(pid) || pid <= 0) {
    return { pid: null, source: "flag", reason: `--owner-pid ${raw} is not a pid` };
  }
  return { pid, source: "flag", reason: null };
}

/** Production binding until #427 merges. Does not return process.ppid. */
export function unboundOwnerProbe(): ResolvedOwner {
  return {
    pid: null,
    source: "none",
    reason: "no cursor-agent host resolver until #427 merges (findCursorAgentHostPid)",
  };
}
