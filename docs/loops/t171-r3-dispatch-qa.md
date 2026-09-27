# T-171 round 3 (quote from the first changed character): QA dispatch (record 177)

**By:** Atlas (planner), record session 146 · 2026-09-27. **Runs headless on a QA machine through the Cursor QA
driver** (record 175), with Composer 2.5. **Never write a live `state.json`.** Commit the report from a separate
worktree.

## The candidate

- **`993ed08`** on `origin/loop/t171-r3`. The handoff is at `ef4d91b` (`docs/loops/` only after `993ed08`).
- Stacked on T-171 r2 `a78a883`, which QA 158 accepted. **Score only what round 3 adds.**
- **Product:** `state-writer.ts` plus tests.
- Built by Grok 4.7 (`cursor-builder`), record 167.
- **CI on tcm:** red `36301870766` (3 fail); green `36301939922`; mutant `36301993669` (7 fail).

## Score against `docs/loops/followups-r165-r167-briefs.md`, "Record 167"

1. **T171-D2, done properly.** The REPLACED line quotes from the first differing CHARACTER.
   - **QA 144's C4b:** the real T-169 note, 3,256 characters on one line, first 200 kept. It must quote from the
     change, not "Session 78, planner…".
   - QA 158's fallback shape.
   - A one-word change inside a single-line note.
   - **Try your own:** a change in the first character, a change in the last character, an append only, a
     whitespace-only change, and a multi-byte character at the boundary.
2. **Preserve:** everything QA 158 accepted. D1's authorship, the refusals, the three D3 rows, and the dry run and
   write reporting identically.
3. **Your own mutants,** at least two, run on tcm.

## CI and authority

tcm, at most 6 runs. **No `windows=true` CI.** Push only `qa/t171-r3-*`, through `node docs/loops/qa-177/push-qa.mjs`.

## The report

- **Path:** `docs/loops/t171-r3-qa-report.md`, on `qa/t171-r3-report`.
- Order: the verdict first, then each item, mutants, CI, what could not be verified, defects, and your model.
- **The LAST line is exactly `QA-177: REPORT COMPLETE`.**
