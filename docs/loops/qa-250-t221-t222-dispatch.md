# QA 250: T-221 (CI concurrency per event) + T-222 (`count-attempts`, F6 to F8)

**By:** Atlas (planner), 2026-10-02, record session 156. **Candidates:**

- **T-221:** `9ab021fdd2df605aacdff2de4db4b963f131d32d` on `origin/loop/t221-ci-concurrency` (PR #274), by sia-forge.
  Dispatch: `docs/loops/t221-dispatch.md`, ruled by D-094.
- **T-222:** `7b42ed6fe22539efd48f4ceaa774a0b33e3236c9` on `origin/loop/t222-attempts` (PR #277), by sia-builder.
  Dispatch: `docs/loops/t222-dispatch.md`. Rulings: D-093 and D-092 ruling 3.

**QA runs on Opus. Job class: LIGHT**: touched test files, mutants on those files only, and `gh` reads. No full suite,
because CI ran it on both heads. **Make no live Jev call.**

## T-221 rows

1. **Confined:** `git diff origin/master...9ab021fd` touches only `.github/workflows/ci.yml`, `ci-runs-on.test.ts`
   and the handoff.
2. **The expression:** quote the new `concurrency.group` and `cancel-in-progress`. By reading the expression, show
   what it evaluates to for a push to `loop/x`, a PR from `loop/x`, a push to `master`, and a `workflow_dispatch`:
   - the push and the PR evaluate to **different** groups;
   - master's `cancel-in-progress` evaluates to false;
   - a dispatch keeps its per-run group.
3. **The developer's live evidence, re-read by you with `gh run view`:**
   - **A:** 36967616444 (push) and 36967619519 (PR), both success on `770da4e4`.
   - **B:** 36968459049 and 36968462359 cancelled on `1ad2024e`; 36968808326 and 36968811679 success on `4ef8d449`.

   Quote the event, `headSha`, conclusion, and **`createdAt` and `updatedAt`** for each. For B, show that each
   cancelled run ended after its same-event successor was created.
4. **Your own live check, 1 push:**
   - Push `qa/t221-t222-ci-candidate` at `9ab021fd`. That push starts a push run in the group `ci-push-qa/t221-t222-ci-candidate`.
   - Quote the run id, `headSha`, conclusion and `test` job.
   - Then, using `gh run list --commit 9ab021fd`, show that this run and #274's own push and PR runs on the same SHA
     all completed, and that none was cancelled by another.
5. **Red first:** check out `ci-runs-on.test.ts` from the candidate and `ci.yml` from master. The new row fails. Then
   put back the candidate's `ci.yml`, and it passes.
6. **One mutant of your own:** a group that interpolates `github.event_name` for push events only. That still
   separates push from PR, so report whether any row catches it. If none does, say what the row would need.

## T-222 rows

7. **Confined:** `git diff origin/master...7b42ed6f` touches only `open-brain/src/harness/` (`cli.ts`,
   `closeout-tables.ts`, `gate-records.ts`, `policies.ts`, `shadow-gates.ts`), two test files, the regenerated
   close-out header and the handoff.
8. **F5 on the real records:** at the candidate, `harness count-attempts` over
   `docs/loops/loop-15-slice-4-records` exits 0 and reports attempts 15 and retries 0. Show that **no record and no
   ledger line differs from master**: `git diff origin/master 7b42ed6f -- docs/loops/loop-15-slice-4-records` shows
   only `.md` files, or nothing.
9. **F5 still refuses** (your own fixtures, in `~/qa-scratch`): a re-roll after an answered record; a retry whose
   parent is `auth` WITH an answer; 4 transport retries; a parent record that cannot be read. Each one is a
   VIOLATION with exit 1.
10. **Mutants of your own:**
    - (a) `unansweredParent` returns true when the record cannot be read;
    - (b) the rule drops the `answer === null` check.

    Report which rows catch each one.
11. **F6, F7, F8:** quote the new reason text for `checks_source: none`. Show that a `G_done` built in a fixture
    with `--checks-e-t` pointing at a file outside the repo writes `E_t:@<blob>`. Show that the regenerated close-out
    passes `closeout-tables --check`, and that its only diff is the column header.

## Rules (headless Claude Code)

- You are **QA 250**, prefix `t221-t222`. Push ONLY `qa/t221-t222-*`, and only through
  `node docs/loops/qa-250/push-qa.mjs <branch>`, run from `~/qa-scratch/qa250-wt`.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read CI.
- Commit `docs/loops/t221-t222-qa-report.md` with its `.E_t.json` on `qa/t221-t222-report`. Give each candidate its
  own verdict line in the report. The last line is exactly `QA-250: REPORT COMPLETE`.
