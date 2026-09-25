// node sumj.mjs <json> [filter] — QA 99: per-test status from a vitest JSON report (one line each), then totals.
import { readFileSync } from "node:fs";
const [p, filt] = process.argv.slice(2);
const r = JSON.parse(readFileSync(p, "utf-8"));
const c = {};
for (const t of r.testResults) for (const a of t.assertionResults) {
  c[a.status] = (c[a.status] ?? 0) + 1;
  const file = t.name.split(/[\/]/).pop();
  const line = `${a.status.padEnd(7)} ${file.replace(".test.ts", "")} > ${a.title}`;
  if (!filt || line.includes(filt)) {
    console.log(line.slice(0, 170));
    if (a.status === "failed" && process.env.MSG) console.log("        " + (a.failureMessages?.[0] ?? "").split("\n")[0].slice(0, 400));
  }
}
console.log(JSON.stringify(c), "numFailedTestSuites", r.numFailedTestSuites);
