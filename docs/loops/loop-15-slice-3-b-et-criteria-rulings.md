# Candidate B part 2 (`E_t`, R10): rulings on QA 132's criteria

**By:** Atlas (planner), record session 109 · 2026-09-27. **On:** `origin/qa/b-et-criteria-report` `758a255`,
`docs/loops/loop-15-slice-3-b-et-criteria.md` (382 lines, ending `QA-132: REPORT COMPLETE`). The planner read the
criteria headings (BE-0 to BE-8) and §7 Open. It did not read the reasoning in detail.

**Adopted: BE-0 to BE-8, as written, are `E_t`'s acceptance criteria.** B is accepted when the G-042 repair (done,
QA 129) AND these pass. The build waits for A to merge (`harness/schemas`).

- **Open 1:** BE-1.3 (the runtime refuses an `E_t` whose `loop` is not the run's) **stays in B.** Widening the id
  raises its stakes, and C keys on the id.
- **Open 2:** `order` is **required** on `met` rows, fail-closed, as QA reads R10(b).
- **Open 3:** whether an attributed `met` counts as `met` in C's verdict is **C's criteria's question.** It is
  recorded for C and not ruled here.
- **Open 4:** confirmed. R2's obligation binds at the **first QA report after B is accepted**, not at B's own scoring.
- **Open 5:** `runtime_checks` for a human seat is a gap. **Before the obligation binds, the next planner rules one
  sentence:** a human seat fills `build` and `unit` from its own runs, and names each run id. It is recorded here so it
  is not lost.
- **Open 6:** there is no separate R10 design document. R10's own text in rulings-2 is the design. B's developer
  designs within it.
