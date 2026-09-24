// node devcmp7.mjs — QA 96. Apply each local rebuild of a developer mutant to A7's configwatch.ts and compare the result
// byte-for-byte with the developer's branch blob. Also this seat's three CI mutants against ci-mut/.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { MUTANTS } from "./mutants-a7.mjs";
const R = "C:/Users/melve/Worktrees/sia-qa";
const show = (ref) => execFileSync("git", ["-C", R, "show", `${ref}:open-brain/src/harness/configwatch.ts`], { encoding: "utf-8" });
const a7 = show("d223d1d");
const apply = (name) => { let s = a7; for (const e of MUTANTS[name]) { const n = s.split(e.find).length - 1; if (n !== e.count) return `COUNT ${n}`; s = s.split(e.find).join(e.replace); } return s; };
const pairs = { "M-dev7-drifted": "drifted", "M-dev7-facts": "facts", "M-dev7-record": "record", "M-handle-narrow7": "handle", "M-dev7-r50": "r50", "M-dev7-r67": "r67", "M-dev7-trade": "trade", "M-dev7-type": "type" };
for (const [m, b] of Object.entries(pairs)) { const dev = show(`origin/loop/15-slice-3-a7-mut-${b}`); console.log(`${m.padEnd(18)} == dev mut-${b}: ${apply(m) === dev}`); }
for (const m of ["M-R29-both", "M-R67-realpath", "M-R67-nlink"]) console.log(`${m.padEnd(18)} == ci-mut: ${apply(m) === readFileSync(`ci-mut/${m}/configwatch.ts`, "utf-8")}`);
