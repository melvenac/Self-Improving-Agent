# T-192 developer handoff — master's CI moves to tcm

**By:** Forge (developer), record session **181**. This Cursor seat had no `SESSION_UUID`, so `ob_set_session` was not bound.
**Model / effort:** Grok 4.7, in Cursor. This transcript has no Claude Code per-entry `effort` field, so none is reported.
**Candidate (181b):** `loop/t192-ci-tcm` at **`029b4a4`**, after `53d3638` (the runs-on and never-started fix), from `origin/master` `7243fd5`.
**Brief:** `docs/loops/session-147-dispatches.md` on `origin/docs/session-100-qa99-dispatch` (`418e75a`), section Record 181.
**No `/end`.** The live `.agents/state.json` was not written.

**"It works" is not a claim this seat can make.** What follows is what ran, and what it printed. The first real master push landing on tcm is not observable until after Aaron merges. That run's runner name is the planner's acceptance.

## What this round changed

`jobs.test.runs-on` is `inputs.hosted && 'ubuntu-latest' || fromJSON('["self-hosted", "linux", "tcm"]')`. Only a dispatch with `hosted=true` selects `ubuntu-latest`. The job name stays `test`. The egress self-check still runs when `runner.environment == 'self-hosted'`, so a master push on tcm runs it. `test-windows` stays opt-in. Dispatch inputs are unchanged.

`ci-status` reads `gh run list` (`databaseId`, `conclusion`, `headSha`, `status`). On `conclusion: failure` it then reads `gh run view <id> --json jobs`. A `test` job whose `steps` array is empty is `never-started`, not `failure`. The billing annotation ("The job was not started because…", check-run `108577433405` on run `36304185040`) is not fetched. That limit is in the check's message.

The expression is evaluated by `evalRunsOn` in `open-brain/tests/pipelines/sync/ci-runs-on.test.ts`. The workflow is parsed with the `yaml` package (devDependency), not a regex. `&&` binds tighter than `||`, and each returns the value, as GitHub's expression language does. Pinning the string alone would not show the four results; the evaluator does.

## Runs

`workflow_dispatch` of `ci.yml`. `hosted` and `windows` left unset. Four runs. No full local suite on the seat: the two CI files only.

| | SHA | tcm run | Result |
|---|---|---|---|
| Red | `296f899` | 36306777724 | **failure.** 2 failed (master push still `ubuntu-latest`; zero-step job still `conclusion: failure`). 1427 passed, 2 skipped (1431). `test-windows` skipped. |
| Green | `53d3638` | 36306815299 | **success.** **1429 passed, 2 skipped** (1431). `test-windows` skipped. |
| Mutant: master-push clause restored | `loop/t192-ci-tcm-mut-runs-on` `e3385dd` | 36306840333 | **failure.** The master-push row only. 1 failed, 1428 passed, 2 skipped. `test-windows` skipped. |
| Mutant: never-started folded into failure | `loop/t192-ci-tcm-mut-started` `6dbf529` | 36306866860 | **failure.** The zero-step row only. 1 failed, 1428 passed, 2 skipped. `test-windows` skipped. |

Recorded `gh` payloads in the never-started rows: run `36304185040` (0 steps), run `36301870766` (10 steps, a real failure), run `36304366630` (success).

## 181b — an unread step list is not a plain failure

When `conclusion` is `failure` and the check cannot see the steps, the message names that. `gh run view` failing uses the error's first line. A view that does not parse says `unparseable job list`. A list row with no `databaseId` says `no databaseId`. A `test` job with steps, and a zero-step job, are unchanged.

The Loop 4 failure row had no `databaseId`, so its expected message is now the `no databaseId` line.

| | SHA | tcm run | Result |
|---|---|---|---|
| Red | `aa19498` | 36307585948 | **failure.** 3 failed (view error, unparseable list, no `databaseId`). 1429 passed, 2 skipped (1434). `test-windows` skipped. |
| Green | `029b4a4` | 36307618596 | **success.** **1432 passed, 2 skipped** (1434). `test-windows` skipped. |
| Mutant: silent fall-through restored | `loop/t192-ci-tcm-mut-unread` `6363edd` | 36307665393 | **failure.** The three rows, and the Loop 4 row that now expects `no databaseId`. 4 failed, 1428 passed, 2 skipped. The zero-step row stayed green. `test-windows` skipped. |

## What is not shown

- **GitNexus `impact` / `detect_changes`:** not run. This worktree has no `.gitnexus/`.
- **No laptop (`windows=true`) CI.**
- **The first master push on tcm.** This branch's own runs were dispatches, which already ran on tcm.
