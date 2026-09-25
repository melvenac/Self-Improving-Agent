// node sumjson.mjs <vitest json> — per-file duration, counts, and every failed test. QA 96.
import { readFileSync } from "node:fs";
const r = JSON.parse(readFileSync(process.argv[2], "utf-8"));
let p = 0, f = 0, s = 0;
for (const t of r.testResults) {
  const st = t.assertionResults.reduce((a, x) => ((a[x.status] = (a[x.status] ?? 0) + 1), a), {});
  p += st.passed ?? 0; f += st.failed ?? 0; s += (st.skipped ?? 0) + (st.pending ?? 0);
  console.log(`${t.name.split(/[\/]/).pop().padEnd(34)} ${String(Math.round((t.endTime - t.startTime) / 1000)).padStart(4)}s ${JSON.stringify(st)}`);
}
console.log(`passed ${p} failed ${f} skipped ${s} success=${r.success}`);
for (const t of r.testResults) for (const a of t.assertionResults) if (a.status === "failed") console.log(`  x ${a.fullName.slice(0, 190)}`);
