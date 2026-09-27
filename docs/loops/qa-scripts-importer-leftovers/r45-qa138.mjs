#!/usr/bin/env node
// QA 138, R4-5: a not-judged DECISIONS.md with bytes the importer cannot read does not block, and the report, --draft's
// stdout and --commit's stdout each name its NUL count, first byte, the ADRs imported and those NOT imported.
// Every DECISIONS.md is written by Windows PowerShell 5.1. A CURRENT project, so nothing else blocks.
// Usage: node r45-qa138.mjs <worktree> <scratch>
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
const [wt, scratch] = process.argv.slice(2).map((p) => resolve(p));
const CLI = join(wt, "open-brain/build/cli.js");
rmSync(scratch, { recursive: true, force: true });
const run = (cwd, ...a) => spawnSync(process.execPath, [CLI, "state", "import", ...a], { cwd, encoding: "utf8" });
const ps = (c) => { const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$ErrorActionPreference='Stop'; ${c}`], { encoding: "utf8" }); if (r.status !== 0) throw new Error(r.stderr); };
function project(root) {
  for (const d of ["TASKS", "SYSTEM", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "qa138-r45", version: "0.0.1" }));
  for (const s of [6, 7]) writeFileSync(join(root, `.agents/SESSIONS/Session_${s}.md`), `# Session ${s} — 2026-09-2${s - 4}\n\nwork\n`);
  writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> **Status:** Session 7\n\n## Architecture\n\nWords.\n");
  writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), "# Next Session Handoff\n\n> Updated at end of Session 7.\n\n## Pick up here\n\nCarry on.\n");
  writeFileSync(join(root, ".agents/TASKS/task.md"), "# Current Focus\n\n> **Focus:** Session 7\n\n## Current Objective\n\nShip it.\n");
  writeFileSync(join(root, ".agents/TASKS/INBOX.md"), "# Inbox\n\n> **Last Updated:** Session 7\n\n## P0\n\n- [ ] **A task** — do it\n");
}
const U8 = "(New-Object System.Text.UTF8Encoding($false))";
const adr = (n, d) => `"### ADR-${n}: decision ${n}\`r\`n\`r\`n- **Date:** ${d}\`r\`n\`r\`nWe chose ${n}.\`r\`n"`;
const SHAPES = [
  ["UTF-8 ADR-1, then ADR-2 and ADR-3 appended by PS 5.1 >>", (p) => `[IO.File]::WriteAllText(${p}, "# Decisions\`r\`n\`r\`n" + ${adr(1, "2026-01-01")}, ${U8}); ${adr(2, "2026-02-02")} >> ${p}; ${adr(3, "2026-03-03")} >> ${p}`],
  ["UTF-16LE with no BOM, the whole file (UnicodeEncoding(false,false))", (p) => `[IO.File]::WriteAllText(${p}, "# Decisions\`r\`n\`r\`n" + ${adr(1, "2026-01-01")} + ${adr(2, "2026-02-02")}, (New-Object System.Text.UnicodeEncoding($false, $false)))`],
  ["UTF-32LE (Set-Content -Encoding UTF32)", (p) => `Set-Content -Path ${p} -Value ("# Decisions\`r\`n\`r\`n" + ${adr(1, "2026-01-01")}) -Encoding UTF32`],
  ["UTF-8, one stray NUL (Add-Content [char]0), no ADR lost", (p) => `[IO.File]::WriteAllText(${p}, "# Decisions\`r\`n\`r\`n" + ${adr(1, "2026-01-01")}, ${U8}); Add-Content -Path ${p} -Value ([string][char]0) -NoNewline`],
  ["readable UTF-8 (control: nothing is named)", (p) => `[IO.File]::WriteAllText(${p}, "# Decisions\`r\`n\`r\`n" + ${adr(1, "2026-01-01")}, ${U8})`],
];
let k = 0;
for (const [name, cmd] of SHAPES) {
  const root = join(scratch, `r45-${++k}`); project(root);
  const p = join(root, ".agents/SYSTEM/DECISIONS.md");
  ps(cmd(`'${p}'`));
  const b = readFileSync(p); let nul = 0; for (const x of b) if (x === 0) nul++;
  console.log(`\n==== ${name}\n     bytes: size ${b.length}, head ${b.subarray(0, 6).toString("hex")}, NULs ${nul}${nul ? `, first at ${b.indexOf(0)}` : ""}`);
  const d = run(root, "--draft", root);
  console.log(`     --draft exit ${d.status}; stdout lines naming it:`);
  for (const l of d.stdout.split(/\r?\n/).filter((l) => /DECISIONS|ADRs|Decisions:/.test(l))) console.log(`       | ${l}`);
  const rep = readFileSync(join(root, ".agents/state.import-report.md"), "utf8").split(/\r?\n/);
  console.log(`     report lines naming it:`);
  for (const l of rep.filter((l) => /DECISIONS\.md|ADRs imported|ADRs NOT|Not read in full|^Imported \d+ ADRs/.test(l))) console.log(`       | ${l}`);
  const c = run(root, "--commit", root);
  console.log(`     --commit exit ${c.status}; stdout lines naming it:`);
  for (const l of (c.stdout + c.stderr).split(/\r?\n/).filter((l) => /DECISIONS|ADRs|refused/.test(l))) console.log(`       | ${l}`);
  if (existsSync(join(root, ".agents/state.json"))) {
    const s = JSON.parse(readFileSync(join(root, ".agents/state.json"), "utf8"));
    console.log(`     state.json decisions ${JSON.stringify(s.decisions.map((x) => x.id ?? x.title))}; NUL in state.json ${readFileSync(join(root, ".agents/state.json")).includes(0)}`);
  }
}
