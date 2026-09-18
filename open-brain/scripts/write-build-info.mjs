/**
 * Stamp the build with the commit it was built from.
 *
 * Runs as `postbuild`, after `tsc` and after `prebuild` has wiped `build/`.
 *
 * WHY THIS EXISTS. The MCP server and both hooks execute the MAIN tree's
 * `build/`, not the source you are editing. A build from an older commit serves
 * old code and reports success while doing it — the session-63 watch-out, "a
 * stale server reports success". Nothing could see it: file mtimes say when the
 * build ran, not what it ran on, and a rebuild after a checkout of older code
 * has a NEWER mtime and OLDER content.
 *
 * Recording the SHA turns that into a comparison rather than a heuristic:
 * `build-freshness` reads this file and compares it to HEAD.
 *
 * On failure this writes `commit: null` with the reason. It must never guess a
 * SHA — a build stamped with a commit it was not built from is worse than an
 * unstamped one, because the check would then confirm a lie.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const buildDir = join(here, "..", "build");

let commit = null;
let reason = null;
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: here,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    reason = `git rev-parse returned something that is not a SHA: ${JSON.stringify(commit).slice(0, 80)}`;
    commit = null;
  }
} catch (err) {
  reason = `git rev-parse failed: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`;
}

mkdirSync(buildDir, { recursive: true });
writeFileSync(
  join(buildDir, "build-info.json"),
  JSON.stringify({ commit, builtAt: new Date().toISOString(), reason }, null, 2) + "\n",
);

console.log(commit ? `build stamped ${commit.slice(0, 7)}` : `build NOT stamped — ${reason}`);
