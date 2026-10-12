# T-252-mf fix 1: T252-7 reads the file the fallback moved to

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key). It must run on the desktop, because the merge it finishes exists only there.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t252-mf-fix-1-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-12, session 168. **Task:** T-252. **Tag:** `T-252-mf-fix-1`. **Parent:**
`docs/loops/t252-merge-fix-task.md`; its rules hold (no rebase, amend, reset, force or stash). **Size:** TINY.

```text
IMPACT-TARGETS: none — test file only
```

## Ruling on the BLOCKED reply (`t252-mf-reply.md`)

**Option (a) is approved.** The planner missed T252-7 when it wrote the parent task. T252-7 pins the call site by
reading `src/server.ts`. After T-154 the call site is in `src/pipelines/session-start/start-report.ts`, so the row
must read that file. This is a path change in a test that #580 itself adds, not an edit to a master test. Everything
else in the local merge `7d9ecc34` is accepted as reported: one conflict, both greps right, tsc 0, the stat as
expected.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t252-mf-fix-1-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`).
2. `Set-Location (Join-Path $env:TEMP "t252-mf-wt")`. `git rev-parse HEAD` must print
   `7d9ecc34b1aad6fa678ed604814e4b34c0b2086f`, and `git status --porcelain` must be empty. If the clone is gone or
   HEAD differs: STOP, `BLOCKED T-252-mf-fix-1 clone <state>`. Then `gh pr view 580 --json headRefOid` must still be
   `4f607a6fc951628007802c6acd59495cd4158248`, else STOP, BLOCKED (the remote moved).
3. In `open-brain/tests/pipelines/session-start/t252-briefing-followups.test.ts`, row T252-7: change only the path
   `"../../../src/server.ts"` to `"../../../src/pipelines/session-start/start-report.ts"`, and the title
   `handleStart's fallback` to `renderStartReport's fallback`. The two `expect`s stay unchanged.
4. Commit: `T-252: T252-7 reads start-report.ts, where T-154 moved the fleet fallback`, ending with
   `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. `git status --porcelain` is then empty.
5. Runs, in `open-brain`:
   - `npx tsc --noEmit` (exit 0)
   - `npx vitest run tests/pipelines/session-start/t252-briefing-followups.test.ts tests/t154-cli-start.test.ts --no-file-parallelism --testTimeout=180000`
     (all green)
   - **Bite:** in start-report.ts, put back the old three-line fallback body by hand, run the t252 file, paste
     T252-7 red, then `git checkout -- open-brain/src/pipelines/session-start/start-report.ts` and confirm a clean tree.
6. `git diff --stat origin/master..HEAD` must still list exactly `fleet.ts`, `start-report.ts` and the t252 test
   file. Then `git push origin fix/t252-briefing-followups` (a normal push). `git ls-remote` must equal
   `git rev-parse HEAD`, and `gh pr view 580 --json mergeStateStatus` must not be `DIRTY`.

## Reply

The first line is `READY T-252-mf-fix-1 <sha40> PR #580` or `BLOCKED T-252-mf-fix-1 <reason>`. Then each command
with its output. At most 2 attempts at a red. Mark anything not run `NOT RUN`.
