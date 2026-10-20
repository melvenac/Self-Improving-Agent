# SIM T317-S3: the writer stamps sessions[].last_work_rev - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-20, session 174. **Task:** T-317 part 2, step S3 (writer). **Tag:** `sim-t317-s3`.

## What is measured

S2 (#900) taught readers an optional `sessions[].last_work_rev` and the /end gate the stale rule. S3 makes the writer
stamp it: every write with an op other than `set_handoff` sets it to that write's revision; a handoff-only write keeps
it. Files, all under `docs/loops/t317-s3/`: `edits.txt` (1 edit, `open-brain/src/shared/state-writer.ts`),
`t317-s3.test.ts` (rows R1-R5, copied to `open-brain/tests/t317-s3.test.ts`), `m1.txt`, `m2.txt`, `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `edits.txt`, `t317-s3.test.ts`, `m1.txt`, `m2.txt` under `docs/loops/t317-s3/`.
c. Baseline: `Copy-Item docs/loops/t317-s3/t317-s3.test.ts open-brain/tests/`; `$env:NO_COLOR='1'`; in `open-brain`:
   `npx vitest run tests/t317-s3.test.ts --no-file-parallelism --testTimeout=180000`. Paste the summary and every `x` row.
d. From the clone root: `node docs/loops/t317-s3/apply.cjs . docs/loops/t317-s3/edits.txt`. Paste its output.
e. In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code
   and any error lines.
f. `npx vitest run tests/t317-s3.test.ts tests/t317-s2.test.ts tests/t317-s1.test.ts tests/end-fix tests/shared tests/server.test.ts tests/pipelines --no-file-parallelism --testTimeout=180000`
   (40-minute cap). Paste the `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the
   assertion message. If red rows sit only in files other than `t317-s3.test.ts` alongside T-292's `Timeout calling
   onTaskUpdate` or hook timeouts, re-run each such file alone and paste both. A red row that is red ALONE is the most
   important thing to report: paste its expected and received values in full. Do not fix anything.
g. Mutants. For EACH of `m1.txt` and `m2.txt`: first restore with `git checkout -- open-brain/src`, then RE-APPLY
   `edits.txt` (must print `APPLIED 1 edits to 1 files`), then apply the mutant
   (`node docs/loops/t317-s3/apply.cjs . docs/loops/t317-s3/<m>.txt`), then run the new test file. Paste each apply
   output, the summary and the `x` rows.

## Reply

First line: `READY sim-t317-s3 <HEAD sha8> ALL PASS` only if: c is `2 failed | 3 passed (5)` with `x` R2 and R4; d prints
`APPLIED 1 edits to 1 files`; e all exit 0; f has 0 red rows that are red alone; m1 reds R2 and R4; m2 reds R4 only.
Otherwise `READY sim-t317-s3 <HEAD sha8> MISMATCH` and list each step that differed. Every number is pasted output.
