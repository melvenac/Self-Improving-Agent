import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { seatOrder } from "../session-start/focus.js";
import { SEAT_MAP_REL } from "../session-start/seat-map.js";
import { greetingFlag } from "../session-start/greeting-flags.js";
import type { CheckResult } from "./types.js";

/**
 * T-236 (c). `tasks[].assignee` is a key of the seat map's `seats`, and the writer does not read the map, so this
 * check does: an assignee that is not a seat is an ISSUE naming the task and the value. With no map or no record
 * there is nothing to compare, which is a SKIP with the reason, never a pass. It also reports `briefing_focus` on
 * without `briefing_budget`, because FOCUS renders only inside the budgeted layout and the flag would do nothing.
 *
 * Reads the record as JSON, not through the schema: a record this build cannot parse is the state-schema check's
 * finding, and this one still answers for the assignees it can see.
 */
export function checkTaskAssignees(projectRoot: string): CheckResult {
  const name = "task-assignees";
  const skip = (why: string): CheckResult => ({ name, severity: "skip", message: `skipped — ${why}`, report: true });

  if (greetingFlag(projectRoot, "briefing_focus") && !greetingFlag(projectRoot, "briefing_budget")) {
    return { name, severity: "warn", message: "briefing_focus has no effect without briefing_budget (FOCUS and SEATS render only in the budgeted briefing)", report: true };
  }
  const seats = seatOrder(projectRoot);
  if (seats === null) return skip(`no seat map (${SEAT_MAP_REL}) to check assignees against`);
  const statePath = join(projectRoot, ".agents", "state.json");
  if (!existsSync(statePath)) return skip("no .agents/state.json");
  let tasks: Array<{ id?: unknown; assignee?: unknown }>;
  try {
    const data = JSON.parse(readFileSync(statePath, "utf8")) as { tasks?: unknown };
    if (!Array.isArray(data.tasks)) return skip(".agents/state.json has no tasks array");
    tasks = data.tasks as typeof tasks;
  } catch (err) {
    return skip(`.agents/state.json unreadable: ${(err as Error).message}`);
  }

  const known = new Set(seats.map((s) => s.seat));
  const assigned = tasks.filter((t) => t.assignee !== undefined);
  const bad = assigned.filter((t) => typeof t.assignee !== "string" || !known.has(t.assignee));
  if (bad.length > 0) {
    return {
      name,
      severity: "issue",
      message: bad.map((t) => `${String(t.id)} assignee ${JSON.stringify(t.assignee)} is not a seat in ${SEAT_MAP_REL}`).join("; ") +
        ` (seats: ${[...known].join(", ")})`,
      report: true,
    };
  }
  return {
    name,
    severity: "pass",
    message: `${assigned.length} assigned task(s), every assignee a seat in the map (${[...known].join(", ")}). LIMIT: done tasks are checked too; nothing here says an assignment is current.`,
    report: true,
  };
}
