# T-184 fix 1: the two exact-list rows in state-import.test.ts name the new record file

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key). It must run on the desktop: the local branch it finishes exists only there.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t184-fix-1-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-12, session 168. **Task:** T-184. **Tag:** `T-184-fix-1`. **Parent:**
`docs/loops/t184-draft-inputs-brief.md`; its rules hold (no stash, reset, force, rebase or amend). **Size:** TINY.

```text
IMPACT-TARGETS: none — two expected-value lists in one existing test file
```

## Ruling on the BLOCKED reply

**The BLOCKED was correct, and the gap is the planner's.** The brief adds a file that `--draft` writes and `--commit`
moves, but it did not name the two existing rows that assert the EXACT list of those files. Both now meet a
legitimate new file. **Approved: edit exactly those two expected values.** Everything else in the reply is accepted
as reported (base 32/32 files, 238 tests; D1-D7 red, then green; tsc 0; the D4 snapshot-path fix inside commit 2).

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t184-fix-1-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`).
2. `Set-Location (Join-Path $env:TEMP "t184-wt")`. `git rev-parse HEAD` must print `9de7ce3322b9987e97805f7133fe891582fcfcc1`
   (the reply's commit 2; planner-read in that clone), `git branch --show-current` must print `fix/t184-draft-inputs`, and `git status --porcelain`
   must be empty. Otherwise STOP, `BLOCKED T-184-fix-1 clone <state>`.
3. In `open-brain/tests/pipelines/state-import.test.ts`:
   - add `DRAFT_INPUTS_REL` to the existing import from `../../src/pipelines/state-import/index.js`;
   - row "--draft writes a schema-valid draft + report …" (line ~76): the expected array
     `[DRAFT_REL, REPORT_REL]` becomes `[DRAFT_REL, DRAFT_INPUTS_REL, REPORT_REL].sort()`;
   - row "--commit: snapshot byte-complete …" (line ~201): the expected moved list gains
     `` `${snapRel}/state.draft.inputs.json` `` inside the same `[ … ].sort()`.
   Nothing else in the file changes.
4. Commit: `T-184: the two exact-list rows name state.draft.inputs.json`, ending with
   `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. `git log --oneline 10034c5a..HEAD` then shows 3 lines.
5. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), then the parent's wide run
   `npx vitest run tests/pipelines/state-import tests/pipelines/import-cmds tests/pipelines/bootstrap-fix --no-file-parallelism --testTimeout=180000`
   (30-minute cap): all green, 245 tests.
6. Then do the parent's steps 9 (mutants M1-M3), 10 (the name-only diff, which now also lists
   `open-brain/tests/pipelines/state-import.test.ts`) and 11 (push, ls-remote = rev-parse, `gh pr create` as written
   there, CI).

## Reply

The first line is `READY T-184 <sha40> PR #<n>` or `BLOCKED T-184-fix-1 <reason>`. Then each command with its output.
At most 2 attempts at a red. Mark anything not run `NOT RUN`. Do not merge.
