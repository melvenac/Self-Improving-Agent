# QA 251: T-164 + T-211 round 2, the narrow re-check of QA 249's F1 to F5

**By:** Atlas (planner), 2026-10-02, record session 157. **Ruling being re-checked:** D-095
(`docs/loops/qa-249-rulings.md`), on QA 249 (`origin/qa/t164-t211-report` `0c891c82`). **Round-2 dispatch:**
`docs/loops/t164-t211-r2-dispatch.md`.

**Candidates**, by sia-forge, both rebased onto `f7ac983d`:

- **T-164:** `892f7644` on `origin/loop/t164-port` (PR #270). Round 1 was `fbf94ae6`.
- **T-211:** `3b0b8188` on `origin/loop/t211-standing-cron` (PR #272). It is stacked on T-164. Round 1 was
  `9f6fcea4`.

**Developer handoff:** `docs/loops/t164-t211-r2-developer-handoff.md` on the T-211 branch.

**QA runs on Opus. Job class: LIGHT.** Touched test files, the two QA 249 mutants, and `gh` reads only. No full
suite: CI runs it on both heads, and QA 249 already ran one on round 1 with 0 failed. **Make no live Jev call.**

Resolve the full SHAs with `git rev-parse` and write them into the report.

## Rows

1. **Confined.**
   - Compare round 1 to round 2 with `git diff fbf94ae6 892f7644 --stat` and
     `git diff 9f6fcea4 3b0b8188 --stat`.
   - Every file that changed between rounds belongs to F1 to F5, the round-2 handoff, or the rebase onto
     `f7ac983d`.
   - Name any file that does not, and say whether it matters.
2. **F1, read in the code.**
   - At `892f7644`, `nextFreeSessionNumber` is gone, or it is unexported with no callers. Show it with `git grep`
     over `open-brain/src` and `open-brain/tests`.
   - The SC-2 refusal and the greeting call the **same** function, and that function returns `max(n)+1`. Quote both
     call sites.
3. **F1, red then green.**
   - Copy `docs/loops/qa-249/tests/qa249-t164.test.ts` from `origin/qa/t164-t211-report`, unchanged, into the
     candidate's test tree.
   - Its SC-2 case uses the record `76, 147..155` and expects "next free number is **157**". It passes at
     `892f7644`. Copy it into a `fbf94ae6` worktree and show it fails there.
   - Also run the candidate's own `record-session-number.test.ts` at both SHAs.
4. **F2 and F3.**
   - Apply `qa249-a-status-to-only-no-shadow.diff` and `qa249-b-minute-accepts-60.diff`, each alone, to
     `3b0b8188`. Run `standing-cron.test.ts`.
   - Each mutant turns at least one row red. Name the row and quote the assertion.
   - Restore the tree after each.
5. **F4.**
   - Show the template's documented example as it stands at `3b0b8188`.
   - Run the start-time reader on that exact text. Don't use a copy, and don't use the test's own fixture if it
     differs from the file. It prints the present-shape line, not `INVALID`.
   - The test that guards this reads the template file itself. Show where.
6. **F5.** The SR-5 row text in the handoff names SR-6 as the guard for the dropped-line mutant. Apply
   `docs/loops/t211/mutants/sr5a-line-dropped.diff` and show SR-6 goes red.
7. **Nothing else moved.**
   - Run every test file the round-2 diff touches at the candidate heads, and quote the counts.
   - Check that `tsc --noEmit` is 0 in `open-brain`.
8. **CI on the heads (read only).** `gh run list --commit` for `892f7644` and `3b0b8188`. Quote each run's event,
   conclusion and `test` job. T-221 is now on master, so a push run and a PR run should no longer cancel each other.
   Report any run that was cancelled anyway.

## Rules (headless Claude Code)

- You are **QA 251**, and your prefix is `t164-t211-r2`. Push ONLY `qa/t164-t211-r2-*` branches, and only through
  `node docs/loops/qa-251/push-qa.mjs <branch>`, run from `~/qa-scratch/qa251-wt`.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read CI.
- Commit `docs/loops/t164-t211-r2-qa-report.md` with its `.E_t.json` on `qa/t164-t211-r2-report`.
- Give each candidate its own verdict line in the report. Its last line is exactly `QA-251: REPORT COMPLETE`.
