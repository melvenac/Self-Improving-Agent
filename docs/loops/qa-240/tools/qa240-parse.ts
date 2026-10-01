// QA 240: S4-1. parseDeclared from origin/master's declared.ts on the criteria file at master, plus the known positive.
import { readFileSync } from "node:fs";
import { parseDeclared } from "/home/agents/qa-scratch/qa240-wt/open-brain/src/harness/declared.ts";
const text = readFileSync("/home/agents/qa-scratch/qa240-wt/docs/loops/loop-15-slice-4-criteria.md", "utf8");
console.log(JSON.stringify(parseDeclared(text)));
try {
  console.log(JSON.stringify(parseDeclared(text.replace("\n[out-of-scope]", "\n\n[out-of-scope]"))));
} catch (e) {
  console.log(`known positive: ${(e as Error).name}: ${(e as Error).message}`);
}
const fence = text.slice(text.indexOf("```qa-declared"), text.indexOf("```", text.indexOf("```qa-declared") + 5) + 3);
try {
  console.log(`two fences -> ${JSON.stringify(parseDeclared(text + "\n" + fence + "\n"))}`);
} catch (e) {
  console.log(`known positive (second fence): ${(e as Error).name}: ${(e as Error).message}`);
}
console.log(`fences in file: ${(text.match(/^```qa-declared/gm) ?? []).length}`);
