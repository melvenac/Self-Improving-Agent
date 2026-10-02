// QA 246: ONE sequential mutant pass in C:/qa-scratch/qa246-mut (a worktree at the candidate 71ea3101, npm ci + build done).
// Specs: Forge's 139 (docs/loops/t194-r7/mutants/specs.mjs, read from the CANDIDATE tree) followed by QA 246's own (qa-mutants.mjs).
// For each mutant: apply the single find/replace edit (refused unless `find` occurs exactly once), `tsc --noEmit`, then
// `vitest run tests/planner-hook --reporter=json` (vitest defaults, as QA 241), record exit codes and the failed count,
// restore with `git checkout -- open-brain/src`. Refuses to start on a dirty source tree. Free RAM is recorded per mutant.
// A slice is a [from, to) index range so a long pass can be split across back-to-back tool calls in the SAME tree;
// rows are appended to out/mutants-pass.jsonl.
//   node run-mutants.mjs <from> <to>          node run-mutants.mjs --list
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { freemem } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = "C:/qa-scratch/qa246-mut";
const OB = join(ROOT, "open-brain");
const OUT = "C:/qa-scratch/qa246-wt/docs/loops/qa-246/out/mutants-pass.jsonl";
const { MUTANTS: FORGE } = await import(pathToFileURL(join(ROOT, "docs/loops/t194-r7/mutants/specs.mjs")).href);
const { QA_MUTANTS } = await import(pathToFileURL("C:/qa-scratch/qa246-wt/docs/loops/qa-246/qa-mutants.mjs").href);
const ALL = [...FORGE.map((m) => ({ ...m, owner: "forge" })), ...QA_MUTANTS.map((m) => ({ ...m, owner: "qa246" }))];

if (process.argv[2] === "--list") {
  ALL.forEach((m, k) => console.log(k, m.owner, m.name));
  process.exit(0);
}
const from = Number(process.argv[2] ?? 0);
const to = Math.min(Number(process.argv[3] ?? ALL.length), ALL.length);
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" });
if (git("status", "--porcelain", "--", "open-brain/src").trim()) {
  console.error("refusing: uncommitted changes under open-brain/src");
  process.exit(1);
}
const env = { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" };
for (const k of Object.keys(env)) if (/TYPESAFE|^GH_TOKEN$|^GITHUB_TOKEN$/i.test(k)) delete env[k];
const run = (args) => spawnSync("npx", args, { cwd: OB, env, encoding: "utf8", shell: true, maxBuffer: 1 << 28 });

for (let k = from; k < to; k++) {
  const m = ALL[k];
  const rel = `open-brain/src/planner-hook/${m.file}`;
  const path = join(ROOT, rel);
  const t0 = Date.now();
  const src = readFileSync(path, "utf8");
  const count = src.split(m.find).length - 1;
  let row;
  if (count !== 1) {
    row = { k, owner: m.owner, name: m.name, clause: m.clause, error: `find occurs ${count} times` };
  } else {
    try {
      writeFileSync(path, src.replace(m.find, () => m.replace));
      const freeMB = Math.round(freemem() / 1048576);
      const tsc = run(["tsc", "--noEmit"]);
      const tests = run(["vitest", "run", "tests/planner-hook", "--reporter=json"]);
      let failed = null, total = null;
      try {
        const j = JSON.parse(tests.stdout.slice(tests.stdout.indexOf("{")));
        failed = j.numFailedTests;
        total = j.numTotalTests;
      } catch { /* exit code still decides */ }
      row = { k, owner: m.owner, name: m.name, clause: m.clause, typecheckExit: tsc.status, testExit: tests.status, failedTests: failed, totalTests: total, killed: tests.status !== 0, freeMB, secs: Math.round((Date.now() - t0) / 1000) };
    } finally {
      git("checkout", "--", "open-brain/src");
    }
  }
  appendFileSync(OUT, `${JSON.stringify(row)}\n`);
  console.log(`${row.error ? "ERROR   " : row.killed ? "KILLED  " : "SURVIVED"} #${k} ${m.name} tsc=${row.typecheckExit} tests=${row.testExit} failed=${row.failedTests}/${row.totalTests} free=${row.freeMB}MB ${row.secs}s ${row.error ?? ""}`);
}
