import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isStateRecord } from "./state-record.js";

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
 *
 * The protocol layout needs no `package.json` (bootstrap-fix round 3, the
 * sibling of QA 135's D2): a Python or Go project bootstrapped inside a Node
 * project that is itself on SIA used to fail its own marker and walk up, so
 * `sync` scored the parent and the session-end hook wrote into the parent's
 * `.agents/`.
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
 * is what readProjectState actually reads, so it is what counts, and so is
 * a record (`.agents/state.json` that is a JSON object carrying
 * `schema_version`, R-BF-18). A file that is not a record does not count.
 * None of the three needs a `package.json`:
 * the stray is excluded by having none of them, not by the missing file.
 * `open-brain/` alone still does, since it is only a marker beside one.
 */
export function isProjectRoot(dir: string): boolean {
  if (existsSync(join(dir, ".agents", "SYSTEM"))
    || existsSync(join(dir, ".agents", "META"))
    || isStateRecord(join(dir, ".agents", "state.json"))) return true;
  return existsSync(join(dir, "package.json")) && existsSync(join(dir, "open-brain"));
}

/**
 * Loop 4 R5: the session-end hook's project directory. Claude Code hands the
 * hook `CLAUDE_PROJECT_DIR`, but a drifted cwd (the hook fired from
 * `open-brain/`) once produced a stray `open-brain/.agents/reflection-queue.json`.
 * Walk up to the real root; when nothing above qualifies, keep the candidate
 * so a project without the protocol layout still gets its `.agents/` where
 * the hook was pointed.
 */
export function resolveHookProjectDir(candidate: string): string {
  return resolveRepoRoot(candidate) ?? resolve(candidate);
}

export function describeNoRoot(start: string): string {
  return `no project root found walking up from ${resolve(start)} — need a directory holding .agents/SYSTEM/, .agents/META/, or a .agents/state.json that is a record, or package.json beside open-brain/`;
}
