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
| #294 | T-215: the maturity cut, plus the S4-9.2 allowance | QA'd at `39c3cca7`; **now `26f62934`** | ACCEPT | CLEAN after a rebase onto master, and CI run 37010489213 passed. **Planner reviewed the range-diff (about 13:30Z):** commits 2 to 4 are `=` (patch-identical). Commit 1 differs only in `tests/trigger/fires.test.ts`, where the A8 fixture takes master's full `TriggerPolicy` object (`deadline_ms`, `provenance`) and keeps T-215's comment. That is a trivial resolution with no behaviour change. **Merge it pinned to `26f62934`.** The 3 leftover `typecheck:tests` errors are already on master and stay under T-152 |
| #299 | T-050: foreign-writer detector | `483061d0` | ACCEPT, with one follow-up (T-229) | CLEAN |
| #302 | T-048: dropped counts | `ac4323f4` | **REJECT** (row 9: zero is not printed) | Round 2 is with sia-builder. Not on the list |

## B5 (QA 259, report `a161b4ad`, `docs/loops/b5-misc-qa-report.md`)

Merge order: #293, #292, #320.

| PR | Task | QA'd head | Verdict | State at 13:10Z |
|---|---|---|---|---|
| #293 | T-223: exact CI group strings | `58e0ce15` | ACCEPT | CLEAN |
| #292 | T-224: placeholder reason and the `\s` fix | `c77dce55` | ACCEPT | CLEAN |
| #320 | T-228: hub-talk exit codes 0 to 3 (A2A Loop 13). Send relay-a2a its merge SHA | `c9b5e757` | ACCEPT | CLEAN |

## Added after GREEN at 16:50Z: QA 260 (B2 round 2) and QA 261 (#302 round 2)

These two reports came after the morning list was first written. Both are outside D-103.

| PR | Task | QA'd head | Verdict | State and order |
|---|---|---|---|---|
| #306 | T-048: sync checks state their counts | `3f30e825` | ACCEPT (QA 260, `0f53d867`) | Merge **before** #309 |
| #309 | T-048: hook-configs, nested and typed hooks | `f1c2a338` | ACCEPT (QA 260) | Merge **after** #306. #295 and #309 conflict on the `node:path` import line; the second to merge rebases |
| #302 | T-048: dropped counts printed at zero (round 2) | QA'd at `7e92b6f6`; **now `9fe22be5`** | ACCEPT (QA 261, `f395ee84`) | CLEAN, and CI passed (run 37039170029). **The planner reviewed the range-diff:** commits 1, 2 and 4 are `=`. Commit 3 differs only in hunk context: its `formatScanCounts` import now sits after master's `describeLatestBrief` import, and the patch is unchanged. **Merge it pinned to `9fe22be5`.** QA's mutant Q1 follow-up is T-230 |

## Still not accepted

- **#295 (T-008) and #298 (T-008b):** QA 260 REJECTED both. #295 lets a non-object `mcpServers` entry pass silently.
  #298 does not name the skip for an absent `settings.json`. **Round 3 is pushed:** #295 is at `931998db` and #298 is
  at `3b485b7c`; both are CLEAN and CI is green. QA 262 is the narrow re-check.
