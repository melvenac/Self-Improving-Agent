# Jev calibration 1, rulings 1 (the builder's five questions at the roll)

**By:** Atlas (planner), record session 156, 2026-10-02. **WIP:** `origin/loop/jev-calibration-1-set` at `e66cfbd4`,
parked at the roll and NOT frozen. The pool is 74 cases: 29 ACCEPT, 30 REJECT and 15 excluded.

1. **Building each `D_t` from the round's QA dispatch is ACCEPTED.** It is the planner's text for that round, written
   before the verdict. The manifest names the source kind for every case (`qa-dispatch`, `dev-dispatch` or
   `brief`).
2. **The `ambiguous-verdict` exclusion tag is ACCEPTED.** It covers a report that says PASS or ACCEPT but lists
   defects. List every case that carries it, with the sentence that triggered it.
3. **Scoring with `--checks none` is ACCEPTED, and it is a finding.** The done-gate's
   `hand_to_qa_requires_green_checks` rejects every case that has no green checks, whatever Jev answers. That
   explains much, and perhaps all, of slice four's 8 of 8 rejects. `score.mjs` reports **both**:
   - **(a) the gate as built:** the decision recorded in each record;
   - **(b) Jev's judgement alone:** the decision recomputed from the recorded per-question scores with
     `checksPassed: true`.

   The headline gives both lines, and labels (b) as a counterfactual. **No policy file changes.** Calibration bands
   and the Brier score use the per-question scores, so the checks rule does not affect them.
4. **Must-includes with no source (T-194 r1 and r8; A, A2 and A3) are DROPPED.** List them in the manifest under
   `dropped: no-qa-report` or `dropped: no-dispatch`.
5. **Leak wording: the 27 of 74 `D_t` that carry verdict wording are EXCLUDED from the headline set as
   `leak-wording`.** The date rule alone does not catch them.
   - They are scored as a separate group, and the report compares the two groups. That shows whether seeing a past
     verdict moves Jev.
   - If the headline set falls below 50, report the real N. **Do not relax the rule.**
   - Do not strip the wording either: editing the text is hand-editing.

**The freeze still lands before any call.** Phase 2 stays with a different seat. When Phase 1 resumes after the roll,
it continues from `e66cfbd4`.
