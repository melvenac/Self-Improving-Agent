# T-192 replay — Composer 2.5 developer handoff (record 184)

**By:** cursor-infra (Forge seat), record session **184**, 2026-09-27, in `~/Worktrees/sia-infra`.
**Model:** Composer 2.5. **Base:** `7243fd5`. **Branch:** `loop/t192-replay-composer`.
**Started:** 2026-09-27T09:33:10Z.

## Item 1 — master push runs on tcm

**Change:** `.github/workflows/ci.yml` `test.runs-on` is now
`inputs.hosted && 'ubuntu-latest' || fromJSON('["self-hosted", "linux", "tcm"]')`.
Comment updated. Egress self-check still gated on `runner.environment == 'self-hosted'`.

**Tests:** `open-brain/tests/pipelines/sync/ci-runs-on.test.ts`
- Parses `ci.yml` with the `yaml` package (not regex).
- `evaluateCiTestRunsOn` asserts four cases (master push, dispatch, dispatch+hosted, non-master push).
- Mutant: pre-T-192 expression makes master push → `ubuntu-latest` (first case would go red).

## Item 2 — ci-status names never-started separately

**Change:** `checkCiStatus` in `checks-state.ts` now:
1. `gh run list --json conclusion,headSha,status,databaseId`
2. On failure, `gh run view <id> --json jobs` for job `test`
3. When `test` has zero steps, `gh api repos/{owner}/{repo}/check-runs/<id>/annotations`
4. Classifies as `never started` when an annotation message begins `The job was not started because`

**Limit (in every message):** `limit: job test only; check-run annotations fetched only when that job has zero steps`

**Tests:** red-first rows on recorded fixtures in `open-brain/tests/fixtures/ci-status/`:
- never-started: run 36308772222 / job 108590501268
- success: run 36305346883
- real failure: run 36308414840 (Test step failed after steps ran)
- Mutant: `classifyCiConclusion(..., foldNeverStarted=true)` folds back to `failure`

## Checks run (this tree)

```
npx tsc --noEmit -p open-brain
npm test -- tests/pipelines/sync/ci-runs-on.test.ts tests/pipelines/sync/checks-state.test.ts
→ 23 passed
```

## Not observable before merge

First real master push on tcm after merge — planner acceptance read per brief.

## Token usage

Cursor did not report token usage in this session.
