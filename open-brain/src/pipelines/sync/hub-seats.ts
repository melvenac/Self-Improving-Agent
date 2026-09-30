import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult } from "./types.js";

type HubSeat = { hub_name?: unknown; cursor?: unknown; room?: unknown };
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
  try {
    const seats = JSON.parse(readFileSync(seatsPath, "utf-8")) as SeatFile;
    known = Array.isArray(seats.seats) ? seats.seats.filter((s): s is string => typeof s === "string") : [];
  } catch (error) {
    return issue(`worktree-seats.json did not parse: ${error instanceof Error ? error.message : String(error)}`);
  }

  const talk = typeof hub.talk === "string" ? hub.talk : "";
  if (!talk.includes("hub-talk") || !talk.includes("{hub_name}") || !talk.includes("{room}")) {
    return issue("hub-partner-seats.json talk line must name hub-talk and the {hub_name} and {room} placeholders");
  }

  const problems: string[] = [];
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
    if (row?.cursor === true) {
      const room = typeof row.room === "string" ? row.room.trim() : "";
      const name = typeof row.hub_name === "string" ? row.hub_name.trim() : "";
      if (!name) problems.push(`${seat} is a Cursor seat with no hub_name`);
      if (!room) problems.push(`${seat} is a Cursor seat with no room`);
    }
  }

  if (problems.length > 0) {
    return issue(`hub seats: ${problems.join("; ")}`);
  }
  const cursorSeats = Object.entries(entries).filter(([, row]) => row?.cursor === true).map(([seat]) => seat);
  return {
    name: "hub-seats",
    severity: "pass",
    message: `hub-partner-seats.json matches worktree-seats.json and the readers map ob_start reads (${cursorSeats.length} Cursor room(s): ${cursorSeats.join(", ")})`,
  };
}
