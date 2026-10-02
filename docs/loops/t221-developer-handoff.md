# T-221 developer handoff (Forge): one concurrency group per event (D-094 option a)

Dispatch: `docs/loops/t221-dispatch.md` (master 8961ba1f). Branch `loop/t221-ci-concurrency` from origin/master `8961ba1f`. PR #274 (not merged). Files: `.github/workflows/ci.yml`, `open-brain/tests/pipelines/sync/ci-runs-on.test.ts`. No other file.

## The change

`concurrency.group` was `ci-{head_ref || ref_name}`; it is now `format('ci-{0}-{1}', github.event_name, github.head_ref || github.ref_name)`. The dispatch group (`ci-dispatch-{run_id}`) and `cancel-in-progress` (`event != workflow_dispatch && ref != refs/heads/master`) are unchanged.

## Acceptance

- **D (red first).** New row "a branch's push run and its pull request run are in different concurrency groups..." in `ci-runs-on.test.ts` (the evaluator gained `format()`, `github.head_ref`, `github.ref_name`, `github.run_id`). Against the OLD expression: `AssertionError: loop/t221-x: the push group: expected 'ci-loop/t221-x' not to be 'ci-loop/t221-x'` (1 failed, 19 passed). After the change: 20 of 20 pass, `tsc --noEmit` exit 0. Only this file was run (the QA PC heavy slot was held by others), not the full suite; CI ran the full suite on all three commits.
- **A.** Commit `770da4e4`: push run **36967616444** success, pull_request run **36967619519** success. PR #274 reached `mergeStateStatus: CLEAN` with no re-run.
- **B.** Commit 2 `1ad2024e` pushed (a comment in the test file, so the suite runs); its push run **36968459049** and PR run **36968462359** were both in progress. Commit 3 `4ef8d449` pushed then: push run **36968808326** and PR run **36968811679**. Results: 36968459049 **cancelled**, 36968462359 **cancelled**, 36968808326 **success**, 36968811679 **success**; PR CLEAN. Each event's older run was cancelled by that event's newer run, and no run was cancelled by the other event's run. (The four runs the dispatch asked for.)
- **C.** `cancel-in-progress: "${{ github.event_name != 'workflow_dispatch' && github.ref != 'refs/heads/master' }}"`, unchanged. The existing row "cancel-in-progress evaluates to false for a push to refs/heads/master" still passes. The first master push after the merge is the planner's check.

## Not covered

- B was shown on one branch with open PR; a `qa/*-ci-candidate` branch with no PR has one run per commit and is unchanged by construction (its group is `ci-push-<branch>`).
- A branch with an open PR now runs the suite twice per commit on tcm (accepted in D-094).
- The group string is evaluated by my small evaluator in the test, not by GitHub; A and B are the live evidence.
