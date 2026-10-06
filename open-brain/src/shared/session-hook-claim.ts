import {
  appendFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { detectIde } from "./active-session.js";

/** T-235 P2-7: dual Cursor + Claude settings hooks can fire twice within milliseconds; legitimate resume is minutes later. */
export const HOOK_CLAIM_TTL_MS = 120_000;

/** Crashed auxiliary lock files older than this may be rotated past; live locks younger than this are never broken. */
export const RECLAIM_LOCK_TTL_MS = 60_000;

/** When reclaim or sweep races another session, retry before returning duplicate (liveness). */
export const CLAIM_RETRY_MS = 2_000;

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
  let lastErr: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      claimTestSeams?.snapStatInject?.(path);
      const s = statSync(path);
      return { ino: Number(s.ino), mtimeMs: s.mtimeMs, size: s.size };
    } catch (err) {
      lastErr = err;
      const code = errno(err);
      if (code === "ENOENT") return null;
      if (code === "EPERM" || code === "EBUSY") continue;
      throw err;
    }
  }
  throw lastErr;
}

function sameSnap(a: FileStatSnap, b: FileStatSnap): boolean {
  return a.ino === b.ino && a.mtimeMs === b.mtimeMs && a.size === b.size;
}

/** Reclaim wx lock is named by the stale claim generation (mtimeMs) so nothing breaks a live lock in the hot path. */
function reclaimLockPathForClaim(claimPath: string): string | undefined {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      claimTestSeams?.claimBeforeGenerationStat?.(claimPath);
      const mtimeMs = statSync(claimPath).mtimeMs;
      return `${claimPath}.reclaim.${mtimeMs}`;
    } catch (err) {
      const code = errno(err);
      if (code === "ENOENT") return undefined;
      if (code === "EPERM" || code === "EBUSY") continue;
      throw err;
    }
  }
  return undefined;
}

function isReclaimLockEntry(name: string): boolean {
  return name.includes(".reclaim");
}

function isBreakerOrRotatedEntry(name: string): boolean {
  return name.includes(".breaker") || name.includes(".rot.");
}

function isClaimFileEntry(name: string): boolean {
  return name.endsWith(".claim");
}

function isStaleTombstoneEntry(name: string): boolean {
  return name.includes(".stale.") || name.includes(".swept.");
}

/** Test-only seams (unset in production hooks). */
export type ClaimTestSeams = {
  breakerAfterStatBeforeBreak?: (lockPath: string) => void;
  breakerAfterRestatBeforeUnlink?: (lockPath: string) => void;
  sweepAfterStatBeforeRemove?: (claimPath: string) => void;
  sweepAfterRestatBeforeRename?: (claimPath: string) => void;
  /** Test seam: runs before each stat used to name a generation reclaim lock. */
  claimBeforeGenerationStat?: (claimPath: string) => void;
  /** Test seam: throw EPERM/EBUSY (or other errno) to exercise snapStat / tryClaimHookRun retry paths. */
  snapStatInject?: (path: string) => void;
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

function releaseOwnedWxLock(lockPath: string): void {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const row = readFileSync(lockPath, "utf8").trim();
      const tab = row.indexOf("\t");
      const pid = tab >= 0 ? Number(row.slice(tab + 1)) : NaN;
      if (pid === process.pid) unlinkQuiet(lockPath);
      return;
    } catch (err) {
      const code = errno(err);
      if (code === "ENOENT") return;
      if (code === "EPERM" || code === "EBUSY") continue;
      throw err;
    }
  }
}

/**
 * Wx this path, or wx a rotated sibling if the base file is an abandoned stale wx lock (never stat→unlink in hot path).
 */
function tryWxFreshOrRotated(basePath: string, ttlMs: number): string | null {
  if (tryCreateClaim(basePath)) return basePath;
  const before = snapStat(basePath);
  if (!before) return tryCreateClaim(basePath) ? basePath : null;
  if (Date.now() - before.mtimeMs <= ttlMs) return null;
  const rotated = `${basePath}.rot.${before.mtimeMs}`;
  return tryCreateClaim(rotated) ? rotated : null;
}

function breakStaleWxLockWhileHolderHeld(lockPath: string, ttlMs: number = RECLAIM_LOCK_TTL_MS): boolean {
  const before = snapStat(lockPath);
  if (!before) return true;
  if (Date.now() - before.mtimeMs <= ttlMs) return false;
  claimTestSeams?.breakerAfterStatBeforeBreak?.(lockPath);
  const afterStat = snapStat(lockPath);
  if (!afterStat || !sameSnap(before, afterStat)) return false;
  if (Date.now() - afterStat.mtimeMs <= ttlMs) return false;
  claimTestSeams?.breakerAfterRestatBeforeUnlink?.(lockPath);
  const afterRestat = snapStat(lockPath);
  if (!afterRestat || !sameSnap(before, afterRestat)) return false;
  if (Date.now() - afterRestat.mtimeMs <= ttlMs) return false;
  unlinkQuiet(lockPath);
  return true;
}

function tryBreakStaleReclaimLockViaBreaker(lockPath: string, ttlMs: number = RECLAIM_LOCK_TTL_MS): boolean {
  const breakerBase = `${lockPath}.breaker`;
  const breakerHeld = tryWxFreshOrRotated(breakerBase, ttlMs);
  if (!breakerHeld) return false;
  try {
    return breakStaleWxLockWhileHolderHeld(lockPath, ttlMs);
  } finally {
    releaseOwnedWxLock(breakerHeld);
  }
}

function tryAcquireReclaimLock(claimPath: string): { ok: boolean; lockPath: string } {
  const lockPath = reclaimLockPathForClaim(claimPath);
  if (!lockPath) return { ok: false, lockPath: `${claimPath}.reclaim.?` };
  if (tryCreateClaim(lockPath)) return { ok: true, lockPath };
  if (!tryBreakStaleReclaimLockViaBreaker(lockPath, RECLAIM_LOCK_TTL_MS)) return { ok: false, lockPath };
  return { ok: tryCreateClaim(lockPath), lockPath };
}

function releaseReclaimLock(lockPath: string): void {
  releaseOwnedWxLock(lockPath);
}

function claimFileIsFresh(path: string, ttlMs: number): boolean {
  const snap = snapStat(path);
  return snap !== null && Date.now() - snap.mtimeMs <= ttlMs;
}

function reclaimStale(path: string, ttlMs: number): "reclaimed" | "duplicate" {
  const { ok, lockPath } = tryAcquireReclaimLock(path);
  if (!ok) return "duplicate";
  try {
    let mtimeMs: number;
    try {
      mtimeMs = statSync(path).mtimeMs;
    } catch (err) {
      const code = errno(err);
      if (code === "ENOENT") return "duplicate";
      if (code === "EPERM" || code === "EBUSY") return "duplicate";
      throw err;
    }
    if (Date.now() - mtimeMs <= ttlMs) return "duplicate";
    const aside = `${path}.stale.${process.pid}`;
    if (renameExclusive(path, aside) === "lost") return "duplicate";
    try {
      if (Date.now() - statSync(aside).mtimeMs <= ttlMs) {
        try {
          linkSync(aside, path);
        } catch (err) {
          if (errno(err) !== "EEXIST") throw err;
        }
        return "duplicate";
      }
    } catch (err) {
      if (errno(err) === "ENOENT") return "duplicate";
      if (errno(err) === "EPERM" || errno(err) === "EBUSY") return "duplicate";
      throw err;
    }
    unlinkQuiet(aside);
    return "reclaimed";
  } finally {
    releaseReclaimLock(lockPath);
  }
}

/** Remove an expired claim only while holding that claim generation's reclaim wx lock. */
function sweepRemoveExpiredClaimFile(claimPath: string, ttlMs: number): boolean {
  const { ok, lockPath } = tryAcquireReclaimLock(claimPath);
  if (!ok) return false;
  try {
    const before = snapStat(claimPath);
    if (!before || Date.now() - before.mtimeMs <= ttlMs) return false;
    claimTestSeams?.sweepAfterStatBeforeRemove?.(claimPath);
    const after = snapStat(claimPath);
    if (!after || !sameSnap(before, after)) return false;
    if (Date.now() - after.mtimeMs <= ttlMs) return false;
    claimTestSeams?.sweepAfterRestatBeforeRename?.(claimPath);
    const afterSeam = snapStat(claimPath);
    if (!afterSeam || !sameSnap(before, afterSeam)) return false;
    if (Date.now() - afterSeam.mtimeMs <= ttlMs) return false;
    const aside = `${claimPath}.swept.${process.pid}`;
    if (renameExclusive(claimPath, aside) === "lost") return false;
    unlinkQuiet(aside);
    return true;
  } finally {
    releaseReclaimLock(lockPath);
  }
}

function sweepRemoveStaleTombstone(tombPath: string, ttlMs: number): boolean {
  const before = snapStat(tombPath);
  if (!before || Date.now() - before.mtimeMs <= ttlMs) return false;
  const after = snapStat(tombPath);
  if (!after || !sameSnap(before, after)) return false;
  unlinkQuiet(tombPath);
  return true;
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
  let removed = 0;
  for (const name of names) {
    if (removed >= SWEEP_CAP) break;
    if (isReclaimLockEntry(name) || isBreakerOrRotatedEntry(name)) continue;
    const p = join(dir, name);
    if (p === keep) continue;
    try {
      if (isClaimFileEntry(name)) {
        if (sweepRemoveExpiredClaimFile(p, ttlMs)) removed++;
        continue;
      }
      if (isStaleTombstoneEntry(name)) {
        if (sweepRemoveStaleTombstone(p, ttlMs)) removed++;
        continue;
      }
      const snap = snapStat(p);
      if (!snap || Date.now() - snap.mtimeMs <= ttlMs) continue;
      unlinkQuiet(p);
      removed++;
    } catch {
      continue;
    }
  }
}

function sleepMs(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin */
  }
}

/** Stat errors other than ENOENT on the hook claim path retry inside tryClaimHookRun (Windows EPERM/EBUSY bursts). */
function isHookClaimStatRetryErr(err: unknown): boolean {
  const code = errno(err);
  if (code === "ENOENT") return false;
  return true;
}

/**
 * Atomic exclusive claim (wx). A stale claim is reclaimed under a per-generation wx reclaim lock, then wx.
 */
export function tryClaimHookRun(
  home: string,
  event: HookClaimEvent,
  sessionId: string,
  ttlMs: number = HOOK_CLAIM_TTL_MS,
): HookClaimResult {
  const path = claimPath(home, event, sessionId);
  const deadline = Date.now() + CLAIM_RETRY_MS;
  for (;;) {
    try {
      sweepExpiredClaims(home, ttlMs, path);
      if (tryCreateClaim(path)) return "claimed";
      const reclaimed = reclaimStale(path, ttlMs);
      if (reclaimed === "reclaimed" && tryCreateClaim(path)) return "claimed";
      if (reclaimed === "duplicate" && claimFileIsFresh(path, ttlMs)) return "duplicate";
      if (tryCreateClaim(path)) return "claimed";
    } catch (err) {
      if (!isHookClaimStatRetryErr(err)) throw err;
    }
    if (Date.now() >= deadline) return "duplicate";
    sleepMs(2);
  }
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

/** Tests only — break a stale reclaim lock using production breaker path. */
export function tryBreakStaleReclaimLockForTest(lockPath: string, ttlMs?: number): boolean {
  return tryBreakStaleReclaimLockViaBreaker(lockPath, ttlMs ?? RECLAIM_LOCK_TTL_MS);
}

/** Tests only — remove claim files under an isolated HOME. */
export function clearHookClaimsForTest(home: string): void {
  const dir = join(home, ".claude", "open-brain", "hook-claims");
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}
