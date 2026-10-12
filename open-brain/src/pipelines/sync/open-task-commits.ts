/**
 * T-256. An open or in_progress task that a CODE commit on HEAD already names. On 2026-10-11 the planner found
 * T-200, T-233 and T-247 merged on master and still open, and nearly briefed one again. A WARNING, never an issue:
 * a task can rightly stay open after a partial commit, and its note says so with `stays open after <sha7>`.
 *
 * Two git calls per run (rev-parse, then one log), whatever the number of tasks. Reads the record as JSON, not
 * through the schema, as task-assignees does: a record this build cannot parse is state-schema's finding.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult } from "./types.js";
import { execRunner, type CommandRunner } from "./checks-state.js";

export const OPEN_TASK_COMMIT_BOUND = 1500;
const TASK_ID_RE = /\bT-\d+\b/g;
const SUBJECT_CHARS = 72;
const SHOWN = 10;

/** A path is CODE unless it is under docs/ or .agents/, or is a Markdown file. */
export function isCodePath(path: string): boolean {
  return !path.startsWith("docs/") && !path.startsWith(".agents/") && !/\.md$/i.test(path);
}

export function checkOpenTaskCommits(projectRoot: string, run: CommandRunner = execRunner): CheckResult {
  const name = "open-task-commits";
  const skip = (why: string): CheckResult => ({ name, report: true, severity: "skip", message: `skipped — ${why}; open-task commits: unknown` });

  const statePath = join(projectRoot, ".agents", "state.json");
  if (!existsSync(statePath)) return skip("no .agents/state.json");
  let tasks: Array<{ id?: unknown; status?: unknown; note?: unknown }>;
  try {
    const data = JSON.parse(readFileSync(statePath, "utf8")) as { tasks?: unknown };
    if (!Array.isArray(data.tasks)) return skip(".agents/state.json has no tasks array");
    tasks = data.tasks as typeof tasks;
  } catch (err) {
    return skip(`.agents/state.json unreadable: ${(err as Error).message.split("\n")[0]}`);
  }
  const open = tasks.filter((t) => t !== null && typeof t === "object" && typeof t.id === "string" && (t.status === "open" || t.status === "in_progress"));
  if (open.length === 0) {
    return { name, report: true, severity: "pass", message: "0 open/in_progress tasks; nothing to match (git not run)" };
  }

  const rp = run("git", ["rev-parse", "--is-shallow-repository"], projectRoot);
  if (!rp.ok) return skip(/ENOENT/.test(rp.error) ? "git is not installed" : `not a git repository (${rp.error.split("\n")[0]})`);
  if (rp.stdout.trim() === "true") return skip("shallow clone, the history this check reads is not here (fetch full history to run it)");
  const log = run("git", ["-c", "core.quotepath=off", "log", "--no-merges", `--max-count=${OPEN_TASK_COMMIT_BOUND}`, "--name-only", "--format=%x1e%H%x1f%s", "HEAD"], projectRoot);
  if (!log.ok) return skip(`git log failed (${log.error.split("\n")[0]})`);

  // git log is newest first, so the first CODE commit that names a task is its newest.
  const newest = new Map<string, { sha: string; subject: string }>();
  const records = log.stdout.split("\x1e").slice(1);
  for (const rec of records) {
    const [head, ...rest] = rec.split("\n");
    const sep = head.indexOf("\x1f");
    const sha = head.slice(0, sep).trim();
    const subject = head.slice(sep + 1).trim();
    const files = rest.map((l) => l.trim()).filter((l) => l.length > 0);
    if (!files.some(isCodePath)) continue;
    for (const id of new Set(subject.match(TASK_ID_RE) ?? [])) {
      if (!newest.has(id)) newest.set(id, { sha, subject });
    }
  }

  const hits: string[] = [];
  for (const t of open) {
    const h = newest.get(t.id as string);
    if (!h) continue;
    const sha7 = h.sha.slice(0, 7);
    if (typeof t.note === "string" && t.note.includes(`stays open after ${sha7}`)) continue;
    const subj = h.subject.length > SUBJECT_CHARS ? `${h.subject.slice(0, SUBJECT_CHARS)}…` : h.subject;
    hits.push(`${String(t.id)} is ${String(t.status)} but ${sha7} '${subj}' on HEAD touches code; close it with evidence or note why it stays open`);
  }
  const scanned = `scanned ${records.length} non-merge commits (bound ${OPEN_TASK_COMMIT_BOUND}) against ${open.length} open/in_progress task(s)`;
  if (hits.length > 0) {
    const shown = hits.slice(0, SHOWN).join(" | ") + (hits.length > SHOWN ? ` | +${hits.length - SHOWN} more` : "");
    return { name, report: true, severity: "warn", message: `${hits.length} open task(s) named by a code commit: ${shown}. ${scanned}. Suppress one with "stays open after <sha7>" in its note` };
  }
  return { name, report: true, severity: "pass", message: `0 open tasks named by a code commit; ${scanned}. LIMIT: subjects only, merges skipped; a commit is code when it touches a path outside docs/, .agents/ and *.md` };
}
