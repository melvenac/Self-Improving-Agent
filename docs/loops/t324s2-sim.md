# SIM T324S2: the greeting outcome row from SessionEnd - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 175. **Task:** T-324 S2 (P2). **Tag:** `sim-t324s2`. **Authority:** Aaron at
the planner's desk, 2026-10-26: "file items 1-6 as a dashboard task for Prism"; Prism filed agent-dashboard T-054 and
agreed the outcome-row shape (recorded on T-324). **Base:** the launcher's START, a master that contains this SIM. It
should contain the T-324 S1 merge (greeting rows with `pick_up_ids`), but no edit here anchors on S1: the rows are
synthetic and the anchors are in `cli-session-end.ts`, which S1 does not touch.

```text
IMPACT-TARGETS: none (a new core module; cli-session-end.ts gains one import and one guarded block, no symbol changes)
```

## What is measured

The dashboard scorecard (T-054) needs to know what a session did after its greeting. SessionEnd appends one row to the
same `greeting-metrics.jsonl`, append-only (the greeting row is never edited):
`{schema:2, kind:"outcome", id, ts, greeting_id, session, first_action:{t,tool,ids}|null, first_action_match, ended}`.
- **Greeting row:** the EARLIEST schema-1 row whose `checkout` is the project dir's basename and whose `ts` is at or
  after the transcript's first timestamp (`sessionStartFromTranscript`). There is none when metrics are off or there was
  no /start, and then no outcome row is written.
- **first_action:** the first main-thread (`isSidechain` not true) assistant `tool_use` whose line timestamp is strictly
  after the greeting row's `ts`, skipping the plumbing `ToolSearch`, `TodoWrite`, `*ob_set_session` and `*ob_start`.
  `ids` are the T-, V- and #ids in `JSON.stringify(input)`, de-duplicated, at most 10. null when there is no such call.
- **first_action_match:** true if an id is in the greeting's `pick_up_ids`; false if none is, or if the action has no
  ids; null when `pick_up_ids` is `[]` or absent (a pre-S1 row), or `first_action` is null.
- **ended:** the ob_end stamp (`readObEndStamp`) has an `ob_end_at` and names THIS session's id.
- **session:** the greeting row's `session` (the session number), copied.

Files under `docs/loops/t324s2/`: `greeting-outcome.ts` (new core module, goes to
`open-brain/src/pipelines/session-start/greeting-outcome.ts`), `t324-s2-greeting-outcome.test.ts` (new test, goes to
`open-brain/tests/pipelines/session-start/t324-s2-greeting-outcome.test.ts`; O1-O6 on the module, W1-W2 spawn the
SessionEnd hook through tsx), `edits.txt` (2 edits in `open-brain/src/cli-session-end.ts`: the import, and the guarded
block after the skills-audit check), `m1.txt` (ob_start not plumbing), `m2.txt` (no-id action scored null),
`m3.txt` (checkout filter dropped), `m4.txt` (ended ignores the session id; in cli-session-end.ts), `apply.cjs`.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/t262-part2.test.ts` (SessionEnd H-1..H-6) | stays green | Asserts only its own skills-audit lines; the new block prints its own line. |
| `tests/end-fix-q6.test.ts`, `tests/end-fix-q12.test.ts` (spawn SessionEnd) | stay green | `toContain` on WORK AFTER lines; no greeting-metrics file there, so the new block prints `none (...)`. |
| `tests/pipelines/session-start/t298-greeting-truth.test.ts` (G8 row key order) | stays green | Greeting rows are unchanged; outcome rows are a separate schema. |
| `/sync` module-boundary | pass | The new file is core and imports only node and `greeting-metrics.ts`; cli-session-end.ts is already memory side. |
| `tests/harness/s4-guards.test.ts` D1b | not run here | A SIM cannot commit the new files (entry 895); the build commits them. |

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The five files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/t324-s2-greeting-outcome.test.ts tests/t262-part2.test.ts tests/end-fix-q6.test.ts tests/end-fix-q12.test.ts tests/pipelines/session-start/t298-greeting-truth.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`, then `node -e "require('better-sqlite3')"`
   (on "Could not locate the bindings file" run `npm rebuild better-sqlite3` and say so).
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t324s2/`.
c. Baseline 1 (test only): `Copy-Item docs/loops/t324s2/t324-s2-greeting-outcome.test.ts open-brain/tests/pipelines/session-start/t324-s2-greeting-outcome.test.ts`.
   Run the five files. Paste the `Test Files` and `Tests` lines, any `Errors` line, and the load error for the new file.
d. Baseline 2 (module, not wired): `Copy-Item docs/loops/t324s2/greeting-outcome.ts open-brain/src/pipelines/session-start/greeting-outcome.ts`.
   Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
e. From the clone root `node docs/loops/t324s2/apply.cjs . docs/loops/t324s2/edits.txt` (paste output). In
   `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code
   and any error lines.
f. Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
g. `npx vitest run tests/pipelines tests/shared tests/end-fix tests/t262-part2.test.ts tests/t003-session-proof.test.ts tests/t276-session-trailer.test.ts tests/t294-small-fixes.test.ts tests/t048-r2b.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or a timeout: re-run each such file alone up to 3 times and paste
   every run.
h. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary","retirements"`
   and paste every line.
i. Mutants, on the applied tree. Back up once:
   `Copy-Item open-brain/src/pipelines/session-start/greeting-outcome.ts "$env:TEMP\t324s2-go.bak"` and
   `Copy-Item open-brain/src/cli-session-end.ts "$env:TEMP\t324s2-se.bak"`. For each of m1..m4:
   `node docs/loops/t324s2/apply.cjs . docs/loops/t324s2/<m>.txt` (paste output); run ONLY
   `npx vitest run tests/pipelines/session-start/t324-s2-greeting-outcome.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and every `x` row; restore BOTH files from the backups with `Copy-Item ... -Force`. Never use
   `git checkout` to restore here. After m4's restore, run the five files once more and paste the `Tests` line.

## Predicted

- c: the new file fails to load (cannot resolve `greeting-outcome.js`) and has no test rows; the other four files are
  green.
- d: red W1 and W2 only (stdout has no `greeting outcome` line); O1-O6 green; the other four files green.
- e: `APPLIED 2 edits to 1 files`; all three exit 0.
- f and i's final run: 0 failed.
- g: 0 failed, subject to the T-292 re-run rule.
- h: `module-boundary [pass]`, `retirements [pass]`.
- m1 -> O1. m2 -> O3. m3 -> O4 and O6. m4 -> W2.

## Reply

First line: `READY sim-t324s2 <HEAD sha8> ALL PASS` only if every prediction held, g has 0 rows red on every run
alone, and h shows both `[pass]`. Otherwise `READY sim-t324s2 <HEAD sha8> MISMATCH` and list each step that differed,
with the full assertion message of every red row. Every number is pasted output, with its command.
