# T324S1: pick_up_ids and open_questions on the greeting-metrics row (T-324 S1)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 175. **Task:** T-324 S1 (P2). **Tag:** `t324s1`. **Size:** SMALL (6 edits
in 2 files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief).
**Authority:** Aaron at the planner's desk, 2026-10-26: "file items 1-6 as a dashboard task for Prism"; Prism filed
agent-dashboard T-054 and asked for these two fields (shape agreed in the A2A exchange; recorded on T-324).

```text
IMPACT-TARGETS: none (greeting-metrics.ts gains two row keys; no exported symbol changes signature)
```

## Why

The dashboard's greeting scorecard cannot score whether a session's first action matched what the greeting pointed at,
or whether "waiting on Aaron" is still true, because the greeting-metrics row carries neither. S1 adds two keys to the
row, which stays `schema: 1` (the live dashboard drops any other schema; extra keys are ignored by today's reader):
- `pick_up_ids`: T-, V- and #ids in the reader's own handoff `pick_up`, then in the objective, de-duplicated in that
  order, at most 10; `[]` without a record.
- `open_questions`: the count of unresolved questions owned by `aaron` (case-insensitive) across
  `newestHandoffPerInstance(state.handoffs)`; `null` without a record.

## The change, exactly

Files under `docs/loops/t324s1/`.
- **`t324-s1-greeting-fields.test.ts`:** copied verbatim, as a new file, to
  `open-brain/tests/pipelines/session-start/t324-s1-greeting-fields.test.ts`. F1-F5.
- **`edits.txt`:** 6 edits in 2 files: `open-brain/src/pipelines/session-start/greeting-metrics.ts` (imports,
  `PICK_UP_IDS_CAP`, the two interface fields, their computation, the two row keys after `alarm_streaks`) and
  `open-brain/tests/pipelines/session-start/t298-greeting-truth.test.ts` (G8's pinned key order gains the two keys).

## Measured before dispatch

QA PC SIM `sim-t324s1-2` (job #134) at `c63e9fd8`: every prediction held except the wide run (step f), ruled timing
flake on the shared QA PC, not the edit:
- Baseline (five files, new test only): `1 failed | 4 passed (5)` files, `5 failed | 27 passed (32)`; red F1-F5, G8 green.
- Apply: `APPLIED 6 edits to 2 files`; both tsc and `npm run build` exit 0; five files `32 passed (32)`.
- m1 -> F1, F5; m2 -> F3; m3 -> F3; m4 -> F2.
- `module-boundary [pass]`.
- Wide run `2 failed | 1749 passed`, with T-292's `Timeout calling onTaskUpdate`: `state-import-r4.test.ts` (60 s
  row) and `hub-presence.test.ts` (15 s row). Alone: state-import-r4 22/22 green; hub-presence was red on a different
  110 s row the first time, then 43/43 green twice. Neither file imports greeting-metrics; the edit is a pure in-memory
  computation.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t298-greeting-truth.test.ts` G8 (pinned row key order) | edited in commit 2 | Gains `pick_up_ids`, `open_questions` at the end. Green in the SIM. |
| `t298-s2-handoff-stamp.test.ts`, `t318-s1.test.ts`, `t314-start-read-only.test.ts` | stay green | Row keys are additive. Green in the SIM. |
| `hub-presence.test.ts`, `state-import-r4.test.ts` | flaky under load | See the exception rule below. |

Any other red existing row means STOP and report `BLOCKED t324s1 <test name>`. Exceptions, from T-292 load on the
shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in
files other than the five files, with that error or a timeout: re-run each such file alone up to 3 times; green on any
run alone means paste every run and go on, red on all 3 means STOP.

## Steps

"The five files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/t324-s1-greeting-fields.test.ts tests/pipelines/session-start/t298-greeting-truth.test.ts tests/pipelines/session-start/t298-s2-handoff-stamp.test.ts tests/pipelines/t318-s1.test.ts tests/t314-start-read-only.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t324s1-greeting-fields`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, any MCP config, and anything under `docs/`.
3. **Commit 1** (`T324S1: rows for pick_up_ids and open_questions`).
   - `Copy-Item docs/loops/t324s1/t324-s1-greeting-fields.test.ts open-brain/tests/pipelines/session-start/t324-s1-greeting-fields.test.ts`.
   - Run the five files. Expect `1 failed | 4 passed (5)` files and `5 failed | 27 passed (32)` tests, red F1-F5 only.
     Paste the summary and each `x` row. Commit the test file.
4. **Commit 2** (`T324S1: pick_up_ids and open_questions on the greeting-metrics row (T-324 S1)`).
   - From the clone root: `node docs/loops/t324s1/apply.cjs . docs/loops/t324s1/edits.txt` prints exactly
     `APPLIED 6 edits to 2 files`.
   - In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build` (each exit 0).
   - Run the five files: `32 passed (32)`.
   - `npx vitest run tests/pipelines tests/server.test.ts tests/t154-cli-start.test.ts tests/t314-start-read-only.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait).
     Expect 0 failed, subject to the exception rule. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"`; must
     show `[pass]`.
   - Commit the two edited files.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m4: `node docs/loops/t324s1/apply.cjs . docs/loops/t324s1/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run
   `npx vitest run tests/pipelines/session-start/t324-s1-greeting-fields.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and the `x` rows (expected: m1 -> F1, F5; m2 -> F3; m3 -> F3; m4 -> F2); restore with
   `git checkout -- open-brain/src` and check the status is empty. After m4, run the five files once more:
   `32 passed (32)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 3 paths:
   `M open-brain/src/pipelines/session-start/greeting-metrics.ts`,
   `M open-brain/tests/pipelines/session-start/t298-greeting-truth.test.ts`,
   `A open-brain/tests/pipelines/session-start/t324-s1-greeting-fields.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t324s1-greeting-fields` must
   equal HEAD. `gh pr create --base master --head feat/t324s1-greeting-fields --title "T324S1: pick_up_ids and open_questions on the greeting-metrics row (T-324 S1)" --body "Brief: docs/loops/t324s1-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t324s1 <sha40> PR #<n>` or `BLOCKED t324s1 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

sia-rebuild on the main checkout. Live check: the next `/start` in any seat appends a greeting-metrics row carrying
`pick_up_ids` and `open_questions`; tell Prism (dashboard T-054) the fields are live.
