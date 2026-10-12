/**
 * T-245 Option A (D-146): one claim per doubled Cursor hook.
 *
 * Cursor fires SessionStart and SessionEnd twice for one session: once from its
 * own hook config and once from the Claude-compatible one. The second run is
 * made harmless stage by stage (handoff marker, fetch, feedback, shadow log),
 * and this claim is the simplest possible guard on top: the first run to create
 * the claim file for (kind, session) proceeds, a second inside the TTL skips.
 *
 * Claude Code is never claimed: only a payload carrying `cursor_version` (the
 * same test `detectIde` uses) is. FAIL OPEN: any error the claim itself hits
 * returns "claimed", because a broken claim directory must never stop a hook
 * from running. No retry loop, no sleep.
 */
import { closeSync, mkdirSync, openSync, statSync, unlinkSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveSessionId } from "./active-session.js";

export const HOOK_CLAIM_TTL_MS = 120_000;
export type HookKind = "start" | "end";
export type ClaimResult = "claimed" | "skip";

/** The session id to claim on, or null when this run must not claim (not Cursor, or no id). */
export function shouldClaimHookRun(payload: Record<string, unknown>): string | null {
  if (payload.cursor_version === undefined || payload.cursor_version === null) return null;
  return resolveSessionId(payload)?.uuid ?? null;
}

/** The default claim directory: join(homedir(), ".claude", "open-brain", "hook-claims"). */
export function defaultClaimDir(): string {
  return join(homedir(), ".claude", "open-brain", "hook-claims");
}

function errCode(err: unknown): string | undefined {
  return (err as NodeJS.ErrnoException | undefined)?.code;
}

/** Stamp a freshly created claim file, then close it. */
function stamp(fd: number, now: number): void {
  try {
    writeSync(fd, `${process.pid} ${new Date(now).toISOString()}\n`);
  } finally {
    closeSync(fd);
  }
}

/** The claim file for (kind, session): one name, built here for both claim and release. */
function claimFile(dir: string, kind: HookKind, sessionId: string): string {
  return join(dir, `${kind}-${sessionId.replace(/[^A-Za-z0-9._-]/g, "_")}.claim`);
}

/** Remove a claim. A run that claims one kind releases the other, so a real resume is not swallowed. Never throws. */
export function releaseHookClaim(opts: { kind: HookKind; sessionId: string; dir?: string }): void {
  try {
    unlinkSync(claimFile(opts.dir ?? defaultClaimDir(), opts.kind, opts.sessionId));
  } catch { /* nothing to release, or not ours to remove */ }
}

export function claimHookRun(opts: {
  kind: HookKind;
  sessionId: string;
  dir?: string;
  now?: number;
  ttlMs?: number;
}): ClaimResult {
  const dir = opts.dir ?? defaultClaimDir();
  const now = opts.now ?? Date.now();
  const ttlMs = opts.ttlMs ?? HOOK_CLAIM_TTL_MS;
  const file = claimFile(dir, opts.kind, opts.sessionId);
  try {
    mkdirSync(dir, { recursive: true });
    try {
      stamp(openSync(file, "wx"), now);
      return "claimed";
    } catch (err) {
      if (errCode(err) !== "EEXIST") return "claimed";
    }
    // The claim exists: fresh means another run owns it, stale means it is ours to replace.
    if (now - statSync(file).mtimeMs < ttlMs) return "skip";
    try {
      unlinkSync(file);
    } catch (err) {
      if (errCode(err) !== "ENOENT") return "claimed";
    }
    try {
      stamp(openSync(file, "wx"), now);
      return "claimed";
    } catch (err) {
      return errCode(err) === "EEXIST" ? "skip" : "claimed";
    }
  } catch {
    return "claimed";
  }
}
