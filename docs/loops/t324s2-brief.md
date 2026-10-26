# T324S2: the greeting outcome row from SessionEnd (T-324 S2)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 175. **Task:** T-324 S2 (P2). **Tag:** `t324s2`. **Size:** SMALL (1 new
module, 2 edits in 1 file, 1 new test file). **Base:** the START sha the launcher names (a master that contains this
brief and the T-324 S1 merge fd40ea11). **Authority:** Aaron at the planner's desk, 2026-10-26: "file items 1-6 as a
dashboard task for Prism"; Prism filed agent-dashboard T-054 and agreed the outcome-row shape (recorded on T-324).
Prism confirmed `session` = the greeting row's session number (A2A 10-26).

```text
IMPACT-TARGETS: none (a new core module; cli-session-end.ts gains one import and one guarded block, no symbol changes)
```

## Why

The dashboard scorecard (T-054) needs to know what a session did after its greeting. SessionEnd appends one row to the
same `greeting-metrics.jsonl`, append-only (the greeting row is never edited):
`{schema:2, kind:"outcome", id, ts, greeting_id, session, first_action:{t,tool,ids}|null, first_action_match, ended}`.
- **Greeting row:** the EARLIEST schema-1 row whose `checkout` is the project dir's basename and whose `ts` is at or
  after the transcript's first timestamp. None (metrics off, or no /start) means no outcome row.
- **first_action:** the first main-thread assistant `tool_use` strictly after the greeting row's `ts`, skipping
  `ToolSearch`, `TodoWrite`, `*ob_set_session` and `*ob_start`; `ids` are the T-, V- and #ids in its input,
  de-duplicated, at most 10; null when there is no such call.
- **first_action_match:** true if an id is in the greeting's `pick_up_ids`; false if none is, or the action has no ids;
  null when `pick_up_ids` is `[]` or absent, or `first_action` is null.
- **ended:** the ob_end stamp names THIS session's id. **session:** the greeting row's session number, copied.

## The change, exactly

Files under `docs/loops/t324s2/`.
- **`greeting-outcome.ts`:** copied verbatim, as a new file, to
  `open-brain/src/pipelines/session-start/greeting-outcome.ts`.
- **`t324-s2-greeting-outcome.test.ts`:** copied verbatim, as a new file, to
  `open-brain/tests/pipelines/session-start/t324-s2-greeting-outcome.test.ts`. O1-O6 on the module; W1-W2 spawn the
  SessionEnd hook through tsx.
- **`edits.txt`:** 2 edits in `open-brain/src/cli-session-end.ts` (the import, and the guarded block after the
  skills-audit check).

## Measured before dispatch

QA PC SIM `sim-t324s2` (job #143) at `477d207f`: **ALL PASS**.
- Baseline 1 (test only): `1 failed | 4 passed (5)` files, `33 passed (33)` tests; the new file fails to load:
  `Cannot find module '../../../src/pipelines/session-start/greeting-outcome.js'`.
- Baseline 2 (module, not wired): `2 failed | 39 passed (41)`; red W1, W2 only.
- Apply: `APPLIED 2 edits to 1 files`; both tsc and `npm run build` exit 0; five files `41 passed (41)`.
- Wide run: `1 failed | 2126 passed (2127)`, 191 files; the one red row was `tests/end-fix-q3.test.ts` (beforeEach hook
  timed out in 10000ms, 18 s on the shared machine), green alone 3/3. It does not touch the new module.
- `retirements [pass]`, `module-boundary [pass]` (162 files, 129 core, 4 dynamic memory loads).
- m1 -> O1; m2 -> O3; m3 -> O4, O6; m4 -> W2.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/t262-part2.test.ts` (SessionEnd H-1..H-6) | stays green | Asserts only its own skills-audit lines. Green in the SIM. |
| `tests/end-fix-q6.test.ts`, `tests/end-fix-q12.test.ts` | stay green | `toContain` on WORK AFTER lines; the new block prints its own line. Green in the SIM. |
| `t298-greeting-truth.test.ts` G8 | stays green | Greeting rows are unchanged. Green in the SIM. |
| `tests/harness/s4-guards.test.ts` D1b | green after commit 1 | The new test file is tracked once committed. |
| `tests/end-fix-q3.test.ts`, `hub-presence.test.ts`, `state-import-r4.test.ts` | known flaky under load | Hook/row timeouts on the shared QA PC (SIMs #134, #143), green alone. See the exception rule. |

Any other red existing row means STOP and report `BLOCKED t324s2 <test name>`. Exceptions, from T-292 load on the
shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in
files other than the five files, with that error or a timeout: re-run each such file alone up to 3 times; green on any
run alone means paste every run and go on, red on all 3 means STOP.

## Steps

"The five files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/t324-s2-greeting-outcome.test.ts tests/t262-part2.test.ts tests/end-fix-q6.test.ts tests/end-fix-q12.test.ts tests/pipelines/session-start/t298-greeting-truth.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t324s2-greeting-outcome`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`, then `node -e "require('better-sqlite3')"` (on "Could not locate
   the bindings file" run `npm rebuild better-sqlite3` and say so). Run every `apply.cjs` from the CLONE ROOT.
   Forbidden: stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by
   name, the real `~/.claude/`, any MCP config, and anything under `docs/`.
3. **Commit 1** (`T324S2: rows for the greeting outcome row`).
   - `Copy-Item docs/loops/t324s2/t324-s2-greeting-outcome.test.ts open-brain/tests/pipelines/session-start/t324-s2-greeting-outcome.test.ts`.
   - Run the five files. Expect `1 failed | 4 passed (5)` files and `33 passed (33)` tests, the new file failing to
     LOAD (cannot resolve `greeting-outcome.js`). Paste the summary and the load error. Commit the test file.
4. **Commit 2** (`T324S2: the greeting outcome row from SessionEnd (T-324 S2)`).
   - `Copy-Item docs/loops/t324s2/greeting-outcome.ts open-brain/src/pipelines/session-start/greeting-outcome.ts`.
   - From the clone root: `node docs/loops/t324s2/apply.cjs . docs/loops/t324s2/edits.txt` prints exactly
     `APPLIED 2 edits to 1 files`.
   - In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build` (each exit 0).
   - Run the five files: `41 passed (41)`.
   - `npx vitest run tests/pipelines tests/shared tests/end-fix tests/t262-part2.test.ts tests/t003-session-proof.test.ts tests/t276-session-trailer.test.ts tests/t294-small-fixes.test.ts tests/t048-r2b.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait).
     Expect 0 failed, subject to the exception rule. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary","retirements"`;
     both must show `[pass]`.
   - Commit `greeting-outcome.ts` and `cli-session-end.ts`.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m4: `node docs/loops/t324s2/apply.cjs . docs/loops/t324s2/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run
   `npx vitest run tests/pipelines/session-start/t324-s2-greeting-outcome.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and the `x` rows (expected: m1 -> O1; m2 -> O3; m3 -> O4, O6; m4 -> W2); restore with
   `git checkout -- open-brain/src` and check the status is empty. After m4, run the five files once more:
   `41 passed (41)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 3 paths:
   `M open-brain/src/cli-session-end.ts`,
   `A open-brain/src/pipelines/session-start/greeting-outcome.ts`,
   `A open-brain/tests/pipelines/session-start/t324-s2-greeting-outcome.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t324s2-greeting-outcome` must
   equal HEAD. `gh pr create --base master --head feat/t324s2-greeting-outcome --title "T324S2: the greeting outcome row from SessionEnd (T-324 S2)" --body "Brief: docs/loops/t324s2-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t324s2 <sha40> PR #<n>` or `BLOCKED t324s2 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

sia-rebuild on the main checkout. Live check: the next SessionEnd after a /start on the rebuilt build appends a
`schema:2, kind:"outcome"` row to `~/.claude/open-brain/greeting-metrics.jsonl` whose `greeting_id` names that session's
greeting row; tell Prism (dashboard T-054) the outcome rows are live. Then T-324 S3 (trigger counts on the outcome row).
