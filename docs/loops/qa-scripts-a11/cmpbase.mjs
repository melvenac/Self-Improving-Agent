// node cmpbase.mjs <a.json> <b.json> — QA 130: per-test status change between two vitest JSON reports (same test names).
import { readFileSync } from "node:fs";
const load = (p) => { const j = JSON.parse(readFileSync(p, "utf8")); const m = new Map(); for (const f of j.testResults) for (const a of f.assertionResults) m.set(`${f.name.replace(/^.*tests[\/]harness[\/]/, "")} > ${a.fullName}`, a.status); return m; };
const a = load(process.argv[2]), b = load(process.argv[3]);
let same = 0, onlyA = 0, onlyB = 0;
for (const [k, s] of a) { if (!b.has(k)) { onlyA++; continue; } if (b.get(k) === s) { same++; continue; } console.log(`${s} -> ${b.get(k)}  ${k.slice(0, 200)}`); }
for (const k of b.keys()) if (!a.has(k)) onlyB++;
console.log(`same ${same}, only in first ${onlyA}, only in second ${onlyB}`);
