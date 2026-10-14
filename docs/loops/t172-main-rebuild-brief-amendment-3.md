# T-172 amendment 3: F1-c kills M9 (a 4th commit in the r3 clone), and r3's six deviations are ruled

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, **in the r3 clone `C:\Users\Aaron Melven\Worktrees\oneoff-t172-r3`** (its local HEAD
`2acbacffd2ad302fb04f4ca1f9d8f6831a1d7ff9`, 3 commits, NOT pushed). No hub key. Code only. Ends at READY with PR #676
updated, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t172-r4-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-172 (P1). **Tag:** `T-172`. **Size:** SMALL.
**Branch:** `feat/t172-main-rebuild`, remote still at `778048db4566fc94406fd8d0f65859e38516dced` (round 2). Round 3's
three commits exist only in the clone above, on top of 778048db, with master `3c0bff7a` merged as commit 3.
**Amendment 2 stands** (`docs/loops/t172-main-rebuild-brief-amendment-2.md`), except where this changes it. So do the
brief and amendment 1. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: none: test code only (tests/pipelines/main-rebuild.test.ts, row F1-c); no src symbol changes in this round
```

## Why

r3 replied `BLOCKED T-172 M9 survives`, and the builder is right.
- Ruling 1a calls `cleanManifests()` right after the install, before its status is checked. So by the time the restore
  starts, the lock is already clean, and the restore's first `cleanManifests()` (ruling 1b) has nothing to do on any
  path F1-c reaches.
- It matters only when step 3's put-back itself fails. The builder tested a row that does exactly that: green on the
  fixed code, RED under M9 (exit 4, `RESTORE FAILED: git checkout <c1>: error: Your local changes ... overwritten by
  checkout: open-brain/package-lock.json`), and RED at 778048db.
- The other fifteen mutants all went red on their named rows, the wider run was 22/22 files green, and tsc exited 0.

## Ruling

1. **The r3 deviations are accepted as written** (each followed the ruling's intent):
   (1) `installExit` applies to the FIRST `["install"]` only; (2) F1-c detaches main at C1, not C2;
   (3) F1-a compares the lock with CRLF normalised to LF, with porcelain still asserted empty; (4) F3's backup
   directories are created empty; (5) the N-stale GREEN row uses `noFetch: true`; (6) the placement of MB, ME, N-pid,
   N-dash, the renamed R6 row and N-stale.
2. **Commit 4, `T-172 r3: F1-c kills M9 (the put-back itself fails)`**, `open-brain/tests/pipelines/main-rebuild.test.ts`
   only. In F1-c, wrap `deps.git` exactly as the r3 reply's candidate did, keeping every one of F1-c's existing
   expectations:
   ```ts
   let putBacks = 0;
   // ...in the deps passed to mainRebuild:
   git: (args, cwd) =>
     args[0] === "checkout" && args.includes("open-brain/package-lock.json") && ++putBacks === 1
       ? { status: 1, stdout: "", stderr: "error: simulated put-back failure" }
       : fk.deps.git(args, cwd),
   ```
   Fit the names to the row's own fake (`fk`) as r3's candidate did. Change nothing else, in this file or any other.
   End the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
3. **Steps 6 and 10 of amendment 2 now read 4 first-parent lines**: `git log --oneline 778048db..HEAD --first-parent`
   shows commits 1, 2, the merge, and commit 4.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t172-r4-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. **Start state.** `Set-Location 'C:\Users\Aaron Melven\Worktrees\oneoff-t172-r3'`. `git rev-parse HEAD` must print
   `2acbacffd2ad302fb04f4ca1f9d8f6831a1d7ff9` and `git status --porcelain` must be empty, else STOP, BLOCKED.
   `node -e "require('better-sqlite3')"` in `open-brain` must load (else `npm rebuild better-sqlite3`, and say so).
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
   `npm run test:heavy`, killing any process by name, and any edit outside the one test file.
3. **Commit 4** (ruling 2). Then, in `open-brain`:
   - `npx vitest run tests/pipelines/main-rebuild.test.ts --no-file-parallelism --testTimeout=180000`: all green. Paste.
   - **M9 again:** delete the restore's first `cleanManifests()` and its throw, run the main-rebuild file only: F1-c must
     go RED. Paste. `git checkout -- open-brain/src/pipelines/main-rebuild/index.ts`, porcelain empty.
   - **M8 again** (step 3's `cleanManifests()` deleted): F1-a still RED. Paste, revert, porcelain empty.
   - `npx tsc --noEmit`: exit 0.
4. `git log --oneline 778048db..HEAD --first-parent` shows 4 lines; `git status --porcelain` is empty;
   `git diff --name-only 3c0bff7a HEAD` shows exactly round 2's 9 files (amendment 2, step 9).
5. Amendment 2's step 10: `git push origin feat/t172-main-rebuild` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr view 676 --json mergeable,mergeStateStatus` is not CONFLICTING; `gh pr checks 676 --watch --interval 30`
   (cap 20 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T-172 <sha40> PR #676` or `BLOCKED T-172 <reason>`.
- Then each command with its output: the green run, M9 and M8, tsc, the 4-line log, the name-only diff,
  `ls-remote` = `rev-parse`, mergeability and CI. Mark anything not run `NOT RUN`. Do not merge.
