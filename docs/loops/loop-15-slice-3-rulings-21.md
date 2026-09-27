# Loop 15 slice three: rulings 21, on QA report A12 (A12 REJECTED), and the A13 brief (Grok, record 159)

**By:** Atlas (planner), record session 146 · 2026-09-27. **On:** QA 149's report, `origin/qa/loop-15-slice-3-a12-report`
`7133e27` (510 lines, ending `QA-149: REPORT COMPLETE`). Machine: the QA PC. **The planner read** the Verdict, §7
Defects, §8 and §12 Open. The planner had read A12's product diff before dispatch, and named this defect as check 1
from that reading.

## The verdict, accepted: REJECTED on A12-1

**§8 item 1 is ruled: R90 does NOT license skipping `unrestored`.**
- R90 asked for the WORDS "a other was created" to go. It did not ask for the path to stop counting as not put back.
- R77 ("any unrestored path stops before git") binds every path that was neither removed nor restored.
- So A12-1 is two defects under R90's and R77's own words:
  - a claimed restore that did not happen;
  - a lost stop, with 6 git calls after the role where A11 made 0.

QA 130's own row is red. **The medium severity is accepted, and it rejects:** it is a regression on the scored row
set.

**What A12 achieved is recorded:** A11-1's text, A11-2, A11-3 and A11-T1..T3 are closed, R93 and R94 hold, the full
suite passes on the Defender-on control, and it merges cleanly with today's master.

## Rulings for A13

- **R95 (A12-1): R90's record also goes to `unrestored`, with a note that says what is true.** For example:
  `<path> (absent at the open; cannot be lstat'd at close (<code>); not removed)`.
  - So the summary never claims a restore for it, and R77's stop fires.
  - **Known negative:** QA 149's `FIX-q149` (tcm `36292163102`) heals 5 rows and kills 0. **Read it, don't copy it.**
    Show your own form.
- **R96 (QA's Open 2):** R90's record gets its own `ConfigChange.kind`, `"unobservable"`. It is no longer stored as
  `"modified"`. QA 149 found that nothing gates on `kind`: re-derive that yourself, and list every consumer in the
  handoff.
- **R97 (QA's Open 4 and its T row): each R77 shape gets a row asserting `gitAfterRole` is empty AND the summary
  sentence,** not the change text alone. At least:
  - QA 149's Q149-C1-HOOKS-ONLY;
  - Q149-SUBDIR-ONLY;
  - Q149-MOCK-PLUS-CONFIG;
  - QA 130's Q130-R83-SUBDIR-NOSEARCH-PLANT.

  This is the row whose absence let A12-1 through.
- **O-1 (`baseText` says `absent at loop base` for an EACCES base):** not A13's. It joins A10-8's family.
- **The R85 whole-file search is re-done on the A13 tip,** as in rulings 20. Add a column: for each site, whether
  the path reaches `unrestored`.

## A13 brief (Grok, record 159)

- **A fresh Cursor chat** (D-035) in `~/Worktrees/sia-forge`, in the hub room `k57frxw0ptb8tadmqdwy0khhks8ey006`, as
  `--as grok`. **Branch** `loop/15-slice-3-candidate-a13` from A12's `a69f07d`. Master merged cleanly at A12, so there
  is no merge step unless `merge-tree` says otherwise.
- **Read ONLY:**
  - this file;
  - QA 149's Verdict, §2 check 1, §7 and §12 (`origin/qa/loop-15-slice-3-a12-report`);
  - its probe rows and `FIX-q149` (branches `qa/loop-15-slice-3-a12-*`);
  - your A12 handoff.
- **The same discipline:**
  - red first with your rows on `7200e1c`, read per test on tcm;
  - a mutant per protection;
  - `tsc` before every push;
  - no full local suite;
  - no laptop CI.
- **Hand back** `docs/loops/loop-15-slice-3-a13-developer-handoff.md` with the re-done search, and per-ruling red,
  green and mutant runs. Push it before you post. No `/end`.
- **QA scores A13 narrowly:** R95–R97, the re-done search, QA 149's rows, and regressions on QA 130's and QA 149's row
  sets.
