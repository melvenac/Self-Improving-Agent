import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TaskPriority, type State, type Task } from "../../shared/state-schema.js";
import { SEAT_MAP_REL, seatRowRuntimeFields, type SeatMapRow } from "./seat-map.js";
import { isSeatRuntime } from "./hub-seat-state.js";
import type { SeatResolution } from "./seat-map.js";
import { TITLE_CLIP } from "./state-render.js";

/**
 * T-236 (c): FOCUS and SEATS, computed from the RECORD only (plan docs/loops/t236c-plan.md, ruled s160).
 * T-240: SEATS adds runtime, model, host and live state per seat from the map and the roster ob_start already fetched.
 *
 * The assignment is `tasks[].assignee`, a key of the seat map, set by the planner at dispatch. A seat is resolved by
 * its CHECKOUT (T-203), never by AGENT.local.md. Live state comes only from the roster ob_start already fetched;
 * with no roster there are none, and none are guessed.
 */
export interface SeatSlot {
  seat: string;
  hubName: string | null;
  runtime: string;
  model: string;
  host: string;
}

const FOCUS_MORE = "state.json tasks[] (assignee)";
const SEATS_MORE = ".agents/SYSTEM/hub-partner-seats.json";
/** Shown on the SEATS line for that seat. The line is not dropped (T-240 r2). */
export const RUNTIME_MISSING_IN_SEAT_MAP = "runtime missing in seat map";
const SEATS_CAP = 400;
const PRIORITY_ORDER: readonly string[] = TaskPriority.options;
/** The same clip the state render applies to task titles (state-render clipTitle). */
const clipTitle = (title: string): string => (title.length > TITLE_CLIP ? `${title.slice(0, TITLE_CLIP).trimEnd()}…` : title);

/** A seat's live assignments, the one to show first: highest priority, then the lower id. Done tasks never count. */
function assigned(state: State, seat: string): Task[] {
  const num = (id: string) => Number(id.replace(/\D/g, "")) || 0;
  return state.tasks
    .filter((t) => t.status !== "done" && t.assignee === seat)
    .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) || num(a.id) - num(b.id));
}

/** The seat map's seats, in map order, or null when there is no readable map or a row lacks host or model. */
export function seatOrder(projectRoot: string): SeatSlot[] | null {
  const abs = join(projectRoot, SEAT_MAP_REL);
  if (!existsSync(abs)) return null;
  try {
    const data = JSON.parse(readFileSync(abs, "utf8")) as { seats?: Record<string, SeatMapRow> };
    if (typeof data.seats !== "object" || data.seats === null) return null;
    const slots: SeatSlot[] = [];
    for (const [seat, row] of Object.entries(data.seats)) {
      const hubName = typeof row?.hub_name === "string" && row.hub_name.trim() !== "" ? row.hub_name.trim() : null;
      // A missing runtime stays on the line. Returning null here dropped every seat (T-240 r2).
      if (!isSeatRuntime(row?.runtime)) {
        slots.push({ seat, hubName, runtime: RUNTIME_MISSING_IN_SEAT_MAP, model: "", host: "" });
        continue;
      }
      const rt = seatRowRuntimeFields(row);
      if (!rt.ok) return null;
      slots.push({ seat, hubName, runtime: rt.runtime, model: rt.model, host: rt.host });
    }
    return slots;
  } catch {
    return null;
  }
}

/** This checkout's FOCUS line, or null for a checkout that is deliberately not a seat (the main one). */
export function focusLine(state: State, seat: SeatResolution): string | null {
  switch (seat.kind) {
    case "seatless":
      return null;
    case "unknown":
      return `FOCUS: seat unknown for checkout ${seat.checkout}`;
    case "no-map":
      return `FOCUS: no seat map (${SEAT_MAP_REL}), so this checkout's seat is unknown`;
    case "unreadable":
      return `FOCUS: ${seat.reason}`;
  }
  const mine = assigned(state, seat.seat);
  if (mine.length === 0) return "FOCUS: none assigned in the record";
  const top = mine[0]!;
  const more = mine.length > 1 ? ` · +${mine.length - 1} more: ${FOCUS_MORE}` : "";
  return `FOCUS: ${top.id} ${clipTitle(top.title)} (${top.priority}, ${top.status})${more}`;
}

/** One line: every map seat with task, runtime, model, host, and optional live state from the roster. */
export function seatsLine(
  state: State,
  seats: readonly SeatSlot[],
  liveByHubName: Readonly<Record<string, string>> | null,
): string | null {
  if (seats.length === 0) return null;
  const parts = seats.map(({ seat, hubName, runtime, model, host }) => {
    const mine = assigned(state, seat);
    const task = mine.length === 0 ? "—" : `${mine[0]!.id}${mine.length > 1 ? ` (+${mine.length - 1})` : ""}`;
    if (runtime === RUNTIME_MISSING_IN_SEAT_MAP) return `${seat} ${task} ${RUNTIME_MISSING_IN_SEAT_MAP}`;
    const meta = `${runtime} ${model} ${host}`;
    const live = liveByHubName && hubName !== null ? liveByHubName[hubName] : undefined;
    return `${seat} ${task} ${meta}${live ? ` ${live}` : ""}`;
  });
  let shown = parts.length;
  const render = (n: number) => `SEATS: ${parts.slice(0, n).join(" · ")}${n < parts.length ? ` · +${parts.length - n} more: ${SEATS_MORE}` : ""}`;
  while (shown > 1 && render(shown).length > SEATS_CAP) shown--;
  return render(shown);
}
