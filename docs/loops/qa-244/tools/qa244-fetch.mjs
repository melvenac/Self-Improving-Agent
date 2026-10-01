// QA 244: copy QA 243's s01-s04 and QA 242's r02/r03 mutants, and QA 243's two tools (renamed), out of the QA
// report branches into docs/loops/qa-244/. Compares r02/r03/s04 with the builder's kept copies at the candidate.
// Usage (from ~/qa-scratch/qa244-wt): node docs/loops/qa-244/tools/qa244-fetch.mjs <candidate tree>
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
const cand = process.argv[2];
const show = (ref) => execFileSync("git", ["show", ref], { encoding: "utf8" });
const D = "docs/loops/qa-244";
for (const d of ["mutants", "tools", "results"]) mkdirSync(`${D}/${d}`, { recursive: true });
const R3 = "origin/qa/s4-step2-r3-report", R2 = "origin/qa/s4-step2-r2-report";
const muts = [
  [R3, "docs/loops/qa-243/mutants/s01-done-gate-read-from-loop-named-records-dir.diff", "qa243-s01-done-gate-read-from-loop-named-records-dir.diff", null],
  [R3, "docs/loops/qa-243/mutants/s02-done-gate-glob-over-docs-loops.diff", "qa243-s02-done-gate-glob-over-docs-loops.diff", null],
  [R3, "docs/loops/qa-243/mutants/s03-done-gate-runner-named-records-only.diff", "qa243-s03-done-gate-runner-named-records-only.diff", null],
  [R3, "docs/loops/qa-243/mutants/s04-done-gate-read-from-committed-records.diff", "qa243-s04-done-gate-read-from-committed-records.diff", "qa243-s04.diff"],
  [R2, "docs/loops/qa-242/mutants/r02-done-gate-wired-by-spread.diff", "qa242-r02-done-gate-wired-by-spread.diff", "qa242-r02-done-gate-wired-by-spread.diff"],
  [R2, "docs/loops/qa-242/mutants/r03-done-gate-wired-inside-prepare.diff", "qa242-r03-done-gate-wired-inside-prepare.diff", "qa242-r03-done-gate-wired-inside-prepare.diff"],
];
for (const [ref, src, dst, kept] of muts) {
  const body = show(`${ref}:${src}`);
  writeFileSync(`${D}/mutants/${dst}`, body);
  const same = kept ? readFileSync(`${cand}/docs/loops/loop-15-slice-4/mutants/${kept}`, "utf8") === body : null;
  console.log(`${dst}: from ${ref}:${src}${kept ? `; identical to builder-kept ${kept}: ${same}` : ""}`);
}
const tool = (src, dst, from, to) => {
  let t = show(`${R3}:${src}`).replaceAll("qa243", "qa244").replace(/^\/\/ QA 243 (mutant )?runner \(from QA 242's qa242-(mut|run)\.mjs\)/, (_m, a, b) => `// QA 244 ${a ?? ""}runner (from QA 243's qa243-${b}.mjs)`);
  writeFileSync(`${D}/tools/${dst}`, t);
  console.log(`${dst}: ${t.split("\n")[0]}`);
};
tool("docs/loops/qa-243/tools/qa243-mut.mjs", "qa244-mut.mjs");
tool("docs/loops/qa-243/tools/qa243-run.mjs", "qa244-run.mjs");
