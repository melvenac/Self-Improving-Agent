# T327: objective_stale greeting alarm (T-327)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-27, session 175. **Task:** T-327 (P3). **Tag:** `t327`. **Size:** SMALL (2 edits in
1 file, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief).
**Authority:** Prism (agent-dashboard planner) asked for the seats' /start flags on the dashboard (A2A 10-27); Atlas
ruled that the deterministic source is the greeting row's `alarm_streaks`, and that "objective names a done task" is
the one SIA-side flag it lacks. Merge under D-163 (Atlas's QA ACCEPT; not an excluded class).

```text
IMPACT-TARGETS: none (greeting-metrics.ts gains one alarm id and its pattern; no exported signature changes)
```

## Why

Since T-309 the budgeted briefing marks a NEXT row whose task is done and named by the objective:
`- [done] <id> <title> (objective names a done task: update it with set_objective)` (briefing.ts `STALE_OBJECTIVE`).
Nothing records it, so Prism's scorecard cannot show a stale objective or how long it has stood. T-327 adds an
eleventh alarm id, `objective_stale`, appended LAST to `ALARM_IDS` (the ten existing ids keep their order), with a
pattern anchored on the render's row shape:

`/^- \[done\] \S+ .*\(objective names a done task: update it with set_objective\)$/m`

so the note quoted in prose (a WATCH OUT line, a pick-up sentence) does not raise it. The streak logic is the existing
one. The row stays `schema: 1`; `alarm_streaks` is an object, so G8's pinned key ORDER is unchanged.

## The change, exactly

Files under `docs/loops/t327/`.
- **`t327-objective-stale.test.ts`:** copied verbatim, as a new file, to
  `open-brain/tests/pipelines/session-start/t327-objective-stale.test.ts`. A1-A5 plus a fixture row.
- **`edits.txt`:** 2 edits in 1 file: `open-brain/src/pipelines/session-start/greeting-metrics.ts` (`ALARM_IDS` gains
  the id at the end; `ALARM_PATTERNS` gains its regex after `latest_brief_undetermined`, with a one-line comment).

## Measured before dispatch

QA PC SIM `sim-t327` (job #240) at `d43530a5`: ALL PASS. The anchors still apply on master `74a29c32` (greeting-metrics.ts
unchanged since d43530a5): `APPLIED 2 edits to 1 files`.
- Baseline (six files, new test only): `1 failed | 5 passed (6)` files, `3 failed | 35 passed (38)`; red A1, A4, A5
  only (A1/A4: `objective_stale` undefined; A5: ALARM_IDS has 10).
- Apply: `APPLIED 2 edits to 1 files`; both tsc and `npm run build` exit 0; six files `38 passed (38)`.
- Wide run: `160 passed (160)` files, `1775 passed (1775)` tests, 0 red rows; one T-292 `Timeout calling onTaskUpdate`
  error with every test green.
- `retirements [pass]`, `module-boundary [pass]`.
- m1 (unanchored) -> A3; m2 (no multiline flag) -> A1, A4; m3 (id first) -> A5. Each mutant's tsc exits 0.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t298-greeting-truth.test.ts` G8 (key order; `alarm_streaks` toEqual on REPORT) | stays green | No key added to the row; REPORT carries no `- [done]` row. Green in the SIM. |
| `t298-s2-handoff-stamp.test.ts` | stays green | Its reports carry no `- [done]` row. Green in the SIM. |
| `t309-done-objective.test.ts` | stays green | briefing.ts is not edited. Green in the SIM. |
| `t324-s1-greeting-fields.test.ts` | stays green | Its report is a 3-line stub. Green in the SIM. |
| `tests/pipelines/t318-s1.test.ts` | stays green | Reads alarm_streaks generically; no id list pinned. Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t327 <test name>`. Exceptions, from T-292 load on the
shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in
files other than the six files, with that error or a timeout: re-run each such file alone up to 3 times; green on any
run alone means paste every run and go on, red on all 3 means STOP. Known flaky under load: hub-presence,
state-import-r4, end-fix-q3.

## Steps

"The six files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/t327-objective-stale.test.ts tests/pipelines/session-start/t298-greeting-truth.test.ts tests/pipelines/session-start/t298-s2-handoff-stamp.test.ts tests/pipelines/session-start/t309-done-objective.test.ts tests/pipelines/session-start/t324-s1-greeting-fields.test.ts tests/pipelines/t318-s1.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t327-objective-stale`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, any MCP config, and anything under `docs/`.
3. **Commit 1** (`T327: rows for the objective_stale alarm`).
   - `Copy-Item docs/loops/t327/t327-objective-stale.test.ts open-brain/tests/pipelines/session-start/t327-objective-stale.test.ts`.
   - Run the six files. Expect `1 failed | 5 passed (6)` files and `3 failed | 35 passed (38)` tests, red A1, A4, A5
     only. Paste the summary and each `x` row. Commit the test file.
4. **Commit 2** (`T327: objective_stale greeting alarm (T-327)`).
   - From the clone root: `node docs/loops/t327/apply.cjs . docs/loops/t327/edits.txt` prints exactly
     `APPLIED 2 edits to 1 files`.
   - In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build` (each exit 0).
   - Run the six files: `38 passed (38)`.
   - `npx vitest run tests/pipelines tests/server.test.ts tests/t154-cli-start.test.ts tests/t314-start-read-only.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait).
     Expect 0 failed, subject to the exception rule. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`;
     both must show `[pass]`.
   - Commit `open-brain/src/pipelines/session-start/greeting-metrics.ts`.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m3: `node docs/loops/t327/apply.cjs . docs/loops/t327/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; `npx tsc --noEmit` in `open-brain` exits 0; run
   `npx vitest run tests/pipelines/session-start/t327-objective-stale.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and the `x` rows (expected: m1 -> A3; m2 -> A1, A4; m3 -> A5); restore with
   `git checkout -- open-brain/src` and check the status is empty. After m3, run the six files once more:
   `38 passed (38)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 2 paths:
   `M open-brain/src/pipelines/session-start/greeting-metrics.ts`,
   `A open-brain/tests/pipelines/session-start/t327-objective-stale.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t327-objective-stale` must
   equal HEAD. `gh pr create --base master --head feat/t327-objective-stale --title "T327: objective_stale greeting alarm (T-327)" --body "Brief: docs/loops/t327-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t327 <sha40> PR #<n>` or `BLOCKED t327 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

sia-rebuild on the main checkout. Live check: this seat's next /start row in ~/.claude/open-brain/greeting-metrics.jsonl
carries `alarm_streaks.objective_stale` (the SIA objective names done tasks T-298/T-299 today). Then send Prism the id
`objective_stale` for SC_ALARM_IDS.
