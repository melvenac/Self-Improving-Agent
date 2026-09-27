// Check 4: does the scorer change score anything differently? Same inputs to base and candidate scorePipelineHealth.
// Usage: node scorer-sweep.mjs <baseOpenBrain> <candOpenBrain>
import { pathToFileURL } from "node:url";
import { join } from "node:path";
const [b, c] = process.argv.slice(2);
const B = (await import(pathToFileURL(join(b, "build/pipelines/sync/scorer.js")).href)).scorePipelineHealth;
const C = (await import(pathToFileURL(join(c, "build/pipelines/sync/scorer.js")).href)).scorePipelineHealth;
const now = Date.now();
const iso = (ms) => new Date(now - ms).toISOString();
const sq = (ms) => iso(ms).replace("T", " ").slice(0, 19);
const hookRuns = [null, iso(60e3), sq(3600e3), iso(23 * 3600e3), iso(25 * 3600e3), iso(6 * 86400e3), iso(8 * 86400e3), iso(-3600e3),
  "corrupt", "unreadable: EBUSY: resource busy or locked", "unreadable", "corrupt: x", "", "garbage", "not a date", "2026-13-45"];
let diffs = 0, n = 0;
for (const lastHookRun of hookRuns) for (const scoreTrend of ["improving", "stable", "declining", "unknown"]) for (const shadowSessions of [0, 1, 5, 20]) {
  const i = { lastHookRun, scoreTrend, shadowSessions };
  const x = B(i), y = C(i);
  n++;
  const { invocationLog, ...rest } = y.details;
  const same = x.score === y.score && x.max === y.max && x.name === y.name && JSON.stringify(x.details) === JSON.stringify(rest);
  if (!same) { diffs++; console.log("DIFF", JSON.stringify(i), JSON.stringify(x), JSON.stringify(y)); }
  if (scoreTrend === "unknown" && shadowSessions === 0) console.log(`${JSON.stringify(lastHookRun).padEnd(48)} base ${x.score} cand ${y.score} invocationLog=${invocationLog}`);
}
console.log(`${n} inputs, ${diffs} differ in anything but the added details.invocationLog`);
