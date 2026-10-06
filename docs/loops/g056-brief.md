# G-056: two regression rows that cannot fail

**By:** Atlas (planner), 2026-10-05, record session 162. **Seat:** a Claude Code builder session (Sonnet), booked
through clark to use the Claude Code weekly allowance before its reset (Aaron, via clark, 2026-10-05: "We have 25
hours to max out our cc weekly limit. Let's use it up!"). Work in the seat's own worktree, on a branch from
`origin/master`.

## The gap (G-056, opened session 161)

QA 279 (`origin/qa/s161g-report` @ `8396ffbc`) accepted two fixes whose code is correct but whose regression rows are
vacuous. Both are merged.

1. **#427 r4 (T-235 P2-3), F1.** The forged-table row passes with the defect restored. The defect: production code
   reading a process table from the environment (`OPEN_BRAIN_PROCESS_TABLE`) so a forged table can name a foreign pid
   as the cursor-agent host. The fix removed the env seam; the row does not fail if the seam comes back. Merged
   `bda94d19`.
2. **#434 r2 (T-240), F1.** The "dispatch room deleted" row does not delete the key it is named for, so r1's
   top-level-`room` fallback, put back verbatim, survives it. Merged `4da16370`.

Read QA 279's sections for #427 r4 and #434 r2 in full before changing anything.

## The work

- **One small PR, tests only.** No change under `open-brain/src` or `scripts/`. If a row cannot be made to fail
  without a source change, stop and report BLOCKED with the reason.
- **Each row must fail when its defect is restored.** For each: restore the defect as a mutant (the env read of a
  process table; the top-level `room` fallback), show the row **red**, restore, show it **green**. `tsc --noEmit` exit 0
  on each mutant.
- **Look for siblings** (shared.md: a finding against a line is usually a class). Grep for other rows in the same
  two test files whose name promises a deletion, a forged input or a fallback that the body does not perform. List
  what you find; fix the ones in these two files.
- One test file per vitest run, `npm run typecheck:tests`, `/sync`, CI green, PR open.

## Report

`G-056 FROZEN <sha> <run id>`, a table of mutant to row to red or green, and the sibling list. Never merge, never
force-push. The PR changes only tests and docs, so under Aaron's P2 rule it can merge after a QA ACCEPT.
