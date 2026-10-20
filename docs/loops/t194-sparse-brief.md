# S173S: the citation scans read past a sparse checkout's cone (T-194)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named s173s-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-19, session 173. **Task:** T-194 (P0). **Tag:** `S173S`.
**Size:** SMALL (1 src file, 3 edits; 1 new test file). **Base:** the dispatch SHA clark names (a master that contains
this brief). **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: citedTaskIds citedGapIds citedIds gitGrep (state-writer.ts: the retention and gap-id scans also read the index)
```

## Why

T-194 makes the planner checkout sparse: cone `docs .agents .claude`, with no `open-brain/`, `scripts/` or
`project-template/` in the tree. Before converting it, SIM T194-SPARSE compared a full and a sparse worktree of the same
commit. Layout, the CLI briefing, an `ob_state` write and staying sparse across detaches all matched. One thing did not:

- `citedTaskIds` (done-task retention) and `citedGapIds` (`add_gap`'s id reuse guard) run a worktree `git grep`. In a
  sparse checkout that skips every file outside the cone. On git 2.55 the sparse tree found **219 of 280** cited task
  ids and **74 of 75** gap ids.
- Nothing was dropped that day, but only because every done task due to drop was also cited outside `src/`. A
  planner `ob_state` write from a sparse tree could drop a task that only code cites, or let `add_gap` reuse a gap
  id that only code cites.

**Fix:** both scans read the working tree AND the index (`git grep` ∪ `git grep --cached`) and merge the hits. The
index still lists the files a sparse checkout leaves out, so the sparse answer equals the full one. In a full checkout
the union equals the old answer, unstaged edits included (row R2 pins that).

Out of scope: the conversion of the planner checkout itself (Atlas does it after the merge), and any other `git grep`
user.

## The change, exactly

All files are under `docs/loops/t194-sparse/`.

- **`edits.txt`:** 3 exact-once replacements in `open-brain/src/shared/state-writer.ts`:
  1. `citedGapIds` calls the new `trackedGrep(projectRoot, "G-[0-9]+")`.
  2. `citedIds` calls `trackedGrep` and returns an empty map on any non-zero status. Below it come the shared
     `CITATION_EXCLUDES` (the same 5 record/view pathspecs as before) and `trackedGrep`, which runs both scans and
     returns the first real failure unchanged, exit 1 when neither matched, or the joined text.
  3. `gitOut` (now unused) is removed and `gitGrep`'s doc comment is shortened.
- **`t194-sparse.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/shared/t194-sparse.test.ts`.
  - R1: a sparse checkout (cone `docs`): a task id cited only in `src/` is still cited.
  - R2: a full checkout: an unstaged edit to a tracked file still cites its id.
  - R3: a sparse checkout: a gap id cited only in `src/` is still cited.

## Measured before dispatch

QA PC SIM T194-SPARSE-2 by clark at `34c56f79` (master `4d8cb40e` plus these files) used these exact files. sha256
prefixes:

| File | sha256 prefix |
|---|---|
| edits | `00e4a2c28bf25572` |
| test | `0e1837962102356f` |
| m1 | `97d98240e6338c7f` |
| m2 | `bedd058a5b74b277` |
| sim | `1aa6ca2d69f9d62c` |

- The new file on the unpatched base: `2 failed | 1 passed (3)`. R1 and R3 are red; R2 is green, because it is a
  guard.
- Apply: `APPLIED 3 edits to 1 files`. Both tsc runs and the build exit 0.
- The step 4 run: `97 passed (97)` files, `1503 passed (1503)` tests, with no Errors line.
- `sim.mjs` on the patched build: ALL PASS. S2 counted 281 task ids and 76 gap ids in both trees.
- Mutants, each on the patched tree:

  | Mutant | What it does | Red rows |
  |---|---|---|
  | m1 | worktree scan only (`[[]]`) | R1, R3 |
  | m2 | index scan only (`[["--cached"]]`) | R2 |

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/shared/state-writer.test.ts` (retention, `kept_cited_task_ids`, gap reuse) | stays green | Full-checkout fixtures; the union adds nothing there. Green in the SIM. |
| `tests/shared/op-shape.test.ts`, `tests/shared/t271-op-refusals.test.ts` | stay green | `add_gap` shapes and refusals; the scan result is unchanged. Green in the SIM. |
| `tests/server.test.ts` (`ob_state` through the server) | stays green | Green in the SIM. |
| `tests/pipelines/sync`, `tests/pipelines/session-start` | stay green | They do not call the scans; run as a check. Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED S173S <test name>`. The one exception is T-292's
`Timeout calling onTaskUpdate` error when every test passed: paste it and go on.

## Steps

1. **Shell.** In PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "s173s-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`. Otherwise STOP.
2. **Clone and install.**
   - Make a fresh clone into `(Join-Path $env:TEMP "s173s-wt")`, unless the launcher named one.
   - Run `git checkout -q -b fix/t194-sparse-scans <base>`. HEAD must equal the base, and the porcelain must be empty.
   - In `open-brain`, run `npm ci`, then the better-sqlite3 probe.
   - Forbidden: stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/open-brain/`, `~/.claude/commands/`, and anything under `docs/`.
3. **Commit 1** (`S173S: rows for the citation scans in a sparse checkout`). It holds the test file only.
   - Run `Copy-Item docs/loops/t194-sparse/t194-sparse.test.ts open-brain/tests/shared/`.
   - Run `$env:NO_COLOR='1'`. Then, in `open-brain`, run
     `npx vitest run tests/shared/t194-sparse.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect `2 failed | 1 passed (3)`. Paste the summary and the `x` rows.
4. **Commit 2** (`S173S: the citation scans read the index too, so a sparse checkout cites what a full one does (T-194)`).
   - From the clone root, `node docs/loops/t194-sparse/apply.cjs . docs/loops/t194-sparse/edits.txt` must print
     exactly `APPLIED 3 edits to 1 files`.
   - Run `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build` (exit 0).
   - Run `npx vitest run tests/shared tests/server.test.ts tests/pipelines/sync tests/pipelines/session-start --no-file-parallelism --testTimeout=180000`
     (25-minute cap). Expect `1503 passed` (more only if the base added tests: then paste the count and the base's new
     test files). Paste the `Test Files`, `Tests` and any `Errors` lines.
5. **Check the commits.**
   - Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <base>..HEAD` shows 2 lines.
   - The status is empty.
6. **Mutants.** Do this on the committed fix, for each of `m1.txt` and `m2.txt`:
   - Run `node docs/loops/t194-sparse/apply.cjs . docs/loops/t194-sparse/<mN>`. It prints `APPLIED 1 edits to 1 files`.
   - Run the new test file. Paste the summary and the `x` rows.
   - Restore with `git checkout -- open-brain/src`. The status must be empty.
   - Never commit a mutant.
   - Expected red rows: m1 R1 and R3 · m2 R2.
7. **The SIM on the fix.** From the clone root, with the build from step 4: `node docs/loops/t194-sparse/sim.mjs .`.
   Paste the whole output and the exit code. Expect `SIM T194-SPARSE: ALL PASS`. Then `git worktree list` must show
   only the clone.
8. **Check the diff.** `git diff --name-only <base>..HEAD` shows exactly:
   - `open-brain/src/shared/state-writer.ts`
   - `open-brain/tests/shared/t194-sparse.test.ts`
9. **Push and open the PR.**
   - Push, never force. `git ls-remote origin refs/heads/fix/t194-sparse-scans` must equal HEAD.
   - Run `gh pr create --base master --head fix/t194-sparse-scans --title "S173S: the citation scans read past a sparse checkout's cone (T-194)" --body "Brief: docs/loops/t194-sparse-brief.md."`.
   - Then run `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY S173S <sha40> PR #<n>` or `BLOCKED S173S <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply.
- Every number is pasted output, with its command shown above it. Mark anything not run `NOT RUN`.
- Do not merge.

## After merge (not this run)

REBUILT. Then Atlas converts `~/Worktrees/sia-planner` to sparse (`git sparse-checkout set --cone docs .agents
.claude`, then removes the ignored `open-brain/build` and `open-brain/node_modules`). The live check: a fresh greeting
from the sparse tree, and one `ob_state` write whose `KEPT despite retention` count equals the full tree's.
