// Runs every mutant diff in this folder against the planner-hook tests, one at a time, locally (D-061: no CI).
// For each: apply the diff, `tsc --noEmit` (a mutant that does not typecheck proves nothing), run the planner-hook
// tests, record exit codes and the failing-test count, restore the tree. Refuses to start on a dirty source tree.
// Writes results.json beside the diffs. A mutant is KILLED when the tests exit non-zero; one that survives is a hole.
//   (from open-brain/, after `npm ci` and `npm run build`)  node ../docs/loops/t194-r6/mutants/run-mutants.mjs [name ...]
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MUTANTS } from "./specs.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const ob = join(root, "open-brain");
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" });
const only = new Set(process.argv.slice(2));

if (git("status", "--porcelain", "--", "open-brain/src").trim()) {
  console.error("refusing: uncommitted changes under open-brain/src");
  process.exit(1);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const run = (args) => spawnSync(npx, args, { cwd: ob, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 1 << 28 });

const results = [];
for (const m of MUTANTS) {
  if (only.size && !only.has(m.name)) continue;
  const diff = join(here, `${m.name}.diff`);
  if (!existsSync(diff)) {
    results.push({ name: m.name, clause: m.clause, error: "diff missing" });
    continue;
  }
  let row;
  try {
    git("apply", "--", diff);
    const tsc = run(["tsc", "--noEmit"]);
    const tests = run(["vitest", "run", "tests/planner-hook", "--reporter=json"]);
    let failed = null;
    try {
      const j = JSON.parse(tests.stdout.slice(tests.stdout.indexOf("{")));
      failed = j.numFailedTests;
    } catch {
      /* leave null: the exit code still decides */
    }
    row = { name: m.name, clause: m.clause, typecheckExit: tsc.status, testExit: tests.status, failedTests: failed, killed: tests.status !== 0 };
  } finally {
    git("checkout", "--", "open-brain/src");
  }
  results.push(row);
  console.log(`${row.killed ? "KILLED  " : "SURVIVED"} ${m.name}  tsc=${row.typecheckExit} tests=${row.testExit} failed=${row.failedTests}`);
}
writeFileSync(join(here, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
const survivors = results.filter((r) => !r.killed);
console.log(`${results.length - survivors.length} of ${results.length} killed; ${survivors.length} survived`);
process.exit(survivors.length ? 1 : 0);
