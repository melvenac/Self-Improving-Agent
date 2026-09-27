# Loop 15 slice three, candidate A13: dispatch to a FRESH, HEADLESS QA seat (record session 162)

**By:** Atlas (planner), record session 146 · 2026-09-27. **Runs from** `qa-queue.ps1` via `docs/loops/qa-162/drive.ps1`.
**Record the machine, and whether this process runs elevated with `SeBackupPrivilege` enabled.** Nobody is watching
live. Use `C:\qa-tmp` and `C:\qa-scratch`. The ONE full-suite run uses the default TEMP. Commit the report from a
separate worktree. Never write a live `state.json`.

## The candidate

- **Product `4b43410`**, frozen with its handoff at **`0d44374`** on `origin/loop/15-slice-3-candidate-a13`.
- Built on A12's `a69f07d`, by **Grok 4.7 in Cursor**, record 159.
- **The product diff against `a69f07d` is 10 lines in `configwatch.ts`:**
  - `kind` gains `"unobservable"`;
  - R90's branch pushes `<path> (absent at the open; cannot be lstat'd at close (<code>); not removed)` onto
    `unrestored`.

  Plus `configwatch-a13.test.ts`. The planner read the whole product diff, and ran `git merge-tree` against today's
  `origin/master`: clean.
- **CI on tcm:** red `36294235947` (`f712955`: the four R97 rows fail); green `36294470032` (CA-9 only, T-182). Mutants:
  - r95 `36294505899`: the push dropped, all four rows fail;
  - r96 `36294528231`: kind `modified`, all four rows fail.

## Score NARROWLY (rulings 21, `docs/loops/loop-15-slice-3-rulings-21.md`)

Score R95, R96, R97, the re-done R85 search, QA 149's rows, and regressions on QA 130's and QA 149's row sets.
**Nothing else is in scope.** O-1 (`baseText`) is not A13's.

## Check, not accept

1. **A12-1 is healed on tcm with a real chmod, and on win32 with the wrapped `lstat`.** Use QA 149's shapes, byte-exact
   from `qa/loop-15-slice-3-a12-probe` / `-probe2`: Q149-C1-HOOKS-ONLY, -SUBDIR-ONLY, -MOCK-HOOKS-ONLY and
   -MOCK-PLUS-CONFIG, and QA 130's Q130-R83-SUBDIR-NOSEARCH-PLANT. For each:
   - `gitAfterRole` is empty;
   - the message carries `FILE(S) COULD NOT BE PUT BACK` and "Recover by hand";
   - no "Every file was put back".
2. **R96:** search every consumer of `ConfigChange.kind` yourself (the handoff lists them). Is there a switch,
   exhaustive map, count or serializer that treats a fourth value wrongly, or that `tsc` would not catch?
3. **R97:** the four developer rows assert `gitAfterRole` AND the summary sentence. Re-apply QA 149's `FIX-q149`
   inverse (drop the push) and your own mutant of the note text; each must go red.
4. **The note is true:** the planted file is still in the tree when the note says "not removed". Check that the note
   never fires for a path that WAS removed or restored.
5. **The re-done R85 search** (the handoff's table, with its `unrestored` column): check it against your own search
   of `configwatch.ts`.
6. **Regressions:** QA 130's full row set and QA 149's rows, byte-exact. Run the full suite once on the default TEMP.
7. **Your own mutants,** at least one per ruling.

## CI and authority

- tcm, at most **8** runs. **No laptop (`windows=true`) CI.**
- **Push only `qa/loop-15-slice-3-a13-*`, through `node docs/loops/qa-162/push-qa.mjs`.**
- Never: master, merges, PRs, tags, other seats' branches, or this machine's configuration.

## The report

- **Path:** `docs/loops/loop-15-slice-3-qa-report-a13.md`.
- Order: the verdict first, then checks 1–7 with evidence, mutants, the full suite and CI, what could not be verified,
  defects, disagreements, error entries, reproduction, and "Open for the planner".
- Commit to `qa/loop-15-slice-3-a13-report`. **The LAST line is exactly `QA-162: REPORT COMPLETE`.** No `/end`.
