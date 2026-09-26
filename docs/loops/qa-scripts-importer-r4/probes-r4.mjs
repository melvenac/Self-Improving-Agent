#!/usr/bin/env node
// QA 122: round 4's R4-1 (an input the importer cannot read blocks a bare --commit like STALE) probed through the
// BUILT CLI, by class. Every INBOX.md shape is WRITTEN BY WINDOWS POWERSHELL 5.1 ITSELF on this PC (cmdlets where
// PS 5.1 has one, .NET encodings through PS 5.1 where it has none), not built as bytes here. Run it against the
// candidate and against round 3 (063662b) with the same arguments, and compare.
// For each shape, a STALE project (INBOX.md declares Session 6, the latest log is Session 7, next-session.md and
// task.md are current) and a CURRENT one (INBOX.md declares Session 7):
//   the bytes (size, NUL count, first NUL); the CLI --draft's exit and its "will REFUSE" lines; the verdict and its
//   could_not_tell reason, read in process from the built module's buildImportDraft (the draft file holds state, not
//   the reasons); a bare --commit's exit, message, and the WHOLE project before and after (sha256, size, mtimeMs,
//   the read-only bit; a read-only file under .agents/notes/ keeps the bit in play); then --commit --accept-stale.
// No shell: spawnSync/spawn with argument arrays. Usage: node probes-r4.mjs <worktree> <scratch-dir>
import { spawnSync, spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, lstatSync, rmSync, chmodSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

if (process.argv.slice(2).length !== 2) { console.error("usage: node probes-r4.mjs <worktree> <scratch>"); process.exit(2); }
const [wt, scratch] = process.argv.slice(2).map((p) => resolve(p));
const CLI = join(wt, "open-brain/build/cli.js");
const mod = await import(pathToFileURL(join(wt, "open-brain/build/pipelines/state-import/index.js")).href);
const STATE = ".agents/state.json", REPORT = ".agents/state.import-report.md";
const INBOX = ".agents/TASKS/INBOX.md", DECISIONS = ".agents/SYSTEM/DECISIONS.md";
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
const head = execFileSync("git", ["-C", wt, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
console.log(`probes-r4 against ${wt} @ ${head}; TEMP=${process.env.TEMP}; today (local) ${today}`);

// ---------------------------------------------------------------- harness
function cli(cwd, ...args) {
  const r = spawnSync(process.execPath, [CLI, "state", "import", ...args], { cwd, encoding: "utf8" });
  return { status: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
}
const msg = (r) => (r.err || r.out).trim().replace(/\r?\n/g, " | ");
/** The whole project: sha256, size, full mtimeMs and the read-only bit per file; directories listed; links as links. */
function tree(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n); const rel = relative(dir, p).replace(/\\/g, "/"); const l = lstatSync(p);
      if (l.isSymbolicLink()) { out.set(rel, "link"); continue; }
      if (l.isDirectory()) { out.set(rel + "/", "dir"); walk(p); continue; }
      out.set(rel, `${createHash("sha256").update(readFileSync(p)).digest("hex")} ${l.size} m${l.mtimeMs}${l.mode & 0o200 ? "" : " RO"}`);
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
let pass = 0, fail = 0;
function check(id, ok, what) { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${what}`); }
function note(id, what) { console.log(`NOTE ${id}: ${what}`); }
const psq = (p) => `'${p.replace(/'/g, "''")}'`;
function ps(command) {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$ErrorActionPreference = 'Stop'; ${command}`], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`powershell exited ${r.status}: ${r.stderr}`);
  return r.stdout;
}
/** Holds `file` open from a separate Windows PowerShell 5.1 process, with the given FileMode, access and share. */
async function hold(file, mode, access, share) {
  const h = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$f = [IO.File]::Open(${psq(file)}, '${mode}', '${access}', '${share}'); [Console]::Out.WriteLine('LOCKED'); [Console]::Out.Flush(); Start-Sleep -Seconds 120; $f.Close()`], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((ok, no) => { let b = ""; h.stdout.on("data", (d) => { b += d; if (b.includes("LOCKED")) ok(); }); h.on("exit", (code) => no(new Error(`holder exited ${code}`))); setTimeout(() => no(new Error("holder timeout")), 30000); });
  return async () => { h.kill(); await new Promise((ok) => setTimeout(ok, 1500)); };
}
const bytesOf = (p) => { const b = readFileSync(p); let nul = 0; for (const x of b) if (x === 0) nul++; return { size: b.length, nul, first: b.indexOf(0), head: b.subarray(0, 8).toString("hex") }; };

// Windows PowerShell 5.1's own text, CRLF as it writes. $base declares Session N; $line is one task added by hand.
const PSV = ps("$PSVersionTable.PSVersion.ToString()").trim();
note("powershell", `Windows PowerShell ${PSV} (powershell.exe) writes every shape below`);
const psBase = (n) => `$base = "# Inbox " + [char]0x2014 + " priorities\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n\`r\`n## P0 " + [char]0x2014 + " Critical\`r\`n\`r\`n- [ ] **A task** " + [char]0x2014 + " do it\`r\`n"; $line = "- [ ] appended " + [char]0x2014 + " by hand"`;
const U8 = "(New-Object System.Text.UTF8Encoding($false))";
/** [name, PS command writing $p, the reading a correct importer should reach: "unreadable" | "readable"] */
const SHAPES = [
  // IF-21's six (the brief's): QA 111's four append shapes, then UTF-16LE and UTF-16BE with no BOM.
  ["UTF-8, then PS 5.1 >>", (p) => `[IO.File]::WriteAllText(${p}, $base, ${U8}); $line >> ${p}`, "if21"],
  ["UTF-8 with a BOM (Out-File -Encoding utf8), then >>", (p) => `$base | Out-File -FilePath ${p} -Encoding utf8 -NoNewline; $line >> ${p}`, "if21"],
  ["Windows-1252 (Set-Content), then >>", (p) => `Set-Content -Path ${p} -Value $base -NoNewline; $line >> ${p}`, "if21"],
  ["UTF-8, then a stray NUL (Add-Content [char]0)", (p) => `[IO.File]::WriteAllText(${p}, $base, ${U8}); Add-Content -Path ${p} -Value ([string][char]0) -NoNewline`, "if21"],
  ["UTF-16LE with no BOM (UnicodeEncoding(false,false))", (p) => `[IO.File]::WriteAllText(${p}, $base, (New-Object System.Text.UnicodeEncoding($false, $false)))`, "if21"],
  ["UTF-16BE with no BOM (UnicodeEncoding(true,false))", (p) => `[IO.File]::WriteAllText(${p}, $base, (New-Object System.Text.UnicodeEncoding($true, $false)))`, "if21"],
  // Other shapes: is each judged as it reads?
  ["a UTF-8 BOM, then UTF-16LE (a BOM-only file, then >>)", (p) => `[IO.File]::WriteAllBytes(${p}, [byte[]](0xEF,0xBB,0xBF)); $base >> ${p}`, "other"],
  ["all NULs (64 bytes)", (p) => `[IO.File]::WriteAllBytes(${p}, (New-Object byte[] 64))`, "other"],
  ["zero bytes (New-Item)", (p) => `New-Item -ItemType File -Path ${p} -Force | Out-Null`, "other"],
  ["zero bytes, then >>", (p) => `New-Item -ItemType File -Path ${p} -Force | Out-Null; $base >> ${p}`, "other"],
  ["UTF-32LE (Set-Content -Encoding UTF32)", (p) => `Set-Content -Path ${p} -Value $base -Encoding UTF32 -NoNewline`, "other"],
  ["UTF-32BE (Set-Content -Encoding BigEndianUTF32)", (p) => `Set-Content -Path ${p} -Value $base -Encoding BigEndianUTF32 -NoNewline`, "other"],
  ["UTF-16LE with a BOM (>), then Add-Content", (p) => `$base > ${p}; Add-Content -Path ${p} -Value $line`, "other"],
  ["UTF-16LE with a BOM (>), then >>", (p) => `$base > ${p}; $line >> ${p}`, "other"],
  ["UTF-7 (Set-Content -Encoding UTF7)", (p) => `Set-Content -Path ${p} -Value $base -Encoding UTF7 -NoNewline`, "other"],
];

function project(root, n) {
  for (const d of ["TASKS", "SYSTEM", "SESSIONS", "notes"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "qa122-probe", version: "0.0.1" }));
  for (const s of [6, 7]) writeFileSync(join(root, `.agents/SESSIONS/Session_${s}.md`), `# Session ${s} — 2026-09-2${s - 4}\n\n> **Status:** Completed\n\nwork of session ${s}\n`);
  writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> **Status:** Session 7\n\n## Architecture\n\nWords.\n");
  writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), "# Next Session Handoff — notes\n\n> Updated at end of Session 7.\n\n## Pick up here\n\nCarry on.\n");
  writeFileSync(join(root, ".agents/TASKS/task.md"), "# Current Focus — work\n\n> **Focus:** Session 7\n\n## Current Objective\n\nShip the thing.\n");
  writeFileSync(join(root, ".agents/notes/readonly.md"), "a read-only file the import must leave read-only\n");
  chmodSync(join(root, ".agents/notes/readonly.md"), 0o444);
  // INBOX.md is written by the caller (PowerShell 5.1).
}
function fresh(name) { const d = join(scratch, name); mkdirSync(d, { recursive: true }); return d; }
function inboxVerdict(root) {
  const i = mod.buildImportDraft(root, today).report.staleness.inputs.find((x) => x.input === INBOX);
  return i ? `${i.verdict}${i.could_not_tell ? `/${i.could_not_tell}` : ""}` : "(not judged)";
}
const refuseLines = (out) => out.split(/\r?\n/).filter((l) => l.includes("will REFUSE")).map((l) => l.replace(/ \(NUL bytes\).*$/, " (NUL bytes)…").replace(/ until those.*$/, " until…"));
/** One project with the shape; returns what each door did. */
function run(label, n, cmd) {
  const root = fresh(label);
  project(root, n);
  const p = join(root, INBOX);
  ps(`${psBase(n)}; ${cmd(psq(p))}`);
  const b = bytesOf(p);
  const d = cli(root, "--draft", root);
  const verdict = inboxVerdict(root);
  const reportLine = existsSync(join(root, REPORT)) ? (readFileSync(join(root, REPORT), "utf8").split(/\r?\n/).find((l) => l.includes("TASKS/INBOX.md") && l.startsWith("- ")) ?? "") : "";
  const before = tree(root);
  const bare = cli(root, "--commit", root);
  const bareDiff = diffTrees(before, tree(root));
  const r = { root, b, draft: d.status, refuse: refuseLines(d.out), verdict, reportLine, bare: bare.status, bareMsg: msg(bare), bareDiff, bareState: existsSync(join(root, STATE)) };
  // The source holds one task, "A task"; how many reached state.json.
  const tasks = () => existsSync(join(root, STATE)) ? JSON.parse(readFileSync(join(root, STATE), "utf8")).tasks.length : null;
  if (bare.status === 0) return { ...r, acc: null, tasks: tasks() };
  const acc = cli(root, "--commit", "--accept-stale", root);
  const ro = lstatSync(join(root, ".agents/notes/readonly.md")).mode & 0o200 ? "writable" : "RO";
  return { ...r, acc: acc.status, accMsg: msg(acc), accState: existsSync(join(root, STATE)), accUnreadable: /Imported UNREADABLE under --accept-stale: \.agents\/TASKS\/INBOX\.md/.test(acc.out), roAfter: ro, tasks: tasks() };
}

// ================================================================ IF-21 and the other shapes
console.log("\n==================== R4-1: each shape, written by Windows PowerShell 5.1, stale (Session 6) and current (Session 7)");
let k = 0;
for (const [shape, cmd, kind] of SHAPES) {
  k++;
  const s6 = run(`s${String(k).padStart(2, "0")}-stale`, 6, cmd);
  const s7 = run(`s${String(k).padStart(2, "0")}-current`, 7, cmd);
  console.log(`---- [${kind}] ${shape}\n     bytes: size ${s6.b.size}, NULs ${s6.b.nul}, first NUL ${s6.b.first}, first bytes ${s6.b.head}`);
  for (const [tag, r] of [["stale  ", s6], ["current", s7]]) {
    console.log(`     ${tag}: draft exit ${r.draft}; INBOX ${r.verdict}; bare --commit exit ${r.bare}, tree ${fmtDiff(r.bareDiff)}, state.json ${r.bareState}` +
      (r.acc === null ? "" : `; --accept-stale exit ${r.acc}, state.json ${r.accState}, UNREADABLE line ${r.accUnreadable}, readonly.md ${r.roAfter}`) +
      `; tasks in state.json ${r.tasks ?? "-"} of 1`);
    if (r.refuse.length) console.log(`              draft says: ${r.refuse.join(" / ")}`);
    console.log(`              report: ${r.reportLine.slice(0, 240)}`);
    if (r.bare !== 0) console.log(`              refusal: ${r.bareMsg.slice(0, 400)}`);
  }
  const named = (r) => r.bareMsg.includes(`${INBOX} contains ${r.b.nul} NUL byte(s), the first at byte ${r.b.first}`) && r.bareMsg.includes("--accept-stale");
  if (kind === "if21") {
    for (const [tag, r] of [["stale", s6], ["current", s7]]) {
      check(`IF-21 ${shape} (${tag})`, r.verdict === "could_not_tell/unreadable" && r.bare === 1 && r.bareDiff.same && !r.bareState && named(r) && r.acc === 0 && r.accState && r.accUnreadable && r.roAfter === "RO",
        `could not tell (unreadable); bare --commit exit 1, whole project identical (sha256, size, mtimeMs, RO bit), refusal names the file, ${r.b.nul} NULs, byte ${r.b.first}, --accept-stale; --accept-stale exit 0 with the UNREADABLE line`);
    }
  } else {
    note(`other ${shape}`, `stale: ${s6.verdict}, bare --commit exit ${s6.bare}, tasks ${s6.tasks ?? "-"} of 1; current: ${s7.verdict}, bare --commit exit ${s7.bare}, tasks ${s7.tasks ?? "-"} of 1`);
  }
}

// ================================================================ held open by another process
console.log("\n==================== an INBOX.md another process holds open (stale project)");
for (const [label, mode, access, share] of [
  ["held with share=None (EBUSY to any reader)", "Open", "Read", "None"],
  ["truncated and held for writing, share=Read (an Out-File in progress)", "Truncate", "Write", "Read"],
  ["held for writing, share=ReadWrite, not truncated", "Open", "Write", "ReadWrite"],
]) {
  const root = fresh(`held-${label.split(" ")[0]}-${share}-${mode}`);
  project(root, 6);
  const p = join(root, INBOX);
  ps(`${psBase(6)}; [IO.File]::WriteAllText(${psq(p)}, $base, ${U8})`);
  const pre = cli(root, "--draft", root); // drafted before the hold, as an operator would have
  const release = await hold(p, mode, access, share);
  let d, verdict = "", bare, diff, st;
  try {
    d = cli(root, "--draft", root);
    try { verdict = inboxVerdict(root); } catch (e) { verdict = `buildImportDraft threw: ${String(e.message).slice(0, 120)}`; }
    const before = tree(root);
    bare = cli(root, "--commit", root);
    diff = diffTrees(before, tree(root));
    st = existsSync(join(root, STATE));
  } finally { await release(); }
  const b = bytesOf(p);
  console.log(`---- ${label}\n     pre-hold draft exit ${pre.status}; held: draft exit ${d.status} (${msg(d).slice(0, 160)}); INBOX ${verdict}\n     bare --commit exit ${bare.status}, tree ${fmtDiff(diff)}, state.json ${st} | ${msg(bare).slice(0, 300)}\n     after release: INBOX.md size ${b.size}`);
  note(`held ${label}`, `verdict ${verdict}; bare --commit exit ${bare.status}; tree ${diff.same ? "identical" : "CHANGED"}; state.json ${st}`);
}

// ================================================================ a NOT-judged input with NUL bytes
console.log("\n==================== DECISIONS.md (not judged) with a decision appended by PS 5.1 >> (current project)");
{
  const root = fresh("decisions-appended");
  project(root, 7);
  ps(`${psBase(7)}; [IO.File]::WriteAllText(${psq(join(root, INBOX))}, $base, ${U8})`);
  const dp = join(root, DECISIONS);
  // importDecisions reads `### ADR-N: title` headings and a `Date:` line (index.ts:317-319).
  ps(`$d = "# Decisions\`r\`n\`r\`n### ADR-1: Use the first thing\`r\`n\`r\`n- **Date:** 2026-09-01\`r\`n\`r\`nBecause.\`r\`n"; [IO.File]::WriteAllText(${psq(dp)}, $d, ${U8}); "\`r\`n### ADR-2: Appended by hand " + [char]0x2014 + " the second\`r\`n\`r\`n- **Date:** 2026-09-20\`r\`n\`r\`nBecause, again." >> ${psq(dp)}`);
  const b = bytesOf(dp);
  const d = cli(root, "--draft", root);
  const rep = mod.buildImportDraft(root, today).report;
  const nj = rep.staleness.not_judged.find((x) => x.input === DECISIONS);
  const before = tree(root);
  const c = cli(root, "--commit", root);
  const diff = diffTrees(before, tree(root));
  let decisions = "(no state.json)", nulInState = false;
  if (existsSync(join(root, STATE))) {
    const raw = readFileSync(join(root, STATE), "utf8");
    nulInState = raw.includes("\\u0000") || raw.includes("\u0000");
    const s = JSON.parse(raw);
    decisions = JSON.stringify((s.decisions ?? []).map((x) => x.id ?? x.title ?? x));
  }
  console.log(`---- DECISIONS.md: size ${b.size}, NULs ${b.nul}, first NUL ${b.first}\n     draft exit ${d.status}; not judged: ${nj?.reason}\n     decisions imported ${rep.decisions?.imported}, skipped ${JSON.stringify(rep.decisions?.skipped ?? []).slice(0, 200)}\n     bare --commit exit ${c.status}, tree ${diff.same ? "identical" : "changed"} | ${msg(c).slice(0, 200)}\n     state.json decisions ${decisions.slice(0, 300)}; NUL in state.json ${nulInState}`);
  note("DECISIONS.md appended by >>", `bare --commit exit ${c.status}; decisions in state.json ${decisions.slice(0, 120)}; NUL in state.json ${nulInState}`);
}

// ================================================================ IF-22: the three reasons that do not block, through the CLI
console.log("\n==================== IF-22: could-not-tell reasons that do not block (bare --commit through the CLI)");
for (const [label, make, want] of [
  ["no session log", (root) => { rmSync(join(root, ".agents/SESSIONS/Session_6.md")); rmSync(join(root, ".agents/SESSIONS/Session_7.md")); }, "no_session_log"],
  ["names no Session N", (root) => writeFileSync(join(root, INBOX), "# Inbox — priorities\n\n## P0 — Critical\n\n- [ ] **A task** — do it\n"), "no_declared_session"],
  ["+13: declares Session 20", (root) => writeFileSync(join(root, INBOX), "# Inbox — priorities\n\n> **Last Updated:** Session 20\n"), "ahead_of_latest"],
  ["+1: declares Session 8", (root) => writeFileSync(join(root, INBOX), "# Inbox — priorities\n\n> **Last Updated:** Session 8\n"), "ahead_of_latest"],
]) {
  const root = fresh(`if22-${want}-${label.replace(/\W+/g, "")}`);
  project(root, 7);
  writeFileSync(join(root, INBOX), "# Inbox — priorities\n\n> **Last Updated:** Session 7\n");
  make(root);
  cli(root, "--draft", root);
  const v = inboxVerdict(root);
  const c = cli(root, "--commit", root);
  check(`IF-22 ${label}`, v === `could_not_tell/${want}` && c.status === 0 && existsSync(join(root, STATE)), `INBOX ${v}; bare --commit exit ${c.status}, state.json ${existsSync(join(root, STATE))}`);
}

console.log(`\nSUMMARY: ${pass} passed, ${fail} failed`);
