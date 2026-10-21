# T316-S2: MAYBE SHIPPED in the /start briefing, opt-in (T-316 part 2)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-21, session 174. **Task:** T-316 (P1). **Tag:** `T316-S2`. **Size:** SMALL (9 edits in
5 files, 5 test edits in 2 files, 1 new test file). **Base:** the START sha the launcher names (a master that contains
this brief).

```text
IMPACT-TARGETS: checkOpenTaskCommits renderBriefing renderBudgeted renderStartReport (new in open-task-commits.ts: scanOpenTaskCommits, describeMaybeShipped, MAYBE_SHIPPED_MAX_CHARS; BriefingInput gains maybeShipped)
```

## Why

T-316 S1 (#895) made /sync's `open-task-commits` read the default branch too; on Makerspace it named 8 open tasks
that code commits already name (0 before). The reader still sees that only in /sync. S2 puts the same match in the
/start briefing, opt-in per repo (greeting.json `maybe_shipped`, default OFF, so A2A renders unchanged):

- One note, `MAYBE SHIPPED (n): T-x T-y +k more, see /sync`, at most `MAYBE_SHIPPED_MAX_CHARS` (64). Ids only; the
  commits are /sync's line. No hit prints nothing. A scan that cannot run prints `MAYBE SHIPPED: not checked (<why>)`.
- Legacy layout: its own line after the pick-up notes. Budgeted layout: appended to the pick-up line after T-302's
  merged note and paid for out of the pick-up's 400-char cap, so the budget does not grow.
- ob_start passes the record it renders (master's when the tree is behind), not the local file.
- The match moves into `scanOpenTaskCommits`, shared by the /sync check and the note; every check message is unchanged.
- SIA turns the flag on in its own `.agents/SYSTEM/greeting.json`.

## The change, exactly

All files are under `docs/loops/t316-s2/`.
- **`tests.txt`:** 5 edits in 2 files. `open-brain/tests/pipelines/session-start/briefing-budget.test.ts`: the
  every-flag worst case also carries a 64-char note and asserts it ends the pick-up line. `open-brain/tests/server.test.ts`:
  one new row, `T-316 S2: maybe_shipped ON ...`, through `handleStart` on a temp git repo.
- **`t316-s2.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/pipelines/sync/t316-s2.test.ts`. R1-R5
  `describeMaybeShipped` (real temp git repos and fake runners); R6 legacy layout; R7 budgeted layout.
- **`edits.txt`:** 9 exact-once edits in 5 files: `open-brain/src/pipelines/sync/open-task-commits.ts` (1),
  `open-brain/src/pipelines/session-start/briefing.ts` (4), `open-brain/src/pipelines/session-start/start-report.ts`
  (2), `open-brain/src/pipelines/session-start/greeting-flags.ts` (1, the key list comment),
  `.agents/SYSTEM/greeting.json` (1, `"maybe_shipped": true`).

## Measured before dispatch

QA PC SIM `sim-t316-s2` (job #32) at `4369ccf8`. sha256 prefixes: tests `f1dcecb2ec414451`, edits `a64c0ab39888998a`,
m1 `3526f58768cda0ab`, m2 `5b6aa584d6606748`, m3 `61e6ffe2367b008a`, test file `375a1a6234f4a914`.
- Baseline (tests.txt + the new file, no fix): `APPLIED 5 edits to 2 files`; the three files `3 failed (3)` files,
  `9 failed | 67 passed (76)`: the server.test T-316 S2 row, briefing-budget's every-flag worst case, t316-s2 R1-R7.
- edits.txt: `APPLIED 9 edits to 5 files`. Both tsc runs and the build exit 0.
- The three files after the fix: `76 passed (76)`; `T302-WORST lines=31 chars=4396`.
- Step 4's run: `178 passed (178)` files, `2054 passed (2054)` tests, no Errors line, no T-292 timeout.
- On SIA's own record: `"MAYBE SHIPPED (10): T-046 T-170 T-194 T-235 +6 more, see /sync"` in 275 ms. `open-brain sync`:
  `open-task-commits [warn]: 10 open task(s) named by a code commit ... across HEAD and origin/master`;
  `module-boundary [pass]`.
- m1 (the budgeted pick-up does not pay for the note): t316-s2 R7 and briefing-budget's every-flag worst case red.
  m2 (ob_start never passes the note): the server.test T-316 S2 row red. m3 (the cap forgets the tail): t316-s2 R4 red.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/pipelines/sync/open-task-commits.test.ts` (T256 rows) and `t316-s1.test.ts` | stay green | `checkOpenTaskCommits` keeps its signature and every message; the match moved into `scanOpenTaskCommits`. Green in the SIM. |
| `briefing-budget.test.ts` every-flag worst case | changed by `tests.txt` | It now also carries the longest note. |
| every other budget, merged-citations, missing-handoff and a2a-byte-identical row | stay green | With `maybeShipped` absent the pick-up room and the lines are what they were. Green in the SIM. |
| everything else in step 4's run | stays green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED T316-S2 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the three files below, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red row in the three files after step 4 is never an exception.

## Steps

"The three files" means, from `open-brain`:
`npx vitest run tests/pipelines/sync/t316-s2.test.ts tests/pipelines/session-start/briefing-budget.test.ts tests/server.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t316-s2-maybe-shipped`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, and anything under `docs/`.
3. **Commit 1** (`T316-S2: rows for the MAYBE SHIPPED briefing note`).
   - `node docs/loops/t316-s2/apply.cjs . docs/loops/t316-s2/tests.txt` prints exactly `APPLIED 5 edits to 2 files`.
   - `Copy-Item docs/loops/t316-s2/t316-s2.test.ts open-brain/tests/pipelines/sync/t316-s2.test.ts`.
   - Run the three files. Expect `9 failed | 67 passed (76)`. Paste the summary and the `x` rows.
4. **Commit 2** (`T316-S2: MAYBE SHIPPED in the /start briefing, opt-in (T-316)`).
   - `node docs/loops/t316-s2/apply.cjs . docs/loops/t316-s2/edits.txt` prints exactly `APPLIED 9 edits to 5 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - Run the three files: `76 passed (76)`. Paste the summary and the `T302-WORST` console line.
   - `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/end-fix --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground or a timeout of at least 40 minutes). Expect 0 failed, 178 files, 2054 tests. Paste
     the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "open-task-commits|module-boundary"`.
     Paste both lines; module-boundary must say `[pass]`.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1, m2, m3: `node docs/loops/t316-s2/apply.cjs . docs/loops/t316-s2/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the three files; paste the `Tests` line and the `x` rows (expected: m1 ->
   t316-s2 R7 and briefing-budget's every-flag worst case; m2 -> the server.test `T-316 S2` row; m3 -> t316-s2 R4);
   restore with `git checkout -- open-brain/src` (this returns to commit 2) and check the status is empty. After m3,
   run the three files once more: `76 passed (76)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 8 paths: `M` for the 5 edited files and for
   `open-brain/tests/pipelines/session-start/briefing-budget.test.ts` and `open-brain/tests/server.test.ts`, and `A`
   for `open-brain/tests/pipelines/sync/t316-s2.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t316-s2-maybe-shipped` must equal
   HEAD. `gh pr create --base master --head feat/t316-s2-maybe-shipped --title "T316-S2: MAYBE SHIPPED in the /start briefing, opt-in (T-316)" --body "Brief: docs/loops/t316-s2-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T316-S2 <sha40> PR #<n>` or `BLOCKED T316-S2 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`, then each seat's `/mcp reconnect open-brain`. SIA's briefing then carries the note on the pick-up line.
Another project opts in by adding `"maybe_shipped": true` to its own `.agents/SYSTEM/greeting.json` (Makerspace first).
A task that rightly stays open after a partial commit keeps `stays open after <sha7>` in its note, as in /sync.
