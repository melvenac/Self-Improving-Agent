# T-298 step 4: a record on a non-default branch names it, and the divergence banner stops firing every start

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t298s4-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-18, session 173. **Task:** T-298 (P1) item (3). **Tag:** `T-298-S4`. **Size:** SMALL
(5 src files, 10 verbatim edits, default behaviour unchanged). **Base:** the dispatch SHA clark names (a master that
contains this brief). **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: resolveUpstreamRef resolveRecordSource describeTreeCurrency renderStartReport (upstream-ref.ts gains resolveRecordRef; record-source and tree-currency default to it; start-report's merged citations call resolveUpstreamRef)
```

## Why

- **What happens.** Makerspace's record lives on `docs/t001-plans`. On 10-18 that branch was 832 commits ahead and
  334 behind `origin/main`, and it has never been merged. Tree currency compares a record with the default branch
  (D-062), so `THIS TREE HAS DIVERGED` fires at every Maker start and gets read past. That fails scorecard rows 1 and 5.
- **The fix.** `.agents/SYSTEM/greeting.json` gains a string key, `record_branch`.
  - When it names a fetched branch, the record is read from `origin/<record_branch>` and compared with it, and so is
    tree currency.
  - Merged citations (T-302) keep the default branch, because that is where code merges.
  - If the key is absent, malformed or names a branch that isn't fetched, `resolveUpstreamRef` is used, as today.
- **Item (6) is NOT changed.** Session rows carry only a date, so a brief committed the same day can't be ordered
  against the previous session. Changing `>=` to `>` would hide a brief that really is owed, which is worse than
  repeating one.

## The change, exactly

All files are under `docs/loops/t298-s4/`.

- **`edits.txt`:** 10 exact-once replacements across 5 files.
  - `upstream-ref.ts`: `resolveRecordRef` and `RECORD_BRANCH_RE`.
  - `record-source.ts` and `tree-currency.ts`: they default to `resolveRecordRef`.
  - `start-report.ts`: merged citations get `resolveUpstreamRef(projectRoot)`.
  - `greeting-flags.ts`: the key list in the doc comment.
- **`t298-s4.test.ts`:** copied verbatim, as a new file, into `open-brain/tests/pipelines/session-start/`.

## Measured before dispatch (QA PC SIM T298S4 by clark at f76374ae; master since then adds only docs/record commits)

These exact files were used. sha256 prefixes:

| File | sha256 prefix |
|---|---|
| edits | `48d6a218c2db5e3a` |
| test | `3acd9bd8917d8331` |
| m1 | `ec15117393ada522` |
| m2 | `e4911f545777aeb4` |
| m3 | `e50d5564b89b37d5` |
| m4 | `3741cfa69cbe0ddf` |

- The new file on the unpatched base: `4 failed (4)`.
- Apply: `APPLIED 10 edits to 5 files`. Both tsc runs exit 0.
- Wide run: `tests/pipelines/session-start tests/pipelines/sync tests/server.test.ts tests/t154-cli-start.test.ts`.
  `82 passed (82)` files, `1195 passed (1195)` tests.
  - Its one unhandled error was `[vitest-worker]: Timeout calling onTaskUpdate`, which is T-292's known flake. No test
    failed.
- Mutants, each on the patched tree:

  | Mutant | Red rows |
  |---|---|
  | m1 | R1, R4 |
  | m2 | R1, R4 |
  | m3 | R1 |
  | m4 | R4 |

## Existing tests (verdicts)

No existing row changes. Without `record_branch`, every changed path returns what it returns today.
`upstream-ref.test.ts` UR-1 to UR-9 still pass. Any red existing row means STOP and report
`BLOCKED T-298-S4 <test name>`.

The one exception is T-292's `Timeout calling onTaskUpdate` error when every test passed. Paste it and go on.

## Steps

1. **Shell.** In PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t298s4-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`. Otherwise STOP.
2. **Clone and install.**
   - Make a fresh clone into `(Join-Path $env:TEMP "t298s4-wt")`, unless the launcher named one.
   - Run `git checkout -q -b fix/t298-s4-record-branch <base>`. HEAD must equal the base, and the porcelain must be
     empty.
   - In `open-brain`, run `npm ci`, then the better-sqlite3 probe.
   - Forbidden: stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, killing processes by name, the
     real `~/.claude/open-brain/`, any `greeting.json`, and anything under `docs/`.
3. **Commit 1** (`T-298-S4: rows for a record on a non-default branch`). It holds the test file only.
   - Run `Copy-Item docs/loops/t298-s4/t298-s4.test.ts open-brain/tests/pipelines/session-start/`.
   - Run `$env:NO_COLOR='1'`. Then, in `open-brain`, run
     `npx vitest run tests/pipelines/session-start/t298-s4.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect `4 failed (4)`. Paste the summary and the `x` rows.
4. **Commit 2** (`T-298-S4: greeting.json record_branch: the record is read from and compared with its own branch`).
   - From the clone root, `node docs/loops/t298-s4/apply.cjs . docs/loops/t298-s4/edits.txt` must print exactly
     `APPLIED 10 edits to 5 files`.
   - Run `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build`
     (exit 0).
   - Run `npx vitest run tests/pipelines/session-start tests/pipelines/sync tests/server.test.ts tests/t154-cli-start.test.ts --no-file-parallelism --testTimeout=180000`
     (25-minute cap). Expect `1195 passed`. Paste the `Test Files`, `Tests` and any `Errors` lines.
5. **Check the commits.**
   - Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <base>..HEAD` shows 2 lines.
   - The status is empty.
6. **Mutants.** Do this on the committed fix, for each of `m1.txt` … `m4.txt`:
   - Run `node docs/loops/t298-s4/apply.cjs . docs/loops/t298-s4/<mN>`. It prints `APPLIED 1 edits to 1 files`.
   - Run the new test file. Paste the summary and the `x` rows.
   - Restore with `git checkout -- open-brain/src`. That restores the committed fix. The status must be empty.
   - Never commit a mutant.
   - Expected red rows: m1 R1, R4 · m2 R1, R4 · m3 R1 · m4 R4.
7. **Check the diff.** `git diff --name-only <base>..HEAD` shows exactly:
   - `open-brain/src/pipelines/session-start/greeting-flags.ts`
   - `open-brain/src/pipelines/session-start/record-source.ts`
   - `open-brain/src/pipelines/session-start/start-report.ts`
   - `open-brain/src/pipelines/session-start/tree-currency.ts`
   - `open-brain/src/pipelines/session-start/upstream-ref.ts`
   - `open-brain/tests/pipelines/session-start/t298-s4.test.ts`
8. **Push and open the PR.**
   - Push, never force. `git ls-remote origin refs/heads/fix/t298-s4-record-branch` must equal HEAD.
   - Run `gh pr create --base master --head fix/t298-s4-record-branch --title "T-298-S4: greeting.json record_branch: the record is read from and compared with its own branch" --body "Brief: docs/loops/t298-s4-record-branch-brief.md."`.
   - Then run `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T-298-S4 <sha40> PR #<n>` or `BLOCKED T-298-S4 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply.
- Every number is pasted output, with its command shown above it. Mark anything not run `NOT RUN`.
- Do not merge.

## After merge (not this run)

Maker adds `"record_branch": "docs/t001-plans"` to makerspace's greeting.json. That is Maker's file and Maker's call,
offered through clark. The live check is the next Maker greeting: it should show no divergence banner, and its tree
line should name `origin/docs/t001-plans`.
