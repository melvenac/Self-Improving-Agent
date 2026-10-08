/**
 * T-235 P2-7 r6 HEAVY evidence: cross-session + same-session barriers. One tsx process.
 */
import { join } from "node:path";
import { spawnAsync } from "../tests/spawn-async.js";
import {
  runClaimBarrierTrials,
  runMixedCrossSessionTrials,
} from "../tests/shared/claim-barrier-trials.js";

const obRoot = join(import.meta.dirname, "..");
const built = join(obRoot, "build/shared/session-hook-claim.js");
const trials = Number(process.env.CLAIM_TRIALS ?? 100);

const tsc = join(obRoot, "node_modules/typescript/lib/tsc.js");
const tscRun = await spawnAsync(process.execPath, [tsc, "-p", join(obRoot, "tsconfig.json")], { cwd: obRoot });
if (tscRun.status !== 0) {
  console.error(tscRun.stderr || tscRun.stdout);
  process.exit(1);
}

const rows: Record<string, unknown> = { head: process.env.GIT_SHA ?? "local", trials };

const mixed: { name: string; procs: number; mixed: number }[] = [
  { name: "cross N=2 1+1", procs: 2, mixed: 1 },
  { name: "cross N=3 dual+1", procs: 3, mixed: 2 },
  { name: "cross N=8 dual+6", procs: 8, mixed: 2 },
  { name: "cross N=8 4+4", procs: 8, mixed: 4 },
];
for (const s of mixed) {
  const r = await runMixedCrossSessionTrials(built, s.procs, s.mixed, trials);
  rows[s.name] = r;
  console.log(JSON.stringify({ row: s.name, ...r }));
}

const barriers: { name: string; procs: number; mode: "stale" | "crashed-lock" }[] = [
  { name: "barrier stale N=2", procs: 2, mode: "stale" },
  { name: "barrier stale N=3", procs: 3, mode: "stale" },
  { name: "barrier stale N=8", procs: 8, mode: "stale" },
  { name: "barrier crashed-lock N=2", procs: 2, mode: "crashed-lock" },
  { name: "barrier crashed-lock N=3", procs: 3, mode: "crashed-lock" },
  { name: "barrier crashed-lock N=8", procs: 8, mode: "crashed-lock" },
];
for (const b of barriers) {
  const r = await runClaimBarrierTrials(built, b.procs, trials, b.mode);
  rows[b.name] = r;
  console.log(JSON.stringify({ row: b.name, ...r }));
}

console.log(JSON.stringify({ summary: rows }));
