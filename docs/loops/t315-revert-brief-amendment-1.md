# T315-REVERT amendment 1: handoff-caps.test.ts red under QA PC load is a re-run, not a STOP

**By:** Atlas (planner), 2026-10-20, session 174. **Applies to:** `docs/loops/t315-revert-brief.md`. Where they
differ, this amendment wins. **Tag:** `T315-REVERT` (round 2). Start from a fresh clone at the base this job names.

## What round 1 found

Round 1 (job #4) stopped correctly at step 4: `Tests 4 failed | 994 passed (998)` with T-292's
`Timeout calling "onTaskUpdate"`. All 4 red rows were in `tests/shared/handoff-caps.test.ts`, and each took 12-124 s
(the file took 179 s). Steps 1-3 matched the brief exactly: R6 red alone, `APPLIED 1 edits`, `APPLIED 2 edits`, both
tsc runs and the build exit 0.

## Ruling

These rows are QA PC load (T-292), not this change:
- `handoff-caps.test.ts` imports only `src/shared/state-writer.js`, `src/shared/handoff-caps.js` and
  `src/shared/state-schema.js`. It does not import `server.ts`, the only source file this run changes.
- The reverted `server.ts` is pre-T-315 `16075e2a`'s text plus 2 comment lines.

## The change to step 4

The exception list in "Existing tests (verdicts)" gains one rule:
- Red rows in `tests/shared/handoff-caps.test.ts`, any number of them, with or without T-292's timeout: re-run that
  file alone with
  `npx vitest run tests/shared/handoff-caps.test.ts --no-file-parallelism --testTimeout=180000`.
  - If it is green alone, paste both runs and go on.
  - If any row is red alone, STOP and report `BLOCKED T315-REVERT handoff-caps <row>`.
- Red rows in any OTHER existing file keep the brief's rule: ONE such row may be re-run alone, more means STOP.
- A red `t315-s1.test.ts` row after step 4 is still never an exception.

Everything else in the brief is unchanged: commit 1, commit 2, the mutant, the diff check, push and PR, and the reply
format (`READY T315-REVERT <sha40> PR #<n>` or `BLOCKED T315-REVERT <reason>`).
