import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { greetingString } from "./greeting-flags.js";

/**
 * T-210: the newest brief under docs/loops, by GIT commit date.
 *
 * /start used to say "the largest loop number", which fits `loop-N-brief.md` and nothing named for a
 * task (`t201-brief.md`, `qa-233-*`); one session picked a 2026-09-20 report that way. A brief is a
 * file under docs/loops whose basename ends in `brief.md`, `rebrief.md`, `-task.md` (T-296) or an `-amendment-N` of any of them (T-233 C). The date is the file's latest
 * commit, never its mtime: a checkout, a touch or an uncommitted edit changes mtime and says nothing
 * about when the brief was written.
 *
 * Returns the line to print, or null when there is no brief (the caller omits the line). When git
 * itself cannot answer it returns a line saying so: "no brief" and "could not look" are different facts.
 *
 * T-277: a project may keep its briefs directly under docs/ instead, as `loop-<x>-brief.md`, `-rebrief` or an
 * `-amendment-N` of either (agent-dashboard does, and its /start had no line). Those count too, by the same
 * commit-date rule across both places. Only the `loop-` prefix counts there, so `docs/design-brief.md` is not one.
 */
export const BRIEF_DIR = "docs/loops";
/** T-277: briefs kept directly under docs/ (not in a subdirectory), named `loop-<x>-brief.md`, `-rebrief` or an `-amendment-N`. */
export const ROOT_BRIEF_DIR = "docs";
export const ROOT_BRIEF_NAME = /^loop-.+-(re)?brief(-amendment-\d+)?\.md$/;

function rootBriefOnDisk(projectRoot: string): boolean {
  const docs = join(projectRoot, ROOT_BRIEF_DIR);
  if (!existsSync(docs)) return false;
  try {
    return readdirSync(docs).some((name) => ROOT_BRIEF_NAME.test(name));
  } catch {
    return false;
  }
}

/**
 * T-298: the repo's own brief directory (greeting.json `brief_dir`). Valid is a non-empty repo-relative directory: not
 * absolute, no `\`, no `..` segment, not `.`. Null when the key is absent.
 */
export function briefDirSetting(projectRoot: string): { dir: string } | { invalid: string } | null {
  const raw = greetingString(projectRoot, "brief_dir");
  if (raw === null) return null;
  const dir = raw.trim().replace(/\/+$/, "");
  const bad = dir === "" || dir === "." || isAbsolute(dir) || dir.startsWith("/") || dir.includes("\\") || dir.split("/").includes("..");
  return bad ? { invalid: raw } : { dir };
}

function latestBriefSelection(projectRoot: string): { path: string; date: string } | null {
  const run = (args: string[]): string =>
    execFileSync("git", args, { cwd: projectRoot, encoding: "utf-8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"] }).replace(/\r\n/g, "\n");
  const setting = briefDirSetting(projectRoot);
  if (setting !== null && "invalid" in setting) return null;
  if (setting !== null) {
    // T-298: every tracked *.md under the named directory is a brief; the selection loop and tie-break are shared.
    if (!existsSync(join(projectRoot, setting.dir))) return null;
    const inDir = new Set(
      run(["ls-tree", "-r", "--name-only", "HEAD", "--", `${setting.dir}/`])
        .split("\n")
        .filter((p) => p.endsWith(".md")),
    );
    if (inDir.size === 0) return null;
    return newestOf(inDir, run(["log", "--format=@%cI", "--name-only", "--no-renames", "HEAD", "--", `${setting.dir}/`]));
  }
  if (!existsSync(join(projectRoot, BRIEF_DIR)) && !rootBriefOnDisk(projectRoot)) return null;
  const present = new Set(
    run(["ls-tree", "-r", "--name-only", "HEAD", "--", `${ROOT_BRIEF_DIR}/`])
      .split("\n")
      .filter((p) => isBrief(p)),
  );
  if (present.size === 0) return null;
  const rootBriefs = [...present].filter((p) => !p.startsWith(`${BRIEF_DIR}/`));
  // T-287: one glob pathspec for the docs root, not one argument per brief: argv stays constant however many briefs
  // there are (Windows refuses a spawn near 32 KB of arguments). `present` already filters the names, and a glob `*`
  // never crosses a `/`, so only docs-root files match.
  const rootSpec = rootBriefs.length > 0 ? [`:(glob)${ROOT_BRIEF_DIR}/loop-*.md`] : [];
  return newestOf(present, run(["log", "--format=@%cI", "--name-only", "--no-renames", "HEAD", "--", `${BRIEF_DIR}/`, ...rootSpec]));
}

/** The newest of `present` by commit date in `log` (`@date` lines followed by names); ties go to the later path. */
function newestOf(present: Set<string>, log: string): { path: string; date: string } | null {
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
  return best ? { path: best[0], date: best[1] } : null;
}

export function latestBriefPath(projectRoot: string): { path: string; date: string } | null {
  try {
    return latestBriefSelection(projectRoot);
  } catch {
    return null;
  }
}

export function describeLatestBrief(projectRoot: string): string | null {
  const setting = briefDirSetting(projectRoot);
  if (setting !== null && "invalid" in setting) {
    return `Latest brief: not determined (greeting.json brief_dir is not a repo-relative directory: ${JSON.stringify(setting.invalid)})`;
  }
  try {
    const best = latestBriefSelection(projectRoot);
    return best ? `Latest brief: ${best.path} (${best.date.slice(0, 10)})` : null;
  } catch (err) {
    const cause = (err as { stderr?: string; message?: string }).stderr?.trim().split("\n")[0] || (err as Error).message.split("\n")[0];
    return `Latest brief: not determined (git: ${cause})`;
  }
}

/** T-298: the line ob_start prints when describeLatestBrief found no brief: where it looked, so "none" and "didn't look" differ. */
export function describeNoBrief(projectRoot: string): string {
  const s = briefDirSetting(projectRoot);
  return s !== null && "dir" in s
    ? `Latest brief: none (looked in ${s.dir}/, from greeting.json brief_dir)`
    : `Latest brief: none (looked in ${BRIEF_DIR}/ and ${ROOT_BRIEF_DIR}/loop-*-brief.md)`;
}

/**
 * A brief is `loop-N-brief`, `*-grok-brief`, `tN-*-brief`, `*-rebrief-amendment-N` or `*-brief-amendment-N`. T-233 C: the
 * old test was a substring (`includes("brief")`), so a `-draft`, a research note or a handoff whose name happened to
 * contain the word could be named the latest brief.
 * T-296: `*-task` counts too (A2A's `l69-build-task.md`, SIA's `t262-fix-1-task.md`), so a task-named brief is not passed over for an older `-brief`.
 */
export const BRIEF_NAME = /(^|-)((re)?brief|task)(-amendment-\d+)?\.md$/;

export function isBrief(path: string): boolean {
  const base = path.split("/").pop() ?? "";
  if (path.startsWith(`${BRIEF_DIR}/`)) return BRIEF_NAME.test(base);
  return path === `${ROOT_BRIEF_DIR}/${base}` && ROOT_BRIEF_NAME.test(base);
}
