import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  HOOK_CLAIM_TTL_MS,
  RECLAIM_LOCK_TTL_MS,
  clearHookClaimsForTest,
  setClaimTestSeamsForTest,
  sweepExpiredClaimsForTest,
  sweepRemoveClaimR5ShapeForTest,
  sweepRemoveClaimStatUnlinkMutantForTest,
  tryBreakStaleReclaimLockForTest,
  tryBreakStaleReclaimLockR5ShapeForTest,
  tryClaimHookRun,
} from "../../src/shared/session-hook-claim.js";

describe("session-hook-claim interleave (T-235 P2-7 r6 D3)", () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "ob-claim-interleave-"));
    clearHookClaimsForTest(home);
    setClaimTestSeamsForTest(undefined);
  });

  afterEach(() => {
    setClaimTestSeamsForTest(undefined);
    rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("F2 gate r6: breaker restat gap leaves B's fresh reclaim lock intact", () => {
    const dir = join(home, ".claude", "open-brain", "hook-claims");
    mkdirSync(dir, { recursive: true });
    const claim = join(dir, "sessionStart-a.claim");
    const stale = (Date.now() - RECLAIM_LOCK_TTL_MS - 60_000) / 1000;
    writeFileSync(claim, "old\n");
    utimesSync(claim, stale, stale);
    const lock = `${claim}.reclaim.${statSync(claim).mtimeMs}`;
    const staleLock = (Date.now() - RECLAIM_LOCK_TTL_MS - 60_000) / 1000;
    writeFileSync(lock, "stale-lock\n");
    utimesSync(lock, staleLock, staleLock);

    setClaimTestSeamsForTest({
      breakerAfterRestatBeforeUnlink: (p) => {
        unlinkSync(p);
        writeFileSync(p, `${Date.now()}\tfresh-b\n`, { flag: "wx" });
      },
    });

    expect(tryBreakStaleReclaimLockForTest(lock)).toBe(false);
    expect(existsSync(lock)).toBe(true);
  });

  it("F1 gate r6: cross-session sweep interleave still lets victim claim", () => {
    const dir = join(home, ".claude", "open-brain", "hook-claims");
    mkdirSync(dir, { recursive: true });
    const victim = join(dir, "sessionStart-victim.claim");
    const keep = join(dir, "sessionStart-other.claim");
    const stale = (Date.now() - HOOK_CLAIM_TTL_MS - 60_000) / 1000;
    writeFileSync(victim, "old\n");
    writeFileSync(keep, "keep\n");
    utimesSync(victim, stale, stale);

    setClaimTestSeamsForTest({
      sweepAfterStatBeforeRemove: () => {
        unlinkSync(victim);
      },
    });

    sweepExpiredClaimsForTest(home, HOOK_CLAIM_TTL_MS, keep);
    expect(existsSync(victim)).toBe(false);
    expect(tryClaimHookRun(home, "sessionStart", "victim")).toBe("claimed");
  });

  it("D3a ba09e2c6 shape: unlocked breaker gap destroys fresh lock (RED)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ob-claim-r5a-"));
    const lock = join(dir, "x.claim.reclaim.1");
    const stale = (Date.now() - RECLAIM_LOCK_TTL_MS - 60_000) / 1000;
    writeFileSync(lock, "stale\n");
    utimesSync(lock, stale, stale);

    setClaimTestSeamsForTest({
      breakerAfterRestatBeforeUnlink: () => {
        unlinkSync(lock);
        writeFileSync(lock, `${Date.now()}\tholder\n`, { flag: "wx" });
      },
    });

    tryBreakStaleReclaimLockR5ShapeForTest(lock);
    expect(existsSync(lock)).toBe(false);
    setClaimTestSeamsForTest(undefined);
    rmSync(dir, { recursive: true, force: true });
  });

  it("D3b ba09e2c6 shape: sweep under reclaim lock deletes fresh claim (RED)", () => {
    const dir = join(tmpdir(), "ob-claim-r5b-");
    mkdirSync(dir, { recursive: true });
    const victim = join(dir, "sessionStart-v.claim");
    const stale = (Date.now() - HOOK_CLAIM_TTL_MS - 60_000) / 1000;
    writeFileSync(victim, "old\n");
    utimesSync(victim, stale, stale);

    setClaimTestSeamsForTest({
      sweepAfterStatBeforeRemove: () => {
        unlinkSync(victim);
        writeFileSync(victim, `${Date.now()}\tfresh\n`, { flag: "wx" });
      },
    });

    expect(sweepRemoveClaimR5ShapeForTest(victim, HOOK_CLAIM_TTL_MS)).toBe(true);
    expect(existsSync(victim)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("stat-unlink sweep mutant row goes red on fresh claim", () => {
    const dir = join(tmpdir(), "ob-claim-mut-");
    mkdirSync(dir, { recursive: true });
    const victim = join(dir, "sessionStart-m.claim");
    const stale = (Date.now() - HOOK_CLAIM_TTL_MS - 60_000) / 1000;
    writeFileSync(victim, "old\n");
    utimesSync(victim, stale, stale);

    setClaimTestSeamsForTest({
      sweepAfterStatBeforeRemove: () => {
        unlinkSync(victim);
        writeFileSync(victim, `${Date.now()}\tfresh\n`, { flag: "wx" });
      },
    });

    expect(sweepRemoveClaimStatUnlinkMutantForTest(victim, HOOK_CLAIM_TTL_MS)).toBe(true);
    expect(existsSync(victim)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});
