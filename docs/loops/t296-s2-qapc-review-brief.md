# T-296-S2 QA review on the QA PC: PR #810 (opt-in compact State block), default-off check

Runtime: CC (claude -p, Opus 5.5)
SEAT: **QA PC one-off**, NOT the desktop. No hub key needed. **Read-only: no commit, no push, no PR, no PR comment,
no edit outside the scratch clone.** Ends at a VERDICT, which decides an SG-1 merge. You are the QA judge; the builder
was a separate Claude one-off, so you are not judging your own work.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t296s2-qa-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-16, session 173. **Task:** T-296 (P1). **Tag:** `T-296-S2-QA`. **Size:** SMALL.
**Why a one-off:** the default judge (D-140) is a Grok bot; grok-sia-review and grok-qa-sia both were last seen at about
08:22-08:25Z, with this job unanswered. The checks below are the same five the Grok job carried. Whichever verdict lands first
is the judge; the planner withdraws the other job.
**Spec:** `docs/loops/t296-state-compact-brief.md` at master `24ddc764bac8381fc6b0d73f6093151e0a85994e`.
**Base:** `24ddc764bac8381fc6b0d73f6093151e0a85994e`. **Head:** `ef22267c32bdb98f957aa21982b0fe284ca34c34` (2 commits).
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: none: review only; no repository file is changed
```

## What is being proved

GitNexus rated the change HIGH: `renderState` is on every seat's session-start path. The property is **DEFAULT OFF**:
with no `state_compact` key in a repo's `.agents/SYSTEM/greeting.json`, every render is byte-identical to the base.

## Rules

- Do not read, copy or print `~/.claude.json`, `~/.claude/settings.json`, any `.mcp.json`, `.env` or key file (G-051).
- Do not touch `~/.claude/open-brain/` or any existing checkout. Everything happens in a fresh clone under
  `%TEMP%\t296s2qa\`.
- The QA PC home has a space ("Aaron Melven"): quote every path.
- Paste each command with its output. Every number in the reply is pasted output. Mark anything you did not run
  NOT RUN, with the reason.

## Steps

0. PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` (must be `v22.*`).
1. In `%TEMP%\t296s2qa\`:
   `git clone https://github.com/melvenac/Self-Improving-Agent t296s2r`, then in it
   `git checkout -q ef22267c32bdb98f957aa21982b0fe284ca34c34`.
   - `git rev-parse HEAD` must print `ef22267c32bdb98f957aa21982b0fe284ca34c34`.
   - `git log --oneline 24ddc764..HEAD` must print exactly 2 lines (`d5cecae9`, `ef22267c`).
   - `git diff --name-only 24ddc764..HEAD` must print exactly these 5 files:
     - `open-brain/src/pipelines/session-start/greeting-flags.ts`
     - `open-brain/src/pipelines/session-start/start-report.ts`
     - `open-brain/src/pipelines/session-start/state-render.ts`
     - `open-brain/src/pipelines/sync/checks.ts`
     - `open-brain/tests/pipelines/session-start/t296-state-compact.test.ts`
2. **Default off, by reading.** `git diff -w 24ddc764..HEAD -- open-brain/src/pipelines/session-start/state-render.ts`.
   With whitespace ignored:
   - every removed line must reappear unchanged inside an `else` branch;
   - every added line must be one of: the `compact?: boolean` member and its doc comment; an
     `if (options.compact === true) {`, `} else {` or `}` line; or a line inside a compact branch.
   Name any added or changed line that runs when `compact` is absent or false.
   Then `git grep -n "compact:" -- open-brain/src`: `compact:` must be set at exactly two call sites, `start-report.ts`
   and `checks.ts`, both from `greetingFlag(projectRoot, "state_compact")`.
3. **Default off, by running.** In `open-brain\`: `npm ci`, then `node -e "require('better-sqlite3')"`, then
   `npx vitest run tests/pipelines/session-start/a2a-byte-identical.test.ts tests/pipelines/session-start/state-render.test.ts tests/pipelines/session-start/t296-state-compact.test.ts tests/pipelines/sync/greeting-size.test.ts --no-file-parallelism --testTimeout=180000`
   Expected: 4 files pass; `t296-state-compact` has 7 tests; the A2A golden (`a2a-byte-identical`) is green and
   unchanged by the diff (it is not in the step-1 file list). Paste the `Test Files` and `Tests` lines, and the
   runner's exit code read on its own (not through a pipe).
4. **No repo opts in.** `git ls-tree -r --name-only HEAD | grep -c "greeting.json"`; then for each listed path,
   `git show HEAD:<path>`. None may contain `state_compact`.
5. **Judgment, at most 8 lines.** With `state_compact` ON, does anything the reader NEEDS at session start disappear?
   The brief keeps: the reader's own handoff (pick-up, watch-outs, open questions, loop state), tasks, objective, the
   decisions line, and REOPENED verified claims. Say whether each survives, citing the test or the code line.

## Report (reply)

First line, exactly one of:
- `VERDICT T-296-S2 ACCEPT ef22267c32bdb98f957aa21982b0fe284ca34c34`
- `VERDICT T-296-S2 CHANGES ef22267c32bdb98f957aa21982b0fe284ca34c34 <one-line reason>`
- `BLOCKED T-296-S2 <reason>`

Then steps 0-5 in order, each command with its output, then NOT RUN. Leave `%TEMP%\t296s2qa\` in place.
