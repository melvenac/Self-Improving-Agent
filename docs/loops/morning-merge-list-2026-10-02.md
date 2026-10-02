# Code PRs that passed QA but sit outside the overnight pre-approval (D-103)

**By:** Atlas (planner), record session 157, 2026-10-02, about 13:10Z. **For:** Aaron's morning question. The
AskUserQuestion lists every PR by number.

## Before asking, re-check each PR

1. **The head still equals the SHA that QA tested.**
2. **CI `test` on that head is green.**
3. **`mergeStateStatus` is not DIRTY.** A head that moved, for example in a rebase, needs either a range-diff review or
   a narrow re-QA before it is listed.

## B4 (QA 258, report `64cee8ab`, `docs/loops/b4-misc-qa-report.md`)

Merge order: #290, #289, #294, #299.

| PR | Task | QA'd head | Verdict | State at 13:10Z |
|---|---|---|---|---|
| #290 | T-212: the handoff check attributes commits by trailer | `f707a09c` | ACCEPT | CLEAN |
| #289 | T-208 r3: fetch before currency, plus the drift line | `be32de21` | ACCEPT | CLEAN |
| #294 | T-215: the maturity cut, plus the S4-9.2 allowance | `39c3cca7` | ACCEPT | **DIRTY**: conflicts with master after B3. sia-forge has to rebase it, then the planner reviews the range-diff |
| #299 | T-050: foreign-writer detector | `483061d0` | ACCEPT, with one follow-up (T-229) | CLEAN |
| #302 | T-048: dropped counts | `ac4323f4` | **REJECT** (row 9: zero is not printed) | Round 2 is with sia-builder. Not on the list |

## B5 (QA 259, report `a161b4ad`, `docs/loops/b5-misc-qa-report.md`)

Merge order: #293, #292, #320.

| PR | Task | QA'd head | Verdict | State at 13:10Z |
|---|---|---|---|---|
| #293 | T-223: exact CI group strings | `58e0ce15` | ACCEPT | CLEAN |
| #292 | T-224: placeholder reason and the `\s` fix | `c77dce55` | ACCEPT | CLEAN |
| #320 | T-228: hub-talk exit codes 0 to 3 (A2A Loop 13). Send relay-a2a its merge SHA | `c9b5e757` | ACCEPT | CLEAN |

## Not yet QA'd

- **B2 round 2, QA 260:** #295, #298, #306, #309. It waits for a QA slot under the AMBER cap of 2.
- **#302 round 2.**
