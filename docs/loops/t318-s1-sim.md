# SIM T318-S1: `open-brain metrics review`, review by exception - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-21, session 174. **Task:** T-318 (P1), slice 1. **Tag:** `sim-t318-s1`.

## What is measured

T-318 step 0 (Atlas, 10-21) found every desktop planner /start since 10-16 leaves a greeting-metrics row, and that the
misses fall in classes the rows already carry: a handoff long behind the record, a STALE PROCESS server, an alarm seen
again the next greeting. S1 adds a read-only CLI, `open-brain metrics review [--since YYYY-MM-DD]`, that lists only
the rows tripping a threshold (handoff lag > 5 revs, stale_process, any alarm streak >= 2): the review queue.

Files under `docs/loops/t318-s1/`:
- `metrics-review.ts`: new SOURCE file, goes to `open-brain/src/pipelines/session-start/metrics-review.ts`.
- `edits.txt`: 3 edits in 2 files: `open-brain/src/cli-spec.ts` (the `metricsReview` spec), `open-brain/src/cli.ts` (the
  command branch and its usage line).
- `tests.txt`: 2 edits in `open-brain/tests/shared/cli-args.test.ts` (the command list and the usage-line table).
- `t318-s1.test.ts`: new file, goes to `open-brain/tests/pipelines/t318-s1.test.ts`. R1-R5.
- `m1.txt` (lag threshold >=), `m2.txt` (a first alarm flags), `m3.txt` (no file is not 'not checked'), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The two files" means, from `open-brain`:
`npx vitest run tests/pipelines/t318-s1.test.ts tests/shared/cli-args.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `metrics-review.ts`, `edits.txt`, `tests.txt`, `t318-s1.test.ts`, `m1.txt`,
   `m2.txt`, `m3.txt` under `docs/loops/t318-s1/`.
c. Baseline: `node docs/loops/t318-s1/apply.cjs . docs/loops/t318-s1/tests.txt` (paste output);
   `Copy-Item docs/loops/t318-s1/t318-s1.test.ts open-brain/tests/pipelines/t318-s1.test.ts`. Run the two files. Paste
   the `Test Files` and `Tests` lines and every `x` row with its file and assertion message (a file that fails to
   import counts: paste its error line).
d. `Copy-Item docs/loops/t318-s1/metrics-review.ts open-brain/src/pipelines/session-start/metrics-review.ts`; from the
   clone root `node docs/loops/t318-s1/apply.cjs . docs/loops/t318-s1/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the two files. Paste the `Test Files` and `Tests` lines and every `x` row.
f. `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/end-fix --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground or a timeout of at least 40 minutes). Paste the `Test Files`, `Tests` and any `Errors`
   lines and every `x` row with its file and the assertion message. Red rows only in files other than the two files,
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js metrics review --since 2026-10-16` and paste the whole output
   (on this host it may say `not checked`). Then `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|FAIL|ISSUE"`
   and paste every line.
h. Mutants, on the applied tree. For each of m1, m2, m3: back up
   `open-brain/src/pipelines/session-start/metrics-review.ts` with `Copy-Item <file> "$env:TEMP\t318s1-<m>.bak"`;
   `node docs/loops/t318-s1/apply.cjs . docs/loops/t318-s1/<m>.txt` (paste output); run the two files; paste the
   `Tests` line and every `x` row; restore with `Copy-Item "$env:TEMP\t318s1-<m>.bak" <file> -Force`. Never use
   `git checkout` to restore here. After m3's restore, run the two files once more and paste the `Tests` line.

## Reply

First line: `READY sim-t318-s1 <HEAD sha8> ALL PASS` only if: c prints `APPLIED 2 edits to 1 files` and its red rows
are only in t318-s1.test.ts (or that file fails to import) and the cli-args rows that name `metrics review`; d prints
`APPLIED 3 edits to 2 files` and all three exit 0; e and the final run of h show 0 failed; f has 0 rows red alone; g's
first command exits 0 and prints a line starting `REVIEW QUEUE:`, and module-boundary says `[pass]`; m1 reds R1, m2
reds R2, m3 reds R4. Otherwise `READY sim-t318-s1 <HEAD sha8> MISMATCH` and list each step that differed. Every number
is pasted output, with its command.
