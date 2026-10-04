import type { State, Task, Handoff, Seat, OpenQuestion } from "../../shared/state-schema.js";
import { TaskPriority, isOpenGap, lastSession, newestHandoffPerInstance, ownHandoff, questionText, questionResolvedBy, watchText } from "../../shared/state-schema.js";
import { findHandoffCommit } from "./handoff-provenance.js";

/**
 * Renders a validated `.agents/state.json` as the text ob_start returns in
 * place of the four prose files. Deliberately a view, not a dump: only
 * active tasks (open / in_progress / blocked) are listed, done is a count;
 * verified claims are one line each with an evidence count; the handoff is
 * the one prose-shaped thing kept whole. Loop 2 read side.
 */
export interface RenderStateOptions {
  /**
   * The seat doing the reading. Its own handoff is rendered in full; every other
   * seat's is named by the commit that last changed it.
   *
   * Absent means the reader could not be identified, and the render says so and
   * lists every seat's handoff by name rather than silently choosing one. A
   * greeting that shows the developer's handoff to the planner is C4 failing on
   * the row C2 exists for, and showing nothing is no better.
   */
  seat?: Seat | null;
  /** Needed to derive other seats' close-out commits. Omitted: they are named without one. */
  projectRoot?: string;
  /**
   * T-239, OPT-IN per repo (greeting.json `handoff_by_checkout`), default OFF. Set: only this checkout's handoff is "yours",
   * and a legacy entry (null checkout) is listed as `[legacy, unattributed]`. Absent: the role's newest, as before.
   */
  ownCheckout?: string;
}

export function renderState(state: State, version?: string, options: RenderStateOptions = {}): string[] {
  const lines: string[] = [];
  lines.push(`\n## State (state.json rev ${state.revision})`);
  // Loop 8 R3: the version comes from package.json, the only authority for it,
  // rather than from a copy in the record. Omitted entirely when not supplied,
  // because printing a stale or guessed version is worse than printing none.
  lines.push(version ? `Project: ${state.project.name} v${version}` : `Project: ${state.project.name}`);
  lines.push(
    state.objective
      ? `Objective: ${state.objective.text} (since session ${state.objective.since_session})`
      : `Objective: none`
  );

  const active = state.tasks.filter((t) => t.status !== "done");
  const done = state.tasks.length - active.length;
  lines.push(`\nTasks (${active.length} active; done: ${done}):`);
  for (const priority of TaskPriority.options) {
    const group = active.filter((t) => t.priority === priority);
    if (group.length === 0) continue;
    // D-100 follow-up: P0 and P1 titles are what NEXT is chosen from. P2 and P3 are one count line each, counted from
    // tasks[]; INBOX.md keeps the full list.
    if (COUNT_ONLY_PRIORITIES.has(priority)) {
      lines.push(`  [${priority}] ${group.length} active: INBOX.md`);
      continue;
    }
    lines.push(`  ${priority}:`);
    for (const t of group) lines.push(`    ${formatTask(t)}`);
  }
  if (active.length === 0) lines.push(`  (none)`);

  lines.push(`\nVerified (${state.verified.length}):`);
  // Verified is append-ordered like decisions, so the newest are the last
  // VERIFIED_SHOWN. A reopened claim is shown whatever its age: it is a warning,
  // not history. What is left out is counted and named, never dropped silently.
  const newest = new Set(state.verified.slice(-VERIFIED_SHOWN));
  const shown = state.verified.filter((v) => newest.has(v) || v.status === "reopened");
  for (const v of shown) {
    const flag = v.status === "reopened" ? " [REOPENED]" : "";
    lines.push(`  ${v.id} — ${clip(v.claim, VERIFIED_CLIP, `verified[${v.id}]`)} (${v.evidence.length} evidence)${flag}`);
  }
  const omitted = state.verified.length - shown.length;
  if (omitted > 0) {
    lines.push(`  … ${omitted} older verified claim(s) not shown (${state.verified.length} total); all of them: ${VERIFIED_FULL_TEXT}`);
  }
  if (state.verified.length === 0) lines.push(`  (none)`);

  // T-209: newest first. Append order is oldest first, which put G-001..G-007 in front of a
  // reader and hid the newest at 40 open gaps. Sorted on a copy; the record's order is untouched.
  const openGaps = state.gaps.filter(isOpenGap).sort(newestGapFirst);
  lines.push(`\nGaps (${openGaps.length}):`);
  // D-100: only the newest GAPS_SHOWN are printed. The count line is computed from the record's gaps, never
  // from what was printed, so the cap cannot make it understate (a mutant that counts lines goes red).
  for (const g of openGaps.slice(0, GAPS_SHOWN)) {
    lines.push(`  ${g.id} — ${clip(g.what, GAP_CLIP, `gaps[${g.id}]`)} (opened session ${g.opened_session})`);
  }
  if (openGaps.length > GAPS_SHOWN) {
    lines.push(`  … and ${openGaps.length - GAPS_SHOWN} older open gaps (${openGaps.length} open in all): state.json gaps[]`);
  }
  if (openGaps.length === 0) lines.push(`  (none)`);

  lines.push(`\nDecisions: ${state.decisions.length} recorded${state.decisions.length ? `; latest ${latestDecision(state)}` : ""}`);

  lines.push(...renderHandoffs(state, options));

  const last = lastSession(state);
  lines.push(
    last
      ? `\nLast session: #${last.n} ${last.date}${last.uuid ? ` (${last.uuid})` : ""} — ${state.sessions.length} writing session(s) in the record`
      : `\nLast session: none recorded`
  );
  return lines;
}

/**
 * One scannable line per task: status, id, title.
 *
 * `note` is deliberately NOT rendered. This is the second renderer to carry that
 * defect and the one that actually mattered: when `state.json` is valid this
 * render REPLACES the four prose files in `ob_start`'s return, so trimming
 * `INBOX.md` alone changed nothing a starting session sees. Measured on state
 * rev 14: 7,899 words returned, of which 5,795 were task notes — the notes
 * removed from the inbox view reappearing one layer down in the same call.
 *
 * The size block above still reports the four files' sizes, so it advertised a
 * shrink in content this function does not return. Counting one thing and
 * returning another is how that went unnoticed.
 *
 * A task's rationale is its `note` in `.agents/state.json` under `tasks[]` —
 * reference material for working a task, not for choosing one.
 */
function clipTitle(title: string): string {
  return title.length > TITLE_CLIP ? `${title.slice(0, TITLE_CLIP).trimEnd()}…` : title;
}

function formatTask(t: Task): string {
  const sup = t.supersedes ? ` (supersedes ${t.supersedes})` : "";
  return `[${t.status}] ${t.id} ${clipTitle(t.title)}${sup}`;
}

/** Open session descending, then id descending. Ids compare by their number (G-1000 after G-999), then as text. */
export function newestGapFirst(a: { id: string; opened_session: number }, b: { id: string; opened_session: number }): number {
  if (a.opened_session !== b.opened_session) return b.opened_session - a.opened_session;
  const na = Number(/(\d+)\s*$/.exec(a.id)?.[1]);
  const nb = Number(/(\d+)\s*$/.exec(b.id)?.[1]);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return nb - na;
  return b.id.localeCompare(a.id);
}

/**
 * T-183: gaps and verified claims are clipped to one line. At rev 130 the
 * greeting was 98,679 characters and no longer fit one tool result; gap text
 * alone was a third of it. Their full text stays in state.json.
 */
export const GAP_CLIP = 140;
/** D-100: the greeting prints this many open gaps, newest first (T-209 order), then a count line. */
export const GAPS_SHOWN = 10;
/** D-100: a task title longer than this is cut to this many characters and ends with an ellipsis. Ids and statuses are never clipped. */
export const TITLE_CLIP = 100;
/** Priorities rendered as a count line, not a list of titles. */
export const COUNT_ONLY_PRIORITIES: ReadonlySet<string> = new Set(["P2", "P3"]);
export const VERIFIED_CLIP = 100;
/** Verified is its count plus the newest this many (planner ruling (a), T-183). */
export const VERIFIED_SHOWN = 10;
/** The read-only door that prints every verified claim in full (`state show` alone prints only the count). */
export const VERIFIED_FULL_TEXT = "node open-brain/build/cli.js state show --json";

/**
 * Text within `limit` and on one line is returned whole, with no marker.
 * Anything else is cut at the first sentence end or at `limit`, whichever comes
 * first, and ALWAYS carries the marker with the full length and where the full
 * text lives: a clip is never silent.
 */
export function clip(text: string, limit: number, where: string): string {
  if (text.length <= limit && !/[\r\n]/.test(text)) return text;
  const head = text.slice(0, limit);
  const end = /[.!?](?=\s)|[\r\n]/.exec(head);
  const cut = (end ? head.slice(0, end.index + (end[0] === "\n" || end[0] === "\r" ? 0 : 1)) : head).trimEnd();
  return `${cut}… (${text.length} chars; full text: state.json ${where})`;
}

/** Decisions are append-ordered (Loop 3 R2): the latest is the last element, not a date sort. */
function latestDecision(state: State): string {
  const d = state.decisions[state.decisions.length - 1];
  return `${d.id} (${d.date}) ${d.title}`;
}

/**
 * The reader's own seat in full; every other seat named by the commit that last
 * changed its handoff.
 *
 * G-046 is why this is not one block: `handoff` was a single project-wide slot,
 * so when two seats closed out in sequence under the roll rule the second
 * overwrote the first. A fresh session then read the last writer's pick-up as
 * though it were its own, and one session was sent to a file that no longer held
 * what it was said to hold.
 *
 * The other seats are NAMED rather than printed. Their handoffs are long, they
 * are not this seat's instructions, and a SHA is enough to fetch one deliberately
 * — which is the difference between a record a seat can consult and a briefing
 * it has to wade through.
 */
function renderHandoffs(state: State, options: RenderStateOptions): string[] {
  const lines: string[] = [];
  if (state.handoffs.length === 0) {
    lines.push(`\nHandoffs: none recorded.`);
    return lines;
  }

  // Schema v3 (T-163) keeps one entry per writing session. The greeting shows
  // the newest per seat INSTANCE (seat + checkout) and no more, so it does not
  // grow with the array; older entries are counted, and live in the record.
  const visible = newestHandoffPerInstance(state.handoffs);
  const hidden = state.handoffs.length - visible.length;
  const seat = options.seat ?? null;
  const byCheckout = options.ownCheckout !== undefined;
  const own = ownHandoff(state.handoffs, seat, options.ownCheckout);

  if (seat === null) {
    lines.push(
      `\nHandoffs (${visible.length}) — READER'S SEAT UNRESOLVED, so none is rendered as "yours":`
    );
  } else if (own === null) {
    lines.push(
      byCheckout
        ? `\nHandoffs (${visible.length}) — no handoff recorded for this checkout (${seat}, ${options.ownCheckout}):`
        : `\nHandoffs (${visible.length}) — no handoff recorded for this seat (${seat}):`
    );
  }

  if (own) {
    lines.push(`\nYour handoff — ${own.seat}${instanceLabel(own, byCheckout)}, session ${own.session}:`);
    lines.push(...renderOneHandoff(own));
  }

  const others = visible.filter((h) => h !== own);
  if (others.length > 0) {
    lines.push(`\nOther handoffs (newest per seat and checkout; named, not rendered — read one by its commit):`);
    for (const h of others) {
      lines.push(`  ${h.seat}${instanceLabel(h, byCheckout)} (session ${h.session}): ${describeProvenance(h, options)}`);
      lines.push(`    ${firstLine(h.pick_up)}`);
    }
  }
  if (hidden > 0) lines.push(`  (${hidden} older handoff(s) superseded within their seat and checkout are in the record, not shown)`);
  return lines;
}

/**
 * ` [sia-builder]`, or ` [legacy]` for an entry migrated from v2, which recorded no checkout. With `handoff_by_checkout` on
 * (T-239) that entry is never anyone's own and reads ` [legacy, unattributed]`.
 */
function instanceLabel(h: Handoff, byCheckout: boolean): string {
  return ` [${h.checkout ?? (byCheckout ? "legacy, unattributed" : "legacy")}]`;
}

/** The unresolved question texts, and how many were resolved (T-233 B). */
export function splitQuestions(questions: readonly OpenQuestion[]): { open: string[]; resolved: number } {
  const open: string[] = [];
  let resolved = 0;
  for (const q of questions) {
    if (questionResolvedBy(q) !== null) resolved++;
    else open.push(questionText(q));
  }
  return { open, resolved };
}

function renderOneHandoff(h: Handoff): string[] {
  const lines: string[] = [];
  lines.push(`  pick up: ${h.pick_up}`);
  if (h.watch_out.length > 0) {
    lines.push(`  watch out:`);
    for (const w of h.watch_out) lines.push(`    - ${watchText(w)}`);
  }
  // T-233 B: a resolved question is omitted and COUNTED, so "none" and "N answered" stay different facts.
  const { open, resolved } = splitQuestions(h.open_questions);
  if (open.length > 0 || resolved > 0) {
    lines.push(`  open questions:`);
    for (const q of open) lines.push(`    - ${q}`);
    if (resolved > 0) lines.push(`    (${resolved} resolved, not shown)`);
  }
  if (h.loop_state) {
    const ls = h.loop_state;
    lines.push(`  loop state:`);
    // Each row says "none" in words rather than being omitted. An absent row and
    // an empty one are different facts (C3), and omitting the empty one would
    // make them render identically.
    lines.push(
      `    open PRs: ${ls.open_prs.length === 0 ? "none" : ls.open_prs.map((pr) => `${pr.ref} [${pr.qa_status}]${pr.note ? ` ${pr.note}` : ""}`).join("; ")}`
    );
    lines.push(`    SHA frozen for QA: ${ls.frozen_sha ?? "none"}`);
    lines.push(`    questions pending for Aaron: ${ls.questions_for_aaron.length === 0 ? "none" : ""}`);
    for (const q of ls.questions_for_aaron) lines.push(`      - ${q}`);
    lines.push(`    rulings made mid-loop: ${ls.rulings.length === 0 ? "none" : ""}`);
    for (const r of ls.rulings) lines.push(`      - ${r}`);
  }
  return lines;
}

/**
 * The close-out commit, derived. Never blank: when it cannot be determined the
 * reason is printed in its place, because a missing SHA and an unexamined one
 * are different and only one of them means "look further back".
 */
function describeProvenance(h: Handoff, options: RenderStateOptions): string {
  if (!options.projectRoot) return "commit not derived (no project root given)";
  // `h` is the entry being rendered — read from disk. Passing it lets the walk
  // refuse to name a commit when the working copy has moved on from HEAD, rather
  // than printing HEAD's SHA above words HEAD does not contain (F1).
  const p = findHandoffCommit(options.projectRoot, h.seat, undefined, h);
  if (p.commit) return `close-out ${p.commit.slice(0, 7)}${p.date ? ` ${p.date.slice(0, 10)}` : ""}`;
  return `no commit: ${p.note ?? "undetermined"}`;
}

function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  return line.length > 160 ? `${line.slice(0, 157)}...` : line || "(nothing recorded)";
}
