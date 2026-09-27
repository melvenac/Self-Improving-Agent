# /bootstrap round 4 developer handoff

**By:** Forge (developer), record session **156**. This Cursor seat had no `SESSION_UUID`, so `ob_set_session` was not bound.
**Model / effort:** Grok 4.7, in Cursor. This transcript has no Claude Code per-entry `effort` field, so none is reported.
**Candidate:** `loop/bootstrap-fix-r4` at **`7bd47f4`** (R-BF-21). `856d413` is the round before that amendment. The brief named `origin/loop/bootstrap-fix-r3` (`7f4ca74`). That branch had already moved to the handoff `ee3acce`; round 4 is stacked on that, and `7f4ca74` is an ancestor.
**Brief:** `docs/loops/t171-bootstrap-rulings-qa144-qa145.md` on `origin/docs/session-100-qa99-dispatch`, the QA 145 section and the Briefs. Read only what that section names.
**No `/end`.** The live `state.json` was not written. Tests use scratch directories.

**"It works" is not a claim this seat can make.** What follows is what ran, and what it printed.

## What this round changed

| Protection | What the code does now |
|---|---|
| **R-BF-17** | `state.json` is a record only when it is a JSON object that carries `schema_version`. Anything else is `NOT A RECORD — state.json is <what it is>`, and `move-residue` sets it aside. `{}` and `{"project":{}}` are `a JSON object with no schema_version`. `[]` `null` `42` `"text"` `true` are `JSON array` / `JSON null` / `JSON number` / `JSON string` / `JSON boolean`. An older schema that carries `schema_version` is still a record. |
| **R-BF-18** | In `isProjectRoot`, `.agents/state.json` is a root marker only when that file is a record. `.agents/SYSTEM` and `.agents/META` are unchanged. A zero-byte file between a record and the cwd does not win the walk. |
| **R-BF-19** | The nested STOP's `Next:` is `STOP: this folder is inside another repository (<toplevel>). \`git init\` here makes this folder its own project, or move the folder out of the enclosing repository.` `project-template/.claude/commands/bootstrap.md` step 1 says the same. |
| **R-BF-20** | When a residue move cannot be undone, `formatMoveResidueFailure` returns `bootstrap move-residue — not undone:` and names what moved, where, and what stayed. That line does not say `refused`. The CLI prints that function and nothing else. |
| **R-BF-21** | `bootstrap move-residue` does not read an environment variable and does not import a code file. `git grep` finds no `OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK` in `open-brain/src/`. The undo row calls `moveResidue` with an injected `rename`, then passes the thrown error through `formatMoveResidueFailure`. |

`whyNotARecord` / `isStateRecord` live in `open-brain/src/shared/state-record.ts`, so bootstrap and the root walker share one definition.

`open-brain/tests/pipelines/bootstrap-fix.test.ts` used `{}` as a stand-in for a record. That file is now an object carrying `schema_version`, so the row still checks that a real record is not moved. `{}` is covered by the R-BF-17 row.

## Rows

`open-brain/tests/pipelines/bootstrap-fix-r4.test.ts`:

- R-BF-17: QA 145's seven shapes, through `bootstrap check` and `move-residue`.
- R-BF-18: a zero-byte `.agents/state.json` between a record (no `SYSTEM`/`META`) and the cwd. `isProjectRoot` on the nearer directory is false, and `resolveRepoRoot` returns the record. Dropping the `state.json` clause (QA's Q6) makes the record invisible.
- R-BF-19: install N's shape (untracked `tools/csvtool` inside a parent repository). `Next:` names both remedies, step 1 of `bootstrap.md` says the same, and `git init` in the child leaves the STOP.
- R-BF-20: QA's P-UNDO shape. `moveResidue` is called with an injected `rename` (first entry moves, the undo cannot put it back). The thrown error goes through `formatMoveResidueFailure`.
- R-BF-21: `git grep OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK -- open-brain/src` finds nothing.

## Runs

`workflow_dispatch` of `ci.yml`. `hosted` and `windows` left unset. `test-windows` did not run. Six runs, the budget.

| | SHA | tcm run | Result |
|---|---|---|---|
| Red, tests plus the inert rename hook | `6e21800` | 36292493433 | **failure.** 1 file failed, 89 passed (90). **10 failed, 1368 passed, 2 skipped** (1380). The ten are the new rows. |
| Green | `856d413` | 36292685700 | **success.** 90 files, **1378 passed, 2 skipped** (1380). `test-windows` skipped. |
| Mutant R-BF-17 | `loop/bootstrap-fix-r4-mut-bf17` `b5f157e` | 36292739711 | **failure.** **7 failed, 1371 passed, 2 skipped** (1380). The other three new rows stayed green. |
| Mutant R-BF-18 (Q6) | `loop/bootstrap-fix-r4-mut-bf18` `c1c9c73` | 36292782633 | **failure.** 1 failed: the zero-byte walk (`isProjectRoot` on the record was false). 1377 passed, 2 skipped. |
| Mutant R-BF-19 | `loop/bootstrap-fix-r4-mut-bf19` `e730662` | 36292811280 | **failure.** 1 failed: install N's `Next:` was the old goal sentence. 1377 passed, 2 skipped. |
| Mutant R-BF-20 | `loop/bootstrap-fix-r4-mut-bf20` `94b4a5d` | 36292846089 | **failure.** 1 failed: P-UNDO. The log line still names `aaa`, the archive path, and `bbb.json`, and it says `refused`. 1377 passed, 2 skipped. |

## R-BF-21 (amendment on `856d413`)

The rename hook does not ship. `formatMoveResidueFailure` is what the CLI prints. `hosted` and `windows` left unset.

| | SHA | tcm run | Result |
|---|---|---|---|
| Red: the message function is not exported, and `src/` still names the hook | `08b7ab9` | 36294152464 | **failure.** 2 failed (the message function, and the `git grep`), 1377 passed, 2 skipped (1381). |
| Green | `7bd47f4` | 36294196644 | **success.** 90 files, **1379 passed, 2 skipped** (1381). `test-windows` skipped. |
| Mutant: the undo line says `refused` again | `loop/bootstrap-fix-r4-mut-bf21` `2a30b19` | 36294232450 | **failure.** 1 failed: P-UNDO through `formatMoveResidueFailure`. The `git grep` row stayed green. 1378 passed, 2 skipped. |

## Not this round (for the planner to file; this seat did not write `state.json`)

- **`/start`'s fallback for non-objects.** The ruling leaves it as a task. This round does not change `handleStart`.
- **Open 2's second narrowing.** `sync`'s auto-fix refusing a root that is not the directory it was given is not ruled. It stays a task.

## What is not shown

- **GitNexus `impact` / `detect_changes`:** not run. This worktree has no `.gitnexus/` (`gitnexus-index` skips). A stale index answers with a confident wrong blast radius.
- **`ob_sync` `check_only`**, before the red commit, on this tree: `22 passed, 0 fixed, 4 warnings, 4 issues, 1 skipped`. Issues named: `retirements`, `build-freshness` (this checkout's build is from `a1f5baf`, HEAD was then `ee3acce`; hooks and the MCP server run from the main checkout), `mirror-parity` (`end.md` / `sync.md` mirrors), `greeting-size`. `state-schema` passed (schema v2, rev 131). It was not migrated.
- **No laptop (`windows=true`) CI.**
