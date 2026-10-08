import { join } from "node:path";
import { spawnAsync } from "../tests/spawn-async.js";
import { runClaimBarrierTrials } from "../tests/shared/claim-barrier-trials.js";

const mode = process.argv[2] as "stale" | "crashed-lock";
const procs = Number(process.argv[3]);
const trials = Number(process.argv[4] ?? 100);
const obRoot = join(import.meta.dirname, "..");
const built = join(obRoot, "build/shared/session-hook-claim.js");
const tsc = join(obRoot, "node_modules/typescript/lib/tsc.js");
await spawnAsync(process.execPath, [tsc, "-p", join(obRoot, "tsconfig.json")], { cwd: obRoot });
const r = await runClaimBarrierTrials(built, procs, trials, mode);
console.log(JSON.stringify({ mode, procs, trials, ...r }));
