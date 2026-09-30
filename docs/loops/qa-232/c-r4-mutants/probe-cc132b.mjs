// QA 232, CC-13.2 supplement: pending decide with a REAL commit that exists but is not an ancestor of HEAD
// (a side branch), then the same artifact after that branch is merged into HEAD (decide becomes owed).
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const BUILD = "C:/qa-scratch/qa232-cand/open-brain/build/harness";
const { checkShadowMergeLedger } = await import(pathToFileURL(`${BUILD}/shadow-merge.js`).href);
const env = { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" };
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", env }).trim();

const root = mkdtempSync("C:/qa-tmp/qa232-cc132b-");
git(root, "init", "-q", "-b", "master");
git(root, "config", "user.email", "qa@example.com");
git(root, "config", "user.name", "QA232");
mkdirSync(join(root, "docs", "loops"), { recursive: true });
writeFileSync(join(root, "docs", "loops", "criteria.md"), "```qa-declared\n[unrunnable]\n[out-of-scope]\n```\n");
git(root, "add", "docs");
git(root, "commit", "-q", "-m", "criteria");
const crit = git(root, "rev-parse", "HEAD");
git(root, "checkout", "-q", "-b", "loop/side");
writeFileSync(join(root, "side.txt"), "side\n");
git(root, "add", "side.txt");
git(root, "commit", "-q", "-m", "side");
const side = git(root, "rev-parse", "HEAD");
git(root, "checkout", "-q", "master");

const check = { command: "x", exit_code: 0, passed: true, duration_ms: 1, detail: "" };
const ev = join(root, "ev.json");
writeFileSync(ev, JSON.stringify({
  loop: "15-side", candidate_git: { sha: side, branch: "loop/side", frozen_at: "2026-09-30T00:00:00.000Z" },
  runtime_checks: { build: check, unit: check }, requirements: [],
  acceptance: [{ id: "A1", status: "met", evidence: "shown", order: "shown" }], regressions: [], gaps: [], notes: "",
}));
const p = spawnSync("node", [`${BUILD}/cli.js`, "shadow-verdict", "prepare", "--loop", "15-side", "--candidate", side, "--criteria-sha", crit, "--criteria", "docs/loops/criteria.md", "--evidence", ev, "--repo", root], { cwd: root, encoding: "utf8", env });
const out = [];
out.push({ step: "prepare on side-branch commit", status: p.status });
const before = checkShadowMergeLedger(root);
out.push({ case: "real side-branch commit, not merged, no ledger", side, severity: before.severity, message: before.message });
git(root, "merge", "-q", "--no-ff", "-m", "merge side", "loop/side");
const after = checkShadowMergeLedger(root);
out.push({ case: "same artifact after the side branch is merged into HEAD", severity: after.severity, message: after.message });
console.log(JSON.stringify(out, null, 1));
rmSync(root, { recursive: true, force: true });
