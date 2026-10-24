# T309: the budgeted NEXT says when the objective names a done task (T-309)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-309 (P3). **Tag:** `t309`. **Size:** SMALL (2 edits in 1
src file, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief).

```text
IMPACT-TARGETS: renderBriefing
```

## Why

The budgeted briefing's NEXT lists exactly the ids the objective names. A done task printed `- [done] T-169 <title>`
and nothing said the objective was stale (Maker's s70 greeting led with a done task while six active P1s were hidden).
With this change the done row keeps its `[done]` mark, its title is cut to 36 characters and the row ends with
`(objective names a done task: update it with set_objective)` (exported as `STALE_OBJECTIVE`). No line is added, and the
row is no longer than an open task's row with the same long title.

## The change, exactly

Files under `docs/loops/t309/`.
- **`t309-done-objective.test.ts`:** copied verbatim, as a new file, to
  `open-brain/tests/pipelines/session-start/t309-done-objective.test.ts`. A fixture row and D1-D4.
- **`edits.txt`:** 2 edits in `open-brain/src/pipelines/session-start/briefing.ts` (the NEXT row in `renderBudgeted`, and
  the `STALE_OBJECTIVE` constant after `MORE_TASKS`).

## Measured before dispatch

QA PC SIM `sim-t309` (job #100) at `1ff73934`: every step matched except m3's prediction, which was incomplete (m3 also
reds `briefing-budget.test.ts` "an objective that names ids lists exactly those, in the order named and once each",
which pins the exact NEXT rows; ruled expected). No file under `open-brain/` changed between `1ff73934` and this
brief's base. sha256 prefixes: test file `7405453ceba6a6f0`, edits `a72e26c01011ce2a`, m1 `4936e0b2667d5ce2`, m2
`b89e7f491fe163a7`, m3 `50765174abfa553d`.
- Baseline (the new test file, no source): `1 failed | 2 passed (3)` files, `3 failed | 83 passed (86)` tests; the red
  rows are D1, D3 and D4.
- Edit: `APPLIED 2 edits to 1 files`; both tsc runs and the build exit 0; the three files `86 passed (86)`.
- Step 4's wide run: `152 passed (152)` files, `1733 passed (1733)` tests, `Errors 1 error` = T-292's
  `[vitest-worker]: Timeout calling "onTaskUpdate"` with no red row. `module-boundary [pass]`.
- m1 (no note) D1 and D3; m2 (100-char title) D3 only; m3 (note on open rows too) D2 and the briefing-budget (d) row
  above.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `briefing-budget.test.ts` "a done task is marked done" | stays green | It matches `^- \[done\] <id> `, which the new row keeps. Green in the SIM. |
| `briefing-budget.test.ts` worst-case budget rows | stay green | Their objective names T-1..T-8, none in the fixture record, so no done row is printed. Green in the SIM. |
| `briefing.test.ts`, the rest of `tests/pipelines` | stay green | The OFF layout is untouched. Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t309 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the three files below, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red row in the three files after step 4 is never an exception.

## Steps

"The three files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/t309-done-objective.test.ts tests/pipelines/session-start/briefing-budget.test.ts tests/pipelines/session-start/briefing.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t309-done-objective`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, any MCP config, and anything under `docs/`.
3. **Commit 1** (`T309: rows for a done task named by the objective`).
   - `Copy-Item docs/loops/t309/t309-done-objective.test.ts open-brain/tests/pipelines/session-start/t309-done-objective.test.ts`.
   - Run the three files. Expect `1 failed | 2 passed (3)` files and `3 failed | 83 passed (86)` tests, the red rows
     D1, D3 and D4 in t309-done-objective.test.ts. Paste the summary and each `x` row.
4. **Commit 2** (`T309: the budgeted NEXT says when the objective names a done task (T-309)`).
   - `node docs/loops/t309/apply.cjs . docs/loops/t309/edits.txt` prints exactly `APPLIED 2 edits to 1 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - Run the three files: `86 passed (86)`.
   - `npx vitest run tests/pipelines tests/t154-cli-start.test.ts tests/s173h.test.ts tests/active-session.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground with a tool timeout of at least 40 minutes, never the 10-minute
     default). Expect 0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`).
     Paste it.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m3: `node docs/loops/t309/apply.cjs . docs/loops/t309/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the three files; paste the `Tests` line and the `x` rows (expected: m1 ->
   D1 and D3; m2 -> D3 only; m3 -> D2 and briefing-budget's "an objective that names ids lists exactly those" row);
   restore with `git checkout -- open-brain/src` (this returns to commit 2) and check the status is empty. After m3,
   run the three files once more: `86 passed (86)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 2 paths:
   `M open-brain/src/pipelines/session-start/briefing.ts`,
   `A open-brain/tests/pipelines/session-start/t309-done-objective.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t309-done-objective` must equal
   HEAD. `gh pr create --base master --head feat/t309-done-objective --title "T309: the budgeted NEXT says when the objective names a done task (T-309)" --body "Brief: docs/loops/t309-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t309 <sha40> PR #<n>` or `BLOCKED t309 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`. Live check: a repo with `briefing_budget` on whose objective names a done task shows the note on that
NEXT row.
