// node failmsg.mjs <mutant> <title-substring> — the failure message of matching tests in a mutant's rows JSON. QA session 89.
import { readFileSync } from "node:fs";
const [m, sub] = process.argv.slice(2);
const j = JSON.parse(readFileSync(`mut/${m}.rows.json`, "utf-8"));
for (const t of j.testResults) for (const a of t.assertionResults) {
  if (!a.fullName.includes(sub)) continue;
  console.log(`${m} | ${a.status} | ${a.fullName.slice(-90)}`);
  for (const f of a.failureMessages ?? []) console.log(`   ${f.split("\n")[0].slice(0, 260)}`);
}
