#!/usr/bin/env node
// QA 120 (T-185): run every probe against ONE built tree and record exit, stderr and whether the target changed.
// Usage: node probes.mjs <tree> <label>     e.g. node probes.mjs C:\qa-scratch\t185 cand
//        <tree> is a checkout with open-brain/build/ built. Output: C:\qa-scratch\t185-probes\<label>.json + a table.
// Every fixture lives under os.tmpdir() (C:\qa-tmp on the QA PC). Every state path the CLI can write
// (DB, vault, active-session slot, score history, shadow log, HOME) is redirected into a per-probe scratch dir.
// The snapshot is taken BEFORE any git command runs, because `git status` can rewrite .git/index.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync, rmSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync, execFileSync } from "node:child_process";

const [tree, label] = process.argv.slice(2);
if (!tree || !label) { console.error("usage: node probes.mjs <tree> <label>"); process.exit(2); }
const cliJs = join(tree, "open-brain", "build", "cli.js");
const backfill = join(tree, "open-brain", "scripts", "backfill-success-rate.mjs");
if (!existsSync(cliJs)) { console.error(`no build at ${cliJs}`); process.exit(2); }
const TMP = realpathSync(tmpdir());
const outDir = "C:\\qa-scratch\\t185-probes";
mkdirSync(outDir, { recursive: true });

const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function snapshot(root) {
  const out = {};
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      const st = statSync(p);
      if (st.isDirectory()) { out[relative(root, p) + "/"] = "<dir>"; walk(p); }
      else out[relative(root, p)] = readFileSync(p).toString("base64");
    }
  };
  walk(root);
  return out;
}
function diff(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const d = [];
  for (const k of keys) {
    if (!(k in a)) d.push(`+${k}`);
    else if (!(k in b)) d.push(`-${k}`);
    else if (a[k] !== b[k]) d.push(`~${k}`);
  }
  return d.sort();
}

// ---- fixtures (same premises as the developer's tests, rebuilt here) ----
function syncProject(root) {
  const p = join(root, "proj");
  mkdirSync(join(p, ".agents", "SYSTEM"), { recursive: true });
  writeFileSync(join(p, "package.json"), JSON.stringify({ name: "fixture", version: "1.2.3" }) + "\n");
  writeFileSync(join(p, "README.md"), "# fixture\n\n**Latest: v0.0.1**\n");
  return p;
}
function startProject(root) {
  const p = join(root, "proj");
  mkdirSync(join(p, ".agents", "SYSTEM"), { recursive: true });
  mkdirSync(join(p, ".agents", "SESSIONS"), { recursive: true });
  writeFileSync(join(p, "package.json"), JSON.stringify({ name: "fixture", version: "1.2.3" }) + "\n");
  return p;
}
function branchClone(root) {
  const origin = join(root, "origin.git"), seed = join(root, "seed"), clone = join(root, "clone");
  mkdirSync(origin); mkdirSync(seed);
  git(origin, "init", "-q", "--bare", "-b", "master");
  git(seed, "init", "-q", "-b", "master");
  git(seed, "config", "user.email", "qa@example.com");
  git(seed, "config", "user.name", "QA");
  writeFileSync(join(seed, "package.json"), "{}\n");
  mkdirSync(join(seed, ".agents", "SYSTEM"), { recursive: true });
  writeFileSync(join(seed, ".agents", "SYSTEM", "keep.md"), "x\n");
  git(seed, "add", "-A"); git(seed, "commit", "-q", "-m", "seed");
  git(seed, "remote", "add", "origin", origin);
  git(seed, "push", "-q", "origin", "master");
  execFileSync("git", ["clone", "-q", origin, clone], { stdio: ["ignore", "pipe", "pipe"] });
  return clone;
}
function v1File(root) {
  const f = join(root, "state.json");
  writeFileSync(f, JSON.stringify({
    schema_version: 1, revision: 52, project: { name: "fixture" },
    objective: { text: "do the thing", since_session: 1 }, tasks: [], verified: [], gaps: [], decisions: [],
    handoff: { pick_up: "p", watch_out: [], open_questions: [], session: 70 },
    last_session: { n: 70, date: "2026-09-20", uuid: "abc" },
  }, null, 2) + "\n");
  return f;
}

// ---- probes: [group, id, fixture kind, argv builder, expectation] ----
// expect: "refuse2" = exit 2 and nothing changed; "ok-nochange" = accepted, nothing changed;
// "control-change" = the control that proves the fixture WOULD change; "info" = record only.
const EM = "\u2014", EN = "\u2013";
const P = [];
const add = (group, id, kind, argv, expect, note = "") => P.push({ group, id, kind, argv, expect, note });

// sync (cwd = fixture project)
add("sync", "control: sync (no flags)", "sync", () => ["sync"], "control-change");
add("sync", "control: sync --check", "sync", () => ["sync", "--check"], "ok-nochange");
for (const t of ["-check", "--chek", "--help", "-h"]) add("sync", `dev: sync ${t}`, "sync", () => ["sync", t], "refuse2");
for (const t of ["--dry_run", `${EM}check`, `${EM}dry-run`, `${EN}check`, "-n", "--check=1", "-", "--"])
  add("sync", `qa: sync ${t}`, "sync", () => ["sync", t], "refuse2");
add("sync", "qa: sync . --chek (flag after positional)", "sync", () => ["sync", ".", "--chek"], "refuse2");
add("sync", "qa: sync --check --check (flag twice)", "sync", () => ["sync", "--check", "--check"], "ok-nochange");
add("sync", "qa: sync no-such-dir", "sync", () => ["sync", "no-such-dir"], "refuse2");
add("sync", "qa: sync package.json (a file, not a dir)", "sync", () => ["sync", "package.json"], "refuse2");
add("sync", "qa: sync . .. (two dirs)", "sync", () => ["sync", ".", ".."], "refuse2");

// start (cwd = fixture project)
add("start", "control: start (no flags)", "start", () => ["start"], "control-change");
for (const t of ["-dry-run", "--dry-run"]) add("start", `dev: start ${t}`, "start", () => ["start", t], "refuse2");
for (const t of ["--dry_run", `${EM}dry-run`, "-n", "-", "--check=1"])
  add("start", `qa: start ${t}`, "start", () => ["start", t], "refuse2");
add("start", "qa: start . --dry-run (flag after positional)", "start", () => ["start", ".", "--dry-run"], "refuse2");
add("start", "qa: start no-such-dir", "start", () => ["start", "no-such-dir"], "refuse2");

// detach (cwd = a real clone on master; --no-fetch everywhere except where noted)
add("detach", "control: detach --no-fetch", "detach", () => ["detach", "--no-fetch"], "control-change");
add("detach", "control: detach --dry-run --no-fetch", "detach", () => ["detach", "--dry-run", "--no-fetch"], "ok-nochange");
for (const t of ["-dry-run", "--dry-rn"]) add("detach", `dev: detach ${t} --no-fetch`, "detach", () => ["detach", t, "--no-fetch"], "refuse2");
for (const t of ["--dry_run", `${EM}dry-run`, "-n", "-", "--dry-run=1", "--force=1"])
  add("detach", `qa: detach ${t} --no-fetch`, "detach", () => ["detach", t, "--no-fetch"], "refuse2");
add("detach", "qa: detach -dry-run (fetch allowed)", "detach", () => ["detach", "-dry-run"], "refuse2");
add("detach", "qa: detach . -dry-run --no-fetch (after positional)", "detach", () => ["detach", ".", "-dry-run", "--no-fetch"], "refuse2");
add("detach", "qa: detach --dry-run --dry-run --no-fetch (twice)", "detach", () => ["detach", "--dry-run", "--dry-run", "--no-fetch"], "ok-nochange");
add("detach", "qa: detach no-such-dir --no-fetch", "detach", () => ["detach", "no-such-dir", "--no-fetch"], "refuse2");

// state migrate (cwd = scratch root, file = v1 state.json)
add("migrate", "control: state migrate --seat developer <f>", "migrate", (f) => ["state", "migrate", "--seat", "developer", f], "control-change");
add("migrate", "control: state migrate --seat developer --dry-run <f>", "migrate", (f) => ["state", "migrate", "--seat", "developer", "--dry-run", f], "ok-nochange");
for (const t of ["-dry-run", "--dry-rn"]) add("migrate", `dev: state migrate --seat developer ${t} <f>`, "migrate", (f) => ["state", "migrate", "--seat", "developer", t, f], "refuse2");
for (const t of ["--dry_run", "-n", "-", "--dry-run=1"])
  add("migrate", `qa: state migrate --seat developer ${t} <f>`, "migrate", (f) => ["state", "migrate", "--seat", "developer", t, f], "refuse2");
add("migrate", `qa: state migrate --seat developer ${EM}dry-run <f> (em dash)`, "migrate", (f) => ["state", "migrate", "--seat", "developer", `${EM}dry-run`, f], "refuse2",
  "em dash does not start with '-', so it is a positional; positionals are 'any' here");
add("migrate", "qa: state migrate --seat developer <f> --dry-rn (after positional)", "migrate", (f) => ["state", "migrate", "--seat", "developer", f, "--dry-rn"], "refuse2");
add("migrate", "qa: state migrate --seat developer --dry-run --dry-run <f> (twice)", "migrate", (f) => ["state", "migrate", "--seat", "developer", "--dry-run", "--dry-run", f], "ok-nochange");
add("migrate", "qa: state migrate --seat=developer <f> (equals form, space-only flag)", "migrate", (f) => ["state", "migrate", "--seat=developer", f], "refuse2");
add("migrate", "qa: state migrate --seat developer --seat developer <f> (value twice)", "migrate", (f) => ["state", "migrate", "--seat", "developer", "--seat", "developer", f], "refuse2");
add("migrate", "qa: state migrate --seat -dry-run <f> (dash token as value)", "migrate", (f) => ["state", "migrate", "--seat", "-dry-run", f], "refuse2");

// read-only / opt-in (cwd = scratch root)
for (const t of ["-json", "--jsn", `${EM}json`, "-"]) add("show", `state show ${t}`, "root", () => ["state", "show", t], "refuse2");
for (const a of [["--aply"], ["-apply"], ["--from", "a", "--to", "b", "--aply"], ["--from"], [`${EM}apply`]])
  add("relocate", `relocate ${a.join(" ")}`, "root", () => ["relocate", ...a], "refuse2");
for (const a of [["--aply"], ["-apply"], ["--min", "3"], [`${EM}apply`]])
  add("topics", `topics ${a.join(" ")}`, "root", () => ["topics", ...a], "refuse2");
for (const a of [["--aply"], ["-apply"], ["-"], [`${EM}apply`]])
  add("backfill", `backfill-success-rate.mjs ${a.join(" ")}`, "backfill", () => a, "refuse2");
add("backfill", "backfill-success-rate.mjs --apply --apply (twice)", "backfill", () => ["--apply", "--apply"], "info");

const results = [];
for (const pr of P) {
  const root = mkdtempSync(join(TMP, `qa120-${label}-`));
  const state = join(root, "_state"); mkdirSync(state);
  const env = {
    ...process.env,
    HOME: state, USERPROFILE: state,
    KNOWLEDGE_V2_DB: join(state, "knowledge-v2.db"),
    OPEN_BRAIN_VAULT_DIR: join(state, "vault"),
    OPEN_BRAIN_ACTIVE_SESSION: join(state, "active-session.json"),
    OPEN_BRAIN_SCORE_HISTORY: join(state, "score-history.jsonl"),
    OPEN_BRAIN_SHADOW_LOG: join(state, "shadow-recall.jsonl"),
  };
  let cwd = root, target = root, argv;
  if (pr.kind === "sync") { cwd = target = syncProject(root); argv = pr.argv(); }
  else if (pr.kind === "start") { cwd = target = startProject(root); argv = pr.argv(); }
  else if (pr.kind === "detach") { cwd = target = branchClone(root); argv = pr.argv(); }
  else if (pr.kind === "migrate") { const f = v1File(root); target = root; argv = pr.argv(f); }
  else { argv = pr.argv(); }
  if (!realpathSync(cwd).startsWith(TMP + sep)) throw new Error(`refusing: cwd outside tmp: ${cwd}`);
  const headBefore = pr.kind === "detach" ? readFileSync(join(target, ".git", "HEAD"), "utf8").trim() : null;
  // The state dir is excluded from the target snapshot for "root" kinds, and snapshotted separately.
  const snapTarget = () => { const s = snapshot(target); for (const k of Object.keys(s)) if (k.startsWith("_state")) delete s[k]; return s; };
  const before = snapTarget();
  const stateBefore = snapshot(state);
  const cmd = pr.kind === "backfill" ? [backfill, ...argv] : [cliJs, ...argv];
  const r = spawnSync(process.execPath, cmd, { cwd, env, encoding: "utf8", timeout: 120_000 });
  const after = snapTarget();
  const stateAfter = snapshot(state);
  const headAfter = pr.kind === "detach" ? readFileSync(join(target, ".git", "HEAD"), "utf8").trim() : null;
  const porcelain = pr.kind === "detach" ? git(target, "status", "--porcelain") : null;
  const changed = diff(before, after);
  const stateChanged = diff(stateBefore, stateAfter);
  const status = r.status;
  let verdict;
  if (pr.expect === "refuse2") verdict = status === 2 && changed.length === 0 && stateChanged.length === 0 ? "PASS" : "FAIL";
  else if (pr.expect === "ok-nochange") verdict = status !== 2 && changed.length === 0 ? "PASS" : "FAIL";
  else if (pr.expect === "control-change") verdict = changed.length > 0 ? "PASS" : "FAIL";
  else verdict = "INFO";
  results.push({
    group: pr.group, id: pr.id, argv, expect: pr.expect, note: pr.note, status, verdict,
    changed, stateChanged, headBefore, headAfter, porcelain,
    stderr: (r.stderr || "").trim().split(/\r?\n/).slice(0, 4).join(" | "),
    stdout: (r.stdout || "").trim().split(/\r?\n/).slice(0, 3).join(" | "),
  });
  rmSync(root, { recursive: true, force: true });
  process.stderr.write(`${verdict.padEnd(4)} ${String(status).padStart(4)}  ${pr.id}\n`);
}
writeFileSync(join(outDir, `${label}.json`), JSON.stringify(results, null, 2) + "\n");
const pass = results.filter((x) => x.verdict === "PASS").length, fail = results.filter((x) => x.verdict === "FAIL").length;
console.log(`${label}: ${results.length} probes, ${pass} PASS, ${fail} FAIL, ${results.length - pass - fail} INFO -> ${join(outDir, label + ".json")}`);
