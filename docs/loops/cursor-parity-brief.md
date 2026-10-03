# T-235 brief: Cursor parity with Claude Code

**Planner:** Atlas, session 159, 2026-10-03. **Seat:** sia-builder (Cursor Composer 2.5, hub name `cursor-builder`)
**on the QA PC** (DESKTOP-O4EGB1E): checkout `C:\Users\Aaron Melven\Worktrees\sia-builder`, A2A-Hub at
`C:\Users\Aaron Melven\Projects\A2A-Hub`, serving tree `C:\Users\Aaron Melven\Projects\Self-Improving-Agent`.
*(Corrected same session: the first version assumed the desktop. The user name has a space, so quote every path.)*
**Authority:** Aaron in the planner's window, 2026-10-03: "We haven't focused on getting sia in cursor parity
with cc. Let's have you do that, I have sia-builder open in cursor using composer 2.5."

## Problem

SIA was built in Claude Code and Cursor was bolted on. Every dev and QA seat now runs as **`cursor-agent`, the
CLI** (not the Cursor app), so wherever Cursor falls short, the protocol is silently weaker for most of the
seats that use it. What we know already (planner reads, 2026-10-03):

- `scripts/setup.mjs` gives Cursor the open-brain MCP server (`~/.cursor/mcp.json`, `OPEN_BRAIN_IDE=cursor`),
  a `sessionStart` hook (`cli-bootstrap.js --ide cursor`) and four commands (start, end, sync, checkpoint).
- Claude Code also gets **SessionEnd** (`cli-session-end.js`: summary capture, auto-feedback, invocation log,
  shadow recall, topics) and **PostToolUse/Bash** (`cli-recall-trigger.js`), plus commands `task`, `test`,
  `harness-audit`. Cursor registers neither hook; no task or gap covers that.
- Cursor is known to run `~/.claude/settings.json` hooks and Claude plugin hooks too
  (`open-brain/docs/cursor-windows-git-bash-hooks.md`, T-046). So some Claude-side hooks may already fire
  under Cursor, untagged, and some may fire twice. **Nobody has measured which, in the CLI.**
- The QA PC had none of the Cursor wiring (no `~/.cursor/mcp.json`, `hooks.json` or commands) although its
  serving tree is current. The desktop has it. **T-235 owns the QA PC's Cursor setup** (split agreed by
  clark with Relay, 2026-10-03; Relay owns hub-talk, hub codes and rooms).
- From Relay (relayed by clark, not read by the planner): Git Bash cannot find `agent` on the QA PC because
  the installer ships only `agent.cmd` (QA PC 2026.10.01-e373342, laptop 2026.09.28). Every tool call failed
  in context-mode's preToolUse hook (`~/.claude/plugins`, context-mode 1.0.169) with
  "syntax error near unexpected token `&'" when `agent` was started from Git Bash (`SHELL=bash`); starting
  it from **PowerShell** is the workaround. That is T-046, live. Record which shell each measurement used.
- The hub is strict for new names: a name needs a one-time enrollment code, then
  `hub-talk --as <name> --init-key --invite <code>`. **The QA PC holds no `cursor-builder` key**; Aaron
  issues the code. Never copy a key file between machines.

## Phase 0: the QA PC (before the audit)

Aaron's acts, not the seat's: start `agent` from PowerShell; run `node scripts/setup.mjs` in the QA PC serving
tree (it writes `~/.cursor` and rebuilds open-brain at the same commit); enroll `cursor-builder` on the hub.
The seat then records the before/after of `~/.cursor` (names only) as the audit's first rows.

## Phase 1: measure (deliverable: one docs-only PR)

Write `docs/loops/cursor-parity/audit.md`: one row per Claude Code surface, each with **Claude Code
behaviour / cursor-agent CLI behaviour / evidence / gap**. Every Cursor cell must come from a live
`cursor-agent` run you did (command, cwd, and the observed output or file change), not from docs, memory or
what the code says should happen. Write "not measured: <why>" instead of guessing. At least:

1. open-brain MCP tools reachable (`ob_start`, `ob_set_session`, `ob_state`, `ob_end`).
2. `sessionStart` fires in the CLI: does the `::cursor` slot in `~/.claude/open-brain/active-session.json`
   change on a fresh `cursor-agent` session? Does `ob_set_session` then prove a session id (T-003), or refuse?
3. Session end: does anything run `cli-session-end.js` when a cursor-agent session ends? Which Cursor hook
   event would (`sessionEnd`, `stop`), and does the CLI fire it?
4. Recall trigger: is there a Cursor equivalent of PostToolUse/Bash (`afterShellExecution` or similar) that the
   CLI fires, and with what payload shape vs what `cli-recall-trigger.js` reads?
5. Hooks imported from `~/.claude/settings.json` and Claude plugins: which fire under cursor-agent, how often,
   and with which `--ide`/slot? (Double-fire and slot-collision risk.)
6. Slash commands: which of Claude's seven exist for Cursor, and does the CLI resolve `~/.cursor/commands/`?
7. Instructions: does cursor-agent load `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/*.mdc`, `.agents/skills`?
8. `/start` greeting: does Cursor print the `## Briefing` block verbatim, as Claude Code does (T-233)?
9. Install: what `setup.mjs` writes for Cursor, on a clean `HOME`, and whether a re-run is idempotent.

End the audit with a ranked fix list: each fix, the row it closes, and its size. **Then post to the hub and
wait for the planner's ruling. Do not start Phase 2 without it.**

## Phase 2: fix (after the ruling)

Only the fixes the planner rules in, one small PR each (or a ruled batch). Composer-seat rules (D-060):

- **Real red:** every new test fails on `origin/master` before your fix and passes after; paste both runs.
- **Product mutants on your own branch:** break the product code your test guards and show the test fails.
- **No test-only code** in product files.

## Boundaries

- **Read-only on live config:** do not edit `~/.cursor/*`, `~/.claude/*` or `~/.claude/open-brain/*`. To
  measure hooks, use a project-level `.cursor/hooks.json` in a scratch directory, or a scratch `HOME`/
  `USERPROFILE`. If a measurement truly needs the real file, ask on the hub first.
- **Never copy secret values** (keys, tokens, env values) into docs or PRs (G-051). Names and shapes only.
- **Do not touch the serving checkout** (`~/Projects/Self-Improving-Agent`, which every session on the
  machine runs), except Phase 0 above, which is Aaron's.
- Branch from a fresh `origin/master`; push your branch and open the PR; **never merge, never push to master.**
- `/sync` before any commit.
- Talk to the planner only through the hub (room below). After every post, `--wait` and act on the exit code.

## Hub

`HUB_URL=http://100.124.212.87:4000 node "C:/Users/Aaron Melven/Projects/A2A-Hub/scripts/hub-talk.mjs" --as cursor-builder --session k57098epn7qz32vt0cazfjpbes8f6kdq`
plus `--inbox`, `--say "$(cat <file>)"`, or `--wait --wait-timeout 3500`. Exit codes: see `.cursor/rules/hub-room.mdc`.
