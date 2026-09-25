// node tabmut7.mjs — QA 96. Per mutant: failed tests NOT failed at BASELINE (the kills), baseline reds that went green,
// unhandled errors. A missing JSON prints MISSING, never zero.
import { existsSync, readFileSync } from "node:fs";
const load = (m) => { const p = `mut7/${m}.rows.json`; if (!existsSync(p)) return null; const r = JSON.parse(readFileSync(p, "utf-8")); const f = new Set(); let n = 0; for (const t of r.testResults) for (const a of t.assertionResults) { n++; if (a.status === "failed") f.add(a.fullName); } return { f, n }; };
const base = load("BASELINE");
const ms = readFileSync("allmut7.log", "utf-8").split("\n").map((l) => l.match(/^(\S+) rows_exit/)?.[1]).filter(Boolean);
for (const m of ms) {
  const r = load(m); if (!r) { console.log(`${m} MISSING`); continue; }
  const kills = [...r.f].filter((x) => !base.f.has(x)); const healed = [...base.f].filter((x) => !r.f.has(x));
  const unh = (readFileSync(`mut7/${m}.rows.out`, "utf-8").match(/Unhandled|onTaskUpdate/g) ?? []).length;
  console.log(`${m.padEnd(20)} kills=${String(kills.length).padStart(2)} healed=${healed.length} total=${r.n} unhandled=${unh}`);
  for (const k of kills) console.log(`     - ${k.replace(/^.*?> /, "").slice(0, 150)}`);
  for (const k of healed) console.log(`     + healed: ${k.slice(0, 120)}`);
}
