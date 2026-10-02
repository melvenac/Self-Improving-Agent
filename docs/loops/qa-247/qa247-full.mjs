// QA 247: full suite once at the candidate, json reporter.
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, rmSync } from "node:fs";
const OB = "/home/agents/qa-scratch/qa247-cand/open-brain";
const jf = "/home/agents/qa-scratch/qa247-out/full.vitest.json";
if (existsSync(jf)) rmSync(jf);
const t0 = Date.now();
const r = spawnSync("npx", ["vitest", "run", "--reporter=json", `--outputFile=${jf}`], { cwd: OB, env: { ...process.env, TMPDIR: "/home/agents/qa-tmp" }, encoding: "utf8", maxBuffer: 1 << 28, timeout: 1_500_000 });
const j = JSON.parse(readFileSync(jf, "utf8"));
const failed = [];
for (const f of j.testResults) {
  if (f.status === "failed" && !f.assertionResults.some((a) => a.status === "failed")) failed.push(`FILE ${f.name}: ${(f.message ?? "").slice(0, 300)}`);
  for (const a of f.assertionResults) if (a.status === "failed") failed.push(`${f.name.split("/").pop()} :: ${a.title}`);
}
console.log(JSON.stringify({ exit: r.status, ms: Date.now() - t0, files: j.numTotalTestSuites, passed: j.numPassedTests, failed: j.numFailedTests, skipped: j.numPendingTests, todo: j.numTodoTests, failedList: failed, stderrTail: r.stderr.split("\n").filter((l) => /error|Error/.test(l)).slice(-10) }, null, 1));
