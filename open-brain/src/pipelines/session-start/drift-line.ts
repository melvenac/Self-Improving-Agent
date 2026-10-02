import { readProjectState } from "./state-reader.js";
import { detectDrift } from "./drift-detector.js";

/**
 * The SessionStart hook's drift line (T-208 r3): the same check ob_start reports
 * (`detectDrift` over the rendered views), on ONE line so it sits beside the tree
 * currency line it is not the same thing as. A check that cannot run says so and
 * why; it never degrades to `none`, because "none" is a claim about the views.
 */
export function describeDriftLine(projectRoot: string): string {
  try {
    const state = readProjectState(projectRoot);
    if (state.stateJson.present && !state.stateJson.valid) {
      return `Drift: not checked (.agents/state.json is unreadable or invalid: ${state.stateJson.error ?? "no detail"})`;
    }
    const drift = detectDrift(state);
    if (drift.length === 0) return "Drift: none";
    const items = drift.map((d) => `${d.field}: expected ${d.expected}, got ${d.actual}${d.fixed ? " (fixed)" : " (not fixed)"}`);
    return `Drift detected (${drift.length}): ${items.join("; ")}`;
  } catch (err) {
    return `Drift: not checked (${err instanceof Error ? err.message : String(err)})`;
  }
}
