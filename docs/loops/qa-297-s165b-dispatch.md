# QA 297, session-165 batch b: the Makerspace import (A1–A8), on the DESKTOP

**By:** Atlas (planner), 2026-10-09, record session 165. **Replaces:** QA 296, which stopped INCOMPLETE at P2
(`qa/s165a-report` @ `934a90c3`). The laptop has no open-brain MCP registered, and its headless QA permissions refuse
the `claude` CLI. **Machine:** the DESKTOP (DESKTOP-UGEKR74). This is the import machine, and SIA runs here.
**Needs Aaron's word** (desktop SIA QA, D-065), asked by clark. **Routing:** D-140 (clark's ruling: one Claude run
for A1–A8; the repo is private and Grok can't read it).

- **What is under test:** `melvenac/melvenac-makerspace`, branch `sia/adopt`, pinned at
  **`bb06a3673377c766b8c2b7ab8f9086734c8aca78`**. The planner verified it in a fresh longpaths clone.
- **Criteria:** `docs/loops/makerspace-import-brief.md` §Acceptance.
- **Prefix:** `s165b`. **Report:** `docs/loops/s165b-qa-report.md` on `qa/s165b-report`, pushed only with
  `node docs/loops/qa-297/push-qa.mjs qa/s165b-report`.
- **The stop point:** an ACCEPT here is D-130's "Makerspace migration proven". Aaron then merges `sia/adopt`.

## What changed from QA 296, and why it is safer

**No child `claude` processes.** The QA job is itself a Claude Code session on the machine where open-brain is
registered. So it calls the three open-brain tools directly, aimed at the scratch clone:

- `/start` is `ob_set_session` plus `ob_start`.
- A6's write is `ob_state`.

**How the permission comes from the launch alone (no settings file changes).** Clark launches with the same command
`launch-qa.ps1` builds, run by hand once, with three additions:

1. **The env:** `KNOWLEDGE_V2_DB` and `OPEN_BRAIN_VAULT_DIR` are set in the launching `cmd` before `claude.cmd`.
   - The desktop's `open-brain` registration in `~/.claude.json` has no `env` block (checked 2026-10-09; key names
     only, no values printed). So the MCP server this job spawns inherits these variables.
   - Every open-brain write by this job therefore goes to `C:\qa-tmp\qa297`, never to the real store or vault.
2. **The tools:** `--allowedTools` gains `mcp__open-brain__ob_set_session mcp__open-brain__ob_start mcp__open-brain__ob_state`.
   These are the only additions to launch-qa's own list.
3. **Nothing else:** `claude` is NOT allowed. No other MCP tools are added, and no settings file is edited.

**Exact launch** (clark, PowerShell, after Aaron's word, with no other `claude -p` running on the desktop):

```powershell
New-Item -ItemType Directory -Force C:\qa-tmp\qa297\vault, C:\qa-scratch | Out-Null
# C:\Users\melve\qa-297.md = docs/loops/qa-297-headless-prompt.md at DISPATCH_SHA, with the DISPATCH_SHA as its first line
$cmd = 'cmd /c cd /d "C:\Users\melve\Worktrees\sia-qa" && git fetch -q origin && set "KNOWLEDGE_V2_DB=C:\qa-tmp\qa297\knowledge-v2.db" && set "OPEN_BRAIN_VAULT_DIR=C:\qa-tmp\qa297\vault" && claude.cmd -p --model opus --permission-mode acceptEdits --add-dir "C:\qa-scratch" --add-dir "C:\qa-tmp" --allowedTools "Bash(git:*) Bash(node:*) Bash(npm:*) Bash(npx:*) Bash(gh:*) Bash(powershell:*) Bash(cmd:*) Read Write Edit Glob Grep mcp__open-brain__ob_set_session mcp__open-brain__ob_start mcp__open-brain__ob_state" < "C:\Users\melve\qa-297.md" > "C:\Users\melve\qa-297.log" 2>&1'
$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0}
Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{CommandLine=$cmd; ProcessStartupInformation=$si}
```

## Paths

| Name | Path |
|---|---|
| `MK` | `C:/qa-scratch/qa297-mk` |
| `TMP` | `C:/qa-tmp/qa297` |
| `REALDB` | `C:/Users/melve/.claude/open-brain/knowledge-v2.db`, opened READ-ONLY, only in G1 |
| `SIA` | `C:/Users/melve/Projects/Self-Improving-Agent` |

## Rows

| # | Action | Pass when |
|---|---|---|
| P1 | `node -v` | `v22.*`; otherwise STOP → INCOMPLETE |
| P2 | `node -e "console.log(process.env.KNOWLEDGE_V2_DB, process.env.OPEN_BRAIN_VAULT_DIR)"`; `node -e "console.log(require('C:/Users/melve/Projects/Self-Improving-Agent/open-brain/build/build-info.json').commit)"`; `git -C <SIA> merge-base --is-ancestor 6f83c5abcc19a986937b001b16602a14e139e7f2 <that commit>; echo EXIT=$?` | The env prints the two `C:\qa-tmp\qa297\…` paths (otherwise STOP: the redirect is missing, so make NO open-brain call), and `EXIT=0` (otherwise STOP → INCOMPLETE; do not rebuild) |
| P3 | `git ls-remote https://github.com/melvenac/melvenac-makerspace.git refs/heads/sia/adopt` | equals the pin; otherwise STOP |
| P4 | `git clone -c core.longpaths=true -b sia/adopt https://github.com/melvenac/melvenac-makerspace.git <MK>`; `git -C <MK> rev-parse HEAD`; `git -C <MK> status --porcelain` | HEAD = the pin; porcelain empty |
| A1 | As QA 296's A1 (`docs/loops/qa-296-s165a-dispatch.md`), against `<MK>` | the same pass condition |
| A2 | As QA 296's A2 | the same |
| A3 | As QA 296's A3 | the same; the rehearsal half is `TOLD (Maker)` |
| A4 | As QA 296's A4 | prints nothing |
| A5+A7 | Call the tool `ob_set_session` (no session_id, `project_dir` = `<MK>`), then `ob_start` with `project_root` = `<MK>`. Paste `ob_start`'s output from `## Briefing…` through `## End Briefing` verbatim | The block contains `Tarrant County Makerspace`, `Drift: none`, an objective starting `Launch the rebuilt tarrantcountymakerspace.com`, `Maker` as the seat agent, `state rev 0`, and NO SIA identifiers (`self-improving-agent`, `V-0\d\d`, `G-0\d\d`, `D-1\d\d`). The record is read from a fresh clone, which is A7 |
| A6a | Call `ob_state` with `project_root` = `<MK>`, `session` = the number on `ob_start`'s `Session #N` line, `expected_revision` 0, and ops `[{"op":"set_handoff","seat":"planner","pick_up":"QA-297 HANDOFF MARKER","watch_out":[],"open_questions":[]}]`. Then `git -C <MK> status --porcelain` | The output shows `Revision: 0 → 1` and `Rendered (4)`. Porcelain lists only `.agents/state.json`, the 4 views and, at most, `.agents/SESSIONS/Session_*.md` |
| A6b | `ob_start` with `project_root` = `<MK>` again | `state rev 1`, `Drift: none`, and the PICK UP HERE section contains `QA-297 HANDOFF MARKER` |
| A6c | `/end` | `NOT RUN (planner ruling)`: `set_handoff` is the handoff half |
| A8 | As QA 296's A8 | the same |
| G1 | Open REALDB **read-only** with SIA's driver: `node -e "const D=require('C:/Users/melve/Projects/Self-Improving-Agent/open-brain/node_modules/better-sqlite3'); const db=new D(process.argv[1],{readonly:true,fileMustExist:true}); console.log(db.prepare(\"select count(*) n from sessions where project_dir like '%qa297%'\").get().n)" <REALDB>`. Do the same against `<TMP>/knowledge-v2.db`, if it exists | REALDB count is `0`; otherwise FINDING: a write leaked. The TMP count is informational. Also `git -C <MK> rev-parse HEAD` is still the pin |

## Rules

- Read-only, except the scratch clone `<MK>`, `<TMP>`, and your own `qa/s165b-*` branches in the SIA repo. Never push to
  `melvenac-makerspace` or commit in `<MK>`.
- Never call an open-brain tool before P2 passes. Never call one with a `project_root` or `project_dir` other than
  `<MK>`.
- Never print a key or env value, apart from the two path variables in P2.
- Every number is pasted command or tool output. Anything not run is `NOT RUN`, with its reason.
- **Verdict:** ACCEPT only if P1–P4, A1–A8 and G1 all pass, A6c being NOT RUN by design. Any failed row is REJECT,
  with its finding named. A STOP in P1–P3 is INCOMPLETE.
- The report's last line is exactly `QA-297: REPORT COMPLETE`.
