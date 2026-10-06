import { appendFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectIde } from "./active-session.js";

/** T-235 P2-7: dual Cursor + Claude settings hooks can fire twice within milliseconds; legitimate resume is minutes later. */
export const HOOK_CLAIM_TTL_MS = 120_000;

/** Crashed reclaim / breaker locks older than this may be broken; live locks younger than this are never broken. */
export const RECLAIM_LOCK_TTL_MS = 60_000;

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
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      writeFileSync(path, `${new Date().toISOString()}\t${process.pid}\n`, { flag: "wx" });
      return true;
    } catch (err) {
      const code = errno(err);
      if (code === "EEXIST") return false;
      if (code === "EPERM" || code === "EBUSY") continue;
      throw err;
    }
  }
  return false;
}

function errno(err: unknown): string | undefined {
  return (err as NodeJS.ErrnoException).code;
}

/**
 * Rename. ENOENT means the other process already moved the file.
 * Windows also returns EPERM while that rename is in progress; retry, then treat it as a loss.
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

type FileStatSnap = { ino: number; mtimeMs: number; size: number };

function snapStat(path: string): FileStatSnap | null {
  try {
    const s = statSync(path);
    return { ino: Number(s.ino), mtimeMs: s.mtimeMs, size: s.size };
  } catch {
    return null;
  }
}

function sameSnap(a: FileStatSnap, b: FileStatSnap): boolean {
  return a.ino === b.ino && a.mtimeMs === b.mtimeMs && a.size === b.size;
}

function reclaimLockPath(claimPath: string): string {
  return `${claimPath}.reclaim`;
}

function reclaimBreakerPath(lockPath: string): string {
  return `${lockPath}.breaker`;
}

function isReclaimLockEntry(name: string): boolean {
  return name.endsWith(".reclaim");
}

function isBreakerLockEntry(name: string): boolean {
  return name.endsWith(".breaker");
}

function isClaimFileEntry(name: string): boolean {
  return name.endsWith(".claim");
}

/** Test-only seam between stat and destructive act (unset in production hooks). */
export type ClaimTestSeams = {
  breakerAfterStatBeforeBreak?: (lockPath: string) => void;
  sweepAfterStatBeforeRemove?: (claimPath: string) => void;
};

let claimTestSeams: ClaimTestSeams | undefined;

export function setClaimTestSeamsForTest(seams: ClaimTestSeams | undefined): void {
  claimTestSeams = seams;
}

function unlinkQuiet(path: string): void {
  try {
    unlinkSync(path);
  } catch (err) {
    const code = errno(err);
    if (code !== "ENOENT" && code !== "EPERM" && code !== "EBUSY") throw err;
  }
}

/**
 * Break an expired auxiliary wx file (breaker only). Reclaim locks are broken only under a held breaker wx lock.
 */
function tryBreakStaleAuxLockFile(lockPath: string, ttlMs: number = RECLAIM_LOCK_TTL_MS): boolean {
  const before = snapStat(lockPath);
  if (!before) return false;
  if (Date.now() - before.mtimeMs <= ttlMs) return false;
  claimTestSeams?.breakerAfterStatBeforeBreak?.(lockPath);
  const after = snapStat(lockPath);
  if (!after || !sameSnap(before, after)) return false;
  if (Date.now() - after.mtimeMs <= ttlMs) return false;
  unlinkQuiet(lockPath);
  return true;
}

/**
 * While holding an exclusive wx on lockPath.breaker, remove a stale reclaim lock at lockPath.
 * Never unlink after stat alone without re-checking the same inode (r5 D1).
 */
function breakStaleReclaimLockWhileBreakerHeld(lockPath: string, ttlMs: number = RECLAIM_LOCK_TTL_MS): boolean {
  const before = snapStat(lockPath);
  if (!before) return true;
  if (Date.now() - before.mtimeMs <= ttlMs) return false;
  claimTestSeams?.breakerAfterStatBeforeBreak?.(lockPath);
  const after = snapStat(lockPath);
  if (!after || !sameSnap(before, after)) return false;
  if (Date.now() - after.mtimeMs <= ttlMs) return false;
  unlinkQuiet(lockPath);
  return true;
}

function tryAcquireBreakerLock(breakerPath: string): boolean {
  if (tryCreateClaim(breakerPath)) return true;
  if (tryBreakStaleAuxLockFile(breakerPath) && tryCreateClaim(breakerPath)) return true;
  return false;
}

function releaseBreakerLock(breakerPath: string): void {
  unlinkQuiet(breakerPath);
}

function tryAcquireReclaimLock(lockPath: string): boolean {
  if (tryCreateClaim(lockPath)) return true;
  const breakerPath = reclaimBreakerPath(lockPath);
  if (!tryAcquireBreakerLock(breakerPath)) return false;
  try {
    if (!breakStaleReclaimLockWhileBreakerHeld(lockPath)) return false;
  } finally {
    releaseBreakerLock(breakerPath);
  }
  return tryCreateClaim(lockPath);
}

function releaseReclaimLock(lockPath: string): void {
  unlinkQuiet(lockPath);
}

/**
 * Reclaim a stale claim while holding an exclusive wx lock on claim.reclaim.
 * Stat and rename run under the lock, so no other process can wx-create or rename the claim in between.
 * There is no put-back onto the claim path (never overwrites an existing claim file).
 */
function reclaimStale(path: string, ttlMs: number): "reclaimed" | "duplicate" {
  const lockPath = reclaimLockPath(path);
  if (!tryAcquireReclaimLock(lockPath)) return "duplicate";
  try {
    try {
      const mtime = statSync(path).mtimeMs;
      if (Date.now() - mtime <= ttlMs) return "duplicate";
    } catch (err) {
      if (errno(err) === "ENOENT") return "duplicate";
      throw err;
    }
    const aside = `${path}.stale.${process.pid}`;
    if (renameExclusive(path, aside) === "lost") return "duplicate";
    try {
      if (Date.now() - statSync(aside).mtimeMs <= ttlMs) {
        unlinkQuiet(aside);
        return "duplicate";
      }
    } catch (err) {
      if (errno(err) === "ENOENT") return "duplicate";
      throw err;
    }
    unlinkQuiet(aside);
    return "reclaimed";
  } finally {
    releaseReclaimLock(lockPath);
  }
}

function sweepRemoveExpiredClaimFile(claimPath: string, ttlMs: number): boolean {
  const lockPath = reclaimLockPath(claimPath);
  if (!tryAcquireReclaimLock(lockPath)) return false;
  try {
    const before = snapStat(claimPath);
    if (!before || Date.now() - before.mtimeMs <= ttlMs) return false;
    claimTestSeams?.sweepAfterStatBeforeRemove?.(claimPath);
    const after = snapStat(claimPath);
    if (!after || !sameSnap(before, after)) return false;
    if (Date.now() - after.mtimeMs <= ttlMs) return false;
    unlinkQuiet(claimPath);
    return true;
  } finally {
    releaseReclaimLock(lockPath);
  }
}

/** Drop at most this many expired claim files per call, so a hook never walks an unbounded directory. */
export const SWEEP_CAP = 32;

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
    if (isReclaimLockEntry(name) || isBreakerLockEntry(name)) continue;
    const p = join(dir, name);
    if (p === keep) continue;
    try {
      if (isClaimFileEntry(name)) {
        if (sweepRemoveExpiredClaimFile(p, ttlMs)) removed++;
        continue;
      }
      if (now - statSync(p).mtimeMs <= ttlMs) continue;
      unlinkQuiet(p);
      removed++;
    } catch {
      continue;
    }
  }
}

/**
 * Atomic exclusive claim (wx). A stale claim is reclaimed under a per-path wx reclaim lock, then wx.
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

/** Tests only — observe sweep without claiming. */
export function sweepExpiredClaimsForTest(home: string, ttlMs: number, keep: string): void {
  sweepExpiredClaims(home, ttlMs, keep);
}

/** Tests only — break a stale reclaim lock using production logic. */
export function tryBreakStaleReclaimLockForTest(lockPath: string, ttlMs?: number): boolean {
  const breakerPath = reclaimBreakerPath(lockPath);
  if (!tryAcquireBreakerLock(breakerPath)) return false;
  try {
    return breakStaleReclaimLockWhileBreakerHeld(lockPath, ttlMs ?? RECLAIM_LOCK_TTL_MS);
  } finally {
    releaseBreakerLock(breakerPath);
  }
}

/**
 * Tests only — r4 rename-aside breaker (QA turn-57 D1 bug shape) for red/green interleave rows.
 */
export function tryBreakStaleReclaimLockR4ShapeForTest(lockPath: string, ttlMs?: number): boolean {
  const ttl = ttlMs ?? RECLAIM_LOCK_TTL_MS;
  const before = snapStat(lockPath);
  if (!before) return false;
  if (Date.now() - before.mtimeMs <= ttl) return false;
  const aside = `${lockPath}.stale-break.${process.pid}`;
  if (renameExclusive(lockPath, aside) === "lost") return false;
  const asideSnap = snapStat(aside);
  if (!asideSnap || !sameSnap(before, asideSnap)) {
    unlinkQuiet(aside);
    return false;
  }
  unlinkQuiet(aside);
  return true;
}

/** Tests only — r4 sweep stat-then-unlink on a claim path (D2 bug shape). */
export function sweepRemoveClaimR4ShapeForTest(claimPath: string, ttlMs: number): boolean {
  try {
    if (Date.now() - statSync(claimPath).mtimeMs <= ttlMs) return false;
    claimTestSeams?.sweepAfterStatBeforeRemove?.(claimPath);
    unlinkQuiet(claimPath);
    return true;
  } catch {
    return false;
  }
}

/** Tests only — remove claim files under an isolated HOME. */
export function clearHookClaimsForTest(home: string): void {
  const dir = join(home, ".claude", "open-brain", "hook-claims");
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}
