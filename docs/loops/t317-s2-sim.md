# SIM T317-S2: the /end gate refuses a stale handoff (readers only) - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-20, session 174. **Task:** T-317 part 2, step S2 (readers). **Tag:** `sim-t317-s2`.

## What is measured

S2 adds an OPTIONAL `sessions[].last_work_rev` (written by nothing until S3) and makes the /end gate refuse with
`HANDOFF STALE` when it is above this session's handoff `written_rev`. Files, all under `docs/loops/t317-s2/`:
`edits.txt` (4 edits: `open-brain/src/shared/state-schema.ts` x2, `open-brain/src/shared/end-record-guard.ts` x2),
`t317-s2.test.ts` (rows R1-R5, copied to `open-brain/tests/t317-s2.test.ts`), `m1.txt`, `m2.txt`, `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD (`git rev-parse HEAD`)
   and `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `edits.txt`, `t317-s2.test.ts`, `m1.txt`, `m2.txt` under `docs/loops/t317-s2/`.
c. Baseline: `Copy-Item docs/loops/t317-s2/t317-s2.test.ts open-brain/tests/`; `$env:NO_COLOR='1'`; in `open-brain`:
   `npx vitest run tests/t317-s2.test.ts --no-file-parallelism --testTimeout=180000`. Paste the summary and every `x` row.
d. From the clone root: `node docs/loops/t317-s2/apply.cjs . docs/loops/t317-s2/edits.txt`. Paste its output.
e. In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code
   and any error lines.
f. `npx vitest run tests/t317-s2.test.ts tests/t317-s1.test.ts tests/end-fix tests/shared tests/server.test.ts tests/pipelines/session-end tests/pipelines/session-start tests/pipelines/sync --no-file-parallelism --testTimeout=180000`
   (30-minute cap). Paste the `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file.
   If red rows sit only in files other than `t317-s2.test.ts` alongside T-292's `Timeout calling onTaskUpdate` or hook
   timeouts, re-run each such file alone and paste both. Do not fix anything.
g. Mutants, each on the patched tree, then restore with `git checkout -- open-brain/src` (status must show only the
   untracked test file and build output): `node docs/loops/t317-s2/apply.cjs . docs/loops/t317-s2/m1.txt`, then
   `m2.txt`. After each: its apply output, then the new test file's summary and `x` rows.

## Reply

First line: `READY sim-t317-s2 <HEAD sha8> ALL PASS` only if: c is `4 failed | 1 passed (5)` with `x` R1, R2, R4, R5
and R3 green (the unpatched strict schema makes a state.json carrying the hand-set key unreadable), d prints `APPLIED 4 edits to 2 files`, e all exit
0, f has 0 red rows in t317-s2 / t317-s1 / end-fix files and any other red is green alone, m1 reds R1 and R5, m2 reds R2.
Otherwise `READY sim-t317-s2 <HEAD sha8> MISMATCH` and list each step that differed. Every number is pasted output.
