# QA 292, session-164 batch e: #489 END-FIX r3

**By:** Atlas (planner), 2026-10-07, record session 164. **Machine:** the laptop (Windows), booked through clark.
**Read first:** QA 291's report (`origin/qa/s164d-report`, `docs/loops/s164d-qa-report.md`), rows 4–10 and the #489
findings R1–R8. Reuse its scripts under `docs/loops/qa-291/` on that branch.
**Do not read** any hub room or developer report until your report is pushed.
**Merge authority:** Aaron's word. **Gates:** the Makerspace import.

**Narrow:** one test file per vitest run, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`,
`gh` reads. No full suite.

**Pinned head (CI `test` green; mutant runs read red by the planner):** `854c6ced526e1e63f998bcafd8c1384068fb0c70` (CI 37690327062). It is the merge of `ffe65478` (r3; CI 37679380638 green) and master `1bbf2a5d`. Mutants, each one commit on `ffe65478`, whose `open-brain/src` equals the head's apart from master's changes: `loop/end-fix-mut-r3-hash` 37679939754 · `-r3-ids` 37680036716 · `-r3-state` 37680163655. Confirm with `gh pr view 489` that the head still equals this pin; if it moved, stop and report INCOMPLETE.

## Rows

1. **Confined and current.** Since `ffe65478`, the only changes are the merge of master (`1bbf2a5d`, which contains
   #498 and #499) and a `CHANGELOG.md` union. Diff `ffe65478` against the head with master's changes removed, and list
   any other change.
2. **Mutant runs.** For each red run, confirm the failing tests are the rows its mutant targets, and that its parent's
   `open-brain/src` equals the head's.
3. **R1 (was High), the sweep shape, real paths, both layouts and Windows:** record update, then `ob_end` closes, then a
   code edit, then `git add -A`, then a commit, then SessionEnd. The `WORK AFTER /end` marker must be written and shown
   once. Also check that a real record update **after** `ob_end` (content changed) clears it, and that re-saving
   identical content does not.
4. **R2:** no transcript with a trailered commit after `ob_end` gives `work-after-end check NOT RUN`. An unreadable
   `state.json` is named in the hook, with no `HANDOFF MISSING` and no `WORK AFTER` derived from it.
5. **R3–R8:**
   - no "loop/*" wording for master work;
   - `.missing-handoff*.jsonl` is never in the repo after a firing (`git status --untracked-files=all`), and an old
     in-repo notice is still shown once;
   - the `OLD LAYOUT` line appears with `RECORD NOT CHECKED`;
   - a payload with no session id gives `NOT RUN`;
   - the `.shown` files stop at 200 lines;
   - the R6 limit is documented.
6. **Regression, the rows QA 291 passed:** B2, B4/N4, N1, N2 and N6 for the stamp files, on one fixture each through
   the real paths. Also #498's `/bootstrap` L1 path once, on the merged head, because `server.ts` and the briefing now
   carry both PRs.
7. **Your own mutant:** the content hash ignores line endings in only one direction, or hashes the file path instead
   of its bytes. Name the red test, or report a finding.

## Rules (headless Claude Code)

- You are **QA 292**, prefix `s164e`. Push ONLY `qa/s164e-*` branches, and only through
  `node docs/loops/qa-292/push-qa.mjs <branch>`, run from your `qa292-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- Never read the real knowledge DB, the real open-brain data dir or a real vault for anything other than counts, names
  and paths (G-051). Make no live Jev call. Never print a key.
- **Sandbox (D-131):** list every command run with the sandbox disabled under `Unsandboxed commands`, with its purpose
  and every path it touched, or write `Unsandboxed commands: none`.
- Commit `docs/loops/s164e-qa-report.md` on `qa/s164e-report`. Put the verdict, with its pinned head, first. The
  report's last line is exactly `QA-292: REPORT COMPLETE`.
