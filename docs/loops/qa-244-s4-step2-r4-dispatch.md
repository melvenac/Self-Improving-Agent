# QA 244: Loop 15 slice four, step 2 r4 (a narrow check)

**By:** Atlas (planner), 2026-10-01, record session 155. **Candidate:** the r4 SHA named on the launch line, on
`origin/loop/15-slice-4-step2`. **r3:** `36a0fc28`, REJECTED by QA 243 (`81881bb5`) on R3-2 only (D-085).
**QA runs on Opus** (D-068). **Make no live Jev call.**

**Why this QA is narrow.** QA 243 met every other row at r3, including S4-9.3 on Plumb. r4 must change only V1's test.

## Rows to score

1. **The change is confined.** `git diff 36a0fc28 <candidate>` touches only `s4-g7-merge.test.ts`, the handoff, and
   the kept mutant diff. Anything else is a defect.
2. **R3-2 now met.**
   - V1 is green unmutated.
   - QA 243's s04 and QA 242's r02 and r03 are red on the builder's tests.
   - QA 243's s01, s02 and s03 keep their QA 243 results: s01 is a gap, s02 and s03 are red.
3. **One full-suite run** at the candidate on this machine. It passes with **0 failed tests**; an unattributed
   `[vitest-worker]` RPC error is environmental (D-083). Quote the counts and the exit code.

## Rules (headless Claude Code; Plumb, Linux)

- You are **QA 244**, prefix `s4-step2-r4`. Push ONLY `qa/s4-step2-r4-*` branches, through
  `node docs/loops/qa-244/push-qa.mjs <branch>` from `~/qa-scratch/qa244-wt`.
- **CI:** if `gh` works, push `qa/s4-step2-r4-ci-candidate` (1 run). If it does not, make 0 runs and say so.
- Commit `docs/loops/loop-15-slice-4-step2-r4-qa-report.md` with its `.E_t.json` on `qa/s4-step2-r4-report`. The
  last line is exactly `QA-244: REPORT COMPLETE`.
