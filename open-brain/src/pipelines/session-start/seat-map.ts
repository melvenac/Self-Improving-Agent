import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { isSeatRuntime, type SeatRuntime } from "./hub-seat-state.js";

/** The single tracked seat map (T-203). T-196's seat file carries it; worktree-seats.json is the layout rule only. */
export const SEAT_MAP_REL = ".agents/SYSTEM/hub-partner-seats.json";

export type SeatMapRow = {
  checkout?: unknown;
  role?: unknown;
  agent?: unknown;
  hub_name?: unknown;
  runtime?: unknown;
  host?: unknown;
  model?: unknown;
  dispatch?: unknown;
  room?: unknown;
};

export type SeatResolution =
  | {
      kind: "seat";
      checkout: string;
      seat: string;
      role: string;
      agent: string;
      hubName: string | null;
      runtime: SeatRuntime;
      host: string;
      model: string;
    }
  | { kind: "seatless"; checkout: string; reason: string }
  | { kind: "unknown"; checkout: string }
  | { kind: "no-map" }
  | { kind: "unreadable"; reason: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const filled = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function seatRowRuntimeFields(row: SeatMapRow): { ok: true; runtime: SeatRuntime; host: string; model: string } | { ok: false; reason: string } {
  if (!isSeatRuntime(row.runtime)) return { ok: false, reason: "runtime must be cursor or claude-code" };
  if (!filled(row.host)) return { ok: false, reason: "host is required" };
  if (!filled(row.model)) return { ok: false, reason: "model is required" };
  return { ok: true, runtime: row.runtime, host: row.host.trim(), model: row.model.trim() };
}

export function readSeatMapRows(projectRoot: string): { ok: true; seats: Record<string, SeatMapRow> } | { ok: false; reason: string } {
  const path = join(projectRoot, SEAT_MAP_REL);
  if (!existsSync(path)) return { ok: false, reason: `${SEAT_MAP_REL} missing` };
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as { seats?: unknown };
    if (!isObject(data.seats)) return { ok: false, reason: `${SEAT_MAP_REL} has no seats map` };
    return { ok: true, seats: data.seats as Record<string, SeatMapRow> };
  } catch (err) {
    return { ok: false, reason: `${SEAT_MAP_REL} unreadable: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** hub_name → runtime for partner presence formatting (T-240). */
export function runtimeByHubName(projectRoot: string): Record<string, SeatRuntime> | null {
  const map = readSeatMapRows(projectRoot);
  if (!map.ok) return null;
  const out: Record<string, SeatRuntime> = {};
  for (const row of Object.values(map.seats)) {
    if (!isObject(row) || !filled(row.hub_name) || !isSeatRuntime(row.runtime)) continue;
    out[row.hub_name.trim()] = row.runtime;
  }
  return out;
}

/**
 * Resolves the seat of the CHECKOUT that `projectRoot` is: its basename, as the writer stamps
 * `sessions[].checkout`. AGENT.local.md is never read here. Two checkouts that carry the same
 * identity (sia-builder, sia-infra and sia-forge did; G-049) resolve to their own seats.
 *
 * `unknown` means the basename is in neither `seats` nor `seatless_checkouts`. The caller
 * prints it; it must not fall back to an identity.
 */
export function resolveCheckoutSeat(projectRoot: string): SeatResolution {
  const path = join(projectRoot, SEAT_MAP_REL);
  if (!existsSync(path)) return { kind: "no-map" };
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    return { kind: "unreadable", reason: `${SEAT_MAP_REL} unreadable: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!isObject(data)) return { kind: "unreadable", reason: `${SEAT_MAP_REL} is not an object` };

  const checkout = basename(resolve(projectRoot));
  const seatless = isObject(data.seatless_checkouts) ? data.seatless_checkouts[checkout] : undefined;
  if (filled(seatless)) return { kind: "seatless", checkout, reason: seatless };

  if (isObject(data.seats)) {
    for (const [seat, row] of Object.entries(data.seats)) {
      if (!isObject(row) || row.checkout !== checkout) continue;
      if (!filled(row.role) || !filled(row.agent)) {
        return { kind: "unreadable", reason: `${SEAT_MAP_REL}: seat ${seat} has no role or agent` };
      }
      const rt = seatRowRuntimeFields(row as SeatMapRow);
      if (!rt.ok) return { kind: "unreadable", reason: `${SEAT_MAP_REL}: seat ${seat} ${rt.reason}` };
      return {
        kind: "seat",
        checkout,
        seat,
        role: row.role,
        agent: row.agent,
        hubName: filled(row.hub_name) ? row.hub_name : null,
        runtime: rt.runtime,
        host: rt.host,
        model: rt.model,
      };
    }
  }
  return { kind: "unknown", checkout };
}
