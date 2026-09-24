# Candidate A5 developer handoff

**Model:** Grok 4.7, as Cursor shows this session. **Seat:** developer, record session 91, `~/Worktrees/sia-forge`. **Base:** A4 `f9a1aa8`. **Branch:** `loop/15-slice-3-candidate-a5`.

Not in A5: D-A2-7, D-A5, and the R37 race. The compare-then-open window is the same class of race as R37 and is not closed.

## R55 — the object and the route

`routeChain` walks every component as written. A link is on the route, and so is every component of its target from that target's own anchor, recursively, including a link in the last position. Compare type, `dev`, `ino` (`{ bigint: true }`), `readlink` text, and `nlink` on the object. A difference is named and not opened. An in-place edit of the base target is still read.

**Red:** the new R55 tests are `skipIf(isWin)`. This machine cannot plant a file symlink (`EPERM`). They are red at `f9a1aa8` on Linux (QA probe `qa89-a4-probe.test.ts` A4-1, CI run `35928008495`). Mutant that turns them red: stop following a final link in `routeChain` (A4 `componentPaths`).

**Green here:** `configwatch-links.test.ts` — the R55 cases skipped, the rest passed. Linux green is the CI run named below.

## R57 — repository `begin` against the loop base

`ConfigWatch.captureBase` records the route once. `begin` reads a repository file only when that route still matches. Attribution stays the stage snapshot.

**Red at `f9a1aa8`:** `begin` called `readState` with no gate, so the second stage's verdict contained the victim hash. Mutant: read inside `begin` even when `repositoryResolutionDiff` is set.

**Green:** `R57: a later stage does not read...` passed on win32 (exit 0, targeted file).

## R59 — the record says what happened

`mismatchFinding` keeps "not read" only when `compare` left the hash `unread`. `rollBack` prints "The offending paths were reverted." only after `revertPaths` runs on a non-empty list.

**Red at `f9a1aa8`:** `rollBack` printed that sentence whenever it was called. Mutant: restore the unconditional return in `rollBack`.

**Green:** `R59: a config-only refusal...` passed on win32.

## R58 — tests that can fail

POSIX, `skipIf(isWin)`, so not executed here:

- `(b)3` plants a symlink on a hook entry the snapshot held, asserts the snapshot mode and the victim mode differ, asserts `isSymbolicLink`, and has its write-through and plant controls in the same test.
- R29 plants a link to a mode-000 victim and requires `EACCES` on a direct read.
- R35 asserts the base note's type and `readlink` target.

Mutant for (b)3: drop the mode assertion (or plant the symlink where the snapshot has no hook). Mutant for R29: chmod the watched file itself instead of a link. Mutant for R35: delete the `type symlink` / `readlink` assertions.

## What was not verified

- R55 and R58 were not executed on this win32 seat.
- Full local suite was not run (G-042: ask atlas first).
- GitNexus `impact` was not run; the index is not available in this session. The edits are `routeChain` / `recordChain` / `resolutionMismatch` / `ConfigWatch.begin` / `rollBack`.

## Targeted run

`open-brain/`, `npx vitest run tests/harness/configwatch-links.test.ts tests/harness/config-channel.test.ts`. Exit 0. Test Files 2 passed. Tests 57 passed, 14 skipped.
