# SIM T313: a seat-specific stored entry fires only for its own seat - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-313 (P3). **Tag:** `sim-t313`.

## What is measured

The recall trigger injects a stored entry into any seat's session, so an entry that names one seat's ops script (entry
689: `bash $S/pr-status.sh`, atlas-ops) fired for clark about 30 times. Measured 10-24 on the live store (read-only):
78 of 864 live entries name a seat by a `<seat>-ops` tag or a `.claude/skills/<seat>-ops` path; replaying injected
fires by each session's registered project put about 60 of 194 seat-specific injections in another seat's session.
The change: a new `open-brain/src/trigger/seat.ts` (`entrySeat`, `resolveTriggerSeat`); `runTrigger` takes `seat` and
skips an entry whose seat differs, on both the element and the keyed path, and records `seat-skip:<ids>` in the fire's
query; the hook resolves the seat from its payload `cwd` (AGENT.local.md / AGENT.md name), falling back to the project
the session registered (`sessions.project_dir`). An unresolved seat, or an entry that names none, fires as before.

Files under `docs/loops/t313/`:
- `seat.ts`: new file, goes to `open-brain/src/trigger/seat.ts`.
- `t313-seat.test.ts`: new file, goes to `open-brain/tests/trigger/t313-seat.test.ts`. S1-S6.
- `edits.txt`: 7 edits in 2 files (`open-brain/src/trigger/run.ts` 5, `open-brain/src/cli-recall-trigger.ts` 2).
- `m1.txt` (the filter never skips), `m2.txt` (a hyphenated `-ops` tag names a seat), `m3.txt` (no registered-project
  fallback), `m4.txt` (no `seat-skip` in the query), `m5.txt` (the hook does not pass the seat), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The five files" means, from `open-brain`:
`npx vitest run tests/trigger/t313-seat.test.ts tests/trigger/t170-match-keys.test.ts tests/trigger/t286-status-required.test.ts tests/trigger/fires.test.ts tests/trigger/hook.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`, then `npm run build` (the hook tests run the
   built hook).
b. Print the sha256 (first 16 hex) of `seat.ts`, `t313-seat.test.ts`, `edits.txt`, `m1.txt` .. `m5.txt` under
   `docs/loops/t313/`.
c. Baseline: `Copy-Item docs/loops/t313/t313-seat.test.ts open-brain/tests/trigger/t313-seat.test.ts`. Run the five
   files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. `Copy-Item docs/loops/t313/seat.ts open-brain/src/trigger/seat.ts`, then from the clone root
   `node docs/loops/t313/apply.cjs . docs/loops/t313/edits.txt` (paste output). In `open-brain`: `npx tsc --noEmit`,
   `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error lines.
   `Test-Path build/trigger/seat.js` (paste).
e. Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/trigger tests/shared tests/pipelines tests/setup-hooks.test.ts tests/t235-p2-5-cursor-recall.test.ts tests/audit-fix-a1-r5.test.ts tests/audit-fix-a1-r7-scrub.test.ts tests/audit-fix-a1-r9-scrub.test.ts tests/t243-audit-lows.test.ts tests/t247-pins-scrub.test.ts tests/t294-small-fixes.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows only
   in files other than the five files, alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each
   such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` and paste
   every line.
h. Mutants, on the applied tree. Back up the three files once:
   `Copy-Item open-brain/src/trigger/run.ts "$env:TEMP\t313-run.bak"`,
   `Copy-Item open-brain/src/trigger/seat.ts "$env:TEMP\t313-seat.bak"`,
   `Copy-Item open-brain/src/cli-recall-trigger.ts "$env:TEMP\t313-hook.bak"`. For each of m1..m5:
   `node docs/loops/t313/apply.cjs . docs/loops/t313/<m>.txt` (paste output); run the five files; paste the `Tests`
   line and every `x` row; restore all three with `Copy-Item "$env:TEMP\t313-<run|seat|hook>.bak" <file> -Force`.
   Never use `git checkout` to restore here (it would also remove the fix). After m5's restore, run the five files
   once more and paste the `Tests` line.

## Reply

First line: `READY sim-t313 <HEAD sha8> ALL PASS` only if: c's only red rows are S1, S2, S4, S5 and S6 in
t313-seat.test.ts (S3 green: it expects today's behaviour); d prints `APPLIED 7 edits to 2 files`, all three exit 0
and `Test-Path` is True; e and the final run of h show 0 failed; f has 0 rows red alone; g shows
`module-boundary [pass]`; m1 reds S2 and S4 only; m2 reds S1 only; m3 reds S5 only; m4 reds S2 and S4 only; m5 reds
S6 only. Otherwise `READY sim-t313 <HEAD sha8> MISMATCH` and list each step that differed, with the full assertion
message of every red row. Every number is pasted output, with its command.
