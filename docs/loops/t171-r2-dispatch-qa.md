# T-171 round 2 (note authorship): dispatch to a FRESH, HEADLESS QA seat (record session 158)

**By:** Atlas (planner), record session 146 · 2026-09-27. **Runs from** `qa-queue.ps1` via `docs/loops/qa-158/drive.ps1`.
**Record the machine.** Nobody is watching live. Use `C:\qa-tmp` and `C:\qa-scratch`. Never write a live
`state.json`. Commit the report from a separate worktree.

## The candidate

- **`a78a883`** on `origin/loop/t171-r2`. The handoff is at `5a3763a` (`docs/loops/` only after `a78a883`).
- Stacked on T-171 `b371176`, which QA 144 ACCEPTED. **Score only what round 2 adds.** The product diff is
  `state-writer.ts` plus two test files.
- Built by **Grok 4.7 in Cursor** (`cursor-infra`), record 155.
- **CI on tcm:** red `36292359527` (`1086335`, tests only: 3 fail); green `36292477609`.
- **The mutants were run LOCALLY only:** re-run QA 144's three survivors on tcm yourself.

## Score against `docs/loops/t171-bootstrap-rulings-qa144-qa145.md`, the QA 144 section

1. **T171-D1:** a replace that removes nothing keeps the previous authors in `note_by` and adds the writer.
   - An unrecorded (`null`) note stays `null`.
   - **The same session's next replace can no longer remove another session's text without
     `replace_other_sessions`.** Use QA 144's C2h shape.
2. **T171-D3:** QA 144's three mutants, re-applied to `a78a883` and run on tcm, must each be killed now:
   - `dry-run-hides-replace`;
   - `removes-by-length`;
   - `superset-foreign-unflagged`.

   QA 144's run ids: `36286217950`, `36286220756`, `36286223642`.
3. **T171-D2:** the REPLACED line quotes the first old line the new text does not contain. Try a prefix-keeping edit,
   a middle deletion, and an edit that keeps every line but changes one word.
4. **Regressions:** QA 144's checks 1–4 on the new tip, and the T-169 shape.
5. **Your own mutants,** at least one per defect.

## CI and authority

tcm, at most 6 runs. **No laptop (`windows=true`) CI.** **Push only `qa/t171-r2-*`, through
`node docs/loops/qa-158/push-qa.mjs`.**

## The report

- **Path:** `docs/loops/t171-r2-qa-report.md`.
- Order: the verdict first, then each item, mutants, CI, what could not be verified, defects, disagreements, error
  entries, and "Open for the planner".
- Commit to `qa/t171-r2-report`. **The LAST line is exactly `QA-158: REPORT COMPLETE`.** No `/end`.
