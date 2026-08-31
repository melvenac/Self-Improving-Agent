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
  /** Which input supplied project_dir. See {@link describeWorkspaceDir}. */
  dir_source?: string;
  /** How many workspace roots the payload offered. 0 with the key present is the bug. */
  workspace_root_count?: number;
  /** Model that drove the session, when the host reports one. */
  model?: string;
  /** Host CLI/app version, when reported. Lets a harness regression be dated. */
  cli_version?: string;
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
export interface WorkspaceResolution {
  dir: string;
  /**
   * Which input supplied `dir`:
   *   "workspace_roots"        — the payload named the workspace
   *   "fallback:empty_roots"   — the key was there and offered nothing usable
   *   "fallback:absent"        — the host never sent the key
   */
  dir_source: string;
  /** Usable roots the payload offered. Zero alongside a present key is the fault. */
  root_count: number;
}

/**
 * Resolve the workspace AND say why.
 *
 * `resolveWorkspaceDir` returned a bare string, so a fallback was
 * indistinguishable from a real answer once written to the slot file. A Cursor
 * session keyed under the home directory for sixteen days and nothing recorded
 * whether `workspace_roots` had been absent, empty, or simply ignored — the
 * diagnostics stored key NAMES only, which cannot tell an empty array from a
 * populated one. Any filter that drops its input has to report what it dropped,
 * so the next occurrence is read off the file instead of re-derived.
 */
export function describeWorkspaceDir(
  payload: Record<string, unknown>,
  fallback: string,
): WorkspaceResolution {
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

  const present = "workspace_roots" in payload || "workspaceRoots" in payload;
  const roots = payload.workspace_roots ?? payload.workspaceRoots;
  const candidates = Array.isArray(roots) ? roots : [roots];

  let chosen: string | null = null;
  let usable = 0;
  for (const candidate of candidates) {
    const found = pick(candidate);
    if (!found) continue;
    usable++;
    if (!chosen) chosen = found;
  }

  if (chosen) return { dir: chosen, dir_source: "workspace_roots", root_count: usable };
  return {
    dir: fallback,
    dir_source: present ? "fallback:empty_roots" : "fallback:absent",
    root_count: 0,
  };
}

/** Back-compat wrapper: the directory alone, for callers that need nothing else. */
export function resolveWorkspaceDir(
  payload: Record<string, unknown>,
  fallback: string,
): string {
  return describeWorkspaceDir(payload, fallback).dir;
}

/**
 * Which agent did the work.
 *
 * Cursor already sends `model` and `cursor_version` on every SessionStart and we
 * were recording that the keys existed while discarding both values. Without the
 * model, the maturity lifecycle rates entries with no idea what produced them and
 * shadow recall scores across an uncontrolled confound.
 *
 * `user_email` is in the same payload and is deliberately NOT read here. The
 * slot file records diagnostics, not identity.
 */
export function resolveAgentIdentity(
  payload: Record<string, unknown>,
): { model?: string; cli_version?: string } {
  const str = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;

  const out: { model?: string; cli_version?: string } = {};
  const model = str(payload.model);
  if (model) out.model = model;
  const version = str(payload.cursor_version) ?? str(payload.cli_version) ?? str(payload.version);
  if (version) out.cli_version = version;
  return out;
}

/**
 * How long a slot may sit before a read should stop trusting it.
 *
 * Twelve hours: longer than any single working session, far shorter than the
 * sixteen days a stale Cursor slot went unnoticed.
 */
export const STALE_SESSION_MS = 12 * 60 * 60 * 1000;

/** Age of an entry in ms, or null if it carries no usable timestamp. */
export function sessionEntryAgeMs(
  entry: ActiveSessionEntry,
  now: number = Date.now(),
): number | null {
  const started = Date.parse(entry.started_at ?? "");
  if (!Number.isFinite(started)) return null;
  return now - started;
}

/**
 * Is this slot too old to be the live session?
 *
 * `ob_set_session` handed back a sixteen-day-old UUID in the same confident
 * wording it uses for a fresh one, so every chunk and rating written from that
 * seat was filed under a month-old identity. An unreadable timestamp counts as
 * stale: a slot that cannot prove it is current should not be trusted silently.
 */
export function isStaleSession(
  entry: ActiveSessionEntry,
  now: number = Date.now(),
  maxAgeMs: number = STALE_SESSION_MS,
): boolean {
  const age = sessionEntryAgeMs(entry, now);
  if (age === null) return true;
  return age > maxAgeMs;
}

/**
 * Session id for a write-path operation, when the in-memory registration may
 * be gone.
 *
 * `/mcp reconnect` restarts the MCP server, which loses `_activeSessionId`;
 * every recall after that succeeded visibly while writing no `recall_log` row,
 * so the /end sweep rated from a partial log (Session 52, confirmed by
 * experiment). The slot file exists precisely to carry the uuid across
 * processes, so a fresh slot is adopted — but a stale one is refused, not
 * silently trusted (the 16-day-slot lesson, v0.16.0), and the caller is told
 * which, so "not logged" is never invisible.
 */
export interface WriteSessionResolution {
  id: string | null;
  /** True when the id was adopted from the slot file, not already in memory. */
  selfRegistered: boolean;
  /** Why id is null: the slot was missing, or too old to trust. */
  reason?: "no-slot" | "stale-slot";
}

export function resolveWriteSession(
  currentId: string | null,
  slot: ActiveSessionEntry | null,
  now: number = Date.now(),
): WriteSessionResolution {
  if (currentId) return { id: currentId, selfRegistered: false };
  if (!slot) return { id: null, selfRegistered: false, reason: "no-slot" };
  if (isStaleSession(slot, now)) return { id: null, selfRegistered: false, reason: "stale-slot" };
  return { id: slot.uuid, selfRegistered: true };
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
