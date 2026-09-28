# T-178 — CI on push to seat branches (record 205)

**By:** Forge (developer). This Cursor seat had no `SESSION_UUID`, so `ob_set_session` was not bound.
**Model / effort:** Grok 4.7, in Cursor. This transcript has no Claude Code per-entry `effort` field, so none is reported.
**Branch:** `loop/t178-ci-on-push` from `origin/master` `d1e8674`. Product **`02043db`**. This handoff is the commit after it.
**Push is held** until the planner posts that QA 202-204 has ended. Nothing from this correction is on the remote.
**No CI was dispatched.** D-061. No `/end`. This seat did not write the live `.agents/state.json`.
**GitNexus:** this worktree has no `.gitnexus/`, and this session has no GitNexus MCP. `impact` and `detect_changes` were not run. `/sync` reports `gitnexus-index` as a skip.

**"It works" is not a claim this seat can make.** The rows parse `.github/workflows/ci.yml` and evaluate the `if` and `cancel-in-progress` expressions. They do not fire GitHub's trigger. The first real push after merge is the live test, and QA or the planner observes it.

## What the product does

`on.push.branches` is `master`, `loop/**`, `qa/**`. `docs/*` and `chore/*` are not triggers. `on.push` has no `paths` and no `paths-ignore`. A docs-only push to master still triggers. `workflow_dispatch` has no paths filter, and its inputs are unchanged. `test-windows` stays `github.event_name == 'workflow_dispatch' && inputs.windows`. The pull request still ignores only `docs/**` and `README.md` (D-055).

GitHub allows one paths filter per push event, so the seat-branch docs skip is the `test` job's `if`, not `paths-ignore`. A docs-only push to `loop/**` or `qa/**` still creates a workflow run, and the `test` job is skipped. It does not take a runner. The `if` is true for master, for any event that is not a push, and for a seat push whose `toJSON(github.event.commits)` contains a listed code prefix (`open-brain/`, `.github/`, `.agents/`, `.claude/`, `.cursor/`, `project-template/`, `scripts/`, `package.json`, `CHANGELOG.md`, `CLAUDE.md`) or does not contain `docs/` or `README.md`. `contains` reads the JSON text: a docs path or a commit message that itself contains a code prefix still runs, and a code path outside that list pushed in the same commit as a docs file can be skipped. An empty `commits` list runs.

`concurrency.group` is `ci-<head_ref or ref_name>` for a push or a pull request, so both events for one seat branch share a group and the newer run cancels the older. A `workflow_dispatch` uses `ci-dispatch-<run_id>`. `cancel-in-progress` evaluates to false for `refs/heads/master` and for `workflow_dispatch`, and to true for a seat push and for a pull request. A second push to master waits in `ci-master`. It is not cancelled.

## Local runs

| | Commit | Exit | Result |
|---|---|---|---|
| Red, against the first product (`5651b67`), which filtered every push and cancelled master | `fad556e76db0cc31b3616272dc0e7f89880d2a3f` | **1** | 2 failed, 10 passed (12) |
| Green | `02043db07603cc73089f3fa66a9bbcd18c1c7b03` | **0** | 12 passed |
| `npx tsc --noEmit -p .` in `open-brain`, on the green tree and on each mutant before its test run | | **0** | |

Red failing lines:

- `a master push whose only path is under docs still runs the test job` — `a docs-only master push did not run the test job: expected false to be true`.
- `cancel-in-progress evaluates to false for a push to refs/heads/master` — expected `false`, received `true`.

`/sync --check` before each commit exited **1**. Summary each time: 24 passed, 0 fixed, 4 warnings, 5 issues, 1 skipped. Those issues are already on this tree (retirements, build-freshness, probe-markers on master's three "not for merge" files, mirror-parity, greeting-size). `worktree-layout` passed.

## Mutants (local, not in the candidate)

The first pair (`208d9be`, `e7cf7b1`) was never pushed. Atlas sent that contract back, so those branch tips were replaced.

| Branch | Tip | Edit | Run |
|---|---|---|---|
| `loop/t178-ci-on-push-mut-concurrency` | `fa90a9352baa5bbdb37ca676bfc0fbfeec341828` | `cancel-in-progress` drops the master clause | exit **1**. 1 failed, 11 passed. The master row expected `false` and received `true`. |
| `loop/t178-ci-on-push-mut-paths` | `fb4c39ba849405eb52ec82ca4b2b0f4d2d4d4aaf` | the `test` job has no `if` | exit **1**. 1 failed, 11 passed. A seat push of `docs/a.md` and `README.md` expected `false` and received `true`. |

Do not merge either branch.

## First delivery, sent back

`5651b67` put `paths-ignore` on the whole push event, so a docs-only push to master started no run, and `cancel-in-progress` was true for every push including master. Red for that delivery was `aa1ed66`, exit 1, 3 failed, 6 passed. Atlas returned it before QA: master stays unfiltered, and a master run must not be cancelled.
