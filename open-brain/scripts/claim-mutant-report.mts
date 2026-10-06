/**
 * QA evidence: barrier trials after a named mutant (isolated build; checkout untouched).
 * Usage: npx tsx scripts/claim-mutant-report.mts <no-lock|skip-self|sweep-stat-unlink|m2-no-restat-snap> [trials] [mode]
 */
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnAsync } from "../tests/spawn-async.js";
import { runClaimBarrierTrials } from "../tests/shared/claim-barrier-trials.js";
import { applyDropBreakerReleasePatch, applyM2PatchFromSource } from "./claim-isolated-build.mts";

const obRoot = join(import.meta.dirname, "..");
const srcPath = join(obRoot, "src/shared/session-hook-claim.ts");
const mutant = process.argv[2];
const trials = Number(process.argv[3] ?? 100);
const mode = (process.argv[4] ?? (mutant === "sweep-stat-unlink" ? "crashed-lock" : "stale")) as
  | "crashed-lock"
  | "stale";

if (!mutant) {
  console.error(
    "usage: claim-mutant-report.mts <no-lock|skip-self|sweep-stat-unlink|m2-no-restat-snap> [trials] [mode]",
  );
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
} else if (mutant === "m2-no-restat-snap") {
  patched = applyM2PatchFromSource(patched);
} else if (mutant === "drop-breaker-release") {
  patched = applyDropBreakerReleasePatch(patched);
} else {
  console.error(`unknown mutant: ${mutant}`);
  process.exit(1);
}

if (patched === original) {
  console.error("mutant patch did not apply");
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "ob-claim-mutant-"));
const outDir = join(work, "build/shared");
const inDir = join(work, "src/shared");
mkdirSync(outDir, { recursive: true });
mkdirSync(inDir, { recursive: true });
writeFileSync(join(inDir, "session-hook-claim.ts"), patched);
cpSync(join(obRoot, "src/shared/active-session.ts"), join(inDir, "active-session.ts"));
const tsconfig = {
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    outDir: join(work, "build"),
    rootDir: join(work, "src"),
    strict: true,
    skipLibCheck: true,
    types: ["node"],
    typeRoots: [join(obRoot, "node_modules/@types")],
  },
  include: ["src/shared/session-hook-claim.ts", "src/shared/active-session.ts"],
};
writeFileSync(join(work, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

const tsc = join(obRoot, "node_modules/typescript/lib/tsc.js");
const tscRun = await spawnAsync(process.execPath, [tsc, "-p", join(work, "tsconfig.json")], { cwd: work });
if (tscRun.status !== 0) {
  rmSync(work, { recursive: true, force: true });
  console.error(tscRun.stderr || tscRun.stdout);
  process.exit(1);
}

const built = join(outDir, "session-hook-claim.js");
try {
  const r = await runClaimBarrierTrials(built, 8, trials, mode);
  const line = {
    mutant,
    mode,
    trials,
    doubles: r.doubles,
    zeroClaims: r.zeroClaims,
    exact: r.exact,
    throws: r.throws,
    late: r.late,
  };
  console.log(JSON.stringify(line));
  if (r.throws > 0 || r.exact === 0) {
    console.error(`mutant run invalid: throws=${r.throws} exact=${r.exact} sample=${r.sample}`);
    process.exit(1);
  }
} finally {
  rmSync(work, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
}
