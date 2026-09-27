// node tabmut10.mjs [mutant...] — QA 130 (QA 108 tabmut10.mjs, repointed): kills = tests red under the mutant and not
// red at BASELINE; healed = red at BASELINE and not under the mutant. A missing JSON prints MISSING.
import { existsSync, readFileSync } from "node:fs";
const S = "C:/qa-scratch/qa130/mut11";
const load = (m) => {
  const p = `${S}/${m}.rows.json`;
  if (!existsSync(p)) return null;
  const j = JSON.parse(readFileSync(p, "utf8"));
  const st = new Map();
  for (const f of j.testResults) for (const a of f.assertionResults) st.set(`${f.name.replace(/^.*tests[\/]harness[\/]/, "")} > ${a.fullName}`, a.status);
  return { st, total: j.numTotalTests, passed: j.numPassedTests, failed: j.numFailedTests, pending: j.numPendingTests + (j.numTodoTests ?? 0) };
};
const base = load(process.env.BASE ?? "BASELINE");
if (!base) { console.log("BASELINE MISSING"); process.exit(1); }
const names = process.argv.slice(2);
for (const m of names.length ? names : ["BASELINE"]) {
  const r = load(m);
  if (!r) { console.log(`${m}: MISSING`); continue; }
  const kills = [...r.st].filter(([k, s]) => s === "failed" && base.st.get(k) !== "failed").map(([k]) => k);
  const healed = [...base.st].filter(([k, s]) => s === "failed" && r.st.get(k) !== "failed").map(([k]) => k);
  console.log(`${m}: total ${r.total}, passed ${r.passed}, failed ${r.failed}, skipped ${r.pending}; KILLS ${kills.length}, HEALED ${healed.length}`);
  if (m === "BASELINE") for (const [k, s] of r.st) { if (s === "failed") console.log(`   red: ${k.slice(0, 190)}`); }
  for (const k of kills) console.log(`   KILL ${k.slice(0, 190)}`);
  for (const k of healed) console.log(`   HEALED ${k.slice(0, 190)}`);
}
