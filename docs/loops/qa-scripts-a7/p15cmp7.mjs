// node p15cmp7.mjs — QA 96. For each mutant's probe15 output, compare every probe's verdict fields with the unmutated
// A7 run (p15-A7.json): status, code, stage, every *InRecord / victim* boolean, and machine-finding change count.
import { existsSync, readdirSync, readFileSync } from "node:fs";
const base = JSON.parse(readFileSync("p15-A7.json", "utf-8"));
const pick = (o) => { if (!o || typeof o !== "object") return o; const out = {}; for (const [k, v] of Object.entries(o)) { if (["status", "code", "stage", "thrown"].includes(k) || /InRecord|victim|Hash.*Record|unchanged|linkLeft|planted/i.test(k)) out[k] = typeof v === "object" ? JSON.stringify(v) : v; if (k === "machine" || k === "machineConfigFindings") out.mchanges = (v ?? []).filter((f) => f.before !== f.after).length; } return out; };
for (const f of readdirSync("mut7").filter((x) => x.endsWith(".p15.json")).sort()) {
  const m = f.replace(".p15.json", ""); const r = JSON.parse(readFileSync(`mut7/${f}`, "utf-8"));
  const diffs = [];
  for (const [p, v] of Object.entries(r)) { if (p === "tree") continue; const a = JSON.stringify(pick(base[p])), b = JSON.stringify(pick(v)); if (a !== b) diffs.push(`${p}: A7 ${a} | M ${b}`); }
  console.log(`${m.padEnd(18)} probes=${Object.keys(r).length - 1} differing=${diffs.length}`);
  for (const d of diffs) console.log("   " + d.slice(0, 420));
}
