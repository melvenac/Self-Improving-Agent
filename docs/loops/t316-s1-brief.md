# T316-S1: open-task-commits reads the code branch too, not HEAD alone (T-316 part 1)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t316-s1-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-20, session 174. **Task:** T-316 (P1). **Tag:** `T316-S1`. **Size:** SMALL (2 src
files, 5 edits; 1 new test file). **Base:** the dispatch SHA Atlas names (a master that contains this brief).
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: checkOpenTaskCommits resolveUpstreamRef verifiesAsCommit (new: resolveCodeRef in upstream-ref.ts; checkOpenTaskCommits gains an optional third parameter codeRef)
```

## Why

T-256's `/sync` check `open-task-commits` warns when an open or in_progress task is named by a code commit. It reads
HEAD's history only. Maker measured it on Makerspace on 10-20: it found 0 of the 5 tasks already shipped. The record
lives on `docs/t001-plans`, and `origin/main` is not an ancestor of it, so the check never sees a code commit. The same
holds for any project with `record_branch` set, and for a planner worktree detached at a records commit.

**Fix:** the log also reads the default branch's remote-tracking ref. That ref comes from `resolveUpstreamRef`
(T-250), and it is added only when it resolves to a commit in this clone. A missing ref is never passed to git. When a
second ref is read, each message names where it looked (`on HEAD or origin/master`) and the summary adds
`across HEAD and origin/master`. With HEAD alone, every message is unchanged.

Part 2 (the briefing line `MAYBE SHIPPED (n): ...` at `/start`) follows this one.

## The change, exactly

All files are under `docs/loops/t316-s1/`.

- **`edits.txt`:** 5 exact-once replacements in 2 files.
  1. `open-brain/src/pipelines/session-start/upstream-ref.ts`: a new exported `resolveCodeRef(projectRoot)`. It
     returns the default branch's ref when `verifiesAsCommit`, else `null`.
  2. `open-brain/src/pipelines/sync/open-task-commits.ts`: the import.
  3. The same file: `checkOpenTaskCommits` gets an optional third parameter `codeRef?: string | null`. `undefined`
     resolves it, and `null` means HEAD alone.
  4. The same file: the `git log` reads `HEAD` plus that ref.
  5. The same file: the hit message and the `scanned` summary name the ref(s).
- **`t316-s1.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/pipelines/sync/t316-s1.test.ts`. It uses
  real git repos in temp dirs.
  - R1: a code branch passed in names the open task, and the message says where it looked.
  - R2 (guard): HEAD alone does not see the code commit, and its message is unchanged.
  - R3: with no codeRef given, origin's default branch is found and read.
  - R4 (guard): with no origin refs at all, the check still runs on HEAD alone, and no missing ref is passed to git.

## Measured before dispatch

QA PC SIM T316-S1 at `4c277391` (master `064799b7` plus these files). sha256 prefixes:

| File | sha256 prefix |
|---|---|
| edits | `58f766204971018d` |
| test | `d10c0ac4faf6e8d8` |
| m1 | `8b7d4d757b44e221` |
| m2 | `9647a3ea6e8fcb4c` |

- The new file on the unpatched base: `2 failed | 2 passed (4)`. R1 and R3 red, R2 and R4 green.
- Apply: `APPLIED 5 edits to 2 files`. Both tsc runs and the build exit 0.
- The step 4 run: `98 passed (98)` files and `1479 passed (1479)` tests. No `Errors` line, no T-292 timeout. All T256
  rows are green.
- `open-brain sync` on the SIM clone: `open-task-commits [warn]: 8 open task(s) ... scanned 1500 non-merge commits
  (bound 1500) against 38 open/in_progress task(s) across HEAD and origin/master`.
- m1 (the log reads `HEAD` alone again): R1 and R3 red, `2 failed | 2 passed`.
- m2 (`resolveCodeRef` returns the ref without verifying it): R4 red, `1 failed | 3 passed`.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/pipelines/sync/open-task-commits.test.ts`: T256-1 to T256-11, T256-6(e/f/g) | stay green | They use a fake runner and a temp root with no origin, so `resolveCodeRef` returns `null`, the log reads HEAD alone, and every message is unchanged. Green in the SIM. |
| `open-task-commits.test.ts` T256-7 (two git calls however many tasks) | stays green | `resolveCodeRef` calls git directly, not through the injected runner, so the runner still sees 2 calls. Green in the SIM. |
| `open-task-commits.test.ts` T256-8 (runSync wiring) | stays green | `runSync` still calls `checkOpenTaskCommits(projectRoot)`. Green in the SIM. |
| `tests/pipelines/session-start` (upstream-ref and briefing rows) | stay green | `resolveUpstreamRef` is unchanged; `resolveCodeRef` is new and only wraps it. Green in the SIM. |
| `tests/shared` | stay green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED T316-S1 <test name>`. There are two exceptions, both
from T-292 load on the shared QA PC:
- T-292's `Timeout calling onTaskUpdate` error when every test passed: paste it and go on.
- That error with ONE red existing test outside `t316-s1.test.ts`: re-run that test's file alone. If it is green
  alone, paste both runs and go on. If it is red alone, STOP.
- A red `t316-s1.test.ts` row is never an exception.

## Steps

1. **Shell.** In PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t316-s1-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`. Otherwise STOP.
2. **Clone and install.**
   - Make a fresh clone into `(Join-Path $env:TEMP "t316-s1-wt")`, unless the launcher named one.
   - Run `git checkout -q -b fix/t316-s1-code-branch <base>`. HEAD must equal the base, and the porcelain must be
     empty.
   - In `open-brain`, run `npm ci`, then the better-sqlite3 probe.
   - Forbidden: stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/open-brain/`, `~/.claude/commands/`, and anything under `docs/`.
3. **Commit 1** (`T316-S1: rows for the code-branch read`). It holds the new test file only.
   - Run `Copy-Item docs/loops/t316-s1/t316-s1.test.ts open-brain/tests/pipelines/sync/`.
   - Run `$env:NO_COLOR='1'`. Then, in `open-brain`, run
     `npx vitest run tests/pipelines/sync/t316-s1.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect `2 failed | 2 passed (4)`: R1 and R3 red, R2 and R4 green. Paste the summary and the `x` rows.
4. **Commit 2** (`T316-S1: open-task-commits reads the code branch too, not HEAD alone (T-316)`).
   - From the clone root, `node docs/loops/t316-s1/apply.cjs . docs/loops/t316-s1/edits.txt` must print exactly
     `APPLIED 5 edits to 2 files`.
   - Run `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build` (exit 0).
   - Run `npx vitest run tests/pipelines/sync tests/pipelines/session-start tests/shared --no-file-parallelism --testTimeout=180000`
     (25-minute cap). Expect 0 failed, 98 files and 1479 tests. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - In `open-brain`, run `node build/cli.js sync 2>&1 | Select-String open-task-commits`. Paste the line. It must
     say `across HEAD and origin/master`.
5. **Check the commits.**
   - Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <base>..HEAD` shows 2 lines.
   - The status is empty.
6. **Mutants.** On the committed fix, for each of `m1.txt` and `m2.txt` in turn:
   - Run `node docs/loops/t316-s1/apply.cjs . docs/loops/t316-s1/<m>.txt`. It prints `APPLIED 1 edits to 1 files`.
   - Run the new test file. Paste the `x` rows. Expected red: m1 -> R1 and R3; m2 -> R4.
   - Restore with `git checkout -- open-brain/src`. The status must be empty. Never commit a mutant.
7. **Check the diff.** `git diff --name-only <base>..HEAD` shows exactly:
   - `open-brain/src/pipelines/session-start/upstream-ref.ts`
   - `open-brain/src/pipelines/sync/open-task-commits.ts`
   - `open-brain/tests/pipelines/sync/t316-s1.test.ts`
8. **Push and open the PR.**
   - Push, never force. `git ls-remote origin refs/heads/fix/t316-s1-code-branch` must equal HEAD.
   - Run `gh pr create --base master --head fix/t316-s1-code-branch --title "T316-S1: open-task-commits reads the code branch too (T-316)" --body "Brief: docs/loops/t316-s1-brief.md."`.
   - Then run `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T316-S1 <sha40> PR #<n>` or `BLOCKED T316-S1 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply.
- Every number is pasted output, with its command shown above it. Mark anything not run `NOT RUN`.
- Do not merge.

## After merge (not this run)

`sia-rebuild`. From then on, `/sync` in a project whose record lives apart from its code (Makerspace's
`docs/t001-plans`) reports open tasks named by code commits on the default branch. Maker's first measure is to rerun
`open-brain sync` there and count how many of the 5 shipped tasks it now names. The id form still has to be `T-NNN`.
