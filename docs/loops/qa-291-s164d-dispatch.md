# QA 291, session-164 batch d: round 2 of #489 END-FIX, #498 IMPORT-CMDS and #499 T-247

**By:** Atlas (planner), 2026-10-07, record session 164. **Machine:** the laptop (Windows), booked through clark.
**Read first, in this order:**
- QA 289's report (`origin/qa/s164b-report`, `docs/loops/s164b-qa-report.md`), for B1–B4 and N1–N7 on #489. Its
  scripts are under `docs/loops/qa-289/s164b/` on that branch, and you may reuse them.
- QA 290's report (`origin/qa/s164c-report`, `docs/loops/s164c-qa-report.md`), for L1–L6 on #498 and J1–J3 on #499.
- The briefs: `docs/loops/end-fix-brief.md` and `docs/loops/import-commands-brief.md`.

**Do not read** any hub room or developer report until your report is pushed.
**Merge authority:** all three change `open-brain/src`, so each merge is Aaron's word. **Gates:** #489 and #498 are both
on the Makerspace import path.

**Narrow:** one test file per vitest run, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`,
`gh` reads. No full suite.

**Pinned heads (CI `test` green on each; every mutant run read red by the planner):**

| PR | Round | Head | CI | Red-first mutants (branch, run) |
|---|---|---|---|---|
| #489 END-FIX | r2 (r1 `1dac7b8a`, QA 289 REJECT) | `f59d03bc7ae3a02b6b3c374eac503c318b40001c` | 37659540076 | `loop/end-fix-mut-e4-pre` 37658044185 · `-e2-ignore` 37658123318 · `-record-ws` 37658758997, each one commit on `e4e535c1`, the head's parent; the head adds only a test · `-unknown` 37659563386, on the head |
| #498 IMPORT-CMDS | r2 (r1 `fee2bb50`, QA 290 REJECT) | `f3aba754e7a870c4880639bb564a2d8e7e0e8d71` | 37653272720 | `loop/import-cmds-mut-r2-1` 37655704904 · `-r2-2` 37655705427 · `-r2-3` 37655794607, each one commit on the head |
| #499 T-247 | r2 (r1 `433c503b`, QA 290 REJECT) | `409c8c08542ebd73f6f15347cb97e52faaf17e04` | 37650735605 | `loop/t247-mut-j1` 37650760336, on the head |

Confirm with `gh pr view` that each head still equals its pin. If any moved, stop and report INCOMPLETE.

## Every PR

1. **Confined.** List every file in each `git diff origin/master...<head>`. Flag anything outside its brief, apart
   from wiring already accepted (L6: `cli.ts`, `server.ts`, `cli-args.test.ts`).
2. **Mutant runs.** For each red run, confirm that its failing tests are the rows its mutant targets, and that a
   mutant on a parent commit has a parent whose `open-brain/src` equals the head's.
3. **Batch merge.** Merge all three heads onto `<DISPATCH_SHA>`. #489 and #498 both touch `server.ts` and the
   session-start render, so **report any conflict**. Run `tsc --noEmit` and `typecheck:tests`, then every touched test
   file once each.

## #489 END-FIX r2: re-run QA 289's failing rows on the real paths

Use the real `ob_end` MCP tool, the real `cli-session-end` hook and the real greeting, as QA 289 did.

4. **B1.** For each layout, record the record update, then close with `ob_end`, then commit, then run SessionEnd:
   - new layout: the record update is `set_handoff`;
   - old layout: the record update is a next-session.md edit.

   The `WORK AFTER /end` marker must be written, and the next greeting prints it once.
5. **B2.** After a correct close on master, in both layouts, no `HANDOFF MISSING` appears in the hook or the next
   greeting. A loop seat with `docs/loops/*-handoff.md` still passes (Q7). A loop seat with work and NO handoff of either
   kind still warns.
6. **B3.** No transcript, no git, not a repo, and an unreadable `state.json`:
   - `ob_end` says it could not check, naming why;
   - the hook says `NOT RUN`, never `no commits`;
   - the unreadable `state.json` is named as unreadable, and the session is not treated as old layout.
7. **B4 / N4.** Re-apply QA 289's M5 (the session start used in place of `ob_end_at`) and M6 (`record_ok: ""`
   accepted). Each must now turn a test red. `"   "` refuses.
8. **N1.** A next-session.md left dirty by an earlier session (old mtime), with new work and nothing touched: `ob_end`
   refuses. An edit made in this session closes.
9. **N2, N3, N6.**
   - N2: the OLD LAYOUT line appears on the refusal too.
   - N3: untrailered master commits are reported as UNATTRIBUTED by `ob_end` and by the hook, with no "loop/*" wording.
   - N6: after a close, `git status --short --untracked-files=all` in an old-layout repo shows **no** stamp or marker
     file.

     Say where they are now written. The path must be per-project and must not collide for two projects whose names
     differ only by case or by slash direction on Windows.
10. **Windows.** Rows 4, 6 and 9 with CRLF, a spaced repo path and backslash `project_root`/`transcript_path`.

## #498 IMPORT-CMDS r2: re-run QA 290's failing rows

11. **L1, `/bootstrap` as written.** Follow `project-template/.claude/commands/bootstrap.md` on a fresh pre-state temp
    project:
    - step 7's `--commit` is followed by 7b's `install-commands` with no extra git commit;
    - step 8's `git status --short --untracked-files=all` lists exactly what the text names;
    - one `Bootstrap SIA` commit results, and a fresh `/start` (`ob_start`) shows no OLD /start line.

    Any other dirty path still refuses, naming the path.
12. **L2.** Make `.claude/commands/` read-only (on Windows, use the read-only attribute or an ACL deny, and say which):
    - the refusal names the fix, and nothing is written, including no empty archive dir;
    - force a failure after the first rename (with a seam or by making one target unwritable): every rename is rolled
      back.
13. **L3 and L4.** Commit the installed commands in a `core.autocrlf=true` repo, then re-check them out: all four read
    `SIA`, there is no C4 line, and a re-run is a no-op. A re-run straight after an install, on the dirty import tree,
    exits 0 as a no-op.
14. **Windows (QA 290's row 8, not run there).** The template checked out with `core.autocrlf=true`, a spaced path,
    and CRLF old files: I1, I3 and I7.

## #499 T-247 r2

15. **J1.** `writeSummary` refuses `2026-13-01`, `2026-00-00`, `2026-02-31` and the earlier shapes, and writes
    today's ISO date. Re-apply QA 288's mutant (b) and the calendar mutant: each turns a named test red.
16. **J2 and QA 290's row 11 (Windows, not run there).** The byte test's title says what it pins. On Windows, with
    the `secure_delete` pragma removed, report whether the byte test goes red. That is information, not a finding.

## Rules (headless Claude Code)

- You are **QA 291**, prefix `s164d`. Push ONLY `qa/s164d-*` branches, and only through
  `node docs/loops/qa-291/push-qa.mjs <branch>`, run from your `qa291-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- Never read the real knowledge DB or a real vault for anything other than counts, names and paths (G-051). Make no
  live Jev call. Never print a key.
- **Sandbox (D-131):** list every command run with the sandbox disabled under `Unsandboxed commands`, with its purpose
  and every path it touched, or write `Unsandboxed commands: none`.
- Commit `docs/loops/s164d-qa-report.md` on `qa/s164d-report`. Put one verdict per PR, with its pinned head, first.
  The report's last line is exactly `QA-291: REPORT COMPLETE`.
