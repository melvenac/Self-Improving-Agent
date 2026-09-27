# T-192 (master's CI to tcm; `ci-status` never-started; D-055 docs-PR skip), candidate `a38ff92`: QA report (QA seat, record session 183)

**By:** the QA seat, record session **183**, headless. 2026-09-27 (UTC). **Machine:** `DESKTOP-O4EGB1E`
(`$env:COMPUTERNAME`). **Model:** `composer-2.5` (per dispatch; Cursor did not surface token usage in this
headless run). **Dispatch:** `docs/loops/t192-dispatch-qa.md`. **Candidate:** `a38ff92` on `origin/loop/t192-ci-tcm`
(handoff `9678534`, `docs/loops/t192-developer-handoff.md`). **Base:** `origin/master` `7243fd5`. **Brief:** Record
181 in `docs/loops/session-147-dispatches.md`. **Nothing live was written.**

## Verdict

**ACCEPT `a38ff92`.** Master's `jobs.test.runs-on` sends every run, including a master push, to tcm; only
`inputs.hosted == true` selects `ubuntu-latest`. `evalRunsOn` parses the live `ci.yml` expression and evaluates `&&`/`||`
with operand-return semantics matching GitHub's documented rules; all four dispatch cases pass against the parsed
string. `ci-status` names a zero-step `test` job as `never-started` (not `failure`), names unreadable step lists on
view failure, unparseable JSON, and missing `databaseId`, and leaves a real failure and a success unchanged. D-055's
`pull_request.paths-ignore` is exactly `docs/**` and `README.md`; `push` and `workflow_dispatch` carry no path filter.
Preserve holds: egress self-check runs on self-hosted jobs, `test-windows` stays opt-in, the job stays named `test`.
Developer red-first rows, greens, and mutants on tcm match the handoff; my two QA-only mutants each kill one row on
tcm.

- **Low (test gap):** `evalRunsOn` covers only four event/`hosted` combinations. An expression that adds
  event-specific terms (`pull_request`, `schedule`, …) invisible to those four cases could diverge from GitHub while
  the suite stays green. The current expression uses only `inputs.hosted`, `&&`, `||`, and `fromJSON`, so the evaluator
  is sufficient for what ships; the gap is coverage, not a product mismatch today.
- **Low (product edge):** when `gh run view` succeeds but the `test` job is absent or its `steps` field is missing (not
  an empty array), `checkCiStatus` falls through to plain `conclusion: failure` without naming that the step list was not
  read. Recorded billing runs use `steps: []`; this path is untested.

## The dispatch's checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | **`runs-on`:** master push → tcm; dispatch → tcm; dispatch `hosted=true` → `ubuntu-latest`; non-master push → tcm. `evalRunsOn` vs GitHub `&&`/`||` operand rules. Could a four-case evaluator pass while the real expression differs? | **Holds**, with the coverage caveat above. Expression at `ci.yml:51` is `inputs.hosted && 'ubuntu-latest' \|\| fromJSON('["self-hosted", "linux", "tcm"]')`. `evalRunsOn` (`ci-runs-on.test.ts:21-93`) tokenizes the parsed `${{ … }}` string; `&&` binds tighter than `\|\|`; each operator returns its operand when truthy/falsy per GitHub. Four rows pass locally and on tcm green `36308198672`. **False-positive class:** an edit that only changes behaviour for untested `github.event_name` values (e.g. adding a `pull_request` clause) would not be caught. Pinning the string without evaluation would not prove the four outcomes. Developer mutant `e3385dd` (master-push clause restored) kills the master-push row on tcm `36306840333`. | `ci-runs-on.test.ts`; tcm `36308198672`, `36306840333` |
| 2 | **`ci-status`:** zero steps → `never-started`; unreadable step list named (view fails, unparseable, no `databaseId`); real failure and success unchanged. Any path that reports without having looked? | **Holds** on all tested rows. On `conclusion: failure` with `databaseId`, the check calls `gh run view --json jobs`; `test` with `steps: []` → `never-started` with LIMIT line (`checks-state.ts:185-191`). View error, bad JSON, and missing `databaseId` each append `(steps not read: …)` (`checks-state.ts:170-172, 175-182, 259-262`). Real failure (10 steps) and success unchanged (`checks-state.test.ts:217-233`). **Untested fall-through:** view succeeds but `test` job missing or `steps` undefined → plain `failure` without a "steps not read" suffix (`checks-state.ts:184-194`). Developer mutants: never-started folded (`36306866860`), unread fall-through restored (`36307665393`). | `checks-state.test.ts`; tcm `36306866860`, `36307665393` |
| 3 | **D-055:** `pull_request.paths-ignore` exactly `docs/**` and `README.md`; `push` and `workflow_dispatch` unfiltered; PR touching `.agents/state.json` still runs | **Holds on YAML structure.** `ci.yml:10-12` matches exactly; push and dispatch have no `paths`/`paths-ignore` keys (`ci-runs-on.test.ts:133-144`). A PR that changes only `.agents/state.json` is not in `paths-ignore`, so GitHub would still trigger CI — not exercised in CI here (no PR opened), but the filter list is correct. | `ci.yml`; `ci-runs-on.test.ts` D-055 row |
| 4 | **Preserve:** egress self-check on every self-hosted job; `test-windows` opt-in; job named `test` | **Holds.** Egress step `if: runner.environment == 'self-hosted'` (`ci.yml:56-57`); ran on green `36308198672` step 2. `test-windows` gated on `workflow_dispatch && inputs.windows` (`ci.yml:97`). Job key and name `test` (`ci.yml:46`). Dispatch inputs `hosted` and `windows` unchanged. | `ci.yml`; tcm `36308198672` (egress step success) |
| 5 | **Not verifiable before merge:** first real master push landing on tcm | **Unrun.** Named. All branch runs were `workflow_dispatch`; developer handoff states the same. Post-merge master push runner name is the planner's acceptance read. | — |
| 6 | **My mutants,** at least two | **Two QA-only mutants**, both kill one row on tcm. | Mutants table |

## Mutants

| Row | Mutant | What it breaks | Local kill | tcm run | tcm kill |
|---|---|---|---|---|---|
| D-055 | `qa/t192-mut-d055-agents-ignore` `c51aad0` (**QA-only**) | adds `.agents/**` to `paths-ignore` | **yes** — D-055 row | `36351923059` | D-055 row only: **1 failed, 1432 passed, 2 skipped (1435)** |
| Preserve | `qa/t192-mut-egress-off` `8084c8d` (**QA-only**) | egress `if` changed to `runner.environment == 'github-hosted'` | **yes** — preserve row | `36351924217` | preserve row only: **1 failed, 1432 passed, 2 skipped (1435)**; egress step **skipped** on tcm |
| runs-on | `loop/t192-ci-tcm-mut-runs-on` `e3385dd` (developer) | master-push clause restored | *(developer)* | `36306840333` | master-push row only |
| never-started | `loop/t192-ci-tcm-mut-started` `6dbf529` (developer) | zero-step → plain `failure` | *(developer)* | `36306866860` | never-started row only |
| unread steps | `loop/t192-ci-tcm-mut-unread` `6363edd` (developer) | unread fall-through restored | *(developer)* | `36307665393` | three unread rows + Loop 4 `no databaseId` row |

**Branches pushed** (read back via `push-qa.mjs`): `qa/t192-mut-d055-agents-ignore` `c51aad0`;
`qa/t192-mut-egress-off` `8084c8d`.

## CI

- **Developer red** `296f899` run `36306777724`: **failure** — master-push/ubuntu and never-started rows (per handoff).
- **Developer green** `53d3638` run `36306815299`: **success** — **1429 passed, 2 skipped (1431)**; egress ran; `test-windows` skipped.
- **Developer red (181b)** `aa19498` run `36307585948`: **failure** — three unread-step rows.
- **Developer green (181b)** `029b4a4` run `36307618596`: **success** — **1432 passed, 2 skipped (1434)**.
- **Developer red (D-055)** `dc2dc94` run `36308121998`: **failure** (per handoff; paths-ignore row).
- **Developer green (D-055)** `a38ff92` run `36308198672`: **success** — **1433 passed, 2 skipped (1435)**; egress step ran on tcm; `test-windows` skipped.
- **Developer mutants:** `36306840333`, `36306866860`, `36307665393`, `36308231327` — each **1 failed** on its named row (verified `36306840333` log: master-push row only).
- **My CI:** **2 of 6** tcm runs (`workflow_dispatch`, `hosted=false`, no Windows). Both **failure** on the intended row only, as above. No run for the candidate itself — developer green `36308198672` is the record.

## Defects

| ID | Severity | Defect | Where |
|---|---|---|---|
| T192-D1 | Low (edge) | `checkCiStatus` falls through to plain `failure` when `gh run view` succeeds but the `test` job is absent or `steps` is not an empty array (e.g. undefined). No "steps not read" suffix. | `checks-state.ts:184-194` |
| T192-D2 | Low (test gap) | `evalRunsOn` four cases do not cover `pull_request` or other `github.event_name` values; event-specific expression edits could pass locally while diverging on GitHub. | `ci-runs-on.test.ts` |
| T192-D3 | Low (test gap) | D-055 row asserts YAML only; no automated check that a docs-only PR skips CI or a `.agents/state.json` PR runs. Acceptable pre-merge; post-merge PR behaviour is planner observation. | `ci-runs-on.test.ts:133-144` |

## Disagreements

None with the developer's CI numbers, mutant kills, or the three product goals (tcm runs-on, never-started naming, D-055 filter).

## Error entries (my own)

- `docs/loops/qa-183/push-qa.mjs` is not on `a38ff92`; copied from the dispatch text into the worktree before pushing. Pushes succeeded with read-back on both mutant branches.

## Open for the planner

None block the merge.

1. **T192-D1:** add rows for `test` job missing from view and `steps` undefined — expect either `never-started` or an explicit `(steps not read: …)` line, not silent plain `failure`.
2. **T192-D3:** after merge, open a docs-only PR and a `.agents/state.json` PR to confirm GitHub's path filter behaviour on the live repo.

## Reproduce

Candidate at `a38ff92`. Local subset:

```
cd open-brain
npx tsc --noEmit -p .
npx vitest run tests/pipelines/sync/ci-runs-on.test.ts tests/pipelines/sync/checks-state.test.ts
```

Mutants and CI:

```
node docs/loops/qa-183/push-qa.mjs qa/t192-mut-<name>
gh workflow run ci.yml --ref qa/t192-mut-<name> -f hosted=false
```

No PR, no `/end`, and no live `state.json` was written.

QA-183: REPORT COMPLETE
