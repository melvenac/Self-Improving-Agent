import { execFileSync } from "node:child_process";

const gitOut = (cwd: string, args: string[]): string | null => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
};

/**
 * Is this the main checkout, or a linked worktree?
 *
 * `--absolute-git-dir` and `--git-common-dir` are the SAME path in the main
 * checkout and differ in a linked worktree, where the git dir is
 * `<common>/worktrees/<name>`. Measured across all three trees here.
 *
 * Returns null when git cannot answer, and the caller then says nothing about
 * consequences rather than guessing one.
 *
 * T-172: moved here from `pipelines/sync/checks.ts` so `main-rebuild` refuses a
 * linked worktree by the same test the build-freshness check reports with.
 */
export function isMainCheckout(projectRoot: string): boolean | null {
  const gitDir = gitOut(projectRoot, ["rev-parse", "--path-format=absolute", "--absolute-git-dir"]);
  const commonDir = gitOut(projectRoot, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (gitDir === null || commonDir === null) return null;
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return norm(gitDir) === norm(commonDir);
}
