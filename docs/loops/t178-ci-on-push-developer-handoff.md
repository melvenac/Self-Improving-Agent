# T-178 — CI on push to seat branches (record 205)

**By:** Forge (developer). This Cursor seat had no `SESSION_UUID`, so `ob_set_session` was not bound.
**Model / effort:** Grok 4.7, in Cursor. This transcript has no Claude Code per-entry `effort` field, so none is reported.
**Branch:** `loop/t178-ci-on-push` from `origin/master` `d1e8674`. Product **`5651b67`**. Red **`aa1ed66`**. This handoff is the commit after the product.
**Push is held** until the planner posts that QA 202-204 has ended. Nothing here is on the remote. Mutant branches are local only.
**No CI was dispatched.** D-061. No `/end`. This seat did not write the live `.agents/state.json`.
**GitNexus:** this worktree has no `.gitnexus/`, and this session has no GitNexus MCP. `impact` and `detect_changes` were not run. `/sync` reports `gitnexus-index` as a skip for that reason.

**"It works" is not a claim this seat can make.** What follows is what ran on this machine, and what it printed. These tests parse `.github/workflows/ci.yml`. They do not execute GitHub's trigger. The first real push after merge is the live test, and QA or the planner observes it.

## What changed

`on.push.branches` is `master`, `loop/**`, `qa/**`. `docs/*` and `chore/*` from T-178's original note are not triggers: record 205 says cover `loop/**` and `qa/**`.

`on.push.paths-ignore` is `docs/**` and `README.md`, the same list as the pull request (D-055). The filter sits on the push event, so a docs-only push to **master** also starts no run. `workflow_dispatch` has no paths filter. Its inputs are unchanged. `test-windows` stays `github.event_name == 'workflow_dispatch' && inputs.windows`.

`concurrency.group` is `ci-<head_ref or ref_name>` for a push or a pull request, so both events for one branch share a group and `cancel-in-progress` drops the older run. A `workflow_dispatch` uses `ci-dispatch-<run_id>` and its `cancel-in-progress` is false, so a dispatch neither cancels a branch run nor is cancelled by one.

The D-055 row no longer says a push has no paths filter. The T-178 row owns that list.

## Local runs

| | Commit | Exit | Result |
|---|---|---|---|
| Red, tests only, against master's `ci.yml` | `aa1ed66025f8dee87d9cdd0fea0ccc024589333c` | **1** | 3 failed, 6 passed (9) |
| Green | `5651b67288e3cfaccc181bf28fe521e3c1e17949` | **0** | 9 passed |
| `npx tsc --noEmit -p .` in `open-brain`, on the green tree and on each mutant before its test run | | **0** | |

Red failing lines:

- `push branches are master, loop/**, and qa/**` — expected `['master', 'loop/**', 'qa/**']`, received `['master']`.
- `a push ignores docs/** and README.md` — expected `['docs/**', 'README.md']`, received `undefined`.
- `a push and the pull request for that branch share one concurrency group` — `concurrency is absent: expected undefined to be truthy`.

`/sync --check` before each commit exited **1**. Summary each time: 24 passed, 0 fixed, 4 warnings, 5 issues, 1 skipped. The issues are the ones already on this tree (retirements, build-freshness, probe-markers on master's three "not for merge" files, mirror-parity, greeting-size). `worktree-layout` passed. This change does not touch them.

## Mutants (local, not in the candidate)

| Branch | Tip | Edit | Run |
|---|---|---|---|
| `loop/t178-ci-on-push-mut-concurrency` | `208d9be203936b3f066f89dc02979d9597b19b61` | group is `${{ github.ref }}`, `cancel-in-progress: true` | exit **1**. 1 failed, 8 passed. The concurrency row expected the group to contain `github.head_ref \|\| github.ref_name` and received `${{ github.ref }}`. |
| `loop/t178-ci-on-push-mut-paths` | `e7cf7b15207ae2c1d3c5378dacd19fb26b3a1bde` | push has no `paths-ignore`; the pull request list stays | exit **1**. 1 failed, 8 passed. The paths row expected `['docs/**', 'README.md']` and received `undefined`. |

Both mutants passed `tsc --noEmit` before the test run. Do not merge either branch.
