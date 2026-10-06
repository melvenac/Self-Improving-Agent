import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { runF1DoublesGate } from "./claim-f1-doubles-gate.js";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  HOOK_CLAIM_TTL_MS,
  RECLAIM_LOCK_TTL_MS,
  clearHookClaimsForTest,
  setClaimTestSeamsForTest,
  sweepExpiredClaimsForTest,
  tryBreakStaleReclaimLockForTest,
  tryClaimHookRun,
} from "../../src/shared/session-hook-claim.js";
import { statUnlinkSweepShape } from "./claim-sweep-shape-helpers.js";

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

  it("r6 doubles gate: sweep restat gap must not rename a reclaim wx claim (GREEN on lock+snap)", () => {
    const dir = join(home, ".claude", "open-brain", "hook-claims");
    mkdirSync(dir, { recursive: true });
    const race = join(dir, "sessionStart-race-sid.claim");
    const other = join(dir, "sessionStart-other-0.claim");
    const stale = (Date.now() - HOOK_CLAIM_TTL_MS - 600_000) / 1000;
    writeFileSync(race, "old\n");
    writeFileSync(other, "keep\n");
    utimesSync(race, stale, stale);

    setClaimTestSeamsForTest({
      sweepAfterRestatBeforeRename: () => {
        unlinkSync(race);
        writeFileSync(race, `${Date.now()}\t${process.pid}\n`, { flag: "wx" });
      },
    });

    sweepExpiredClaimsForTest(home, HOOK_CLAIM_TTL_MS, other);
    expect(existsSync(race)).toBe(true);
    expect(tryClaimHookRun(home, "sessionStart", "race-sid")).toBe("duplicate");
  });

  it("F1 doubles gate GREEN on head (shared gate helper)", () => {
    expect(runF1DoublesGate(home)).toBe(true);
  });

  it("F1 M2 no-restat-snap RED (isolated gate, checkout untouched)", async () => {
    const script = join(__dirname, "../../scripts/claim-m2-f1-gate.mts");
    const { spawnAsync } = await import("../spawn-async.js");
    const r = await spawnAsync(process.execPath, ["--import", "tsx", script, "red"], {
      cwd: join(__dirname, "../.."),
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("RED");
  }, 120_000);

  it("F1 M2 no-restat-snap GREEN on head (isolated gate)", async () => {
    const script = join(__dirname, "../../scripts/claim-m2-f1-gate.mts");
    const { spawnAsync } = await import("../spawn-async.js");
    const r = await spawnAsync(process.execPath, ["--import", "tsx", script, "green"], {
      cwd: join(__dirname, "../.."),
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("GREEN");
  }, 120_000);

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

  it("historical stat-unlink sweep shape (documentation only, not a production gate)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ob-claim-mut-"));
    const victim = join(dir, "sessionStart-m.claim");
    const stale = (Date.now() - HOOK_CLAIM_TTL_MS - 60_000) / 1000;
    writeFileSync(victim, "old\n");
    utimesSync(victim, stale, stale);

    const seams = {
      sweepAfterStatBeforeRemove: () => {
        unlinkSync(victim);
        writeFileSync(victim, `${Date.now()}\tfresh\n`, { flag: "wx" });
      },
    };
    setClaimTestSeamsForTest(seams);

    const snap = (p: string) => {
      try {
        const s = statSync(p);
        return { mtimeMs: s.mtimeMs };
      } catch {
        return null;
      }
    };
    expect(statUnlinkSweepShape(seams, victim, HOOK_CLAIM_TTL_MS, snap, unlinkSync)).toBe(true);
    expect(existsSync(victim)).toBe(false);
    setClaimTestSeamsForTest(undefined);
    rmSync(dir, { recursive: true, force: true });
  });
});
