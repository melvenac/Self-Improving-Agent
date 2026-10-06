// gh-facts.mjs — the GitHub facts collect.mjs records but cannot fetch in CI: each candidate head's CI run, and each
// PR's file list. Run it locally with `gh` authenticated; collect.mjs reads the result (gh-facts.json) and never calls gh.
//
//   checks[<full sha>]   the latest finished "CI" run for that commit: run id, event, the `test` job's conclusion and its
//                        steps; or { none: true, reason } when `gh run list --commit` finds no CI run
//   pr_files[<number>]   the paths `gh pr view <n> --json files` lists
//
// It reads collect.json for the heads, so run collect.mjs first. It makes no Jev call and reads no key.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HERE, writeJson } from "./lib.mjs";

const gh = (args) => JSON.parse(execFileSync("gh", args, { encoding: "utf-8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"] }));
const collected = JSON.parse(readFileSync(join(HERE, "collect.json"), "utf-8"));
const cases = collected.cases.filter((c) => c.head_resolved);

const checks = {};
for (const sha of [...new Set(cases.map((c) => c.candidate_sha))]) {
  try {
    const runs = gh(["run", "list", "--commit", sha, "--json", "databaseId,conclusion,status,workflowName,event,createdAt", "--limit", "30"]).filter((r) => r.workflowName === "CI");
    if (runs.length === 0) { checks[sha] = { none: true, reason: "gh run list --commit found no CI run for this head" }; continue; }
    const done = runs.filter((r) => r.status === "completed").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const run = done[0] ?? runs[0];
    if (run.status !== "completed") { checks[sha] = { none: true, reason: `the newest CI run ${run.databaseId} is ${run.status}, not finished` }; continue; }
    const jobs = gh(["run", "view", String(run.databaseId), "--json", "jobs"]).jobs;
    const test = jobs.find((j) => j.name === "test");
    if (!test) { checks[sha] = { none: true, reason: `CI run ${run.databaseId} has no job named test (jobs: ${jobs.map((j) => j.name).join(", ")})` }; continue; }
    checks[sha] = {
      run_id: run.databaseId, event: run.event, run_conclusion: run.conclusion, runs_found: runs.length,
      test_job: test.conclusion, steps: test.steps.map((s) => ({ name: s.name, conclusion: s.conclusion })),
    };
  } catch (e) {
    checks[sha] = { none: true, reason: `gh failed: ${String(e.stderr ?? e.message).split("\n")[0].slice(0, 160)}` };
  }
}

const pr_files = {};
for (const n of [...new Set(cases.map((c) => c.pr).filter((x) => x !== null))]) {
  try {
    pr_files[String(n)] = gh(["pr", "view", String(n), "--json", "files"]).files.map((f) => f.path);
  } catch {
    // left out: collect.mjs says "no PR file list recorded" for it
  }
}

writeJson("gh-facts.json", { fetched_at: new Date().toISOString(), repo: "melvenac/Self-Improving-Agent", origin_master: collected.origin_master, checks, pr_files });
const found = Object.values(checks).filter((c) => !c.none);
console.log(`gh-facts: ${Object.keys(checks).length} head(s): ${found.length} with a CI run, ${Object.keys(checks).length - found.length} without; ${Object.keys(pr_files).length} PR file list(s)`);
