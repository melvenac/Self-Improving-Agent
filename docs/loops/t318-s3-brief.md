# T318-S3: `metrics review` lists sessions that greeted and never ran ob_end (T-318)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-318 S3 (P1). **Tag:** `t318s3`. **Size:** SMALL (3 edits
in 2 src files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief).

```text
IMPACT-TARGETS: reviewEndMetrics renderEndReview
```

## Why

T-318 S1 lists greetings that tripped a threshold (REVIEW QUEUE), S2 lists ob_end calls that need a look (END QUEUE).
S3 adds the third class: a session that greeted and never ran ob_end, so a skipped /end is listed instead of being found
by reading transcripts. `metrics-review.ts` gains `reviewNoEnd` and `renderNoEnd`; `cli.ts` prints a `NO END:` block
after the END QUEUE. Only greetings through ob_start (caller `mcp`) with a session number count; a greeting matches an
end row by checkout and session; counting starts at the first end row; each checkout's newest greeting is left out;
repeated greetings of one session count once; no end rows at all prints `NO END: not checked (...)`. Read-only.

## The change, exactly

Files under `docs/loops/t318-s3/`.
- **`t318-s3.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/pipelines/t318-s3.test.ts`. N1-N7.
- **`edits.txt`:** 3 edits in 2 files: `open-brain/src/pipelines/session-start/metrics-review.ts` (the two functions and
  their row reader) and `open-brain/src/cli.ts` (import them; print the block).

## Measured before dispatch

QA PC SIM `sim-t318s3` (job #106) at `88d354eb`: ALL PASS. Between `88d354eb` and this brief's base the only file under
`open-brain/` that changed is `tests/t308-lookup-only.test.ts` (T-308, unrelated). sha256 prefixes: test file `818aab3b247ba8c0`, edits `5bff0f9e79ec45d4`, m1 `62d8421564599e8f`, m2
`1ed6acf566c36d38`, m3 `6ce8a4e675031509`, m4 `d02da545786da534`.
- Baseline (the new test file, no source): `1 failed | 3 passed (4)` files, `7 failed | 93 passed (100)` tests; the red
  rows are N1-N7.
- Edit: `APPLIED 3 edits to 2 files`; both tsc runs and the build exit 0; the four files `100 passed (100)`.
- Step 4's wide run: `3 failed | 1018 passed (1021)` with T-292's `Timeout calling "onTaskUpdate"` error; the three red
  rows were hook timeouts in `session-log.test.ts` (2) and `index.test.ts` (1), each file green alone (9/9, 8/8).
  `module-boundary [pass]`; `metrics review` exit 0 with one `NO END:` line.
- m1 (the newest greeting counted) N1-N5 and N7; m2 (no first-end-row floor) N1 and N3; m3 (CLI starts counted) N4; m4
  (no NO END block printed) N7.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t318-s1.test.ts`, `t318-s2.test.ts` | stay green | The REVIEW and END queues are unchanged; the NO END block prints after them. Green in the SIM. |
| `tests/shared/cli-args.test.ts` | stays green | No new command or flag. Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t318s3 <test name>`. Exceptions, from T-292 load on the
shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in
files other than the four files below, with that error or a hook timeout: re-run each such file alone; green alone
means paste both runs and go on, red alone means STOP. A red row in the four files after step 4 is never an exception.

## Steps

"The four files" means, from `open-brain`:
`npx vitest run tests/pipelines/t318-s3.test.ts tests/pipelines/t318-s1.test.ts tests/t318-s2.test.ts tests/shared/cli-args.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t318-s3-no-end`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, any MCP config, and anything under `docs/`.
3. **Commit 1** (`T318-S3: rows for sessions that greeted and never ran ob_end`).
   - `Copy-Item docs/loops/t318-s3/t318-s3.test.ts open-brain/tests/pipelines/t318-s3.test.ts`.
   - Run the four files. Expect `1 failed | 3 passed (4)` files and `7 failed | 93 passed (100)` tests, the red rows
     N1-N7 in t318-s3.test.ts. Paste the summary and each `x` row.
4. **Commit 2** (`T318-S3: metrics review lists sessions that greeted and never ran ob_end (T-318)`).
   - `node docs/loops/t318-s3/apply.cjs . docs/loops/t318-s3/edits.txt` prints exactly `APPLIED 3 edits to 2 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - Run the four files: `100 passed (100)`.
   - `npx vitest run tests/pipelines/session-start tests/pipelines/t318-s1.test.ts tests/pipelines/t318-s3.test.ts tests/t318-s2.test.ts tests/shared tests/server.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground with a tool timeout of at least 40 minutes, never the 10-minute
     default). Expect 0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`).
     Paste it.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m4: `node docs/loops/t318-s3/apply.cjs . docs/loops/t318-s3/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the four files; paste the `Tests` line and the `x` rows (expected: m1 -> N1,
   N2, N3, N4, N5 and N7; m2 -> N1 and N3; m3 -> N4 only; m4 -> N7 only); restore with `git checkout -- open-brain/src`
   (this returns to commit 2) and check the status is empty. After m4, run the four files once more: `100 passed (100)`.
   Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 3 paths: `M open-brain/src/cli.ts`,
   `M open-brain/src/pipelines/session-start/metrics-review.ts`, `A open-brain/tests/pipelines/t318-s3.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t318-s3-no-end` must equal HEAD.
   `gh pr create --base master --head feat/t318-s3-no-end --title "T318-S3: metrics review lists sessions that greeted and never ran ob_end (T-318)" --body "Brief: docs/loops/t318-s3-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t318s3 <sha40> PR #<n>` or `BLOCKED t318s3 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`. Live check: `node open-brain/build/cli.js metrics review --since 2026-10-22` on the desktop prints a
`NO END:` line after the END QUEUE.
