import type { ProjectState, DriftResult } from "./types.js";

export function detectDrift(state: ProjectState): DriftResult[] {
  const drift: DriftResult[] = [];

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
