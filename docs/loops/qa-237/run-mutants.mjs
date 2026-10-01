// QA 237 mutant runner. SEQUENTIAL (laptop memory), local only (T-207), in the scratch worktree C:/qa-scratch/qa237-mut
// at the candidate. For each diff: git apply, `tsc --noEmit`, `vitest run tests/planner-hook` (the tests run the hook
// from src via tsx, so no rebuild is needed), record, restore. For QA's own mutants it ALSO builds the mutant and runs
// the QA 237 generator for that property against the mutant's built CLI, so QA's evidence is shown to kill it too.
// Usage: node run-mutants.mjs <out.json> <diff dir>...
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { join, basename } from "node:path";

const WT = "C:/qa-scratch/qa237-mut";
const OB = `${WT}/open-brain`;
const HERE = "C:/qa-scratch/qa237-wt/docs/loops/qa-237";
const argv = process.argv.slice(2);
const SLICE = argv[0]?.startsWith("--slice=") ? argv.shift().slice(8) : null;
const [OUT, ...DIRS] = argv;
const env = { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" };
const git = (...a) => execFileSync("git", ["-C", WT, ...a], { encoding: "utf8" });
const run = (cmd, args, cwd = OB, extraEnv = {}) => spawnSync(cmd, args, { cwd, env: { ...env, ...extraEnv }, encoding: "utf8", shell: true, maxBuffer: 1 << 28 });
if (git("status", "--porcelain", "--", "open-brain/src").trim()) throw new Error("dirty src in mutant worktree");

const GEN_FOR = { "qa-p1": "gen-p1.mjs", "qa-p2-": "gen-p2.mjs", "qa-p2b": "gen-p2b.mjs", "qa-p3": "gen-p3.mjs" };
const baseline = {};
for (const g of Object.values(GEN_FOR)) baseline[g] = JSON.parse(readFileSync(join(HERE, g.replace(".mjs", "-cand.json")), "utf8")).summary.agree;

// --slice=from:to (first argument) runs only that slice of the sorted list: one sequential pass is split into batches because a
// single tool call is capped at 10 minutes. The batches run back to back on the same tree, never in parallel.
const all = DIRS.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".diff")).sort().map((f) => join(d, f)));
const [from, to] = (SLICE ?? `0:${all.length}`).split(":").map(Number);
const diffs = all.slice(from, to);
const results = [];
for (const diff of diffs) {
  const name = basename(diff, ".diff");
  const t0 = Date.now();
  let row = { name, source: diff.includes("qa-237") ? "QA 237" : "Forge" };
  try {
    git("apply", "--", diff);
    const tsc = run("npx", ["tsc", "--noEmit"]);
    row.typecheckExit = tsc.status;
    if (tsc.status !== 0) row.typecheckError = (tsc.stdout + tsc.stderr).split("\n").filter((l) => /error TS/.test(l)).slice(0, 3);
    const tests = run("npx", ["vitest", "run", "tests/planner-hook", "--reporter=json"]);
    row.testExit = tests.status;
    try { const j = JSON.parse(tests.stdout.slice(tests.stdout.indexOf("{"))); row.failedTests = j.numFailedTests; row.totalTests = j.numTotalTests; } catch { row.failedTests = null; }
    row.killedByForgeTests = tests.status !== 0;
    const genKey = Object.keys(GEN_FOR).find((k) => name.startsWith(k));
    if (row.source === "QA 237" && genKey) {
      const b = run("npm", ["run", "build"]);
      row.buildExit = b.status;
      const gen = GEN_FOR[genKey];
      const tmp = join(mkdtempSync("C:/qa-tmp/qa237-"), "g.json");
      run("node", [join(HERE, gen), tmp], HERE, { QA237_BUILD: `${OB}/build`, QA237_FX: "C:/qa-scratch/qa237-fx-mut" });
      const agree = JSON.parse(readFileSync(tmp, "utf8")).summary.agree;
      row.qaGenerator = { gen, agreeOnCandidate: baseline[gen], agreeOnMutant: agree, killed: agree !== baseline[gen] };
    }
  } catch (e) {
    row.error = String(e.message).slice(0, 300);
  } finally {
    git("checkout", "--", "open-brain/src");
  }
  row.seconds = Math.round((Date.now() - t0) / 1000);
  results.push(row);
  console.log(`${row.killedByForgeTests ? "KILLED  " : "SURVIVED"} ${name} tsc=${row.typecheckExit} tests=${row.testExit} failed=${row.failedTests}${row.qaGenerator ? ` qaGen=${row.qaGenerator.agreeOnCandidate}->${row.qaGenerator.agreeOnMutant}` : ""}${row.error ? ` ERROR ${row.error}` : ""}`);
  writeFileSync(OUT, JSON.stringify(results, null, 1));
}
const s = results.filter((r) => !r.killedByForgeTests);
console.log(`${results.length - s.length} of ${results.length} killed by the planner-hook tests; survivors: ${s.map((r) => r.name).join(", ") || "none"}; typecheck failures: ${results.filter((r) => r.typecheckExit !== 0).map((r) => r.name).join(", ") || "none"}`);
