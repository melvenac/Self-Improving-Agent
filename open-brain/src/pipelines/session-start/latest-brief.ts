import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * T-210: the newest brief under docs/loops, by GIT commit date.
 *
 * /start used to say "the largest loop number", which fits `loop-N-brief.md` and nothing named for a
 * task (`t201-brief.md`, `qa-233-*`); one session picked a 2026-09-20 report that way. A brief is a
 * file under docs/loops whose basename ends in `brief.md`, `rebrief.md` or an `-amendment-N` of either (T-233 C). The date is the file's latest
 * commit, never its mtime: a checkout, a touch or an uncommitted edit changes mtime and says nothing
 * about when the brief was written.
 *
 * Returns the line to print, or null when there is no brief (the caller omits the line). When git
 * itself cannot answer it returns a line saying so: "no brief" and "could not look" are different facts.
 */
export const BRIEF_DIR = "docs/loops";

export function describeLatestBrief(projectRoot: string): string | null {
  const run = (args: string[]): string =>
    execFileSync("git", args, { cwd: projectRoot, encoding: "utf-8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"] }).replace(/\r\n/g, "\n");
  // No docs/loops directory: nothing to name, and a project that is not a git repository is not told so.
  if (!existsSync(join(projectRoot, BRIEF_DIR))) return null;
  try {
    // Briefs present at HEAD. A brief deleted since is history, not the latest brief.
    const present = new Set(
      run(["ls-tree", "-r", "--name-only", "HEAD", "--", `${BRIEF_DIR}/`])
        .split("\n")
        .filter((p) => isBrief(p)),
    );
    if (present.size === 0) return null;
    // Newest-first by default, but ordering is not trusted: every appearance is compared by date.
    const log = run(["log", "--format=@%cI", "--name-only", "--no-renames", "HEAD", "--", `${BRIEF_DIR}/`]);
    const latest = new Map<string, string>();
    let date = "";
    for (const line of log.split("\n")) {
      if (line.startsWith("@")) { date = line.slice(1); continue; }
      if (!present.has(line)) continue;
      const seen = latest.get(line);
      if (!seen || Date.parse(date) > Date.parse(seen)) latest.set(line, date);
    }
    let best: [string, string] | null = null;
    for (const [path, d] of latest) {
      if (best === null || Date.parse(d) > Date.parse(best[1]) || (Date.parse(d) === Date.parse(best[1]) && path > best[0])) best = [path, d];
    }
    return best ? `Latest brief: ${best[0]} (${best[1].slice(0, 10)})` : null;
  } catch (err) {
    const cause = (err as { stderr?: string; message?: string }).stderr?.trim().split("\n")[0] || (err as Error).message.split("\n")[0];
    return `Latest brief: not determined (git: ${cause})`;
  }
}

/**
 * A brief is `loop-N-brief`, `*-grok-brief`, `tN-*-brief`, `*-rebrief-amendment-N` or `*-brief-amendment-N`. T-233 C: the
 * old test was a substring (`includes("brief")`), so a `-draft`, a research note or a handoff whose name happened to
 * contain the word could be named the latest brief.
 */
export const BRIEF_NAME = /(^|-)(re)?brief(-amendment-\d+)?\.md$/;

export function isBrief(path: string): boolean {
  const base = path.split("/").pop() ?? "";
  return path.startsWith(`${BRIEF_DIR}/`) && BRIEF_NAME.test(base);
}
