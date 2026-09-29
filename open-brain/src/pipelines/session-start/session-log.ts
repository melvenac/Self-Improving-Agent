import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StateJsonResult } from "./types.js";

const SESSION_FILE = /^Session_(\d+)\.md$/;

export type SessionNumberSource = "record" | "local";

/**
 * T-164: the greeting's session number comes from the record when state.json
 * is present and valid; otherwise from this checkout's Session_N.md files.
 */
export function nextGreetingSessionNumber(
  projectRoot: string,
  stateJson: StateJsonResult,
): { sessionNumber: number; source: SessionNumberSource } {
  if (stateJson.present && stateJson.valid && stateJson.data) {
    const nums = stateJson.data.sessions.map((s) => s.n);
    const sessionNumber = nums.length === 0 ? 1 : Math.max(...nums) + 1;
    return { sessionNumber, source: "record" };
  }
  return { sessionNumber: findNextSessionNumber(projectRoot), source: "local" };
}
const SESSION_ID_LINE = /^>\s*\*\*Session ID:\*\*\s*(\S+)\s*$/m;

export function findNextSessionNumber(projectRoot: string): number {
  const sessionsDir = join(projectRoot, ".agents", "SESSIONS");
  if (!existsSync(sessionsDir)) return 1;

  const files = readdirSync(sessionsDir);
  const numbers = files
    .filter((f) => SESSION_FILE.test(f))
    .map((f) => parseInt(f.match(SESSION_FILE)![1], 10));

  if (numbers.length === 0) return 1;
  return Math.max(...numbers) + 1;
}

/**
 * The log already created for this session id, if any. ob_start is called
 * once per session by contract, but a contract in prose is not a guarantee:
 * a retry, a reconnect, or a second subagent would each have minted a new
 * Session_N.md. Matching on the `Session ID` line makes "one log per session"
 * a property of the code. Highest number wins if several match.
 */
export function findExistingSessionLog(
  projectRoot: string,
  sessionId: string | null
): { sessionNumber: number; logPath: string } | null {
  if (!sessionId) return null;
  const sessionsDir = join(projectRoot, ".agents", "SESSIONS");
  if (!existsSync(sessionsDir)) return null;

  let best: { sessionNumber: number; logPath: string } | null = null;
  for (const f of readdirSync(sessionsDir)) {
    const m = f.match(SESSION_FILE);
    if (!m) continue;
    const logPath = join(sessionsDir, f);
    let content: string;
    try { content = readFileSync(logPath, "utf-8"); } catch { continue; }
    const idMatch = content.match(SESSION_ID_LINE);
    if (!idMatch || idMatch[1] !== sessionId) continue;
    const sessionNumber = parseInt(m[1], 10);
    if (!best || sessionNumber > best.sessionNumber) best = { sessionNumber, logPath };
  }
  return best;
}

/**
 * Writes Session_N.md from the template. Returns "" without writing when
 * `.agents/SESSIONS/` does not exist — a project with `.agents/` but no
 * sessions directory used to make the whole of ob_start fail with ENOENT.
 * The caller reports the skip; this function does not create the directory,
 * because whether a project keeps session logs is the project's decision.
 */
export function createSessionLog(
  projectRoot: string,
  sessionNumber: number,
  sessionId: string | null,
  date: string
): string {
  const sessionsDir = join(projectRoot, ".agents", "SESSIONS");
  if (!existsSync(sessionsDir)) return "";
  const templatePath = join(sessionsDir, "SESSION_TEMPLATE.md");
  const logPath = join(sessionsDir, `Session_${sessionNumber}.md`);

  let content: string;
  if (existsSync(templatePath)) {
    content = readFileSync(templatePath, "utf-8");
  } else {
    content = "# Session N — [Date]\n\n> **Objective:** [TBD]\n> **Status:** In Progress\n";
  }

  content = content.replace("Session N", `Session ${sessionNumber}`);
  content = content.replace("[Date]", date);

  if (sessionId) {
    content = content.replace(
      /^(>.*Status:.*$)/m,
      `> **Session ID:** ${sessionId}\n$1`
    );
  }

  writeFileSync(logPath, content, "utf-8");
  return logPath;
}
