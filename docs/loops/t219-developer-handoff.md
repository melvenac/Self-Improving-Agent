# T-219 developer handoff: docs-only PRs report `test` as Skipped (D-091)

**By:** Builder (developer seat, `sia-builder`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t219-docs-pr-ci` from `origin/master` `8171e9b6`.
**Dispatch:** `docs/loops/t219-dispatch.md` at `3ec9930e`. **PR:** #262 (to master, **not merged**, as the dispatch says: the planner rules). Files changed: `.github/workflows/ci.yml` and `open-brain/tests/pipelines/sync/ci-runs-on.test.ts`. `ci-seat-skip.mjs` is **unchanged**.

## The change

1. `pull_request` has no `paths-ignore` (the key is now empty, so every PR event starts the workflow). The D-055 comment there cites D-091.
2. The `changed` job's `if` is now `github.event_name == 'pull_request' || (github.event_name == 'push' && github.ref != 'refs/heads/master')`.
3. The `diff` step picks its arguments by event. A push passes `before` and `sha` exactly as before. A pull request passes the **merge-base** of `base.sha` and `head.sha` as `before`, and `head.sha` as `after`. `base.sha..head.sha` would also carry master's changes since the branch point and keep a docs-only PR from skipping, so I diffed from the merge-base. A merge-base that cannot be computed prints an empty argument, which the script reads as `skip=false`, so the suite runs. Because the script is unchanged, no new script test was needed; the new test below covers the choice.
4. `test` is unchanged. There is no second workflow and no stub job named `test`.

## Tests (`ci-runs-on.test.ts`, 19 passed)

Red first: with the new tests and the OLD `ci.yml`, 2 of 19 failed (the trigger row and the change-list row); green with the new `ci.yml`. The other new rows hold at either `ci.yml`, because they evaluate `test`'s own `if`, which did not change.

- The pull request has no paths filter; the trigger still exists.
- A docs-only PR does not run `test`; a code PR does; a PR changing `ci.yml` plus docs does; an unreadable change list does. Exactly one job is named `test`, and it keeps its steps (no stub).
- In a temp repo where master moved on with code after the branch point: from the merge-base the script prints `skip=true`; from `base.sha` it prints `skip=false`; from an empty argument it prints `skip=false`.
- The `diff` step names `github.event.pull_request.base.sha`, `.head.sha` and `git merge-base`, and the existing T-178 assertions still hold.

## Live acceptance (runs on the tcm runner; all read back with `gh`)

| | What | Run | Result |
| --- | --- | --- | --- |
| **A** | PR #262 to master (it changes `ci.yml`, so a code PR), head `ef568929` | `36960520483` (`pull_request`) | `changed` success, and its diff step ran the merge-base branch; `test` **success**, 147 files and 2090 tests passed (6 skipped); `test-windows` skipped (opt-in) |
| **B** | Throwaway PR #263 stacked on `loop/t219-docs-pr-ci`, one file `docs/loops/t219-probe-b.md`, head `d5153af8` | `36961106246` (`pull_request`) | `changed` success; `test` **skipped** (job-level) and `test-windows` skipped; the commit's check-run list reports `test` with conclusion `skipped`. PR #263 closed without merging, its branch deleted, no comment made |
| **C** | Push of `loop/t219-docs-pr-ci` (`ef568929`, a first push, so `before` is all zeros) | `36960480681` (`push`) | `changed` ran and succeeded, with the push arguments `0000… ef568929` as before (the first-push rule gives `skip=false`). Its `test` was **cancelled** by run A, which shares the push's concurrency group (T-178: the newer run cancels the older) |

Limits: the `skip=` value itself goes to `$GITHUB_OUTPUT` and is not printed in the log, so it is read from what it decided (`test` ran in A, was skipped in B). The log shows the push arguments for C and the merge-base command for A. **Not shown from this seat, as the dispatch says:** that master's ruleset 24343321 accepts a Skipped `test` and takes #259 to CLEAN. That is the planner's observation after the merge; running B only proves the check reports Skipped.

Single file run on the QA PC (`ci-runs-on.test.ts`); no full local suite, because CI runs it (A's `test` job above).
