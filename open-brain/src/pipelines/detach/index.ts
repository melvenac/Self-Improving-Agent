import { execFileSync } from "node:child_process";

/**
 * Return a seat's worktree to detached at `origin/master`.
 *
 * ## Why this is a command
 *
 * C3's concrete first piece, unchanged since 2026-09-17 and still not done: "the
 * planner tree returns to detached after a push." It has been run by hand more
 * than twenty times. Every row that moved from "nowhere" to "a file" in this
 * project moved because a seat chose to do it in a session and told the next seat
 * where to look — which is the failure C3 describes, executed well.
 *
 * The step is four git commands and every one of them has a way to lose work.
 *
 * ## `origin/master`, never `master`
 *
 * `shared.md` carries this as a correction rather than a preference: the original
 * brief said `--detach master`, which is wrong the moment another worktree holds
 * that branch behind. `master` is a local ref that may be stale or checked out
 * elsewhere; `origin/master` is what the remote last told us.
 *
 * ## What it refuses, and why refusing is the feature
 *
 * - **A dirty tree.** Detaching does not discard changes, but it moves the files
 *   underneath them and the seat then has uncommitted work against a base it did
 *   not choose. Refused, naming the paths.
 * - **Commits this HEAD has that `origin/master` does not.** This is the whole
 *   risk. A detached HEAD leaves those commits unreachable by any branch name,
 *   and a seat running this after a push it *thought* succeeded loses the
 *   session's work to the reflog. Refused, naming the commits, and `--force`
 *   exists only so the refusal can be overridden deliberately.
 * - **A HEAD that is already detached at the right commit.** Reported as nothing
 *   to do rather than silently re-running.
 *
 * ## It fetches, and that is the difference from the greeting
 *
 * `tree-currency.ts` never touches the network because it runs on every session
 * start. This runs when a seat asks for it, and comparing against a stale
 * `origin/master` is exactly how a seat would detach onto a commit that is not
 * the current one. `--no-fetch` exists for an offline tree and says so in the
 * output, so a reader can tell which comparison they got.
 */

export interface DetachOptions {
  /** Report only; run nothing that changes the repository. */
  dryRun?: boolean;
  /** Skip `git fetch`. The comparison is then only as current as the last one. */
  noFetch?: boolean;
  /** Proceed even when this HEAD carries commits the upstream ref does not have. */
  force?: boolean;
  /** Defaults to `origin/master`. */
  upstreamRef?: string;
}

export interface DetachResult {
  ok: boolean;
  /** What happened, or what would happen under `dryRun`. */
  steps: string[];
  /** Why it refused. Null exactly when `ok`. */
  error: string | null;
  headBefore: string | null;
  headAfter: string | null;
  branchBefore: string | null;
  fetched: boolean;
  /** Commits on HEAD that the upstream ref does not have. */
  unmerged: string[];
}

export function detachToUpstream(repoRoot: string, options: DetachOptions = {}): DetachResult {
  const upstreamRef = options.upstreamRef ?? "origin/master";
  const steps: string[] = [];
  const result: DetachResult = {
    ok: false,
    steps,
    error: null,
    headBefore: null,
    headAfter: null,
    branchBefore: null,
    fetched: false,
    unmerged: [],
  };

  const refuse = (error: string): DetachResult => ({ ...result, ok: false, error, steps });

  if (git(repoRoot, ["rev-parse", "--is-inside-work-tree"]) !== "true") {
    return refuse(`${repoRoot} is not inside a git work tree`);
  }

  result.headBefore = git(repoRoot, ["rev-parse", "HEAD"]);
  // `symbolic-ref` fails on a detached HEAD, which is the answer rather than an
  // error: null here means "already detached".
  result.branchBefore = git(repoRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]);

  const dirty = git(repoRoot, ["status", "--porcelain"]);
  if (dirty === null) return refuse("could not read the working tree status");
  if (dirty.trim() !== "") {
    const paths = dirty.trim().split(/\r?\n/).slice(0, 10).map((l) => l.trim());
    return refuse(
      `the working tree is not clean, so detaching would leave uncommitted work against a base you did not choose:\n  ${paths.join("\n  ")}`
    );
  }

  if (options.noFetch) {
    steps.push(`skipped git fetch (--no-fetch) — ${upstreamRef} is only as current as the last fetch`);
  } else if (options.dryRun) {
    steps.push(`would run: git fetch origin`);
  } else {
    if (git(repoRoot, ["fetch", "origin"]) === null) {
      return refuse("git fetch origin failed — refusing to detach against a reference that may be stale");
    }
    result.fetched = true;
    steps.push("git fetch origin");
  }

  const target = git(repoRoot, ["rev-parse", "--verify", "--quiet", `${upstreamRef}^{commit}`]);
  if (target === null) return refuse(`${upstreamRef} does not exist in this checkout`);

  // The refusal that matters. A detached HEAD leaves these unreachable by any
  // branch name; a seat running this after a push it believed succeeded would
  // lose the session's work to the reflog.
  const ahead = git(repoRoot, ["rev-list", `${upstreamRef}..HEAD`, "--format=%h %s", "--no-commit-header"]);
  result.unmerged = ahead === null || ahead.trim() === "" ? [] : ahead.trim().split(/\r?\n/);
  if (result.unmerged.length > 0 && !options.force) {
    const shown = result.unmerged.slice(0, 10).join("\n  ");
    const more = result.unmerged.length > 10 ? `\n  ... +${result.unmerged.length - 10} more` : "";
    return refuse(
      `HEAD carries ${result.unmerged.length} commit(s) that ${upstreamRef} does not have:\n  ${shown}${more}\n` +
        `Detaching would leave them reachable only through the reflog. Push and merge them first, ` +
        `or pass --force if you have confirmed they are safe to leave behind.`
    );
  }
  if (result.unmerged.length > 0) {
    steps.push(`--force: proceeding with ${result.unmerged.length} commit(s) not on ${upstreamRef}`);
  }

  if (result.branchBefore === null && result.headBefore === target) {
    result.ok = true;
    result.headAfter = result.headBefore;
    steps.push(`already detached at ${short(target)} — nothing to do`);
    return result;
  }

  if (options.dryRun) {
    result.ok = true;
    result.headAfter = result.headBefore;
    steps.push(
      `would run: git checkout --detach ${upstreamRef}  (${result.branchBefore ? `from branch ${result.branchBefore}` : "already detached"} ${short(result.headBefore)} -> ${short(target)})`
    );
    return result;
  }

  if (git(repoRoot, ["checkout", "--detach", upstreamRef]) === null) {
    return refuse(`git checkout --detach ${upstreamRef} failed`);
  }
  steps.push(`git checkout --detach ${upstreamRef}`);

  // Read the end state back rather than trusting the command's exit. A success
  // message is not the change having landed — `gh pr merge` has printed
  // "could not determine current branch" while the merge succeeded, and the
  // inverse is what this guards.
  result.headAfter = git(repoRoot, ["rev-parse", "HEAD"]);
  const stillOnBranch = git(repoRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const verdict = verifyDetached(result.headAfter, target, stillOnBranch);
  if (!verdict.ok) return refuse(verdict.error);
  steps.push(`verified: detached at ${short(target)}, no branch`);
  result.ok = true;
  return result;
}

/**
 * Did the checkout actually land? Exported and unit-tested DIRECTLY because it
 * cannot be reached through `detachToUpstream` on a working git: it exists for
 * the case where `git checkout --detach` exits 0 and the tree is not detached at
 * the target.
 *
 * The same reasoning `validateResultState` carries in `state-writer.ts` — a last
 * gate before the caller is told it succeeded, unreachable through the normal
 * path, and therefore tested on its own rather than left unasserted.
 *
 * It was in fact unasserted when first written: disabling it left all ten
 * integration tests green, which is why it is a named function now.
 */
export function verifyDetached(
  headAfter: string | null,
  target: string,
  branch: string | null
): { ok: true } | { ok: false; error: string } {
  if (headAfter === target && branch === null) return { ok: true };
  return {
    ok: false,
    error:
      `checkout reported success but the tree is not detached at ${short(target)} ` +
      `(HEAD is ${short(headAfter)}${branch ? ` on branch ${branch}` : ""})`,
  };
}

function short(sha: string | null): string {
  return sha ? sha.slice(0, 7) : "unknown";
}

/** execFileSync with an args array: no shell, so `ref^{commit}` reaches git verbatim. */
function git(cwd: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}
