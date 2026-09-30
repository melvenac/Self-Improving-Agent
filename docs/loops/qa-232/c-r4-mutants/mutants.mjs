// QA 232: re-apply each mutant's diff (its branch tip vs its parent) onto the candidate c339427 in a
// dedicated worktree, assert the edit landed, typecheck, and run the focused test files. Writes
// C:/qa-tmp/mutants/<name>.log and prints a summary. Usage: node mutants.mjs [name...]
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const WT = "C:/qa-scratch/qa232-mut";
const CAND = "c33942725c73b1aa91ceb46458e6ea7d11c70dcd";
const env = { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" };
const git = (...a) => execFileSync("git", ["-C", WT, ...a], { encoding: "utf8", env }).trim();
const ALL = {
  cc12a: "origin/loop/15-slice-3-candidate-c-r4-mut-cc12a",
  cc12b: "origin/loop/15-slice-3-candidate-c-r4-mut-cc12b",
  cc22: "origin/loop/15-slice-3-candidate-c-r4-mut-cc22",
  cc56: "origin/loop/15-slice-3-candidate-c-r4-mut-cc56",
  cc131: "origin/loop/15-slice-3-candidate-c-r4-mut-cc131",
  cc132: "origin/loop/15-slice-3-candidate-c-r4-mut-cc132",
  cc17: "origin/loop/15-slice-3-candidate-c-r4-mut-cc17",
  fd6c310: "fd6c3109c278ee03cbd9ca1b281355aa2861c7f6",
};
// QA's own mutants are local branches qa/c-r4-mut-*; their parent is c339427.
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ALL);
const TESTS = (process.env.QA_TESTS ?? "tests/harness/shadow-merge.test.ts tests/harness/policies.test.ts").split(" ");
mkdirSync("C:/qa-tmp/mutants", { recursive: true });
const summary = [];
for (const name of names) {
  const ref = ALL[name] ?? `qa/c-r4-mut-${name}`;
  git("reset", "--hard", "-q", CAND);
  git("clean", "-fdq", "-e", "node_modules", "-e", "open-brain/node_modules");
  const tip = git("rev-parse", ref);
  const parent = git("rev-parse", `${ref}^`);
  const patch = execFileSync("git", ["-C", WT, "diff", "--binary", parent, tip, "--", "open-brain/src", "open-brain/tests"], { encoding: "utf8" });
  let applied = true;
  try { execFileSync("git", ["-C", WT, "apply", "--3way", "-"], { input: patch, encoding: "utf8", env }); }
  catch (e) { applied = false; }
  const landed = git("diff", "--stat", CAND);
  const tsc = spawnSync("node", ["node_modules/typescript/bin/tsc", "--noEmit"], { cwd: `${WT}/open-brain`, env, encoding: "utf8" });
  const vt = spawnSync("node", ["node_modules/vitest/vitest.mjs", "run", ...TESTS], { cwd: `${WT}/open-brain`, env, encoding: "utf8", maxBuffer: 1 << 28 });
  const out = (vt.stdout ?? "") + (vt.stderr ?? "");
  writeFileSync(`C:/qa-tmp/mutants/${name}.log`, `ref ${ref}\ntip ${tip}\nparent ${parent}\napplied ${applied}\n${landed}\ntsc ${tsc.status}\n${tsc.stdout}${tsc.stderr}\n${out}`);
  const failed = [...out.matchAll(/FAIL .*?> (.*)$/gm)].map((m) => m[1].replace(/\x1b\[[0-9;]*m/g, ""));
  const tests = (out.replace(/\x1b\[[0-9;]*m/g, "").match(/Tests\s+(.*)/) ?? [])[1];
  summary.push({ name, tip, parent, applied, landed: landed.split("\n").pop(), tsc: tsc.status, vitest: vt.status, tests, failed: [...new Set(failed)] });
  console.log(JSON.stringify(summary[summary.length - 1], null, 1));
}
git("reset", "--hard", "-q", CAND);
writeFileSync(`C:/qa-tmp/mutants/summary-${Date.now()}.json`, JSON.stringify(summary, null, 1));
