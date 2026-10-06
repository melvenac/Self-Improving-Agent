/**
 * QA evidence: doubles per 100 on the overlapping barrier row after a named mutant.
 * Usage: npx tsx scripts/claim-mutant-report.mts <no-lock|skip-self|sweep-stat-unlink> [trials] [mode]
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnAsync } from "../tests/spawn-async.js";
import { runClaimBarrierTrials } from "../tests/shared/claim-barrier-trials.js";

const obRoot = join(import.meta.dirname, "..");
const srcPath = join(obRoot, "src/shared/session-hook-claim.ts");
const built = join(obRoot, "build/shared/session-hook-claim.js");
const mutant = process.argv[2];
const trials = Number(process.argv[3] ?? 100);
const mode = (process.argv[4] ?? (mutant === "sweep-stat-unlink" ? "crashed-lock" : "stale")) as
  | "crashed-lock"
  | "stale";

if (!mutant) {
  console.error("usage: claim-mutant-report.mts <no-lock|skip-self|sweep-stat-unlink> [trials] [mode]");
  process.exit(1);
}

const original = readFileSync(srcPath, "utf8");
let patched = original;

const r2Reclaim = execSync("git show 3dfa2424:open-brain/src/shared/session-hook-claim.ts", {
  cwd: join(obRoot, ".."),
  encoding: "utf8",
});
const r2Match = r2Reclaim.match(
  /function reclaimStale\(path: string, ttlMs: number\):[\s\S]*?\n}\n\n\/\*\* Drop at most/,
);
if (!r2Match) {
  console.error("could not extract r2 reclaimStale");
  process.exit(1);
}
const r2ReclaimFn = r2Match[0].replace(/\n\/\*\* Drop at most$/, "");

if (mutant === "no-lock") {
  patched = patched.replace(
    /function reclaimStale\(path: string, ttlMs: number\):[\s\S]*?\n}\n\n\/\*\* Remove an expired claim/,
    `${r2ReclaimFn}\n\n/** Remove an expired claim`,
  );
} else if (mutant === "skip-self") {
  patched = patched.replace("    if (p === keep) continue;\n", "");
} else if (mutant === "sweep-stat-unlink") {
  const sweepMutant = `function sweepRemoveExpiredClaimFile(claimPath: string, ttlMs: number): boolean {
  const before = snapStat(claimPath);
  if (!before || Date.now() - before.mtimeMs <= ttlMs) return false;
  claimTestSeams?.sweepAfterStatBeforeRemove?.(claimPath);
  unlinkQuiet(claimPath);
  return true;
}`;
  patched = patched.replace(
    /\/\*\* Remove an expired claim only while holding that claim generation's reclaim wx lock\. \*\/\nfunction sweepRemoveExpiredClaimFile\(claimPath: string, ttlMs: number\): boolean \{[\s\S]*?\n\}/,
    `/** Remove an expired claim only while holding that claim generation's reclaim wx lock. */
${sweepMutant}`,
  );
} else {
  console.error(`unknown mutant: ${mutant}`);
  process.exit(1);
}

if (patched === original) {
  console.error("mutant patch did not apply");
  process.exit(1);
}

writeFileSync(srcPath, patched);
const tsc = join(obRoot, "node_modules/typescript/lib/tsc.js");
const tscRun = await spawnAsync(process.execPath, [tsc, "-p", join(obRoot, "tsconfig.json")], { cwd: obRoot });
if (tscRun.status !== 0) {
  writeFileSync(srcPath, original);
  console.error(tscRun.stderr || tscRun.stdout);
  process.exit(1);
}

try {
  const r = await runClaimBarrierTrials(built, 8, trials, mode);
  console.log(
    JSON.stringify({
      mutant,
      mode,
      trials,
      doubles: r.doubles,
      zeroClaims: r.zeroClaims,
      exact: r.exact,
      throws: r.throws,
      late: r.late,
    }),
  );
} finally {
  writeFileSync(srcPath, original);
  await spawnAsync(process.execPath, [tsc, "-p", join(obRoot, "tsconfig.json")], { cwd: obRoot });
}
