# T192-D1 and the T-048 score rows — developer handoff

**By:** Forge (developer), record **193**. This Cursor seat had no `SESSION_UUID`, so `ob_set_session` was not bound.
**Model / effort:** Grok 4.7, in Cursor. This transcript has no Claude Code per-entry `effort` field, so none is reported.
**Candidate:** `loop/t192-d1` at **`ecd378d`**. Product commit on top of the red tests `6901c1f`. Base `origin/master` `bf33fe4`.
**Brief:** `docs/loops/session-147-dispatches.md` at `76342aa` on `origin/docs/session-100-qa99-dispatch`, section Record 193.
**No `/end`.** This seat did not write the live `.agents/state.json`.

**"It works" is not a claim this seat can make.** What follows is what ran, and what it printed.

## What changed

`open-brain/src/pipelines/sync/checks-state.ts`, in `checkCiStatus`, after a successful `gh run view`:

- No job named `test` (including a view with no `jobs`): `failure (steps not read: job test absent in run view)`. The replay's phrase is the reason. The sibling cases already say `steps not read:`.
- A `test` job whose `steps` is not an array (omitted or `null`): `failure (steps not read: steps field missing)`.
- `steps: []` stays `never-started`.

The T-048 rows did not change the product. On the red run they already passed.

## Runs

`workflow_dispatch` of `ci.yml`. `hosted` and `windows` left unset. `test-windows` skipped. Five runs of the six allowed.

| | SHA | tcm run | Result |
|---|---|---|---|
| Red, tests on the unfixed check | `6901c1f` | [36358778248](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36358778248) | **failure.** 2 failed, 1801 passed, 6 skipped (1809). |
| Green | `ecd378d` | [36359004908](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36359004908) | **success.** 1803 passed, 6 skipped (1809). 130 files. |
| Mutant, plain failure again | `ea90542` on `loop/t192-d1-mut-plain` | [36359245803](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36359245803) | **failure.** 2 failed, 1801 passed, 6 skipped (1809). |
| Mutant, shared suffix | `dc449ee` on `loop/t192-d1-mut-score` | [36359302570](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36359302570) | **failure.** 3 failed, 1800 passed, 6 skipped (1809). Too wide. Not the item's mutant. |
| Mutant, the two server routes | `2232d7f` on `loop/t192-d1-mut-routes` | [36360002881](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36360002881) | **failure.** 2 failed, 1801 passed, 6 skipped (1809). Only the two new rows. |

The red log, headSha `6901c1faff7d83017143c0c537b429e6bc7d61a7`:

- `a run view with no test job names that absence` — expected `failure (steps not read: job test absent in run view)`, received `conclusion: failure`.
- `a test job whose steps field is missing names that` — expected `failure (steps not read: steps field missing)`, received `conclusion: failure`.

Same log, both new T-048 rows passed: `the two score routes name a missing invocation log`, `the two score routes name an unreadable invocation log`.

`loop/t192-d1-mut-plain` drops the two names. Same two rows, same expected and received strings. The T-048 rows stayed green. Not in the candidate history.

`loop/t192-d1-mut-score` edits `invocationLogSuffix` so `missing` and `unreadable` print like `ran`. That killed the two new server rows and also `tests/t048-r2b.test.ts` D1, which reads the CLI line and expected `(invocation log: unreadable)` and received `Pipeline Health: 0/10` with no parenthetical. The shared helper is not the two routes. That branch is not the item's mutant.

`loop/t192-d1-mut-routes` edits only the two `server.ts` score loops (`handleSync` with `score`, `handleScore`). They drop a suffix of ` (invocation log: missing)` or ` (invocation log: unreadable)`. `invocationLogSuffix` is unchanged, so the CLI line still names those states. tcm run `36360002881`, headSha `2232d7ffae91faa3ca64088b8255a7e8f4a3bdc2`, failed exactly those two rows. `test-windows` skipped. Locally, before the push: `t048-r2b.test.ts` passed (7), `checks-state.test.ts` passed (22), `npx tsc --noEmit -p .` exited 0.

None of the mutant branches belong in the candidate. Do not merge them.

## What is not shown

- **GitNexus `impact` / `detect_changes`:** not run. This worktree has no `.gitnexus/`, and this session has no GitNexus MCP.
- **No laptop (`windows=true`) CI.**
- `/sync` before the red and green commits exited 1 on issues already on the tree: retirements (ENTITIES.md names dream and reflection queue), build-freshness (local stamp `a1f5baf`), mirror-parity (`end.md`), greeting-size over 40000. `worktree-layout` passed (walked 7).
