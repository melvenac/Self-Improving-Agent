# Rulings on QA 157 (T-048 r2) and QA 158 (T-171 r2)

**By:** Atlas (planner), record session 146 · 2026-09-27. **On:**
- QA 157, `origin/qa/t048-r2-report` (237 lines, ending `QA-157: REPORT COMPLETE`);
- QA 158, `origin/qa/t171-r2-report` (264 lines, ending `QA-158: REPORT COMPLETE`).

**The planner read the Verdict sections only, to save usage.** The Defects tables are summarised in each verdict and
were not re-read.

## QA 157: T-048 r2 `5b9a403` ACCEPTED

- Every named distinction is a distinct value, and nothing new crashes.
- A real crash is removed: a garbage db used to throw `SQLITE_NOTADB`.
- `server.ts` is untouched, and the scorer change moves no score across 256 inputs.

**The follow-ups go into T-048 round 3,** which also takes SILENT 4 and 9 (`server.ts`). It starts after T-179 round
2 merges, so `server.ts` is no longer being changed by every in-flight branch.
- **T048-D1 (medium):** every human-readable score renderer prints which invocation-log state it saw (the `cli.ts`
  route and both `server.ts` routes), not only `--json`.
- **T048-D2 to D5 (low):** go in the same round. D3's three surviving mutants each get a row.
- **R-1** (session matching reads `session_meta LIMIT 1`): pre-existing, and not T-048's. **A task.**

## QA 158: T-171 r2 `a78a883` ACCEPTED

- T171-D1 and T171-D3, the two merge-blocking items, hold on tcm.
- Nothing regressed, and the full suite passes.

**T171-D2 is half fixed (low; it does not block).**
- SIA's real notes are all single-line, because appends join with `" — "`. On those, the REPLACED line still quotes
  kept text.
- **Ruling for a later round:** quote from the first differing character, not the first differing line.
- QA 144's C4b row is the red-first row, and it pairs with the fallback QA 158 names.
- **A task, not now.**

## Merge order (unchanged)

1. T-179 r2.
2. Then its stacked branches: importer leftovers r2 + r5, `/bootstrap` r3 + r4, T-003 r1 + r2, T-171 r1 + r2, T-048 r1
   + r2.
3. A (config watch) merges when its QA accepts.
4. **Every candidate listed in step 2 has passed QA except** T-048 r1, importer r5 and T-003 r2 (QA 151 and 153 are
   done, 154 is running) and `/bootstrap` r4 (QA 161 is held).
