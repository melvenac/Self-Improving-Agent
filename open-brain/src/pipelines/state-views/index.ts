/**
 * Rendered views of `.agents/state.json` (Loop 3). Pure functions: state in,
 * text out; the writer does the file IO.
 *
 * INBOX.md, task.md and next-session.md are fully generated and say so in
 * their first line. SUMMARY.md is different: only the region between
 * `<!-- state:begin -->` and `<!-- state:end -->` is generated; everything
 * outside it is the project's own prose and is preserved byte for byte.
 */
import type { State, Task, Handoff } from "../../shared/state-schema.js";
import { TaskPriority, isOpenGap, lastSession, newestHandoffPerInstance, compareFirstRev } from "../../shared/state-schema.js";

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
 * How many sessions of done tasks are kept: a done task leaves once this many
 * distinct sessions have first written after the write that closed it.
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
export function isDroppedByRetention(t: Task, sessionFirstRevs: readonly (number | null)[]): boolean {
  if (t.status !== "done") return false;
  // R179-1 extended to done tasks (record 128): aged by the DISTINCT sessions
  // that first wrote after the closing revision, never by `closed_session`
  // against the caller's number — one write numbered 1124 dropped every
  // uncited done task. A task closed before v3 (closed_rev null) orders before
  // every keyed session, as a legacy handoff does.
  const since = sessionFirstRevs.filter((r) => compareFirstRev(r, t.closed_rev) > 0).length;
  return since >= DONE_RETENTION_SESSIONS;
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
    "Titles only. Full rationale for a task is its `note` in `.agents/state.json` under `tasks[]` — read it before you rule on, work or retire a task, not when you merely pick one.",
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
    .filter((t) => t.status === "done" && !isDroppedByRetention(t, state.sessions.map((x) => x.first_rev)))
    .sort((a, b) => compareFirstRev(b.closed_rev, a.closed_rev));
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

/**
 * Every seat's handoff, each under its own heading.
 *
 * This file used to render ONE handoff because the record held one. Under the
 * roll rule two seats close out in sequence, so that single slot meant the
 * second erased the first (G-046) — and the view was where the erasure became
 * visible to a human, usually after it mattered. Rendering all of them is the
 * point: a reader of this file can see that three seats have handoffs and whose
 * is whose, without opening state.json.
 *
 * Seats are rendered in a FIXED order rather than in array order, so a write by
 * one seat cannot reorder the file and produce a diff that looks like a change
 * to another seat's entry.
 */
export function renderNextSession(state: State, o: ViewOptions): string {
  const lines: string[] = [header(state, o), "", "# Next Session Handoff", ""];

  if (state.handoffs.length === 0) {
    lines.push("_No handoffs recorded._", "");
  } else {
    // Schema v3 (T-163): one entry per writing session. The view renders the
    // newest per seat INSTANCE (seat + checkout), the same set the greeting
    // shows, so it does not grow with the array. Within a seat, instances sort
    // by checkout name so a write cannot reorder another instance's section.
    const order: Array<Handoff["seat"]> = ["planner", "developer", "qa"];
    const sorted = newestHandoffPerInstance(state.handoffs).sort(
      (a, b) => order.indexOf(a.seat) - order.indexOf(b.seat) || (a.checkout ?? "").localeCompare(b.checkout ?? ""),
    );
    const hidden = state.handoffs.length - sorted.length;
    for (const h of sorted) {
      lines.push(`## ${h.seat} [${h.checkout ?? "legacy"}] _(written session ${h.session})_`, "");
      lines.push("### Pick up here", "", h.pick_up || "_Nothing recorded._", "");
      lines.push("### Watch out", "");
      if (h.watch_out.length === 0) lines.push("_Nothing flagged._");
      for (const w of h.watch_out) lines.push(`- ${w}`);
      lines.push("", "### Open questions", "");
      if (h.open_questions.length === 0) lines.push("_None._");
      for (const q of h.open_questions) lines.push(`- ${q}`);
      lines.push("");
      if (h.loop_state) {
        const l = h.loop_state;
        lines.push("### Loop state", "");
        // "_None._" in words, never an omitted row: an empty list and an absent
        // one are different facts and must not render the same (C3).
        lines.push("**Open PRs:** " + (l.open_prs.length === 0 ? "_None._" : ""));
        for (const pr of l.open_prs) lines.push(`- ${pr.ref} — QA: ${pr.qa_status}${pr.note ? ` — ${pr.note}` : ""}`);
        lines.push("", `**SHA frozen for QA:** ${l.frozen_sha ? `\`${l.frozen_sha}\`` : "_None._"}`, "");
        lines.push("**Questions pending for Aaron:** " + (l.questions_for_aaron.length === 0 ? "_None._" : ""));
        for (const q of l.questions_for_aaron) lines.push(`- ${q}`);
        lines.push("", "**Rulings made mid-loop:** " + (l.rulings.length === 0 ? "_None._" : ""));
        for (const r of l.rulings) lines.push(`- ${r}`);
        lines.push("");
      }
    }
    if (hidden > 0) lines.push(`_${hidden} older handoff(s), superseded within their seat and checkout, are in state.json and not rendered here._`, "");
  }

  const ls = lastSession(state);
  lines.push(
    "## Last session",
    "",
    ls
      ? `Session ${ls.n} — ${ls.date}${ls.seat ? ` — ${ls.seat}` : ""}${ls.checkout ? ` [${ls.checkout}]` : ""}${ls.uuid ? ` — \`${ls.uuid}\`` : ""} (${state.sessions.length} writing session(s) in the record)`
      : "_None recorded._",
    "",
  );
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
  const openGaps = state.gaps.filter(isOpenGap);
  if (openGaps.length === 0 && blocked.length === 0) lines.push("_Nothing open._");
  for (const g of openGaps) lines.push(`- Gap ${g.id}: ${g.what}`);
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
  // T-186: a leading BOM is not part of the first line. readFileSync(..., "utf-8") keeps it, and with it
  // the title line reads "﻿# Title", which `startsWith("# ")` misses: the region used to land ABOVE
  // the title and the BOM ended up mid-file. Strip it for detection, put it back first on the way out.
  if (existing.startsWith("﻿")) return "﻿" + applySummaryRegion(existing.slice(1), region);
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
