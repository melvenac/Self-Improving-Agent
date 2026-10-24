# SIM T309: the budgeted NEXT says when the objective names a done task - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-309 (P3). **Tag:** `sim-t309`.

## What is measured

The budgeted briefing (`renderBudgeted` in `open-brain/src/pipelines/session-start/briefing.ts`) lists in NEXT exactly
the task ids the objective names. A done task prints `- [done] T-169 <title>` and nothing says the objective is stale
(Maker's s70 greeting led with a done task while six active P1s were hidden). The edit keeps the row and its `[done]`
mark, cuts the title to 36 characters and ends the row with
`(objective names a done task: update it with set_objective)`, exported as `STALE_OBJECTIVE`. It adds no line, and
the row is no longer than an open task's row with the same long title.

Files under `docs/loops/t309/`: `t309-done-objective.test.ts` (new file, goes to
`open-brain/tests/pipelines/session-start/t309-done-objective.test.ts`; rows fixture, D1-D4), `edits.txt` (2 edits in
`briefing.ts`), `m1.txt` (the note dropped), `m2.txt` (the done row keeps the 100-char title), `m3.txt` (the note on
every open row too), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The three files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/t309-done-objective.test.ts tests/pipelines/session-start/briefing-budget.test.ts tests/pipelines/session-start/briefing.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `t309-done-objective.test.ts`, `edits.txt`, `m1.txt` .. `m3.txt` under
   `docs/loops/t309/`.
c. Baseline: `Copy-Item docs/loops/t309/t309-done-objective.test.ts open-brain/tests/pipelines/session-start/t309-done-objective.test.ts`.
   Run the three files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t309/apply.cjs . docs/loops/t309/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the three files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/pipelines tests/t154-cli-start.test.ts tests/s173h.test.ts tests/active-session.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` and paste
   every line.
h. Mutants, on the applied tree; the file is `open-brain/src/pipelines/session-start/briefing.ts` for all three. Back
   it up once with `Copy-Item <file> "$env:TEMP\t309-fixed.bak"`. For each of m1..m3:
   `node docs/loops/t309/apply.cjs . docs/loops/t309/<m>.txt` (paste output); run the three files; paste the `Tests`
   line and every `x` row; restore with `Copy-Item "$env:TEMP\t309-fixed.bak" <file> -Force`. Never use
   `git checkout` to restore here (it would also remove the fix). After m3's restore, run the three files once more and
   paste the `Tests` line.

## Reply

First line: `READY sim-t309 <HEAD sha8> ALL PASS` only if: c's only red rows are D1, D3 and D4 in
t309-done-objective.test.ts; d prints `APPLIED 2 edits to 1 files` and all three exit 0; e and the final run of h show 0
failed; f has 0 rows red alone; g shows `module-boundary [pass]`; m1 reds D1 and D3 only; m2 reds D3 only; m3 reds D2
only. Otherwise `READY sim-t309 <HEAD sha8> MISMATCH` and list each step that differed, with the full assertion
message of every red row. Every number is pasted output, with its command.
