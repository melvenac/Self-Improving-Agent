# T318-S2: ob_end writes an end-metrics row; `metrics review` prints an END QUEUE (T-318 slice 2)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-22, session 174. **Task:** T-318 (P1). **Tag:** `t318-s2`. **Size:** SMALL (1 new source
file, 8 edits in 3 files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this
brief).

```text
IMPACT-TARGETS: handleEnd greetingFlag reviewGreetingMetrics renderReview (new: end-metrics.ts with endMetricsPath, buildEndMetricsRow, recordEndMetrics; metrics-review.ts gains endReviewReason, reviewEndMetrics, renderEndReview; cli.ts `metrics review` prints the END QUEUE)
```

## Why

T-318 (b): the end half of the session scorecard as data. S1 (#924) lists the greetings that tripped a threshold. S2
makes ob_end append one row per call to `end-metrics.jsonl` beside the knowledge store, under the same opt-in as the
greeting row (greeting.json `greeting_metrics`; a dry run writes nothing). The row records what ob_end's record gate
(T-317's rule) decided: `closed`, `refused`, `record_ok` or `not_checked`. `metrics review` then lists the ends a
planner reads by hand: a record_ok close, a record not checked, a refusal the same session never closed.

## The change, exactly

Files under `docs/loops/t318-s2/`.
- **`t318-s2.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t318-s2.test.ts`. E1-E5.
- **`end-metrics.ts`:** copied verbatim, as a new file, to `open-brain/src/shared/end-metrics.ts`.
- **`edits.txt`:** 8 edits in 3 files: `open-brain/src/server.ts` (the import, the `endRow` helper and its 5 calls in
  handleEnd), `open-brain/src/pipelines/session-start/metrics-review.ts` (endReviewReason, reviewEndMetrics,
  renderEndReview), `open-brain/src/cli.ts` (the END QUEUE print and the usage-line text).

## Measured before dispatch

QA PC SIM `sim-t318-s2` (job #55) at `c0817dd8`: ALL PASS. sha256 prefixes: end-metrics.ts `3f4eb3fe72bf6f33`, edits
`bae3e7ea536117c9`, test file `8259c570b78e147c`, m1 `94aa5eb9aca45c43`, m2 `1b9eb3d4fa5d5c45`, m3 `25eb1a25690fea60`.
- Baseline (the new test file, no source): the three files `1 failed | 2 passed (3)` files, `88 passed (88)` tests; the
  only red file is t318-s2.test.ts, which fails to import (`Cannot find module '../src/shared/end-metrics.js'`).
- Source + edits: `APPLIED 8 edits to 3 files`; both tsc runs and the build exit 0; the three files `93 passed (93)`.
- Step 4's wide run: `203 passed (203)` files, `2293 passed (2293)` tests, no Errors line. `module-boundary [pass]`.
- `node open-brain/build/cli.js metrics review --since 2026-10-16` exit 0: a `REVIEW QUEUE: not checked (...)` line and
  an `END QUEUE: not checked (...)` line on the QA PC, which has neither metrics file.
- m1 (a refusal closed later still flags) E2, E3, E4 red; m2 (rows written without the opt-in) E5 red only; m3
  (handoff_rev from first_rev) E1, E4 red.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `cli-args.test.ts` `metrics review` rows | stay green | The flags are unchanged; only the usage text after them changes. Green in the SIM. |
| `t318-s1.test.ts` R5 (`metrics review` CLI) | stays green | It checks `toContain` on the REVIEW QUEUE lines; the END QUEUE lines follow them. Green in the SIM. |
| every ob_end test (end-fix-*, t317-*, t003-*, t048-r3, t276, server.test.ts, trigger/) | stays green | Rows are written only with the opt-in, into the scratch KNOWLEDGE_V2_DB directory; output gains a line only when an append fails. Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t318-s2 <test name>`. Exceptions, from T-292 load on the
shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in
files other than the three files below, with that error or a hook timeout: re-run each such file alone; green alone
means paste both runs and go on, red alone means STOP. A red row in the three files after step 4 is never an exception.

## Steps

"The three files" means, from `open-brain`:
`npx vitest run tests/t318-s2.test.ts tests/pipelines/t318-s1.test.ts tests/shared/cli-args.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t318-s2-end-metrics`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, and anything under `docs/`.
3. **Commit 1** (`T318-S2: rows for the ob_end end-metrics row and the END QUEUE`).
   - `Copy-Item docs/loops/t318-s2/t318-s2.test.ts open-brain/tests/t318-s2.test.ts`.
   - Run the three files. Expect `1 failed | 2 passed (3)` files and `88 passed (88)` tests, with t318-s2.test.ts
     failing to import. Paste the summary and the import error line.
4. **Commit 2** (`T318-S2: ob_end writes one end-metrics row per call; metrics review lists the ends to read (T-318)`).
   - `Copy-Item docs/loops/t318-s2/end-metrics.ts open-brain/src/shared/end-metrics.ts`.
   - `node docs/loops/t318-s2/apply.cjs . docs/loops/t318-s2/edits.txt` prints exactly `APPLIED 8 edits to 3 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - Run the three files: `93 passed (93)`.
   - `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/end-fix tests/t317-s1.test.ts tests/t317-s2.test.ts tests/t317-s3.test.ts tests/t003-r2.test.ts tests/t003-session-proof.test.ts tests/t048-r3.test.ts tests/t276-session-trailer.test.ts tests/t318-s2.test.ts tests/trigger --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground or a timeout of at least 40 minutes). Expect 0 failed. Paste the `Test Files`,
     `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js metrics review --since 2026-10-16` (exit 0, a line starting
     `REVIEW QUEUE:` and a line starting `END QUEUE:`) and
     `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`). Paste both.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1, m2, m3: `node docs/loops/t318-s2/apply.cjs . docs/loops/t318-s2/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the three files; paste the `Tests` line and the `x` rows (expected: m1 ->
   E2, E3, E4; m2 -> E5 only; m3 -> E1, E4); restore with `git checkout -- open-brain/src` (this returns to commit 2)
   and check the status is empty. After m3, run the three files once more: `93 passed (93)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 5 paths: `M open-brain/src/cli.ts`,
   `M open-brain/src/pipelines/session-start/metrics-review.ts`, `M open-brain/src/server.ts`,
   `A open-brain/src/shared/end-metrics.ts`, `A open-brain/tests/t318-s2.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t318-s2-end-metrics` must equal
   HEAD. `gh pr create --base master --head feat/t318-s2-end-metrics --title "T318-S2: ob_end end-metrics row and END QUEUE (T-318)" --body "Brief: docs/loops/t318-s2-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t318-s2 <sha40> PR #<n>` or `BLOCKED t318-s2 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`; `/mcp reconnect open-brain`; then the next ob_end in an opted-in repo leaves a row, and on the desktop
`node open-brain/build/cli.js metrics review --since <today>` prints an `END QUEUE:` line counting it. S3 candidates:
lessons stored with a MATCH command key, ratings where the entry fired after the command it recommends, sessions with a
greeting row and no ob_end row.
