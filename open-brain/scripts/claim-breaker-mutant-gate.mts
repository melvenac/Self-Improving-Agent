/**
 * F2 breaker gate: GREEN releases breaker wx after break attempt; RED if drop-breaker-release mutant.
 * Usage: npx tsx scripts/claim-breaker-mutant-gate.mts <green|red>
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIsolatedClaimModule, importIsolatedClaim } from "./claim-isolated-build.mts";

const mode = process.argv[2];
if (mode !== "green" && mode !== "red") {
  console.error("usage: claim-breaker-mutant-gate.mts <green|red>");
  process.exit(2);
}

const mutant = mode === "green" ? "none" : "drop-breaker-release";
const { builtPath, cleanup } = await buildIsolatedClaimModule(mutant);
try {
  const mod = await importIsolatedClaim(builtPath);
  const { RECLAIM_LOCK_TTL_MS, setClaimTestSeamsForTest, tryBreakStaleReclaimLockForTest } = mod;

  const home = mkdtempSync(join(tmpdir(), "ob-breaker-gate-"));
  try {
    const dir = join(home, ".claude", "open-brain", "hook-claims");
    mkdirSync(dir, { recursive: true });
    const claim = join(dir, "sessionStart-a.claim");
    const stale = (Date.now() - RECLAIM_LOCK_TTL_MS - 60_000) / 1000;
    writeFileSync(claim, "old\n");
    utimesSync(claim, stale, stale);
    const lock = `${claim}.reclaim.${statSync(claim).mtimeMs}`;
    const breaker = `${lock}.breaker`;
    const staleLock = (Date.now() - RECLAIM_LOCK_TTL_MS - 60_000) / 1000;
    writeFileSync(lock, "stale-lock\n");
    utimesSync(lock, staleLock, staleLock);

    setClaimTestSeamsForTest({
      breakerAfterRestatBeforeUnlink: (p) => {
        unlinkSync(p);
        writeFileSync(p, `${Date.now()}\tfresh-b\n`, { flag: "wx" });
      },
    });

    const held = tryBreakStaleReclaimLockForTest(lock) === false && existsSync(lock);
    let breakerReleased = true;
    for (const name of readdirSync(dir)) {
      if (!name.includes(".breaker")) continue;
      const p = join(dir, name);
      try {
        const row = readFileSync(p, "utf8").trim();
        const tab = row.indexOf("\t");
        const pid = tab >= 0 ? Number(row.slice(tab + 1)) : NaN;
        if (pid === process.pid) {
          breakerReleased = false;
          break;
        }
      } catch {
        /* ignore */
      }
    }
    const ok = held && breakerReleased;
    console.log(ok ? "GREEN" : "RED");
  } finally {
    rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
} finally {
  cleanup();
}
