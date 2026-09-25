#!/usr/bin/env node
// QA 106: round 2's protections (R2-1 to R2-4) probed through the BUILT CLI, by class rather than by instance.
// Run it against the candidate and against round 1 (the control) with the same arguments, and compare.
// No shell: every command is spawnSync/execFileSync with an argument array. PowerShell 5.1 is invoked only to WRITE
// files the way this PC's own tools write them, or to hold a file handle open.
// Usage: node probes-r2.mjs <worktree> <scratch-dir>
import { spawnSync, spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, lstatSync, rmSync, chmodSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

if (process.argv.slice(2).length !== 2) { console.error("usage: node probes-r2.mjs <worktree> <scratch>"); process.exit(2); }
const [wt, scratch] = process.argv.slice(2).map((p) => resolve(p));
const CLI = join(wt, "open-brain/build/cli.js");
const { DRAFT_REL: DRAFT, REPORT_REL: REPORT, STATE_REL: STATE } = await import(pathToFileURL(join(wt, "open-brain/build/pipelines/state-import/index.js")).href);
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
const head = execFileSync("git", ["-C", wt, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
console.log(`probes-r2 against ${wt} @ ${head}; TEMP=${process.env.TEMP}`);

// ---------------------------------------------------------------- harness
function cli(cwd, ...args) {
  const r = spawnSync(process.execPath, [CLI, "state", "import", ...args], { cwd, encoding: "utf8" });
  return { status: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
}
function firstLine(r) { return ((r.err || r.out).split(/\r?\n/).find(Boolean) ?? "").slice(0, 240); }
/** Every file and directory under dir: sha256, size, mtime and the read-only bit, plus symlinks as links. */
function tree(dir, { mtime = true } = {}) {
  const out = new Map();
  if (!existsSync(dir)) return out;
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n); const rel = relative(dir, p).replace(/\\/g, "/"); const l = lstatSync(p);
      if (l.isSymbolicLink()) { out.set(rel, "link"); continue; }
      if (l.isDirectory()) { out.set(rel + "/", "dir"); walk(p); continue; }
      out.set(rel, `${createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16)} ${l.size}${mtime ? " m" + Math.round(l.mtimeMs) : ""}${l.mode & 0o200 ? "" : " RO"}`);
    }
  };
  walk(dir); return out;
}
function diffTrees(a, b) {
  const added = [...b.keys()].filter((k) => !a.has(k)), removed = [...a.keys()].filter((k) => !b.has(k));
  const changed = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k));
  return { added, removed, changed, same: !added.length && !removed.length && !changed.length };
}
const fmtDiff = (d) => d.same ? "identical" : `+${d.added.length} [${d.added.slice(0, 6).join(", ")}] -${d.removed.length} [${d.removed.slice(0, 6).join(", ")}] ~${d.changed.length} [${d.changed.slice(0, 6).join(", ")}]`;
function report(root) { return existsSync(join(root, REPORT)) ? readFileSync(join(root, REPORT), "utf8") : ""; }
function verdicts(root) {
  const lines = report(root).split(/\r?\n/); const s = lines.findIndex((l) => l.startsWith("## ")); let e = s + 1;
  while (e < lines.length && !lines[e].startsWith("## ")) e++;
  return lines.slice(s, e).filter((l) => l.startsWith("- "));
}
const count = (vs) => ({ stale: vs.filter((l) => l.startsWith("- **STALE**")).length, ctt: vs.filter((l) => l.startsWith("- could not tell")).length, current: vs.filter((l) => l.startsWith("- current")).length });
function fresh(name) { const d = join(scratch, name); mkdirSync(d, { recursive: true }); return d; }
let pass = 0, fail = 0;
function check(id, ok, what) { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${what}`); }
function note(id, what) { console.log(`NOTE ${id}: ${what}`); }
function ps(command) {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`powershell exited ${r.status}: ${r.stderr}`);
  return r.stdout;
}
const psq = (p) => `'${p.replace(/'/g, "''")}'`;
const hex = (p, n = 8) => [...readFileSync(p).subarray(0, n)].map((b) => b.toString(16).padStart(2, "0")).join(" ");

// The three judged inputs, as text. An em dash is in each title, as in real projects (A2A-Hub's INBOX has them).
const INPUTS = (n) => ({
  ".agents/SESSIONS/next-session.md": `# Next Session Handoff — notes\n\n> Updated at end of Session ${n}.\n\n## Pick up here\n\nCarry on.\n\n## Watch out\n\n- one\n`,
  ".agents/TASKS/INBOX.md": `# Inbox — priorities\n\n> **Last Updated:** Session ${n}\n\n## P0 — Critical\n\n- [ ] **A task** — do it\n`,
  ".agents/TASKS/task.md": `# Current Focus — work\n\n> **Focus:** Session ${n}\n\n## Current Objective\n\nShip the thing.\n`,
});
function skeleton(root, { sessions = [7], sessionsDir = true } = {}) {
  mkdirSync(join(root, ".agents/TASKS"), { recursive: true });
  mkdirSync(join(root, ".agents/SYSTEM"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "qa106-probe", version: "0.0.1" }));
  if (sessionsDir) {
    mkdirSync(join(root, ".agents/SESSIONS"), { recursive: true });
    for (const n of sessions) writeFileSync(join(root, `.agents/SESSIONS/Session_${n}.md`), `# Session ${n} — 2026-09-20\n\n> **Status:** Completed\n`);
  }
}
function project(root, n, write = (p, t) => writeFileSync(p, t)) {
  skeleton(root);
  for (const [rel, text] of Object.entries(INPUTS(n))) write(join(root, rel), text);
}

// ---------------------------------------------------------------- R2-1: every encoding shape
// Node-built byte shapes, then the shapes Windows PowerShell 5.1 itself writes on this PC.
const cp1252 = (t) => Buffer.from(t.replace(/—/g, "\x97").replace(/–/g, "\x96"), "latin1");
const u16le = (t) => Buffer.from(t, "utf16le");
const u16be = (t) => Buffer.from(t, "utf16le").swap16();
const crlf = (t) => t.replace(/\n/g, "\r\n");
const NODE_SHAPES = {
  "utf8": (t) => Buffer.from(t),
  "utf8-bom": (t) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(t)]),
  "crlf": (t) => Buffer.from(crlf(t)),
  "utf8-bom+crlf": (t) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(crlf(t))]),
  "utf16le-bom": (t) => Buffer.concat([Buffer.from([0xff, 0xfe]), u16le(t)]),
  "utf16le-bom+crlf": (t) => Buffer.concat([Buffer.from([0xff, 0xfe]), u16le(crlf(t))]),
  "utf16be-bom": (t) => Buffer.concat([Buffer.from([0xfe, 0xff]), u16be(t)]),
  "utf16le-nobom": (t) => u16le(t),
  "cp1252 (em dashes)": (t) => cp1252(t),
  "cp1252 (ASCII only)": (t) => cp1252(t.replace(/—/g, "-")),
  "lone CR": (t) => Buffer.from(t.replace(/\n/g, "\r")),
};
const PS_SHAPES = {
  // PowerShell 5.1 defaults: `>` and Out-File write UTF-16LE with a BOM; Set-Content and Add-Content write the ANSI
  // code page (Windows-1252 here); -Encoding UTF8 writes a UTF-8 BOM. All end lines with CRLF.
  "ps51 `>`": (src, dst) => `$t = [IO.File]::ReadAllText(${psq(src)}, [Text.Encoding]::UTF8); $t > ${psq(dst)}`,
  "ps51 Out-File": (src, dst) => `$t = [IO.File]::ReadAllText(${psq(src)}, [Text.Encoding]::UTF8); $t | Out-File -FilePath ${psq(dst)}`,
  "ps51 Set-Content": (src, dst) => `$t = [IO.File]::ReadAllText(${psq(src)}, [Text.Encoding]::UTF8); Set-Content -Path ${psq(dst)} -Value $t`,
  "ps51 Add-Content": (src, dst) => `$t = [IO.File]::ReadAllText(${psq(src)}, [Text.Encoding]::UTF8); Add-Content -Path ${psq(dst)} -Value $t`,
  "ps51 Out-File -Encoding utf8": (src, dst) => `$t = [IO.File]::ReadAllText(${psq(src)}, [Text.Encoding]::UTF8); $t | Out-File -FilePath ${psq(dst)} -Encoding utf8`,
  "ps51 Get-Content|Set-Content (round trip of a UTF-8 file)": (src, dst) => `Get-Content -Path ${psq(src)} | Set-Content -Path ${psq(dst)}`,
};
function writerFor(kind, shape) {
  if (kind === "node") return (p, t) => writeFileSync(p, NODE_SHAPES[shape](t));
  return (p, t) => { const src = p + ".utf8-src"; writeFileSync(src, t); ps(PS_SHAPES[shape](src, p)); rmSync(src); };
}
console.log("\n==================== R2-1 / IF-9: every encoding shape, stale (Session 6 vs log 7) and current (Session 7)");
const r21 = [];
for (const [kind, shapes] of [["node", NODE_SHAPES], ["ps", PS_SHAPES]]) {
  for (const shape of Object.keys(shapes)) {
    const tag = shape.replace(/[^a-zA-Z0-9]+/g, "_");
    const row = { shape };
    for (const n of [6, 7]) {
      const root = fresh(`r21-${kind}-${tag}-s${n}`);
      project(root, n, writerFor(kind, shape));
      const first = hex(join(root, ".agents/TASKS/INBOX.md"));
      const before = tree(root, { mtime: false });
      const d = cli(root, "--draft", root);
      const vs = verdicts(root); const c = count(vs);
      const afterDraft = diffTrees(before, tree(root, { mtime: false }));
      const bare = cli(root, "--commit", root);
      const afterBare = diffTrees(before, tree(root, { mtime: false }));
      const bareWrote = afterBare.added.filter((f) => f !== DRAFT && f !== REPORT).length + afterBare.changed.length + afterBare.removed.length;
      row[`s${n}`] = { first, draft: d.status, ...c, commit: bare.status, bareWrote, state: existsSync(join(root, STATE)), inbox: vs.find((l) => l.includes("INBOX")) ?? "(no INBOX line)" };
      if (n === 6 && bare.status === 1) {
        const ack = cli(root, "--commit", "--accept-stale", root);
        row.s6.ack = ack.status;
      }
    }
    r21.push(row);
    const s6 = row.s6, s7 = row.s7;
    console.log(`---- ${shape} | INBOX bytes ${s6.first}`);
    console.log(`     stale  : draft ${s6.draft}; ${s6.stale} stale / ${s6.ctt} ctt / ${s6.current} current; bare --commit exit ${s6.commit}, wrote ${s6.bareWrote} beyond draft+report, state.json ${s6.state}${s6.ack !== undefined ? `; --accept-stale exit ${s6.ack}` : ""}`);
    console.log(`              INBOX: ${s6.inbox.slice(0, 230)}`);
    console.log(`     current: draft ${s7.draft}; ${s7.stale} stale / ${s7.ctt} ctt / ${s7.current} current; bare --commit exit ${s7.commit}, state.json ${s7.state}`);
    // IF-9 as the brief states it: a stale input is STALE and --commit refuses without the acknowledgement.
    check(`IF-9 ${shape}`, s6.stale === 3 && s6.commit === 1 && s6.bareWrote === 0 && !s6.state, "stale inputs are all STALE, and bare --commit refuses and writes nothing");
  }
}
// IF-9's second clause: the same inputs without a BOM give the same verdicts AND the same evidence.
{
  const base = r21.find((r) => r.shape === "utf8").s6.inbox;
  for (const r of r21) note("IF-9 evidence", `${r.shape}: INBOX evidence ${r.s6.inbox === base ? "IDENTICAL to plain UTF-8" : "DIFFERS"}`);
}

// ---------------------------------------------------------------- R2-1: SUMMARY.md, the one input rewritten in place
console.log("\n==================== R2-1: SUMMARY.md in each shape, current project, --commit");
for (const shape of ["utf8", "utf8-bom", "utf16le-bom+crlf", "cp1252 (em dashes)", "lone CR"]) {
  const root = fresh(`r21-summary-${shape.replace(/[^a-zA-Z0-9]+/g, "_")}`);
  project(root, 7);
  writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), NODE_SHAPES[shape]("# Project Summary — overview\n\n> **Status:** Session 7 — all good\n> second status line\n\n## Architecture\n\nWords.\n"));
  cli(root, "--draft", root);
  const before = tree(root, { mtime: false });
  const c = cli(root, "--commit", root);
  const after = diffTrees(before, tree(root, { mtime: false }));
  const s = readFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"));
  const text = s.toString("utf8"); const lines = text.split(/\r?\n/);
  const titleAt = lines.findIndex((l) => l.startsWith("# ")), beginAt = lines.findIndex((l) => l.includes("<!-- state:begin -->"));
  // The ORIGINAL status blockquote says "all good"; the rendered region has its own **Status:** line.
  note(`R2-1 SUMMARY ${shape}`, `--commit exit ${c.status} (${firstLine(c).slice(0, 150)}); after: first bytes ${hex(join(root, ".agents/SYSTEM/SUMMARY.md"), 4)}; title at line ${titleAt + 1}, region begins at line ${beginAt + 1}; original status blockquote still present: ${text.includes("all good") || text.includes("second status line")}; tree ${c.status === 0 ? "(migrated)" : fmtDiff(after)}`);
}

// ---------------------------------------------------------------- R2-2 / IF-10
console.log("\n==================== R2-2 / IF-10: declared session against log 7");
for (const [label, n] of [["ahead by 13", 20], ["ahead by 1", 8], ["equal", 7], ["behind by 1", 6]]) {
  const root = fresh(`r22-${n}`);
  project(root, 7);
  writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), `# Next Session Handoff\n\n> Updated at end of Session ${n}.\n\n## Pick up here\n\nCarry on.\n`);
  cli(root, "--draft", root);
  const line = verdicts(root).find((l) => l.includes("next-session")) ?? "(none)";
  const c = cli(root, "--commit", root);
  note(`IF-10 ${label}`, `${line.slice(0, 330)} || bare --commit exit ${c.status}${c.out.includes("Could not tell") ? ", prints the could-not-tell line" : ""}`);
}
{
  // A handoff written at the END of Session 7 FOR Session 8 is the common shape; how is it read now?
  const root = fresh("r22-handoff-for-next");
  project(root, 7);
  writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), "# Handoff for Session 8\n\n## Pick up here\n\nCarry on.\n");
  cli(root, "--draft", root);
  note("IF-10 title 'Handoff for Session 8', log 7", verdicts(root).find((l) => l.includes("next-session"))?.slice(0, 200) ?? "(none)");
}

// ---------------------------------------------------------------- R2-3 / IF-11
console.log("\n==================== R2-3 / IF-11: complete, or change nothing");
function drafted(name, n = 7) { const root = fresh(name); project(root, n); writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> **Status:** Session 7\n\n## Architecture\n\nWords.\n"); cli(root, "--draft", root); return root; }
{
  const id = "IF-11 PROBE-2 (no SESSIONS/)";
  const root = fresh("r23-nosessions"); skeleton(root, { sessionsDir: false });
  for (const [rel, text] of Object.entries(INPUTS(7))) if (!rel.includes("SESSIONS")) writeFileSync(join(root, rel), text);
  cli(root, "--draft", root);
  const c = cli(root, "--commit", root);
  const views = [".agents/TASKS/INBOX.md", ".agents/TASKS/task.md", ".agents/SESSIONS/next-session.md", ".agents/SYSTEM/SUMMARY.md"].map((v) => `${v.split("/").pop()} ${existsSync(join(root, v))}`);
  check(id, c.status === 0 && existsSync(join(root, STATE)) && views.every((v) => v.endsWith("true")), `--commit exit ${c.status}; state.json ${existsSync(join(root, STATE))}; views: ${views.join(", ")}`);
  const again = cli(root, "--commit", root);
  note(id, `a second --commit: exit ${again.status}: ${firstLine(again)}`);
}
{
  // An induced failure the developer did not use: INBOX.md read-only, so the RENDER step (tmp + rename over it) fails.
  const id = "IF-11 read-only INBOX.md (render step fails)";
  const root = drafted("r23-ro-inbox");
  chmodSync(join(root, ".agents/TASKS/INBOX.md"), 0o444);
  const before = tree(root, { mtime: false }), beforeM = tree(root);
  const c = cli(root, "--commit", root);
  const after = diffTrees(before, tree(root, { mtime: false })), afterM = diffTrees(beforeM, tree(root));
  console.log(`---- ${id}: exit ${c.status}\n     | ${(c.err || c.out).trim().split(/\r?\n/).join("\n     | ")}`);
  check(id, c.status === 1 && after.same, `the tree is byte-identical to before, including the read-only bit (${fmtDiff(after)})`);
  note(id, `with mtimes compared too: ${fmtDiff(afterM)}`);
  chmodSync(join(root, ".agents/TASKS/INBOX.md"), 0o644);
  const again = cli(root, "--commit", root);
  check(id, again.status === 0 && existsSync(join(root, STATE)), `made writable, the second --commit completes (exit ${again.status})`);
}
{
  // --force-snapshot with a failure: the earlier snapshot must come back as it was, and nothing named .replaced-* stays.
  const id = "IF-11 --force-snapshot + render failure";
  const root = drafted("r23-force");
  for (const day of ["2026-09-24", "2026-09-25", "2026-09-26"]) { mkdirSync(join(root, `.agents/archive/pre-state-migration-${day}`), { recursive: true }); writeFileSync(join(root, `.agents/archive/pre-state-migration-${day}/EARLIER.txt`), `earlier snapshot ${day}\n`); }
  chmodSync(join(root, ".agents/TASKS/INBOX.md"), 0o444);
  const before = tree(root, { mtime: false });
  const c = cli(root, "--commit", "--force-snapshot", root);
  const after = diffTrees(before, tree(root, { mtime: false }));
  check(id, c.status === 1 && after.same, `exit ${c.status}; tree ${fmtDiff(after)}`);
  chmodSync(join(root, ".agents/TASKS/INBOX.md"), 0o644);
}
{
  // A directory junction inside .agents/ (mklink /J needs no privilege). What do the snapshot and the rollback do to
  // the junction's TARGET, which lies outside the project?
  const id = "IF-11 junction inside .agents/ + render failure";
  const root = drafted("r23-junction");
  const target = fresh("r23-junction-TARGET"); writeFileSync(join(target, "precious.txt"), "outside the project\n");
  const mk = spawnSync("cmd.exe", ["/c", "mklink", "/J", join(root, ".agents", "linked"), target], { encoding: "utf8" });
  note(id, `mklink /J exit ${mk.status}: ${(mk.stdout + mk.stderr).trim()}`);
  chmodSync(join(root, ".agents/TASKS/INBOX.md"), 0o444);
  const tBefore = tree(target, { mtime: false });
  const c = cli(root, "--commit", root);
  console.log(`---- ${id}: exit ${c.status}\n     | ${(c.err || c.out).trim().split(/\r?\n/).join("\n     | ")}`);
  const tAfter = diffTrees(tBefore, tree(target, { mtime: false }));
  check(id, tAfter.same, `the junction's target outside the project is untouched (${fmtDiff(tAfter)})`);
  note(id, `.agents/linked after: ${existsSync(join(root, ".agents/linked")) ? (lstatSync(join(root, ".agents/linked")).isSymbolicLink() ? "still a link" : "a REAL directory now") : "GONE"}; archive/ exists ${existsSync(join(root, ".agents/archive"))}`);
  chmodSync(join(root, ".agents/TASKS/INBOX.md"), 0o644);
}
{
  // The rollback ITSELF failing (the dispatch: induce it if you can). PowerShell holds SUMMARY.md open for read and
  // shares read only: the importer can read and snapshot it, but not rewrite it (the first failure) and not delete it
  // (the rollback's rmSync). What is the project left as, and does the message tell the truth?
  const id = "IF-11 the rollback itself fails (SUMMARY.md held open, share=Read)";
  const root = drafted("r23-rollback-fails");
  const before = tree(root, { mtime: false });
  const summary = join(root, ".agents/SYSTEM/SUMMARY.md");
  const holder = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$f = [IO.File]::Open(${psq(summary)}, 'Open', 'Read', 'Read'); [Console]::Out.WriteLine('LOCKED'); [Console]::Out.Flush(); Start-Sleep -Seconds 90; $f.Close()`], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((ok, no) => { let b = ""; holder.stdout.on("data", (d) => { b += d; if (b.includes("LOCKED")) ok(); }); holder.on("exit", (code) => no(new Error(`holder exited ${code}`))); setTimeout(() => no(new Error("holder timeout")), 30000); });
  const c = cli(root, "--commit", root);
  holder.kill(); await new Promise((ok) => setTimeout(ok, 1500));
  console.log(`---- ${id}: exit ${c.status}\n     | ${(c.err || c.out).trim().split(/\r?\n/).join("\n     | ")}`);
  const after = diffTrees(before, tree(root, { mtime: false }));
  const live = (d) => ({ added: d.added.filter((f) => !f.includes("/archive/") && f !== ".agents/archive/"), removed: d.removed, changed: d.changed });
  const lv = live(after);
  note(id, `the live tree (outside archive/) right after the failure: REMOVED ${lv.removed.length} [${lv.removed.join(", ")}]; added ${lv.added.length} [${lv.added.join(", ")}]; changed ${lv.changed.length} [${lv.changed.join(", ")}]`);
  const snaps = existsSync(join(root, ".agents/archive")) ? readdirSync(join(root, ".agents/archive")) : [];
  note(id, `archive/: ${snaps.join(", ") || "(none)"}`);
  const snapDir = snaps.length ? join(root, ".agents/archive", snaps[0]) : null;
  if (snapDir) {
    const snap = tree(snapDir, { mtime: false });
    const orig = new Map([...before].filter(([k]) => k.startsWith(".agents/") && k !== ".agents/").map(([k, v]) => [k.slice(8), v]));
    const missing = [...orig].filter(([k, v]) => snap.get(k) !== v).map(([k]) => k);
    note(id, `the kept snapshot holds ${snap.size} entries; original .agents entries missing or differing in it: ${missing.length}${missing.length ? " " + missing.join(",") : ""}`);
  }
  // The operator path the tool's own messages lead to, if the operator re-runs instead of restoring by hand.
  const kept = () => snapDir && existsSync(join(snapDir, "SESSIONS/Session_7.md")) ? "the kept snapshot still holds Session_7.md" : "the kept snapshot NO LONGER holds Session_7.md";
  const d2 = cli(root, "--draft", root);
  const d2line = d2.out.split(/\r?\n/).find((l) => l.startsWith("Current session")) ?? "";
  note(id, `re-run 1, --draft: exit ${d2.status}; ${d2line}; staleness line: ${d2.out.split(/\r?\n/).find((l) => l.startsWith("Staleness")) ?? ""}; ${kept()}`);
  const c2 = cli(root, "--commit", root);
  note(id, `re-run 2, --commit: exit ${c2.status}: ${firstLine(c2)}; ${kept()}; snapshot directory exists: ${snapDir ? existsSync(snapDir) : "n/a"}`);
  const c3 = cli(root, "--commit", "--force-snapshot", root);
  note(id, `re-run 3, --commit --force-snapshot, as re-run 2's refusal advises: exit ${c3.status}: ${firstLine(c3).slice(0, 200)}`);
  if (snapDir) {
    const now = tree(snapDir, { mtime: false });
    const lost = ["SESSIONS/Session_7.md", "SESSIONS/next-session.md"].filter((f) => !now.has(f) && !existsSync(join(root, ".agents", f)));
    note(id, `after re-run 3: the snapshot now holds ${now.size} entries; the session files from before the import that exist NOWHERE in the project any more: ${lost.length ? lost.join(", ") : "none"}`);
  }
}

// ---------------------------------------------------------------- R2-4 / IF-12
console.log("\n==================== R2-4 / IF-12: tokens, before and after the flag, standing in ANOTHER drafted project");
{
  const A = drafted("r24-A-cwd"), B = drafted("r24-B-named"), C = drafted("r24-C-other");
  const snap = () => ({ A: tree(A), B: tree(B), C: tree(C) });
  const TOKENS = { "-x": "-x", "x": "x", "second positional (another project)": C, "non-existent directory": join(scratch, "no-such-dir") };
  const perms = (xs) => xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
  let bad = 0, runs = 0;
  for (const mode of ["--draft", "--commit"]) {
    for (const [label, tok] of Object.entries(TOKENS)) {
      // Without B, "another project" is the ONLY positional: a valid run on C, not a mis-target (the first run of this
      // script counted it as one). It is covered by the control below instead.
      const orders = label.startsWith("second positional") ? perms(["F", "T", "B"]) : [...perms(["F", "T", "B"]), ["T", "F"], ["F", "T"]];
      for (const o of orders) {
        const args = o.map((k) => (k === "F" ? mode : k === "T" ? tok : B));
        const before = snap(); const r = cli(A, ...args); const after = snap(); runs++;
        const dA = diffTrees(before.A, after.A), dB = diffTrees(before.B, after.B), dC = diffTrees(before.C, after.C);
        const ok = r.status === 1 && dA.same && dB.same && dC.same;
        if (!ok) bad++;
        console.log(`${ok ? "ok  " : "BAD "} ${mode} ${label.padEnd(36)} [${o.join(" ")}] exit ${r.status}; A ${dA.same ? "=" : "CHANGED"} B ${dB.same ? "=" : "CHANGED"} C ${dC.same ? "=" : "CHANGED"} | ${firstLine(r).replace(scratch, "<scratch>").replace(scratch, "<scratch>").slice(0, 150)}`);
      }
    }
  }
  check("IF-12 matrix", bad === 0, `${runs} runs: every one exits 1 and leaves A, B and C unchanged (hash, size, mtime, read-only bit); ${bad} did not`);
  // Controls and edges, each on FRESH drafted projects so that one edge's effect cannot hide another's.
  let k = 0;
  const edge = (label, args, expect) => {
    const a = drafted(`r24-edge${k}-A-cwd`), b = drafted(`r24-edge${k}-B-named`); k++;
    const argv = args.map((x) => (x === "<B>" ? b : x === "<B>/package.json" ? join(b, "package.json") : x === "<B>/.agents/TASKS" ? join(b, ".agents/TASKS") : x));
    const tA = tree(a), tB = tree(b); const r = cli(a, ...argv);
    const d = { A: diffTrees(tA, tree(a)).same, B: diffTrees(tB, tree(b)).same };
    note(`IF-12 ${label}`, `${JSON.stringify(args)} exit ${r.status}; changed: ${Object.entries(d).filter(([, s]) => !s).map(([x]) => x).join(",") || "none"} | ${firstLine(r).replace(scratch, "<scratch>").slice(0, 160)} [expected: ${expect}]`);
    return { r, d, b };
  };
  edge("'' (an empty argument, as an unset \"$DIR\" gives)", ["--commit", ""], "refuse, or at least not A");
  edge("'' before a real directory", ["--commit", "", "<B>"], "refuse");
  edge("'-' alone", ["--commit", "-", "<B>"], "refuse");
  edge("'--' (end of options)", ["--commit", "--", "<B>"], "refuse");
  edge("an existing FILE as the directory", ["--commit", "<B>/package.json"], "refuse");
  edge("B's own subdirectory .agents/TASKS (walk-up kept by design)", ["--draft", "<B>/.agents/TASKS"], "B only (a draft rewrite)");
  edge("the same directory twice", ["--commit", "<B>", "<B>"], "refuse (conservative) or B");
  const ctl = edge("control: --commit <B> from A", ["--commit", "<B>"], "B only");
  check("IF-12 control", ctl.r.status === 0 && ctl.d.A && !ctl.d.B && ctl.r.out.includes(`Root: ${ctl.b}`), "the named project, and only it, is committed, and the output names its root");
  const ctlC = edge("control: <C> alone, flag after (the matrix's excluded orders)", ["<B>", "--commit"], "B only");
  check("IF-12 control, directory before the flag", ctlC.r.status === 0 && ctlC.d.A && !ctlC.d.B, "a single named project before the flag is committed, and nothing else");
}

console.log(`\nSUMMARY: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
