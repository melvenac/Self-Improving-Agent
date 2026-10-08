# STANDING-BUDGET: standing rules fit the budgeted briefing

**By:** Atlas (planner), session 165, 2026-10-08. **Ruled by:** clark (coordinator, SG-1/D-135), 2026-10-08, on the
planner's proposal. It is a rendering detail inside E3/T-236, so it needs no word from Aaron. **Size:** LIGHT. Do not take
the QA PC's HEAVY lease: rivet's A2A L19 fix-1 has priority there. **Base:** `origin/master` at the SHA named in the
dispatch turn. **Branch:** `loop/standing-budget`. **PR:** its own small PR to master. Do not fold it into BRIEFING-FIX.

## The bug

PR #530 tags 20 decisions `standing: true` (E4). Its CI run 37850957063 fails one test:
`tests/pipelines/session-start/missing-handoff.test.ts:215` ("the budget still holds with the notice on and a pick-up at
its cap") reports `expected 37 to be less than or equal to 30`.

There are two causes, and both must be fixed:

1. `renderBudgeted` (`open-brain/src/pipelines/session-start/briefing.ts:230`) pushes `standingRulesLines(s)`. That is
   FLEET-AE E3's list: a blank line, a header, and one line per rule, **never capped**. The budgeted layout has a
   30-line / 4096-char budget (`BRIEFING_BUDGET`), so any standing rule at all eats into it without bound.
2. The test builds its state with `stateWith` → `readRepoRecord()`, the **live** `.agents/state.json`. So a records-only
   change (tagging decisions) can fail a code test. A test of the layout must not depend on what the live record holds.

## The ruling (do exactly this)

1. **Budgeted layout only:** standing rules render as **ONE line**, newest first, ids only:
   `STANDING RULES (N): D-137 D-135 D-130 …`
   If the ids would overflow the line, cut whole ids (never half an id) and end with `+K more`, where K is the number of
   ids not shown. Choose a char cap for the line and name it as a constant beside `CAPS`. When there are no standing
   rules, print **no line**, not `(0)`.
2. **The legacy layout is unchanged:** `renderBriefing`'s default path keeps the full list from `standingRulesLines`
   (briefing.ts:124). SIA's own greeting uses that layout, and it was verified to render all 20 rules on 2026-10-08.
3. **Tests:**
   - `stateWith` in `missing-handoff.test.ts` strips `standing` from every decision it copies. Check whether any other
     test reads `readRepoRecord()` and then renders a briefing, and fix those the same way. **List each file you checked
     in the report.**
   - A new test renders the budgeted layout's worst case **with N standing rules**, where N is large enough to force the
     `+K more` cut (for example 60). It asserts `lines <= BRIEFING_BUDGET.lines` and `chars <= BRIEFING_BUDGET.chars`,
     that the standing section is exactly one line, and that the line ends `+K more` with the right K.
   - A test where every id fits: no `+K more`, all N ids present, newest first.
   - A test with zero standing rules: no STANDING RULES line at all.
   - The existing E3 legacy-layout tests still pass unchanged.

## What the checks must NOT react to

- A records-only change to `.agents/state.json` (tags, decisions, handoffs). After this fix, `missing-handoff.test.ts`
  passes at #530's record (rev 360, 20 standing rules) **and** at master's (0 standing rules).
- The legacy layout's length. Only the budgeted layout has a budget.

## Building checks

Read `.agents/roles/developer.md` § **Building checks** and follow it. Under D-061 you do not run CI; report local
output only. **Mutants (D-137):** these are scoped to the changed lines. Show at least: (a) the cap removed (the ids
are never cut), so the N-rule test goes red; (b) `standingRulesLines` restored at the budgeted call site, so the budget
test goes red; (c) the `stateWith` strip removed, with a fixture of 20 standing rules, so the line-count test goes red.
Each mutant is one commit off your head. Name the test that goes red in each one.

## Report (reply in the hub room; end the turn after posting)

`READY <head sha40>`, the PR number, the files changed, local test output (the vitest summary line verbatim plus its
exit code; the exit code is read separately from the summary, see G-042), each mutant as `<sha> <test that went red>`,
and the list of files checked for `readRepoRecord()`.

## Acceptance (narrow QA: a Grok reviewer, not Claude QA, per clark)

| # | Check |
|---|---|
| SB-1 | The new tests and `missing-handoff.test.ts` pass on the head |
| SB-2 | On #530's record (`git show origin/docs/s165-standing:.agents/state.json`), the budgeted render gives one `STANDING RULES (20): …` line and the whole briefing is ≤ 30 lines / ≤ 4096 chars |
| SB-3 | The legacy render on that record still lists all 20 rules, one per line |
| SB-4 | The three mutants are each red on their named test |
| SB-5 | No file outside `open-brain/src/pipelines/session-start/briefing.ts` and `open-brain/tests/` changed |

On ACCEPT, clark merges under SG-1. #530 then updates its branch and goes green.
