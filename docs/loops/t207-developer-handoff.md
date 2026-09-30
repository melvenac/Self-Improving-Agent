# T-207 developer handoff: ci.yml skips push runs on mutant refs

**Builder, 2026-09-30, branch `loop/t207-ci-skip-mutants`, cut from origin/master cdf079df (after PR #222, the TG-2 fix). `ci.yml` is code: the merge is Aaron's.**

## Why

A push to `loop/**` or `qa/**` started a tcm CI run. Mutant refs are never evidence (D-061: QA re-applies mutants locally), yet about 40 pushed on 2026-09-30 filled both tcm runners, and the TG-2 fix on master waited 20 minutes behind them.

## The change

`.github/workflows/ci.yml`, `on.push.branches`: added `"!loop/**-mut-*"` and `"!qa/**-mut-*"` after the positive patterns (order matters in GitHub's filter: a later negation excludes what an earlier pattern matched). Planner ruling: negate both.
`tests/pipelines/sync/ci-runs-on.test.ts`: the T-178 row that pinned the exact list now pins the five patterns.

## Rows and proof

`tests/pipelines/sync/ci-push-filter.test.ts` (7 tests). The matcher models `*` (not across `/`), `**`, a leading `!`, last-match-wins, and refuses (fails the test) a workflow pattern character it does not model. Ref names are copied from `git ls-remote`, not read from the network.

| Row | Mutant (local branch, NOT pushed) | Result |
|---|---|---|
| Every real mutant ref is excluded (11 names across the shapes in use) | `loop/t207-mut-no-loop-negation` 34a9ecee | red, 1 failed |
| qa mutants excluded | `loop/t207-mut-no-qa-negation` c7aabd89 | red, 1 failed |
| Pattern is the right glob (`*` does not cross `/`) | `loop/t207-mut-wrong-glob` f730bf8d (`!loop/*-mut-*`) | red, 1 failed |
| Order: negations must come AFTER the positives | `loop/t207-mut-negation-first` 2dd81180 | red, 1 failed |
| Master, candidates, `qa/b-criteria-load` still run | (same rows) | |
| T-156 known positive: the workflow with the negations stripped lets a mutant through; known negative: matcher order and glob cases | | |

My first `negation-first` mutant only ADDED negations at the top and left the originals, so nothing changed and it passed (7 of 7); it was not a mutant. Rebuilt to MOVE them, it is red. Recorded because it passed for the wrong reason.
Those mutant branches are local only (pushing them is what T-207 stops; QA re-applies).

Full suite, unpiped, exit 0: 126 files passed / 7 skipped, 1789 tests passed / 75 skipped, on this machine only, at 7899db2c. tsc exit 0. (An earlier run at the pre-#222 base failed exactly one row, TG-2, the known master-red; the rebase onto #222 cleared it.)

## Live probe (planner-approved, exactly one probe ref)

A push evaluates the workflow at the pushed commit, so this tested the candidate's ci.yml before merge.
- Before: `gh run list --branch loop/t207-ci-skip-mutants` = `[]`; `--branch loop/t207-probe-mut-x` = `[]`.
- **Negative control:** pushed `loop/t207-ci-skip-mutants` (7899db2c) at 08:03:58Z; a run appeared at 08:04:00Z: **36687403853**, event push, headSha 7899db2c, queued.
- **Probe:** pushed 7899db2c to `loop/t207-probe-mut-x` at 08:04:51Z; 90 seconds later `gh run list --branch loop/t207-probe-mut-x` = `[]`, and `gh run list --commit 7899db2c` showed only run 36687403853 (the candidate branch's). **No run started for the mutant-named ref.** The candidate's own run appeared in 2 seconds, so 90 seconds is not a race.
- Probe ref deleted (`git ls-remote --heads origin 'loop/t207-*'` then lists only the candidate branch); no run list for it afterwards.

## Limits

- **Filters pushes only.** `workflow_dispatch` and a pull request opened FROM a mutant branch still run (a row pins that neither carries a branch filter).
- **Covers `-mut-` names only.** `-redcheck` (`loop/15-slice-3-a10-redcheck`) and `-mutant` (`qa/b-step1-mutant`) still run; a row pins both as NOT covered so the limit is in the test.
- Runs already queued or started before this merges are not affected.
- The filter is per ref name: a real branch that happens to contain `-mut-` would be skipped too.
- The QA common file mentioning that QA mutants do not run CI is the planner's edit.
