import type { State, Task } from "../../shared/state-schema.js";
import { TaskPriority } from "../../shared/state-schema.js";

/**
 * Renders a validated `.agents/state.json` as the text ob_start returns in
 * place of the four prose files. Deliberately a view, not a dump: only
 * active tasks (open / in_progress / blocked) are listed, done is a count;
 * verified claims are one line each with an evidence count; the handoff is
 * the one prose-shaped thing kept whole. Loop 2 read side.
 */
export function renderState(state: State): string[] {
  const lines: string[] = [];
  lines.push(`\n## State (state.json rev ${state.revision})`);
  lines.push(`Project: ${state.project.name} v${state.project.version}`);
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

  lines.push(`\nHandoff (session ${state.handoff.session}):`);
  lines.push(`  pick up: ${state.handoff.pick_up}`);
  if (state.handoff.watch_out.length > 0) {
    lines.push(`  watch out:`);
    for (const w of state.handoff.watch_out) lines.push(`    - ${w}`);
  }
  if (state.handoff.open_questions.length > 0) {
    lines.push(`  open questions:`);
    for (const q of state.handoff.open_questions) lines.push(`    - ${q}`);
  }

  lines.push(`\nLast session: #${state.last_session.n} ${state.last_session.date}${state.last_session.uuid ? ` (${state.last_session.uuid})` : ""}`);
  return lines;
}

function formatTask(t: Task): string {
  const sup = t.supersedes ? ` (supersedes ${t.supersedes})` : "";
  const note = t.note ? ` — ${t.note}` : "";
  return `[${t.status}] ${t.id} ${t.title}${sup}${note}`;
}

/** Decisions are append-ordered (Loop 3 R2): the latest is the last element, not a date sort. */
function latestDecision(state: State): string {
  const d = state.decisions[state.decisions.length - 1];
  return `${d.id} (${d.date}) ${d.title}`;
}
