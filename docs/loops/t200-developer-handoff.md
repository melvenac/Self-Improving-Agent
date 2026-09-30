# T-200 developer handoff: /start reads the record from origin/master

**By:** Forge (developer seat, Claude Code session), 2026-09-30.
**Branch:** `loop/t200-record-from-master`, cut from `origin/master` `abae5f92`. **Product:** `92f9cc0f`. **Local only until cleared (D-061); no CI.**
**Task:** T-200 in `.agents/state.json` (planner ruling, session 149, on Aaron's word relayed by worktrees-d5).

## What it does

When the local `.agents/state.json` revision is below `origin/master`'s (as of the last fetch), `ob_start` renders the State block and the role files from `origin/master` and prints one line: `record read from origin/master <sha7> rev N; this tree holds rev M; last fetch <time>`. It never refuses and never renders silently.

| Case | Line printed | Renders |
| --- | --- | --- |
| local rev < master rev (or no readable local record) | `record read from origin/master ...` | master's record and master's role files |
| local rev >= master rev | `record source: LOCAL (rev M, at or ahead of origin/master rev N)` | the tree's own |
| master unreadable (no ref, no state.json at the ref, over the buffer, not valid JSON, fails the schema, unknown `schema_version`) | `record source: LOCAL (origin/master unreadable: <cause>). Rendering this tree's own record, which may be older than master's.` | the tree's own |

The RM-2 line is an addition to the ruling (asked for by the builder, kept by the planner): every path prints a line, so a quiet read is never ambiguous.

## Where

- `open-brain/src/pipelines/session-start/record-source.ts` (new): `resolveRecordSource`.
- `open-brain/src/pipelines/session-start/git-read.ts` (new): `gitShow` reads `ref:path` whole (buffer 256 MB, no trim, no shell) and refuses with a named cause. **Master's text is parsed before it is trusted:** git returning bytes proves nothing about them being the whole record.
- `role-files.ts`: `describeRoleFiles(..., { fromRef })` reads each file with `git show <ref>:<path>`; the commit comes from the ref's log. Seat identity stays local (AGENT.local.md is untracked and the seat's own).
- `server.ts` `handleStart`: the record line prints after the tree-currency lines; `sj` is rebound to master's record, so the existing `renderState(sj.data, ...)` call is unchanged (T-199 adds an argument to that call; nothing here touches its argument list). The Sizes block's state.json line describes what is rendered.
- `sync/checks.ts` `composeGreeting`: composes from the same source and counts the line.
- `tree-currency.ts`: `readRevisionAtRef` now uses `gitShow`. **The hole that was there:** `git()` used the default `maxBuffer`, swallowed every error to `null`, and `null` is what "no record" looks like, so an oversize record (master's is 432 KB and grows every session) would have read as an absent one.

## Rows (tests/pipelines/session-start/record-source.test.ts, 12 tests, real git: bare origin, seed, clone, real fetch)

| Row | Test | Mutant branch | SHA | Red |
| --- | --- | --- | --- | --- |
| RM-1 | local rev 140, master rev 163: master's objective and handoff, line names sha and both revs | `loop/t200-mut-m1-always-local` | `8efd6b62` | 4 failed (RM-1, RM-4, large-file, greeting) |
| RM-2a/2b | level and ahead render local and say LOCAL | `loop/t200-mut-m2-always-master` | `0afcd8b8` | 4 failed (RM-2a, RM-2b, RM-4-level, greeting) |
| RM-3 | no origin; no state.json at the ref; truncated/garbage state.json; unknown `schema_version`: each names the cause and renders local | `loop/t200-mut-m3-silent-cause` | `80eb5684` | 4 failed (all RM-3) |
| RM-4 | role files follow the state: master's content and commit when behind, the tree's own when level | `loop/t200-mut-m4-role-files-local` | `9c8ac416` | 1 failed (RM-4) |
| large file | a ~600 KB valid master record renders whole; `gitShow` past its buffer refuses with a cause and reads whole with room | `loop/t200-mut-m5-small-buffer` | `4ea66a9c` | 1 failed (large-file) |
| greeting-size | `composeGreeting` follows the same source and counts the line | `loop/t200-mut-m6-greeting-drops-line` | `6e20a297` | 1 failed (greeting) |

**True red at base:** the same rows run at `origin/master` `abae5f92` with no product change: 9 failed, 1 passed (the level-tree RM-4 half, which is the unchanged behaviour). Each failed on the intended assertion (`expected 'THIS TREE IS STALE…' to contain 'MASTER-OBJECTIVE'`, and the like).

Each mutant is one edit to the product, on its own branch, edit asserted as landed before the run, `tsc --noEmit` exit 0, never to be merged. The "corrupted tail" case is the truncated-JSON row under RM-3.

## Local proof (tree `92f9cc0f`, `open-brain/`)

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run tests/pipelines/session-start tests/pipelines/sync/checks* tests/server.test.ts` | exit 0, 291 passed |
| `npx vitest run` (full, unpiped, alone) | **exit 1**, 3 failed, 1790 passed, 75 skipped, 3 unhandled `onTaskUpdate` errors |

The 3 failures are all `Test timed out in 5000ms`, and all 15 tests in their three files pass alone (exit 0): `state-import-r6` QA 153 D1 "the genuine odd-length file is named too…", `repo-root` V6 "this repo's shape…", `t048-r3` T048-D1 "…name the invocation-log state, and say nothing extra when it ran". The same class as the T-194 r2 table; the failing set moves between runs.

`/sync` before commit: 27 passed, 3 issues (`ENTITIES.md` retirements, `end.md` mirror-parity, greeting-size 49,643 characters), none from this change. **greeting-size is over its 40,000 limit at base too** (48,245 measured in the T-194 tree); this change adds one line to what it counts.

## Overlaps

- `git merge-tree --write-tree` (no working-tree change) of this branch against `origin/loop/t199-missing-handoff`, `loop/t164-record-session-number` and `origin/master`: **clean in all three**. `server.ts` is touched by all of them, in different hunks.
- T-199 adds `sessionUuid: proven.id` to the `renderState` call and a function after `renderHandoffs`; this branch leaves that call's arguments alone. Whoever merges second rebases.

## Limits, stated

- Reads the remote-tracking ref, never the network: "master" is whatever the last fetch left, and the line carries the fetch time. A stale fetch is named, not fixed (out of scope).
- `findHandoffCommit` for master's handoffs resolves against the local object database; it rendered correctly in RM-1 (the fixture's commits exist locally after the fetch). A master commit the tree has not fetched cannot be resolved.
- The `THIS TREE IS STALE` line above the record line still says "anything read from the record here describes an older state"; it is about the tree and is still true, and the record line beneath it says what was actually rendered.
- Not measured: Cursor's `/start` (T-197 parity) does not call `ob_start`'s renderer differently, but no Cursor run was made.
