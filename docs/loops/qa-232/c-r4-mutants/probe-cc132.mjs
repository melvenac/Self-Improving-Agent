// QA 232, CC-13.2: plant each case in a scratch git repo, using the CANDIDATE BUILD's CLI to prepare/decide
// and its exported checkShadowMergeLedger to check. Prints what the check reports for each case.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const BUILD = "C:/qa-scratch/qa232-cand/open-brain/build/harness";
const { checkShadowMergeLedger } = await import(pathToFileURL(`${BUILD}/shadow-merge.js`).href);
const CLI = `${BUILD}/cli.js`;
const env = { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" };
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", env }).trim();
const cli = (cwd, ...a) => {
  const r = spawnSync("node", [CLI, "shadow-verdict", ...a, "--repo", cwd], { cwd, encoding: "utf8", env });
  return { status: r.status, out: (r.stdout + r.stderr).trim().split("\n").slice(-2).join(" | ") };
};

function repo() {
  const root = mkdtempSync("C:/qa-tmp/qa232-cc132-");
  git(root, "init", "-q", "-b", "master");
  git(root, "config", "user.email", "qa@example.com");
  git(root, "config", "user.name", "QA232");
  mkdirSync(join(root, "docs", "loops"), { recursive: true });
  writeFileSync(join(root, "docs", "loops", "criteria.md"), "```qa-declared\n[unrunnable]\n[out-of-scope]\n```\n");
  git(root, "add", "docs");
  git(root, "commit", "-q", "-m", "criteria");
  const bare = join(root, "origin.git");
  git(root, "init", "-q", "--bare", "-b", "master", bare);
  git(root, "remote", "add", "origin", bare);
  git(root, "push", "-q", "origin", "master");
  return root;
}
function ev(root, loop, sha) {
  const check = { command: "x", exit_code: 0, passed: true, duration_ms: 1, detail: "" };
  const body = {
    loop, candidate_git: { sha, branch: "loop/c", frozen_at: "2026-09-30T00:00:00.000Z" },
    runtime_checks: { build: check, unit: check }, requirements: [],
    acceptance: [{ id: "A1", status: "met", evidence: "shown", order: "shown" }], regressions: [], gaps: [], notes: "",
  };
  const p = join(root, `ev-${loop}-${sha.slice(0, 7)}.json`);
  writeFileSync(p, JSON.stringify(body));
  return p;
}
function prepare(root, loop, sha) {
  const crit = git(root, "rev-parse", "HEAD");
  return cli(root, "prepare", "--loop", loop, "--candidate", sha, "--criteria-sha", crit, "--criteria", "docs/loops/criteria.md", "--evidence", ev(root, loop, sha));
}
const UNMERGED = "b".repeat(40);
const cases = [];
function record(name, root, steps) {
  const r = checkShadowMergeLedger(root);
  cases.push({ case: name, steps, ledger_present: existsSync(join(root, "docs/loops/shadow-merge/ledger.jsonl")), severity: r.severity, message: r.message });
  rmSync(root, { recursive: true, force: true });
}

// 1. matched: artifact for a merged candidate (HEAD) with its ledger line.
{
  const root = repo(); const head = git(root, "rev-parse", "HEAD");
  const s = [prepare(root, "15-qa232", head), cli(root, "decide", "--loop", "15-qa232", "--candidate", head, "--merged", head)];
  record("matched (artifact + ledger line)", root, s);
}
// 2. unmatched-merged, ledger present (holds a line for another artifact).
{
  const root = repo(); const head = git(root, "rev-parse", "HEAD");
  const s = [prepare(root, "15-other", UNMERGED), cli(root, "decide", "--loop", "15-other", "--candidate", UNMERGED, "--declined"), prepare(root, "15-qa232", head)];
  record("unmatched-merged (ledger present, no line for this artifact; candidate is HEAD)", root, s);
}
// 3. unmatched-pending: candidate not in the repo's history, ledger present.
{
  const root = repo(); const head = git(root, "rev-parse", "HEAD");
  const s = [prepare(root, "15-qa232", head), cli(root, "decide", "--loop", "15-qa232", "--candidate", head, "--merged", head), prepare(root, "15-pending", UNMERGED)];
  record("unmatched-pending (ledger present; candidate not an ancestor of HEAD)", root, s);
}
// 4a. no ledger, artifact present, candidate merged.
{
  const root = repo(); const head = git(root, "rev-parse", "HEAD");
  record("no ledger + artifact, candidate merged (ancestor of HEAD)", root, [prepare(root, "15-qa232", head)]);
}
// 4b. no ledger, artifact present, candidate pending.
{
  const root = repo();
  record("no ledger + artifact, candidate pending", root, [prepare(root, "15-qa232", UNMERGED)]);
}
// 5. runtime-loop layout (artifacts/iterations/<loop>/<sha>/), no ledger, candidate merged.
{
  const root = repo(); const head = git(root, "rev-parse", "HEAD");
  record("runtime layout artifacts/iterations, no ledger, candidate merged", root, [prepare(root, "t001", head)]);
}
// 6. same candidate sha, two loops: ledger line for loop A only; loop B's artifact for a merged sha.
{
  const root = repo(); const head = git(root, "rev-parse", "HEAD");
  const s = [prepare(root, "15-a", head), cli(root, "decide", "--loop", "15-a", "--candidate", head, "--merged", head), prepare(root, "15-b", head)];
  record("same sha in two loops, only loop A decided", root, s);
}
// 7. a directory holding a shadow_merge.json whose name is not a sha (not produced by prepare).
{
  const root = repo();
  const dir = join(root, "docs/loops/shadow-merge/15-x/HEAD");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "shadow_merge.json"), JSON.stringify({ loop: "15-x", candidate_sha: "HEAD" }));
  record("hand-planted artifact in a non-sha directory named HEAD", root, []);
}
console.log(JSON.stringify(cases, null, 1));
writeFileSync("C:/qa-tmp/qa232-cc132-probe.json", JSON.stringify(cases, null, 1));
