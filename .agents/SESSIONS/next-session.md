<!-- generated from .agents/state.json rev 0 by open-brain v0.31.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 55)_

Loop 4 per ~/.agents/mailbox/channels/sia/loop-4-brief.md; branch loop/4-dogfood from loop/3-state-writer head ee2cdb8; first deliverable is `open-brain state import --draft` on this repo + the import report to the Planner; --commit only after the Planner's authorization. Report to the Planner session (find it with ListAgents — name starts 'Prime installation check' now, may differ after the Planner rolls; the mailbox channel sia is the durable record either way). Do not report to Aaron.
**Read the brief fully before starting** — the importer has a review gate before `--commit`, and R7 (a `merge-markers` /sync check) was appended after this session's slip. Aaron opens a fresh SIA session for Loop 4; this session ended at the Planner's roll instruction.

## Watch out

- **The live MCP server is on whichever build was running at the last `/mcp reconnect open-brain`** (v0.29.0 build as of Loop 2's reconnect; `open-brain/build/` on disk is whatever was last built). Ask via the Planner for a reconnect before relying on `ob_state` through the tool.
- **Bash heredocs eat `\\` in regexes** (`/\\/g` became `/\/g` twice this session). Write code with backslashes through the Write/Edit tools, never a heredoc.
- **Gate every commit on the resolver that precedes it.** bb68600 was committed with CHANGELOG conflict markers because a Python step failed and the next command was not chained with `&&`. R7 makes this impossible to be green again; until it lands, check `grep -c '^<<<<<<<' CHANGELOG.md` before any merge commit.
- **Python `print` of non-ASCII (`→`) crashes under cp1252** in this shell; keep prints ASCII.
- **GitNexus:** the index goes stale every commit; `detect_changes` on a stale index attributes hunks to line-shift neighbours (handleEnd, EndArgs, buildSql showed up falsely). `analyze` sometimes fails with an FTS inconsistency and succeeds on retry. Re-index before trusting scope.
- **Run vitest only from `open-brain/`** (entry 462). `cli-bootstrap.test.ts` now has a 30s describe timeout (9620b87) — a timeout there is a real hang.
- **`/sync` from `open-brain/` now resolves the root** (R4, Loop 3). The `state-schema` check skips with a reason until state.json exists; `summary-version` still forces a prose line into SUMMARY on every bump — Loop 4 R3 stops that.
- **CLAUDE.md and README.md are stale on the tool list** (say 13 tools; `ob_state` makes 14; ob_start/ob_state/sync root resolution undocumented in README). Not edited this session because the tree had to stay clean at /end — fold into Loop 4's doc audit.
- Importer inputs surveyed: INBOX 54 open / 3 in_progress / 0 blocked / 85 done, 13 `[superseded]`, sections `## P0 — Critical` … `## P3 — Low`, `## Completed`; DECISIONS.md 24 ADRs, none with a Date line; SUMMARY blockquote = 73 `>` lines after the title, `## Current State` at line 77 → `## Architecture Overview` at 182; task.md `## Current Objective`; next-session `## Pick up here`, `### Watch out for`.

## Open questions

- Q2 (memory as a module the core does not import) and Q3 (rating signal: replace with a usage signal, cut as interim) are decided per the Planner; Q4 = files (JSON), Q5 = dogfood here first. Tracking = option a (five state files tracked, rest of `.agents/` ignored) — implemented in Loop 4 C4.
- When PR #3 and the Loop 4 PR merge (Aaron's cut after dogfood), tags land on master then.

## Last session

Session 55 — 2026-09-14 — `5348fd7f-06d1-4073-ac07-c7174f39c440`
