/**
 * Copy the non-TypeScript files the built code READS at run time into `build/`.
 *
 * Runs as part of `postbuild`, after `prebuild` has wiped `build/`.
 *
 * WHY THIS EXISTS, and why it is narrow. `tsc` emits JavaScript and nothing
 * else, so a `.json` file that source imports by path is simply absent from a
 * built copy. The gate thresholds in `src/harness/policies/` are read from disk
 * at run time — that is the whole point of them being data — so the built CLI
 * needs them beside it.
 *
 * **Only files that are read are copied.** `src/harness/schemas/` is
 * deliberately NOT copied: those files are derived artifacts for humans and
 * tooling, nothing at run time opens them, and a build copy of them would be
 * exactly what `cli.ts` already refuses to create — "a copy that looks
 * authoritative, is never read, and disappears on the next prebuild rm".
 *
 * **It fails loudly.** A silent skip here produces a built CLI that refuses
 * every live gate with "no policy directory", far from the cause.
 */
import { cpSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

/** Each entry is a directory that the BUILT code opens at run time. */
const RUNTIME_ASSET_DIRS = ["harness/policies", "trigger/policies"];

let copied = 0;
for (const rel of RUNTIME_ASSET_DIRS) {
  const from = join(root, "src", rel);
  const to = join(root, "build", rel);
  if (!existsSync(from)) {
    throw new Error(
      `build asset directory src/${rel} does not exist. The built CLI reads it at run time, so a ` +
        `missing directory here becomes a refusal much later and somewhere else. Fix the path in ` +
        `scripts/copy-build-assets.mjs or restore the directory.`,
    );
  }
  cpSync(from, to, { recursive: true });
  copied += readdirSync(to).length;
}

console.log(`copied ${copied} runtime asset file(s) into build/`);
