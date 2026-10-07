// QA 291 row 2: per run, headSha/branch/conclusion/jobs and the failing test names (gh read-only).
// Adapted from QA 289's ci-reds.mjs.
import { execFileSync } from "node:child_process";
const runs = process.argv.slice(2);
for (const r of runs) {
  const meta = JSON.parse(execFileSync("gh", ["run", "view", r, "--json", "headSha,headBranch,conclusion,status,jobs"], { encoding: "utf8" }));
  console.log(`=== run ${r} branch=${meta.headBranch} head=${meta.headSha} ${meta.status}/${meta.conclusion}`);
  console.log("    jobs: " + meta.jobs.map((j) => `${j.name}=${j.conclusion}`).join(", "));
  if (meta.conclusion === "success") continue;
  let log = "";
  try { log = execFileSync("gh", ["run", "view", r, "--log-failed"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }); }
  catch (e) { log = String(e.stdout ?? ""); }
  const lines = log.split(/\r?\n/).map((l) => l.replace(/^.*?\d{4}-\d\d-\d\dT[\d:.]+Z\s?/, "").replace(/\x1b\[[0-9;]*m/g, ""));
  const hits = [...new Set(lines.filter((l) => /FAIL\s|Test Files\s|Tests\s+\d|^\s*×/.test(l)))];
  console.log(hits.slice(0, 40).join("\n"));
}
