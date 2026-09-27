#!/usr/bin/env node
// QA 138 one-offs, through the built CLI: (a) an odd-length FE FF DECISIONS.md (not judged, R4-5 says it must not
// block); (b) an odd-length FE FF latest session log; (c) a UTF-16LE INBOX.md written by PS 5.1's `>`, then a task
// appended by GIT BASH's `echo >>` (UTF-8 bytes), in a CURRENT project. Usage: node oneoffs-qa138.mjs <worktree> <scratch>
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
const [wt, scratch] = process.argv.slice(2).map((p) => resolve(p));
const CLI = join(wt, "open-brain/build/cli.js");
rmSync(scratch, { recursive: true, force: true });
const cli = (cwd, ...a) => { const r = spawnSync(process.execPath, [CLI, "state", "import", ...a], { cwd, encoding: "utf8" }); return `exit ${r.status}: ${(r.stderr || r.stdout).trim().split(/\r?\n/).filter(Boolean).slice(0, 14).join(" | ").slice(0, 900)}`; };
function project(root) {
  for (const d of ["TASKS", "SYSTEM", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "qa138-oneoff", version: "0.0.1" }));
  for (const s of [6, 7]) writeFileSync(join(root, `.agents/SESSIONS/Session_${s}.md`), `# Session ${s} — 2026-09-2${s - 4}\n\nwork\n`);
  writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> **Status:** Session 7\n\n## Architecture\n\nWords.\n");
  writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), "# Next Session Handoff\n\n> Updated at end of Session 7.\n\n## Pick up here\n\nCarry on.\n");
  writeFileSync(join(root, ".agents/TASKS/task.md"), "# Current Focus\n\n> **Focus:** Session 7\n\n## Current Objective\n\nShip it.\n");
  writeFileSync(join(root, ".agents/TASKS/INBOX.md"), "# Inbox\n\n> **Last Updated:** Session 7\n\n## P0\n\n- [ ] **A task** — do it\n");
}
const odd = (text) => { const b = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(text, "utf8")]); return b.length % 2 ? b : Buffer.concat([b, Buffer.from("x")]); };

let root = join(scratch, "a-decisions-febe-odd"); project(root);
writeFileSync(join(root, ".agents/SYSTEM/DECISIONS.md"), odd("# Decisions\n\n## ADR-1: one\n\nDate: 2026-01-01\n\nText.\n"));
console.log(`(a) DECISIONS.md FE FF, odd length ${readFileSync(join(root, ".agents/SYSTEM/DECISIONS.md")).length}\n    --draft ${cli(root, "--draft", root)}\n    --commit ${cli(root, "--commit", root)}\n    state.json ${existsSync(join(root, ".agents/state.json"))}`);

root = join(scratch, "b-session-log-febe-odd"); project(root);
writeFileSync(join(root, ".agents/SESSIONS/Session_7.md"), odd("# Session 7 — 2026-09-23\n\nwork\n"));
console.log(`(b) Session_7.md FE FF, odd length ${readFileSync(join(root, ".agents/SESSIONS/Session_7.md")).length}\n    --draft ${cli(root, "--draft", root)}`);

root = join(scratch, "c-utf16-then-gitbash-append"); project(root);
const inbox = join(root, ".agents/TASKS/INBOX.md");
const ps = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$ErrorActionPreference='Stop'; "# Inbox\`r\`n\`r\`n> **Last Updated:** Session 7\`r\`n\`r\`n## P0\`r\`n\`r\`n- [ ] **A task** - do it" > '${inbox}'`], { encoding: "utf8" });
if (ps.status !== 0) throw new Error(ps.stderr);
const bash = "C:/Program Files/Git/bin/bash.exe";
const b = spawnSync(bash, ["-c", `echo '- [ ] **Appended by bash** - later' >> "$1"`, "bash", inbox.replace(/\\/g, "/")], { encoding: "utf8" });
if (b.status !== 0) throw new Error(`bash: ${b.stderr}`);
const bytes = readFileSync(inbox);
console.log(`(c) INBOX.md: PS 5.1 '>' then Git Bash 'echo >>': size ${bytes.length}, head ${bytes.subarray(0, 4).toString("hex")}, tail ${bytes.subarray(-12).toString("hex")}`);
console.log(`    --draft ${cli(root, "--draft", root)}`);
console.log(`    --commit ${cli(root, "--commit", root)}`);
if (existsSync(join(root, ".agents/state.json"))) console.log(`    state.json tasks ${JSON.stringify(JSON.parse(readFileSync(join(root, ".agents/state.json"), "utf8")).tasks.map((t) => t.title))}`);
