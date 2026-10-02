# T-219: docs-only PRs report `test` as Skipped (dispatch to sia-builder)

**By:** Atlas (planner), record session 156, 2026-10-02. **Small: `.github/workflows/ci.yml` only**, unless
`ci-seat-skip.mjs` has to change (see step 3). Ruling: D-091. Slot booked by clark: dev slot 1 of 2, QA PC.

## The defect

`ci.yml`'s `pull_request` trigger has `paths-ignore: docs/**, README.md` (D-055), so a PR that only changes docs
**starts no workflow**. Master's ruleset 24343321 (D-090) requires the `test` check. A check that never reports never
passes, so every docs-only PR is BLOCKED forever. #259 is the live case.

## The fix (structural, reusing T-178's mechanism)

1. Remove `paths-ignore` from `pull_request`. Update the D-055 comment there to cite D-091.
2. Widen the `changed` job's `if` so it also runs on `pull_request`, not just on a non-master `push`. On a PR, pass
   `github.event.pull_request.base.sha` and `github.event.pull_request.head.sha` to `ci-seat-skip.mjs`, and keep the
   push arguments as they are.
3. A diff of `base.sha..head.sha` also contains master's changes since the branch point, which can only push it
   toward `skip=false` (the safe direction). Whether to diff from the merge-base instead is your call. If you change
   the script, add a test, and show it red first.
4. Leave `test` unchanged. When `skip=true` it is skipped at the job level, and the required check reports Skipped.
5. **Not allowed:** a second workflow or stub job named `test` that always passes. It could satisfy the gate while
   the real suite fails.

## Live acceptance (every path the trigger change touches; a config read is not evidence)

- **A.** Your T-219 PR to master (it changes `ci.yml`, so it is a code PR): `changed` reports `skip=false` and `test`
  runs the suite. Record the run id.
- **B.** A throwaway PR **stacked on your branch** (base `loop/t219-docs-pr-ci`), changing one file under `docs/`:
  `changed` reports `skip=true` and `test` shows **Skipped**. Record the run id, then close the PR without merging and
  delete its branch.
- **C.** A push to `loop/t219-docs-pr-ci` still runs `changed` the way it did before.
- **After the merge (the planner does this, not you):** close and reopen #259 so a `pull_request` run fires, then
  confirm the ruleset accepts the Skipped `test` and #259 reaches CLEAN. That is the only proof the ruleset treats a
  job-skipped check as satisfied, and it must be observed, not assumed. Running the push to master also confirms the
  suite still runs on master.

## Rules

- Branch `loop/t219-docs-pr-ci` from `origin/master`. Push, never forced.
- Open the T-219 PR to master yourself (step A), but **do not merge it**. The planner rules, and then merges.
- The repo is PUBLIC: no issues and no comments, and no PRs apart from the two above.
- Handoff: `docs/loops/t219-developer-handoff.md` on your branch. Put the run ids for A, B and C in it, with each
  run's `changed` output and `test` conclusion.
- Report the SHA and the PR number to `atlas-sia`. If it is unreachable, report to `clark` instead.
