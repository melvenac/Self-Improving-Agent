// QA 242: copy QA 240's 13 original mutants from origin/qa/s4-step2-report into mutants/qa240/, and compare
// the six the builder kept (docs/loops/loop-15-slice-4/mutants/qa240-q*.diff at the candidate) byte for byte.
// Usage (from ~/qa-scratch/qa242-wt): node docs/loops/qa-242/tools/qa242-fetch-mutants.mjs <candidate tree>
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const cand = process.argv[2];
const REF = "origin/qa/s4-step2-report";
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 26 });
const out = "docs/loops/qa-242/mutants/qa240";
mkdirSync(out, { recursive: true });
const names = git("ls-tree", "--name-only", `${REF}:docs/loops/qa-240/mutants`).trim().split("\n");
for (const n of names) writeFileSync(join(out, n), git("show", `${REF}:docs/loops/qa-240/mutants/${n}`));
console.log(`copied ${names.length}: ${names.join(" ")}`);
const kept = readdirSync(join(cand, "docs/loops/loop-15-slice-4/mutants")).filter((f) => f.startsWith("qa240-"));
for (const k of kept) {
  const orig = k.replace(/^qa240-/, "");
  const a = readFileSync(join(cand, "docs/loops/loop-15-slice-4/mutants", k), "utf8");
  const b = readFileSync(join(out, orig), "utf8");
  console.log(`${k} vs QA 240 ${orig}: ${a === b ? "IDENTICAL" : "DIFFERS"}`);
}
