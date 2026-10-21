# T318-S1: `open-brain metrics review`, review by exception (T-318 slice 1)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-21, session 174. **Task:** T-318 (P1). **Tag:** `t318-s1`. **Size:** SMALL (1 new source
file, 3 edits in 2 files, 2 test edits in 1 file, 1 new test file). **Base:** the START sha the launcher names (a master
that contains this brief).

```text
IMPACT-TARGETS: greetingMetricsPath parseOrRefuse (new: metrics-review.ts with reviewReasons, reviewGreetingMetrics, renderReview; COMMAND_SPECS gains metricsReview; cli.ts gains the `metrics review` branch and usage line)
```

## Why

T-318 (Aaron 10-20): automate the session scorecard and review by exception. Step 0 (Atlas, 10-21, recorded in T-318's
note) found every desktop planner /start since 10-16 leaves a greeting-metrics row, and the misses fall in classes the
rows already carry. S1 adds a read-only command that lists only the rows tripping a threshold: handoff lag > 5 revs,
STALE PROCESS, any alarm 2+ greetings running. Everything else is not reviewed by hand.

## The change, exactly

Files under `docs/loops/t318-s1/`.
- **`tests.txt`:** 2 edits in `open-brain/tests/shared/cli-args.test.ts`: the command list gains `metrics review`, and
  the usage-line table gains its row.
- **`t318-s1.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/pipelines/t318-s1.test.ts`. R1-R5.
- **`metrics-review.ts`:** copied verbatim, as a new file, to `open-brain/src/pipelines/session-start/metrics-review.ts`.
- **`edits.txt`:** 3 edits in 2 files: `open-brain/src/cli-spec.ts` (the `metricsReview` spec: `--since`, no
  positionals), `open-brain/src/cli.ts` (the `metrics review` branch and its usage line).

## Measured before dispatch

QA PC SIM `sim-t318-s1` (job #37) at `35f4e991`. sha256 prefixes: metrics-review.ts `2bf02075ca7b9a35`, edits
`611d3940a0c33d2a`, tests `20915c7c3d48de8d`, test file `2718a235bc8fae6d`, m1 `19cbffccedd4745e`, m2 `02b9f4ceba7307d8`,
m3 `e844731e6e2baffb`.
- Baseline (tests.txt + the new test file, no source): `APPLIED 2 edits to 1 files`; the two files `2 failed (2)` files,
  `4 failed | 78 passed (82)`. `t318-s1.test.ts` fails to import (`Cannot find module .../metrics-review.js`). The four
  red cli-args rows: `walks at least the fifteen commands (proves it looked)`, `names a usage line for every command it
  declares (proves it looked)`, `every flag documented for metrics review is declared`, `every flag metrics review
  declares is documented on its own usage line`. (The SIM reply said MISMATCH only because its criterion named rows
  "that name metrics review"; the first two are the command-count rows tests.txt extends. Ruled expected.)
- Source + edits: `APPLIED 3 edits to 2 files`; both tsc runs and the build exit 0; the two files `88 passed (88)`.
- Step 4's run: `178 passed (178)` files, `2054 passed (2054)` tests, no Errors line. `module-boundary [pass]`.
- `node open-brain/build/cli.js metrics review --since 2026-10-16` exit 0: `REVIEW QUEUE: not checked (no ...greeting-metrics.jsonl; ...)`
  on the QA PC, which has no metrics file.
- m1 (lag >=) R1 red; m2 (a first alarm flags) R2 red; m3 (no file is not 'not checked') R4 red.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `cli-args.test.ts` command-list and usage-line rows | changed by `tests.txt` | They enumerate every command. |
| every other `cli-args.test.ts` row | stays green | Each command's flags are unchanged. Green in the SIM. |
| everything else in step 4's run | stays green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t318-s1 <test name>`. Exceptions, from T-292 load on the
shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in
files other than the two files below, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red row in the two files after step 4 is never an exception.

## Steps

"The two files" means, from `open-brain`:
`npx vitest run tests/pipelines/t318-s1.test.ts tests/shared/cli-args.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t318-s1-metrics-review`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, and anything under `docs/`.
3. **Commit 1** (`T318-S1: rows for open-brain metrics review`).
   - `node docs/loops/t318-s1/apply.cjs . docs/loops/t318-s1/tests.txt` prints exactly `APPLIED 2 edits to 1 files`.
   - `Copy-Item docs/loops/t318-s1/t318-s1.test.ts open-brain/tests/pipelines/t318-s1.test.ts`.
   - Run the two files. Expect `4 failed | 78 passed (82)` and the import failure of t318-s1.test.ts. Paste the
     summary, the import error line and the four `x` rows.
4. **Commit 2** (`T318-S1: open-brain metrics review lists the greetings that tripped a threshold (T-318)`).
   - `Copy-Item docs/loops/t318-s1/metrics-review.ts open-brain/src/pipelines/session-start/metrics-review.ts`.
   - `node docs/loops/t318-s1/apply.cjs . docs/loops/t318-s1/edits.txt` prints exactly `APPLIED 3 edits to 2 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - Run the two files: `88 passed (88)`.
   - `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/end-fix --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground or a timeout of at least 40 minutes). Expect 0 failed. Paste the `Test Files`,
     `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js metrics review --since 2026-10-16` (exit 0, a line starting
     `REVIEW QUEUE:`) and `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`).
     Paste both.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1, m2, m3: `node docs/loops/t318-s1/apply.cjs . docs/loops/t318-s1/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the two files; paste the `Tests` line and the `x` rows (expected: m1 -> R1;
   m2 -> R2; m3 -> R4); restore with `git checkout -- open-brain/src` (this returns to commit 2) and check the status is
   empty. After m3, run the two files once more: `88 passed (88)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 5 paths: `M open-brain/src/cli-spec.ts`,
   `M open-brain/src/cli.ts`, `M open-brain/tests/shared/cli-args.test.ts`,
   `A open-brain/src/pipelines/session-start/metrics-review.ts`, `A open-brain/tests/pipelines/t318-s1.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t318-s1-metrics-review` must equal
   HEAD. `gh pr create --base master --head feat/t318-s1-metrics-review --title "T318-S1: open-brain metrics review (T-318)" --body "Brief: docs/loops/t318-s1-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t318-s1 <sha40> PR #<n>` or `BLOCKED t318-s1 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`; then on the desktop `node open-brain/build/cli.js metrics review --since 2026-10-16` lists the step-0
rows (Atlas lag 12-13, the STALE PROCESS rows, Maker's tree_diverged streak). S2: the end-side row from ob_end.
