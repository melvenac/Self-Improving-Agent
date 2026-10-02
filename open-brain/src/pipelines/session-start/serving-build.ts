import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLastFetchAt } from "./tree-currency.js";

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

/** The `build/` directory of the code that is running: this module sits at build/pipelines/session-start/. */
export function runningBuildDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

const gitIn = (cwd: string, args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const why = (err: unknown): string => {
  const e = err as { stderr?: string; message?: string };
  return (e.stderr?.trim().split("\n")[0] || e.message || String(err)).split("\n")[0]!;
};

export function describeServingBuild(buildDir: string = runningBuildDir()): string {
  const notChecked = (cause: string): string => `Serving build: not checked (${cause})`;
  const infoPath = join(buildDir, "build-info.json");
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

  // The tree is the build's grandparent: <tree>/open-brain/build.
  const tree = join(buildDir, "..", "..");
  let head: string;
  try {
    head = gitIn(tree, ["rev-parse", "HEAD"]);
  } catch (err) {
    return notChecked(`${short} built ${builtAt}, but git cannot read ${tree}: ${why(err)}`);
  }

  let behind: number;
  try {
    behind = Number.parseInt(gitIn(tree, ["rev-list", "--count", `${commit}..${SERVING_UPSTREAM}`]), 10);
  } catch (err) {
    return notChecked(`${short} built ${builtAt}: its distance from ${SERVING_UPSTREAM} is unknown (${why(err)})`);
  }
  if (!Number.isFinite(behind)) return notChecked(`${short} built ${builtAt}: git returned an uncountable distance from ${SERVING_UPSTREAM}`);

  const fetchedAt = readLastFetchAt(tree) ?? "an unknown time";
  const treeNote = head === commit ? "" : `; the tree's HEAD is ${head.slice(0, 7)}, not the build's commit`;
  const subject = `${tree} at build ${short} (built ${builtAt})${treeNote}`;
  if (behind > 0) {
    return (
      `SERVING BUILD IS STALE: ${subject} is ${behind} commit${behind === 1 ? "" : "s"} behind ${SERVING_UPSTREAM} ` +
      `as of the tree's last fetch (${fetchedAt}). Every session on this machine runs this build, so merged fixes are not served.`
    );
  }
  return `Serving build: ${subject} is level with ${SERVING_UPSTREAM} as of the tree's last fetch (${fetchedAt}), not the network.`;
}
