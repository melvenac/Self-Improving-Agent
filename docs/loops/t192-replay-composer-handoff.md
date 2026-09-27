# T-192 replay — Composer 2.5 developer handoff (record 184 / 184b)

**By:** cursor-infra (Forge seat), record session **184**, 2026-09-27, in `~/Worktrees/sia-infra`.
**Model:** Composer 2.5. **Base:** `7243fd5`. **Branch:** `loop/t192-replay-composer`.

## Round 184b — Atlas findings R184-1..4

### R184-1 — evaluate ci.yml expression, not a hard-coded function

- Evaluator lives in **tests only**: `readCiTestRunsOnExpr` + `evaluateRunsOnExpression` in
  `open-brain/tests/pipelines/sync/ci-runs-on.test.ts` (YAML parse + `Function` on the `${{ … }}` string).
- Four cases read the expression from the tracked `ci.yml`.
- Mutant: scratch copy with pre-T-192 `runs-on` restored; master-push row expects tcm, gets `ubuntu-latest`.

### R184-2 — red-first on tcm (workflow_dispatch, hosted=false)

| Run | ID | Result | Why |
|-----|-----|--------|-----|
| red-first (before fix) | **36310020528** | failure | tcm; vitest red on intentional `tcm-red-seed` assertion (bcbdd7f) |
| green (184b fix) | **36310124469** | success | tcm; all 20 T-192 tests pass (2901538) |
| mutant ci.yml master-push clause | **36310226139** | failure | tcm; master-push row evaluates to ubuntu-latest (7c02c7d) |

Runner proof: run 36310020528 step **Egress isolation self-check (tcm)** succeeded.

### R184-3 — ci-status names inconclusive cases

`classifyCiConclusion` + `checkCiStatus` now report:
- `failure (run view failed; …)`
- `failure (run view not JSON; …)`
- `failure (job test absent in run view)`
- `failure (zero steps on job test; annotations fetch failed)`
- `failure (zero steps on job test; annotations not JSON)`
- `failure (zero steps on job test; no never-started annotation prefix)`

Mutant: `silentFallback: true` → plain `failure` (test in checks-state.test.ts).

### R184-4 — no runtime evaluator

Removed `open-brain/src/pipelines/sync/ci-runs-on.ts`; evaluator is test-only.

## Token usage

Cursor did not report token usage in this session.
