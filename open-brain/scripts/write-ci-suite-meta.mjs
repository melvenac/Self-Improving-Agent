#!/usr/bin/env node
/**
 * T-168 CI meta. No hub census. Concurrent jobs only when a GitHub token is set.
 * Usage: node scripts/write-ci-suite-meta.mjs <out.json>
 */
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const out = process.argv[2] ?? "suite-run-meta.json";
const sha = (spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout ?? "").trim() || "unknown";
const timestamp = new Date().toISOString();
const runnerName = process.env.RUNNER_NAME ?? "unknown";
const labels = (process.env.RUNNER_LABELS ?? process.env.RUNNER_OS ?? "unknown").split(",").map((s) => s.trim()).filter(Boolean);
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
let concurrent = "unknown";
if (token && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID) {
  const r = spawnSync(
    "gh",
    ["api", `repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/jobs`, "--jq", ".jobs | length"],
    { encoding: "utf8", env: { ...process.env, GH_TOKEN: token } },
  );
  concurrent = r.status === 0 && (r.stdout ?? "").trim() ? (r.stdout ?? "").trim() : "unknown";
}

const meta = {
  git_sha: sha,
  seat: "ci",
  lease_status: "skipped",
  owner_pid: null,
  owner_source: "none",
  owner_reason: null,
  lease_take_exit: null,
  lease_release_exit: null,
  census: {
    source: "ci",
    timestamp,
    available: false,
    reason: "census unavailable: CI runner has no hub census",
    agents: [],
    busy_sia: [],
    samples: 0,
  },
  vitest: { passed: null, failed: null, errors: null, exit_code: null },
  ci: {
    runner_name: runnerName,
    runner_labels: labels,
    timestamp,
    concurrent_jobs: concurrent,
  },
};
writeFileSync(out, JSON.stringify(meta, null, 2) + "\n");
