# T-291: latest-brief.test.ts cleans up its fixture repositories without racing git

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, NOT the desktop. No hub key. Tests-only (SG-1: merges on green CI after the planner's ACCEPT).
Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t291-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-291 (P3). **Tag:** `T-291`. **Size:** SMALL.
**Base:** the dispatch SHA clark names (a master that contains this brief). **Checklist:**
`~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: none: tests-only (open-brain/tests/pipelines/session-start/latest-brief.test.ts); no src symbol changes
```

## Why

CI run 38609276291 (records PR #741, records-only) failed one file while every test passed. The file was
`tests/pipelines/session-start/latest-brief.test.ts`, and the error came from its `afterAll` at line 18:
`ENOTEMPTY: directory not empty, rmdir '<tmp>/latest-brief-*/.git'`. A rerun was green.

- **The source spawns nothing in the background:** `handleStart` and `latest-brief.ts` use only `execFileSync`.
- **What still writes into `.git` after a commit returns is git's own auto-maintenance.** `git commit` can start
  `git maintenance run --auto` (or `gc --auto`) detached, so it is still writing into `.git` when `rmSync` walks the
  directory.
- **Other test files already retry the cleanup** (`active-session`, `audit-fix-a1-r5/r7/r8/r9`).

## Ruling (exact; this one test file only)

1. Line 23, the `git()` helper: add `"-c", "maintenance.auto=false", "-c", "gc.auto=0"` immediately after
   `"-c", "commit.gpgsign=false",`. With these, the fixture's commits never start background maintenance.
2. Line 18: `rmSync(d, { recursive: true, force: true })` →
   `rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })`, the same options the other files use.
3. Nothing else changes. No new rows: the race cannot be made deterministic in a test, so the evidence is the diff
   plus the file passing.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t291-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. Fresh clone into `(Join-Path $env:TEMP "t291-wt")` unless the launcher named one;
   `git checkout -q -b fix/t291-latest-brief-cleanup <base>`; `rev-parse HEAD` = base; porcelain empty. `npm ci` in
   `open-brain`, then `node -e "require('better-sqlite3')"` (else `npm rebuild better-sqlite3`).
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
   `npm run test:heavy`, killing any process by name.
3. Before editing, `Select-String -Path open-brain/tests/pipelines/session-start/latest-brief.test.ts -Pattern 'rmSync\(d, \{ recursive: true, force: true \}\)','"commit.gpgsign=false", \.\.\.args'`
   prints exactly 2 lines (lines 18 and 23). Else STOP, `BLOCKED T-291 anchors moved`.
4. **One commit, `T-291: latest-brief fixtures disable git auto-maintenance and retry their cleanup`:** rulings 1-2.
   In `open-brain`, with `$env:NO_COLOR='1'`:
   `npx vitest run tests/pipelines/session-start/latest-brief.test.ts --no-file-parallelism --testTimeout=180000`
   (all pass) and `npx tsc --noEmit` (exit 0). Paste both. Then run the same vitest command 3 more times and paste
   each summary line (all pass).
5. The message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline <base>..HEAD`
   shows 1 line; porcelain empty. `git diff <base>..HEAD` shows exactly the 2 changed lines in that one file (paste it).
6. `git push origin fix/t291-latest-brief-cleanup` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr create --base master --head fix/t291-latest-brief-cleanup --title "T-291: latest-brief fixtures stop racing git on cleanup" --body "Brief: docs/loops/t291-latest-brief-cleanup-brief.md. Tests-only (SG-1)."`;
   `gh pr checks <n> --watch --interval 30` (cap 20 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T-291 <sha40> PR #<n>` or `BLOCKED T-291 <reason>`.
- Then each command with its output. Mark anything not run `NOT RUN`. Do not merge.
- **Out of scope, noted on T-291:** the other flake, a vitest-worker `onTaskUpdate` timeout after every test had
  passed (run 38613905579), is not this brief.
