# SIM T332: the evidence report, shadow only (option C) - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-31, session 175. **Task:** T-332 (RSI research idea #3, evidence-gated lesson
writes), option C of `docs/loops/t332-measure.md` (merged in #1078): a read-only report, with no gate, no schema
change and no recall change. **Tag:** `sim-t332`. **Base:** the START sha the launcher names (origin/master
`43da49a9` or later, containing this file). **Authority:** clark's 10-31 relay of Aaron ("pick up any downstream work
that's available"). Turning the shadow into a gate is Aaron's ruling, not this task's (measure section 5).

```text
IMPACT-TARGETS: runMemoryCommand (cli-memory.ts; caller cli.ts), COMMAND_SPECS (cli-spec.ts; callers cli.ts,
cli-memory.ts, tests/shared/cli-args.test.ts)
```

## What is measured

The design is one new module and a CLI wiring:

1. **Module:** `open-brain/src/pipelines/store/evidence-report.ts` (new; memory side, since `pipelines/store/` is in
   MEMORY_SIDE). `extractPointers(text)` is pure and finds sha, tests/ path, docs/loops/ path, CI run id and PR number,
   each once. UUIDs are removed before the sha scan, and a sha needs a digit and a letter. `isEvidenced(pointers,
   resolver)` is the strict gate: a sha, path or run id that the INJECTED resolver says exists. A PR number never counts
   and is reported apart as weak.
2. **Report:** `evidenceReport(dbPath, resolver, {asOf, days})` opens the store through `openStoreReadOnly`
   (`{readonly: true, fileMustExist: true}`). It counts live entries, evidenced and PR-only, by month and in the window.
   It also counts the trigger injections in the window (fires in state `injected`, per id per fire), and how many and
   which of them a gate would have withheld. The window is inclusive at both ends. `renderEvidenceReport` prints it.
3. **CLI:** `open-brain evidence-report [--db <path>] [--days <n>] [--as-of <iso>] [--repo <dir>]`, routed through the
   existing `cli.ts -> cli-memory.ts` lazy crossing, so `DYNAMIC_MEMORY_LOADS` stays at 4. The CLI resolver is
   `gitResolver(repo)`. A sha resolves by `git cat-file -e <sha>^{commit}`, and a path when HEAD's tree holds it
   (`ls-tree --full-tree`). There is no network, so no run resolver; the report says so.
4. **Not in this task:** any gate, any column, any change to `queryStore`, `ob_recall`, `ob_store` or session end.

Files under `docs/loops/t332/`:
- `evidence-report.ts`: new file, goes to `open-brain/src/pipelines/store/evidence-report.ts`.
- `t332-evidence-report.test.ts`: new file, goes to `open-brain/tests/pipelines/store/t332-evidence-report.test.ts`.
  Rows E1-E7. Every row builds its own temp store; none opens the live one. E1-E6 inject a fake resolver. E7 spawns
  the CLI with `--repo` set to the clone's open-brain/; it needs a git checkout, not any particular sha.
- `edits.txt`: 6 edits in 4 files. `cli.ts` 2 (the forward's name list, the usage line); `cli-spec.ts` 1 (the
  `evidenceReport` spec); `cli-memory.ts` 1 (the command body); `tests/shared/cli-args.test.ts` 2 (the walked-names
  list and the usage-line table, which pin every command by name).
- `m1.txt` (a PR number counts as evidence), `m2.txt` (the store opened without `readonly`), `m3.txt` (the window's
  start becomes exclusive). `apply.cjs` is the same applier as t331.

Planner pre-check (desktop, no npm, vitest, tsc or build). On a scratch export of origin/master `53534348` (the four
edited files are unchanged at `43da49a9`), with the two new files copied in, `apply.cjs` printed
`APPLIED 6 edits to 4 files`, and m1, m2, m3 each printed `APPLIED 1 edits to 1 files`. The rows were run under tsx
with a stand-in for vitest's `describe/it/expect`, against the main checkout's node_modules. The results: 7 of 7 pass
on the applied tree; m1 fails E2, E3, E6; m2 fails E4; m3 fails E5. With the module absent, the file fails to load
(`ERR_MODULE_NOT_FOUND ... evidence-report.js`). The edited COMMAND_SPECS names equal both name lists in
cli-args.test.ts (21 and 21), and `checkModuleBoundary` on the applied tree passed with 4 dynamic loads. The stand-in
is not vitest, and tsc was not run: those are steps d and e.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/shared/cli-args.test.ts` "walks at least the fifteen commands" | red without the edit; green with it | It `toEqual`s every spec name; edit 5 adds `evidence-report` in sort order. |
| `tests/shared/cli-args.test.ts` "names a usage line for every command" | red without the edit; green with it | It compares `LINES` to the spec names; edit 6 adds the row. |
| `tests/shared/cli-args.test.ts` per-flag and per-line rows | stays green | All four flags are `both`-form values, and the usage line documents exactly those four. |
| `tests/t261-s2.test.ts` R1-R4 | stays green | Still exactly 4 dynamic loads; the new import is memory to memory (cli-memory.ts to pipelines/store/). |
| `tests/pipelines/store/*.test.ts` (index, t022, t266) | stays green | `store()` and `indexKnowledge` are untouched. |
| `tests/t294-small-fixes.test.ts` trigger-keys K1/K1b | stays green | It goes through the same forward; that branch is unchanged. |
| `tests/pipelines/sync/` module-boundary rows | stays green | The new module is under `pipelines/store/`, which is memory side. |

None of the four edited files is a retirements referrer, so `retirements-live` is not added.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`, then `node -e "require('better-sqlite3')"`
   (on "Could not locate the bindings file" run `npm rebuild better-sqlite3` and say so).
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t332/`.
c. Baseline: `Copy-Item docs/loops/t332/t332-evidence-report.test.ts open-brain/tests/pipelines/store/t332-evidence-report.test.ts`.
   In `open-brain`: `npx vitest run tests/pipelines/store/t332-evidence-report.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste the `Test Files` and `Tests` lines and the load error, verbatim.
d. `Copy-Item docs/loops/t332/evidence-report.ts open-brain/src/pipelines/store/evidence-report.ts`. From the clone root
   `node docs/loops/t332/apply.cjs . docs/loops/t332/edits.txt` (paste output). In `open-brain`: `npx tsc --noEmit`,
   `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error lines.
e. In `open-brain`: the new file again (0 failed), then
   `npx vitest run tests/shared/cli-args.test.ts tests/t261-s2.test.ts tests/pipelines/store tests/t294-small-fixes.test.ts tests/pipelines/sync --no-file-parallelism --testTimeout=180000`
   (30-minute cap). Paste `Test Files`, `Tests`, any `Errors` line and every `x` row. Red rows alongside T-292's
   `Timeout calling onTaskUpdate` or hook timeouts (known flaky: t159-fast-path N3, hub-presence, end-fix-q3): re-run
   each such file alone up to 3 times and paste every run.
f. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`;
   paste every line. Then `node open-brain/build/cli.js evidence-report --db "$env:TEMP\no-such-t332.db"`; paste
   the exit code (`$LASTEXITCODE`) and the stderr line, and `Test-Path "$env:TEMP\no-such-t332.db"` (must be False).
g. Mutants, on the applied tree. Back up once:
   `Copy-Item open-brain/src/pipelines/store/evidence-report.ts "$env:TEMP\t332-er.bak" -Force`. For each of m1..m3:
   `node docs/loops/t332/apply.cjs . docs/loops/t332/<m>.txt` (paste output); in `open-brain` `npx tsc --noEmit`
   (paste exit code), then ONLY `npx vitest run tests/pipelines/store/t332-evidence-report.test.ts --no-file-parallelism`;
   paste the `Tests` line and every `x` row; restore with
   `Copy-Item "$env:TEMP\t332-er.bak" open-brain/src/pipelines/store/evidence-report.ts -Force`. Never use
   `git checkout` to restore. After m3's restore, run the new file once more and paste the `Tests` line.

## Predicted

- c: the file fails to LOAD on the missing module (`Failed to load url ../../../src/pipelines/store/evidence-report.js`
  or `Cannot find module`), so `Test Files 1 failed (1)` and no row runs. That is the red-first for all of E1-E7. If
  instead rows run and fail one by one, report it and paste each.
- d: `APPLIED 6 edits to 4 files`; all three exit 0.
- e: 0 failed (subject to the flaky rule).
- f: `module-boundary [pass]` with 4 dynamic memory loads, `retirements [pass]`. The missing store gives exit 1,
  stderr `evidence-report refused: unable to open database file` (better-sqlite3's text; seen in the pre-check under
  tsx), and `Test-Path` False.
- g: each mutant's tsc exits 0. m1 -> E2, E3, E6 (a PR-only entry counts: E2's first assertion, E3's evidenced 3 and
  prOnly 0, and E6's "PR number only 1" text). m2 -> E4 only (`db.readonly` false). m3 -> E5 only (the fire and the
  entry exactly at the window start are dropped: windowEntries 0, injections 1).

## Reply

First line: `READY sim-t332 <HEAD sha8> ALL PASS` only if every prediction held and e has 0 rows red alone. Otherwise
`READY sim-t332 <HEAD sha8> MISMATCH`, listing each step that differed with the full assertion message of every red
row. Every number is pasted output, with its command.

## After merge (not this run)

sia-rebuild. Live, read-only: `open-brain evidence-report --as-of 2026-11-01T01:36:24.869Z --days 30 --repo
C:/Users/melve/Projects/Self-Improving-Agent`. It should land near the measure's strict numbers: 80 of 924 entries
and 84 of 1,441 injections. It will differ a little, because the CLI resolves shas in one repo where the measure
checked 25, and it has no run resolver. Report the difference rather than tuning toward it. Any gate is Aaron's
ruling (measure section 5) and waits on T-331's withheld arm.
