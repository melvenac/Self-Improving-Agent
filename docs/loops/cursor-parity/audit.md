# T-235 Phase 1: Cursor vs Claude Code parity audit (live-measured)

**Seat:** sia-builder on the QA PC (DESKTOP-O4EGB1E). **Checkout:** `C:\Users\Aaron Melven\Worktrees\sia-builder`.
**Runtime:** Cursor Agent CLI (`cursor-agent` resolves to `C:\Users\Aaron Melven\AppData\Local\cursor-agent\versions\2026.10.01-e373342\cursor-agent.ps1`).
**Launch shell:** PowerShell (Aaron Phase 0); hook `SHELL` env reports `c:\windows\system32\cmd.exe`.
**Serving tree (read-only reference):** `C:\Users\Aaron Melven\Projects\Self-Improving-Agent` at build 842e469 (6 commits behind origin/master at audit time).
**Measured:** 2026-10-03, session 160, state rev 303, tree detached at `origin/master` `cd297064`.

Phase 0 on this machine (per brief #353): `setup.mjs` run at serving tree 842e4692 after #354; `cursor-builder` key rotated on QA PC (`hub-talk --rotate-key`, prefix `13441111`).

## Phase 0 snapshot (`~/.cursor`, names only)

| Path | Present |
|------|---------|
| `~/.cursor/mcp.json` | yes — `open-brain` server entry with `OPEN_BRAIN_IDE=cursor` |
| `~/.cursor/hooks.json` | yes — `sessionStart` only (cli-bootstrap `--ide cursor`) |
| `~/.cursor/commands/` | yes — `start.md`, `end.md`, `sync.md`, `checkpoint.md` |
| `~/.cursor/cli-config.json` | not checked separately |

## Audit rows

| # | Surface | Claude Code behaviour | cursor-agent CLI behaviour | Evidence (command / observation) | Gap |
|---|---------|----------------------|----------------------------|----------------------------------|-----|
| 1 | open-brain MCP | 14 tools via MCP server | Same tools reachable in this session via MCP (`ob_start`, `ob_end` available; `ob_set_session` refused without hook proof) | Live: `ob_start(project_root=sia-builder)` returned briefing block, session #160; `Session ID: none — no session proof for parent process 11548` (by-pid file absent). `ob_set_session` not called (no `SESSION_UUID:` in hook output). | **T-003:** Cursor MCP session does not receive `SESSION_UUID` from SessionStart; provenance off unless hook writes by-pid. |
| 2 | SessionStart / active slot | `cli-bootstrap.js` → `SESSION_UUID:` + `::claude` slot | `cli-bootstrap.js --ide cursor` registered in `~/.cursor/hooks.json`; `active-session.json` has `…/sia-builder::cursor` | Read `active-session.json`: cursor slot uuid `ae5dc6d1-26b1-4667-89e6-210873feef54` for this checkout; parallel `::claude` slot still present with different uuid. Hook output this session had no `SESSION_UUID:` line. | Slot exists but **hook→agent UUID relay broken or not wired for Cursor MCP parent**; dual slots risk cross-IDE confusion. |
| 3 | SessionEnd | `cli-session-end.js` on SessionEnd (summary, feedback, recall shadow, topics) | `~/.cursor/hooks.json` has **no** `sessionEnd`, `stop`, or equivalent | File read of `~/.cursor/hooks.json` (structure only). | **Missing SessionEnd pipeline for Cursor** — no registered end hook. |
| 4 | Recall trigger | `PostToolUse` / Bash → `cli-recall-trigger.js` | No Cursor hook entry for shell-after or PostToolUse; Claude settings still register Bash recall | Compare `~/.cursor/hooks.json` vs `~/.claude/settings.json` PostToolUse block (command path names only). | **No recall trigger under Cursor**; automatic recall injection remains suspended for Cursor seats. |
| 5 | Imported Claude hooks | SessionStart/End/PostToolUse from `~/.claude/settings.json` + plugins | Session hook context in this agent run included **context-mode** `context_window_protection` block at start (plugin path under `~/.claude/plugins/…`) | Observed in Cursor agent session system context at start (not from docs). `~/.claude/settings.json` lists SessionStart (open-brain bootstrap + context-mode-cache-heal), SessionEnd, PostToolUse/Bash recall. | **Partial overlap:** Claude-side hooks fire under Cursor but are **untagged** (`--ide` only on Cursor-native sessionStart); double SessionStart possible; Git Bash still breaks hook wrapper (T-046, doc). |
| 6 | Slash commands | Seven repo commands under `.claude/commands/` (start, end, sync, checkpoint, task, test, harness-audit) | Four under `~/.cursor/commands/` (no task, test, harness-audit) | `Get-ChildItem` on both dirs; repo `project-template/.cursor/commands/` matches the four. | **Missing three commands** for Cursor unless copied manually. |
| 7 | Instructions | CLAUDE.md, AGENTS.md, skills, rules | This session loaded `CLAUDE.md` (workspace rules), `.cursor/rules/hub-room.mdc`, `.agents/skills/` index (two skills named in briefing) | Briefing `Skills:` line; visible rules in agent context. AGENTS.md not verified separately. | Parity **partial** — no measured diff vs CC for AGENTS.md load order. |
| 8 | `/start` greeting (T-233) | Deterministic `## Briefing`…`## End Briefing` block from `ob_start` | Same block rendered by `ob_start` and printed verbatim in `/start` (this session after fetch + detach at master) | Live `/start` after `git switch --detach origin/master`, state rev 303. | **Met** for briefing shape when state.json valid. |
| 9 | `setup.mjs` for Cursor | N/A (CC path separate) | Writes/updates `mcp.json`, `hooks.json` sessionStart, copies four commands from `project-template/.cursor/commands/` | Read `scripts/setup.mjs` functions `registerCursorMcp`, `registerCursorHooks`, `copyCursorSlashCommands` (serving tree version). Live QA PC files match expected shape. | Does not install SessionEnd, recall, or extra commands; idempotent skip paths documented in script. |

## Ranked fix list (Phase 2 — planner ruling required)

| Rank | Fix | Closes row | Size |
|------|-----|------------|------|
| 1 | Wire Cursor SessionStart so MCP/`/start` gets proven session id (by-pid + `SESSION_UUID:` in hook output, T-003) | 1, 2 | M |
| 2 | Register Cursor session end hook → `cli-session-end.js` (or documented Cursor event if different) | 3 | M |
| 3 | Register shell-after hook → `cli-recall-trigger.js` with payload adapter, or rule explicit “Cursor = explicit recall only” | 4 | M–L |
| 4 | Extend `setup.mjs` to copy/register missing slash commands (task, test, harness-audit) or document intentional omission | 6 | S |
| 5 | Audit/dedupe Claude settings hooks under Cursor (`--ide` tagging, avoid double SessionStart) | 5 | M |
| 6 | Rebuild serving tree on QA PC after master merges (stale MCP build warning in every greeting) | — (ops) | S |
| 7 | Document `cursor-agent` vs bare `agent` PATH rule in setup output (brief already states) | — | S |
| 8 | Hub post UTF-8: document Node `readFileSync` or `Get-Content -Encoding UTF8` for `--say` (row A) | A | S |
| 9 | Seat profile `usage_file` for Cursor usage line (row C) | C | S |

## Rows added from turn-72 /start greeting (Atlas turn 78)

| # | Surface | Observation | Evidence | Gap / note |
|---|---------|-------------|----------|------------|
| A | Hub post encoding | Em dashes in the briefing reached Atlas as mojibake (`â€"` — UTF-8 read as cp1252) | First hub post used PowerShell `Get-Content -Raw` without `-Encoding UTF8` on argv to `hub-talk --say`. Repost via Node `fs.readFileSync` (UTF-8) in turn 77. | **Cursor seat procedure:** post hub bodies with Node reading UTF-8 or `Get-Content -Encoding UTF8`. Claude Code seats typically use bash/heredoc or MCP (UTF-8), not cp1252-decoded argv. |
| B | Launch shell vs hook `SHELL` | Phase 0 says start from **PowerShell**; hook env reports `SHELL=c:\windows\system32\cmd.exe` | Launch: PowerShell; `hooks_context` / session env. | Record both launch shell and hook-visible `SHELL`. |
| C | Usage line | Briefing: `Usage: not checked (no usage_file in seat data and no SIA_USAGE_FILE)` | Builder seat profile in `ob_start` has no `usage_file` (planner has cron paths). | **Gap:** what path/env should a Cursor seat use — do not set without ruling. |
| D | Session proof chain | `Session ID: none — no session proof for parent process 11548` | MCP server parent is `cursor-agent` bundled `node.exe` (PID 11548); no `~/.claude/open-brain/by-pid/11548.json`. Cursor `::cursor` slot exists in `active-session.json` but T-003 proof is not wired to the MCP parent. | Same as rows 1–2; explicit parent-chain note for QA. |

**Not measured in this pass:** terminating a `cursor-agent` session to observe `stop`/`sessionEnd` events; full inventory of which Claude plugin hooks fire on each tool type (would need scripted tool calls + log).
