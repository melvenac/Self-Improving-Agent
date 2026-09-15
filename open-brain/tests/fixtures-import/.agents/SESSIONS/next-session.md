# Next Session Handoff

## Pick up here (2026-09-14, end of Session 54)

Loop 4 per ~/.agents/mailbox/channels/sia/loop-4-brief.md; branch loop/4-dogfood from loop/3-state-writer head ee2cdb8; first deliverable is `open-brain state import --draft` on this repo + the import report to the Planner; --commit only after the Planner's authorization. Report to the Planner session (find it with ListAgents — name starts 'Prime installation check' now, may differ after the Planner rolls; the mailbox channel sia is the durable record either way). Do not report to Aaron.

**Read the brief fully before starting** — the importer has a review gate before `--commit`, and R7 (a `merge-markers` /sync check) was appended after this session's slip. Aaron opens a fresh SIA session for Loop 4; this session ended at the Planner's roll instruction.

### Refs at end of Session 54

- `master` **86ea010** — merge of PR #4 (hotfix v0.29.1, `fix/relocate-case-sensitive-fs` at af943d4). Master CI green: run **34890412313**, the first green master run since 2026-08-31.
- `loop/3-state-writer` **ee2cdb8** — v0.30.0 (tag at 4e360fa) + QA amendment 9620b87 + master merge bb68600 + CHANGELOG marker fix ee2cdb8. **PR #3** open, draft, mergeable, CI green on runs **34890599712** and **34890716340**. Merging PR #3 is Aaron's release decision (first cut point after Loop 4's dogfood).
- Tags: v0.28.0 (d2ba131), v0.29.0 (62a3a00), v0.29.1 (af943d4), v0.30.0 (4e360fa). All on origin.
- No `loop/4-dogfood` branch exists (an empty one was created and deleted; state identical).
- PR #4 merged. Tree clean.

### The protocol (standing, from Aaron's "cut")

Planner (Clark, home seat) writes the loop brief with validation requirements and preservation constraints; Forge builds on a branch, commits, tags, reports in the fixed contract (loop, objective, branch, commit, version, changes[], validation[], preservation[], gaps[], measurements, next_recommendation). On the Planner's acceptance: push branch + tag, open a DRAFT PR against master with the report as body (`gh pr create --draft --body-file`). Never merge, never push master. Reports go via SendMessage AND appended to `~/.agents/mailbox/channels/sia/forge-to-atlas.md`. Run `impact` on every symbol before editing; re-index GitNexus before `detect_changes`.

### Watch out for

- **The live MCP server is on whichever build was running at the last `/mcp reconnect open-brain`** (v0.29.0 build as of Loop 2's reconnect; `open-brain/build/` on disk is whatever was last built). Ask via the Planner for a reconnect before relying on `ob_state` through the tool.
- **Bash heredocs eat `\\` in regexes** (`/\\/g` became `/\/g` twice this session). Write code with backslashes through the Write/Edit tools, never a heredoc.
- **Gate every commit on the resolver that precedes it.** bb68600 was committed with CHANGELOG conflict markers because a Python step failed and the next command was not chained with `&&`. R7 makes this impossible to be green again; until it lands, check `grep -c '^<<<<<<<' CHANGELOG.md` before any merge commit.
- **Python `print` of non-ASCII (`→`) crashes under cp1252** in this shell; keep prints ASCII.
- **GitNexus:** the index goes stale every commit; `detect_changes` on a stale index attributes hunks to line-shift neighbours (handleEnd, EndArgs, buildSql showed up falsely). `analyze` sometimes fails with an FTS inconsistency and succeeds on retry. Re-index before trusting scope.
- **Run vitest only from `open-brain/`** (entry 462). `cli-bootstrap.test.ts` now has a 30s describe timeout (9620b87) — a timeout there is a real hang.
- **`/sync` from `open-brain/` now resolves the root** (R4, Loop 3). The `state-schema` check skips with a reason until state.json exists; `summary-version` still forces a prose line into SUMMARY on every bump — Loop 4 R3 stops that.
- **CLAUDE.md and README.md are stale on the tool list** (say 13 tools; `ob_state` makes 14; ob_start/ob_state/sync root resolution undocumented in README). Not edited this session because the tree had to stay clean at /end — fold into Loop 4's doc audit.
- Importer inputs surveyed: INBOX 54 open / 3 in_progress / 0 blocked / 85 done, 13 `[superseded]`, sections `## P0 — Critical` … `## P3 — Low`, `## Completed`; DECISIONS.md 24 ADRs, none with a Date line; SUMMARY blockquote = 73 `>` lines after the title, `## Current State` at line 77 → `## Architecture Overview` at 182; task.md `## Current Objective`; next-session `## Pick up here`, `### Watch out for`.

### Open questions (for the Planner / Aaron, not for the next session to decide alone)

- Q2 (memory as a module the core does not import) and Q3 (rating signal: replace with a usage signal, cut as interim) are decided per the Planner; Q4 = files (JSON), Q5 = dogfood here first. Tracking = option a (five state files tracked, rest of `.agents/` ignored) — implemented in Loop 4 C4.
- When PR #3 and the Loop 4 PR merge (Aaron's cut after dogfood), tags land on master then.

### Carried items (still open, pre-loop backlog — unchanged this session)

Session-identity key carries the session (P0 #2 from Session 53); lifecycle threshold untouched (measurement running, read the prereg after 10 rated sessions); `/sync` validators owed (MCP command paths; skills three-source identity); surface `[id]` with `/start` entries; delete dead `db.ts`; `open-brain end` still runs the v1 pipeline; Cursor fail-open; Cursor start.md/end.md copies not on ob_start/ob_state; repo `.claude/` mirror policy; SESSION_TEMPLATE checklist wording; vault-index-parity warning; CLI door for ob_state (Loop 7); `ci-status` sync check (Loop 4 R4); actions/checkout@v4 + setup-node@v4 Node 20 deprecation notice on the runner.

### Knowledge stored this session

Checkpoint **543** (phase 1, full loop record). Experiences stored at /end: see Session_54.md.
