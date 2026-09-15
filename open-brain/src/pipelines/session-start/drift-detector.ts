import type { ProjectState, DriftResult } from "./types.js";

export function detectDrift(state: ProjectState): DriftResult[] {
  const drift: DriftResult[] = [];

  // Loop 8 R3 / ADR-027: the `state-version` drift branch is gone with the
  // field. It compared a cached copy of package.json's version against
  // package.json — drift between a value and its own source, which is a
  // cache-coherence problem the record should not have had.

  if (!state.summary) return drift;

  // Check version in SUMMARY matches package.json
  const versionMatch = state.summary.match(/\*\*Version:\*\*\s*([\d.]+)/);
  if (versionMatch && versionMatch[1] !== state.version) {
    drift.push({
      field: "summary-version",
      expected: state.version,
      actual: versionMatch[1],
      fixed: false,
    });
  }

  // Check completed INBOX items still listed as broken in SUMMARY
  if (state.inbox) {
    const completedItems = state.inbox
      .split("\n")
      .filter((line) => line.match(/^\s*-\s*\[x\]/i))
      .map((line) => line.replace(/^\s*-\s*\[x\]\s*/i, "").trim().toLowerCase());

    const brokenSection = state.summary.match(/## What's broken\n([\s\S]*?)(?=\n##|$)/);
    if (brokenSection) {
      for (const item of completedItems) {
        if (brokenSection[1].toLowerCase().includes(item)) {
          drift.push({
            field: "summary-stale-broken",
            expected: `"${item}" should not be listed as broken (completed in INBOX)`,
            actual: `Still listed under "What's broken"`,
            fixed: false,
          });
        }
      }
    }
  }

  return drift;
}
