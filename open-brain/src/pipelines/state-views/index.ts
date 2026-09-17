/**
 * Rendered views of `.agents/state.json` (Loop 3). Pure functions: state in,
 * text out; the writer does the file IO.
 *
 * INBOX.md, task.md and next-session.md are fully generated and say so in
 * their first line. SUMMARY.md is different: only the region between
 * `<!-- state:begin -->` and `<!-- state:end -->` is generated; everything
 * outside it is the project's own prose and is preserved byte for byte.
 */
import type { State, Task } from "../../shared/state-schema.js";
import { TaskPriority } from "../../shared/state-schema.js";

export interface ViewOptions {
  version: string;
  /**
   * The session the views are being rendered for — the same number the writer
   * passes to `applyRetention`. Required so the rendered Done list and the
   * record agree about which done tasks still exist (T-144).
   */
  session: number;
}

/**
 * How many sessions of done tasks are kept. "Last 3 sessions" means the current
 * one and the two before it, so a task closed at `session - 3` is the first to go.
 *
 * Defined here rather than in the writer because both need it and the writer
 * already imports this module; re-exported from `state-writer.ts` so existing
 * import sites keep working.
 */
export const DONE_RETENTION_SESSIONS = 3;

/**
 * The single retention predicate. The writer deletes these from the record; the
 * INBOX view hides them.
 *
 * Before T-144 the view rendered every done task under a heading that claimed
 * "last 3 sessions", while the writer dropped the older ones on the next write.
 * The two disagreed for as long as no write happened — and `/sync`'s render-only
 * path deliberately skips retention, so a repo could sit in that state
 * indefinitely. One function now decides, and both call it.
 */
export function isDroppedByRetention(t: Task, session: number): boolean {
  return t.status === "done" && t.closed_session !== null && t.closed_session <= session - DONE_RETENTION_SESSIONS;
}

export const SUMMARY_BEGIN = "<!-- state:begin -->";
export const SUMMARY_END = "<!-- state:end -->";

const PRIORITY_ORDER = TaskPriority.options;
const STATUS_BOX: Record<Task["status"], string> = { open: "[ ]", in_progress: "[~]", blocked: "[!]", done: "[x]" };

function header(state: State, o: ViewOptions): string {
  return `<!-- generated from .agents/state.json rev ${state.revision} by open-brain v${o.version} — do not edit; change state via ob_state -->`;
}

function byPriority(a: Task, b: Task): number {
  return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
}

/**
 * One scannable line per task: status, id, title.
 *
 * `note` is deliberately NOT rendered here. Titles are disciplined — across 44
 * active tasks they total 330 words, median 8, none over 25 — while notes total
 * 5,795 words, one of them 612 on its own. Appending them turned the backlog
 * view into 6,653 words in which 44 titles could not be scanned, which is the
 * opposite of what a "what is next" view is for. The note is reference material
 * for working a task, not for choosing one; it lives in `.agents/state.json`
 * under `tasks[].note` and the legend below says so.
 *
 * `task.md` and SUMMARY.md's region already rendered title-only top-5 lists.
 * This makes the inbox consistent with them rather than the outlier.
 */
function taskLine(t: Task): string {
  const sup = t.supersedes ? ` (supersedes ${t.supersedes})` : "";
  return `- ${STATUS_BOX[t.status]} **${t.id}** ${t.title}${sup}`;
}

export function renderInbox(state: State, o: ViewOptions): string {
  const lines: string[] = [
    header(state, o),
    "",
    "# Inbox",
    "",
    "Legend: `[ ]` open · `[~]` in_progress · `[!]` blocked",
    "",
    "Titles only. Full rationale for a task is its `note` in `.agents/state.json` under `tasks[]` — read it when you work the task, not when you pick one.",
    "",
  ];
  const active = state.tasks.filter((t) => t.status !== "done");
  for (const p of PRIORITY_ORDER) {
    const group = active.filter((t) => t.priority === p);
    if (group.length === 0) continue;
    lines.push(`## ${p}`, "");
    for (const t of group) lines.push(taskLine(t));
    lines.push("");
  }
  if (active.length === 0) lines.push("_No open tasks._", "");
  const done = state.tasks
    .filter((t) => t.status === "done" && !isDroppedByRetention(t, o.session))
    .sort((a, b) => (b.closed_session ?? 0) - (a.closed_session ?? 0));
  lines.push(`## Done (last ${DONE_RETENTION_SESSIONS} sessions)`, "");
  if (done.length === 0) lines.push("_None retained._");
  for (const t of done) lines.push(`- [x] **${t.id}** ${t.title} (session ${t.closed_session})${t.note ? ` — ${t.note}` : ""}`);
  lines.push("");
  return lines.join("\n");
}

export function renderTaskFile(state: State, o: ViewOptions): string {
  const lines: string[] = [header(state, o), "", "# Current Focus", "", "## Objective", ""];
  lines.push(state.objective ? `${state.objective.text} _(since session ${state.objective.since_session})_` : "_No objective set._");
  lines.push("", "## Top tasks", "");
  const top = state.tasks.filter((t) => t.status !== "done").sort(byPriority).slice(0, 5);
  if (top.length === 0) lines.push("_No open tasks._");
  for (const t of top) lines.push(`- ${STATUS_BOX[t.status]} **${t.id}** [${t.priority}] ${t.title}`);
  lines.push("");
  return lines.join("\n");
}

export function renderNextSession(state: State, o: ViewOptions): string {
  const h = state.handoff;
  const lines: string[] = [header(state, o), "", "# Next Session Handoff", "", `## Pick up here _(written session ${h.session})_`, "", h.pick_up || "_Nothing recorded._", ""];
  lines.push("## Watch out", "");
  if (h.watch_out.length === 0) lines.push("_Nothing flagged._");
  for (const w of h.watch_out) lines.push(`- ${w}`);
  lines.push("", "## Open questions", "");
  if (h.open_questions.length === 0) lines.push("_None._");
  for (const q of h.open_questions) lines.push(`- ${q}`);
  const ls = state.last_session;
  lines.push("", "## Last session", "", `Session ${ls.n} — ${ls.date}${ls.uuid ? ` — \`${ls.uuid}\`` : ""}`, "");
  return lines.join("\n");
}

/** The generated block for SUMMARY.md, markers included. */
export function renderSummaryRegion(state: State, o: ViewOptions): string {
  const lines: string[] = [SUMMARY_BEGIN, header(state, o)];
  lines.push(`> **Status:** v${o.version} — ${state.objective ? state.objective.text : "no objective"}`, "");

  lines.push("## What's working", "");
  if (state.verified.length === 0) lines.push("_Nothing verified yet._");
  for (const v of state.verified) lines.push(`- ${v.status === "reopened" ? "**[REOPENED]** " : ""}${v.claim} _(${v.id}, ${v.evidence.length} evidence)_`);
  lines.push("");

  lines.push("## What's broken", "");
  const blocked = state.tasks.filter((t) => t.status === "blocked");
  if (state.gaps.length === 0 && blocked.length === 0) lines.push("_Nothing open._");
  for (const g of state.gaps) lines.push(`- Gap ${g.id}: ${g.what}`);
  for (const t of blocked) lines.push(`- Blocked ${t.id}: ${t.title}${t.note ? ` — ${t.note}` : ""}`);
  lines.push("");

  lines.push("## What's next", "");
  const next = state.tasks.filter((t) => t.status === "open").sort(byPriority).slice(0, 5);
  if (next.length === 0) lines.push("_No open tasks._");
  for (const t of next) lines.push(`- [${t.priority}] ${t.id} ${t.title}`);
  lines.push("");

  lines.push("## Decisions", "");
  const last5 = state.decisions.slice(-5).reverse();
  if (last5.length === 0) lines.push("_None recorded._");
  for (const d of last5) lines.push(`- ${d.date} — ${d.title}${d.note ? ` — ${d.note}` : ""}`);
  lines.push(SUMMARY_END);
  return lines.join("\n");
}

/**
 * Replaces the marked region in an existing SUMMARY.md, or inserts one after
 * the `# ` title line when the markers are absent. Everything outside the
 * markers is returned byte for byte. Idempotent: applying the same region
 * twice yields the same text.
 */
export function applySummaryRegion(existing: string, region: string): string {
  const begin = existing.indexOf(SUMMARY_BEGIN);
  const end = existing.indexOf(SUMMARY_END);
  if (begin !== -1 && end !== -1 && end > begin) {
    return existing.slice(0, begin) + region + existing.slice(end + SUMMARY_END.length);
  }
  if (begin !== -1 || end !== -1) {
    throw new Error(`SUMMARY.md has an unpaired state marker (begin at ${begin}, end at ${end}) — fix the file by hand before writing`);
  }
  const nl = existing.includes("\r\n") ? "\r\n" : "\n";
  const lines = existing.split(nl);
  const titleIdx = lines.findIndex((l) => l.startsWith("# "));
  const block = region.split("\n").join(nl);
  if (titleIdx === -1) {
    return block + nl + nl + existing;
  }
  lines.splice(titleIdx + 1, 0, "", block);
  return lines.join(nl);
}
