// QA 243: summarise vitest JSON reports from full-suite runs: counts, every failed test by name, per-file s4 results,
// and the spawning s4 tests' durations. Usage: node qa243-summary.mjs <label=report.json>...
import { readFileSync } from "node:fs";
import { basename } from "node:path";
for (const spec of process.argv.slice(2)) {
  const [label, file] = spec.split("=");
  const j = JSON.parse(readFileSync(file, "utf8"));
  console.log(`== ${label}: files ${j.numTotalTestSuites} (failed ${j.numFailedTestSuites}); tests ${j.numTotalTests}: passed ${j.numPassedTests}, failed ${j.numFailedTests}, skipped/pending ${j.numPendingTests + j.numTodoTests}; success ${j.success}`);
  for (const f of j.testResults) {
    if (f.status === "failed" && !f.assertionResults.some((a) => a.status === "failed")) console.log(`  FILE FAILED (no test): ${basename(f.name)}: ${(f.message || "").slice(0, 200)}`);
    for (const a of f.assertionResults) if (a.status === "failed") console.log(`  FAILED: ${basename(f.name)} :: ${a.fullName}`);
  }
  for (const f of j.testResults) {
    const b = basename(f.name);
    if (!b.startsWith("s4-")) continue;
    const pass = f.assertionResults.filter((a) => a.status === "passed").length;
    const slow = f.assertionResults.filter((a) => (a.duration ?? 0) > 2000).map((a) => `${a.title.slice(0, 40)} ${Math.round(a.duration)}ms`);
    console.log(`  ${b}: ${pass}/${f.assertionResults.length} passed; ${((f.endTime - f.startTime) / 1000).toFixed(1)} s; >2s: ${slow.join("; ") || "-"}`);
  }
}
