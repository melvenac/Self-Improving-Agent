# T-193 developer handoff — worktree-layout

**By:** Forge (developer). This Cursor seat had no `SESSION_UUID`, so `ob_set_session` was not bound.
**Model / effort:** Grok 4.7, in Cursor. This transcript has no per-entry effort field, so none is reported.
**Base:** `origin/master` `677c1dd`.
**Branch:** `loop/t193-worktree-check`.
**Brief:** `docs/loops/session-147-dispatches.md` on `origin/master`, section Record 186.
**No `/end`.** The live `.agents/state.json` was not written.
**GitNexus `impact` / `detect_changes`:** not run. This worktree has no `.gitnexus/`, and this session has no GitNexus tools. `runSync`'s signature is unchanged; it gains one check result.

**"It works" is not a claim this seat can make.** What follows is what ran, and what it printed.

## What the check does

`worktree-layout` walks `git worktree list --porcelain` and parses records (key, then the rest of the line). The first record is the main checkout. Every later record's folder must be `<project>-<seat>`. Project and seats are read from `.agents/SYSTEM/worktree-seats.json`, not from the checker. No file is a skip. Unreadable JSON, a failed `git`, or porcelain that does not parse is an issue. Every message states:

`LIMIT: sees registered worktrees only. An orphan directory with no git registration is not seen.`

Pass and issue messages also state `Walked N worktree(s)`. `report: true`, so a pass is printed.

## Seat file (owed to Relay)

Path: `.agents/SYSTEM/worktree-seats.json`. Where `.agents/` is gitignored, the allowlist line is `!/.agents/SYSTEM/worktree-seats.json`, after `/.agents/SYSTEM/*`.

```json
{
  "project": "sia",
  "seats": ["planner", "builder", "forge", "infra", "research", "qa"]
}
```

A folder passes when its name is exactly `<project>-<seat>`. `project` and each seat are tokens (`^[A-Za-z0-9][A-Za-z0-9-]*$`). Extra keys are ignored. A2A-Hub, as a docs-only change:

```json
{ "project": "a2a", "seats": ["planner", "rivet", "qa"] }
```

That accepts `a2a-planner`, `a2a-rivet`, and `a2a-qa`.

## Runs

`workflow_dispatch` of `ci.yml`. `hosted` and `windows` left unset. `test-windows` skipped.

| | SHA | tcm run | Result |
|---|---|---|---|
| Red | `ea52b80` | [36315913592](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36315913592) | **failure.** 5 failed, 1659 passed, 6 skipped (1670). The check returned `pass` / `worktree-layout does not classify worktrees`. |
| Green | `683b61c` | [36316160629](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316160629) | **success.** 1664 passed, 6 skipped (1670). 122 files. |
| Mutant: any folder name | `loop/t193-worktree-check-mut-any` `19d5c38` | [36316403690](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316403690) | **failure.** The loop-named row only. 1 failed, 1663 passed, 6 skipped. It received `pass` and `Walked 3`. |
| Mutant: hard-coded seats | `loop/t193-worktree-check-mut-hardcode` `cbfee4a` | [36316497065](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316497065) | **failure.** 2 failed, 1662 passed, 6 skipped. The different-seat row (`proj-alpha` is not `sia-<seat>`). The no-file row also failed: dropping the read removes the skip, so `loop-t193` in that fixture is an issue. |

The five red failures, each the final row:

- loop-named folder: expected `issue`, received `pass`
- main checkout and seat folder: message did not contain `Walked 2`
- no seat file: expected `skip`, received `pass`
- different seat list (`proj` / `alpha`): message did not contain `Walked 2`
- git failing to list: expected `issue`, received `pass`

The wiring row passed on the red run. `test-windows` was skipped on every run. Four tcm runs. The product CI is `683b61c`. This handoff commit does not change the checker, so it was not given a fifth run.

The mutants are not in this branch's history.

## This machine, after the classifier was restored locally

`checkWorktreeLayout` on `sia-builder` printed `issue`, `Walked 11 worktree(s)`. Named:

- folder `tip`, detached at `e222124f456c732dd3d6c0a02e387207b7781e1f`
- folder `tip`, detached at `d500730953db3f69ef528f431474477149757383`
- folder `wt-iso`, branch `refs/heads/chore/laptop-runner-isolation`
- folder `sia-r5-probe-e2f`, detached at `e2f202be6ec0c412e7564d8807ef87e7793bc1cb`

The main checkout and `sia-builder`, `sia-forge`, `sia-infra`, `sia-planner`, `sia-qa`, `sia-research` were not named. `/sync --check` on this tree still exits 1. Besides `worktree-layout`, the issues were already present on `677c1dd` here: `retirements`, `build-freshness` (this checkout's build stamp), `mirror-parity`, `greeting-size`.
