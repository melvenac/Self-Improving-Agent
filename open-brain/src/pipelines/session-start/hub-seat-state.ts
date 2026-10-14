/**
 * Seat state names published by A2A-Hub wakers on GET /a2a/agents/presence (`agents[].seat.seatState`).
 * Source of truth: A2A-Hub `src/seatStateStore.ts` lines 3–9 (v1.16.2) and `src/presence.ts` lines 14–27
 * (v1.22.13). Alarm reasons such as room_full or run_too_long travel in `alarmReason`, not as separate
 * seatState values (T-095); an alarm prints its reason in parentheses (T-269).
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

/** Longest alarmReason printed. A2A-Hub's reasons are snake_case tokens (seat-waker.mjs v1.22.13: run_too_long, orphan_run, no_reply_since_turn_<n>, reply_instruction_unavailable). */
export const ALARM_REASON_MAX = 40;
const ALARM_REASON_RE = /^[a-z0-9_]{1,40}$/;

const KNOWN = new Set<string>(HUB_SEAT_STATE_NAMES);

/** Print a hub seatState as-is when known; never invent a synonym. An alarm prints the hub's own alarmReason in parentheses (T-269). */
export function formatHubSeatState(raw: string | undefined | null, alarmReason?: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "state:unknown(missing)";
  if (raw === "alarm" && alarmReason !== undefined && alarmReason !== null && alarmReason !== "") {
    return typeof alarmReason === "string" && ALARM_REASON_RE.test(alarmReason) ? `alarm(${alarmReason})` : "alarm(reason:unprintable)";
  }
  if (KNOWN.has(raw)) return raw;
  return `state:unknown(${raw})`;
}

export type SeatRuntime = "cursor" | "claude-code";

export function isSeatRuntime(v: unknown): v is SeatRuntime {
  return v === "cursor" || v === "claude-code";
}
