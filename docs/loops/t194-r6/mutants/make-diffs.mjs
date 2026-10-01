// Writes one <name>.diff per mutant in specs.mjs. Applies the single edit to a clean source file, takes
// `git diff` of it, and restores the file from git. Needs a clean tree for the files it touches; it refuses otherwise,
// so it can never overwrite uncommitted work. No npm, no tsc, no test run.
//   node docs/loops/t194-r6/mutants/make-diffs.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MUTANTS } from "./specs.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const dir = "open-brain/src/planner-hook";
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" });

const dirty = git("status", "--porcelain", "--", dir).trim();
if (dirty) {
  console.error(`refusing: uncommitted changes under ${dir}:\n${dirty}`);
  process.exit(1);
}

let bad = 0;
for (const m of MUTANTS) {
  const rel = `${dir}/${m.file}`;
  const path = join(root, rel);
  const src = readFileSync(path, "utf8");
  const count = src.split(m.find).length - 1;
  if (count !== 1) {
    console.error(`FAIL ${m.name}: "${m.find.slice(0, 60)}" occurs ${count} times in ${m.file}`);
    bad++;
    continue;
  }
  writeFileSync(path, src.replace(m.find, () => m.replace));
  try {
    const diff = git("diff", "--", rel);
    writeFileSync(join(here, `${m.name}.diff`), diff);
    console.log(`ok   ${m.name}  (${m.clause})  ${diff.split("\n").length} diff lines`);
  } finally {
    git("checkout", "--", rel);
  }
}
if (bad) process.exit(1);
console.log(`wrote ${MUTANTS.length} diffs`);
