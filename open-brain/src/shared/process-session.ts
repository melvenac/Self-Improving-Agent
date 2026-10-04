// T-003: a server knows its OWN session.
//
// The session is a property of the claude PROCESS, not of the project. One
// claude process serves many sessions in turn (`/clear` starts a new one and
// the MCP server survives it: five sessions in one process, observed in
// docs/loops/t003-step0.md), and two claude processes in one checkout are two
// sessions at once. The per-project slot in active-session.json can therefore
// hold another session's id, and adopting from it was the defect: "v0.21.0
// fixed an absence by introducing a wrong value" (T-003, Session 53).
//
// THE PROOF. The SessionStart hook knows its session id with certainty (the
// documented payload) and its claude's pid (CLAUDE_PID, set by the host for
// hooks). It writes `by-pid/<claudePid>.json`. The MCP server is a direct child
// of that claude process, so it reads ONLY the file named by its own
// `process.ppid`, at every attributed write, and requires the recorded process
// start time to equal its parent's, which rejects a reused pid.
//
// The server never reads CLAUDE_PID: in an MCP server it is INHERITED from
// whoever launched claude, so a claude started from another session's tool
// shell sees the OUTER session's pid there (measured: Step 0b, both runs). That
// nested case is how headless QA seats run.
//
// SessionEnd (which fires on /clear as well as exit) removes the file when it
// still holds that session's id, so a SessionStart that failed leaves NO file
// and the server refuses, instead of reading the previous session's.
//
// LIMITS, stated because the guarantee reaches only this far:
// - Stale adoption remains possible if SessionEnd AND SessionStart both fail
//   across one /clear. Either alone is caught.
// - The ordering "SessionStart completes before the new session's first tool
//   call" was measured headless (3 of 3), not interactively.
// - Cursor (T-235 P2-3): SessionStart writes `by-pid/<cursorAgentHostPid>.json`
//   after walking ancestors from the hook's `process.ppid` (never the hook pid)
//   until CommandLine matches the cursor-agent executable entry (see
//   isCursorAgentHostCommandLine). The MCP server walks from its parent when
//   OPEN_BRAIN_IDE=cursor. Claude Code behaviour below is unchanged.
// - The server must be the claude process's DIRECT child. A wrapper (cmd /c,
//   npx) between them makes ppid name the wrapper: no file, so refuse — unless
//   cursor walk-up is enabled.

import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export interface ProcessSessionProof {
  session_id: string;
  claude_pid: number;
  /** The claude process's start time, from processStartTime(). */
  proc_start: string;
  ide: string;
  written_at: string;
  transcript_path?: string;
}

/** Where the proofs live: beside active-session.json, so every override of that path isolates these too. */
export function byPidDir(activeSessionPath: string): string {
  return join(dirname(activeSessionPath), "by-pid");
}

function proofPath(dir: string, pid: number): string {
  return join(dir, `${pid}.json`);
}

/**
 * A process's start time as an opaque, comparable string, or null when it
 * cannot be read (no such process, or the query failed). The hook and the
 * server both call this, so the two values are produced by one implementation.
 */
export function processStartTime(pid: number): string | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    if (process.platform === "win32") {
      const out = execFileSync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToFileTimeUtc()`],
        { encoding: "utf-8", timeout: 15_000, stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
      ).trim();
      return /^\d+$/.test(out) ? `win:${out}` : null;
    }
    if (process.platform === "linux") {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf-8");
      // Field 22 (starttime), counted after the parenthesised command name,
      // which may itself contain spaces.
      const rest = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      const start = rest[19];
      return start && /^\d+$/.test(start) ? `linux:${start}` : null;
    }
    const out = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], {
      encoding: "utf-8", timeout: 15_000, stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out ? `ps:${out}` : null;
  } catch {
    return null;
  }
}

/** Written by the SessionStart hook. Atomic: a reader never sees half a file. */
export function writeProcessSession(dir: string, proof: ProcessSessionProof): string {
  mkdirSync(dir, { recursive: true });
  const target = proofPath(dir, proof.claude_pid);
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(proof, null, 2) + "\n");
  renameSync(tmp, target);
  return target;
}

export type RemoveResult = "removed" | "absent" | "kept: holds another session";

/**
 * Called by the SessionEnd hook. Removes the file only when it still holds
 * THIS session's id: if the next session's SessionStart already replaced it,
 * it is left alone.
 */
export function removeProcessSession(dir: string, claudePid: number, sessionId: string): RemoveResult {
  const path = proofPath(dir, claudePid);
  if (!existsSync(path)) return "absent";
  let held: unknown;
  try { held = JSON.parse(readFileSync(path, "utf-8")).session_id; } catch { held = undefined; }
  // An unreadable file cannot be shown to be another session's, and nothing may
  // be proven from it: remove it.
  if (held !== undefined && held !== sessionId) return "kept: holds another session";
  rmSync(path, { force: true });
  return "removed";
}

export type ProvenSession =
  | { id: string; pid: number }
  | { id: null; reason: string };

export type ProcessParentInfo = { pid: number; ppid: number; commandLine: string };

/**
 * True when `commandLine` is the cursor-agent host process, not merely a path
 * that contains the substring `cursor-agent` (T-235 P2-3 r2).
 *
 * Live match on QA PC 2026-10-04 (cursor-agent 2026.10.01-e373342):
 * `…\AppData\Local\cursor-agent\versions\2026.10.01-e373342\node.exe
 * …\cursor-agent\versions\2026.10.01-e373342\index.js` (args follow).
 */
export function isCursorAgentHostCommandLine(commandLine: string): boolean {
  if (!commandLine.trim()) return false;
  const win = commandLine.replace(/\//g, "\\");
  if (/\\cursor-agent\\versions\\[^\\]+\\index\.js/i.test(win)) return true;
  if (/\/cursor-agent\/versions\/[^/]+\/index\.js/i.test(commandLine)) return true;
  if (/\\cursor-agent\.ps1/i.test(win) && /powershell/i.test(win)) return true;
  if (/\\cursor-agent\.cmd(?:\s|$|")/i.test(win)) return true;
  return false;
}

export type Win32TableResult =
  | { ok: true; table: Map<number, ProcessParentInfo> }
  | { ok: false; reason: string };

/** Parse one ConvertTo-Json payload. A single process is an object, not an array. */
export function parseWin32ProcessTable(raw: string): Win32TableResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "Win32 process table: empty stdout" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return { ok: false, reason: `Win32 process table: unparseable JSON (${err instanceof Error ? err.message : String(err)})` };
  }
  if (parsed === null || typeof parsed !== "object") {
    return { ok: false, reason: "Win32 process table: JSON is not an object or array" };
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const map = new Map<number, ProcessParentInfo>();
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue;
    const rec = row as { ProcessId?: unknown; ParentProcessId?: unknown; CommandLine?: unknown };
    if (!Number.isInteger(rec.ProcessId)) continue;
    map.set(rec.ProcessId as number, {
      pid: rec.ProcessId as number,
      ppid: typeof rec.ParentProcessId === "number" ? rec.ParentProcessId : 0,
      commandLine: typeof rec.CommandLine === "string" ? rec.CommandLine : "",
    });
  }
  return { ok: true, table: map };
}

/**
 * One CIM query for the whole table. Spawn failure, timeout, nonzero exit,
 * empty stdout and bad JSON return ok:false. Never throws (T-235 P2-3 r3).
 */
export function loadWin32ProcessTable(run: () => string = readWin32ProcessTableStdout): Win32TableResult {
  try {
    return parseWin32ProcessTable(run());
  } catch (err) {
    const status = (err as { status?: number }).status;
    const detail = err instanceof Error ? err.message : String(err);
    const why = status !== undefined && status !== 0 ? `exit ${status}: ${detail}` : detail;
    return { ok: false, reason: `Win32 process table: ${why}` };
  }
}

function readWin32ProcessTableStdout(): string {
  const forced = process.env.OPEN_BRAIN_PROCESS_TABLE;
  if (forced === "throw:spawn") throw new Error("spawn powershell.exe ENOENT");
  if (forced === "throw:timeout") throw new Error("spawn powershell.exe ETIMEDOUT");
  if (forced === "throw:status") {
    const err = new Error("Command failed: powershell.exe");
    (err as { status?: number }).status = 1;
    throw err;
  }
  if (forced === "empty") return " ";
  if (forced === "bad-json") return "{";
  if (forced !== undefined && forced.startsWith("json:")) return forced.slice("json:".length);
  return execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress",
    ],
    { encoding: "utf-8", timeout: 60_000, stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
  );
}

/** Read one process row for ancestor walks (injectable in tests). */
export function readProcessParent(pid: number): ProcessParentInfo | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    if (process.platform === "win32") {
      const out = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `$p=Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" -ErrorAction SilentlyContinue; if(-not $p){exit 1}; Write-Output ($p.ProcessId); Write-Output ($p.ParentProcessId); Write-Output ($p.CommandLine)`,
        ],
        { encoding: "utf-8", timeout: 15_000, stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
      ).trim();
      const lines = out.split(/\r?\n/);
      if (lines.length < 3) return null;
      const procPid = Number(lines[0]);
      const ppid = Number(lines[1]);
      if (!Number.isInteger(procPid) || !Number.isInteger(ppid)) return null;
      return { pid: procPid, ppid, commandLine: lines.slice(2).join("\n") };
    }
    if (process.platform === "linux") {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf-8");
      const rest = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      const ppid = Number(rest[1]);
      let commandLine = "";
      try {
        commandLine = readFileSync(`/proc/${pid}/cmdline`, "utf-8").replace(/\0/g, " ");
      } catch {
        commandLine = "";
      }
      return { pid, ppid, commandLine };
    }
    const ps = execFileSync("ps", ["-p", String(pid), "-o", "pid=,ppid=,command="], {
      encoding: "utf-8",
      timeout: 15_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const m = ps.match(/^(\d+)\s+(\d+)\s+(.*)$/);
    if (!m) return null;
    return { pid: Number(m[1]), ppid: Number(m[2]), commandLine: m[3] };
  } catch {
    return null;
  }
}

export type HostWalk = { pid: number | null; reason: string | null };

/**
 * Nearest ancestor of `fromPid` (inclusive) whose command line is the
 * cursor-agent host. The SessionStart hook passes `process.ppid`, never its own
 * pid (T-235 P2-3 r2). A failed Win32 table load returns pid null and a reason
 * and does not throw (T-235 P2-3 r3).
 */
export function resolveCursorAgentHost(
  fromPid: number,
  readParent: (pid: number) => ProcessParentInfo | null = readProcessParent,
  loadTable?: () => Win32TableResult,
): HostWalk {
  let resolveParent = readParent;
  // On Windows the default walk uses one CIM table. Tests pass loadTable, or set
  // OPEN_BRAIN_PROCESS_TABLE so the hook process hits the same loader.
  const shouldLoad = loadTable !== undefined
    || process.env.OPEN_BRAIN_PROCESS_TABLE !== undefined
    || (process.platform === "win32" && readParent === readProcessParent);
  if (shouldLoad) {
    const loaded = (loadTable ?? loadWin32ProcessTable)();
    if (!loaded.ok) return { pid: null, reason: loaded.reason };
    resolveParent = (pid) => loaded.table.get(pid) ?? null;
  }
  let p = fromPid;
  for (let i = 0; i < 64 && p > 0; i++) {
    const row = resolveParent(p);
    if (!row) break;
    if (isCursorAgentHostCommandLine(row.commandLine)) return { pid: row.pid, reason: null };
    p = row.ppid;
  }
  return { pid: null, reason: "no cursor-agent host process found in the hook's ancestor chain" };
}

export function findCursorAgentHostPid(
  fromPid: number,
  readParent: (pid: number) => ProcessParentInfo | null = readProcessParent,
): number | null {
  return resolveCursorAgentHost(fromPid, readParent).pid;
}

export type ProveSessionOptions = {
  /** When true, walk from parentPid to the cursor-agent host before reading proof. */
  cursorWalk?: boolean;
  readParent?: (pid: number) => ProcessParentInfo | null;
};

function proveSessionAtKey(
  dir: string,
  keyPid: number,
  keyStart: string | null,
  parentLabel: string,
): ProvenSession {
  const path = proofPath(dir, keyPid);
  if (!existsSync(path)) {
    return {
      id: null,
      reason: `no session proof for this server's parent process ${parentLabel} (${path} absent: the SessionStart hook did not write one, or SessionEnd removed it)`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    return { id: null, reason: `the session proof ${path} is unreadable: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { id: null, reason: `the session proof ${path} is not a session record` };
  }
  const proof = parsed as Partial<ProcessSessionProof>;
  if (typeof proof.session_id !== "string" || !proof.session_id.trim()) {
    return { id: null, reason: `the session proof ${path} carries no session_id` };
  }
  if (proof.claude_pid !== keyPid) {
    return {
      id: null,
      reason: `the session proof ${path} names pid ${String(proof.claude_pid)}, not the cursor-agent host ${keyPid}`,
    };
  }
  if (keyStart === null) {
    return {
      id: null,
      reason: `the start time of the cursor-agent host process ${keyPid} could not be read, so the proof cannot be checked against a reused pid`,
    };
  }
  if (proof.proc_start !== keyStart) {
    return {
      id: null,
      reason: `the session proof ${path} was written for a process that started at ${String(proof.proc_start)}, and the cursor-agent host ${keyPid} started at ${keyStart}: a reused pid`,
    };
  }
  return { id: proof.session_id, pid: keyPid };
}

function proveSessionClaude(dir: string, parentPid: number, parentStart: string | null): ProvenSession {
  const path = proofPath(dir, parentPid);
  if (!existsSync(path)) {
    return { id: null, reason: `no session proof for this server's parent process ${parentPid} (${path} absent: the SessionStart hook did not write one, or SessionEnd removed it)` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    return { id: null, reason: `the session proof ${path} is unreadable: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { id: null, reason: `the session proof ${path} is not a session record` };
  }
  const proof = parsed as Partial<ProcessSessionProof>;
  if (typeof proof.session_id !== "string" || !proof.session_id.trim()) {
    return { id: null, reason: `the session proof ${path} carries no session_id` };
  }
  if (proof.claude_pid !== parentPid) {
    return { id: null, reason: `the session proof ${path} names pid ${String(proof.claude_pid)}, not this server's parent ${parentPid}` };
  }
  if (parentStart === null) {
    return { id: null, reason: `the start time of this server's parent process ${parentPid} could not be read, so the proof cannot be checked against a reused pid` };
  }
  if (proof.proc_start !== parentStart) {
    return { id: null, reason: `the session proof ${path} was written for a process that started at ${String(proof.proc_start)}, and this server's parent ${parentPid} started at ${parentStart}: a reused pid` };
  }
  return { id: proof.session_id, pid: parentPid };
}

/**
 * The session this server can PROVE is its own, or why it cannot.
 * `parentStart` is the parent process's start time (the server computes it
 * once: its parent is fixed for its life). Never falls back to anything.
 */
export function proveSession(
  dir: string,
  parentPid: number,
  parentStart: string | null,
  options?: ProveSessionOptions,
): ProvenSession {
  if (!options?.cursorWalk) {
    return proveSessionClaude(dir, parentPid, parentStart);
  }
  const readParent = options.readParent ?? readProcessParent;
  const direct = proveSessionClaude(dir, parentPid, parentStart);
  if (direct.id !== null) return direct;
  let host: HostWalk;
  try {
    host = resolveCursorAgentHost(parentPid, readParent);
  } catch (err) {
    return { id: null, reason: err instanceof Error ? err.message : String(err) };
  }
  if (host.pid === null) {
    return {
      id: null,
      reason: host.reason ?? `no cursor-agent host ancestor of parent process ${parentPid} (cursor walk found no matching process)`,
    };
  }
  const hostStart = processStartTime(host.pid);
  return proveSessionAtKey(dir, host.pid, hostStart, String(parentPid));
}
