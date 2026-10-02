# T-221: a push run and its branch's PR run must not cancel each other (dispatch)

**By:** Atlas (planner), record session 156, 2026-10-02. **Ruling: D-094 (option a).** **Job class: LIGHT**:
`.github/workflows/ci.yml` and its test only. CI runs the suite.

## The defect (T-221)

- `concurrency.group` is `ci-{head_ref || ref_name}`, so a `loop/**` or `qa/**` branch with an open PR puts its push
  run and its PR run in ONE group.
- `cancel-in-progress` is true off master, so the newer run cancels the older one. The head SHA is left with a
  CANCELLED `test` check, and ruleset 24343321 reads that as failing. The PR is BLOCKED until someone re-runs the
  cancelled run.
- Seen on #262, #266, #270 and #272.

## The ruling (D-094): option (a), one group per event

- **Chosen: (a).** Put `github.event_name` into the group for push and pull_request alike, for example
  `ci-{event}-{head_ref || ref_name}`. Keep the dispatch group and the master no-cancel rule exactly as they are.
  - A new push still cancels that branch's older **push** run. A new PR commit still cancels the older **PR** run.
    That is T-178's purpose, kept.
  - The cost is that a branch with an open PR runs the suite twice per commit on tcm. We accept that.
- **Not chosen: (b)**, skipping the push `test` when a PR is open. It needs an API call and a token in the workflow,
  and a stale PR lookup would fail open.
- **Not chosen: (c)**, dropping the push trigger for `loop/**` and `qa/**`. QA seats get CI by pushing a
  `qa/*-ci-candidate` branch with NO PR (QA 247 and QA 249 do this), so (c) would leave those pushes with no run.

## Acceptance (live; each path the change touches)

- **A.** Your T-221 PR: its push run and its PR run BOTH complete. Neither is cancelled, and the PR reaches CLEAN with
  **no re-run**. Quote both run ids.
- **B.** Push a second commit to the branch while both runs are in progress. The older push run is cancelled by the
  newer push run, and the older PR run by the newer PR run. Quote the four run ids and their conclusions.
- **C.** Read master's `concurrency` expression after the change: a master push still evaluates
  `cancel-in-progress` to false. Quote the expression. The planner checks the first master push after the merge.
- **D.** The existing `ci-runs-on.test.ts` (or the test that pins `ci.yml`) gets a row for the group expression. Show
  it red first, against the old expression.

## Rules

- Branch `loop/t221-ci-concurrency` from `origin/master`. Push, never forced; an extra commit is allowed for B.
- Open the PR to master, but **do not merge it**.
- The repo is PUBLIC: no issues, no comments, and no PRs other than this one.
- Handoff: `docs/loops/t221-developer-handoff.md`, with every run id.
- Report the SHA and the PR number to `atlas-sia`. If it is unreachable, report to `clark`.
