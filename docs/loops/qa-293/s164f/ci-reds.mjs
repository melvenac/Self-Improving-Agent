// QA 293 (copied from QA 292's s164e script, re-rooted to C:/qa-tmp/qa293; see below). QA 292 row 2: per run, headSha/branch/conclusion/jobs and the failing test names (gh read-only).
// Copied from QA 291's ci-reds.mjs; only this header differs.
import { execFileSync } from "node:child_process";
const runs = process.argv.slice(2);
for (const r of runs) {
  const meta = JSON.parse(execFileSync("gh", ["run", "view", r, "-R", "melvenac/Self-Improving-Agent", "--json", "headSha,headBranch,conclusion,status,jobs"], { encoding: "utf8" }));
  console.log(`=== run ${r} branch=${meta.headBranch} head=${meta.headSha} ${meta.status}/${meta.conclusion}`);
  console.log("    jobs: " + meta.jobs.map((j) => `${j.name}=${j.conclusion}`).join(", "));
  if (meta.conclusion === "success") continue;
  let log = "";
  try { log = execFileSync("gh", ["run", "view", r, "-R", "melvenac/Self-Improving-Agent", "--log-failed"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }); }
  catch (e) { log = String(e.stdout ?? ""); }
  const lines = log.split(/\r?\n/).map((l) => l.replace(/^.*?\d{4}-\d\d-\d\dT[\d:.]+Z\s?/, "").replace(/\x1b\[[0-9;]*m/g, ""));
  const hits = [...new Set(lines.filter((l) => /FAIL\s|Test Files\s|Tests\s+\d|^\s*×/.test(l)))];
  console.log(hits.slice(0, 40).join("\n"));
}
