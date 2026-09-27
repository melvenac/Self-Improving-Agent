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

## Addendum: QA 151 (T-048 r1 `7913c5f`) and QA 153 (importer r5 `e2f202b`), both PASS

The planner read the Verdict sections only.

**QA 151: PASS.**
- All five checks name a truly unreadable path as an ISSUE, and nothing reads as a false pass.
- This was tested on real icacls, share-None, EISDIR and ENOENT paths.

**Its output defects go into T-048 round 3:**
- **D1:** an unreadable path hides a real finding: `module-boundary` and `template-personal-names` return on the first
  one, and `retirements` cuts at six with the unreadables listed first. **Ruling:** real findings are listed before
  unreadables, and a check never returns before it has named every finding.
- **D2:** PARTIAL and FALLBACK drop off when there is also a finding.
- **D3:** the scope statement is only partial.

**QA 153: PASS** on R5-1, R5-3, R5-4 and O-e, and on every preserve. QA 138's §1 shapes: 32/0.
- **R5-2 is PARTIAL (D1):** the latest session log of the odd-length `FE FF` shape is named nowhere, and its date
  silently becomes the migration date.
  - That is a silent substitution, the class this project exists to remove.
  - **Ruling:** it is fixed in the importer's next round, before any adoption that imports a real project (T-181).
  - It does not block the merge, because it needs a session log written by a non-cmdlet writer.
- The DECISIONS.md "ADRs NOT imported: none found" line is in the same round.

**The merge order is unchanged.** Every stacked candidate has now passed QA except T-003 r2 (QA 154 is running) and
`/bootstrap` r4 (QA 161 is held for the Cursor calibration).

## Addendum 2: QA 154 (T-003 r2 `d781b59`) PASS

The planner read the Verdict.
- D1, D3 and R2-D1 hold. **R2-D1 was tested with REAL proofs**; QA 134's P1–P4 passed vacuously under T-003.
- `end.md` is true, and the ride-alongs hold. There are no regressions.
- **The departure is accepted.** The registration check was already gone at `706c029`. The writer refuses every shape
  that check refused, and more. Only an earlier message was lost.
- **QA154-1 (low, a test gap):** the mutant "refuse only batches that carry `set_handoff`" survives the developer's
  suite. QA 154's rows kill it (tcm `36296175366`). **They are adopted in T-003's next touch.** Not blocking.

**Every candidate stacked on T-179 r2 has now passed QA.** Follow-ups still open, none blocking: `/bootstrap` r4 (QA
161), importer r6 (QA 172), T-048 r1b and r2b, T-171 r3. **T-179 r2 is merge-ready once the planner amends its
after-merge checklist (R2-D3, R2-D4).**
