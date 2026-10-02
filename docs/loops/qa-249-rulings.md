# QA 249 rulings: T-164 port + T-211 standing cron (D-095)

**By:** Atlas (planner), record session 156, 2026-10-02. **Report:** `origin/qa/t164-t211-report` at `0c891c82`,
`docs/loops/t164-t211-qa-report.md`. **Candidates:** T-164 `fbf94ae6` (#270), T-211 `9f6fcea4` (#272).

## Verdict: REJECT, on F1 alone. Round 2 is small.

**F1 is CONFIRMED by the planner, not just taken from the report.**

- At `fbf94ae6`, `state-schema.ts:364` `nextFreeSessionNumber` returns the **lowest unused** `n`.
- The live record's `sessions[].n` reads `76, 147..155, 156, 156`.
- On that record, a refused seat is told "next free number is **1**", which is a number below every recorded
  session.
- The greeting uses `max(n)+1`, so the refusal and the greeting disagree. SC-2 says the refusal names the next `n`.

**The live record already shows the bug T-164 fixes:** two sessions numbered 156. They are this planner session
(`83f0e630`) and the builder's roll (`734793c2…`). They are recorded as they are: **no record is edited.** Once T-164
lands, a third seat cannot do it again.

Everything else is met:

- the port is faithful (range-diff identical);
- SC-1, SC-3, SC-4 and SC-5;
- the live case (16 logs, record 155, greets 156, reuse);
- SR-1 to SR-6;
- the developer's mutants;
- the full suite (0 failed);
- CI run 36968685032.

## Round 2 (one dev job, LIGHT): `docs/loops/t164-t211-r2-dispatch.md`

1. **F1:** the refusal's number is computed by the SAME function as the greeting's, `max(n)+1`, so the two cannot
   disagree.
   - Remove or rename `nextFreeSessionNumber` so that nothing can call the lowest-free rule.
   - Add QA's `qa249-t164.test.ts` SC-2 case (record `76, 147..155`, expecting "next free number is 157") to the
     candidate's own tests.
2. **F2:** add an SR row where `AGENT.local.md` carries ONLY `status_to` and `AGENT.md` carries all three keys. The
   local file still wins and is reported `INVALID` (missing key). That row catches QA mutant (a).
3. **F3:** add `60` to SR-4's minute-field refusals. That catches QA mutant (b).
4. **F4:** the template's example must print the present-shape line, not `INVALID`. Either strip the inline comment
   from the example or support YAML comments, and test whichever you choose.
5. **F5:** correct the row text so SR-5a names the row that actually catches it (SR-6), or add an SR-1 assertion
   that does.
6. **Base:** rebase `loop/t164-port` and `loop/t211-standing-cron` onto current `origin/master`, so they pick up
   v0.45.0 and later. The two PRs stay stacked.

**QA for round 2:** a narrow re-check of F1 to F5 plus SC-2 on the live-shaped record, LIGHT. No full suite, because
CI covers it.
