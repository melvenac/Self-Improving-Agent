/**
 * F1 doubles gate against head (GREEN) or M2 mutant (RED). Never mutates the checkout.
 * Usage: npx tsx scripts/claim-m2-f1-gate.mts <green|red>
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIsolatedClaimModule, importIsolatedClaim } from "./claim-isolated-build.mts";

const mode = process.argv[2];
if (mode !== "green" && mode !== "red") {
  console.error("usage: claim-m2-f1-gate.mts <green|red>");
  process.exit(2);
}

const mutant = mode === "green" ? "none" : "m2-no-restat-snap";
const { builtPath, cleanup } = await buildIsolatedClaimModule(mutant);
try {
  const mod = await importIsolatedClaim(builtPath);
  const {
    HOOK_CLAIM_TTL_MS,
    setClaimTestSeamsForTest,
    sweepExpiredClaimsForTest,
    tryClaimHookRun,
  } = mod;

  const home = mkdtempSync(join(tmpdir(), "ob-f1-gate-"));
  try {
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
    const ok = existsSync(race) && tryClaimHookRun(home, "sessionStart", "race-sid") === "duplicate";
    console.log(ok ? "GREEN" : "RED");
  } finally {
    rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
} finally {
  cleanup();
}
