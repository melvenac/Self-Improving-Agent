import { readAgentIdentity } from "../session-start/agent-identity.js";
import { resolveCheckoutSeat, SEAT_MAP_REL } from "../session-start/seat-map.js";
import type { CheckResult } from "./types.js";

/**
 * T-203 (closes G-049). A checkout's seat comes from the tracked seat map, keyed by the
 * checkout's basename. The identity a seat declares in `.agents/AGENT.local.md` is
 * compared with it and flagged when they differ: sia-builder and sia-infra both declared
 * "Forge / developer", which made every identity-keyed lookup resolve them to Forge.
 *
 * Skips, with the reason, when there is nothing to compare: skip is not pass.
 */
export function checkSeatIdentity(projectRoot: string): CheckResult {
  const name = "seat-identity";
  const skip = (why: string): CheckResult => ({ name, severity: "skip", message: `skipped — ${why}`, report: true });

  const seat = resolveCheckoutSeat(projectRoot);
  if (seat.kind === "no-map") return skip(`no seat map (${SEAT_MAP_REL})`);
  if (seat.kind === "unreadable") return skip(seat.reason);
  if (seat.kind === "seatless") return skip(`${seat.checkout}: ${seat.reason}`);
  if (seat.kind === "unknown") return skip(`seat unknown for checkout ${seat.checkout}`);

  const declared = readAgentIdentity(projectRoot);
  if (!declared) return skip(`checkout ${seat.checkout} has no AGENT.local.md or AGENT.md identity to compare`);

  if (declared.name !== seat.agent || declared.role !== seat.role) {
    return {
      name,
      severity: "issue",
      message:
        `checkout ${seat.checkout}: AGENT.local.md says name ${declared.name}, role ${declared.role}; ` +
        `${SEAT_MAP_REL} says name ${seat.agent}, role ${seat.role}. The map wins: fix the untracked file.`,
      report: true,
    };
  }
  return {
    name,
    severity: "pass",
    message: `checkout ${seat.checkout}: AGENT.local.md matches the seat map (name ${declared.name}, role ${declared.role}). LIMIT: compares one checkout's own file; the other seats' AGENT.local.md are untracked and not seen.`,
    report: true,
  };
}
