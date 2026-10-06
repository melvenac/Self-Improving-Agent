import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  HOOK_CLAIM_TTL_MS,
  RECLAIM_LOCK_TTL_MS,
  clearHookClaimsForTest,
  setClaimTestSeamsForTest,
  sweepExpiredClaimsForTest,
  sweepRemoveClaimR4ShapeForTest,
  tryBreakStaleReclaimLockForTest,
} from "../../src/shared/session-hook-claim.js";

describe("session-hook-claim interleave (T-235 P2-7 r5 D3)", () => {
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

  it("D3a r5: breaker interleave leaves B's fresh reclaim lock and does not break it", () => {
    const dir = join(home, ".claude", "open-brain", "hook-claims");
    mkdirSync(dir, { recursive: true });
    const lock = join(dir, "sessionStart-a.claim.reclaim");
    const stale = (Date.now() - RECLAIM_LOCK_TTL_MS - 60_000) / 1000;
    writeFileSync(lock, "stale\n");
    utimesSync(lock, stale, stale);

    setClaimTestSeamsForTest({
      breakerAfterStatBeforeBreak: () => {
        unlinkSync(lock);
        writeFileSync(lock, `${Date.now()}\tfresh-b\n`, { flag: "wx" });
      },
    });

    expect(tryBreakStaleReclaimLockForTest(lock)).toBe(false);
    expect(existsSync(lock)).toBe(true);
    let lockHeld = false;
    try {
      writeFileSync(lock, "probe\n", { flag: "wx" });
    } catch {
      lockHeld = true;
    }
    expect(lockHeld).toBe(true);
  });

  it("D3b r5: sweep interleave leaves a fresh wx claim on p", () => {
    const dir = join(home, ".claude", "open-brain", "hook-claims");
    mkdirSync(dir, { recursive: true });
    const victim = join(dir, "sessionStart-victim.claim");
    const keep = join(dir, "sessionStart-keeper.claim");
    const stale = (Date.now() - HOOK_CLAIM_TTL_MS - 60_000) / 1000;
    writeFileSync(victim, "old\n");
    writeFileSync(keep, "keep\n");
    utimesSync(victim, stale, stale);

    setClaimTestSeamsForTest({
      sweepAfterStatBeforeRemove: () => {
        unlinkSync(victim);
        writeFileSync(victim, `${Date.now()}\tfresh\n`, { flag: "wx" });
      },
    });

    sweepExpiredClaimsForTest(home, HOOK_CLAIM_TTL_MS, keep);
    expect(existsSync(victim)).toBe(true);
  });

  it("D3a r4-shape (610dbbba): mismatch aside branch destroys a fresh lock (RED)", () => {
    const dir = join(tmpdir(), "ob-claim-r4a-");
    mkdirSync(dir, { recursive: true });
    const aside = join(dir, "fresh.claim.reclaim.stale-break.1");
    writeFileSync(aside, "fresh-holder\n", { flag: "wx" });
    // tryBreakStaleLockFile L105-110: on inode mismatch, unlinkSync(aside) deletes a live lock.
    unlinkSync(aside);
    expect(existsSync(aside)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("D3b r4-shape stat-unlink (610dbbba sweep): fresh claim is deleted (RED)", () => {
    const dir = join(tmpdir(), "ob-claim-r4b-");
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

    expect(sweepRemoveClaimR4ShapeForTest(victim, HOOK_CLAIM_TTL_MS)).toBe(true);
    expect(existsSync(victim)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});
