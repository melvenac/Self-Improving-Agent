# SIM T320: cut the unused build watch now the build proxy carries rebuilds - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-23, session 174. **Task:** T-320 item (1) (T-315 follow-ups). **Tag:** `sim-t320`.

## What is measured

`open-brain/src/shared/build-watch.ts` drove the exit-on-new-build route that failed live on 10-20 and was unwired by the
T-315 revert. Nothing in `open-brain/src` imports it; only `tests/shared/t315-s1.test.ts` (R1-R5) does. Its docstring
says an exited stdio server is respawned, which the 10-20 run disproved. The build proxy (`build-proxy.ts`, #939) now
carries rebuilds to running seats. The change: delete build-watch.ts; t315-s1.test.ts keeps R6 (server.ts never exits on
a new build) and gains R7 (the module is gone); the server.ts comment above `server.connect` names the proxy.

Files under `docs/loops/t320/`: `t315-s1.test.ts` (replaces `open-brain/tests/shared/t315-s1.test.ts`), `edits.txt`
(1 edit in `open-brain/src/server.ts`), `m1.txt` (server.ts mentions `attachBuildWatch(` again), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The three files" means, from `open-brain`:
`npx vitest run tests/shared/t315-s1.test.ts tests/t315-proxy.test.ts tests/t003-session-proof.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `t315-s1.test.ts`, `edits.txt`, `m1.txt` under `docs/loops/t320/`.
c. Baseline: `git grep -n "build-watch" -- open-brain/src open-brain/tests` (paste every line). Then
   `Copy-Item docs/loops/t320/t315-s1.test.ts open-brain/tests/shared/t315-s1.test.ts -Force`. Run the three files.
   Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. `Remove-Item open-brain/src/shared/build-watch.ts`, then from the clone root
   `node docs/loops/t320/apply.cjs . docs/loops/t320/edits.txt` (paste output). Then
   `git grep -n "build-watch" -- open-brain/src open-brain/tests` (paste every line). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines. `Test-Path build/shared/build-watch.js` (paste).
e. Run the three files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/t315-proxy.test.ts tests/t003-session-proof.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows only
   in files other than the three files, alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each
   such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` and paste
   every line.
h. Mutants, on the applied tree.
   - m1: `Copy-Item open-brain/src/server.ts "$env:TEMP\t320-server.bak"`;
     `node docs/loops/t320/apply.cjs . docs/loops/t320/m1.txt` (paste output); run the three files; paste the `Tests`
     line and every `x` row; restore with `Copy-Item "$env:TEMP\t320-server.bak" open-brain/src/server.ts -Force`.
   - m2: `git checkout -- open-brain/src/shared/build-watch.ts` (the module comes back); run the three files; paste the
     `Tests` line and every `x` row; restore with `Remove-Item open-brain/src/shared/build-watch.ts`.
   Then run the three files once more and paste the `Tests` line.

## Reply

First line: `READY sim-t320 <HEAD sha8> ALL PASS` only if: c's first grep lists only `open-brain/src/shared/build-watch.ts`
lines and `open-brain/tests/shared/t315-s1.test.ts` lines; c's only red row is R7 (the module still exists); d prints
`APPLIED 1 edits to 1 files`, its grep lists only `open-brain/tests/shared/t315-s1.test.ts` lines (R6's string and the
comment), all three exit 0 and `Test-Path` is False; e and the final run of h show 0 failed; f has 0 rows red alone; g
shows `module-boundary [pass]`; m1 reds R6 only; m2 reds R7 only. Otherwise `READY sim-t320 <HEAD sha8> MISMATCH` and
list each step that differed, with the full assertion message of every red row. Every number is pasted output, with its
command.
