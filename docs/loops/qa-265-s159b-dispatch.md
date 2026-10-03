# QA 265, session-159 batch 2: #374 r2 (narrow), #377, #378, #379, #382

**By:** Atlas (planner), 2026-10-03, record session 159. Booked with clark on Plumb.

**Merge authority:** none pre-approved. An ACCEPT waits for Aaron's word per PR.

**QA runs on Opus** (all builds are Claude Code Sonnet). **Job class: LIGHT:** touched test files, **one test file per
vitest invocation**, mutants on touched files only, `tsc`, `npm run typecheck:tests`, and `gh` reads. No full suite. No
live Jev call. Never run anything against the real home directory.

**Master at dispatch:** `5a7bf167` (#373, #372, #371 merged; master CI green; `typecheck:tests` is now a CI step).

**Pinned heads:**

| PR | Task | Head | Scope note |
|---|---|---|---|
| #374 | T-234 PR B, **round 2, narrow re-QA** | `40105c1fa2ed6d40f85cbd18660e178d7ff787b7` | QA 264 rejected r1 (start-parity T-226 row red). Retargeted to master. |
| #377 | T-229: unreadable `.recalled-entries.json` is not "absent" | `da6cdd97101318da51f995dfec0e1bff6430ae79` | |
| #378 | T-230: `/start` prints both "unreadable: 0" scan-count lines (row only) | `b24ea6a0a43b9b92188e130ec814f502e457ae4b` | test-only |
| #379 | T-231: `/sync` mcp-command-paths: malformed containers are not-checked (WARN) | `89ab68b25c4a642f275e5dd7dcf575b373e328f4` | 12 container rows (wider than the note: ruled as a class) |
| #382 | T-232: `ob_state` prints one retention summary; per-id NOTE only on crossing | `688001ec55974314f1c846a709bba4cc476fded1` | |

If a head above has moved when you start, QA the pinned SHA and say so; never QA an unpinned head.

## Rows for each PR (except #374, see row 5)

1. **Confined.** Files each PR's own commits touch beyond `origin/master`. Flag anything outside the task.
2. **Red then green.** New/changed test files against master's source (fail) and the head (pass). Quote counts.
3. **One mutant of your own**, plus re-run one of the developer's (named in the PR body). Each turns a row red.
4. **CI on the head (read only).** `gh pr checks <n>`: `test` result and run id. A pre-#371 head will not have run
   `typecheck:tests` in CI: run `npm run typecheck:tests` at the head yourself and quote the exit code.

## Rows specific to this batch

5. **#374 r2 (narrow).** Only what changed since QA 264's REJECT at `7e0509e1`:
   - `start-parity.test.ts` T-226 row: green at the head; the grab now matches `*brief.md`; threshold still 3. Apply the
     mutant "delete the `*brief.md` sentence from ONE template copy": the row must go red.
   - `SERVED_PATHS` includes `project-template`: a commit touching only `project-template/...` counts as a CODE commit.
   - Usage at `sevenDayPct >= 98` prints band word `STOP` whatever the file's `level`; at 97 the file's own band stays.
   - `git range-diff 1115ee19..7e0509e1 <merge-base>..40105c1f` (or equivalent): report anything that changed beyond
     these three items and the master merge.
   - Re-run QA 264's six QA-263 mutants are NOT required again unless the range-diff touches their rows.
6. **#377.** Confirm each of the three call sites passes `readRecalledFile` into `resolveRecalledIdsObserved`, and that
   the resolver catches a thrown read (so the SessionEnd hook and the MCP handler cannot crash). Only ENOENT is absent.
7. **#378.** The row forces both scans to run; QA 261's mutant (delete `lines.push(...formatScanCounts(...))` in
   `handleStart`) turns it red.
8. **#379.** Every one of the 12 container rows' pinned fragments is asserted; an ABSENT container stays normal; with
   nothing else checkable the result is SKIP; QA's earlier mutant B (unreadable settings note) is red.
9. **#382.** A no-op-retention write prints exactly one summary line and no per-id NOTE; a write where a task crosses the
   boundary prints the per-id NOTE(s) plus the summary. Every fixture write asserts "applied".
10. **Batch merge order.** Scratch branch from `origin/master`; merge **#374, #377, #378, #379, #382**. Report any
    conflict (#377, #378 and #382 all touch `server.ts` / `server.test.ts`). Then `tsc --noEmit`,
    `npm run typecheck:tests` (exit 0), and the touched test files one per invocation.

## Rules (headless Claude Code)

- You are **QA 265**, prefix `s159b-batch`. Push ONLY `qa/s159b-batch-*` branches, only through
  `node docs/loops/qa-265/push-qa.mjs <branch>`, run from your `qa265-wt` tree.
- **Never create, comment on or edit an issue or a PR.** `gh` only to read.
- From real config files report only counts, key names, server names and command paths, never values (G-051).
- Commit `docs/loops/s159b-batch-qa-report.md` with its `.E_t.json` on `qa/s159b-batch-report`.
- One verdict line per PR and a batch verdict. The last line is exactly `QA-265: REPORT COMPLETE`.
