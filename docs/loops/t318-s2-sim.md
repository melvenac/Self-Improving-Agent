# SIM T318-S2: ob_end writes an end-metrics row; `metrics review` prints an END QUEUE - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-22, session 174. **Task:** T-318 (P1), slice 2. **Tag:** `sim-t318-s2`.

## What is measured

T-318 (b): an end-side scorecard row. S1 (#924) lists greetings that tripped a threshold. S2 makes ob_end append one
row per call to `end-metrics.jsonl` beside the knowledge store (same opt-in as the greeting row: greeting.json
`greeting_metrics`; a dry run writes nothing). The row records what ob_end's record gate decided (T-317's rule):
`closed`, `refused`, `record_ok` or `not_checked`, with the session number, seat, last_work_rev and the handoff's
written_rev. `open-brain metrics review` then prints an END QUEUE after the REVIEW QUEUE: record_ok closes, record not
checked, and refusals the same session never closed.

Files under `docs/loops/t318-s2/`:
- `end-metrics.ts`: new SOURCE file, goes to `open-brain/src/shared/end-metrics.ts`.
- `edits.txt`: 8 edits in 3 files: `open-brain/src/server.ts` (import, the `endRow` helper and its 5 calls in
  handleEnd), `open-brain/src/pipelines/session-start/metrics-review.ts` (endReviewReason, reviewEndMetrics,
  renderEndReview), `open-brain/src/cli.ts` (the END QUEUE print and the usage line text).
- `t318-s2.test.ts`: new file, goes to `open-brain/tests/t318-s2.test.ts`. E1-E5.
- `m1.txt` (a refusal closed later still flags), `m2.txt` (rows written without the opt-in), `m3.txt` (handoff_rev
  from first_rev), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The three files" means, from `open-brain`:
`npx vitest run tests/t318-s2.test.ts tests/pipelines/t318-s1.test.ts tests/shared/cli-args.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `end-metrics.ts`, `edits.txt`, `t318-s2.test.ts`, `m1.txt`, `m2.txt`, `m3.txt`
   under `docs/loops/t318-s2/`.
c. Baseline: `Copy-Item docs/loops/t318-s2/t318-s2.test.ts open-brain/tests/t318-s2.test.ts`. Run the three files.
   Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message (a file that fails
   to import counts: paste its error line).
d. `Copy-Item docs/loops/t318-s2/end-metrics.ts open-brain/src/shared/end-metrics.ts`; from the clone root
   `node docs/loops/t318-s2/apply.cjs . docs/loops/t318-s2/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the three files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/end-fix tests/t317-s1.test.ts tests/t317-s2.test.ts tests/t317-s3.test.ts tests/t003-r2.test.ts tests/t003-session-proof.test.ts tests/t048-r3.test.ts tests/t276-session-trailer.test.ts tests/t318-s2.test.ts tests/trigger --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground or a timeout of at least 40 minutes). Paste the `Test Files`, `Tests` and any `Errors`
   lines and every `x` row with its file and the assertion message. Red rows only in files other than the three files,
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js metrics review --since 2026-10-16` and paste the whole output
   (on this host both queues may say `not checked`). Then
   `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|FAIL|ISSUE"` and paste every line.
h. Mutants, on the applied tree. For each of m1, m2, m3: the file is `open-brain/src/pipelines/session-start/metrics-review.ts`
   for m1, `open-brain/src/server.ts` for m2, `open-brain/src/shared/end-metrics.ts` for m3. Back it up with
   `Copy-Item <file> "$env:TEMP\t318s2-<m>.bak"`; `node docs/loops/t318-s2/apply.cjs . docs/loops/t318-s2/<m>.txt`
   (paste output); run the three files; paste the `Tests` line and every `x` row; restore with
   `Copy-Item "$env:TEMP\t318s2-<m>.bak" <file> -Force`. Never use `git checkout` to restore here. After m3's restore,
   run the three files once more and paste the `Tests` line.

## Reply

First line: `READY sim-t318-s2 <HEAD sha8> ALL PASS` only if: c's only red file is t318-s2.test.ts (it fails to import
`end-metrics.js`, or its rows are red); d prints `APPLIED 8 edits to 3 files` and all three exit 0; e and the final run
of h show 0 failed; f has 0 rows red alone; g's first command exits 0 and prints a line starting `REVIEW QUEUE:` and a
line starting `END QUEUE:`, and module-boundary says `[pass]`; m1 reds E2, E3 and E4; m2 reds E5 only; m3 reds E1 and E4. Otherwise
`READY sim-t318-s2 <HEAD sha8> MISMATCH` and list each step that differed, with the full assertion message of every
red row. Every number is pasted output, with its command.
