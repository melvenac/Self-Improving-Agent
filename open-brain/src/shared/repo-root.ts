import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Finds the project root by walking up from `start` (Loop 3, R4).
 *
 * The marker is `package.json` beside `.agents/SYSTEM/`, `.agents/META/` or
 * `open-brain/`. A bare `package.json` is not enough on its own to stop the
 * walk: `open-brain/` has one, and running `sync` from there used to score
 * the sub-package as if it were the project and report `7 passed, 11
 * warnings, 1 issue` — a wrong answer with no refusal. The `.agents/`
 * layouts are accepted alongside `open-brain/` because consumer projects
 * (the template) have no `open-brain/` directory and must still resolve.
 *
 * When nothing up the tree carries the marker, a start directory that has
 * its own `package.json` is accepted as-is (a bare project with no
 * `.agents/` yet). A start with no `package.json` anywhere above it returns
 * null and the caller refuses, naming the start directory.
 */
export function resolveRepoRoot(start: string): string | null {
  const from = resolve(start);
  let dir = from;
  for (;;) {
    if (isProjectRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return existsSync(join(from, "package.json")) ? from : null;
}

/**
 * The protocol layout, not a bare `.agents/`: `open-brain/.agents/` exists
 * as a stray (one reflection-queue.json from a hook run with a drifted cwd),
 * and a bare-directory marker would stop there and reproduce the wrong
 * answer this module exists to prevent. `.agents/SYSTEM/` or `.agents/META/`
 * is what readProjectState actually reads, so it is what counts.
 */
export function isProjectRoot(dir: string): boolean {
  if (!existsSync(join(dir, "package.json"))) return false;
  return existsSync(join(dir, ".agents", "SYSTEM"))
    || existsSync(join(dir, ".agents", "META"))
    || existsSync(join(dir, "open-brain"));
}

export function describeNoRoot(start: string): string {
  return `no project root found walking up from ${resolve(start)} — need a directory with package.json beside .agents/SYSTEM/, .agents/META/ or open-brain/`;
}
