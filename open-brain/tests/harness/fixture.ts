/**
 * A real git repository in a temp directory, for the harness tests.
 *
 * **This file throws rather than skipping.** `G-029` in this project's record
 * is a regression test that ran `git init && git add && git commit` inside a
 * `try/catch` with `stdio` ignored and did a bare `return` on any failure — so a
 * machine without git reported the test green. That is the rule-11 family
 * (*an instrument that cannot distinguish "nothing there" from "I did not
 * look"*) living inside a regression test about exactly that defect class.
 *
 * So: no try/catch, no `stdio: "ignore"`, and {@link requireGit} asserts git is
 * present before any suite runs. If git is missing these tests fail loudly and
 * say why. A suite that cannot run has not passed.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

/** Run git in `cwd`, letting any failure throw with git's own stderr attached. */
export function rawGit(cwd: string, args: readonly string[]): string {
  try {
    return execFileSync("git", [...args], {
      cwd,
      encoding: "utf-8",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const e = err as { stderr?: Buffer | string; message?: string };
    const stderr = typeof e.stderr === "string" ? e.stderr : (e.stderr?.toString() ?? "");
    throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${stderr.trim() || e.message}`);
  }
}

/**
 * Assert git exists. Called at the top of every harness suite that needs it.
 *
 * The version string is thrown away; what matters is that a missing git
 * produces an error here, named, instead of a green run further down.
 */
export function requireGit(): void {
  const v = execFileSync("git", ["--version"], { encoding: "utf-8", shell: false }).trim();
  if (!/^git version /.test(v)) {
    throw new Error(`git is required for the harness tests and \`git --version\` printed: ${v}`);
  }
}

export interface RepoFixture {
  /** Absolute, realpath-resolved root. */
  root: string;
  /** Write a file (creating parents) without committing it. */
  write(repoPath: string, content: string): void;
  /** Stage everything and commit. Returns the new sha. */
  commitAll(message: string): string;
  sha(): string;
  /**
   * Asynchronous on purpose.
   *
   * `rmSync` over a `.git` directory is a long synchronous block on Windows —
   * hundreds of small files, with a virus scanner in the path — and a vitest
   * worker that never yields cannot answer the reporter's heartbeat. That
   * surfaced as `Timeout calling "onTaskUpdate"`, an UNHANDLED ERROR, which
   * makes vitest exit non-zero while reporting every test as passed. Awaiting
   * an async `rm` lets the event loop breathe between tests.
   */
  cleanup(): Promise<void>;
}

/**
 * Create a repository with one commit on branch `main`.
 *
 * `realpathSync` matters on Windows and macOS: the temp directory is reached
 * through a symlink or a short name, and git reports the resolved path. Without
 * it, a path comparison in a test fails for a reason that has nothing to do
 * with the thing under test.
 */
/** G-053: `git gc --auto` can call `update-server-info`, which creates `<common>/info/refs` and fails ConfigWatch mid-loop. */
export function disableAutoGc(repoRoot: string): void {
  rawGit(repoRoot, ["config", "gc.auto", "0"]);
}

export function makeRepo(prefix = "harness-repo-"): RepoFixture {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));

  rawGit(root, ["init", "--initial-branch=main"]);

  // Local config only — a test must never depend on, or touch, the machine's
  // git identity. Written as one file append rather than four `git config`
  // spawns: with ~50 repositories per run that was 200 extra synchronous child
  // processes, and every one of them blocks the vitest worker's event loop.
  // That is not a micro-optimisation — it was enough to make the worker miss
  // its reporter heartbeat and raise `Timeout calling "onTaskUpdate"`, which
  // vitest warns "might cause false positive tests".
  appendFileSync(
    join(root, ".git", "config"),
    [
      "[user]",
      "\temail = harness-test@example.invalid",
      "\tname = Harness Test",
      "[commit]",
      "\tgpgsign = false",
      "[core]",
      "\tautocrlf = false",
      "",
    ].join("\n"),
    "utf-8",
  );
  disableAutoGc(root);

  const write = (repoPath: string, content: string): void => {
    const abs = join(root, repoPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf-8");
  };

  const commitAll = (message: string): string => {
    rawGit(root, ["add", "-A"]);
    rawGit(root, ["commit", "--no-verify", "--no-gpg-sign", "-m", message]);
    return rawGit(root, ["rev-parse", "HEAD"]);
  };

  write("README.md", "# fixture\n");
  commitAll("initial commit");

  return {
    root,
    write,
    commitAll,
    sha: () => rawGit(root, ["rev-parse", "HEAD"]),
    cleanup: () => rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }),
  };
}

/**
 * Check specs that exit with a chosen code without running npm.
 *
 * The real `npm run build` cannot run inside a fixture repo, and faking the
 * RESULT would defeat the point of A7 — so these run a real child process whose
 * real exit code is the verdict. `node -e "process.exit(N)"` is the smallest
 * thing that is still genuinely a process exit.
 */
export const exitingCheck = (code: number, noise = "") => ({
  command: process.execPath,
  args: ["-e", `process.stdout.write(${JSON.stringify(noise)}); process.exit(${code});`],
  timeoutMs: 30_000,
});

/** Both deterministic checks, each exiting with the given code. */
export const exitingChecks = (buildCode: number, unitCode: number) => ({
  build: exitingCheck(buildCode),
  unit: exitingCheck(unitCode),
});
