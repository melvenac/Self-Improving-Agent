#!/usr/bin/env node
// QA 153: R5-1 and R5-2 on the importer leftovers round 5. Every input written by Windows PowerShell 5.1 (cmdlets
// where PS has one, .NET through PS where it has none). For each case: the bytes; the in-process verdict, evidence,
// not_judged, decisions_unreadable and last_session from the built module; the CLI --draft's stdout (every line that
// names the input or the refusal); a whole-tree hash around a bare --commit; its exit and first stderr line; state.json.
// Usage: node r5-qa153.mjs <worktree> <scratch> [filter]
import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, lstatSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const [wt, scratch] = process.argv.slice(2, 4).map((p) => resolve(p));
const filter = process.argv[4] ?? "";
const CLI = join(wt, "open-brain/build/cli.js");
const mod = await import(pathToFileURL(join(wt, "open-brain/build/pipelines/state-import/index.js")).href);
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
const head = execFileSync("git", ["-C", wt, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
console.log(`r5-qa153 against ${wt} @ ${head}; TEMP=${process.env.TEMP}; today (local) ${today}`);

const cli = (cwd, ...a) => { const r = spawnSync(process.execPath, [CLI, "state", "import", ...a], { cwd, encoding: "utf8" }); return { status: r.status, out: r.stdout ?? "", err: r.stderr ?? "" }; };
function tree(dir) {
  const out = new Map();
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); const rel = relative(dir, p).replace(/\\/g, "/"); const l = lstatSync(p); if (l.isDirectory()) { out.set(rel + "/", "dir"); walk(p); } else out.set(rel, `${createHash("sha256").update(readFileSync(p)).digest("hex")} ${l.size} m${l.mtimeMs}`); } };
  walk(dir); return out;
}
const same = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
const psq = (p) => `'${p.replace(/'/g, "''")}'`;
function ps(command) {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$ErrorActionPreference = 'Stop'; ${command}`], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`powershell exited ${r.status}: ${r.stderr}`);
  return r.stdout;
}
const bytesOf = (p) => { const b = readFileSync(p); let nul = 0; for (const x of b) if (x === 0) nul++; return `size ${b.length}${b.length % 2 ? " (ODD)" : ""}, head ${b.subarray(0, 8).toString("hex")}, NULs ${nul}`; };
let pass = 0, fail = 0;
const check = (id, ok, what) => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${what}`); };
const ENC_CLAIM = /encoding|UTF-7|UTF-8|UTF-16|UTF-32|byte-order|1252/i;

console.log(`NOTE powershell: Windows PowerShell ${ps("$PSVersionTable.PSVersion.ToString()").trim()} writes every input`);
const REL = { inbox: ".agents/TASKS/INBOX.md", task: ".agents/TASKS/task.md", next: ".agents/SESSIONS/next-session.md", decisions: ".agents/SYSTEM/DECISIONS.md", log: ".agents/SESSIONS/Session_7.md", summary: ".agents/SYSTEM/SUMMARY.md" };
const M = "[char]0x2014";
const U8 = "(New-Object System.Text.UTF8Encoding($false))";
// PS expressions for texts; $n substituted.
const T = {
  inbox: (n) => `"# Inbox " + ${M} + " priorities\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n\`r\`n## P0 " + ${M} + " Critical\`r\`n\`r\`n- [ ] **A task** " + ${M} + " do it\`r\`n"`,
  task: (n) => `"# Current Focus " + ${M} + " work\`r\`n\`r\`n> **Focus:** Session ${n}\`r\`n\`r\`n## Current Objective\`r\`n\`r\`nShip the thing.\`r\`n"`,
  next: (n) => `"# Next Session Handoff " + ${M} + " notes\`r\`n\`r\`n> Updated at end of Session ${n}.\`r\`n\`r\`n## Pick up here\`r\`n\`r\`nCarry on.\`r\`n"`,
  next_h2: (n) => `"## Pick up here (Session ${n})\`r\`n\`r\`nCarry on.\`r\`n\`r\`n## Watch out for\`r\`n\`r\`n- the hold\`r\`n"`,
  inbox_h2_head: (n) => `"## P0 (Session ${n})\`r\`n\`r\`n- [ ] **A task** - do it\`r\`n"`,
  inbox_h2_quote: (n) => `"## P0\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n\`r\`n- [ ] **A task** - do it\`r\`n"`,
  inbox_h6: (n) => `"###### Inbox (Session ${n})\`r\`n\`r\`n- [ ] **A task** - do it\`r\`n"`,
  inbox_h7: (n) => `"####### Inbox (Session ${n})\`r\`n\`r\`n- [ ] **A task** - do it\`r\`n"`,
  next_bold: (n) => `"**Pick up here:** Session ${n}: carry on.\`r\`n**Watch out for:** the hold.\`r\`n"`,
  inbox_nospace: (n) => `"#Inbox\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n"`,
  inbox_tab: (n) => `"#\`tInbox\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n"`,
  inbox_indent: (n) => `"  # Inbox\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n"`,
  inbox_setext: (n) => `"Inbox\`r\`n=====\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n"`,
  inbox_1252: (n) => `"Inbox, caf" + [char]0xE9 + "\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n"`,
  decisions: () => `"# Decisions\`r\`n\`r\`n### ADR-1: decision 1\`r\`n\`r\`n- **Date:** 2026-01-01\`r\`n\`r\`nWe chose 1.\`r\`n"`,
  log7: () => `"# Session 7 " + ${M} + " 2026-09-23\`r\`n\`r\`n> **Status:** Completed\`r\`n\`r\`nwork of session 7\`r\`n"`,
  summary: () => `"# Summary\`r\`n\`r\`n> **Status:** Session 7\`r\`n\`r\`n## Architecture\`r\`n\`r\`nWords.\`r\`n"`,
};
// Writers: how PS puts text $t at path $p.
const W = {
  utf8: (p, t) => `[IO.File]::WriteAllText(${p}, ${t}, ${U8})`,
  setcontent: (p, t) => `Set-Content -Path ${p} -Value (${t}) -NoNewline`,
  outfile_utf8: (p, t) => `(${t}) | Out-File -FilePath ${p} -Encoding utf8 -NoNewline`,
  redirect: (p, t) => `(${t}) > ${p}`,
  utf7: (p, t) => `Set-Content -Path ${p} -Value (${t}) -Encoding UTF7 -NoNewline`,
  // FE FF, then UTF-8 text, padded to an odd length with one space if it came out even.
  febe_utf8_odd: (p, t) => `$b = [Text.Encoding]::UTF8.GetBytes(${t}); if (($b.Length + 2) % 2 -eq 0) { $b += [byte]0x20 }; [IO.File]::WriteAllBytes(${p}, [byte[]](@(0xFE,0xFF) + $b))`,
  // A genuine UTF-16BE file (Set-Content -Encoding BigEndianUnicode), then ONE byte appended by .NET.
  be_plus_byte: (p, t) => `Set-Content -Path ${p} -Value (${t}) -Encoding BigEndianUnicode -NoNewline; $f = [IO.File]::Open(${p}, 'Append'); $f.WriteByte(0x0A); $f.Close()`,
  // The LE mirror of be_plus_byte: a genuine UTF-16LE file (>) with one byte appended (guard: judged as it reads).
  le_plus_byte: (p, t) => `(${t}) > ${p}; $f = [IO.File]::Open(${p}, 'Append'); $f.WriteByte(0x0A); $f.Close()`,
  febe_only: (p) => `[IO.File]::WriteAllBytes(${p}, [byte[]](0xFE,0xFF))`,
  febe_one: (p) => `[IO.File]::WriteAllBytes(${p}, [byte[]](0xFE,0xFF,0x23))`,
  bom_then_feff: (p, t) => `([string][char]0xFEFF + ${t}) | Out-File -FilePath ${p} -Encoding utf8 -NoNewline`,
};

function project(root) {
  for (const d of ["TASKS", "SYSTEM", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "qa153-r5", version: "0.0.1" }));
  for (const s of [6, 7]) writeFileSync(join(root, `.agents/SESSIONS/Session_${s}.md`), `# Session ${s} — 2026-09-2${s - 4}\n\n> **Status:** Completed\n\nwork of session ${s}\n`);
  writeFileSync(join(root, REL.summary), "# Summary\n\n> **Status:** Session 7\n\n## Architecture\n\nWords.\n");
  writeFileSync(join(root, REL.next), "# Next Session Handoff — notes\n\n> Updated at end of Session 7.\n\n## Pick up here\n\nCarry on.\n");
  writeFileSync(join(root, REL.task), "# Current Focus — work\n\n> **Focus:** Session 7\n\n## Current Objective\n\nShip the thing.\n");
  writeFileSync(join(root, REL.inbox), "# Inbox — priorities\n\n> **Last Updated:** Session 7\n\n## P0 — Critical\n\n- [ ] **A task** — do it\n");
}

// [id, target, writer, text key, expect]; expect is a function of the per-n results, or "observe".
const J = (want6, want7) => (g) => g[0].verdict === want6 && g[1].verdict === want7;
const judgedAsReads = (g) => g[0].verdict === "stale" && g[0].bare === 1 && g[1].verdict === "current" && g[1].bare === 0 && g[1].state;
const blockedNoClaim = (g) => g.every((x) => x.verdict === "could_not_tell/unreadable" && x.bare === 1 && x.identical && !x.state && /has no heading line/.test(x.evidence) && !ENC_CLAIM.test(x.evidence));
const blockedOdd = (g) => g.every((x) => x.verdict === "could_not_tell/unreadable" && x.bare === 1 && x.identical && !x.state && new RegExp(`UTF-16BE byte-order mark \\(FE FF\\), but an odd number of bytes \\(${x.size}\\)`).test(x.evidence) && x.commitMsg.includes("has a UTF-16BE byte-order mark (FE FF), but an odd number of bytes"));
const CASES = [
  // R5-1: a `##`-only file is judged by its heading, whichever PS writer made it.
  ["R5-1 next-session.md `##` sections only, UTF-8 (.NET)", "next", "utf8", "next_h2", judgedAsReads],
  ["R5-1 next-session.md `##` sections only, Set-Content (ANSI; ASCII text)", "next", "setcontent", "next_h2", judgedAsReads],
  ["R5-1 next-session.md `##` sections only, Out-File -Encoding utf8 (BOM)", "next", "outfile_utf8", "next_h2", judgedAsReads],
  ["R5-1 next-session.md `##` sections only, PS 5.1 `>` (UTF-16LE BOM)", "next", "redirect", "next_h2", judgedAsReads],
  ["R5-1 INBOX.md `##` only, session in the heading", "inbox", "utf8", "inbox_h2_head", judgedAsReads],
  ["R5-1 INBOX.md `##` only, session in the blockquote only (not declared: blockquote read under `# ` only)", "inbox", "utf8", "inbox_h2_quote", J("could_not_tell/no_declared_session", "could_not_tell/no_declared_session")],
  ["R5-1 INBOX.md `###### ` (level 6)", "inbox", "utf8", "inbox_h6", judgedAsReads],
  // R5-1: still blocked, and a file read as valid UTF-8 makes no encoding claim.
  ["R5-1 INBOX.md `####### ` (seven): no heading line", "inbox", "utf8", "inbox_h7", blockedNoClaim],
  ["R5-1 next-session.md /end A7 as bold lines: no heading line", "next", "utf8", "next_bold", blockedNoClaim],
  ["R5-1 INBOX.md `#Inbox`", "inbox", "utf8", "inbox_nospace", blockedNoClaim],
  ["R5-1 INBOX.md `#<TAB>Inbox`", "inbox", "utf8", "inbox_tab", blockedNoClaim],
  ["R5-1 INBOX.md `  # Inbox` (indented)", "inbox", "utf8", "inbox_indent", blockedNoClaim],
  ["R5-1 INBOX.md setext", "inbox", "utf8", "inbox_setext", blockedNoClaim],
  ["R5-1 INBOX.md `#Inbox`, Out-File -Encoding utf8 (BOM path)", "inbox", "outfile_utf8", "inbox_nospace", blockedNoClaim],
  ["R5-1 INBOX.md a U+FEFF inside the text, then `# Inbox` (Out-File utf8: two marks)", "inbox", "bom_then_feff", "inbox", "observe"],
  ["R5-1 INBOX.md UTF-7 (Set-Content -Encoding UTF7)", "inbox", "utf7", "inbox", (g) => g.every((x) => x.verdict === "could_not_tell/unreadable" && x.bare === 1 && x.identical && !x.state)],
  ["R5-1 task.md UTF-7", "task", "utf7", "task", (g) => g.every((x) => x.verdict === "could_not_tell/unreadable" && x.bare === 1 && x.identical)],
  ["R5-1 next-session.md UTF-7", "next", "utf7", "next", (g) => g.every((x) => x.verdict === "could_not_tell/unreadable" && x.bare === 1 && x.identical)],
  ["R5-1 INBOX.md Windows-1252 (Set-Content, an e-acute), no heading: the encoding sentence stays", "inbox", "setcontent", "inbox_1252", (g) => g.every((x) => x.verdict === "could_not_tell/unreadable" && x.bare === 1 && /encoding/.test(x.evidence))],
  ["R5-1 next-session.md bold lines, PS 5.1 `>` (a GENUINE UTF-16LE file with no heading)", "next", "redirect", "next_bold", "observe"],
  // R5-2: odd length under FE FF.
  ["R5-2 INBOX.md FE FF then UTF-8, odd (.NET)", "inbox", "febe_utf8_odd", "inbox", blockedOdd],
  ["R5-2 task.md FE FF then UTF-8, odd (.NET)", "task", "febe_utf8_odd", "task", blockedOdd],
  ["R5-2 next-session.md FE FF then UTF-8, odd (.NET)", "next", "febe_utf8_odd", "next", blockedOdd],
  ["R5-2 INBOX.md a genuine UTF-16BE file (Set-Content BigEndianUnicode), then one byte appended", "inbox", "be_plus_byte", "inbox", blockedOdd],
  ["R5-2 guard: INBOX.md a genuine UTF-16LE file (>), then one byte appended", "inbox", "le_plus_byte", "inbox", "observe"],
  ["R5-2 INBOX.md FE FF alone (2 bytes)", "inbox", "febe_only", "inbox", (g) => g.every((x) => x.verdict === "could_not_tell/unreadable" && x.bare === 1 && /it is empty/.test(x.evidence))],
  ["R5-2 INBOX.md FE FF 23 (3 bytes)", "inbox", "febe_one", "inbox", blockedOdd],
];
// Not-judged inputs of the R5-2 shape: a CURRENT project only (n = 7), since nothing else should block.
const NOTJUDGED = [
  ["R5-2 DECISIONS.md FE FF then UTF-8, odd (.NET)", "decisions", "febe_utf8_odd", "decisions"],
  ["R5-2 DECISIONS.md a genuine UTF-16BE file, then one byte appended", "decisions", "be_plus_byte", "decisions"],
  ["R5-2 Session_7.md (the latest log) FE FF then UTF-8, odd (.NET)", "log", "febe_utf8_odd", "log7"],
  ["R5-2 Session_7.md a genuine UTF-16BE file, then one byte appended", "log", "be_plus_byte", "log7"],
  ["R5-2 SUMMARY.md FE FF then UTF-8, odd (.NET)", "summary", "febe_utf8_odd", "summary"],
];

let k = 0;
function one(t, writer, key, n) {
  const root = join(scratch, `c${String(++k).padStart(3, "0")}-${t}-${n}`);
  mkdirSync(root, { recursive: true });
  project(root);
  const p = join(root, REL[t]);
  ps(W[writer](psq(p), T[key](n)));
  const size = readFileSync(p).length;
  const written = bytesOf(p);
  let rep = null, threw = "";
  try { rep = mod.buildImportDraft(root, today).report; } catch (e) { threw = `${e.name}: ${e.code ?? ""} ${e.message}`; }
  const i = rep ? rep.staleness.inputs.find((x) => x.input === REL[t]) : null;
  const verdict = rep ? (i ? `${i.verdict}${i.could_not_tell ? `/${i.could_not_tell}` : ""}` : "(not judged)") : "THREW";
  const d = cli(root, "--draft", root);
  const before = tree(root);
  const bare = cli(root, "--commit", root);
  const identical = same(before, tree(root));
  const st = existsSync(join(root, ".agents/state.json")) ? JSON.parse(readFileSync(join(root, ".agents/state.json"), "utf8")) : null;
  return { n, root, size, written, rep, threw, i, verdict, evidence: i?.evidence ?? threw, d, bare: bare.status, bareOut: bare.out, commitMsg: (bare.err || "").trim(), identical, state: !!st, st };
}
const draftLines = (r, re) => r.d.out.split(/\r?\n/).filter((l) => re.test(l));

for (const [id, t, writer, key, expect] of CASES) {
  if (filter && !id.includes(filter)) continue;
  console.log(`\n---- ${id}`);
  const g = [6, 7].map((n) => one(t, writer, key, n));
  for (const r of g) {
    console.log(`     ${r.n === 6 ? "stale  " : "current"}: ${r.written}; verdict ${r.verdict}; draft exit ${r.d.status}; bare --commit exit ${r.bare}, tree ${r.identical ? "identical" : "changed"}, state.json ${r.state}${r.st ? ` (pick_up ${JSON.stringify(r.st.handoffs?.[0]?.pick_up ?? null).slice(0, 40)}, tasks ${r.st.tasks.length})` : ""}`);
    console.log(`              evidence: ${r.evidence}`);
    for (const l of draftLines(r, /REFUSE while|cannot be read/)) console.log(`              draft stdout: ${l.trim()}`);
    if (r.bare !== 0) console.log(`              commit: ${r.commitMsg.split(/\r?\n/)[0]}`);
  }
  if (expect === "observe") console.log(`NOTE ${id}: ${g.map((x) => `${x.n === 6 ? "stale" : "current"} ${x.verdict} exit ${x.bare}`).join("; ")}`);
  else check(id, expect(g), g.map((x) => `${x.verdict} exit ${x.bare}${ENC_CLAIM.test(x.evidence) ? " [evidence names an encoding]" : ""}`).join("; "));
}

for (const [id, t, writer, key] of NOTJUDGED) {
  if (filter && !id.includes(filter)) continue;
  console.log(`\n---- ${id} (CURRENT project)`);
  const r = one(t, writer, key, 7);
  console.log(`     ${r.written}; in-process ${r.threw ? `THREW ${r.threw}` : "ok"}; draft exit ${r.d.status}; bare --commit exit ${r.bare}, tree ${r.identical ? "identical" : "changed"}, state.json ${r.state}`);
  if (r.rep) {
    const nj = r.rep.staleness.not_judged.find((x) => x.input === REL[t]);
    console.log(`     report not_judged: ${nj ? nj.reason : "(not listed)"}`);
    console.log(`     report decisions_unreadable: ${JSON.stringify(r.rep.decisions_unreadable)}`);
    console.log(`     report last_session: ${JSON.stringify(r.rep.last_session)}; judged verdicts ${r.rep.staleness.inputs.map((x) => `${x.input.split("/").pop()}=${x.verdict}${x.could_not_tell ? `/${x.could_not_tell}` : ""}`).join(", ")}`);
  }
  const rp = join(r.root, ".agents/state.import-report.md");
  const repText = existsSync(rp) ? readFileSync(rp, "utf8") : "";
  const name = REL[t].split("/").pop();
  console.log(`     report file lines naming ${name}: ${repText.split(/\r?\n/).filter((l) => l.includes(name)).map((l) => l.trim().slice(0, 300)).join(" || ") || "(none)"}`);
  console.log(`     draft stdout naming it: ${r.d.out.split(/\r?\n/).filter((l) => l.includes(name) || /ADRs/.test(l)).map((l) => l.trim().slice(0, 300)).join(" || ") || "(none)"}`);
  console.log(`     commit stdout naming it: ${r.bareOut.split(/\r?\n/).filter((l) => l.includes(name) || /ADRs/.test(l)).map((l) => l.trim().slice(0, 300)).join(" || ") || "(none)"}`);
  if (r.bare !== 0) console.log(`     commit: ${r.commitMsg.split(/\r?\n/)[0].slice(0, 400)}`);
  if (r.st) console.log(`     state.json: decisions ${JSON.stringify(r.st.decisions.map((x) => x.id))}, current_session ${r.st.current_session ?? r.st.session?.current ?? "?"}, sessions ${JSON.stringify((r.st.sessions ?? []).map((s) => [s.n ?? s.number, s.date]).slice(-2))}`);
  if (t === "decisions") check(id, r.d.status === 0 && r.bare === 0 && /UTF-16BE byte-order mark \(FE FF\), but an odd number of bytes/.test(r.d.out) && /UTF-16BE byte-order mark \(FE FF\), but an odd number of bytes/.test(r.bareOut), `named in draft and commit stdout, does not block`);
  else if (t === "log") check(id, r.d.status === 0 && r.bare === 0 && !r.threw, `does not stop the draft or the commit${/Session_7\.md[^\n]*(odd|FE FF|byte-order)/.test(r.d.out + repText) ? "; named" : "; NOT named anywhere (report, draft stdout)"}`);
  else console.log(`NOTE ${id}: draft exit ${r.d.status}, bare --commit exit ${r.bare}`);
}
console.log(`\nSUMMARY: ${pass} passed, ${fail} failed`);
