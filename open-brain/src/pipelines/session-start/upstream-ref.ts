import { execFileSync } from "node:child_process";

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
