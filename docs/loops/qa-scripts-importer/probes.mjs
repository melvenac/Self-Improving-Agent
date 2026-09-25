#!/usr/bin/env node
// QA 102: rows IF-1 to IF-4 and IF-7 re-run independently against the BUILT CLI, plus the dispatch's probes (step 5)
// and a few past them. No shell: every command is execFileSync/spawnSync with an argument array.
// Usage: node probes.mjs <candidate-worktree> <a2a-hub-clone> <scratch-dir>
// Every scenario runs in a fresh directory under <scratch-dir>. Nothing outside it is written; the A2A-Hub clone is
// read with `git archive` only.
import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, cpSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

if (process.argv.slice(2).length !== 3) { console.error("usage: node probes.mjs <candidate> <a2a-hub-clone> <scratch>"); process.exit(2); }
// Absolute: every CLI call runs with cwd = the scenario directory (a relative path broke the first run).
const [cand, hub, scratch] = process.argv.slice(2).map((p) => resolve(p));
const CLI = join(cand, "open-brain/build/cli.js");
const { parseState } = await import(pathToFileURL(join(cand, "open-brain/build/shared/state-schema.js")).href);
// Taken from the build, not typed: a hand-typed report path was wrong on the second run and failed 6 checks.
const { DRAFT_REL: DRAFT, REPORT_REL: REPORT, STATE_REL: STATE } = await import(pathToFileURL(join(cand, "open-brain/build/pipelines/state-import/index.js")).href);
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });

let pass = 0, fail = 0;
const results = [];
function check(id, ok, what) { (ok ? pass++ : fail++); results.push(`${ok ? "PASS" : "FAIL"} ${id}: ${what}`); console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${what}`); }
function note(id, what) { console.log(`NOTE ${id}: ${what}`); }
function cli(root, ...args) {
  const r = spawnSync(process.execPath, [CLI, "state", "import", ...args], { cwd: root, encoding: "utf8" });
  return { status: r.status, out: r.stdout, err: r.stderr };
}
function show(id, label, r) {
  console.log(`---- ${id} ${label}: exit ${r.status}`);
  for (const l of (r.out + r.err).split(/\r?\n/).filter(Boolean)) console.log(`     | ${l}`);
}
function tree(dir) {
  const out = new Map();
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else out.set(relative(dir, p).replace(/\\/g, "/"), createHash("sha256").update(readFileSync(p)).digest("hex")); } };
  walk(dir); return out;
}
function diffTrees(a, b) {
  const added = [...b.keys()].filter((k) => !a.has(k)), removed = [...a.keys()].filter((k) => !b.has(k));
  const changed = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k));
  return { added, removed, changed };
}
function firstSection(text) {
  const lines = text.split(/\r?\n/); const s = lines.findIndex((l) => l.startsWith("## "));
  let e = s + 1; while (e < lines.length && !lines[e].startsWith("## ")) e++;
  return { index: s, text: lines.slice(s, e).join("\n"), before: lines.slice(0, s).filter((l) => l.trim()).join(" | ") };
}
function fresh(name) { const d = join(scratch, name); mkdirSync(d, { recursive: true }); return d; }
function archiveHub(dest) {
  const tar = execFileSync("git", ["-C", hub, "archive", "--format=tar", "e0bc3f8"], { maxBuffer: 1 << 28 });
  execFileSync("tar", ["-x", "-C", dest.replace(/\\/g, "/")], { input: tar });
}
/** A minimal project; each judged input takes a status blockquote line (or none) and optional extra body. */
function project(root, { sessions = [7], next = "Updated at end of Session 7.", inbox = "**Last Updated:** Session 7", task = "**Focus:** Session 7", nextBody = "", noSessionsDir = false, bom = false } = {}) {
  mkdirSync(join(root, ".agents/TASKS"), { recursive: true });
  mkdirSync(join(root, ".agents/SYSTEM"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "qa102-probe", version: "0.0.1" }));
  const st = (s) => (s === null ? "" : `> ${s}\n\n`);
  const b = bom ? "﻿" : "";
  if (!noSessionsDir) {
    mkdirSync(join(root, ".agents/SESSIONS"), { recursive: true });
    for (const n of sessions) writeFileSync(join(root, `.agents/SESSIONS/Session_${n}.md`), `# Session ${n} — 2026-09-20\n\n> **Status:** Completed\n`);
    if (next !== undefined) writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), `${b}# Next Session Handoff\n\n${st(next)}${nextBody}## Pick up here\n\nCarry on.\n\n## Watch out\n\n- one\n`);
  }
  writeFileSync(join(root, ".agents/TASKS/INBOX.md"), `${b}# Inbox\n\n${st(inbox)}## P0 — Critical\n\n- [ ] **A task** — do it\n`);
  writeFileSync(join(root, ".agents/TASKS/task.md"), `${b}# Current Focus\n\n${st(task)}## Current Objective\n\nShip the thing.\n`);
}
function draftReport(root) { return existsSync(join(root, REPORT)) ? readFileSync(join(root, REPORT), "utf8") : ""; }
function verdictLines(root) { return firstSection(draftReport(root)).text.split("\n").filter((l) => l.startsWith("- ")); }

// ============================================================ IF-1
{
  const id = "IF-1 (SIA fixture)";
  const root = fresh("if1-sia"); cpSync(join(cand, "open-brain/tests/fixtures-import"), root, { recursive: true });
  const d = cli(root, "--draft", root); show(id, "--draft", d);
  const p = parseState(readFileSync(join(root, DRAFT), "utf8"));
  check(id, d.status === 0, "--draft exits 0");
  check(id, p.ok === true, "the draft passes parseState");
  check(id, p.ok && p.data.verified.length === 0 && p.data.gaps.length === 0, `verified[] ${p.ok ? p.data.verified.length : "?"} and gaps[] ${p.ok ? p.data.gaps.length : "?"} are empty`);
  const rep = draftReport(root);
  check(id, /verified\[\]: 0 · gaps\[\]: 0/.test(rep), "the report says verified[]: 0 · gaps[]: 0");
  check(id, d.out.includes("verified 0 · gaps 0"), "the CLI line says verified 0 · gaps 0");
  check(id, !/\b[VG]-00\d\b/.test(rep) && !/\b[VG]-00\d\b/.test(readFileSync(join(root, DRAFT), "utf8")), "no V-00x or G-00x id anywhere in the report or the draft");
  const c = cli(root, "--commit", root); show(id, "--commit", c);
  const s = existsSync(join(root, STATE)) ? parseState(readFileSync(join(root, STATE), "utf8")) : { ok: false };
  check(id, c.status === 0 && s.ok && s.data.verified.length === 0 && s.data.gaps.length === 0, "after --commit, state.json parses with empty verified[] and gaps[]");
}
{
  const id = "IF-1 (A2A-Hub archive)";
  const root = fresh("if1-hub"); archiveHub(root);
  const d = cli(root, "--draft", root);
  const p = parseState(readFileSync(join(root, DRAFT), "utf8"));
  check(id, d.status === 0 && p.ok && p.data.verified.length === 0 && p.data.gaps.length === 0 && d.out.includes("verified 0 · gaps 0"), "another project's draft: parses, verified[] and gaps[] empty, CLI line says 0");
}

// ============================================================ IF-2 (the real archive, not the vendored fixture)
{
  const id = "IF-2 (A2A-Hub e0bc3f8, fresh git archive)";
  const root = fresh("if2-hub"); archiveHub(root);
  const before = tree(root);
  const d = cli(root, "--draft", root); show(id, "--draft", d);
  const rep = draftReport(root), top = firstSection(rep);
  console.log(`     report first section (index ${top.index}; before it: ${top.before}):\n${top.text.split("\n").map((l) => "     > " + l).join("\n")}`);
  check(id, d.status === 0, "--draft exits 0");
  check(id, top.text.startsWith("## Staleness"), "the report's first section is the staleness section");
  const nl = top.text.split("\n").find((l) => l.includes("next-session.md"));
  check(id, !!nl && /\*\*STALE\*\*/.test(nl) && nl.includes("Session 13") && nl.includes("Session_14.md") && nl.includes("Updated at end of Session 13"), "next-session.md is STALE, with the declaring line and the latest log as evidence");
  const il = top.text.split("\n").find((l) => l.includes("INBOX.md"));
  note(id, `INBOX line: ${il}`);
  const afterDraft = diffTrees(before, tree(root));
  check(id, afterDraft.added.sort().join(",") === [DRAFT, REPORT].sort().join(",") && !afterDraft.changed.length && !afterDraft.removed.length, `--draft wrote only the draft and the report (added ${afterDraft.added.join(",")}; changed ${afterDraft.changed.length}; removed ${afterDraft.removed.length})`);
  const bare = cli(root, "--commit", root); show(id, "--commit (no acknowledgement)", bare);
  const afterBare = diffTrees(before, tree(root));
  check(id, bare.status === 1 && !existsSync(join(root, STATE)) && !existsSync(join(root, ".agents/archive")) && afterBare.added.length === 2 && !afterBare.changed.length, "--commit refuses: exit 1, no state.json, no archive/, nothing else changed");
  check(id, bare.err.includes("next-session.md") && bare.err.includes("--accept-stale"), "the refusal names next-session.md and the acknowledgement flag");
  const typo = cli(root, "--commit", "--accept-stal", root); show(id, "--commit --accept-stal", typo);
  check(id, typo.status === 1 && typo.err.includes("unrecognised flag") && !existsSync(join(root, STATE)), "a misspelled acknowledgement refuses as an unrecognised flag");
  const acked = cli(root, "--commit", "--accept-stale", root); show(id, "--commit --accept-stale", acked);
  check(id, acked.status === 0 && existsSync(join(root, STATE)) && existsSync(join(root, ".agents/archive")), "--commit --accept-stale proceeds: state.json written, snapshot taken");
  check(id, /Imported STALE under --accept-stale: .*next-session\.md/.test(acked.out), "the commit output names what was imported stale");
  // V-009: the snapshot is byte-complete for what was on disk before the commit.
  const snapDir = readdirSync(join(root, ".agents/archive")).map((n) => join(root, ".agents/archive", n))[0];
  const snap = tree(snapDir);
  const agentsBefore = new Map([...before].filter(([k]) => k.startsWith(".agents/")).map(([k, v]) => [k.slice(".agents/".length), v]));
  const missing = [...agentsBefore].filter(([k, v]) => snap.get(k) !== v).map(([k]) => k);
  note(id, `snapshot ${relative(root, snapDir)}: ${snap.size} files; original .agents files missing or differing in it: ${missing.length}${missing.length ? " " + missing.slice(0, 5).join(",") : ""}`);
}

// ============================================================ IF-3 known negatives (my own, not the developer's)
{
  const id = "IF-3 (title-line + range markers)";
  const root = fresh("if3-a");
  project(root, { sessions: [8, 9], next: null, nextBody: "", inbox: "Last touched in Sessions 8–9", task: null });
  // next-session declares its session in a heading only; task in its title line.
  writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), "# Next Session Handoff\n\n## Pick up here (end of Session 9)\n\nCarry on.\n");
  writeFileSync(join(root, ".agents/TASKS/task.md"), "# Current Focus — Session 9\n\n## Current Objective\n\nShip.\n");
  const d = cli(root, "--draft", root); show(id, "--draft", d);
  const v = verdictLines(root); console.log(v.map((l) => "     > " + l).join("\n"));
  check(id, d.status === 0 && d.out.includes("Staleness: 0 stale · 0 could not tell · 3 current"), "no finding: 0 stale, 0 could not tell, 3 current");
  const c = cli(root, "--commit", root); show(id, "--commit", c);
  check(id, c.status === 0 && existsSync(join(root, STATE)) && !c.out.includes("Could not tell") && !c.out.includes("Imported STALE"), "--commit proceeds without the acknowledgement, and prints no staleness line");
}
{
  const id = "IF-3 (acknowledgement passed when nothing is stale)";
  const root = fresh("if3-b"); project(root, {});
  cli(root, "--draft", root);
  const c = cli(root, "--commit", "--accept-stale", root); show(id, "--commit --accept-stale", c);
  check(id, c.status === 0 && !c.out.includes("Imported STALE"), "an unneeded acknowledgement is harmless and claims nothing");
}

// ============================================================ IF-4 could not tell
{
  const id = "IF-4 (marker only in body text)";
  const root = fresh("if4-body"); project(root, { inbox: null });
  writeFileSync(join(root, ".agents/TASKS/INBOX.md"), "# Inbox\n\n## P0\n\n- [ ] **A task** — added in Session 7\n\nLast updated in Session 7.\n");
  const d = cli(root, "--draft", root); show(id, "--draft", d);
  const line = verdictLines(root).find((l) => l.includes("INBOX.md")) ?? "";
  console.log(`     > ${line}`);
  check(id, /^- could not tell `\.agents\/TASKS\/INBOX\.md`: .+/.test(line), "INBOX is 'could not tell' in the first section, with a reason");
  check(id, !verdictLines(root).some((l) => l.startsWith("- current") && l.includes("INBOX.md")), "INBOX is not counted as current");
  check(id, d.out.includes("1 could not tell (.agents/TASKS/INBOX.md)") && d.out.includes("2 current"), "the CLI staleness line counts it as could-not-tell, not current");
  const c = cli(root, "--commit", root); show(id, "--commit", c);
  const lines = c.out.split(/\r?\n/).filter((l) => l.startsWith("Could not tell"));
  check(id, c.status === 0 && lines.length === 1 && lines[0].includes("INBOX.md"), "--commit proceeds and prints exactly one line naming the input (ruling 1b)");
}
{
  const id = "IF-4 (SESSIONS/ exists, no Session_N.md)";
  const root = fresh("if4-nolog"); project(root, { sessions: [] });
  const d = cli(root, "--draft", root); show(id, "--draft", d);
  const v = verdictLines(root); console.log(v.map((l) => "     > " + l).join("\n"));
  check(id, v.filter((l) => l.startsWith("- could not tell")).length === 3 && !v.some((l) => l.startsWith("- current") || l.startsWith("- **STALE**")), "all three present inputs are 'could not tell', none current");
  const c = cli(root, "--commit", root); show(id, "--commit", c);
  check(id, c.status === 0 && /Could not tell whether current: .*next-session.*INBOX.*task|Could not tell whether current: .*/.test(c.out), "--commit proceeds with the could-not-tell line");
}

// ============================================================ Dispatch step 5 probes
{
  const id = "PROBE-1 input newer than the latest session";
  const root = fresh("p1-newer"); project(root, { sessions: [7], next: "Updated at end of Session 20." });
  const d = cli(root, "--draft", root); show(id, "--draft", d);
  console.log(verdictLines(root).map((l) => "     > " + l).join("\n"));
  // Read before --commit: the commit moves the report into the snapshot (an earlier run read it after, and printed "(none)").
  const nextLine = verdictLines(root).find((l) => l.includes("next-session")) ?? "(none)";
  const c = cli(root, "--commit", root); show(id, "--commit", c);
  note(id, `draft exit ${d.status}; next-session verdict line: ${nextLine}; --commit exit ${c.status}, state.json ${existsSync(join(root, STATE))}`);
}
{
  const id = "PROBE-2 no SESSIONS/ directory";
  const root = fresh("p2-nosessions"); project(root, { noSessionsDir: true });
  const d = cli(root, "--draft", root); show(id, "--draft", d);
  console.log(verdictLines(root).map((l) => "     > " + l).join("\n"));
  const before = tree(root);
  const c = cli(root, "--commit", root); show(id, "--commit", c);
  const dt = diffTrees(before, tree(root));
  note(id, `draft exit ${d.status}; --commit exit ${c.status}, state.json ${existsSync(join(root, STATE))}; after the failed commit: added ${dt.added.length} (${dt.added.filter((f) => !f.includes("/archive/")).join(", ")} + ${dt.added.filter((f) => f.includes("/archive/")).length} under archive/), changed ${dt.changed.join(", ") || "none"}, removed ${dt.removed.join(", ") || "none"}`);
  const again = cli(root, "--commit", root); show(id, "--commit, second attempt", again);
  const redraft = cli(root, "--draft", root); show(id, "--draft, after the failure", redraft);
}
{
  const id = "PROBE-3 next-session.md names no session";
  const root = fresh("p3-nextnomarker"); project(root, { next: null });
  const d = cli(root, "--draft", root); show(id, "--draft", d);
  console.log(verdictLines(root).map((l) => "     > " + l).join("\n"));
  const c = cli(root, "--commit", root); show(id, "--commit", c);
  note(id, `draft exit ${d.status}; --commit exit ${c.status}, state.json ${existsSync(join(root, STATE))}`);
}
{
  const id = "PROBE-4 untracked .agents/ (git repo, .agents/ gitignored), stale inputs";
  const root = fresh("p4-untracked"); project(root, { sessions: [6, 7], next: "Updated at end of Session 6.", inbox: "Session 5" });
  const g = (...a) => execFileSync("git", ["-C", root, ...a], { encoding: "utf8" });
  g("init", "-q"); writeFileSync(join(root, ".gitignore"), ".agents/\n"); g("add", ".gitignore", "package.json");
  g("-c", "user.name=qa102", "-c", "user.email=qa102@example.invalid", "commit", "-q", "-m", "probe");
  note(id, `git ls-files: ${g("ls-files").trim().split("\n").join(",")}; git status --porcelain --ignored: ${g("status", "--porcelain", "--ignored").trim().split("\n").join(" ; ")}`);
  const d = cli(root, "--draft", root); show(id, "--draft", d);
  console.log(verdictLines(root).map((l) => "     > " + l).join("\n"));
  const c = cli(root, "--commit", root); show(id, "--commit", c);
  const a = cli(root, "--commit", "--accept-stale", root); show(id, "--commit --accept-stale", a);
  note(id, `draft exit ${d.status}; bare --commit exit ${c.status}; acknowledged exit ${a.status}; state.json ${existsSync(join(root, STATE))}`);
}
{
  const id = "PROBE-4b untracked .agents/, no git at all, stale inputs";
  const root = fresh("p4b-nogit"); project(root, { sessions: [7], next: "Updated at end of Session 6." });
  const d = cli(root, "--draft", root);
  const c = cli(root, "--commit", root); show(id, "--commit", c);
  note(id, `draft exit ${d.status}: ${d.out.split("\n").find((l) => l.startsWith("Staleness"))}; bare --commit exit ${c.status}`);
}
{
  const id = "PROBE-5 misspelled acknowledgement flags (stale project)";
  const variants = [["--accept-stal"], ["--accept_stale"], ["--Accept-Stale"], ["--accept-stale=yes"], ["--acceptStale"], ["--accept-stales"], ["---accept-stale"], ["-accept-stale"], ["accept-stale"], ["--commit=yes"]];
  for (const v of variants) {
    for (const order of ["flag-before-dir", "dir-before-flag"]) {
      const root = fresh(`p5-${v[0].replace(/[^a-zA-Z_=]/g, "_")}-${order}`); project(root, { sessions: [7], next: "Updated at end of Session 6." });
      cli(root, "--draft", root);
      const args = order === "flag-before-dir" ? ["--commit", ...v, root] : ["--commit", root, ...v];
      const r = cli(root, ...args);
      const first = (r.err || r.out).split(/\r?\n/).find(Boolean) ?? "";
      console.log(`---- ${id} ${JSON.stringify(args.map((a) => (a === root ? "<dir>" : a)))}: exit ${r.status}, state.json ${existsSync(join(root, STATE))} | ${first.slice(0, 200)}`);
    }
  }
}
{
  const id = "PROBE-5b misspelled acknowledgement on a CURRENT project (does junk pass silently?)";
  for (const v of ["-accept-stale", "accept-stale", "--accept-stal"]) {
    for (const order of ["flag-before-dir", "dir-before-flag"]) {
      const root = fresh(`p5b-${v.replace(/[^a-zA-Z]/g, "_")}-${order}`); project(root, {});
      cli(root, "--draft", root);
      const args = order === "flag-before-dir" ? ["--commit", v, root] : ["--commit", root, v];
      const r = cli(root, ...args);
      const first = (r.err || r.out).split(/\r?\n/).find(Boolean) ?? "";
      console.log(`---- ${id} ${JSON.stringify(args.map((a) => (a === root ? "<dir>" : a)))}: exit ${r.status}, state.json ${existsSync(join(root, STATE))} | ${first.slice(0, 200)}`);
    }
  }
}

// ============================================================ Past the dispatch's probes
{
  const id = "PROBE-6 --accept-stale with --draft";
  const root = fresh("p6-draftack"); project(root, { next: "Session 6" });
  const r = cli(root, "--draft", "--accept-stale", root); show(id, "--draft --accept-stale", r);
  note(id, `exit ${r.status}; draft written ${existsSync(join(root, DRAFT))}`);
}
{
  const id = "PROBE-7 input fixed between --draft and --commit (handoff limit 5)";
  const root = fresh("p7-fixed"); project(root, { sessions: [7], next: "Updated at end of Session 6." });
  cli(root, "--draft", root);
  writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), "# Next Session Handoff\n\n> Updated at end of Session 7.\n\n## Pick up here\n\nNEW CONTENT.\n");
  const c = cli(root, "--commit", root); show(id, "--commit", c);
  const s = existsSync(join(root, STATE)) ? JSON.parse(readFileSync(join(root, STATE), "utf8")) : null;
  note(id, `--commit exit ${c.status}; committed handoff pick_up is ${JSON.stringify(s?.handoffs?.[0]?.pick_up)} (the draft's, not the fixed file's)`);
}
{
  const id = "PROBE-8 UTF-8 BOM on every judged input, markers in the status blockquote";
  const root = fresh("p8-bom"); project(root, { sessions: [7], bom: true, next: "Updated at end of Session 6.", inbox: "Session 6", task: "Session 6" });
  const d = cli(root, "--draft", root); show(id, "--draft", d);
  console.log(verdictLines(root).map((l) => "     > " + l).join("\n"));
  const c = cli(root, "--commit", root);
  note(id, `draft exit ${d.status}; bare --commit exit ${c.status}, state.json ${existsSync(join(root, STATE))}`);
}
{
  const id = "PROBE-9 CRLF inputs, stale marker";
  const root = fresh("p9-crlf"); project(root, { sessions: [7], next: "Updated at end of Session 6." });
  for (const f of [".agents/SESSIONS/next-session.md", ".agents/TASKS/INBOX.md", ".agents/TASKS/task.md"]) writeFileSync(join(root, f), readFileSync(join(root, f), "utf8").replace(/\n/g, "\r\n"));
  const d = cli(root, "--draft", root);
  console.log(verdictLines(root).map((l) => "     > " + l).join("\n"));
  const c = cli(root, "--commit", root);
  note(id, `draft exit ${d.status}: ${d.out.split(/\r?\n/).find((l) => l.startsWith("Staleness"))}; bare --commit exit ${c.status}`);
}
{
  const id = "PROBE-10 a future-session heading in a stale input (handoff limit 1, false negative)";
  const root = fresh("p10-future"); project(root, { sessions: [7], next: "Updated at end of Session 6.", nextBody: "## Plan for Session 8\n\nLater.\n\n" });
  const d = cli(root, "--draft", root);
  const c = cli(root, "--commit", root);
  note(id, `draft: ${d.out.split(/\r?\n/).find((l) => l.startsWith("Staleness"))}; bare --commit exit ${c.status}`);
}
{
  const id = "PROBE-11 session log with a leading zero or different name";
  const root = fresh("p11-lognames"); project(root, { sessions: [], next: "Updated at end of Session 6." });
  writeFileSync(join(root, ".agents/SESSIONS/Session_007.md"), "# Session 7 — 2026-09-20\n");
  writeFileSync(join(root, ".agents/SESSIONS/session_9.md"), "# Session 9 — 2026-09-21\n");
  const d = cli(root, "--draft", root);
  note(id, `draft: ${d.out.split(/\r?\n/).find((l) => l.startsWith("Current session"))} / ${d.out.split(/\r?\n/).find((l) => l.startsWith("Staleness"))}`);
}

{
  // A single-dash typo is not a `--` flag, so it is taken as the positional directory. It resolves against the cwd
  // and walks up, so when the operator stands in project A and names project B after the typo, A is the target.
  const id = "PROBE-12 single-dash typo before the directory, run from inside ANOTHER drafted project";
  const a = fresh("p12-cwd-project-A"), b = fresh("p12-target-project-B");
  project(a, {}); project(b, { sessions: [7], next: "Updated at end of Session 6." });
  cli(a, "--draft", a); cli(b, "--draft", b);
  const r = cli(a, "--commit", "-accept-stale", b); show(id, `cwd=A: --commit -accept-stale <B>`, r);
  note(id, `exit ${r.status}; A state.json ${existsSync(join(a, STATE))}; B state.json ${existsSync(join(b, STATE))}`);
}

console.log(`\nSUMMARY: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
