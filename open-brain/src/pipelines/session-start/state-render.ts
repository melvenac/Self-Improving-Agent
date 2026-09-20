import type { State, Task, Handoff, Seat } from "../../shared/state-schema.js";
import { TaskPriority } from "../../shared/state-schema.js";
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
  for (const v of state.verified) {
    const flag = v.status === "reopened" ? " [REOPENED]" : "";
    lines.push(`  ${v.id} — ${v.claim} (${v.evidence.length} evidence)${flag}`);
  }
  if (state.verified.length === 0) lines.push(`  (none)`);

  lines.push(`\nGaps (${state.gaps.length}):`);
  for (const g of state.gaps) lines.push(`  ${g.id} — ${g.what} (opened session ${g.opened_session})`);
  if (state.gaps.length === 0) lines.push(`  (none)`);

  lines.push(`\nDecisions: ${state.decisions.length} recorded${state.decisions.length ? `; latest ${latestDecision(state)}` : ""}`);

  lines.push(...renderHandoffs(state, options));

  lines.push(`\nLast session: #${state.last_session.n} ${state.last_session.date}${state.last_session.uuid ? ` (${state.last_session.uuid})` : ""}`);
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

  const seat = options.seat ?? null;
  const own = seat ? state.handoffs.find((h) => h.seat === seat) ?? null : null;

  if (seat === null) {
    lines.push(
      `\nHandoffs (${state.handoffs.length}) — READER'S SEAT UNRESOLVED, so none is rendered as "yours":`
    );
  } else if (own === null) {
    lines.push(`\nHandoffs (${state.handoffs.length}) — no handoff recorded for this seat (${seat}):`);
  }

  if (own) {
    lines.push(`\nYour handoff — ${own.seat}, session ${own.session}:`);
    lines.push(...renderOneHandoff(own));
  }

  const others = state.handoffs.filter((h) => h !== own);
  if (others.length > 0) {
    lines.push(`\nOther seats' handoffs (named, not rendered — read one by its commit):`);
    for (const h of others) {
      lines.push(`  ${h.seat} (session ${h.session}): ${describeProvenance(h, options)}`);
      lines.push(`    ${firstLine(h.pick_up)}`);
    }
  }
  return lines;
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
