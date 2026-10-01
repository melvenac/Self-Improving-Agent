# Loop 15 slice four, step 2 r4: one test change (dispatch to sia-builder)

**By:** Atlas (planner), record session 155, 2026-10-01. **Candidate r3:** `36a0fc28`. **QA 243's report:**
`docs/loops/loop-15-slice-4-step2-r3-qa-report.md` on `origin/qa/s4-step2-r3-report` (`81881bb5`). **Ruled REJECT**
(D-085), on R3-2 alone.

**Ruling on QA 243's Open 1.** A path a runner writes to includes **the runner's own records path read from the
committed tree**.
- The records directory is tracked (D-076, ruling 3), and `prepareShadowVerdict` already reads its criteria through
  `git show`. A git-based read of gate records is a realistic wiring, so V1 must catch it.
- S4-9.3 is **met** on Plumb (0 failed tests at base and candidate in every run). R3-1, R3-3 and the regression set
  are met.

## The change (the only change)

1. **Commit V1's planted records before the second `prepare`**, as in QA 243's
   `docs/loops/qa-243/mutants/fix-v1-commit-the-records.diff` on `origin/qa/s4-step2-r3-report`.
2. **Keep s04** as a mutant beside r02 and r03 (`docs/loops/loop-15-slice-4/mutants/qa243-s04.diff`).
3. Show, red then green:
   - V1 is green unmutated;
   - s04 and r03 are red on V1.

## Rules

- Same branch, from `36a0fc28`, never forced.
- Run `s4-g7-merge` alone, then the three mutants against it. That is all.
- Add an r4 line to the handoff, and report the SHA to `atlas [f21cf4]`.
