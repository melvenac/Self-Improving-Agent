# QA 243: Loop 15 slice four, step 2 r3

**By:** Atlas (planner), 2026-10-01, record session 155. **Candidate:** `36a0fc282e328d8bb32ffb4ccd6e875c95d3dd8d`
on `origin/loop/15-slice-4-step2`. **r2:** `779be4d6`, REJECTED by QA 242 (`bd18167f`) on S4-9.3 (P4 timeout,
D-083). **Base for red:** `2448a6ea`. **Builder:** sia-builder, Claude Code Sonnet 5.5. **QA runs on Opus** (D-068).
**Make no live Jev call.** r3 is test-side only: `git diff 779be4d6 36a0fc28 -- open-brain/src` is empty. Confirm it.

## What to read

1. `docs/loops/loop-15-slice-4-step2-r3-dispatch.md`: items 1 to 3 and the rulings (D-083). **This is what you
   score.**
2. QA 242's report on `origin/qa/s4-step2-r2-report`. **Every row it scored met must still be met.**
3. The r3 section of `docs/loops/loop-15-slice-4-step2-developer-handoff.md` at the candidate.

## Rows to score

- **R3-1, timeouts by class.**
  - Every top-level `describe` in every `s4-*.test.ts` carries a timeout.
  - The guard `s4-timeouts.test.ts` fires on a planted spawning file with no timeout. **Plant it in a committed file
    yourself.**
  - Try at least two spellings the guard might miss: a spawn through an imported helper, and a timeout given only on
    an inner `it`.
- **R3-2, the behavioural S4-6d.3 test (`s4-g7-merge` V1).**
  - QA 242's r02 and r03 go red on the builder's tests.
  - **Judge the stated limit:** "V1 only catches wiring that reads a record from a path it plants one at".
    - Write one mutant that wires a `G_done` read from a path V1 does NOT plant at, for example the records directory
      under a different name, or a glob over `docs/loops/**/G_done*`.
    - Say whether it survives. A survivor is a gap, not a blocker, unless it is a path a runner actually writes to.
- **R3-3:** #187's disclosure line names `runtime.ts`.
- **S4-9.3, as D-083 reads it.** Run the full suite at base and at candidate on this machine.
  - Pass: **no failed test** at the candidate that does not fail at the base.
  - An unattributed `[vitest-worker]` RPC error that also occurs at the base is environmental and is not a failed test.
  - Quote both counts and the exit codes, and list every failed test by name.
  - **Run the candidate's full suite twice**, because P4 was timing-dependent.
- **Regression:** the builder's 19, QA 240's q01 to q13 and QA 242's r01 and r04 to r07 are all still red. Run them
  sequentially.

## Rules (headless Claude Code; Plumb, Linux)

- You are **QA 243**. Your prefix is `s4-step2-r3`. Push ONLY `qa/s4-step2-r3-*` branches, and only through
  `node docs/loops/qa-243/push-qa.mjs <branch>`, run from `~/qa-scratch/qa243-wt`.
- **CI:** if `gh` works, push `qa/s4-step2-r3-ci-candidate` and quote the run id, headSha, run conclusion and `test`
  job conclusion. Use at most 1 run. If `gh` does not work, make 0 runs and say so.
- Keep mutants local, with diffs under `docs/loops/qa-243/mutants/`.
- Commit `docs/loops/loop-15-slice-4-step2-r3-qa-report.md` with its `.E_t.json` on `qa/s4-step2-r3-report`. The last
  line is exactly `QA-243: REPORT COMPLETE`.
- If you are blocked, write it in "Open for the planner" and finish the report.
