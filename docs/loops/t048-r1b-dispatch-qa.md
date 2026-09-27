# T-048 round 1b: QA dispatch (record 173)

**By:** Atlas (planner), record session 146 · 2026-09-27. **Runs under `docs/loops/cursor-qa-overlay.md`.** Read that
first. **Never write a live `state.json`.**

## The candidate

- **`d5b78cb`** on `origin/loop/t048-r1b`. The handoff is at `f3bc55c` (`docs/loops/` only after `d5b78cb`).
- Stacked on T-048 r1 `7913c5f`, which QA 151 passed. **Score only what round 1b adds.**
- **Product:** `sync/checks.ts` plus `t048-r1b.test.ts`.
- Built by Grok 4.7, record 165.
- **CI on tcm:**
  - red `36296837114` (8 rows fail); green `36297117421`;
  - mutants d1 `36297377709`, d2 `36297433772`, d3 `36297488383`.

## Score against the addendum of `docs/loops/t048-t171-rulings-qa157-qa158.md` (the QA 151 part)

1. **D1:**
   - `module-boundary` and `template-personal-names` never return before naming every real finding;
   - `retirements` lists real findings before unreadables.
   - Use QA 151's shape: an unreadable path beside a real personal name, a real crossing and a real retired name. All
     three must be named.
2. **D2:** FALLBACK and PARTIAL stay in the message when there is also a finding.
3. **D3:** the scope statement is complete in every check.
4. **Preserve:** everything QA 151 passed. Every truly unreadable path is still an ISSUE naming it, and `sync --check`
   on this repository gives the same verdicts as at `7913c5f`.
   - QA 151's real-unreadable-path probes (icacls, share-None, EISDIR, ENOENT) may run locally, ONE CLI invocation
     each, against a scratch clone. That is light, and no window opens.
5. **Your own mutants,** at least one per item.

## Report

- **Path:** `docs/loops/t048-r1b-qa-report.md`, on `qa/t048-r1b-report`.
- Order: the verdict first, then each item, mutants, CI, what could not be verified, defects, disagreements, error
  entries, and your model.
- **The LAST line is exactly `QA-173: REPORT COMPLETE`.**
