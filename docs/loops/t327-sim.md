# SIM T327: objective_stale alarm on the greeting-metrics row - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-27, session 175. **Task:** T-327 (P3). **Tag:** `sim-t327`. **Authority:** Prism
(agent-dashboard planner) asked for the seats' /start flags on the dashboard (A2A 10-27); Atlas ruled that the
deterministic source is the greeting row's `alarm_streaks` and that "objective names a done task" is the one SIA-side
flag it lacks. Prism renders any new alarm id (dimmed until added to its SC_ALARM_IDS).

## What is measured

Since T-309 the budgeted briefing marks a NEXT row whose task is done and named by the objective:
`- [done] <id> <title> (objective names a done task: update it with set_objective)` (briefing.ts `STALE_OBJECTIVE`).
Nothing records it, so the scorecard cannot show a stale objective or how long it has stood. T-327 adds an eleventh
alarm id, `objective_stale`, appended LAST to `ALARM_IDS` (the ten existing ids keep their order), with a pattern
anchored on the render's row shape:

`/^- \[done\] \S+ .*\(objective names a done task: update it with set_objective\)$/m`

so the note quoted in prose (a WATCH OUT line, a pick-up sentence) does not raise it. The streak logic is the existing
one (previous streak + 1). The row stays `schema: 1`; `alarm_streaks` is an object, so G8's pinned key ORDER is
unchanged.

The edit (2 edits in 1 file): `open-brain/src/pipelines/session-start/greeting-metrics.ts` (`ALARM_IDS` gains the id
at the end; `ALARM_PATTERNS` gains its regex after `latest_brief_undetermined`, with a one-line comment).

Files under `docs/loops/t327/`: `t327-objective-stale.test.ts` (new file, goes to
`open-brain/tests/pipelines/session-start/t327-objective-stale.test.ts`; rows A1-A5 plus a fixture row), `edits.txt`,
`m1.txt` (pattern unanchored), `m2.txt` (multiline flag dropped), `m3.txt` (id moved to the front of `ALARM_IDS`),
`apply.cjs`. The mutants apply to the EDITED file.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t298-greeting-truth.test.ts` G8 (key order; `alarm_streaks` toEqual on REPORT) | stays green | No key added to the row; REPORT carries no `- [done]` row. |
| `t298-s2-handoff-stamp.test.ts` (alarm_streaks toEqual on synthetic reports) | stays green | Its reports carry no `- [done]` row. |
| `t309-done-objective.test.ts` (the render) | stays green | briefing.ts is not edited. |
| `t324-s1-greeting-fields.test.ts` | stays green | Its report is a 3-line stub. |
| `tests/pipelines/t318-s1.test.ts` (metrics review reasons) | stays green | Reads alarm_streaks generically; no id list pinned. |

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The six files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/t327-objective-stale.test.ts tests/pipelines/session-start/t298-greeting-truth.test.ts tests/pipelines/session-start/t298-s2-handoff-stamp.test.ts tests/pipelines/session-start/t309-done-objective.test.ts tests/pipelines/session-start/t324-s1-greeting-fields.test.ts tests/pipelines/t318-s1.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t327/`.
c. Baseline: `Copy-Item docs/loops/t327/t327-objective-stale.test.ts open-brain/tests/pipelines/session-start/t327-objective-stale.test.ts`.
   Run the six files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t327/apply.cjs . docs/loops/t327/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the six files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/pipelines tests/server.test.ts tests/t154-cli-start.test.ts tests/t314-start-read-only.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each such file alone (up to 3 times) and
   paste every run. Known flaky under load: hub-presence, state-import-r4, end-fix-q3.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"` and
   paste every line.
h. Mutants, on the applied tree. Back up once:
   `Copy-Item open-brain/src/pipelines/session-start/greeting-metrics.ts "$env:TEMP\t327-gm.bak"`. For each of m1..m3:
   `node docs/loops/t327/apply.cjs . docs/loops/t327/<m>.txt` (paste output; must be `APPLIED 1 edits to 1 files`);
   `npx tsc --noEmit` in `open-brain` (paste exit code; a mutant is valid only at exit 0); run ONLY
   `npx vitest run tests/pipelines/session-start/t327-objective-stale.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and every `x` row; restore with
   `Copy-Item "$env:TEMP\t327-gm.bak" open-brain/src/pipelines/session-start/greeting-metrics.ts -Force`.
   Never use `git checkout` to restore here. After m3's restore, run the six files once more and paste the `Tests` line.

## Predicted

- c: red A1, A4 and A5 in t327-objective-stale.test.ts (A1/A4: `objective_stale` undefined; A5: ALARM_IDS has 10);
  A2, A3 and the fixture row green; every other file green.
- d: `APPLIED 2 edits to 1 files`; all three exit 0.
- e and h's final run: 0 failed.
- g: `module-boundary [pass]`, `retirements [pass]`.
- m1 (unanchored) -> A3. m2 (no multiline flag: `^` only at the report's start) -> A1 and A4. m3 (id first) -> A5.
  Each mutant's tsc exits 0.

## Reply

First line: `READY sim-t327 <HEAD sha8> ALL PASS` only if every prediction held, f has 0 rows red alone, and g shows
both passes. Otherwise `READY sim-t327 <HEAD sha8> MISMATCH` and list each step that differed, with the full assertion
message of every red row. Every number is pasted output, with its command.
