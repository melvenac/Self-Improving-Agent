// QA 240: ruling 4. Apply threshold-scan.ts's own regions and regex (copied) and report where the two QA-score
// functions sit; and run the same regex over the new, unscanned slice-four source files.
import { readFileSync } from "node:fs";
const SRC = "/home/agents/qa-scratch/qa240-cand/open-brain/src/harness";
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const lits = (s) => [...strip(s).matchAll(/(?<![\w.])\d+\.\d+(?![\w.])/g)].map((m) => m[0]);
const pol = readFileSync(`${SRC}/policies.ts`, "utf8");
const at = pol.lastIndexOf("Applying a policy");
const region = pol.slice(at);
console.log(`policies.ts region starts at char ${at}; decideQaScore inside: ${region.includes("export function decideQaScore(")}; decideDoneGate inside: ${region.includes("export function decideDoneGate(")}`);
console.log(`policies.ts region literals: ${JSON.stringify(lits(region))}`);
const gate = readFileSync(`${SRC}/gate.ts`, "utf8");
console.log(`gate.ts scanned whole; buildQaScoreQuestions present: ${gate.includes("export function buildQaScoreQuestions(")}; literals: ${JSON.stringify(lits(gate))}`);
for (const f of ["shadow-qa.ts", "shadow-gates.ts", "closeout-tables.ts", "gate-records.ts", "brief-plan-gate.ts"]) {
  console.log(`UNSCANNED ${f}: literals ${JSON.stringify(lits(readFileSync(`${SRC}/${f}`, "utf8")))}`);
}
