import { existsSync, mkdirSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  HOOK_CLAIM_TTL_MS,
  setClaimTestSeamsForTest,
  sweepExpiredClaimsForTest,
  tryClaimHookRun,
} from "../../src/shared/session-hook-claim.js";

/**
 * F1 doubles gate (r6 interleave): after sweep with unlink+wx reclaim planted in the restat gap,
 * the wx claim must survive and the session must see duplicate (not a second claim).
 */
export function runF1DoublesGate(home: string): boolean {
  setClaimTestSeamsForTest(undefined);
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
  if (!existsSync(race)) return false;
  return tryClaimHookRun(home, "sessionStart", "race-sid") === "duplicate";
}
