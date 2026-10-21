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
import { resolveCodeRef } from "../session-start/upstream-ref.js";

export const OPEN_TASK_COMMIT_BOUND = 1500;
const TASK_ID_RE = /\bT-\d+\b/g;
const SUBJECT_CHARS = 72;
const SHOWN = 10;

/** A path is CODE unless it is under docs/ or .agents/, or is a Markdown file. */
export function isCodePath(path: string): boolean {
  return !path.startsWith("docs/") && !path.startsWith(".agents/") && !/\.md$/i.test(path);
}

/** One open task a code commit names, with the newest such commit. `subject` is already clipped for display. */
export interface OpenTaskCommitHit {
  id: string;
  status: string;
  sha7: string;
  subject: string;
}

export type OpenTaskCommitScan =
  | { ok: true; open: number; hits: OpenTaskCommitHit[]; scanned: number; refs: string[] }
  | { ok: false; why: string };

type TaskLike = { id?: unknown; status?: unknown; note?: unknown };

/**
 * T-316 S2: the match itself, shared by the /sync check below and ob_start's MAYBE SHIPPED note. `tasks` is the record's
 * tasks[] as the caller read it: /sync reads the file, ob_start passes the record it renders (master's when the tree is
 * behind). No open task means no git call.
 *
 * T-316: HEAD alone misses a project whose record lives on a docs branch, or in a planner worktree detached at a
 * records commit: code reaches the default branch by PR and never comes back to HEAD (Makerspace, 10-20: 0 of 5 found).
 * So the log also reads the default branch's ref, resolved here when `codeRef` is not given, and only when it exists.
 */
export function scanOpenTaskCommits(projectRoot: string, tasks: readonly TaskLike[], run: CommandRunner = execRunner, codeRef?: string | null): OpenTaskCommitScan {
  const open = tasks.filter((t) => t !== null && typeof t === "object" && typeof t.id === "string" && (t.status === "open" || t.status === "in_progress"));
  if (open.length === 0) return { ok: true, open: 0, hits: [], scanned: 0, refs: [] };

  const rp = run("git", ["rev-parse", "--is-shallow-repository"], projectRoot);
  if (!rp.ok) return { ok: false, why: /ENOENT/.test(rp.error) ? "git is not installed" : `not a git repository (${rp.error.split("\n")[0]})` };
  if (rp.stdout.trim() === "true") return { ok: false, why: "shallow clone, the history this check reads is not here (fetch full history to run it)" };
  const extra = codeRef === undefined ? resolveCodeRef(projectRoot) : codeRef;
  const refs = extra !== null && extra !== "HEAD" ? ["HEAD", extra] : ["HEAD"];
  const log = run("git", ["-c", "core.quotepath=off", "log", "--no-merges", `--max-count=${OPEN_TASK_COMMIT_BOUND}`, "--name-only", "--format=%x1e%H%x1f%s", ...refs], projectRoot);
  if (!log.ok) return { ok: false, why: `git log failed (${log.error.split("\n")[0]})` };

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

  const hits: OpenTaskCommitHit[] = [];
  for (const t of open) {
    const h = newest.get(t.id as string);
    if (!h) continue;
    const sha7 = h.sha.slice(0, 7);
    if (typeof t.note === "string" && t.note.includes(`stays open after ${sha7}`)) continue;
    const subject = h.subject.length > SUBJECT_CHARS ? `${h.subject.slice(0, SUBJECT_CHARS)}…` : h.subject;
    hits.push({ id: t.id as string, status: String(t.status), sha7, subject });
  }
  return { ok: true, open: open.length, hits, scanned: records.length, refs };
}

/** With HEAD alone, every message is unchanged. */
export function checkOpenTaskCommits(projectRoot: string, run: CommandRunner = execRunner, codeRef?: string | null): CheckResult {
  const name = "open-task-commits";
  const skip = (why: string): CheckResult => ({ name, report: true, severity: "skip", message: `skipped — ${why}; open-task commits: unknown` });

  const statePath = join(projectRoot, ".agents", "state.json");
  if (!existsSync(statePath)) return skip("no .agents/state.json");
  let tasks: TaskLike[];
  try {
    const data = JSON.parse(readFileSync(statePath, "utf8")) as { tasks?: unknown };
    if (!Array.isArray(data.tasks)) return skip(".agents/state.json has no tasks array");
    tasks = data.tasks as TaskLike[];
  } catch (err) {
    return skip(`.agents/state.json unreadable: ${(err as Error).message.split("\n")[0]}`);
  }
  const scan = scanOpenTaskCommits(projectRoot, tasks, run, codeRef);
  if (!scan.ok) return skip(scan.why);
  if (scan.open === 0) {
    return { name, report: true, severity: "pass", message: "0 open/in_progress tasks; nothing to match (git not run)" };
  }

  const where = scan.refs.join(" or ");
  const hits = scan.hits.map((h) => `${h.id} is ${h.status} but ${h.sha7} '${h.subject}' on ${where} touches code; close it with evidence or note why it stays open`);
  const scanned = `scanned ${scan.scanned} non-merge commits (bound ${OPEN_TASK_COMMIT_BOUND}) against ${scan.open} open/in_progress task(s)${scan.refs.length > 1 ? ` across ${scan.refs.join(" and ")}` : ""}`;
  if (hits.length > 0) {
    const shown = hits.slice(0, SHOWN).join(" | ") + (hits.length > SHOWN ? ` | +${hits.length - SHOWN} more` : "");
    return { name, report: true, severity: "warn", message: `${hits.length} open task(s) named by a code commit: ${shown}. ${scanned}. Suppress one with "stays open after <sha7>" in its note` };
  }
  return { name, report: true, severity: "pass", message: `0 open tasks named by a code commit; ${scanned}. LIMIT: subjects only, merges skipped; a commit is code when it touches a path outside docs/, .agents/ and *.md` };
}

/** T-316 S2: the longest MAYBE SHIPPED note. It rides the budgeted pick-up line and is paid for out of the pick-up's cap. */
export const MAYBE_SHIPPED_MAX_CHARS = 64;
const MAYBE_SHIPPED_TAIL = ", see /sync";

/**
 * T-316 S2, OPT-IN per repo (greeting.json `maybe_shipped`), default OFF: the briefing's one note naming the open tasks a
 * code commit already names, so a stale backlog shows at /start and not only in /sync. Null when there are none: a clean
 * backlog prints nothing. Ids only; the commits are /sync's open-task-commits line. Whole ids drop before `+K more`, and a
 * scan that could not run says `not checked` with its reason, never nothing. Never longer than MAYBE_SHIPPED_MAX_CHARS.
 */
export function describeMaybeShipped(projectRoot: string, tasks: readonly TaskLike[], run: CommandRunner = execRunner, codeRef?: string | null): string | null {
  const scan = scanOpenTaskCommits(projectRoot, tasks, run, codeRef);
  if (!scan.ok) {
    const line = `MAYBE SHIPPED: not checked (${scan.why})`;
    return line.length <= MAYBE_SHIPPED_MAX_CHARS ? line : `${line.slice(0, MAYBE_SHIPPED_MAX_CHARS - 1)}…`;
  }
  if (scan.hits.length === 0) return null;
  const ids = scan.hits.map((h) => h.id);
  let line = `MAYBE SHIPPED (${ids.length}):`;
  let shown = 0;
  for (const id of ids) {
    const hiddenIfAdded = ids.length - shown - 1;
    const reserve = (hiddenIfAdded > 0 ? ` +${hiddenIfAdded} more`.length : 0) + MAYBE_SHIPPED_TAIL.length;
    if (line.length + 1 + id.length + reserve > MAYBE_SHIPPED_MAX_CHARS) break;
    line += ` ${id}`;
    shown++;
  }
  if (shown < ids.length) line += ` +${ids.length - shown} more`;
  return `${line}${MAYBE_SHIPPED_TAIL}`;
}
