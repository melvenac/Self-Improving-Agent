import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult } from "./types.js";

type HubSeat = { hub_name?: unknown; cursor?: unknown; room?: unknown };
type HubFile = { talk?: unknown; seats?: Record<string, HubSeat> };
type SeatFile = { seats?: unknown };

function issue(message: string): CheckResult {
  return { name: "hub-seats", severity: "issue", message };
}

export function checkHubSeats(projectRoot: string): CheckResult {
  const hubPath = join(projectRoot, ".agents", "SYSTEM", "hub-seats.json");
  if (!existsSync(hubPath)) {
    return {
      name: "hub-seats",
      severity: "skip",
      message: "hub-seats.json not present — seat rooms are not checked (a project without the file is skipped, not passed)",
    };
  }

  let hub: HubFile;
  try {
    hub = JSON.parse(readFileSync(hubPath, "utf-8")) as HubFile;
  } catch (error) {
    return issue(`hub-seats.json did not parse: ${error instanceof Error ? error.message : String(error)}`);
  }

  const seatsPath = join(projectRoot, ".agents", "SYSTEM", "worktree-seats.json");
  if (!existsSync(seatsPath)) {
    return issue("hub-seats.json is present but worktree-seats.json is not, so seat names cannot be checked");
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
    return issue("hub-seats.json talk line must name hub-talk and the {hub_name} and {room} placeholders");
  }

  const problems: string[] = [];
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
    message: `hub seats match worktree-seats.json (${cursorSeats.length} Cursor room(s): ${cursorSeats.join(", ")})`,
  };
}
