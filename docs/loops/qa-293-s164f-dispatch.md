# QA 293, session-164 batch f: #489 END-FIX r4

**By:** Atlas (planner), 2026-10-08, record session 164. **Machine:** the laptop (Windows), booked through clark.
**Read first:** QA 292's report (`origin/qa/s164e-report`, `docs/loops/s164e-qa-report.md`): row 3, row 7 and the
findings S1–S3. Reuse its scripts under `docs/loops/qa-292/s164e/` on that branch, including its own mutants `qa/s164e-m1`
and `-m2`.
**Do not read** any hub room or developer report until your report is pushed.
**Merge authority:** Aaron's word. **Gates:** the Makerspace import.

**Narrow:** one test file per vitest run, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`,
`gh` reads. No full suite.

**Pinned head (CI `test` green; mutant runs read red by the planner):** `09a31303416f8e191b08adfed5953a83d77d4fd5`
(CI 37776928002). Its parent `474c100b` merges master `a7c26bb2` into r3 (`854c6ced`). Mutants, each one commit on the
head:

| Branch | Run | Mutant |
|---|---|---|
| `loop/end-fix-mut-r4-revision` | 37777444070 | the revision back in the new-layout hash |
| `loop/end-fix-mut-r4-m1` | 37777575031 | line endings normalised at the stamp only |
| `loop/end-fix-mut-r4-m2` | 37777638563 | the path hashed instead of the bytes |

Confirm with `gh pr view 489` that the head still equals this pin. If it moved, stop and report INCOMPLETE.

## Rows

1. **Confined.** List every file changed from `854c6ced` to the head, leaving out master's changes (`a7c26bb2`). Anything
   outside END-FIX's scope is a finding.
2. **Mutant runs.** Each red run's failing tests are the rows its mutant targets.
3. **S1, through the real paths, new layout, POSIX and `--win`.** Each case must keep the marker:
   - QA 292's `b1n-same` (an identical `set_handoff` re-save);
   - `b1n-other` (`add_decision`);
   - `b1n-pull` (a merge bringing in another session's `state.json` write).

   `b1n-later` (a real `pick_up` change) must clear it.
4. **S2, through the real paths, old layout, `--win`.** The marker is kept in these cases:
   - `b1o-all` and `b1o-same` with CRLF next-session.md at `ob_end`;
   - `b1o-eol` in both directions.

   `b1o-later` must clear it. Then re-apply QA 292's `qa/s164e-m1` and `-m2` source changes on the new head: each must
   now turn an END-FIX test red.
5. **S3.** Old layout, no proof (the Cursor shape): `RECORD NOT CHECKED` comes with the `OLD LAYOUT` line.
6. **Short regression on the real paths, one fixture each:** R1 sweep, B2, B3/R2 (no transcript, unreadable `state.json`),
   B4/N4, N1 and N6. Also #498's `/bootstrap` L1 path once on this head.
7. **Your own mutant:** the session-row slice includes another session's row, or the handoff slice is not keyed by uuid.
   Name the red test, or report a finding.

## Rules (headless Claude Code)

- You are **QA 293**, prefix `s164f`. Push ONLY `qa/s164f-*` branches, and only through
  `node docs/loops/qa-293/push-qa.mjs <branch>`, run from your `qa293-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- Never read the real knowledge DB, the real open-brain data dir or a real vault for anything other than counts, names
  and paths (G-051). Make no live Jev call. Never print a key.
- **Sandbox (D-131):** list every command run with the sandbox disabled under `Unsandboxed commands`, with its purpose
  and every path it touched, or write `Unsandboxed commands: none`.
- Commit `docs/loops/s164f-qa-report.md` on `qa/s164f-report`. Put the verdict, with its pinned head, first. The
  report's last line is exactly `QA-293: REPORT COMPLETE`.
