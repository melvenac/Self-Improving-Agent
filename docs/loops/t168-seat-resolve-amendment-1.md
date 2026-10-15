# T-168R amendment 1: a sixth argv site, and resume in the same clone

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, the SAME clone as the first run (`C:\Users\Aaron Melven\Worktrees\oneoff-t168r`). Code. Ends at
READY with a PR, no merge.
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t168r-a1-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Amends:** `docs/loops/t168-seat-resolve-brief.md` (base
486cff06). Everything in the brief stands except what this file changes. **Tag:** `T-168R`.

## Ruling

The first run stopped correctly (`BLOCKED T-168R cli: lease exits 11 and 2 refuse`). The planner's grep for spawn sites
read only lines that begin `spawnSync(process.execPath, [`, and it missed one whose argv array sits on its own line.
Planner check at 486cff06: `git grep -n 'TSX, CLI' -- open-brain/tests` lists exactly SIX runner sites without a seat.
Five are in the brief. The sixth is `open-brain/tests/suite-run-meta.test.ts:484` (the `withOwner` helper of "cli: lease
exits 11 and 2 refuse"). The `tests/harness/` hits run a different CLI and are untouched.

**Add the sixth insertion**, the builder's proposal verbatim:
`      [TSX, CLI, "--owner-pid", "100", "--meta", join(dir, metaName)],` →
`      [TSX, CLI, "--seat", "cursor-builder", "--owner-pid", "100", "--meta", join(dir, metaName)],`.
The brief's "Existing tests" list now has six sites. Nothing else changes: the rows, the rulings, the mutants and
step 7's five-file list all stand.

## Steps

1. PowerShell: resolve and print `$reply` as in the brief's step 1 (named `t168r-a1-reply.md`), the Node path, and
   `node -v` (must print `v22.*`).
2. `cd` into `C:\Users\Aaron Melven\Worktrees\oneoff-t168r`. `git rev-parse HEAD` must be
   `73010c0eadb82644f5a75ccaf89793911597d356` (commit 1), and `git status --porcelain` must show exactly
   ` M open-brain/src/cli-suite-run.ts`, ` M open-brain/tests/suite-run-meta.test.ts`,
   ` M open-brain/tests/t168-owner-wired.test.ts`, `?? open-brain/src/suite-seat.ts`. Anything else: STOP,
   `BLOCKED T-168R resume state differs` with the output. (If the uncommitted changes are gone, restore them from
   `%TEMP%\t168r-uncommitted.diff` with `git apply` and `%TEMP%\t168r-suite-seat.ts`, then re-check.)
3. Make the sixth insertion. Then run the brief's step 4 command (all green, now including
   `tests/suite-run-meta.test.ts` 26/26), plus both `tsc` runs (exit 0). Paste all.
4. Commit 2 with the brief's message, then the brief's steps 5–8 unchanged (the 2-commit log, mutants M1–M5, the
   five-file name-only diff, push, PR, CI).

## Reply

- **First line:** `READY T-168R <sha40> PR #<n>` or `BLOCKED T-168R <reason>`.
- Then each command with its output. Mark anything not run `NOT RUN`. Do not merge.
