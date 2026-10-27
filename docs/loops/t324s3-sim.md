# SIM T324S3: trigger counts on the greeting outcome row - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 175. **Task:** T-324 S3 (P2). **Tag:** `sim-t324s3`. **Authority:** Aaron at
the planner's desk, 2026-10-26: "file items 1-6 as a dashboard task for Prism"; Prism asked for the trigger counts on
the outcome row for T-054 item 3 ("the recall trigger per seat"), shape agreed in the A2A exchange (recorded on T-324).
**Base:** the launcher's START, a master that contains this SIM and the T-324 S2 merge (`17100231`): the edits anchor
on S2's `greeting-outcome.ts` and its block in `cli-session-end.ts`.

```text
IMPACT-TARGETS: buildGreetingOutcomeRow, recordGreetingOutcome (an optional 5th parameter / optional input fields; existing callers unchanged)
```

## What is measured

The outcome row gains two optional keys, appended after `ended`, only when known:
- `session_uuid`: the session's uuid as the hook resolves it (Prism: welcome, not required).
- `trigger: {asked, injected, seat_skip, path_match, error_match}`: this session's `trigger_fires` rows as counts, no
  query text. asked = state not `not-asked`; injected = state `injected`; `seat_skip`, `path_match`, `error_match` count
  rows whose query has the space-separated token `seat-skip:`, `path-match:` or `error-match:`, as `trigger/run.ts`
  writes them (`seat-skip:<ids>` etc.; a derived word like `"seat-skip"` without the colon does not count).
- **Not read is not zero.** No DB file, no `trigger_fires` table, an unreadable DB or no session uuid: `trigger` is
  OMITTED. A store read with no rows for the session is all zeros.

Judgment calls:
1. **The boundary.** `greeting-outcome.ts` is core, and `trigger_fires` is memory. The core file gets a pure
   `triggerCounts(rows)`, and `cli-session-end.ts`, which is already memory side and imports `better-sqlite3`, reads the
   rows read-only (`fileMustExist`, never `openV2Database`, which would create a store) and passes the counts in.
   No new boundary crossing.
2. **Timing.** The S2 block runs before the T-159 reconcile, which moves pending `not-asked` fires into the table. Those
   have an empty query and count toward nothing, so running first changes no count. Silent and injected fires are
   written to the table when they fire.
3. **Shape stability.** A row built without extras keeps S2's exact keys, so S2's O5 key pin stays green.

Files under `docs/loops/t324s3/`: `t324-s3-trigger-counts.test.ts` (new, goes to
`open-brain/tests/pipelines/session-start/t324-s3-trigger-counts.test.ts`; R1-R4 on the module, W3-W4 spawn the
SessionEnd hook through tsx), `edits.txt` (9 edits in 2 files: 6 in `greeting-outcome.ts`: `TriggerCounts` and
`triggerCounts`, the two optional row fields and `OutcomeExtras`, `buildGreetingOutcomeRow`'s extra parameter, the two
optional input fields, the call; 3 in `cli-session-end.ts`: the import, `readTriggerCounts`, the two input fields),
`m1.txt` (asked counts not-asked rows), `m2.txt` (no DB writes zeros), `m3.txt` (not scoped to the session),
`m4.txt` (trigger key always set), `m5.txt` (token matched as a substring), `apply.cjs`.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t324-s2-greeting-outcome.test.ts` O5 (S2's key order) | stays green | Built without extras, so no new keys. |
| `t324-s2-greeting-outcome.test.ts` O6, W1, W2 | stay green | `toMatchObject` on the S2 fields; W1/W2's rows gain `session_uuid` (their DB file is absent, so no `trigger`); the stdout line is unchanged. |
| `tests/t262-part2.test.ts`, `tests/end-fix-q6.test.ts`, `tests/end-fix-q12.test.ts` (spawn SessionEnd) | stay green | Their own lines only; no greeting row there, so the outcome block prints `none (...)` before any DB read. |
| `/sync` module-boundary | pass | `greeting-outcome.ts` stays node + `greeting-metrics.ts` only; the DB read is in memory-side `cli-session-end.ts`. |
| `tests/harness/s4-guards.test.ts` D1b | not run here | A SIM cannot commit the new test (entry 895); the build commits it. |

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The five files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/t324-s3-trigger-counts.test.ts tests/pipelines/session-start/t324-s2-greeting-outcome.test.ts tests/t262-part2.test.ts tests/end-fix-q6.test.ts tests/end-fix-q12.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). `git merge-base --is-ancestor 17100231 HEAD` must exit 0. In `open-brain`:
   `npm ci`, then `node -e "require('better-sqlite3')"` (on "Could not locate the bindings file" run
   `npm rebuild better-sqlite3` and say so).
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t324s3/`.
c. Baseline (test only): `Copy-Item docs/loops/t324s3/t324-s3-trigger-counts.test.ts open-brain/tests/pipelines/session-start/t324-s3-trigger-counts.test.ts`.
   Run the five files. Paste the `Test Files` and `Tests` lines, any `Errors` line, and every `x` row with its
   assertion message.
d. From the clone root `node docs/loops/t324s3/apply.cjs . docs/loops/t324s3/edits.txt` (paste output). In
   `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code
   and any error lines.
e. Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/pipelines tests/shared tests/end-fix tests/t262-part2.test.ts tests/t003-session-proof.test.ts tests/t276-session-trailer.test.ts tests/t294-small-fixes.test.ts tests/t048-r2b.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait; never
   the 10-minute default). Paste the `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and
   the assertion message. Red rows alongside T-292's `Timeout calling onTaskUpdate` or a timeout: re-run each such file
   alone up to 3 times and paste every run. Known flaky under QA PC load: `hub-presence.test.ts`,
   `state-import-r4.test.ts`, `end-fix-q3.test.ts`.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary","retirements"`
   and paste every line.
h. Mutants, on the applied tree. Back up once:
   `Copy-Item open-brain/src/pipelines/session-start/greeting-outcome.ts "$env:TEMP\t324s3-go.bak"` and
   `Copy-Item open-brain/src/cli-session-end.ts "$env:TEMP\t324s3-se.bak"`. For each of m1..m5:
   `node docs/loops/t324s3/apply.cjs . docs/loops/t324s3/<m>.txt` (paste output); run ONLY
   `npx vitest run tests/pipelines/session-start/t324-s3-trigger-counts.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and every `x` row; restore BOTH files from the backups with `Copy-Item ... -Force`. Never use
   `git checkout` to restore here. After m5's restore, run the five files once more and paste the `Tests` line.

## Predicted

- c: all 6 rows of t324-s3-trigger-counts.test.ts red (R1, R2: `go.triggerCounts is not a function`; R3: the keys
  with extras lack `session_uuid`/`trigger`; R4, W3, W4: the row has no `session_uuid`); the other four files green.
- d: `APPLIED 9 edits to 2 files`; all three exit 0.
- e and h's final run: 0 failed.
- f: 0 failed, subject to the re-run rule.
- g: `module-boundary [pass]`, `retirements [pass]`.
- m1 -> R1 and W3. m2 -> W4. m3 -> W3. m4 -> R3. m5 -> R1.

## Reply

First line: `READY sim-t324s3 <HEAD sha8> ALL PASS` only if every prediction held, f has 0 rows red on every run
alone, and g shows both `[pass]`. Otherwise `READY sim-t324s3 <HEAD sha8> MISMATCH` and list each step that differed,
with the full assertion message of every red row. Every number is pasted output, with its command.
