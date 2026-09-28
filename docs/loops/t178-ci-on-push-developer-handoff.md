# T-178 — CI on push to seat branches (record 205)

**By:** Forge (developer). This Cursor seat had no `SESSION_UUID`, so `ob_set_session` was not bound.
**Model / effort:** Grok 4.7, in Cursor. This transcript has no Claude Code per-entry `effort` field, so none is reported.
**Branch:** `loop/t178-ci-on-push` from `origin/master` `d1e8674`. Product **`bc6c6d2`**. This handoff is the commit after it.
**Push is held** until the planner posts that QA 202-204 has ended. Nothing from this round is on the remote.
**No CI was dispatched.** D-061. No `/end`. This seat did not write the live `.agents/state.json`.
**GitNexus:** this worktree has no `.gitnexus/`, and this session has no GitNexus MCP. `impact` and `detect_changes` were not run. `/sync` reports `gitnexus-index` as a skip.

**"It works" is not a claim this seat can make.** The rows parse `.github/workflows/ci.yml`, evaluate the `if` and `cancel-in-progress` expressions, and run `open-brain/scripts/ci-seat-skip.mjs` against real git repositories. They do not fire GitHub's trigger. The first real push after merge is the live test, and QA or the planner observes it.

## What the product does

`on.push.branches` is `master`, `loop/**`, `qa/**`. `on.push` has no `paths` and no `paths-ignore`. A docs-only push to master still triggers, and the `test` job runs. `workflow_dispatch` has no paths filter, and its inputs are unchanged. `test-windows` stays `github.event_name == 'workflow_dispatch' && inputs.windows`. The pull request still ignores only `docs/**` and `README.md` (D-055).

A seat push (`loop/**` or `qa/**`) runs a `changed` job on the same runner expression as `test`. That job checks out with `fetch-depth: 0` and runs `git diff --name-only --no-renames` from `github.event.before` to `github.sha`. The push payload's `commits[]` lists are not read. `skip=true` only when that command succeeds and every path is under `docs/` or is `README.md`. An empty list, a `before` of all zeros, or any git error prints `skip=false`. If the node step itself fails, the shell appends `skip=false`. The `test` job runs unless `changed` succeeded and `skip` is exactly `true`. A skipped or failed `changed` job is not success, so master, a pull request, a dispatch, and a broken preflight all run the suite.

`cancel-in-progress` evaluates to false for `refs/heads/master` and for `workflow_dispatch`, and to true for a seat push and for a pull request. A second push to master waits in `ci-master`. It is not cancelled. A seat push and its pull request still share `ci-<head_ref or ref_name>`.

## Local runs

| | Commit | Exit | Result |
|---|---|---|---|
| Red, against `02043db`, whose `contains()` list skipped `LICENSE` beside `docs/a.md` | `77ea0e0a406897a1d130ca2374d61acf00e0f10b` | **1** | 1 failed, 12 passed (13) |
| Green | `bc6c6d206a6b3261b43cccc3972fff23b5d86791` | **0** | 16 passed |
| `npx tsc --noEmit -p .` in `open-brain`, on the green tree and on each mutant before its test run | | **0** | |

Red failing line: `a seat push of a code path outside the prefix list plus a docs file still runs` — `a code file outside the prefix list was skipped because a docs file was in the same push: expected false to be true`.

The green file also runs a real repo of `docs/a.md` plus `README.md` (skip), a real repo of `open-brain/src/cli.ts` (run), a real repo of `LICENSE` plus `docs/a.md` (run), and `git diff` against `deadbeefdeadbeefdeadbeefdeadbeefdeadbeef` (run). A parsed `changed` result of `failure` with `skip=true` still runs the test job.

`/sync --check` before each commit exited **1**. Summary each time: 24 passed, 0 fixed, 4 warnings, 5 issues, 1 skipped. Those issues are already on this tree (retirements, build-freshness, probe-markers on master's three "not for merge" files, mirror-parity, greeting-size). `worktree-layout` passed.

## Mutants (local, not in the candidate)

Earlier tips on these branches were never pushed. They were replaced so each tip is this product plus one defect.

| Branch | Tip | Edit | Run |
|---|---|---|---|
| `loop/t178-ci-on-push-mut-paths` | `6280f6900932d43cd8c3ddd76e6f43c18f23593b` | `some` instead of `every`: skip when any file is docs | exit **1**. 1 failed, 15 passed. `LICENSE` plus `docs/a.md` expected the test job to run and it did not. Docs plus README still skips. The unreadable sha still runs. |
| `loop/t178-ci-on-push-mut-concurrency` | `e7f66172d8a6f47cc31be86d87bfd662853817af` | `cancel-in-progress` drops the master clause | exit **1**. 1 failed, 15 passed. The master row expected `false` and received `true`. |

Do not merge either branch.

## What came back

`5651b67` filtered every push and cancelled master. `02043db` left master unfiltered and stopped cancelling master, and decided a seat docs skip with `contains()` on `toJSON(commits)`. That list skipped a code path it did not name. This round replaces that decision with `git diff`.
