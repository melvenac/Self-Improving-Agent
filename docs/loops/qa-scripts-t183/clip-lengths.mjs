#!/usr/bin/env node
// QA 114 (T-183): how much of each real gap and verified claim survives the clip, on one record.
// Usage: node clip-lengths.mjs <open-brain-dir> <state.json path>
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { readFileSync } from "node:fs";
const { clip } = await import(pathToFileURL(join(process.argv[2], "build", "pipelines", "session-start", "state-render.js")).href);
const s = JSON.parse(readFileSync(process.argv[3], "utf8"));
const kept = (t, lim, w) => { const r = clip(t, lim, w); const m = r.lastIndexOf("… ("); return r === t ? null : r.slice(0, m); };
const rows = [];
for (const g of s.gaps) { const k = kept(g.what, 140, "g"); if (k !== null) rows.push({ id: g.id, full: g.what.length, kept: k.length, text: k }); }
const v = s.verified.slice(-10).map((x) => ({ id: x.id, full: x.claim.length, kept: kept(x.claim, 100, "v") })).filter((x) => x.kept !== null).map((x) => ({ ...x, text: x.kept, kept: x.kept.length }));
const hist = (a) => ({ under_20: a.filter((r) => r.kept < 20).length, under_40: a.filter((r) => r.kept < 40).length, at_limit_no_sentence: a.filter((r) => r.kept >= 139).length, total_clipped: a.length });
console.log(JSON.stringify({ revision: s.revision, gaps: hist(rows), shortest_gaps: rows.sort((a, b) => a.kept - b.kept).slice(0, 8), verified_newest10: hist(v), shortest_verified: v.sort((a, b) => a.kept - b.kept).slice(0, 5) }, null, 2));
