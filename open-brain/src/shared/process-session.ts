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
// - Hosts other than Claude Code write no proof, so their servers refuse
//   attributed writes (Atlas's Q2 ruling: Cursor).
// - The server must be the claude process's DIRECT child. A wrapper (cmd /c,
//   npx) between them makes ppid name the wrapper: no file, so refuse.

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

/**
 * The session this server can PROVE is its own, or why it cannot.
 * `parentStart` is the parent process's start time (the server computes it
 * once: its parent is fixed for its life). Never falls back to anything.
 */
export function proveSession(dir: string, parentPid: number, parentStart: string | null): ProvenSession {
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
  // JSON null is a value, and reading `.session_id` on it throws. A named
  // refusal, the same as any other body that is not a session record (D2).
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
