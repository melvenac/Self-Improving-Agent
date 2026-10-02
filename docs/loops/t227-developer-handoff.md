# T-227: CI on GitHub-hosted runners by default, tcm as an opt-in, developer handoff

**By:** Forge (developer seat, `sia-forge`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t227-ci-hosted` from `origin/master` `5ec37cdf`. **PR:** #310. **Dispatch:** atlas-sia, session 157, priority, Aaron's plan approved in clark's window about 08:36Z. Not merged; merging needs Aaron to name the PR. Changes `.github/workflows/ci.yml` and its tests only.

## What changed in `ci.yml`

1. **Runner:** `changed` and `test` use `${{ inputs.tcm && fromJSON('["self-hosted","linux","tcm"]') || 'ubuntu-latest' }}`. The dispatch input `hosted` is gone; `tcm` (boolean, default false) is the opt-in. The egress self-check step is still gated on `runner.environment == 'self-hosted'`. The Windows laptop job is unchanged except for the checkout below.
2. **Triggers:** `push` is `branches: [master]` only. `pull_request` is `types: [opened, synchronize]`. A branch with no PR runs CI by `workflow_dispatch`. `changed` now runs on `pull_request` only (a master push always runs the suite).
3. **Concurrency:** group per PR (`ci-pr-<number>`), `cancel-in-progress` true for a PR only. A master push has its own group per SHA (`ci-push-<sha>`) and is never cancelled; a dispatch keeps `ci-dispatch-<run_id>`. **Why the head commit's run is never cancelled:** the cancelled-`test` problem of #277 came from two runs of one SHA (push and PR) sharing a group. Now only master pushes, and PRs fire once per commit (`opened`, `synchronize`; `reopened` or `ready_for_review` would start a second run of the same head and cancel the first). A newer commit cancels the run of the commit it superseded and nothing else.
4. **`fetch-depth: 0` on every checkout** (`changed` already had it; added to `test` and `test-windows`). From the T-227 addendum: clark's hosted proof run **36984810269** (ubuntu-latest, master `5ec37cdf`) failed 8 tests with `fatal: bad revision '2448a6ea'`, because `actions/checkout` defaults to depth 1 and tcm's persistent workspace had hidden it. A row pins it.
5. **Sharding:** left out, as instructed. Proposal below.

## Rows (`tests/pipelines/sync/ci-runs-on.test.ts`, 21 tests; one file per vitest run)

Expression tables through the file's evaluator (extended with `inputs.tcm`, `github.event.pull_request.number`, `github.sha`): push to master, PR, a default dispatch, all `ubuntu-latest`; a dispatch with `tcm=true` the only way to the tcm runner; `changed` and `test` share the runner expression; `on.push.branches` is exactly `["master"]` and a `loop/**` or `qa/**` branch triggers nothing; `pull_request.types` is `["opened","synchronize"]`; concurrency groups per PR, per master SHA and per dispatch run never collide, and only a PR is cancellable; a docs-only PR skips `test` (D-091) and a code PR runs it; every checkout has `fetch-depth: 0`. The old seat-push rows became pull-request rows.

- **Red** (the file against `origin/master`'s `ci.yml`): 7 failed, 13 passed. The `fetch-depth` row against the previous commit's `ci.yml`: red (`test: checkout without fetch-depth 0`). **Green:** 21 passed; `tsc --noEmit` 0.
- **Mutants** (`docs/loops/t227/mutants/`, each red, `ci.yml` only): `cancel-always` (`cancel-in-progress: true`, which would make a master push and a dispatch cancellable) red on 2; `pr-reopened` (a duplicate head-commit run) red on 1; `master-shared-group` (master pushes grouped by ref, so a close second merge could replace a pending first) red on 1.
- The test run also caught a real YAML error in my first edit (a colon inside an unquoted `description`) that GitHub would have rejected.

## Live runs (repo `melvenac/Self-Improving-Agent`)

| What | Run id | Event | Runner | Result |
| --- | --- | --- | --- | --- |
| Clark's proof, master `5ec37cdf`, `hosted=true` (before this PR) | 36984810269 | dispatch | ubuntu-latest | failed 8 tests in 2 files (`bad revision`): the depth-1 checkout |
| A push of the branch (`loop/t227-ci-hosted`) | none | push | none | **no run started**: a `loop/*` push triggers nothing |
| PR #310 opened at `f082463c` | 36985270934 | pull_request | ubuntu-latest | **cancelled** (superseded by the second commit, as designed) |
| Second commit `c30759db` pushed while the first ran | 36985310124 | pull_request | ubuntu-latest | completed, **failure** (the 8 `bad revision` tests, same as clark's) |
| Fix `4f4984e3` (`fetch-depth: 0`) | **36985740012** | pull_request | ubuntu-latest (`GitHub Actions 1000001411/1412`) | **success**: 151 files passed, **2122 tests passed**, 7 skipped; `changed` 9 s, `test` 2m17s (Test step 2m00s) |
| Docs-only probe PR #311 into this branch (throwaway, closed and its branch deleted) | 36985354203 | pull_request | ubuntu-latest | `changed` success, **`test` Skipped**, `test-windows` skipped; the run concluded success |
| Dispatch with `tcm=true` at `c30759db` | 36985450437 | workflow_dispatch | self-hosted tcm (`tcm-2`) | **success**: see the last section |

**Cancellation shown:** run 36985270934 (first commit) cancelled, 36985310124 (head at that time) ran to completion; then the fix commit superseded none that was still running (36985310124 had already failed). The head commit's run was never cancelled.

**Ruleset check on the PR head:** `gh pr checks 310` at `4f4984e3` lists `changed` pass, **`test` pass (2m17s)**, `test-windows` skipping; `mergeStateStatus` **CLEAN**, mergeable. The required `test` check shows on the head.

## Sharding proposal, with numbers from the hosted run

The whole hosted `test` job is **2m17s**: Install 4 s, Typecheck 4 s, Test 2m00s. Sharding the suite in two would save about a minute but adds a second job's startup and install (~15 s each) and, more important, **the required check is named `test`**: it would need a final aggregate job called `test` to keep the ruleset's check name, which D-091 forbids as a stub-style job unless it truly depends on the shards. At 2m17s I would not shard. Revisit if the suite passes about 6 minutes.

## Consequences to know

- **A `qa/**` or `loop/**` branch with no PR no longer gets CI on push** (this is the option D-094 rejected as (c), now ruled). QA's `ci-candidate` pushes need a PR or a `workflow_dispatch` (`gh workflow run CI --ref <branch>`; a dispatch on a hosted default now). `docs/loops/qa-scripts-a7/push7.sh` already dispatches.
- Hosted runners are free on this public repo; if it were ever private the minutes would be billed.
- The Windows job's checkout gained `fetch-depth: 0`; otherwise untouched.

## The tcm opt-in dispatch

`gh workflow run CI --ref loop/t227-ci-hosted -f tcm=true` gave run **36985450437** (event `workflow_dispatch`, commit `c30759db`, which already had the tcm expression; it predates the `fetch-depth` fix and passed anyway because tcm's workspace has the history). It sat queued from 08:41Z until 08:49Z because both tcm runners were busy with other jobs, then ran on **`tcm-2`** (labels `self-hosted,linux,tcm`), concluding **success** at 08:53:53Z. The **egress self-check step ran** (the step is gated on `runner.environment == 'self-hosted'): every target printed `blocked:`, and `denied: /opt/doorctl`. The suite: **151 files passed, 2122 tests passed, 6 skipped**. `changed` was skipped (it runs on a pull request only) and `test-windows` was skipped (opt-in), as designed. So the opt-in reaches the tcm runner and the isolation check still guards it.
