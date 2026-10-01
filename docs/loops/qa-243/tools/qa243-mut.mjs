// QA 243 mutant runner (from QA 242's qa242-mut.mjs): sequential. For each "<diff>=<test files comma-separated>"
// argument: apply the diff in the tree, run vitest on the named files (constructed env, no API key), record exit
// + failed test titles, revert, and prove the tree is clean again. "SET" names the slice-four set below.
// Usage: node qa243-mut.mjs <tree> <out.json> <diff=files>...
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
const SET = ["s4-g1-records", "s4-g2-key", "s4-g3-done", "s4-g5-qa", "s4-g6-closeout", "s4-g7-merge", "s4-guards", "s4-timeouts", "policies", "t195-plan-gate"]
  .map((f) => `tests/harness/${f}.test.ts`).join(",");
const [tree, out, ...specs] = process.argv.slice(2);
const T = "/home/agents/qa-tmp";
const env = { HOME: "/home/agents", PATH: "/home/agents/.local/bin:/usr/local/bin:/usr/bin:/bin", TMPDIR: T, TEMP: T, TMP: T, CI: "1", KNOWLEDGE_V2_DB: `${T}/qa243-kb.db` };
const git = (...a) => spawnSync("git", ["-C", tree, ...a], { encoding: "utf8", env });
const results = [];
for (const spec of specs) {
  const [diffArg, filesArg] = spec.split("=");
  const diff = diffArg === "NONE" ? null : resolve(diffArg);
  const files = filesArg === "SET" ? SET : filesArg;
  const name = diff ? basename(diff) : "control (no mutant)";
  const status0 = git("status", "--porcelain").stdout;
  if (diff) {
    const ap = git("apply", diff);
    if (ap.status !== 0) { results.push({ name, applied: false, err: ap.stderr }); console.log(`${name}: APPLY FAILED ${ap.stderr}`); continue; }
  }
  const json = `${T}/qa243-mut-${basename(name).replace(/\W+/g, "_")}.json`;
  if (existsSync(json)) unlinkSync(json);
  const tsc = spawnSync("node", ["node_modules/typescript/bin/tsc", "--noEmit"], { cwd: `${tree}/open-brain`, env, encoding: "utf8" });
  const r = spawnSync("node", ["node_modules/vitest/vitest.mjs", "run", ...files.split(","), "--reporter=json", `--outputFile=${json}`, "--testTimeout=120000"],
    { cwd: `${tree}/open-brain`, env, encoding: "utf8", maxBuffer: 1 << 28 });
  let failed = [], passed = 0, total = 0;
  try {
    const j = JSON.parse(readFileSync(json, "utf8"));
    total = j.numTotalTests; passed = j.numPassedTests;
    for (const f of j.testResults) for (const a of f.assertionResults) if (a.status === "failed") failed.push(`${basename(f.name)} :: ${a.fullName}`);
  } catch (e) { failed.push(`(no json: ${e.message})`); }
  const rv = diff ? git("apply", "-R", diff) : { status: 0 };
  const status1 = git("status", "--porcelain").stdout;
  const clean = rv.status === 0 && status1 === status0;
  results.push({ name, files, tsc_exit: tsc.status, exit: r.status, total, passed, failed, reverted_clean: clean });
  console.log(`${name}: tsc ${tsc.status}; vitest exit ${r.status}; ${failed.length} failed of ${total}; reverted clean ${clean}`);
  for (const f of failed) console.log(`    RED: ${f}`);
  if (!clean) { console.log("TREE NOT CLEAN, stopping"); break; }
}
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, JSON.stringify(results, null, 2));
