import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * T-233 A / T-172's guard: ob_start's FIRST line names the SERVING build, not the checkout the session is in.
 *
 * Every session's MCP server and hooks run from one tree's `open-brain/build/`. That tree fell 597 commits behind
 * origin/master unnoticed, so merged fixes (T-164, T-208, T-210, T-211) were never served, and the greeting that
 * said so was produced by the very build that was stale. The existing build-freshness check compares a build with
 * ITS OWN checkout's HEAD, which answers "does this build match this tree", never "is this build current"
 * (G-034). This line compares the build's own commit (`build-info.json`, stamped at build time) with
 * origin/master in that tree, as of the tree's last fetch.
 *
 * Read only: it fetches nothing and rebuilds nothing. It is never silent: a build it cannot read is
 * `Serving build: not checked (<why>)`, not an absent line.
 */
export const SERVING_UPSTREAM = "origin/master";

/**
 * T-234 A: the paths whose change alters what this machine SERVES, so only a commit touching one is a stale build. Counting
 * every commit called a build stale over commits that touched only `.agents/` records and `docs/` (clark, 2026-10-03).
 *  - `open-brain/`: the MCP server's source and build scripts. Its `tests/` are not served and are excluded.
 *  - `scripts/`: the session hooks and setup the main checkout runs.
 *  - `.claude/`: the slash commands (/start, /end, /sync) and hook settings.
 *  - `package.json`: the version `ob_start` reports.
 *  - `project-template/`: served through /bootstrap and setup.mjs's copy of the Cursor commands (QA 264).
 * Everything else (`.agents/`, `docs/`, the README) is records or documentation, not served code.
 */
export const SERVED_PATHS: readonly string[] = ["open-brain", ":(exclude)open-brain/tests", "scripts", ".claude", "package.json", "project-template"];

/** The `build/` directory of the code that is running: this module sits at build/pipelines/session-start/. */
export function runningBuildDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

/** The 40-hex `commit` stamped in `<buildDir>/build-info.json`, or null when the file is absent, unreadable, not JSON, or not stamped. Never throws. */
export function readStampedCommit(buildDir: string): string | null {
  try {
    const infoPath = join(buildDir, "build-info.json");
    if (!existsSync(infoPath)) return null;
    const info = JSON.parse(readFileSync(infoPath, "utf8")) as { commit?: unknown };
    if (typeof info.commit !== "string" || !/^[0-9a-f]{40}$/.test(info.commit)) return null;
    return info.commit;
  } catch {
    return null;
  }
}

/**
 * T-254: the build this PROCESS loaded, read ONCE when the module is evaluated. A stdio MCP server keeps its modules for
 * its whole life, so after a rebuild the disk stamp moves and this does not. Comparing the two is the only way the
 * first line can tell a reader that the code answering them is older than the code on disk.
 */
export const LOADED_COMMIT: string | null = readStampedCommit(runningBuildDir());

const gitIn = (cwd: string, args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const why = (err: unknown): string => {
  const e = err as { stderr?: string; message?: string };
  return (e.stderr?.trim().split("\n")[0] || e.message || String(err)).split("\n")[0]!;
};

export function describeServingBuild(buildDir?: string, loadedCommit?: string | null): string {
  const dir = buildDir ?? runningBuildDir();
  const loaded = loadedCommit !== undefined ? loadedCommit : buildDir === undefined ? LOADED_COMMIT : null;
  const notChecked = (cause: string): string => `Serving build: not checked (${cause})`;
  const infoPath = join(dir, "build-info.json");
  if (!existsSync(infoPath)) return notChecked(`${infoPath} does not exist: this build predates the stamp, or the server is not running from a build`);

  let info: { commit?: unknown; builtAt?: unknown; reason?: unknown };
  try {
    info = JSON.parse(readFileSync(infoPath, "utf8"));
  } catch (err) {
    return notChecked(`${infoPath} is unreadable: ${why(err)}`);
  }
  if (typeof info.commit !== "string" || !/^[0-9a-f]{40}$/.test(info.commit)) {
    return notChecked(`the build was not stamped with a commit${typeof info.reason === "string" ? ` (${info.reason})` : ""}`);
  }
  const commit = info.commit;
  const short = commit.slice(0, 7);
  const builtAt = typeof info.builtAt === "string" ? info.builtAt : "an unrecorded time";

  if (loaded !== null && loaded !== commit) {
    return `Build ${loaded.slice(0, 7)} · STALE PROCESS: disk has ${short} (built ${builtAt}) → /mcp reconnect open-brain`;
  }

  // The tree is the build's grandparent: <tree>/open-brain/build.
  const tree = join(dir, "..", "..");
  try {
    gitIn(tree, ["rev-parse", "HEAD"]);
  } catch (err) {
    return notChecked(`${short} built ${builtAt}, but git cannot read ${tree}: ${why(err)}`);
  }

  // Three distances, each a count git computed, none of them a guess: every commit the build lacks, the ones among them that
  // change what is SERVED, and the build's own commits origin/master lacks. A count that fails or is not a number is
  // `not checked`: an unknown distance is never zero.
  const count = (range: string, paths: readonly string[] = []): number => {
    const n = Number.parseInt(gitIn(tree, ["rev-list", "--count", range, ...(paths.length > 0 ? ["--", ...paths] : [])]), 10);
    if (!Number.isFinite(n)) throw new Error(`git returned an uncountable distance for ${range}`);
    return n;
  };
  let behind: number;
  let behindServed: number;
  let ahead: number;
  try {
    behind = count(`${commit}..${SERVING_UPSTREAM}`);
    behindServed = count(`${commit}..${SERVING_UPSTREAM}`, SERVED_PATHS);
    ahead = count(`${SERVING_UPSTREAM}..${commit}`);
  } catch (err) {
    return notChecked(`${short} built ${builtAt}: its distance from ${SERVING_UPSTREAM} is unknown (${why(err)})`);
  }

  const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;
  const label = `Build ${short}`;
  const aheadNote = ahead > 0 ? `ahead by ${ahead}` : null;
  if (behindServed > 0) {
    return `${label} · STALE: ${[`${plural(behindServed, "code commit")} behind`, aheadNote].filter((p) => p !== null).join(", ")} → ask Aaron to update`;
  }
  if (aheadNote !== null) return `${label} · ${aheadNote} (unmerged local commits)`;
  const recordsOnly = behind - behindServed;
  return recordsOnly > 0 ? `${label} · current (${plural(recordsOnly, "records-only commit")} behind)` : `${label} · current`;
}
