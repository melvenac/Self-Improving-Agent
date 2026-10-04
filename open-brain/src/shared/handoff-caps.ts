import { watchText } from "./state-schema.js";
import type { WatchOut } from "./state-schema.js";

/**
 * T-236 slice 2: the caps on a NEW handoff write, where a repo opted in (`handoff_caps` in .agents/SYSTEM/greeting.json).
 * Measured on 2026-10-03: the Briefing was 9.5 KB and 70% of it was WATCH OUT, twelve items that were mostly standing rules.
 * A handoff carries the next action and at most a few things that are new; a standing rule belongs in a role doc.
 *
 * These constants are shared by the writer (which refuses) and the renderer (which clips what an older, uncapped handoff
 * prints), so the two cannot drift.
 */
export const HANDOFF_CAPS = { watchOuts: 3, watchOutChars: 200, pickUpChars: 400 } as const;

/**
 * Every way a handoff breaks the caps, each naming what and by how much. Empty means it is within them. Never throws, and
 * never rewrites the input: refusing is the writer's act.
 */
export function handoffCapViolations(pickUp: string, watchOut: readonly WatchOut[]): string[] {
  const broken: string[] = [];
  if (pickUp.length > HANDOFF_CAPS.pickUpChars) {
    broken.push(`pick_up is ${pickUp.length} chars, the cap is ${HANDOFF_CAPS.pickUpChars} (the next action only)`);
  }
  if (watchOut.length > HANDOFF_CAPS.watchOuts) {
    broken.push(`${watchOut.length} watch-outs, the cap is ${HANDOFF_CAPS.watchOuts} (a standing rule belongs in a role doc)`);
  }
  watchOut.forEach((w, i) => {
    const text = watchText(w);
    if (/[\r\n]/.test(text)) broken.push(`watch-out ${i + 1} spans more than one line (one line each)`);
    if (text.length > HANDOFF_CAPS.watchOutChars) {
      broken.push(`watch-out ${i + 1} is ${text.length} chars, the cap is ${HANDOFF_CAPS.watchOutChars}`);
    }
  });
  return broken;
}
