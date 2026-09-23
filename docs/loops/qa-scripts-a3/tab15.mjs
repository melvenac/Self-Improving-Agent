// node tab15.mjs <label>... — compact per-probe summary of p15-<label>.json. QA session 87.
import { readFileSync } from "node:fs";
const short = (s, n = 160) => (s == null ? s : String(s).replace(/C:\\Users\\melve\\AppData\\Local\\Temp\\/g, "%T%\\").slice(0, n));
for (const label of process.argv.slice(2)) {
  const j = JSON.parse(readFileSync(`p15-${label}.json`, "utf-8"));
  console.log(`\n===== ${label} ${j.tree.split(/[\\/]/).slice(-2).join("/")} at ${j.at}`);
  for (const [probe, R] of Object.entries(j)) {
    if (probe === "tree" || probe === "at") continue;
    const s = R.summary ?? {};
    const line = { probe };
    if (R.probeError) line.probeError = short(R.probeError, 400);
    for (const k of ["planted", "status", "code", "stage", "failedMd", "tokenInLoopResult", "tokenInRepo", "tokenKnownPositive", "thrown"]) if (s[k] !== undefined && s[k] !== null && !(Array.isArray(s[k]) && s[k].length === 0)) line[k] = typeof s[k] === "object" ? short(JSON.stringify(s[k]), 200) : s[k];
    for (const k of Object.keys(R)) if (!["summary", "token", "victimBefore", "victimAfter", "probeError", "configVerdicts", "reason"].includes(k)) line[k] = typeof R[k] === "object" ? short(JSON.stringify(R[k]), 240) : R[k];
    console.log(JSON.stringify(line));
    const cvs = s.configVerdicts ?? R.configVerdicts ?? [];
    for (const v of cvs) if (!v.ok || (v.changes && v.changes.length) || (v.unrestored && v.unrestored.length)) {
      console.log(`   cv[${v.stage}] ok=${v.ok} anc=${short(v.ancestorLink, 80)} changes=${short(JSON.stringify(v.changes), 700)} unrestored=${short(JSON.stringify(v.unrestored), 300)}`);
    }
    if (s.machineFindings && s.machineFindings.length) console.log(`   machine=${short(JSON.stringify(s.machineFindings), 900)}`);
    const f = (s.findings ?? []).filter((x) => /link|junction|symlink|identity|type/i.test(x));
    if (f.length) console.log(`   findings(link)=${short(JSON.stringify(f), 600)}`);
    if (s.reason && s.code) console.log(`   reason=${short(s.reason, 300)}`);
    if (R.reason) console.log(`   R.reason=${short(R.reason, 500)}`);
  }
}
