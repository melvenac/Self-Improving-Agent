# SIM T304: a role-none checkout gets its own checkout's handoff - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-304 (P3). **Tag:** `sim-t304`.

## What is measured

A checkout that declares `role: none` (NOT_A_SEAT: the main checkout, a one-agent bootstrap project, a coordinator)
resolves no seat, and `ownHandoff()` in `open-brain/src/shared/state-schema.ts` returns null for a null seat. So its
greeting never has a PICK UP, even for a handoff its own checkout wrote. Planner ruling (recommended default, noted for
Aaron): the READ side only. A role-none reader gets the newest handoff written FROM its own checkout, by any seat; with
no checkout known it gets none; an unresolved reader (no identity at all) is unchanged. start-report.ts gives a
role-none reader its checkout even with `handoff_by_checkout` off. The schema, set_handoff and SeatName are unchanged.
reads-owed and greeting-metrics keep their current null-seat behaviour.

Files under `docs/loops/t304/`: `t304-role-none-handoff.test.ts` (new file, goes to
`open-brain/tests/pipelines/session-start/t304-role-none-handoff.test.ts`; H1-H3, H4a, H4b, H5), `edits.txt` (13 edits
in 4 files: shared/state-schema.ts, session-start/briefing.ts, session-start/state-render.ts,
session-start/start-report.ts), `m1.txt` (ownHandoff ignores the role-none flag), `m2.txt` (any checkout matches),
`m3.txt` (no checkout fallback in start-report), `m4.txt` (the state block's UNRESOLVED header kept), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The four files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/t304-role-none-handoff.test.ts tests/pipelines/session-start/state-render.test.ts tests/pipelines/session-start/briefing.test.ts tests/pipelines/session-start/handoff-by-checkout.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `t304-role-none-handoff.test.ts`, `edits.txt`, `m1.txt` .. `m4.txt` under
   `docs/loops/t304/`.
c. Baseline: `Copy-Item docs/loops/t304/t304-role-none-handoff.test.ts open-brain/tests/pipelines/session-start/t304-role-none-handoff.test.ts`.
   Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t304/apply.cjs . docs/loops/t304/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/pipelines tests/server.test.ts tests/t154-cli-start.test.ts tests/t249-worktree-identity.test.ts tests/t251-role-stubs.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` and paste
   every line.
h. Mutants, on the applied tree. Back up the three files the mutants touch once:
   `Copy-Item open-brain/src/shared/state-schema.ts "$env:TEMP\t304-schema.bak"`,
   `Copy-Item open-brain/src/pipelines/session-start/start-report.ts "$env:TEMP\t304-report.bak"`,
   `Copy-Item open-brain/src/pipelines/session-start/state-render.ts "$env:TEMP\t304-render.bak"`. For each of m1..m4:
   `node docs/loops/t304/apply.cjs . docs/loops/t304/<m>.txt` (paste output); run the four files; paste the `Tests`
   line and every `x` row; restore all three from their backups with `Copy-Item ... -Force`. Never use
   `git checkout` to restore here (it would also remove the fix). After m4's restore, run the four files once more and
   paste the `Tests` line.

## Reply

First line: `READY sim-t304 <HEAD sha8> ALL PASS` only if: c's red rows are H1, H4a and H4b in
t304-role-none-handoff.test.ts and nothing else; d prints `APPLIED 13 edits to 4 files` and all three exit 0; e and the
final run of h show 0 failed; f has 0 rows red alone; g shows `module-boundary [pass]`; m1 reds H1, H4a and H4b only;
m2 reds H1 and H5 only; m3 reds H4a and H4b only; m4 reds H4b only. Otherwise `READY sim-t304 <HEAD sha8> MISMATCH`
and list each step that differed, with the full assertion message of every red row. Every number is pasted output, with
its command.

Round 2 (job #103 at d9591829: the new test file failed to LOAD, `fixture invalid: handoffs.1.loop_state: a planner
handoff must carry loop_state`, so no row ran; the edits applied, type-checked, built, and the other 1,734 tests were
green). The test's `entry()` now gives a planner handoff an empty loop_state. The three fixture states the file builds
were checked with the main build's parseState on the desktop: all valid. Everything else is unchanged.
