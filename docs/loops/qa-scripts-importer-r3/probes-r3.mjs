#!/usr/bin/env node
// QA 111: round 3's protections (R3-1 to R3-3) probed through the BUILT CLI, by class. Run it against the candidate,
// round 2 (aba35de) and round 1 (65e3a89) with the same arguments, and compare.
// No shell: every command is spawnSync/spawn with an argument array. Windows PowerShell 5.1 is used only to WRITE
// files the way this PC's own tools write them, or to hold a file handle open.
// Usage: node probes-r3.mjs <worktree> <scratch-dir>
import { spawnSync, spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, lstatSync, rmSync, chmodSync, cpSync, renameSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";

if (process.argv.slice(2).length !== 2) { console.error("usage: node probes-r3.mjs <worktree> <scratch>"); process.exit(2); }
const [wt, scratch] = process.argv.slice(2).map((p) => resolve(p));
const CLI = join(wt, "open-brain/build/cli.js");
const DRAFT = ".agents/state.draft.json", REPORT = ".agents/state.import-report.md", STATE = ".agents/state.json";
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
const head = execFileSync("git", ["-C", wt, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
console.log(`probes-r3 against ${wt} @ ${head}; TEMP=${process.env.TEMP}`);

// ---------------------------------------------------------------- harness
function cli(cwd, ...args) {
  const r = spawnSync(process.execPath, [CLI, "state", "import", ...args], { cwd, encoding: "utf8" });
  return { status: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
}
const msg = (r) => (r.err || r.out).trim().replace(/\r?\n/g, " | ");
/** Every file and directory under dir: sha256, size, optionally mtime, and the read-only bit; links as links. */
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
const fmtDiff = (d) => d.same ? "identical" : `+${d.added.length} [${d.added.slice(0, 8).join(", ")}] -${d.removed.length} [${d.removed.slice(0, 8).join(", ")}] ~${d.changed.length} [${d.changed.slice(0, 8).join(", ")}]`;
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);
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
const psq = (p) => `'${p.replace(/'/g, "''")}'`;
function ps(command) {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`powershell exited ${r.status}: ${r.stderr}`);
  return r.stdout;
}
/** Holds `file` open from a separate PowerShell 5.1 process. share: 'Read' (QA 106's induction) or 'None'. */
async function hold(file, share) {
  const h = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$f = [IO.File]::Open(${psq(file)}, 'Open', 'Read', '${share}'); [Console]::Out.WriteLine('LOCKED'); [Console]::Out.Flush(); Start-Sleep -Seconds 120; $f.Close()`], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((ok, no) => { let b = ""; h.stdout.on("data", (d) => { b += d; if (b.includes("LOCKED")) ok(); }); h.on("exit", (code) => no(new Error(`holder exited ${code}`))); setTimeout(() => no(new Error("holder timeout")), 30000); });
  return async () => { h.kill(); await new Promise((ok) => setTimeout(ok, 1500)); };
}

// The three judged inputs (QA 106's, em dash in each title) plus SUMMARY.md and two session logs.
const INPUTS = (n) => ({
  ".agents/SESSIONS/next-session.md": `# Next Session Handoff — notes\n\n> Updated at end of Session ${n}.\n\n## Pick up here\n\nCarry on.\n\n## Watch out\n\n- one\n`,
  ".agents/TASKS/INBOX.md": `# Inbox — priorities\n\n> **Last Updated:** Session ${n}\n\n## P0 — Critical\n\n- [ ] **A task** — do it\n`,
  ".agents/TASKS/task.md": `# Current Focus — work\n\n> **Focus:** Session ${n}\n\n## Current Objective\n\nShip the thing.\n`,
});
function project(root, n = 7, write = (p, t) => writeFileSync(p, t)) {
  for (const d of ["TASKS", "SYSTEM", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "qa111-probe", version: "0.0.1" }));
  for (const s of [6, 7]) writeFileSync(join(root, `.agents/SESSIONS/Session_${s}.md`), `# Session ${s} — 2026-09-2${s - 4}\n\n> **Status:** Completed\n\nwork of session ${s}\n`);
  writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> **Status:** Session 7\n\n## Architecture\n\nWords.\n");
  for (const [rel, text] of Object.entries(INPUTS(n))) write(join(root, rel), text);
}
function drafted(name, n = 7) { const root = fresh(name); project(root, n); cli(root, "--draft", root); return root; }
const archiveOf = (root) => join(root, ".agents/archive");
const ls = (d) => existsSync(d) ? readdirSync(d).sort() : [];
/** A fake earlier snapshot, as an operator's or an earlier run's. */
function fakeSnapshot(dir) {
  mkdirSync(join(dir, "SESSIONS"), { recursive: true });
  writeFileSync(join(dir, "SESSIONS/Session_5.md"), "# Session 5 — the only copy of it\n");
  writeFileSync(join(dir, "note.txt"), "an earlier snapshot, which a refusal must not touch\n");
}

// ================================================================ R3-1 / IF-16, IF-17: only what this run created goes
console.log("\n==================== R3-1: a failure removes only what this run created");
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
const SNAP = `pre-state-migration-${today}`;
note("today", `${today} (local), so today's snapshot is ${SNAP}`);
for (const [label, args, n] of [["plain --commit", [], 7], ["--commit --accept-stale, stale project", ["--accept-stale"], 6]]) {
  const id = `IF-16 same-day snapshot + ${label}`;
  const root = drafted(`r31-sameday-${args.length}`, n);
  fakeSnapshot(join(archiveOf(root), SNAP));
  const before = tree(root);
  const r = cli(root, "--commit", ...args, root);
  const d = diffTrees(before, tree(root));
  check(id, r.status === 1 && /already exists/.test(msg(r)) && d.same, `exit ${r.status}; whole project incl. the snapshot, with mtimes and RO bit: ${fmtDiff(d)} | ${msg(r).slice(0, 160)}`);
}
{
  // The snapshot copy itself fails: a file under .agents/ that no input read touches, held open with share=None.
  const cases = [
    ["archive/ absent", () => {}],
    ["archive/ present, empty", (root) => mkdirSync(archiveOf(root), { recursive: true })],
    ["archive/ holds an earlier dated snapshot", (root) => fakeSnapshot(join(archiveOf(root), "pre-state-migration-2026-01-01"))],
    ["--force-snapshot over today's snapshot (the aside)", (root) => fakeSnapshot(join(archiveOf(root), SNAP))],
  ];
  for (const [label, prep] of cases) {
    const id = `R3-1 snapshot copy fails, ${label}`;
    const root = drafted(`r31-copyfail-${cases.findIndex((c) => c[0] === label)}`);
    mkdirSync(join(root, ".agents/notes"), { recursive: true });
    const locked = join(root, ".agents/notes/locked.md"); writeFileSync(locked, "held open with share=None\n");
    prep(root);
    const before = tree(root);
    const release = await hold(locked, "None");
    const r = cli(root, "--commit", ...(label.startsWith("--force") ? ["--force-snapshot"] : []), root);
    await release();
    const d = diffTrees(before, tree(root));
    check(id, r.status === 1 && d.same, `exit ${r.status}; whole project incl. archive/: ${fmtDiff(d)}; archive/ now [${ls(archiveOf(root)).join(", ")}] | ${msg(r).slice(0, 170)}`);
  }
}
{
  // --force-snapshot, today's snapshot present, and a failure AFTER the snapshot (read-only INBOX.md): the aside and
  // the created directory must not overlap, so the aside comes back byte for byte.
  const id = "R3-1 --force-snapshot + render failure: the aside comes back";
  const root = drafted("r31-force-render");
  fakeSnapshot(join(archiveOf(root), SNAP));
  chmodSync(join(root, ".agents/TASKS/INBOX.md"), 0o444);
  const before = tree(root);
  const r = cli(root, "--commit", "--force-snapshot", root);
  const d = diffTrees(before, tree(root));
  check(id, r.status === 1 && d.same, `exit ${r.status}; ${fmtDiff(d)}; archive/ now [${ls(archiveOf(root)).join(", ")}] | ${msg(r).slice(0, 200)}`);
  chmodSync(join(root, ".agents/TASKS/INBOX.md"), 0o644);
}

// ================================================================ R3-2 / IF-18, IF-20: shapes still "could not tell"
console.log("\n==================== R3-2: appended files (Windows PowerShell 5.1 appends onto an existing file)");
// Each input is first written whole, then ONE line is appended the way an operator adds a task by hand.
const cp1252 = (t) => Buffer.from(t.replace(/—/g, "\x97"), "latin1");
const BASES = {
  "utf8": (t) => Buffer.from(t),
  "utf8-bom": (t) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(t)]),
  "cp1252": (t) => cp1252(t.replace(/\n/g, "\r\n")),
};
const APPENDS = {
  ">>": (p) => `'- [ ] appended ' + [char]0x2014 + ' by hand' >> ${psq(p)}`,
  "Add-Content": (p) => `Add-Content -Path ${psq(p)} -Value ('- [ ] appended ' + [char]0x2014 + ' by hand')`,
};
const r32 = [];
for (const [b, enc] of Object.entries(BASES)) for (const [a, cmd] of Object.entries(APPENDS)) {
  const row = { shape: `${b} then PS 5.1 ${a}` };
  for (const n of [6, 7]) {
    const root = fresh(`r32-${b}-${a.replace(/\W/g, "") || "redir"}-s${n}`);
    project(root, n, (p, t) => { writeFileSync(p, enc(t)); ps(cmd(p)); });
    const buf = readFileSync(join(root, ".agents/TASKS/INBOX.md"));
    const nul = buf.indexOf(0);
    const d = cli(root, "--draft", root);
    const c = count(verdicts(root));
    const inbox = verdicts(root).find((l) => l.includes("INBOX")) ?? "(no INBOX line)"; // before --commit moves the report
    const bare = cli(root, "--commit", root);
    row[`s${n}`] = { nul, draft: d.status, ...c, commit: bare.status, state: existsSync(join(root, STATE)), inbox };
  }
  r32.push(row);
  const s = row.s6, c7 = row.s7;
  console.log(`---- ${row.shape} | first NUL at byte ${s.nul}\n     stale  : ${s.stale} stale / ${s.ctt} ctt / ${s.current} current; bare --commit exit ${s.commit}, state.json ${s.state}\n              ${s.inbox.slice(0, 260)}\n     current: ${c7.stale} stale / ${c7.ctt} ctt / ${c7.current} current; bare --commit exit ${c7.commit}`);
  check(`R3-2 class: ${row.shape}`, s.stale === 3 && s.commit === 1 && !s.state, "stale inputs are all STALE, and bare --commit refuses");
}
{
  // A stray NUL in otherwise plain UTF-8 (a crash or a tool's padding), marker line intact.
  const id = "R3-2 class: UTF-8 with one stray NUL at the end";
  const root = fresh("r32-stray-nul");
  project(root, 6, (p, t) => writeFileSync(p, Buffer.concat([Buffer.from(t), Buffer.from([0])])));
  cli(root, "--draft", root); const c = count(verdicts(root)); const inbox = verdicts(root).find((l) => l.includes("INBOX")) ?? "";
  const bare = cli(root, "--commit", root);
  check(id, c.stale === 3 && bare.status === 1, `${c.stale} stale / ${c.ctt} ctt / ${c.current} current; bare --commit exit ${bare.status} | ${inbox.slice(0, 200)}`);
}
{
  // SUMMARY.md is rewritten in place. With NUL bytes (UTF-16LE, no BOM) it must refuse, as a Windows-1252 one does.
  const id = "R3-2 SUMMARY.md as UTF-16LE with no BOM";
  const root = fresh("r32-summary-u16nobom");
  project(root, 7);
  writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), Buffer.from("# Summary\r\n\r\n> **Status:** Session 7\r\n\r\n## Architecture\r\n\r\nWords.\r\n", "utf16le"));
  cli(root, "--draft", root);
  const before = tree(root);
  const c = cli(root, "--commit", root);
  const d = diffTrees(before, tree(root));
  check(id, c.status === 1 && d.same, `--commit exit ${c.status}; tree ${fmtDiff(d)} | ${msg(c).slice(0, 200)}`);
}
{
  // Content, not the verdict: a Windows-1251 (Cyrillic) INBOX, as PowerShell 5.1 writes it on a Russian-locale PC.
  const id = "R3-2 content: a Windows-1251 INBOX item, drafted";
  const root = fresh("r32-cp1251");
  const cp1251 = (t) => Buffer.from([...t].map((ch) => { const c = ch.codePointAt(0); if (c >= 0x410 && c <= 0x44f) return c - 0x410 + 0xc0; if (c === 0x2014) return 0x97; if (c < 0x80) return c; throw new Error(`no 1251 byte for ${ch}`); }));
  project(root, 7);
  writeFileSync(join(root, ".agents/TASKS/INBOX.md"), cp1251("# Inbox — priorities\r\n\r\n> **Last Updated:** Session 7\r\n\r\n## P0 — Critical\r\n\r\n- [ ] **Задача** — сделать\r\n"));
  const d = cli(root, "--draft", root);
  const draft = existsSync(join(root, DRAFT)) ? readFileSync(join(root, DRAFT), "utf8") : "";
  const item = (draft.match(/"title":\s*"([^"]*)"/) ?? [])[1] ?? "(no title field)";
  const ib = verdicts(root).find((l) => l.includes("INBOX")) ?? "";
  note(id, `--draft exit ${d.status}; INBOX verdict: ${ib.slice(0, 220)}; the draft's first item title: ${JSON.stringify(item)} (the source said "Задача")`);
}

// ================================================================ R3-3 / IF-19: QA 106's D7 sequence, step by step
console.log("\n==================== R3-3: the rollback itself fails (SUMMARY.md held open, share=Read), then every re-run");
{
  const id = "IF-19";
  const root = drafted("r33-sequence");
  const agents = join(root, ".agents");
  const orig = tree(agents, { mtime: false }); // the originals, with the draft and the report
  const originals = [...orig].filter(([k, v]) => v !== "dir");
  /** Every original file, byte-identical, live or in any directory under archive/ (a snapshot or an aside). */
  const lost = () => {
    const homes = [agents, ...ls(archiveOf(root)).map((n) => join(archiveOf(root), n)).filter((p) => lstatSync(p).isDirectory())];
    return originals.filter(([k, v]) => !homes.some((h) => existsSync(join(h, k)) && sha(join(h, k)) === v.split(" ")[0])).map(([k]) => k);
  };
  const step = (n, what, r) => {
    const l = lost();
    console.log(`  step ${n} ${what}: exit ${r ? r.status : "-"}; originals lost: ${l.length ? l.join(", ") : "none"}; state.json ${existsSync(join(root, STATE))}; archive/ [${ls(archiveOf(root)).join(", ")}]${r ? `\n         | ${msg(r).slice(0, 420)}` : ""}`);
    return l.length;
  };
  let losses = 0;
  losses += step(0, "drafted", null);
  const release = await hold(join(agents, "SYSTEM/SUMMARY.md"), "Read");
  const c1 = cli(root, "--commit", root);
  await release();
  losses += step(1, "--commit with SUMMARY.md held (share=Read)", c1);
  const liveAfter = diffTrees(new Map([...orig].filter(([k]) => !k.startsWith("archive"))), new Map([...tree(agents, { mtime: false })].filter(([k]) => !k.startsWith("archive"))));
  note(id, `the live tree right after step 1 (outside archive/): ${fmtDiff(liveAfter)}`);
  const d2 = cli(root, "--draft", root); losses += step(2, "--draft", d2);
  const c3 = cli(root, "--commit", root); losses += step(3, "--commit", c3);
  const c4 = cli(root, "--commit", "--force-snapshot", root); losses += step(4, "--commit --force-snapshot", c4);
  const c5 = cli(root, "--commit", "--accept-stale", "--force-snapshot", root); losses += step(5, "--commit --accept-stale --force-snapshot", c5);
  const refusedAll = [d2, c3, c4, c5].every((r) => r.status === 1 && /half-restored/.test(msg(r)));
  check(`${id} re-runs refuse`, refusedAll, `--draft, --commit, --commit --force-snapshot and --commit --accept-stale --force-snapshot all exit 1 with "half-restored"`);
  check(`${id} no original lost`, losses === 0, `at steps 0-5, an original file missing from the live tree and from every directory under archive/: ${losses}`);
  // The way out, exactly as the refusal names it: its snapshot path and its marker path, parsed from the message.
  const m = msg(c3).match(/Restore \.agents\/ by hand from (\S+?)\/?, which holds every original, then delete (\S+?)\. Nothing written/);
  if (!m) { note(id, "the refusal does not name a snapshot and a marker in the expected words; the way out was not followed"); }
  else {
    const [, snapRel, markerRel] = m;
    note(id, `the refusal names the snapshot ${snapRel} (exists ${existsSync(join(root, snapRel))}) and the marker ${markerRel} (exists ${existsSync(join(root, markerRel))})`);
    for (const n of readdirSync(agents)) if (n !== "archive") rmSync(join(agents, n), { recursive: true, force: true });
    for (const n of readdirSync(join(root, snapRel))) cpSync(join(root, snapRel, n), join(agents, n), { recursive: true });
    rmSync(join(root, markerRel));
    const restored = diffTrees(new Map([...orig].filter(([k]) => !k.startsWith("archive"))), new Map([...tree(agents, { mtime: false })].filter(([k]) => !k.startsWith("archive"))));
    check(`${id} the way out restores`, restored.same, `after restoring by hand from the named snapshot and deleting the named marker, the live tree against the original: ${fmtDiff(restored)}`);
    losses += step(6, "restored by hand, marker deleted", null);
    const c7 = cli(root, "--commit", root); losses += step(7, "--commit", c7);
    const c8 = cli(root, "--commit", "--force-snapshot", root); losses += step(8, "--commit --force-snapshot", c8);
    const snapNow = tree(join(archiveOf(root), SNAP), { mtime: false });
    const inSnap = originals.filter(([k, v]) => snapNow.get(k) === v).length;
    check(`${id} completes after the way out`, c8.status === 0 && existsSync(join(root, STATE)) && losses === 0, `--commit --force-snapshot exit ${c8.status}; state.json ${existsSync(join(root, STATE))}; the new snapshot holds ${inSnap} of ${originals.length} originals byte-identical; losses over all steps ${losses}; archive/ [${ls(archiveOf(root)).join(", ")}]`);
  }
}
{
  // A marker left from an EARLIER day refuses today, and two markers are both named.
  const id = "R3-3 a marker from an earlier day";
  const root = drafted("r33-oldmarker");
  mkdirSync(join(archiveOf(root), "pre-state-migration-2026-01-01"), { recursive: true });
  writeFileSync(join(archiveOf(root), "pre-state-migration-2026-01-01.import-incomplete"), "left by a failed rollback\n");
  const before = tree(root);
  const d = cli(root, "--draft", root), c = cli(root, "--commit", root);
  check(id, d.status === 1 && c.status === 1 && /2026-01-01\.import-incomplete/.test(msg(c)) && diffTrees(before, tree(root)).same, `--draft exit ${d.status}, --commit exit ${c.status}; tree ${fmtDiff(diffTrees(before, tree(root)))} | ${msg(c).slice(0, 260)}`);
  writeFileSync(join(archiveOf(root), "pre-state-migration-2026-02-02.import-incomplete"), "a second\n");
  const c2 = cli(root, "--commit", root);
  note("R3-3 two markers", `exit ${c2.status} | ${msg(c2)}`);
}
{
  // A process that died after writing state.json: the marker is read before state.json's own refusal.
  const id = "R3-3 died after state.json";
  const root = drafted("r33-died");
  mkdirSync(join(archiveOf(root), SNAP), { recursive: true });
  writeFileSync(join(archiveOf(root), `${SNAP}.import-incomplete`), "left by a process that died\n");
  writeFileSync(join(root, STATE), "{}\n");
  const d = cli(root, "--draft", root), c = cli(root, "--commit", root);
  check(id, /half-restored/.test(msg(d)) && /half-restored/.test(msg(c)), `--draft exit ${d.status}: ${msg(d).slice(0, 90)} ; --commit exit ${c.status}: ${msg(c).slice(0, 90)}`);
}

console.log(`\nSUMMARY: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
