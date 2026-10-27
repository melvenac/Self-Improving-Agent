# T324S3: recall-trigger counts on the outcome row (T-324 S3)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 175. **Task:** T-324 S3 (P2). **Tag:** `t324s3`. **Size:** SMALL (9 edits
in 2 files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief and the
T-324 S2 merge 17100231). **Authority:** Aaron at the planner's desk, 2026-10-26: "file items 1-6 as a dashboard task
for Prism"; Prism asked for the trigger counts on the outcome row for T-054 item 3 ("the recall trigger per seat"),
shape agreed in the A2A exchange (recorded on T-324).

```text
IMPACT-TARGETS: buildGreetingOutcomeRow, recordGreetingOutcome (an optional 5th parameter / optional input fields; existing callers unchanged)
```

## Why

The dashboard scorecard (T-054 item 3) wants the recall trigger per seat, and `trigger_fires` lives in
`knowledge-v2.db`, which only the desktop has. The outcome row SessionEnd already writes gains two optional keys,
appended after `ended`, only when known:
- `session_uuid`: the session's uuid as the hook resolves it.
- `trigger: {asked, injected, seat_skip, path_match, error_match}`: this session's `trigger_fires` rows as counts, no
  query text. asked = state not `not-asked`; injected = state `injected`; `seat_skip`, `path_match`, `error_match` count
  rows whose query has the space-separated token `seat-skip:`, `path-match:` or `error-match:` (colon included), as
  `trigger/run.ts` writes them.
- **Not read is not zero.** No DB file, no `trigger_fires` table, an unreadable DB or no session uuid: `trigger` is
  OMITTED. A store read with no rows for the session is all zeros.

The boundary: `greeting-outcome.ts` (core) gets a pure `triggerCounts(rows)`; `cli-session-end.ts` (memory side) reads
the rows read-only (`fileMustExist`, never `openV2Database`) and passes the counts in. A row built without extras keeps
S2's exact keys.

## The change, exactly

Files under `docs/loops/t324s3/`.
- **`t324-s3-trigger-counts.test.ts`:** copied verbatim, as a new file, to
  `open-brain/tests/pipelines/session-start/t324-s3-trigger-counts.test.ts`. R1-R4 on the module; W3-W4 spawn the
  SessionEnd hook through tsx.
- **`edits.txt`:** 9 edits in 2 files: 6 in `open-brain/src/pipelines/session-start/greeting-outcome.ts`
  (`TriggerCounts` and `triggerCounts`, the two optional row fields and `OutcomeExtras`, `buildGreetingOutcomeRow`'s
  extra parameter, the two optional input fields, the call) and 3 in `open-brain/src/cli-session-end.ts` (the import,
  `readTriggerCounts`, the two input fields).

## Measured before dispatch

QA PC SIM `sim-t324s3` (job #187) at `044528c7`: **ALL PASS**.
- Baseline (test only): `1 failed | 4 passed (5)` files, `6 failed | 29 passed (35)` tests; red R1, R2
  (`triggerCounts is not a function`), R3 (keys with extras lack `session_uuid`/`trigger`), R4, W3, W4 (row has no
  `session_uuid`). No `Errors` line.
- Apply: `APPLIED 9 edits to 2 files`; both tsc and `npm run build` exit 0; five files `35 passed (35)`.
- Wide run: `193 passed (193)` files, `2141 passed (2141)` tests, 951 s; no `Errors` line, no re-runs.
- `module-boundary [pass]` (163 files, 129 core), `retirements [pass]`.
- m1 -> R1, W3; m2 -> W4; m3 -> W3; m4 -> R3; m5 -> R1.
- Planner check at d149450f: every edits.txt anchor still applies (`APPLIED 9 edits to 2 files`); neither file has
  changed since 044528c7.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t324-s2-greeting-outcome.test.ts` O5 (S2's key order) | stays green | Built without extras, so no new keys. Green in the SIM. |
| `t324-s2-greeting-outcome.test.ts` O6, W1, W2 | stay green | `toMatchObject` on the S2 fields; W1/W2 rows gain `session_uuid` only. Green in the SIM. |
| `tests/t262-part2.test.ts`, `tests/end-fix-q6.test.ts`, `tests/end-fix-q12.test.ts` | stay green | Their own lines only. Green in the SIM. |
| `tests/harness/s4-guards.test.ts` D1b | green after commit 1 | The new test file is tracked once committed. |
| `tests/end-fix-q3.test.ts`, `hub-presence.test.ts`, `state-import-r4.test.ts` | known flaky under load | Hook/row timeouts on the shared QA PC (SIMs #134, #143), green alone. See the exception rule. |

Any other red existing row means STOP and report `BLOCKED t324s3 <test name>`. Exceptions, from T-292 load on the
shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in
files other than the five files, with that error or a timeout: re-run each such file alone up to 3 times; green on any
run alone means paste every run and go on, red on all 3 means STOP.

## Steps

"The five files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/t324-s3-trigger-counts.test.ts tests/pipelines/session-start/t324-s2-greeting-outcome.test.ts tests/t262-part2.test.ts tests/end-fix-q6.test.ts tests/end-fix-q12.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t324s3-trigger-counts`. HEAD must equal START, the
   porcelain must be empty, and `git merge-base --is-ancestor 17100231 HEAD` must exit 0. In `open-brain`: `npm ci`,
   then `node -e "require('better-sqlite3')"` (on "Could not locate the bindings file" run
   `npm rebuild better-sqlite3` and say so). Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash, reset --hard,
   force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real `~/.claude/`,
   any MCP config, and anything under `docs/`.
3. **Commit 1** (`T324S3: rows for the trigger counts on the outcome row`).
   - `Copy-Item docs/loops/t324s3/t324-s3-trigger-counts.test.ts open-brain/tests/pipelines/session-start/t324-s3-trigger-counts.test.ts`.
   - Run the five files. Expect `1 failed | 4 passed (5)` files and `6 failed | 29 passed (35)` tests, red R1, R2, R3,
     R4, W3, W4 only. Paste the summary and each `x` row. Commit the test file.
4. **Commit 2** (`T324S3: recall-trigger counts on the outcome row (T-324 S3)`).
   - From the clone root: `node docs/loops/t324s3/apply.cjs . docs/loops/t324s3/edits.txt` prints exactly
     `APPLIED 9 edits to 2 files`.
   - In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build` (each exit 0).
   - Run the five files: `35 passed (35)`.
   - `npx vitest run tests/pipelines tests/shared tests/end-fix tests/t262-part2.test.ts tests/t003-session-proof.test.ts tests/t276-session-trailer.test.ts tests/t294-small-fixes.test.ts tests/t048-r2b.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait).
     Expect 0 failed, subject to the exception rule. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary","retirements"`;
     both must show `[pass]`.
   - Commit `greeting-outcome.ts` and `cli-session-end.ts`.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m5: `node docs/loops/t324s3/apply.cjs . docs/loops/t324s3/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run
   `npx vitest run tests/pipelines/session-start/t324-s3-trigger-counts.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and the `x` rows (expected: m1 -> R1, W3; m2 -> W4; m3 -> W3; m4 -> R3; m5 -> R1); restore
   with `git checkout -- open-brain/src` and check the status is empty. After m5, run the five files once more:
   `35 passed (35)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 3 paths:
   `M open-brain/src/cli-session-end.ts`,
   `M open-brain/src/pipelines/session-start/greeting-outcome.ts`,
   `A open-brain/tests/pipelines/session-start/t324-s3-trigger-counts.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t324s3-trigger-counts` must
   equal HEAD. `gh pr create --base master --head feat/t324s3-trigger-counts --title "T324S3: recall-trigger counts on the outcome row (T-324 S3)" --body "Brief: docs/loops/t324s3-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t324s3 <sha40> PR #<n>` or `BLOCKED t324s3 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

sia-rebuild on the main checkout. Live check: the next outcome row in `~/.claude/open-brain/greeting-metrics.jsonl`
from a desktop SessionEnd carries `session_uuid` and `trigger` (counts matching that session's `trigger_fires` rows);
tell Prism (dashboard T-054 item 3) the counts are live.
