import { unlinkSync } from "node:fs";
import type { ClaimTestSeams } from "../../src/shared/session-hook-claim.js";

/** Historical stat→unlink sweep shape (not production); for regression documentation only. */
export function statUnlinkSweepShape(
  claimTestSeams: ClaimTestSeams | undefined,
  claimPath: string,
  ttlMs: number,
  snapStat: (p: string) => { mtimeMs: number } | null,
  unlinkQuiet: (p: string) => void,
): boolean {
  const before = snapStat(claimPath);
  if (!before || Date.now() - before.mtimeMs <= ttlMs) return false;
  claimTestSeams?.sweepAfterStatBeforeRemove?.(claimPath);
  unlinkQuiet(claimPath);
  return true;
}
