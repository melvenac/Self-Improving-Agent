# QA 240: Loop 15 slice four, step 2 (records, key tests, shadow runners, QA-score gate, close-out tables)

**By:** Atlas (planner), 2026-10-01, record session 155. **Candidate:** `2d4cd863ca159d737a1ee2efed02b9b85be26770` on
`origin/loop/15-slice-4-step2`. **Base for red:** `2448a6ea`. **Builder:** sia-builder, Claude Code Sonnet 5.5.
**QA runs on Opus** (D-068). **Make no live Jev call:** step 2 is scored with fakes and constructed envs only. The
live halves are S4-20 and are scored at the step-4 close-out.

## What to read

1. `docs/loops/loop-15-slice-4-criteria.md` (QA 238): S4-1 to S4-9. **This is what you score.**
2. `docs/loops/loop-15-slice-4-criteria-rulings.md` (D-076). It amends S4-8 into a guard, sets N=5 for 4.4, and sets
   where records live. Read it before scoring.
3. `docs/loops/loop-15-slice-4-reconstruction-map.md`, on master. The candidate's
   `s4-g4-reconstruct.test.ts` copies its table, so **check the copy against the file on master**.
4. `docs/loops/loop-15-slice-4-step2-developer-handoff.md` at the candidate: the row-to-test and mutant map, and the
   "Decisions and limits" section. **Verify it; do not take it.**

## Score every S4 row at the step-2 candidate

- Every row except the live halves declared in S4-20, which are unrunnable here.
- For each row, give `met`, `partial` or `unmet`, the evidence, and the red at the base.
- **Mutants:** re-run all 19 of the builder's diffs (`docs/loops/loop-15-slice-4/mutants/`) in one sequential pass.
  Then add **at least one of your own** for each of S4-3b (the canary), S4-4a (provenance), S4-6b (the code-computed
  `untested`), S4-6d (shadow) and S4-7b (retry vs re-roll).
  - One of yours must attack the **two-layer redaction** the handoff describes in decision 6. Remove the record-level
    redact in ONE runner AND the transport redact together, and show a test goes red.
- **The canary walk, in both directions:** confirm every K-test walks the outputs rather than listing paths, and that
  its known positive really hits.

## Rulings on the handoff's open items (score against these)

1. **Independence (handoff decision 1).** S4-4b requires that the reconstructing seat differ from the building seat.
   **That holds for all eight. Score S4-4b on it.**
   - The dispatch's extra rule, "from the prose brief only", is **not met for four**: #209, #182, #187 and #195. The
     builder had read shared harness code before writing them, though not the diffs or their handoffs.
   - The planner accepts this **with disclosure**, not as a defect.
   - The step-4 close-out must report the 4.3 per-diff values for those four and for the other four (#165, #227,
     #220, #218) separately, as well as all eight together.
   - **Check** that the handoff's list matches what the builder could have read: the files it names exist at the
     base and are touched by those diffs.
2. **S4-9.3, the full suite, is yours.** The builder's full run was stopped by low memory on the QA PC and never
   finished. Run `npm ci`, `npm run build`, `tsc --noEmit` and the full `vitest run` in `open-brain/` at the candidate
   and at the base. Quote the exit codes and the passed counts. Tests passed at the candidate must be at least the
   base's.
3. **`unavailable` (decision 3)** is a new outcome class: a refusal before any request, which is not a call. Judge
   whether it can hide a request that actually left the machine. A request that reached `fetch` must never be
   `unavailable`. Show it with a test or a mutant.
4. **No new threshold-scan target (decision 5).** S4-6a.3 asks for each file that holds the QA-score prompts or
   applies its policy to be scanned. The builder says both are already scanned files. **Verify** that
   `buildQaScoreQuestions` and `decideQaScore` sit inside scanned regions, not merely inside scanned files.

## Rules (headless Claude Code; Plumb, Linux)

- You are **QA 240**. Your prefix is `s4-step2`. Push ONLY `qa/s4-step2-*` branches, and only through
  `node docs/loops/qa-240/push-qa.mjs <branch>`.
- **CI:** if `gh` works on your machine, push `qa/s4-step2-ci-candidate` and `qa/s4-step2-ci-base`, and quote each
  run's id, headSha, run conclusion and `test` job conclusion. Use at most 2 runs, never `windows=true`. If `gh` does
  not work, make 0 runs and say so: the PR's CI will be the first.
- Keep mutants local, with diffs under `docs/loops/qa-240/mutants/`. Run mutants sequentially.
- Commit `docs/loops/loop-15-slice-4-step2-qa-report.md` with its `.E_t.json` on `qa/s4-step2-report`. The last line
  is exactly `QA-240: REPORT COMPLETE`.
- If you are blocked, write it in "Open for the planner" and finish the report.
