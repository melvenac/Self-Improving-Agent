import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isSeatRuntime } from "../session-start/hub-seat-state.js";
import type { CheckResult } from "./types.js";

type DispatchCursor = { via?: unknown; hub_name?: unknown; room?: unknown; waker?: unknown };
type DispatchCc = { via?: unknown; name?: unknown; host?: unknown };
type HubSeat = {
  hub_name?: unknown;
  runtime?: unknown;
  host?: unknown;
  model?: unknown;
  dispatch?: { cursor?: DispatchCursor; claude_code?: DispatchCc };
  room?: unknown;
};
type Partner = { label?: unknown; hub_as?: unknown; session_id?: unknown };
type HubFile = {
  talk?: unknown;
  seats?: Record<string, HubSeat>;
  readers?: Record<string, { partners?: unknown }>;
};
type SeatFile = { seats?: unknown };

/** The file ob_start reads for partner presence. T-196 extends that file; it does not add a second one. */
export const HUB_PARTNER_SEATS_REL = ".agents/SYSTEM/hub-partner-seats.json";

function issue(message: string): CheckResult {
  return { name: "hub-seats", severity: "issue", message };
}

function filled(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateDispatch(seat: string, row: HubSeat, problems: string[]): void {
  if (!isSeatRuntime(row.runtime)) {
    problems.push(`${seat} has no runtime (cursor or claude-code)`);
    return;
  }
  if (!filled(row.host)) problems.push(`${seat} has no host`);
  if (!filled(row.model)) problems.push(`${seat} has no model`);
  const d = row.dispatch;
  if (!d || typeof d !== "object") {
    problems.push(`${seat} has no dispatch block`);
    return;
  }
  const cur = d.cursor;
  if (!cur || typeof cur !== "object") {
    problems.push(`${seat} dispatch.cursor is missing`);
  } else {
    if (cur.via !== "hub-room") problems.push(`${seat} dispatch.cursor.via must be hub-room`);
    if (!filled(cur.hub_name)) problems.push(`${seat} dispatch.cursor has no hub_name`);
    if (!filled(cur.waker)) problems.push(`${seat} dispatch.cursor has no waker`);
    if (row.runtime === "cursor") {
      const dispatchRoom = typeof cur.room === "string" ? cur.room.trim() : "";
      const topRoom = typeof row.room === "string" ? row.room.trim() : "";
      if (!dispatchRoom) problems.push(`${seat} is a cursor runtime seat with no room (dispatch.cursor.room; a top-level room is not a fallback)`);
      if (dispatchRoom && topRoom && dispatchRoom !== topRoom) {
        problems.push(`${seat} top-level room differs from dispatch.cursor.room`);
      }
    }
  }
  const cc = d.claude_code;
  if (!cc || typeof cc !== "object") {
    problems.push(`${seat} dispatch.claude_code is missing`);
  } else {
    if (cc.via !== "session") problems.push(`${seat} dispatch.claude_code.via must be session`);
    if (!filled(cc.name)) problems.push(`${seat} dispatch.claude_code has no name`);
    if (!filled(cc.host)) problems.push(`${seat} dispatch.claude_code has no host`);
  }
}

export function checkHubSeats(projectRoot: string): CheckResult {
  const hubPath = join(projectRoot, HUB_PARTNER_SEATS_REL);
  if (!existsSync(hubPath)) {
    return {
      name: "hub-seats",
      severity: "skip",
      message: "not checked: no seat file",
    };
  }

  let hub: HubFile;
  try {
    hub = JSON.parse(readFileSync(hubPath, "utf-8")) as HubFile;
  } catch (error) {
    return issue(`hub-partner-seats.json did not parse: ${error instanceof Error ? error.message : String(error)}`);
  }

  const seatsPath = join(projectRoot, ".agents", "SYSTEM", "worktree-seats.json");
  if (!existsSync(seatsPath)) {
    return issue("hub-partner-seats.json is present but worktree-seats.json is not, so seat names cannot be checked");
  }
  let known: string[];
  let ignoredSeatNames = 0;
  try {
    const seats = JSON.parse(readFileSync(seatsPath, "utf-8")) as SeatFile;
    known = Array.isArray(seats.seats) ? seats.seats.filter((s): s is string => typeof s === "string") : [];
    // T-048: a seat name that is not a string used to vanish here, which made the seat it was meant to name look unknown.
    ignoredSeatNames = Array.isArray(seats.seats) ? seats.seats.length - known.length : 0;
  } catch (error) {
    return issue(`worktree-seats.json did not parse: ${error instanceof Error ? error.message : String(error)}`);
  }

  const talk = typeof hub.talk === "string" ? hub.talk : "";
  if (!talk.includes("hub-talk") || !talk.includes("{hub_name}") || !talk.includes("{room}")) {
    return issue("hub-partner-seats.json talk line must name hub-talk and the {hub_name} and {room} placeholders");
  }

  const problems: string[] = [];
  if (ignoredSeatNames > 0) problems.push(`worktree-seats.json has ${ignoredSeatNames} seat name(s) that are not strings and were ignored`);
  if (!hub.readers || typeof hub.readers !== "object" || Array.isArray(hub.readers)) {
    problems.push("no readers map (ob_start reads readers)");
  } else {
    for (const [reader, block] of Object.entries(hub.readers)) {
      const partners = block && typeof block === "object" && Array.isArray(block.partners) ? block.partners : null;
      if (!partners) {
        problems.push(`${reader} has no partners list`);
        continue;
      }
      partners.forEach((partner, index) => {
        const row = partner as Partner;
        if (!filled(row?.label) || !filled(row?.hub_as) || !filled(row?.session_id)) {
          problems.push(`${reader} partner ${index} is missing label, hub_as, or session_id`);
        }
      });
    }
  }

  const entries = hub.seats && typeof hub.seats === "object" ? hub.seats : {};
  for (const [seat, row] of Object.entries(entries)) {
    if (!known.includes(seat)) {
      problems.push(`${seat} is not a seat in worktree-seats.json`);
      continue;
    }
    validateDispatch(seat, row ?? {}, problems);
  }

  if (problems.length > 0) {
    return issue(`hub seats: ${problems.join("; ")}`);
  }
  const cursorSeats = Object.entries(entries).filter(([, row]) => row?.runtime === "cursor").map(([seat]) => seat);
  const ccSeats = Object.entries(entries).filter(([, row]) => row?.runtime === "claude-code").map(([seat]) => seat);
  return {
    name: "hub-seats",
    severity: "pass",
    report: true,
    message: `hub-partner-seats.json matches worktree-seats.json and the readers map ob_start reads (${cursorSeats.length} cursor runtime(s): ${cursorSeats.join(", ")}; ${ccSeats.length} claude-code: ${ccSeats.join(", ")}); ${ignoredSeatNames} seat names ignored`,
  };
}
