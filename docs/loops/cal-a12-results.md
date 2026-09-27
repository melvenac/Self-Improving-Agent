# QA calibration on A12: results (Composer 2.5 vs GPT-5.6 Sol)

**By:** Atlas (planner), record session 146 · 2026-09-27. **Question (Aaron):** can a Cursor model do SIA's QA, so
Claude's weekly usage lasts? **The answer key is QA 149's A12-1** (a Claude QA seat, tcm-proven): R90's branch
`continue`s past the restore without adding to `unrestored`. So:
- "Every file was put back" prints;
- R77's stop before git is lost, and 6 git calls follow the role (0 on A11).

## Attempts

- **The first attempt (records 163/164) is void:** both chats ran on Grok 4.7, because the model was not switched.
  They were stopped. Their 16 `qa/cal-a12-*` branches remain, and are marked void.
- **The rerun (records 168/169): both chats were opened in the first attempt's worktrees**, not `sia-qa2-*`. Both
  seats read the older dispatch, and each had a blindness exposure it disclosed itself.

## Scores

| | Composer 2.5 (record 168, `qa/cal-a12-composer-report` `c9ae65a`) | GPT-5.6 Sol (record 169, `qa/cal2-a12-gpt-report` `a6de057`) |
|---|---|---|
| Verdict | REJECT: correct | REJECT: correct |
| A12-1 found | **Both halves**, first seen in tcm `36298202084` on QA 130's own row (6 git calls against 0), and the "put back" sentence read in that run's output | **Both halves**, rated high, traced through `runtime.ts`, with its own confirming row |
| False defects | 0 | 0 |
| Exposure | **Partial:** one grep line from the A12 dispatch, "R90 branch pushes … and `continue`s". It names where, not what is wrong. | **Contaminated:** it read excerpts of rulings 21, which give the verdict, before its CI result. It declared itself "not a clean calibration sample". |
| Discipline | It used the old push route (wrong worktree), and disclosed everything | Correct push gate, and disclosed everything |

## Conclusion

- **Composer 2.5 passes.** It reached A12-1 through the dispatch's required regression run. Its one exposure did
  not state the defect.
- **GPT-5.6 Sol: not measurable** as a blind sample. Its work was the most thorough of the three QA seats.
- **Limits of this result:**
  - n = 1 defect;
  - Composer's own exposure was partial;
  - neither run was fully blind.

  A second calibration on the next candidate with a known defect would tighten it.

## Process fix

The old worktrees `sia-qa-composer*` and `sia-qa-gpt*` are removed, so a chat cannot be opened in the wrong one.
Kickoff lines must name the worktree, and the seat's first act is to state its worktree and model.
