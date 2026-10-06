/**
 * Build session-hook-claim in a temp tree; never writes the repo checkout.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnAsync } from "../tests/spawn-async.js";

export type ClaimIsolatedMutant = "none" | "m2-no-restat-snap" | "drop-breaker-release";

const obRoot = join(import.meta.dirname, "..");
const srcShared = join(obRoot, "src/shared");

export function applyM2PatchFromSource(source: string): string {
  const block =
    /    const afterSeam = snapStat\(claimPath\);\n    if \(!afterSeam \|\| !sameSnap\(before, afterSeam\)\) return false;\n    if \(Date\.now\(\) - afterSeam\.mtimeMs <= ttlMs\) return false;\n/;
  const patched = source.replace(block, "");
  if (patched === source) {
    throw new Error("M2 mutant patch did not apply");
  }
  return patched;
}

export function applyDropBreakerReleasePatch(source: string): string {
  const patched = source.replace(
    /(\} finally \{\n)    releaseOwnedWxLock\(breakerHeld\);\n(  \}\n\}\n\nfunction tryAcquireReclaimLock)/,
    "$1$2",
  );
  if (patched === source) {
    throw new Error("drop-breaker-release patch did not apply");
  }
  return patched;
}

function applyM2Patch(source: string): string {
  return applyM2PatchFromSource(source);
}

export async function buildIsolatedClaimModule(mutant: ClaimIsolatedMutant): Promise<{
  builtPath: string;
  cleanup: () => void;
}> {
  const work = mkdtempSync(join(tmpdir(), "ob-claim-isolated-"));
  const outDir = join(work, "build/shared");
  const inDir = join(work, "src/shared");
  mkdirSync(outDir, { recursive: true });
  mkdirSync(inDir, { recursive: true });

  let claimSrc = readFileSync(join(srcShared, "session-hook-claim.ts"), "utf8");
  if (mutant === "m2-no-restat-snap") {
    claimSrc = applyM2Patch(claimSrc);
  } else if (mutant === "drop-breaker-release") {
    claimSrc = applyDropBreakerReleasePatch(claimSrc);
  }
  writeFileSync(join(inDir, "session-hook-claim.ts"), claimSrc);
  cpSync(join(srcShared, "active-session.ts"), join(inDir, "active-session.ts"));

  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      outDir: join(work, "build"),
      rootDir: join(work, "src"),
      strict: true,
      skipLibCheck: true,
      declaration: false,
      types: ["node"],
      typeRoots: [join(obRoot, "node_modules/@types")],
    },
    include: ["src/shared/session-hook-claim.ts", "src/shared/active-session.ts"],
  };
  writeFileSync(join(work, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

  const tsc = join(obRoot, "node_modules/typescript/lib/tsc.js");
  const tscRun = await spawnAsync(process.execPath, [tsc, "-p", join(work, "tsconfig.json")], { cwd: work });
  if (tscRun.status !== 0) {
    rmSync(work, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    throw new Error(tscRun.stderr || tscRun.stdout || "isolated tsc failed");
  }

  const builtPath = join(outDir, "session-hook-claim.js");
  return {
    builtPath,
    cleanup: () => rmSync(work, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }),
  };
}

export async function importIsolatedClaim(builtPath: string) {
  return import(pathToFileURL(builtPath).href);
}
