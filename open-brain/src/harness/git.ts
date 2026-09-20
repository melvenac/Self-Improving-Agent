/**
 * Git, run the only way this repo's record says it can be trusted.
 *
 * **`execFileSync` with an args array and no shell.** Every git failure in this
 * project's error record went through a shell: `cmd.exe` ate the `^` in
 * `<sha>^{commit}` and handed git `{commit}`; a heredoc ate backslashes. With
 * `shell: false` the arguments reach git verbatim, and `^`, `{`, `}` and spaces
 * stop being characters anybody has to think about.
 *
 * ## The outward-facing deny list
 *
 * `run` **refuses a subcommand that leaves this machine or moves a shared
 * ref**. Not because the runtime is expected to try, but because *each
 * outward-facing act needs authority for that act*, and a runtime cannot be
 * handed authority in advance for a push it has not described. `D-019` draws
 * the line at the same place: autonomous inside a branch, Aaron at master.
 *
 * The deny list is checked on the **subcommand actually passed to git**, not on
 * a string somebody assembled, so it cannot be slipped past by quoting.
 */

import { execFileSync, spawnSync } from "node:child_process";

/** Subcommands the harness must never run. Refused at the call, not reviewed later. */
export const DENIED_SUBCOMMANDS: readonly string[] = [
  "push",
  "fetch",
  "pull",
  "clone",
  "remote",
  "submodule",
  "request-pull",
  "send-email",
  "svn",
  "daemon",
  "p4",
];

export class GitRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitRefused";
  }
}

export class GitFailed extends Error {
  readonly exitCode: number | null;
  readonly stderr: string;
  constructor(message: string, exitCode: number | null, stderr: string) {
    super(message);
    this.name = "GitFailed";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

function assertAllowed(args: readonly string[]): void {
  // The subcommand is the first argument that is not a leading global option.
  let i = 0;
  while (i < args.length && args[i]!.startsWith("-")) {
    // `-c key=value` and `-C <dir>` take a value; skip it too.
    if (args[i] === "-c" || args[i] === "-C") i += 1;
    i += 1;
  }
  const sub = args[i];
  if (sub === undefined) {
    throw new GitRefused("no git subcommand given — refusing rather than guessing");
  }
  if (DENIED_SUBCOMMANDS.includes(sub)) {
    throw new GitRefused(
      `git ${sub} is refused by the harness: it reaches the network or moves a shared ref, ` +
        `and each outward-facing act needs authority for that act. The runtime stops at a ` +
        `candidate commit (D-019).`,
    );
  }
}

/**
 * Run git in `cwd` and return trimmed stdout. Throws {@link GitFailed} on a
 * non-zero exit, with git's own stderr attached — a failure never returns a
 * value that could be mistaken for an answer.
 */
export function git(cwd: string, args: readonly string[]): string {
  assertAllowed(args);
  try {
    return execFileSync("git", [...args], {
      cwd,
      encoding: "utf-8",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const e = err as { status?: number | null; stderr?: Buffer | string; message?: string };
    const stderr = typeof e.stderr === "string" ? e.stderr : (e.stderr?.toString() ?? "");
    throw new GitFailed(
      `git ${args.join(" ")} failed in ${cwd}: ${stderr.trim() || e.message || "no stderr"}`,
      e.status ?? null,
      stderr.trim(),
    );
  }
}

/**
 * Run git and report the outcome instead of throwing.
 *
 * Used where a non-zero exit is an ANSWER rather than a fault — `rev-parse
 * --verify` on a ref that may not exist. Note `ok` comes from the status, never
 * from whether stdout looked plausible.
 */
export function gitTry(
  cwd: string,
  args: readonly string[],
): { ok: boolean; stdout: string; stderr: string; status: number | null } {
  assertAllowed(args);
  const r = spawnSync("git", [...args], { cwd, encoding: "utf-8", shell: false });
  if (r.error) {
    return { ok: false, stdout: "", stderr: String(r.error.message), status: null };
  }
  return {
    ok: r.status === 0,
    stdout: (r.stdout ?? "").trim(),
    stderr: (r.stderr ?? "").trim(),
    status: r.status,
  };
}

/** The full 40-character sha at HEAD. */
export const headSha = (cwd: string): string => git(cwd, ["rev-parse", "HEAD"]);

/** The current branch name, or `HEAD` when detached. */
export const currentBranch = (cwd: string): string =>
  git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);

/**
 * Every path git considers changed, tracked or not, as repo-relative POSIX
 * paths.
 *
 * `--porcelain=v1 -z --untracked-files=all` is deliberate on all three counts:
 * v1 is a stable format, `-z` means a path with a space or a quote cannot be
 * mis-split, and `all` lists files inside a new directory rather than the
 * directory alone. A directory-only listing would let a role write
 * `secret/thing.ts` and be reported as touching `secret/`, which a prefix
 * allowlist might well permit.
 */
export function changedPaths(cwd: string): string[] {
  const raw = execFileSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { cwd, encoding: "utf-8", shell: false, stdio: ["ignore", "pipe", "pipe"] },
  );
  const out: string[] = [];
  const records = raw.split("\0");
  for (let i = 0; i < records.length; i += 1) {
    const rec = records[i];
    if (!rec) continue;
    const status = rec.slice(0, 2);
    const path = rec.slice(3);
    if (path) out.push(path);
    // A rename record is `R  <new>\0<old>\0` — the old path is its own record
    // and must be counted as touched, not skipped.
    if (status.startsWith("R") || status.startsWith("C")) {
      const old = records[i + 1];
      if (old) {
        out.push(old);
        i += 1;
      }
    }
  }
  return out;
}

/** True when git reports nothing changed, tracked or untracked. */
export const isClean = (cwd: string): boolean => changedPaths(cwd).length === 0;

/**
 * Paths changed by the commits between `base` and `head`.
 *
 * **This is the half `git status` cannot see, and not seeing it was the defect
 * that failed QA.** A role that writes a file and then commits it leaves a
 * CLEAN working tree, so an enforcement mechanism built on `git status` alone
 * reports "nothing changed" while the file sits in history. Slice two makes
 * this the normal case, not an exotic one: committing is how a real session
 * leaves its work.
 *
 * `--no-renames` is deliberate. Rename detection would report only the new
 * path for a move, and a role that moved a protected file OUT of the allowlist
 * would be judged on its destination alone. Without it both sides appear as a
 * delete and an add, which is what the allowlist must see.
 */
export function committedPaths(cwd: string, base: string, head: string): string[] {
  if (base === head) return [];
  const raw = execFileSync(
    "git",
    ["diff", "--name-only", "--no-renames", "-z", base, head],
    { cwd, encoding: "utf-8", shell: false, stdio: ["ignore", "pipe", "pipe"] },
  );
  return raw.split("\0").filter((p) => p !== "");
}

/** Whether `maybeAncestor` is an ancestor of `descendant` (a commit is its own ancestor). */
export function isAncestor(cwd: string, maybeAncestor: string, descendant: string): boolean {
  if (maybeAncestor === descendant) return true;
  return gitTry(cwd, ["merge-base", "--is-ancestor", maybeAncestor, descendant]).ok;
}

/** The first parent of a commit, or null when it has none. */
export function firstParent(cwd: string, sha: string): string | null {
  const r = gitTry(cwd, ["rev-parse", "--verify", "--quiet", `${sha}^1`]);
  return r.ok && /^[0-9a-f]{40}$/.test(r.stdout) ? r.stdout : null;
}

/**
 * Discard everything back to `base`: commits, tracked edits and untracked files.
 *
 * **Refuses unless `base` is an ancestor of HEAD.** `reset --hard` destroys
 * work, and the one case where it must not run is the one where the runtime has
 * lost track of where it is. If the tree is somewhere unexpected this throws and
 * says so, leaving the mess for a human rather than deleting an unknown history
 * to tidy up.
 */
export function resetHardTo(cwd: string, base: string): void {
  const head = headSha(cwd);
  if (!isAncestor(cwd, base, head)) {
    throw new GitRefused(
      `refusing to reset ${cwd} to ${base}: it is not an ancestor of HEAD (${head}). ` +
        `Something moved the tree somewhere this runtime did not expect, and discarding ` +
        `unknown history to recover from that would be worse than stopping. Recover by hand.`,
    );
  }
  git(cwd, ["reset", "--hard", base]);
  git(cwd, ["clean", "-fd"]);
}

/** Whether `cwd` is inside a git work tree at all. */
export function isRepo(cwd: string): boolean {
  const r = gitTry(cwd, ["rev-parse", "--is-inside-work-tree"]);
  return r.ok && r.stdout === "true";
}

/** Whether a ref resolves. Used to assert a tag exists — and that it does not, first. */
export function refExists(cwd: string, ref: string): boolean {
  return gitTry(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).ok;
}

/** The commit a ref points at, or null when it does not resolve. */
export function resolveRef(cwd: string, ref: string): string | null {
  const r = gitTry(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  return r.ok && /^[0-9a-f]{40}$/.test(r.stdout) ? r.stdout : null;
}

/**
 * Stage the given paths and commit. Returns the new sha.
 *
 * Paths are passed after `--` so a path that looks like a flag cannot become
 * one, and each is staged explicitly — never `git add -A`, which would sweep in
 * whatever else happened to be in the tree and quietly widen the commit past
 * the allowlist the stage was held to.
 */
export function commitPaths(cwd: string, paths: readonly string[], message: string): string {
  if (paths.length === 0) {
    throw new GitRefused("commitPaths called with no paths — refusing to commit an empty change set");
  }
  git(cwd, ["add", "--", ...paths]);
  git(cwd, ["commit", "--no-verify", "--no-gpg-sign", "-m", message]);
  return headSha(cwd);
}

/**
 * Create an annotated tag at `sha`.
 *
 * Refuses to move an existing tag. A rollback marker that can be silently
 * repointed is not a marker, and `--force` here would make `loop-001-developer`
 * mean "wherever the last run left it".
 */
export function tagAt(cwd: string, tag: string, sha: string, message: string): void {
  if (refExists(cwd, tag)) {
    throw new GitRefused(
      `tag ${tag} already exists at ${resolveRef(cwd, tag)} — refusing to move it; ` +
        `a rollback marker that moves is not a marker`,
    );
  }
  git(cwd, ["tag", "-a", tag, sha, "-m", message]);
}

/**
 * Discard working-tree changes to the given paths: tracked files go back to
 * HEAD, untracked files are removed.
 *
 * Used to undo an allowlist violation. Both halves are needed — `checkout --`
 * does nothing to a file git has never seen, so an untracked write outside the
 * allowlist would survive a "revert" that reported success.
 */
export function revertPaths(cwd: string, paths: readonly string[]): void {
  if (paths.length === 0) return;
  const tracked: string[] = [];
  const untracked: string[] = [];
  for (const p of paths) {
    (gitTry(cwd, ["ls-files", "--error-unmatch", "--", p]).ok ? tracked : untracked).push(p);
  }
  if (tracked.length > 0) git(cwd, ["checkout", "HEAD", "--", ...tracked]);
  if (untracked.length > 0) git(cwd, ["clean", "-fdx", "--", ...untracked]);
}
