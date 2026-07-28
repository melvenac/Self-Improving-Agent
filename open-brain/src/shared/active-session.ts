// File handoff for the active session UUID.
//
// The original design passed the UUID through the agent's context: the
// SessionStart hook printed `SESSION_UUID: <uuid>` and /start relayed it to
// ob_set_session. That works in Claude Code and nowhere else, because it
// assumes two IDE-specific behaviours at once:
//
//   1. the hook payload carries a `session_id` field, and
//   2. the hook's stdout is injected into the agent's context.
//
// Cursor satisfies neither reliably, so Cursor sessions registered no UUID,
// which meant ob_set_session was never called, recall_log and feedback_log
// stayed empty, and shadow recall had nothing to evaluate.
//
// Writing the UUID to a file removes both assumptions: the hook records it, the
// MCP server reads it, and no agent has to carry it. Prompt-level relaying stays
// as the fast path when the IDE supports it.
//
// Entries are keyed by canonical project directory AND the IDE that wrote them.
//
// Keying on the project alone was not enough, and the failure was not the rare
// race it was first documented as. Running Claude Code and Cursor on the SAME
// repo is the normal setup here, and every session start — including a resume —
// rewrites the slot. Observed live: a Claude Code resume overwrote Cursor's
// entry, after which Cursor's ob_set_session read back the Claude session's
// UUID and filed six recalls under the wrong session. Both IDEs looked healthy
// while silently sharing one identity.
//
// The IDE is supplied by whoever registered the hook and the MCP server (see
// setup.mjs), defaulting to "claude" so existing installs keep working.
//
// REMAINING LIMITATION: two windows of the SAME IDE on the SAME project still
// share a slot, and the later session start wins. Explicit session_id always
// takes precedence over this file, so any agent that can see its own UUID is
// unaffected regardless.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface ActiveSessionEntry {
  uuid: string;
  project_dir: string;
  /** Which payload field the uuid came from, or "generated". Diagnostic only. */
  source: string;
  started_at: string;
  /** Which IDE recorded this. Lets a mismatched read be detected, not guessed. */
  ide?: string;
  /** Payload field names the host sent. Keys only — never values. Diagnostic. */
  payload_keys?: string[];
  /** process.cwd() at hook time. Cursor sets this to the config dir, not the workspace. */
  hook_cwd?: string;
}

/** Default IDE label — existing Claude Code installs pass nothing. */
export const DEFAULT_IDE = "claude";

/**
 * Slot key. Project + IDE, so Claude Code and Cursor on the same repo hold
 * separate entries instead of overwriting each other.
 */
export function activeSessionKey(projectKey: string, ide: string = DEFAULT_IDE): string {
  return `${projectKey}::${ide}`;
}

/** The IDE this process is running under, from the environment its host set. */
export function currentIde(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.OPEN_BRAIN_IDE;
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : DEFAULT_IDE;
}

/**
 * Identify the host from the payload it sent, falling back to how the hook was
 * registered.
 *
 * Registration is not a reliable signal on its own: Cursor also executes the
 * hooks in ~/.claude/settings.json, and that copy carries no `--ide` flag, so a
 * Cursor session was labelling itself "claude" and writing a slot that would
 * stomp a real Claude Code session. Cursor's payload includes `cursor_version`,
 * which identifies the actual host regardless of which config invoked us.
 */
export function detectIde(
  payload: Record<string, unknown>,
  fallback: string = DEFAULT_IDE,
): string {
  if (payload.cursor_version !== undefined && payload.cursor_version !== null) return "cursor";
  return fallback;
}

/**
 * The workspace the session is actually open in.
 *
 * Cursor invokes hooks with cwd set to the CONFIG directory (~/.cursor), not the
 * workspace, so process.cwd() keys the slot under the wrong project and
 * ob_set_session can never find it. Cursor's payload carries `workspace_roots`;
 * shape is not documented, so accept a bare string, an array of strings, or an
 * array of objects with a path/uri field.
 */
export function resolveWorkspaceDir(
  payload: Record<string, unknown>,
  fallback: string,
): string {
  const pick = (value: unknown): string | null => {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      for (const field of ["path", "uri", "fsPath", "root"]) {
        const inner = obj[field];
        if (typeof inner === "string" && inner.trim()) return inner.trim();
      }
    }
    return null;
  };

  const roots = payload.workspace_roots ?? payload.workspaceRoots;
  if (Array.isArray(roots)) {
    for (const candidate of roots) {
      const found = pick(candidate);
      if (found) return found;
    }
  } else {
    const found = pick(roots);
    if (found) return found;
  }

  return fallback;
}

type ActiveSessionFile = Record<string, ActiveSessionEntry>;

function readFile(path: string): ActiveSessionFile {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return parsed && typeof parsed === "object" ? (parsed as ActiveSessionFile) : {};
  } catch {
    return {}; // corrupt file must not break session start
  }
}

export function writeActiveSession(
  path: string,
  key: string,
  entry: ActiveSessionEntry,
): void {
  const all = readFile(path);
  all[key] = entry;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(all, null, 2) + "\n");
}

export function readActiveSession(path: string, key: string): ActiveSessionEntry | null {
  return readFile(path)[key] ?? null;
}

/**
 * Pull a session identifier out of a hook payload.
 *
 * Claude Code sends `session_id`. Other IDEs use different names, and some send
 * none at all — Cursor's payload shape is not documented and was not directly
 * observed, so this accepts the plausible spellings and records which one hit.
 * `source` exists precisely so the real field name can be read back from the
 * file rather than guessed at again.
 */
export function resolveSessionId(
  payload: Record<string, unknown>,
): { uuid: string; source: string } | null {
  const candidates = ["session_id", "sessionId", "conversation_id", "conversationId"];
  for (const field of candidates) {
    const value = payload[field];
    if (typeof value === "string" && value.trim()) {
      return { uuid: value.trim(), source: field };
    }
  }
  return null;
}
