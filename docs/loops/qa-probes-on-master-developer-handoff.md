# QA probes on master — developer handoff

**By:** Forge (developer), record **198**. This Cursor seat had no `SESSION_UUID`, so `ob_set_session` was not bound.
**Model / effort:** Grok 4.7, in Cursor. This transcript has no Claude Code per-entry `effort` field, so none is reported.
**Branch:** `loop/qa-probes-on-master` from `origin/master` `bf33fe4`. Local tip after this handoff is the commit that adds this file. Product commit **`dabc7fe`**. Red commit **`fc7f7a0`**.
**Push and tcm are held.** The brief says not to push and not to dispatch until the planner posts that the QA 195-197 queue has ended. Nothing here is on the remote. Mutant branches are local only.
**No `/end`.** This seat did not write the live `.agents/state.json`.

**"It works" is not a claim this seat can make.** What follows is what ran on this machine, and what it printed.

## What changed

QA-named files under `open-brain/tests/`:

- **Removed** `tests/harness/qa104-a9-probe2.test.ts` and `qa104-a9-probe3.test.ts`. Both headers said they were not for merge. They are probes of candidate A9. Probe 2 is the file Windows CI run `36358221545` failed, `EPERM` from `symlinkSync`. The R72/R73 behavior they probed stays in the configwatch rows.
- **Kept** `tests/pipelines/state-import-qa138.test.ts`. The header no longer says it is not for merge. It guards an odd-length UTF-16BE mark, a read file with no title line, the no-title rule on `task.md` and `next-session.md`, a named NUL byte, and an empty file. Locally, 10 passed.
- **Kept** `state-import-qa122.test.ts`, `qa135-bootstrap.test.ts`, and `qa142-t003.test.ts`. On `bf33fe4`, before the header edit, those three files passed together: 17 tests, exit 0. The headers now say what each guards. They do not say they are not for merge.

`symlinkSync` in the harness tests goes through `symlinkSyncOrSkip`. `EPERM` skips the current test. The reason is `skipped — symlinkSync returned EPERM (no symlink privilege on Windows). This is not a pass.` Any other error is thrown. Rows that already use `it.skipIf(win32)` still skip before the call. A call that is reached and returns `EPERM` does not pass.

`checkProbeMarkers` walks `open-brain/tests`. A file containing the literal phrase is an issue naming the file. A missing tests directory is an issue and says it is not a pass. A clean tree passes and says how many files were read. After the rebuild, `/sync` printed: `probe-markers [pass]: Read 166 file(s) under open-brain/tests; none contain "not for merge".`

## Local runs

Red, `fc7f7a0`, the rows against the unfixed stubs. `npx vitest run tests/pipelines/sync/probe-markers.test.ts tests/harness/symlink-or-skip.test.ts` exited **1**. 6 failed, 1 passed.

- probe phrase: expected severity `issue`, received `pass`. Message was `probe-markers does not read open-brain/tests`.
- missing tests directory: expected `issue`, received `pass`.
- clean tree: expected the message to contain `Read 2`, received `probe-markers does not read open-brain/tests`.
- EPERM skip: expected the call to throw `/skipped/`, received `EPERM: operation not permitted, symlink 'target' -> ...`.

Green, `dabc7fe`, the same two files plus `state-import-qa138.test.ts`. Exit **0**. 18 passed.

## Mutants (local, not pushed, not in the candidate)

| Branch | SHA | What it changes | Local vitest |
|---|---|---|---|
| `loop/qa-probes-on-master-mut-phrase` | `6bff80c` | the check looks for the phrase in uppercase only | exit **1**. 1 failed, 4 passed. The phrase row expected `issue` and received `pass`. |
| `loop/qa-probes-on-master-mut-eperm` | `c6af8d7` | `EPERM` returns without skipping | exit **1**. 2 failed, 1 passed. The injected `EPERM` expected a throw and got none. The real `symlinkSync` on this machine then failed `lstat` with `ENOENT` because no link was created and the test was not skipped. |

Do not merge either mutant branch.

## What is not shown

- **No tcm run.** Held until the planner says the QA 195-197 queue has ended. At most 6 runs after that.
- **GitNexus `impact` / `detect_changes`:** not run. This worktree has no `.gitnexus/`.
- `/sync` before the commits exited 1 on issues already on the tree (retirements, build-freshness stamp, mirror-parity, greeting-size). `probe-markers` passed after `npx tsc -p .` rebuilt `open-brain/build`.
