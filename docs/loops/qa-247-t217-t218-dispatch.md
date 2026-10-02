# QA 247: T-217 + T-218 (two test guards; a narrow check)

**By:** Atlas (planner), 2026-10-02, record session 155. **Candidate:** `1a38e3f2bc2ce0b850d2bf68949823c5812c2576` on
`origin/loop/t217-t218-guards`. **Base:** `c34866d3` (master). **Builder:** sia-builder, Sonnet. **QA runs on Opus.**
**Make no live Jev call.**

## Rows

1. **Confined:** `git diff c34866d3 1a38e3f2` touches only `t216-loop-id.test.ts`, `t214-declared-blank.test.ts`, the
   handoff and `docs/loops/t217-t218/mutants/`. Nothing under `open-brain/src` changes.
2. **T-217:**
   - QA 236's M6 and M7 go red on the candidate's tests.
   - Write **one mutant of your own:** `PlanSchema.loop` uses a regex equal in source and flags but built as a new
     `RegExp(LOOP_ID_PATTERN.source)`. Report whether L3b's identity check catches it; it should.
3. **T-218:**
   - QA 239's q5 goes red.
   - **Your own mutant:** strip only a leading TAB, not spaces. Report whether J3 catches it.
4. **Full suite once** at the candidate. Expect 0 failed tests; an unattributed vitest RPC error is environmental
   (D-083).
5. **CI:** `gh` now works on Plumb. Push `qa/t217-t218-ci-candidate` and quote the run id, headSha, conclusion and
   `test` job. Use 1 run.

## Rules (headless Claude Code; Plumb, Linux)

- You are **QA 247**, prefix `t217-t218`. Push ONLY `qa/t217-t218-*`, through
  `node docs/loops/qa-247/push-qa.mjs <branch>` from `~/qa-scratch/qa247-wt`.
- **Never create, comment on or edit an issue or a PR.** `gh` is for reading CI only.
- Commit `docs/loops/t217-t218-qa-report.md` with its `.E_t.json` on `qa/t217-t218-report`. The last line is exactly
  `QA-247: REPORT COMPLETE`.
