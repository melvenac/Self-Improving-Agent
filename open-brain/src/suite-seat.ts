/**
 * T-168 / D-156: the heavy-suite runner's seat. --seat, else SUITE_SEAT, else this checkout's
 * row in the seat map (its hub_name). No default: a run that cannot work out its seat is refused.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { SEAT_MAP_REL, resolveCheckoutSeat } from "./pipelines/session-start/seat-map.js";

export type SuiteSeat =
  | { ok: true; seat: string; source: "--seat" | "SUITE_SEAT" | `checkout ${string}` }
  | { ok: false; why: string };

/** The nearest directory at or above `start` that holds the seat map, or null. */
function findMapRoot(start: string): string | null {
  for (let d = start; ; d = dirname(d)) {
    if (existsSync(join(d, SEAT_MAP_REL))) return d;
    if (dirname(d) === d) return null;
  }
}

export function resolveSuiteSeat(input: { flag: string | undefined; env: string | undefined; cwd: string }): SuiteSeat {
  const flag = input.flag?.trim();
  if (flag) return { ok: true, seat: flag, source: "--seat" };
  const env = input.env?.trim();
  if (env) return { ok: true, seat: env, source: "SUITE_SEAT" };

  const cwd = resolve(input.cwd);
  const noMap = `no ${SEAT_MAP_REL} at or above ${cwd}`;
  const root = findMapRoot(cwd);
  if (root === null) return { ok: false, why: noMap };

  const r = resolveCheckoutSeat(root);
  switch (r.kind) {
    case "seat":
      if (r.hubName !== null) return { ok: true, seat: r.hubName, source: `checkout ${r.checkout}` };
      return { ok: false, why: `seat ${r.seat} (checkout ${r.checkout}) has no hub_name in ${SEAT_MAP_REL}` };
    case "seatless":
      return { ok: false, why: `checkout ${r.checkout} is seatless: ${r.reason}` };
    case "unknown":
      return { ok: false, why: `checkout ${r.checkout} is not in ${SEAT_MAP_REL}` };
    case "no-map":
      return { ok: false, why: noMap };
    case "unreadable":
      return { ok: false, why: r.reason };
  }
}
