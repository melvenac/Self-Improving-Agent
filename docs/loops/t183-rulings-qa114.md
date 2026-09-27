# T-183: rulings on QA 114, and a test-only round 2 (record 119)

**By:** Atlas (planner), record session 109 · 2026-09-26. **On:** QA 114's report, `origin/qa/t183-report` `f148df7`,
297 lines, ending `QA-114: REPORT COMPLETE`. The planner read the Verdict, §1 Rows with §1.1, §6 Defects, §7
Disagreements and "Open for the planner". It did **not** read §2–§5 or §8–§9 in detail.

## The verdict, accepted

**ACCEPT WITH ONE DEFECT TO FIX.** The candidate `0f0e7ad` (handoff `ee723f9`) cuts the greeting by 43–46% for every
seat, from 88,686 to 47,489 characters for the developer seat. That is an honest no on the 40k line, as Amendment 1
ruled. Every watch-out, open question, pick-up and loop-state item is byte-identical to `state.json` across 73
revisions and four readers. T183-2, -4 and -5 pass, and T183-6 is unrun as dispatched. The developer's drift finding
is confirmed.

## Rulings

**R183-1 (D1; QA's Open 1): fix it before merge.** §2.3 said "a test asserts each", and behavioural evidence from QA does
not replace a test. The real-record verbatim test is extended to `loop_state` items (rulings and questions for Aaron)
and to the other seats' named lines. **Known positives:** QA's q10, q18 and q19, which pass the full suite at
`0f0e7ad` (tcm 36209796211). Each must turn red.

**R183-2 (D2, D3; QA's Open 2): in the same commit.** A `runSync` assertion that `greeting-size` is among the checks run
(it must kill q15), and a seat-sensitivity assertion: composing for an unresolved reader must differ from composing for
the planner seat (it must kill q16).

**R183-3 (D5): pin the boundary if it is one line** (`n == limit` is not an issue, and `n == limit + 1` is: kills q11).
Not required otherwise.

**Recorded, not in round 2:**
- **D4** (`greeting-size` is a second assembly of `handleStart` and has drifted by 721 characters, including the seat
  line's `— partner: Atlas`): **goes with T-191**, the per-seat profiles work, as QA recommends. One assembly function,
  called by both. It touches `server.ts`, which T-183 excluded. The check's message already discloses its exclusions,
  so nothing is silent in the meantime.
- **D6** (clip edge cases: abbreviations, a lone surrogate, U+2028, an empty cut on a leading newline): **to T-191** as
  inputs. None is silent, because the marker is always present. The lone surrogate is the one to fix first.
- **D7** (the omission door prints the whole 363k-character record): **a task**, for a proportionate `state show
  --verified` door. It needs `cli.ts`. **After T-185** (record 117), which is working in `cli.ts` now.
- **G-031's first sentence is an amendment header**, so its clipped line says nothing about the gap. That is a record
  edit, the planner's, in a later `ob_state` write.
- QA's `ci-status` note that master `8af41dd`'s push run failed: **confirmed as billing, not a failure.** Run 36208720404's
  `test` job never started (no runner, 0 steps), and its annotation reads "The job was not started because recent
  account payments have failed or your spending limit needs to be increased". Master pushes run hosted, and hosted
  minutes are exhausted until 2026-10-01. `/sync`'s `ci-status` will read red until then.

## Round 2: brief (record 119)

- **To:** a fresh Claude developer session (D-035), record **119**, in whichever checkout frees first. It is
  test-only, so it can run between any two builds. **Queue:** first, because it is the smallest item.
- **Branch:** `loop/t183-r2` from `origin/loop/t183-greeting` (the handoff tip, `ee723f9`). **Test files only.**
  `git diff --name-only 0f0e7ad HEAD` must list only files under `open-brain/tests/`, and the handoff shows it.
- **Read ONLY:** this file, QA 114's §3 (Mutants) and §6
  (`git show origin/qa/t183-report:docs/loops/t183-qa-report.md`), and QA's mutant script on that branch.
- **Red first:** apply QA's q10, q15, q16, q18 and q19 (and q11 if R183-3 is done) to `0f0e7ad`. Show on tcm, per test,
  that each is killed by the new tests, and that the new tests pass on the unmutated candidate. `npx tsc --noEmit -p .`
  before every push. No full local suite.
- **Push only** `loop/t183-r2` and `loop/t183-r2-*`. Never master, never force, and read back each push.
- **Hand back:** `docs/loops/t183-r2-developer-handoff.md`, with the file list, each mutant's run id with its killing
  test, and your model and effort. Then name the frozen SHA and message atlas. No `/end` (T-163).
- **Merge:** after the planner reads the kills. QA does not re-run the whole row set for a test-only round: the
  planner reads the mutant runs. Aaron merges `loop/t183-r2` (it carries `0f0e7ad`).
