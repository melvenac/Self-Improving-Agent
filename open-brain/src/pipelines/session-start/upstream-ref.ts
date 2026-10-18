import { execFileSync } from "node:child_process";
import { greetingString } from "./greeting-flags.js";

/** Fallback when the remote's default branch cannot be resolved; keeps SIA's behaviour and skip texts unchanged. */
export const FALLBACK_UPSTREAM = "origin/master";

function gitOut(projectRoot: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
      windowsHide: true,
    }).trim();
  } catch {
    return null;
  }
}

function verifiesAsCommit(projectRoot: string, ref: string): boolean {
  return gitOut(projectRoot, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]) !== null;
}

/**
 * T-250: the remote-tracking ref of origin's DEFAULT branch, as of the last fetch. No network.
 */
export function resolveUpstreamRef(projectRoot: string): string {
  try {
    const sym = gitOut(projectRoot, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
    if (sym !== null && sym.startsWith("origin/") && verifiesAsCommit(projectRoot, sym)) {
      return sym;
    }
    if (verifiesAsCommit(projectRoot, "origin/main")) return "origin/main";
    if (verifiesAsCommit(projectRoot, "origin/master")) return "origin/master";
  } catch {
    /* never throw */
  }
  return FALLBACK_UPSTREAM;
}

/** T-298 (3): a branch name, not ref syntax: no leading "-", no spaces, no "..". */
const RECORD_BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/**
 * T-298 (3): the ref the RECORD is read from and compared with. A project whose record lives on a branch other than the
 * default (Makerspace: docs/t001-plans) names it in greeting.json `record_branch`, so the divergence banner stops firing
 * every start. Absent, malformed or not fetched: resolveUpstreamRef, unchanged. Code questions (merged citations) keep the
 * default branch.
 */
export function resolveRecordRef(projectRoot: string): string {
  const branch = greetingString(projectRoot, "record_branch");
  if (branch !== null && RECORD_BRANCH_RE.test(branch) && !branch.includes("..")) {
    const ref = `origin/${branch}`;
    if (verifiesAsCommit(projectRoot, ref)) return ref;
  }
  return resolveUpstreamRef(projectRoot);
}
