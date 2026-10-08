/**
 * QA 284 mixed-session cross-session driver (Plumb shapes). Usage:
 *   npx tsx scripts/claim-cross-session-report.mts [trials]
 */
import { join } from "node:path";
import { spawnAsync } from "../tests/spawn-async.js";
import { runMixedCrossSessionTrials } from "../tests/shared/claim-barrier-trials.js";

const obRoot = join(import.meta.dirname, "..");
const built = join(obRoot, "build/shared/session-hook-claim.js");
const trials = Number(process.argv[2] ?? 100);

const tsc = join(obRoot, "node_modules/typescript/lib/tsc.js");
const tscRun = await spawnAsync(process.execPath, [tsc, "-p", join(obRoot, "tsconfig.json")], { cwd: obRoot });
if (tscRun.status !== 0) {
  console.error(tscRun.stderr || tscRun.stdout);
  process.exit(1);
}

const shapes: { name: string; procs: number; mixed: number }[] = [
  { name: "N=2 mixed=1", procs: 2, mixed: 1 },
  { name: "N=3 mixed=2", procs: 3, mixed: 2 },
  { name: "N=8 mixed=2", procs: 8, mixed: 2 },
  { name: "N=8 mixed=4", procs: 8, mixed: 4 },
];

const out: Record<string, unknown> = { trials, sha: process.env.GIT_SHA ?? "local" };
for (const s of shapes) {
  const r = await runMixedCrossSessionTrials(built, s.procs, s.mixed, trials);
  out[s.name] = r;
  console.log(JSON.stringify({ shape: s.name, ...r }));
}

console.log(JSON.stringify({ summary: out }));
