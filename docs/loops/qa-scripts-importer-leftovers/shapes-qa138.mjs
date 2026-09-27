#!/usr/bin/env node
// QA 138: R4-4's shapes on the importer leftovers, each judged input WRITTEN BY WINDOWS POWERSHELL 5.1 ITSELF (cmdlets
// where PS 5.1 has one; .NET through PS 5.1 where it has none, marked "(.NET)"). For each shape and target, a STALE
// project (the target declares Session 6, the latest log is Session 7) and a CURRENT one (Session 7):
//   bytes (size, first bytes, NUL count); the verdict and reason from the built module's buildImportDraft (in process);
//   the evidence text; a bare --commit's exit, whether the whole project is identical after it, and what state.json got.
// No shell: spawnSync with argument arrays. Usage: node shapes-qa138.mjs <worktree> <scratch-dir> [filter]
import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, lstatSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const [wt, scratch] = process.argv.slice(2, 4).map((p) => resolve(p));
const filter = process.argv[4] ?? "";
const CLI = join(wt, "open-brain/build/cli.js");
const mod = await import(pathToFileURL(join(wt, "open-brain/build/pipelines/state-import/index.js")).href);
const STATE = ".agents/state.json";
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
const head = execFileSync("git", ["-C", wt, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
console.log(`shapes-qa138 against ${wt} @ ${head}; TEMP=${process.env.TEMP}; today (local) ${today}`);

const cli = (cwd, ...args) => { const r = spawnSync(process.execPath, [CLI, "state", "import", ...args], { cwd, encoding: "utf8" }); return { status: r.status, out: r.stdout ?? "", err: r.stderr ?? "" }; };
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
const bytesOf = (p) => { const b = readFileSync(p); let nul = 0; for (const x of b) if (x === 0) nul++; return `size ${b.length}, head ${b.subarray(0, 10).toString("hex")}, NULs ${nul}${nul ? ` (first at ${b.indexOf(0)})` : ""}`; };
let pass = 0, fail = 0;
const check = (id, ok, what) => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${what}`); };

console.log(`NOTE powershell: Windows PowerShell ${ps("$PSVersionTable.PSVersion.ToString()").trim()} (powershell.exe) writes every shape`);
const M = "[char]0x2014";
// $base is the target's whole text, declaring Session $n; $line is one more task or bullet added by hand.
const BASE = {
  inbox: (n) => `$base = "# Inbox " + ${M} + " priorities\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n\`r\`n## P0 " + ${M} + " Critical\`r\`n\`r\`n- [ ] **A task** " + ${M} + " do it\`r\`n"; $line = "- [ ] **Appended** " + ${M} + " by hand"`,
  task: (n) => `$base = "# Current Focus " + ${M} + " work\`r\`n\`r\`n> **Focus:** Session ${n}\`r\`n\`r\`n## Current Objective\`r\`n\`r\`nShip the thing.\`r\`n"; $line = "More objective."`,
  next: (n) => `$base = "# Next Session Handoff " + ${M} + " notes\`r\`n\`r\`n> Updated at end of Session ${n}.\`r\`n\`r\`n## Pick up here\`r\`n\`r\`nCarry on.\`r\`n"; $line = "- appended"`,
};
const REL = { inbox: ".agents/TASKS/INBOX.md", task: ".agents/TASKS/task.md", next: ".agents/SESSIONS/next-session.md" };
const U8 = "(New-Object System.Text.UTF8Encoding($false))";
const NT = {
  // Readable UTF-8 files with no line that starts "# ". $n is substituted.
  inbox_h2_only: (n) => `"## P0 " + ${M} + " Critical\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n\`r\`n- [ ] **A task** " + ${M} + " do it\`r\`n"`,
  next_h2_only: (n) => `"## Pick up here (Session ${n})\`r\`n\`r\`nCarry on.\`r\`n\`r\`n## Watch out for\`r\`n\`r\`n- the hold\`r\`n"`,
  next_bold_only: (n) => `"**Pick up here:** Session ${n}: carry on.\`r\`n**Watch out for:** the hold.\`r\`n"`,
  inbox_front_matter: (n) => `"---\`r\`ntitle: Inbox\`r\`n---\`r\`n# Inbox\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n\`r\`n## P0\`r\`n\`r\`n- [ ] **A task**\`r\`n"`,
  inbox_comment_first: (n) => `"<!-- kept by hand -->\`r\`n\`r\`n# Inbox\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n\`r\`n## P0\`r\`n\`r\`n- [ ] **A task**\`r\`n"`,
  inbox_blank_first: (n) => `"\`r\`n\`r\`n# Inbox\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n\`r\`n## P0\`r\`n\`r\`n- [ ] **A task**\`r\`n"`,
  inbox_no_space: (n) => `"#Inbox\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n\`r\`n## P0\`r\`n\`r\`n- [ ] **A task**\`r\`n"`,
  inbox_tab: (n) => `"#\`tInbox\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n\`r\`n## P0\`r\`n\`r\`n- [ ] **A task**\`r\`n"`,
  inbox_indented: (n) => `"  # Inbox\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n\`r\`n## P0\`r\`n\`r\`n- [ ] **A task**\`r\`n"`,
  inbox_setext: (n) => `"Inbox\`r\`n=====\`r\`n\`r\`n> **Last Updated:** Session ${n}\`r\`n\`r\`n## P0\`r\`n\`r\`n- [ ] **A task**\`r\`n"`,
};
/** [id, target, PS command writing $p (after $base/$line are set), expected: "unreadable" | "judged" | "judged-or-unreadable"] */
const SHAPES = [];
for (const t of ["inbox", "task", "next"]) {
  SHAPES.push([`UTF-32LE (Set-Content -Encoding UTF32)`, t, (p) => `Set-Content -Path ${p} -Value $base -Encoding UTF32 -NoNewline`, "unreadable"]);
  SHAPES.push([`UTF-32BE (Set-Content -Encoding BigEndianUTF32)`, t, (p) => `Set-Content -Path ${p} -Value $base -Encoding BigEndianUTF32 -NoNewline`, "unreadable"]);
  SHAPES.push([`UTF-7 (Set-Content -Encoding UTF7)`, t, (p) => `Set-Content -Path ${p} -Value $base -Encoding UTF7 -NoNewline`, "unreadable"]);
  SHAPES.push([`zero bytes (New-Item)`, t, (p) => `New-Item -ItemType File -Path ${p} -Force | Out-Null`, "unreadable"]);
  SHAPES.push([`zero bytes (Clear-Content)`, t, (p) => `Set-Content -Path ${p} -Value $base; Clear-Content -Path ${p}`, "unreadable"]);
  SHAPES.push([`a UTF-8 BOM (Out-File -Encoding utf8 of ''), then UTF-16 (>>)`, t, (p) => `'' | Out-File -FilePath ${p} -Encoding utf8 -NoNewline; $base >> ${p}`, "unreadable"]);
  SHAPES.push([`a UTF-16LE BOM that lies (.NET): FF FE, then the whole text in UTF-8 (AppendAllText)`, t, (p) => `[IO.File]::WriteAllBytes(${p}, [byte[]](0xFF,0xFE)); [IO.File]::AppendAllText(${p}, $base, ${U8})`, "unreadable"]);
  SHAPES.push([`a UTF-16BE BOM that lies (.NET): FE FF, then the whole text in UTF-8 (AppendAllText)`, t, (p) => `[IO.File]::WriteAllBytes(${p}, [byte[]](0xFE,0xFF)); [IO.File]::AppendAllText(${p}, $base, ${U8})`, "unreadable"]);
  SHAPES.push([`a UTF-8 BOM, then Add-Content -Encoding Unicode (PS follows the UTF-8 BOM)`, t, (p) => `'' | Out-File -FilePath ${p} -Encoding utf8 -NoNewline; Add-Content -Path ${p} -Value $base -Encoding Unicode -NoNewline`, "observe"]);
  SHAPES.push([`a UTF-16LE BOM FF FE (.NET), then Add-Content -Encoding UTF8 (PS follows the BOM: not a lie)`, t, (p) => `[IO.File]::WriteAllBytes(${p}, [byte[]](0xFF,0xFE)); Add-Content -Path ${p} -Value $base -Encoding UTF8 -NoNewline`, "observe"]);
  SHAPES.push([`a UTF-16BE BOM FE FF (.NET), then Add-Content -Encoding UTF8 (PS follows the BOM: not a lie)`, t, (p) => `[IO.File]::WriteAllBytes(${p}, [byte[]](0xFE,0xFF)); Add-Content -Path ${p} -Value $base -Encoding UTF8 -NoNewline`, "observe"]);
  SHAPES.push([`a UTF-16LE BOM that lies: FF FE (.NET), then UTF-32LE text (Add-Content -Encoding UTF32)`, t, (p) => `[IO.File]::WriteAllBytes(${p}, [byte[]](0xFF,0xFE)); Add-Content -Path ${p} -Value $base -Encoding UTF32 -NoNewline`, "unreadable"]);
  SHAPES.push([`a UTF-16BE BOM FE FF (.NET), then Add-Content -Encoding Unicode (PS follows the BOM: not a lie)`, t, (p) => `[IO.File]::WriteAllBytes(${p}, [byte[]](0xFE,0xFF)); Add-Content -Path ${p} -Value $base -Encoding Unicode -NoNewline`, "observe"]);
  SHAPES.push([`UTF-16LE (>), then Add-Content -Encoding UTF8 (PS follows the BOM)`, t, (p) => `$base > ${p}; Add-Content -Path ${p} -Value $line -Encoding UTF8`, "tail"]);
  SHAPES.push([`UTF-16LE (>), then a UTF-8 tail (.NET AppendAllText, as a bash >> would)`, t, (p) => `$base > ${p}; [IO.File]::AppendAllText(${p}, $line + "\`n", ${U8})`, "tail"]);
  SHAPES.push([`UTF-16BE (Set-Content -Encoding BigEndianUnicode), then Add-Content -Encoding UTF8 (PS follows the BOM)`, t, (p) => `Set-Content -Path ${p} -Value $base -Encoding BigEndianUnicode -NoNewline; Add-Content -Path ${p} -Value $line -Encoding UTF8`, "tail"]);
}
const NOTITLE = [
  ["no `# ` title: INBOX.md with `##` headings only", "inbox", "inbox_h2_only", "readable-untitled"],
  ["no `# ` title: next-session.md with `##` sections only (/end A7's three parts)", "next", "next_h2_only", "readable-untitled"],
  ["no `# ` title: next-session.md with /end A7's three parts as bold lines", "next", "next_bold_only", "readable-untitled"],
  ["INBOX.md: YAML front matter, then `# Inbox`", "inbox", "inbox_front_matter", "titled"],
  ["INBOX.md: an HTML comment, then `# Inbox`", "inbox", "inbox_comment_first", "titled"],
  ["INBOX.md: two blank lines, then `# Inbox`", "inbox", "inbox_blank_first", "titled"],
  ["no `# ` title: INBOX.md `#Inbox` (no space)", "inbox", "inbox_no_space", "readable-untitled"],
  ["no `# ` title: INBOX.md `#<TAB>Inbox` (a CommonMark heading)", "inbox", "inbox_tab", "readable-untitled"],
  ["no `# ` title: INBOX.md `  # Inbox` (indented 2; a CommonMark heading)", "inbox", "inbox_indented", "readable-untitled"],
  ["no `# ` title: INBOX.md with a setext title (`Inbox` / `=====`)", "inbox", "inbox_setext", "readable-untitled"],
];
for (const [id, t, key, exp] of NOTITLE) SHAPES.push([id, t, (p, n) => `[IO.File]::WriteAllText(${p}, ${NT[key](n)}, ${U8})`, exp]);
SHAPES.push(["a UTF-8 BOM twice: Out-File -Encoding utf8 of '', then Add-Content -Encoding UTF8", "inbox", (p) => `'' | Out-File -FilePath ${p} -Encoding utf8 -NoNewline; Add-Content -Path ${p} -Value $base -Encoding UTF8 -NoNewline`, "observe"]);
SHAPES.push(["a UTF-8 BOM twice (.NET): the text itself begins with U+FEFF, Out-File -Encoding utf8", "inbox", (p) => `([string][char]0xFEFF + $base) | Out-File -FilePath ${p} -Encoding utf8 -NoNewline`, "observe"]);
// IF-10: a readable title and a could-not-tell reason that does not block still commit.
SHAPES.push(["IF-10 +13: INBOX.md declares Session 20 (latest 7)", "inbox", (p) => `[IO.File]::WriteAllText(${p}, ($base -replace 'Session \\d+', 'Session 20'), ${U8})`, "if10"]);
SHAPES.push(["IF-10 +1: INBOX.md declares Session 8 (latest 7)", "inbox", (p) => `[IO.File]::WriteAllText(${p}, ($base -replace 'Session \\d+', 'Session 8'), ${U8})`, "if10"]);

function project(root) {
  for (const d of ["TASKS", "SYSTEM", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "qa138-shapes", version: "0.0.1" }));
  for (const s of [6, 7]) writeFileSync(join(root, `.agents/SESSIONS/Session_${s}.md`), `# Session ${s} — 2026-09-2${s - 4}\n\n> **Status:** Completed\n\nwork of session ${s}\n`);
  writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> **Status:** Session 7\n\n## Architecture\n\nWords.\n");
  writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), "# Next Session Handoff — notes\n\n> Updated at end of Session 7.\n\n## Pick up here\n\nCarry on.\n");
  writeFileSync(join(root, ".agents/TASKS/task.md"), "# Current Focus — work\n\n> **Focus:** Session 7\n\n## Current Objective\n\nShip the thing.\n");
  writeFileSync(join(root, ".agents/TASKS/INBOX.md"), "# Inbox — priorities\n\n> **Last Updated:** Session 7\n\n## P0 — Critical\n\n- [ ] **A task** — do it\n");
}
let k = 0;
for (const [id, t, cmd, exp] of SHAPES) {
  if (filter && !`${t} ${id}`.includes(filter)) continue;
  console.log(`\n---- [${t}] ${id}`);
  const ns = exp === "if10" ? [7] : [6, 7];
  const got = [];
  for (const n of ns) {
    const root = join(scratch, `s${String(++k).padStart(3, "0")}-${t}-${n}`);
    mkdirSync(root, { recursive: true });
    project(root);
    const p = join(root, REL[t]);
    ps(`${BASE[t](n)}; ${cmd(psq(p), n)}`);
    const written = bytesOf(p);
    let rep = null, threw = "";
    try { rep = mod.buildImportDraft(root, today).report; } catch (e) { threw = `${e.name}: ${e.code ?? ""} ${e.message}`; }
    const i = rep ? rep.staleness.inputs.find((x) => x.input === REL[t]) : { verdict: "THREW", evidence: threw };
    const verdict = i ? `${i.verdict}${i.could_not_tell ? `/${i.could_not_tell}` : ""}` : "(not judged)";
    const d = cli(root, "--draft", root);
    const before = tree(root);
    const bare = cli(root, "--commit", root);
    const identical = same(before, tree(root));
    let got2 = "";
    if (existsSync(join(root, STATE))) {
      const s = JSON.parse(readFileSync(join(root, STATE), "utf8"));
      got2 = `; state.json: tasks ${JSON.stringify(s.tasks.map((x) => x.title))}, objective ${JSON.stringify(s.objective?.text ?? s.objective ?? null).slice(0, 60)}, pick_up ${JSON.stringify(s.handoffs?.[0]?.pick_up ?? null).slice(0, 60)}`;
    }
    console.log(`     ${n === 6 ? "stale  " : "current"}: ${written}; draft exit ${d.status}; verdict ${verdict}`);
    if (d.status !== 0) console.log(`              draft: ${(d.err || d.out).trim().split(/\r?\n/)[0].slice(0, 300)}`);
    console.log(`              evidence: ${(i?.evidence ?? "").slice(0, 260)}`);
    console.log(`              bare --commit exit ${bare.status}, tree ${identical ? "identical" : "changed"}, state.json ${existsSync(join(root, STATE))}${got2}`);
    if (bare.status !== 0) console.log(`              ${(bare.err || bare.out).trim().split(/\r?\n/)[0].slice(0, 300)}`);
    got.push({ n, verdict, bare: bare.status, identical, state: existsSync(join(root, STATE)), evidence: i?.evidence ?? "" });
  }
  const blocked = got.every((g) => g.verdict === "could_not_tell/unreadable" && g.bare === 1 && g.identical && !g.state);
  if (exp === "unreadable") check(`[${t}] ${id}`, blocked, `unreadable and bare --commit refuses, stale and current: ${got.map((g) => `${g.verdict} exit ${g.bare}`).join("; ")}`);
  else if (exp === "titled") check(`[${t}] ${id}`, got.every((g) => g.verdict !== "could_not_tell/unreadable") && got[0].bare === 1 && got[1].bare === 0, `judged as it reads: ${got.map((g) => `${g.verdict} exit ${g.bare}`).join("; ")}`);
  else if (exp === "if10") check(`[${t}] ${id}`, got[0].verdict === "could_not_tell/ahead_of_latest" && got[0].bare === 0 && got[0].state, `${got[0].verdict}, bare --commit exit ${got[0].bare}, state.json ${got[0].state}`);
  else console.log(`NOTE [${t}] ${id}: ${got.map((g) => `${g.n === 6 ? "stale" : "current"} ${g.verdict} exit ${g.bare}`).join("; ")}`);
}
console.log(`\nSUMMARY: ${pass} passed, ${fail} failed`);
