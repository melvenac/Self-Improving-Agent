/**
 * Seat state names published by A2A-Hub wakers on GET /a2a/agents/presence (`agents[].seat.seatState`).
 * Source of truth: A2A-Hub `src/seatStateStore.ts` lines 3–9 (v1.16.2; alarm reasons such as room_full
 * are carried in `alarmReason`, not as separate seatState values — T-095).
 */
export const HUB_SEAT_STATE_NAMES = [
  "working",
  "idle",
  "owes_reply",
  "paused",
  "waker_down",
  "alarm",
] as const;

export type HubSeatStateName = (typeof HUB_SEAT_STATE_NAMES)[number];

const KNOWN = new Set<string>(HUB_SEAT_STATE_NAMES);

/** Print a hub seatState as-is when known; never invent a synonym. */
export function formatHubSeatState(raw: string | undefined | null): string {
  if (raw === undefined || raw === null || raw === "") return "state:unknown(missing)";
  if (KNOWN.has(raw)) return raw;
  return `state:unknown(${raw})`;
}

export type SeatRuntime = "cursor" | "claude-code";

export function isSeatRuntime(v: unknown): v is SeatRuntime {
  return v === "cursor" || v === "claude-code";
}
