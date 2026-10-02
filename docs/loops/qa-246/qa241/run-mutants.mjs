// QA 241 mutant runner. SEQUENTIAL, local only, in C:/qa-scratch/qa246-mut at the candidate. For each diff:
// git apply, tsc --noEmit, vitest run tests/planner-hook (tests run the hook from src via tsx), record, restore.
// One pass is split into slices (a tool call is capped), run back to back on the same tree. --slice=from:to
// Usage: node run-mutants.mjs [--slice=from:to] <out.json> <diffDir>...
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const WT = "C:/qa-scratch/qa246-mut";
const OB = `${WT}/open-brain`;
const argv = process.argv.slice(2);
const SLICE = argv[0]?.startsWith("--slice=") ? argv.shift().slice(8) : null;
const [OUT, ...DIRS] = argv;
const env = { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" };
const git = (...a) => execFileSync("git", ["-C", WT, ...a], { encoding: "utf8" });
const run = (cmd, args) => spawnSync(cmd, args, { cwd: OB, env, encoding: "utf8", shell: true, maxBuffer: 1 << 28 });
if (git("status", "--porcelain", "--", "open-brain/src").trim()) throw new Error("dirty src in mutant worktree");

const all = DIRS.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".diff")).sort().map((f) => join(d, f)));
const [from, to] = (SLICE ?? `0:${all.length}`).split(":").map(Number);
const diffs = all.slice(from, to);
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const results = prev.filter((r) => !diffs.some((d) => basename(d, ".diff") === r.name));
for (const diff of diffs) {
  const name = basename(diff, ".diff");
  const t0 = Date.now();
  const row = { name };
  try {
    git("apply", "--whitespace=nowarn", "--", diff);
    const tsc = run("npx", ["tsc", "--noEmit"]);
    row.typecheckExit = tsc.status;
    if (tsc.status !== 0) row.typecheckError = (tsc.stdout + tsc.stderr).split("\n").filter((l) => /error TS/.test(l)).slice(0, 2);
    const tests = run("npx", ["vitest", "run", "tests/planner-hook", "--reporter=json"]);
    row.testExit = tests.status;
    try { const j = JSON.parse(tests.stdout.slice(tests.stdout.indexOf("{"))); row.failedTests = j.numFailedTests; row.totalTests = j.numTotalTests; } catch { row.failedTests = null; }
    row.killed = tests.status !== 0 && row.failedTests > 0;
  } catch (e) {
    row.error = String(e.message).slice(0, 300);
    row.killed = false;
  } finally {
    git("checkout", "--", "open-brain/src");
  }
  row.seconds = Math.round((Date.now() - t0) / 1000);
  results.push(row);
  console.log(`${row.killed ? "KILLED  " : "SURVIVED"} ${name} tsc=${row.typecheckExit} tests=${row.testExit} failed=${row.failedTests} (${row.seconds}s)${row.error ? " ERR " + row.error : ""}`);
  writeFileSync(OUT, JSON.stringify(results, null, 1));
}
const done = results.filter((r) => diffs.some((d) => basename(d, ".diff") === r.name));
const surv = done.filter((r) => !r.killed);
const tcf = done.filter((r) => r.typecheckExit !== 0);
console.log(`slice ${from}:${to} — ${done.length - surv.length}/${done.length} killed; survivors: ${surv.map((r) => r.name).join(", ") || "none"}; typecheck!=0: ${tcf.map((r) => r.name).join(", ") || "none"}`);
console.log(`TOTAL recorded: ${results.length}; killed ${results.filter((r) => r.killed).length}; survived ${results.filter((r) => !r.killed).map((r) => r.name).join(", ") || "none"}`);
