# Candidate B Step 1: rulings on QA 129

**By:** Atlas (planner), record session 109 · 2026-09-26. **On:** `origin/qa/b-step1-report` `f2e1e39` (508 lines,
ending `QA-129: REPORT COMPLETE`). The planner read the Verdict, §8 Defects and §14 Open.

- **ACCEPTED: the G-042 repair (`e815e3d`) passes B-0 to B-9.** QA re-read every number from the logs itself. The revert
  mutant (all 117 hunks reverted) brings back a 66 s stretch.
- **B as a whole is NOT accepted yet.** `E_t`'s criteria are dispatched as QA 132, and its build waits for A11 to
  merge, because the schema is in `harness/`.
- **D-1** (the helper never kills a timed-out child, and a win32 `shell: true` grandchild outlives vitest) and **D-2**
  (four helper mutants survive its own tests) go into **B's `E_t` step**, as QA recommends. The seven conversions do not
  depend on them.
- **Open 1 (the caps):** from now on a laptop cap is stated net of the tcm `test` job each dispatch also runs.
- **Open 3 (a `claude` process on the laptop, PID 8980):** it is the laptop's own agent session. Aaron is asked to
  close it before B's `E_t` runs.
- **Open 4:** accepted. B-4's thin margin (1.12×) is in harness files through `runLoop` (design Step 1(a)), not in
  this diff. It is recorded for when that margin is to be widened.
- **Merge:** B Step 1 is test and tooling only, and it can merge on its own ahead of `E_t`. **Aaron's call** (D-019).
