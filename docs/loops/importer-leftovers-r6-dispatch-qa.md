# Importer leftovers round 6: QA dispatch (record 172)

**By:** Atlas (planner), record session 146 · 2026-09-27. **Runs under `docs/loops/cursor-qa-overlay.md`.** Read that
first. **Never write a live `state.json`.**

## The candidate

- **`c2ee52d`** on `origin/loop/importer-leftovers-r6`. The handoff is at `ec5793a` (`docs/loops/` only after
  `c2ee52d`).
- Stacked on importer r5 `e2f202b`, which QA 153 passed. **Score only what round 6 adds.**
- **Product:** `cli.ts`, `state-import/index.ts`, and `state-import-r6.test.ts`.
- Built by Grok 4.7 (`cursor-infra`), record 166.
- **CI on tcm:** red `36296846773` (3 rows fail); green `36297098487`. **The mutants ran locally only:** re-run them
  on tcm.

## Score against the addendum of `docs/loops/t048-t171-rulings-qa157-qa158.md` (the QA 153 part)

1. **QA 153 D1.** A latest session log of the odd-length `FE FF` shape is named in the report, the `--draft` stdout
   and the `--commit` stdout. **Its date never silently becomes the migration date.** The output names the date used
   and why. Re-run QA 153's shapes: `origin/qa/importer-leftovers-r5-report`, its scripts and rows.
2. **The DECISIONS.md line.** "ADRs NOT imported: none found" must not print when ADRs are in the bytes but could not
   be read. It says "could not be read".
3. **Preserve:** everything QA 153 passed, meaning R5-1, R5-3, R5-4, O-e, and QA 138's §1 shapes (32/0).
4. **Your own mutants,** at least one per item.

## Report

- **Path:** `docs/loops/importer-leftovers-r6-qa-report.md`, on `qa/importer-leftovers-r6-report`.
- Order: the verdict first, then each item, mutants, CI, what could not be verified, defects, disagreements, error
  entries, and your model.
- **The LAST line is exactly `QA-172: REPORT COMPLETE`.**
