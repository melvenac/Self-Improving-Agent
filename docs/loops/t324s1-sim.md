# SIM T324S1: pick_up_ids and open_questions on the greeting-metrics row - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 174. **Task:** T-324 S1 (P2). **Tag:** `sim-t324s1`. **Authority:** Aaron at
the planner's desk, 2026-10-26: "file items 1-6 as a dashboard task for Prism"; Prism filed agent-dashboard T-054 and
asked for these two fields (shape agreed in the A2A exchange; recorded on T-324).

## What is measured

The dashboard's greeting scorecard cannot score whether a session's first action matched what the greeting pointed at,
or whether "waiting on Aaron" is still true, because the greeting-metrics row carries neither. S1 adds two keys to the
row, which stays `schema: 1` (the live dashboard drops any other schema; extra keys are ignored by today's reader):
- `pick_up_ids`: T-, V- and #ids in the reader's own handoff `pick_up`, then in the objective, de-duplicated in that
  order, at most 10; `[]` without a record.
- `open_questions`: the count of unresolved questions owned by `aaron` (case-insensitive) across
  `newestHandoffPerInstance(state.handoffs)`, the same set the budgeted greeting prints as WAITING ON AARON; `null`
  without a record.

The edit (6 edits in 2 files): `pipelines/session-start/greeting-metrics.ts` (imports, `PICK_UP_IDS_CAP`, the two
interface fields, their computation, the two row keys appended after `alarm_streaks`) and
`tests/pipelines/session-start/t298-greeting-truth.test.ts` (G8's pinned key ORDER gains the two keys at the end).

Files under `docs/loops/t324s1/`: `t324-s1-greeting-fields.test.ts` (new file, goes to
`open-brain/tests/pipelines/session-start/t324-s1-greeting-fields.test.ts`; F1-F5), `edits.txt`, `m1.txt` (objective
ids dropped), `m2.txt` (resolved questions counted), `m3.txt` (every handoff counted, not the newest per instance),
`m4.txt` (no cap), `apply.cjs`.

Round 2: round 1 (job #130) held everything except F3, whose fixture gave two planner handoffs a null session_uuid (parseState allows one per seat); the test now gives each handoff `u-<index>`. No source edit changed.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The five files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/t324-s1-greeting-fields.test.ts tests/pipelines/session-start/t298-greeting-truth.test.ts tests/pipelines/session-start/t298-s2-handoff-stamp.test.ts tests/pipelines/t318-s1.test.ts tests/t314-start-read-only.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t324s1/`.
c. Baseline: `Copy-Item docs/loops/t324s1/t324-s1-greeting-fields.test.ts open-brain/tests/pipelines/session-start/t324-s1-greeting-fields.test.ts`.
   Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t324s1/apply.cjs . docs/loops/t324s1/edits.txt` (paste output). In
   `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code
   and any error lines.
e. Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/pipelines tests/server.test.ts tests/t154-cli-start.test.ts tests/t314-start-read-only.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` and paste
   every line.
h. Mutants, on the applied tree. Back up once:
   `Copy-Item open-brain/src/pipelines/session-start/greeting-metrics.ts "$env:TEMP\t324s1-gm.bak"`. For each of
   m1..m4: `node docs/loops/t324s1/apply.cjs . docs/loops/t324s1/<m>.txt` (paste output); run ONLY
   `npx vitest run tests/pipelines/session-start/t324-s1-greeting-fields.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and every `x` row; restore with `Copy-Item "$env:TEMP\t324s1-gm.bak" open-brain/src/pipelines/session-start/greeting-metrics.ts -Force`.
   Never use `git checkout` to restore here. After m4's restore, run the five files once more and paste the `Tests` line.

## Predicted

- c: red F1-F5 in t324-s1-greeting-fields.test.ts (neither key exists); every other row green, G8 included.
- d: `APPLIED 6 edits to 2 files`; all three exit 0.
- e and h's final run: 0 failed.
- m1 -> F1 and F5. m2 -> F3. m3 -> F3. m4 -> F2.

## Reply

First line: `READY sim-t324s1 <HEAD sha8> ALL PASS` only if every prediction held, f has 0 rows red alone, and g shows
`module-boundary [pass]`. Otherwise `READY sim-t324s1 <HEAD sha8> MISMATCH` and list each step that differed, with the
full assertion message of every red row. Every number is pasted output, with its command.
