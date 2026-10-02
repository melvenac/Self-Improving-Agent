// QA 246: copies QA 241's harness (docs/loops/qa-241/ on origin/qa/t194-r6-report, 8d69bed5) into qa-246/qa241/,
// re-pointing ONLY path constants: qa241-cand -> qa246-cand (the r7 candidate), every other qa241-<x> -> qa246-r<x>,
// and the docs/loops/qa-241 self-path -> docs/loops/qa-246/qa241. Prints the changed-line count per file.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = "C:/qa-scratch/qa246-qa241/docs/loops/qa-241";
const DST = "C:/qa-scratch/qa246-wt/docs/loops/qa-246/qa241";
const map = (s) =>
  s
    .replace(/qa241-cand/g, "qa246-cand")
    .replace(/qa241-wt\/docs\/loops\/qa-241/g, "qa246-wt/docs/loops/qa-246/qa241")
    .replace(/qa241-wt/g, "qa246-wt")
    .replace(/qa241-mut/g, "qa246-mut")
    .replace(/qa241-(?!wt|cand|mut)/g, "qa246-r");
function walk(rel) {
  for (const e of readdirSync(join(SRC, rel))) {
    const r = rel ? `${rel}/${e}` : e;
    if (statSync(join(SRC, r)).isDirectory()) {
      if (/out$/.test(e)) continue; // raw outputs from QA 241 are not inputs
      mkdirSync(join(DST, r), { recursive: true });
      walk(r);
      continue;
    }
    if (!/\.mjs$/.test(e)) continue;
    const a = readFileSync(join(SRC, r), "utf8");
    const b = map(a);
    const al = a.split("\n"), bl = b.split("\n");
    const changed = al.filter((l, k) => l !== bl[k]).length;
    writeFileSync(join(DST, r), b);
    console.log(`${String(changed).padStart(2)} changed  ${r}`);
  }
}
mkdirSync(DST, { recursive: true });
walk("");
