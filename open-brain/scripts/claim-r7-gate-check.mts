/**
 * Swap src to a git sha, build, run gate, restore. Prints GREEN or RED.
 * Usage: npx tsx scripts/claim-r7-gate-check.mts <f1|f9> <git-sha>
 */
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnAsync } from "../tests/spawn-async.js";

const gate = process.argv[2];
const sha = process.argv[3];
const obRoot = join(import.meta.dirname, "..");
const srcPath = join(obRoot, "src/shared/session-hook-claim.ts");
const built = join(obRoot, "build/shared/session-hook-claim.js");
const repoRoot = join(obRoot, "..");

if (!gate || !sha) {
  console.error("usage: claim-r7-gate-check.mts <f1|f9> <git-sha>");
  process.exit(2);
}

const original = readFileSync(srcPath, "utf8");
const swapped = execSync(`git show ${sha}:open-brain/src/shared/session-hook-claim.ts`, {
  cwd: repoRoot,
  encoding: "utf8",
});
writeFileSync(srcPath, swapped);
const tsc = join(obRoot, "node_modules/typescript/lib/tsc.js");
const tscRun = await spawnAsync(process.execPath, [tsc, "-p", join(obRoot, "tsconfig.json")], { cwd: obRoot });
if (tscRun.status !== 0) {
  writeFileSync(srcPath, original);
  console.error(tscRun.stderr || tscRun.stdout);
  process.exit(1);
}

let label = "GREEN";
try {
  if (gate === "f1") {
    const { runF1DoublesGate } = await import(
      `../tests/shared/claim-f1-doubles-gate.js?gate=${sha}-${Date.now()}`
    );
    const home = mkdtempSync(join(tmpdir(), "ob-gate-f1-"));
    try {
      label = runF1DoublesGate(home) ? "GREEN" : "RED";
    } finally {
      rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  } else if (gate === "f9") {
    const { runMixedCrossSessionTrials } = await import(
      `../tests/shared/claim-barrier-trials.js?gate=${sha}-${Date.now()}`
    );
    const r = await runMixedCrossSessionTrials(built, 8, 2, 20);
    label = r.doubles > 0 || r.zeroClaims > 0 || (r.otherZeroClaims ?? 0) > 0 ? "RED" : "GREEN";
  } else {
    console.error(`unknown gate ${gate}`);
    process.exit(2);
  }
} finally {
  writeFileSync(srcPath, original);
  await spawnAsync(process.execPath, [tsc, "-p", join(obRoot, "tsconfig.json")], { cwd: obRoot });
}

console.log(label);
