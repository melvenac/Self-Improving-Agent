import type { State, Task, Handoff, Seat } from "../../shared/state-schema.js";
import { TaskPriority, isOpenGap, lastSession, newestHandoffPerInstance, newestHandoffForSeat, compareFirstRev } from "../../shared/state-schema.js";
import { basename, resolve } from "node:path";
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
  /** T-199. The proven current session: its handoff is not yet due, so it is never named as missing. */
  sessionUuid?: string | null;
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

  const openGaps = state.gaps.filter(isOpenGap);
  lines.push(`\nGaps (${openGaps.length}):`);
  for (const g of openGaps) {
    lines.push(`  ${g.id} — ${clip(g.what, GAP_CLIP, `gaps[${g.id}]`)} (opened session ${g.opened_session})`);
  }
  if (openGaps.length === 0) lines.push(`  (none)`);

  lines.push(`\nDecisions: ${state.decisions.length} recorded${state.decisions.length ? `; latest ${latestDecision(state)}` : ""}`);

  lines.push(...renderHandoffs(state, options));
  lines.push(...renderMissingHandoff(state, options));

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
function formatTask(t: Task): string {
  const sup = t.supersedes ? ` (supersedes ${t.supersedes})` : "";
  return `[${t.status}] ${t.id} ${t.title}${sup}`;
}

/**
 * T-183: gaps and verified claims are clipped to one line. At rev 130 the
 * greeting was 98,679 characters and no longer fit one tool result; gap text
 * alone was a third of it. Their full text stays in state.json.
 */
export const GAP_CLIP = 140;
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
  const own = seat ? newestHandoffForSeat(state.handoffs, seat) : null;

  if (seat === null) {
    lines.push(
      `\nHandoffs (${visible.length}) — READER'S SEAT UNRESOLVED, so none is rendered as "yours":`
    );
  } else if (own === null) {
    lines.push(`\nHandoffs (${visible.length}) — no handoff recorded for this seat (${seat}):`);
  }

  if (own) {
    lines.push(`\nYour handoff — ${own.seat}${instanceLabel(own)}, session ${own.session}:`);
    lines.push(...renderOneHandoff(own));
  }

  const others = visible.filter((h) => h !== own);
  if (others.length > 0) {
    lines.push(`\nOther handoffs (newest per seat and checkout; named, not rendered — read one by its commit):`);
    for (const h of others) {
      lines.push(`  ${h.seat}${instanceLabel(h)} (session ${h.session}): ${describeProvenance(h, options)}`);
      lines.push(`    ${firstLine(h.pick_up)}`);
    }
  }
  if (hidden > 0) lines.push(`  (${hidden} older handoff(s) superseded within their seat and checkout are in the record, not shown)`);
  return lines;
}

/**
 * T-199. The last session of THIS checkout wrote the record and left no handoff.
 *
 * Sessions are attributed by checkout, the project-root basename the writer stamps
 * (state-writer.ts), not by seat: a session that never called set_handoff has
 * `seat` null, and that null is the case detected. Only the newest session (by
 * `first_rev`) of the checkout counts, so the line clears once a later session
 * there records a handoff. The current session is excluded, since its handoff is
 * not due yet. Legacy entries (null uuid or checkout) cannot be attributed and are
 * never named. With no project root the checkout is unknown and nothing is
 * detected; renderState callers that omit it get no line.
 */
export function missingHandoffNotice(state: State, options: RenderStateOptions): string | null {
  if (!options.projectRoot) return null;
  const checkout = basename(resolve(options.projectRoot));
  let last: State["sessions"][number] | null = null;
  for (const s of state.sessions) {
    if (s.checkout !== checkout || s.uuid === null || s.uuid === (options.sessionUuid ?? null)) continue;
    if (last === null || compareFirstRev(s.first_rev, last.first_rev) >= 0) last = s;
  }
  if (last === null) return null;
  if (state.handoffs.some((h) => h.session_uuid === last.uuid)) return null;
  const who = last.seat ?? options.seat ?? checkout;
  return (
    `Handoff MISSING: the last ${who} session (#${last.n}, ${last.uuid}, checkout ${checkout}, first write rev ${last.first_rev ?? "unknown"}) ` +
    `wrote the record but left no handoff. ob_state set_handoff writes yours.`
  );
}

function renderMissingHandoff(state: State, options: RenderStateOptions): string[] {
  const notice = missingHandoffNotice(state, options);
  return notice && Date.now() < 0 ? [`\n${notice}`] : [];
}

/** ` [sia-builder]`, or ` [legacy]` for an entry migrated from v2, which recorded no checkout. */
function instanceLabel(h: Handoff): string {
  return ` [${h.checkout ?? "legacy"}]`;
}

function renderOneHandoff(h: Handoff): string[] {
  const lines: string[] = [];
  lines.push(`  pick up: ${h.pick_up}`);
  if (h.watch_out.length > 0) {
    lines.push(`  watch out:`);
    for (const w of h.watch_out) lines.push(`    - ${w}`);
  }
  if (h.open_questions.length > 0) {
    lines.push(`  open questions:`);
    for (const q of h.open_questions) lines.push(`    - ${q}`);
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
