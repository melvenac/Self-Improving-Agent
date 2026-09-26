// QA 125: read tcm runs per test. For each run id: branch, sha, conclusion, runner, vitest totals, every failed test.
// usage: node ci-read.mjs <run-id>...
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("C:/qa-scratch/qa125/ci", { recursive: true });
const gh = (...a) => execFileSync("gh", [...a, "--repo", "melvenac/Self-Improving-Agent"], { encoding: "utf8", maxBuffer: 1 << 28 });
for (const id of process.argv.slice(2)) {
  const meta = JSON.parse(gh("run", "view", id, "--json", "headBranch,headSha,conclusion"));
  const raw = gh("run", "view", id, "--log");
  writeFileSync(`C:/qa-scratch/qa125/ci/${id}.log`, raw);
  const t = raw.replace(/\x1b\[[0-9;]*m/g, "").replace(/\^\[\[[0-9;]*m/g, "");
  const runner = (t.match(/Runner name: '([^']*)'/) || [])[1];
  const tests = [...t.matchAll(/ Tests +(.*\(\d+\))/g)].map((m) => m[1]).pop();
  const files = [...t.matchAll(/Test Files +(.*\(\d+\))/g)].map((m) => m[1]).pop();
  const failed = [...new Set([...t.matchAll(/ FAIL +(tests\/[^\n]+)/g)].map((m) => m[1].trim()))];
  console.log(`${id} ${meta.headBranch} ${meta.headSha.slice(0, 7)} ${meta.conclusion} | runner ${runner} | tests ${tests} | files ${files}`);
  for (const f of failed) console.log(`    FAIL ${f}`);
}
