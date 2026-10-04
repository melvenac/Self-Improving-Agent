import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TaskPriority, type State, type Task } from "../../shared/state-schema.js";
import { SEAT_MAP_REL, type SeatResolution } from "./seat-map.js";
import { TITLE_CLIP } from "./state-render.js";

/**
 * T-236 (c): FOCUS and SEATS, computed from the RECORD only (plan docs/loops/t236c-plan.md, ruled s160).
 *
 * The assignment is `tasks[].assignee`, a key of the seat map, set by the planner at dispatch. A seat is resolved by
 * its CHECKOUT (T-203), never by AGENT.local.md. Presence words come only from the roster ob_start already fetched;
 * with no roster there are none, and none are guessed.
 */
export type PresenceWord = "polling" | "not polling" | "absent";
export interface SeatSlot { seat: string; hubName: string | null }

const FOCUS_MORE = "state.json tasks[] (assignee)";
const SEATS_MORE = ".agents/SYSTEM/hub-partner-seats.json";
const SEATS_CAP = 240;
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

/** The seat map's seats, in map order, or null when there is no readable map. */
export function seatOrder(projectRoot: string): SeatSlot[] | null {
  const abs = join(projectRoot, SEAT_MAP_REL);
  if (!existsSync(abs)) return null;
  try {
    const data = JSON.parse(readFileSync(abs, "utf8")) as { seats?: Record<string, { hub_name?: unknown }> };
    if (typeof data.seats !== "object" || data.seats === null) return null;
    return Object.entries(data.seats).map(([seat, row]) => ({
      seat,
      hubName: typeof row?.hub_name === "string" && row.hub_name.trim() !== "" ? row.hub_name : null,
    }));
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

/** One line: every map seat with its first assignment or —, plus a presence word where the roster has one. */
export function seatsLine(state: State, seats: readonly SeatSlot[], presence: Readonly<Record<string, PresenceWord>> | null): string | null {
  if (seats.length === 0) return null;
  const parts = seats.map(({ seat, hubName }) => {
    const mine = assigned(state, seat);
    const task = mine.length === 0 ? "—" : `${mine[0]!.id}${mine.length > 1 ? ` (+${mine.length - 1})` : ""}`;
    const word = presence && hubName !== null ? presence[hubName] : undefined;
    return `${seat} ${task}${word ? ` ${word}` : ""}`;
  });
  let shown = parts.length;
  const render = (n: number) => `SEATS: ${parts.slice(0, n).join(" · ")}${n < parts.length ? ` · +${parts.length - n} more: ${SEATS_MORE}` : ""}`;
  while (shown > 1 && render(shown).length > SEATS_CAP) shown--;
  return render(shown);
}
