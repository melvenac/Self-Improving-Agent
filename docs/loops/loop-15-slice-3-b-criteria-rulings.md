# Candidate B: rulings on QA 123's criteria

**By:** Atlas (planner), record session 109 · 2026-09-26. **On:** `origin/qa/b-criteria-report` `09482d7`,
`docs/loops/loop-15-slice-3-b-criteria.md` (383 lines, ending `QA-123: REPORT COMPLETE`). The planner read the
header, §1 (B-0 to B-9), §2, §4 and §7. It did not read §3's reasoning in detail, §5 or §6.

## Adopted: B-0 to B-9, as written, are candidate B's acceptance criteria

The two that decide the shape of the fix:
- **B-4:** every file's worst macrotask-free stretch stays under 30 s, in all six counted runs.
- **B-5:** the fix is the files yielding, not a worker cap. **QA measured the reason:** the cap alone is green and
  still fails B-4. On today's master (`be7ddfb` plus tools, RH, workers=2) `hook.test.ts` ran **61.6 s** without a
  macrotask and still exited 0 (36222301375, marked under E-4). The cap also costs 1.29–1.52 × the wall time (it
  fails B-7.3).

**B-6 is accepted as a correction to the design:** Step 1(a)'s runtime yields are NOT required. The worst file,
`hook.test.ts`, never enters `runLoop`. Its stretch is 12 `spawnSync('npx', ['tsx', HOOK])` calls in the test
harness. The fix is where the stretch is.

## Rulings on §7

1. **Base: frozen at dispatch, and named in the dispatch.** It is master at the moment B's developer is dispatched, and
   B-1 runs once on it. If that is still `be7ddfb`, 36221668780 is B-1's first R1 run.
2. **No worker cap in B (B-5.1).** A cap, if one is ever wanted, is its own change, and B-2 to B-4 must be shown with
   it removed. **`ci.yml`'s ordinary Windows step keeps `--maxWorkers=2` until B is accepted.** Then whether it goes is
   a separate ruling (QA's point 5: it hides G-042 in ordinary runs). Recorded.
3. **`E_t`'s schema change (R10) stays in B (D-036), and gets its own criteria.** This dispatch was for the G-042
   repair only. B's developer builds the G-042 repair first. **B is not accepted until `E_t`'s criteria exist and
   pass.** The planner dispatches QA to write them, a short run, once the design for R10 is read.
4. **The laptop's `CompatTelRunner` (E-4): Aaron's call.** Asked in session 109. The criteria discount and replace a
   run whose `TOP5` shows it (§1's counted-run rule), so nothing waits on the answer.
5. **E-4, the loose baseline threshold** (8× looser than the handoff states): §1's rule now reads the `TOP5` lines
   itself, so a counted run is judged by what ran, not by the marker. **B's developer fixes the baseline step's
   threshold,** as a named hunk, not silently. B-0.1 allows it only as that named hunk, with QA's E-4 as the reason.

## Cost

About 13 laptop runs of 5–8 minutes each, plus tcm (QA's §2). **The laptop is B's for the whole scoring, and nobody
uses it.** Aaron is told when a batch starts.
