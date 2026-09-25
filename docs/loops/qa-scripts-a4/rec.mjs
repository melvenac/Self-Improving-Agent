// node rec.mjs <label> <probe>... — record text (config verdicts, machine findings, reason) per probe. QA session 89.
import { readFileSync } from "node:fs";
const [label, ...probes] = process.argv.slice(2);
const j = JSON.parse(readFileSync(`p15-${label}.json`, "utf-8"));
const T = String.raw`C:\Users\melve\AppData\Local\Temp\\`;
const sh = (s) => String(s).split(T).join("%T%\\").split(T.replace(/\\/g, "\\\\")).join("%T%\\");
for (const p of probes) {
  const R = j[p]; const s = R.summary ?? {};
  console.log(`## ${p}`);
  for (const v of (s.configVerdicts ?? R.configVerdicts ?? []).filter((v) => !v.ok)) {
    console.log(`  cv[${v.stage}] changes=${sh(JSON.stringify(v.changes)).slice(0, 700)}`);
    console.log(`     unrestored=${sh(JSON.stringify(v.unrestored)).slice(0, 500)} anc=${sh(v.ancestorLink)}`);
  }
  const mf = R.byStage ?? (s.machineFindings ?? []).map((f) => ({ stage: f.stage, before: f.before, after: f.after }));
  if (mf.length) console.log(`  machine=${sh(JSON.stringify(mf)).slice(0, 900)}`);
  const rs = s.reason ?? R.reason; if (rs) console.log(`  reason=${sh(rs).slice(0, 900)}`);
}
