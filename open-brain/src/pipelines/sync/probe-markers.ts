import type { CheckResult } from "./types.js";

/**
 * Record 198 red stub. Does not read open-brain/tests. The rows that expect
 * an issue on a file containing "not for merge" fail against this.
 */
export function checkProbeMarkers(_projectRoot: string): CheckResult {
  return {
    name: "probe-markers",
    report: true,
    severity: "pass",
    message: "probe-markers does not read open-brain/tests",
  };
}
