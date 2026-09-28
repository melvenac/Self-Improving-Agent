# Open P0 and P1 tasks against origin/master bf33fe4

**Seat:** Forge, Grok 4.7, worktree `C:\Users\melve\Worktrees\sia-forge`. **Record:** 199b. **Read only.**
**Record read:** `origin/master:.agents/state.json`, schema v3, rev 140. **56** tasks are P0 or P1 and not `done` (all 56 are `open`).
**No product change. No tcm. Push held** until the planner says the QA 195-197 queue has ended.
A fresh `npm run build` in `open-brain/` stamped `bf33fe47c7410c5aa9ef14f59010cc8a1b06b331` at `2026-09-28T03:38:21.504Z`. Probes used that build, in a temp directory.

Counts: **DONE 8, PARTIAL 7, OPEN 34, NOT CHECKABLE HERE 7.**

## DONE

| Id | Commit on master | Test |
|---|---|---|
| T-003 | `d781b59` (round 2; `706c029` is round 1). Both are ancestors of `bf33fe4`. | `open-brain/tests/t003-session-proof.test.ts`, `open-brain/tests/t003-r2.test.ts` |
| T-045 | `e633fcb` | `open-brain/tests/shared/paths.test.ts` — "refuses to resolve to the real vault during a test run" |
| T-150 | `686eef5` | `open-brain/tests/cli-flags.test.ts` |
| T-175 | `64901bf` | `open-brain/tests/pipelines/state-import-seeds.test.ts` ("T-175: an import carries none of SIA's own history") |
| T-180 | `bdf9ddb`, test `f6b6d44` | `open-brain/tests/pipelines/state-import-staleness.test.ts` |
| T-185 | `686eef5`, `9b36ef0` | `open-brain/tests/cli-flags.test.ts`, `open-brain/tests/shared/cli-args.test.ts` |
| T-192 | `53d3638`, `a38ff92`, merged in `2b121d9` (#189) | `open-brain/tests/pipelines/sync/ci-runs-on.test.ts` |
| T-193 | `683b61c` | `open-brain/tests/pipelines/sync/worktree-layout.test.ts` |

Fresh build, temp cwd, exit 2, token named: `sync --bogus`, `sync -dry-run`, `sync --check-only`, `detach -dry-run`, `state migrate -dry-run`, `start --bogus`. That is T-150 and T-185 on the build, not the stale one.

## PARTIAL

- **T-046.** On master the PowerShell wrapper is not fixed in this repo. A detector exists only on unmerged `loop/t046-detector` (`3af41f5`). Not on `bf33fe4`.
- **T-048.** The audit and the named SILENT rounds are on master: `4da0fe0`, `7913c5f`, `d5b78cb`, `5b9a403`, `822f398`, `b048df8` (merge `bf33fe4` is #191). Tests: `open-brain/tests/pipelines/sync/t048-unreadable.test.ts` (SILENT 1, 2, 3, 20, 26), `t048-r1b.test.ts`, `open-brain/tests/t048-r2.test.ts`, `t048-r2b.test.ts`, `t048-r3.test.ts`. I did not re-scan every filter in `open-brain/src` for a remaining bare drop.
- **T-149.** `5ed4940` states one worktree per seat in `shared.md`. The check is T-193 (`683b61c`). I did not enumerate seats' worktrees from this checkout.
- **T-163.** The detector is on master: `7ba177f`, `open-brain/tests/pipelines/sync/record-erasure.test.ts`. I did not show that a second seat's close-out is appended rather than overwritten.
- **T-167.** `301835d` tracks `PRD.md`, `DECISIONS.md`, and `ENTITIES.md`. `git ls-files` lists all three at `bf33fe4`. I found no test that a seat worktree contains them.
- **T-179.** `57a2025` rewrites `/end` to store lessons and write no project state. That commit touches command files only. I found no test.
- **T-183.** `83c3438` clips gaps and verified and adds `greeting-size` (`open-brain/tests/pipelines/sync/greeting-size.test.ts`). A check-only sync on this tree still reported the greeting over 40000 characters, so the size is not closed.

## OPEN

Checked `git log origin/master` subjects for the id, and the source where named. No fix commit.

- **T-008, T-014, T-022, T-023, T-024, T-025, T-031, T-034, T-042, T-044, T-050, T-051, T-065, T-067, T-091, T-093, T-148, T-152, T-154, T-159, T-164, T-187.** No commit on `origin/master` mentions the id. T-152: `open-brain/tsconfig.json` is still `"include": ["src/**/*"]`.
- **T-155, T-158, T-161, T-168, T-169, T-170, T-172, T-173, T-176, T-178, T-182, T-191.** The id appears in a filing or a docs commit, not in a fix. T-158: `close_gap` in `open-brain/src/shared/state-writer.ts` still `splice`s the gap out. T-176: `checkGitNexusIndex` counts `indexed..HEAD` only. T-178: `.github/workflows/ci.yml` `push` is still `branches: [master]` only.

## NOT CHECKABLE HERE

- **T-055, T-166.** GitNexus's own analyze and impact. This tree's index is not evidence.
- **T-061, T-146.** Need a live sample or a sweep this checkout did not run.
- **T-160.** Hub transport. That code is not this repo.
- **T-177.** A host safety stop, not a line in this source.
- **T-181.** Other projects' adoption. Not this tree.
