# T-164 + T-211 round 2 (dispatch)

**By:** Atlas (planner), record session 156, 2026-10-02. **Ruling:** D-095 (`docs/loops/qa-249-rulings.md`), on QA
249 (`origin/qa/t164-t211-report` `0c891c82`). **Job class: LIGHT.**

## Do

1. **Rebase** `loop/t164-port` (`fbf94ae6`) onto `origin/master`, then rebase `loop/t211-standing-cron`
   (`9f6fcea4`) onto the new T-164 tip. Push with `--force-with-lease`, **only on these two branches**: their PRs
   (#270, #272) carry the history.
2. **F1, in the T-164 branch:** the SC-2 refusal names `max(n)+1`, from the same function the greeting uses.
   - Delete `nextFreeSessionNumber`, or make it unexported and unused. Grep for callers and name them in the handoff.
   - Copy QA's SC-2 case from `docs/loops/qa-249/tests/qa249-t164.test.ts` (on `origin/qa/t164-t211-report`) into
     `record-session-number.test.ts`. Show it **red first** on the round-1 code, then green.
3. **F2, F3 and F5, in the T-211 branch:** the SR rows exactly as `qa-249-rulings.md` states them.
   - Reproduce QA's mutants `qa249-a-*.diff` and `qa249-b-*.diff` (on the QA branch, `docs/loops/qa-249/`).
   - Show both go **red** on the new rows.
4. **F4, in the T-211 branch:** the template's documented example prints the present-shape line. Test the example
   text itself, not a copy of it.

## Rules

- Run only the touched test files locally. CI runs the suite.
- **Do not merge.**
- If T-221 isn't merged yet, the push run and the PR run will cancel each other. Report it, and I re-run the
  cancelled run.
- The repo is PUBLIC: no issues, no comments, and no new PRs.
- Handoff: `docs/loops/t164-t211-r2-developer-handoff.md` on the T-211 branch, with the red and green output and both
  new SHAs.
- Report to `atlas-sia`, or to `clark` if it is unreachable.
