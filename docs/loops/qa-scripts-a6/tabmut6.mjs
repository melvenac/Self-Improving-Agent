// node tabmut6.mjs [--names] — QA 94. One line per mutant from mut6/<m>.rows.json: red count of the candidate's rows
// (qa94-handle counted separately), unhandled errors, and (with --names) each red test. A missing JSON is printed as
// MISSING, never as zero.
import { existsSync, readdirSync, readFileSync } from "node:fs";
const names = process.argv.includes("--names");
const ms = readdirSync("mut6").filter((f) => f.endsWith(".rows.json")).map((f) => f.slice(0, -10));
const logs = readFileSync("allmut6.log", "utf-8");
for (const m of ms.sort()) {
  const p = `mut6/${m}.rows.json`;
  if (!existsSync(p)) { console.log(`${m} MISSING`); continue; }
  const r = JSON.parse(readFileSync(p, "utf-8"));
  const red = [], handle = [];
  let total = 0;
  for (const f of r.testResults) for (const a of f.assertionResults) {
    total++;
    if (a.status !== "failed") continue;
    (f.name.includes("qa94-handle") ? handle : red).push(a.fullName);
  }
  const out = readFileSync(`mut6/${m}.rows.out`, "utf-8");
  const unh = (out.match(/Unhandled|onTaskUpdate/g) ?? []).length;
  console.log(`${m.padEnd(24)} rows_red=${String(red.length).padStart(2)} handle_red=${handle.length} total=${total} unhandled=${unh} success=${r.success}`);
  if (names) for (const n of red) console.log(`    - ${n.slice(0, 170)}`);
}
