# SIM T318-S3: `metrics review` lists sessions that greeted and never ran ob_end - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-318 S3 (P1). **Tag:** `sim-t318s3`.

## What is measured

T-318 S1 listed greetings that tripped a threshold (REVIEW QUEUE); S2 listed ob_end calls that need a look (END
QUEUE). S3 adds the third class the note named: a session that greeted and never ran ob_end, so a skipped /end is listed
instead of being found by reading transcripts. `metrics-review.ts` gains `reviewNoEnd` and `renderNoEnd`; `cli.ts`
prints a `NO END:` block after the END QUEUE. Rules: only greetings through ob_start (caller `mcp`) with a session
number count; a greeting is matched to an end row by checkout and session; counting starts at the first end row (ob_end
wrote none before S2); each checkout's newest greeting is left out (that session may still be running); one session's
repeated greetings count once. No end rows at all prints `NO END: not checked (...)`. Read-only, like S1 and S2.

Premise, measured on the desktop's live files (read-only, 10-24 ~08:40Z): 31 greeting rows, 2 end rows (fleet s10
10-23T23:30Z, a2a-planner s44 10-24T01:15Z); the greetings since the first end row are fleet s11 and a2a-planner s45,
each its checkout's newest, so today's queue would read `NO END: 0 of 0`.

Files under `docs/loops/t318-s3/`: `t318-s3.test.ts` (new file, goes to `open-brain/tests/pipelines/t318-s3.test.ts`;
N1-N7), `edits.txt` (3 edits in 2 files), `m1.txt` (the newest greeting is counted), `m2.txt` (no first-end-row floor),
`m3.txt` (CLI starts counted), `m4.txt` (the CLI prints no NO END block), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The four files" means, from `open-brain`:
`npx vitest run tests/pipelines/t318-s3.test.ts tests/pipelines/t318-s1.test.ts tests/t318-s2.test.ts tests/shared/cli-args.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `t318-s3.test.ts`, `edits.txt`, `m1.txt` .. `m4.txt` under
   `docs/loops/t318-s3/`.
c. Baseline: `Copy-Item docs/loops/t318-s3/t318-s3.test.ts open-brain/tests/pipelines/t318-s3.test.ts`. Run the four
   files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t318-s3/apply.cjs . docs/loops/t318-s3/edits.txt` (paste output). In
   `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code
   and any error lines.
e. Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/pipelines/session-start tests/pipelines/t318-s1.test.ts tests/pipelines/t318-s3.test.ts tests/t318-s2.test.ts tests/shared tests/server.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` and paste
   every line. Then `node open-brain/build/cli.js metrics review` (this machine's own files) and paste its exit code
   and every line that starts with `NO END`.
h. Mutants, on the applied tree. Back up the two edited files once:
   `Copy-Item open-brain/src/pipelines/session-start/metrics-review.ts "$env:TEMP\t318-review.bak"`,
   `Copy-Item open-brain/src/cli.ts "$env:TEMP\t318-cli.bak"`. For each of m1..m4:
   `node docs/loops/t318-s3/apply.cjs . docs/loops/t318-s3/<m>.txt` (paste output); run the four files; paste the
   `Tests` line and every `x` row; restore both from their backups with `Copy-Item ... -Force`. Never use
   `git checkout` to restore here (it would also remove the fix). After m4's restore, run the four files once more and
   paste the `Tests` line.

## Reply

First line: `READY sim-t318s3 <HEAD sha8> ALL PASS` only if: c's red rows are N1-N7 in t318-s3.test.ts and nothing
else; d prints `APPLIED 3 edits to 2 files` and all three exit 0; e and the final run of h show 0 failed; f has 0 rows
red alone; g shows `module-boundary [pass]` and `metrics review` exits 0 with one `NO END:` line; m1 reds N1, N2, N3,
N4, N5 and N7 only; m2 reds N1 and N3 only; m3 reds N4 only; m4 reds N7 only. Otherwise
`READY sim-t318s3 <HEAD sha8> MISMATCH` and list each step that differed, with the full assertion message of every red
row. Every number is pasted output, with its command.
