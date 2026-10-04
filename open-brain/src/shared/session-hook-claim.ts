import { appendFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectIde } from "./active-session.js";

/** T-235 P2-7: dual Cursor + Claude settings hooks can fire twice within milliseconds; legitimate resume is minutes later. */
export const HOOK_CLAIM_TTL_MS = 120_000;

export type HookClaimEvent = "sessionStart" | "sessionEnd";

export type HookClaimResult = "claimed" | "duplicate" | "not_applicable";

const SAFE = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "_");

export function dedupeCursorHookRuns(payload: Record<string, unknown>, registeredAs: string): boolean {
  return detectIde(payload, registeredAs) === "cursor";
}

function claimsDir(home: string): string {
  const dir = join(home, ".claude", "open-brain", "hook-claims");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function claimPath(home: string, event: HookClaimEvent, sessionId: string): string {
  return join(claimsDir(home), `${event}-${SAFE(sessionId)}.claim`);
}

function tryCreateClaim(path: string): boolean {
  try {
    writeFileSync(path, `${new Date().toISOString()}\t${process.pid}\n`, { flag: "wx" });
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw err;
    return false;
  }
}

function errno(err: unknown): string | undefined {
  return (err as NodeJS.ErrnoException).code;
}

/**
 * Rename. ENOENT means the other process already moved the file.
 * Windows also returns EPERM while that rename is in progress; retry, then treat it as a loss.
 * Either way the caller returns duplicate and does not throw.
 */
function renameExclusive(from: string, to: string): "ok" | "lost" {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      renameSync(from, to);
      return "ok";
    } catch (err) {
      const code = errno(err);
      if (code === "ENOENT" || code === "EEXIST") return "lost";
      if (code === "EPERM" || code === "EBUSY") continue;
      throw err;
    }
  }
  return "lost";
}

/**
 * One process wins rename of a stale claim to claim.stale.<pid>.
 * A loser that sees ENOENT (or Windows EPERM) returns duplicate and does not throw.
 */
function reclaimStale(path: string, ttlMs: number): "reclaimed" | "duplicate" {
  try {
    const mtime = statSync(path).mtimeMs;
    if (Date.now() - mtime <= ttlMs) return "duplicate";
  } catch (err) {
    if (errno(err) === "ENOENT") return "duplicate";
    throw err;
  }
  const aside = `${path}.stale.${process.pid}`;
  if (renameExclusive(path, aside) === "lost") return "duplicate";
  let ageMs: number;
  try {
    ageMs = Date.now() - statSync(aside).mtimeMs;
  } catch (err) {
    if (errno(err) === "ENOENT") return "duplicate";
    throw err;
  }
  if (ageMs <= ttlMs) {
    if (renameExclusive(aside, path) === "lost") {
      try {
        unlinkSync(aside);
      } catch (cleanupErr) {
        if (errno(cleanupErr) !== "ENOENT" && errno(cleanupErr) !== "EPERM") throw cleanupErr;
      }
    }
    return "duplicate";
  }
  try {
    unlinkSync(aside);
  } catch (err) {
    if (errno(err) !== "ENOENT" && errno(err) !== "EPERM") throw err;
  }
  return "reclaimed";
}

/** Drop at most this many expired claim files per call, so a hook never walks an unbounded directory. */
const SWEEP_CAP = 32;

function sweepExpiredClaims(home: string, ttlMs: number, keep: string): void {
  const dir = join(home, ".claude", "open-brain", "hook-claims");
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch (err) {
    if (errno(err) === "ENOENT") return;
    throw err;
  }
  const now = Date.now();
  let removed = 0;
  for (const name of names) {
    if (removed >= SWEEP_CAP) break;
    const p = join(dir, name);
    if (p === keep) continue;
    try {
      if (now - statSync(p).mtimeMs <= ttlMs) continue;
      unlinkSync(p);
      removed++;
    } catch (err) {
      if (errno(err) !== "ENOENT") throw err;
    }
  }
}

/**
 * Atomic exclusive claim (wx). A stale claim is reclaimed by rename, then wx.
 * ENOENT on that rename is a lost race: duplicate, never a throw.
 */
export function tryClaimHookRun(
  home: string,
  event: HookClaimEvent,
  sessionId: string,
  ttlMs: number = HOOK_CLAIM_TTL_MS,
): HookClaimResult {
  const path = claimPath(home, event, sessionId);
  sweepExpiredClaims(home, ttlMs, path);
  if (tryCreateClaim(path)) return "claimed";
  if (reclaimStale(path, ttlMs) === "duplicate") return "duplicate";
  return tryCreateClaim(path) ? "claimed" : "duplicate";
}

export type HookMetricLine = {
  t: string;
  event: HookClaimEvent;
  session_id: string;
  outcome: HookClaimResult | "skipped_no_session_id" | "skipped_not_cursor";
  script: "bootstrap" | "session-end";
};

export function hookMetricsPath(home: string): string {
  return join(home, ".claude", "open-brain", "hook-run-metrics.jsonl");
}

export function appendHookMetric(home: string, line: HookMetricLine): void {
  const path = hookMetricsPath(home);
  mkdirSync(join(home, ".claude", "open-brain"), { recursive: true });
  const row = `${JSON.stringify(line)}\n`;
  appendFileSync(path, row, "utf8");
  process.stderr.write(`[ob-hook-metric] ${row}`);
}

/** Tests only — remove claim files under an isolated HOME. */
export function clearHookClaimsForTest(home: string): void {
  const dir = join(home, ".claude", "open-brain", "hook-claims");
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}
