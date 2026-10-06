# QA 281, session-162 batch b: #445 r4, and a retro-check of #457 and #458 (merged without QA)

**By:** Atlas (planner), 2026-10-05, record session 162.
**Authority:** #445 re-QA is Aaron's "Fix both and send them back to QA" (planner window, 2026-10-05). #457 and #458
were merged on Aaron's word WITHOUT QA ("Merge without QA", planner window, 2026-10-05). This run checks them after
the fact. A failure there is a finding for a follow-up PR, not a revert.

**Read first:** QA 280's report, `origin/qa/s162a-report` @ `d8cb4652`, `docs/loops/s162a-qa-report.md`, section
"#445 r3 (rows 7–11)".

**Merge authority:** none pre-approved. #445 changes only tests and docs, so under Aaron's P2 standing rule (planner
window, 2026-10-05) the planner may merge it after a QA ACCEPT, by a path check.

**LIGHT:** one test file per vitest invocation, mutants on touched files only, `tsc --noEmit`,
`npm run typecheck:tests`, `gh` reads. No full suite. No Windows rows.

**Pinned heads:**

| PR | Task | Head | State |
|---|---|---|---|
| #445 | T-156 r4 | `1e21deaea32e20591e65a5cf39eb40a0517542d6` (previous: r3 `260d68352fb89030a92029eae56053d00ed3f7d0`, QA 280 REJECT) | open, CI green |
| #457 | HUBROOM-TURN-END | merged at `2f8e6489e7d816dff9fc667431425699569071c3` | merged |
| #458 | WAKER-IGNORE | merged at `1671d00547c5c1ef1200d22698c4a607779928e2` | merged |

## #445 r4

1. **Confined.** `git diff 260d6835 1e21deae` lists only test files and `docs/loops/t156-scan-list.md`; name any other.
2. **CI.** The `test` result and run id for `1e21deae`.
3. **R-BF-21 controls the real scan (QA 280 row 9).** In `bootstrap-fix-r4.test.ts`, with a real code line
   (`export const … = process.env.OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK;`) planted in `src/cli.ts`, each of these turns
   R-BF-21 **red**: (a) a typo'd needle; (b) a pathspec typo (`open-brain/srcX`); (c) a line extractor that returns
   nothing for every row; (d) a `git grep` that errors (for example a bad flag), which must not read as zero hits. A
   `//` comment-only near-miss in a real `src` file stays **green**. Run each yourself; `tsc` exit 0 on each.
4. **QA 280's lows.** `t195-plan-gate.test.ts:153` is listed or paired with a reason; CC-19's raw `cli` presence
   checks are paired or listed; the CC-19 and `git.test` ranges match the head.
5. **Rows 7, 8, 10 and 11 still hold** (QA 280's): CC-19's comment mutants green and the real call red; the doc
   readers listed; ranges match (spot-check six); row 18's widen and narrow mutants red.
6. **Your own sweep.** Grep `open-brain/tests` at the head for source-text scans (`toContain`, `toMatch`,
   `not.toContain` and `git grep` over `src` or tracked files). Report any scan that is neither paired nor listed.

## #457 retro (merged without QA)

7. **The rule says one thing everywhere.** At `2f8e6489`, `.cursor/rules/hub-room.mdc` and
   `project-template/.cursor/rules/hub-room.mdc` are byte-identical (CRLF-normalised), and the Hub-room section of
   `project-template/.cursor/commands/start.md` and `docs/loops/cursor-start-differences.json` say the same: a seat
   with a waker reads with `--inbox`, posts, and ends its turn; exit 2 comes only from `--wait`.
8. **No live instruction still tells a Cursor seat to wait inside its turn.** Grep `.cursor/`, `project-template/`,
   `.agents/roles/`, `.agents/SYSTEM/` and `scripts/` for `--wait`, `wait again`, `foreground` and `in this same
   turn`. Classify every hit: instruction to a waker seat (a defect), planner listener, history, or exit-code text.
9. **Can the guard fail?** The PR narrowed its "no --wait" test to two exact phrases. Write three rewordings of a
   wait instruction that a seat would obey (for example "after posting, run hub-talk --wait"). Report which the test
   catches. A rewording that passes is a finding, with a proposed parse-shaped check.

## #458 retro (merged without QA)

10. **Exactly the waker files.** At `1671d005`, `git check-ignore -v` shows `.cursor/wake.lock`,
    `.cursor/waker.pid`, a `.cursor/wake-prompt-<n>.txt` and a `.cursor/hub-reply-<x>.txt` ignored, and
    `.cursor/rules/hub-room.mdc`, `.cursor/commands/start.md` and a new `.cursor/rules/x.mdc` NOT ignored. The same
    holds for a project seeded from `project-template/gitignore`.
11. **The guard can fail.** Remove each pattern in turn from the root `.gitignore` and from the template: the
    `template-seed` row goes red each time.

## Rules (headless Claude Code)

- You are **QA 281**, prefix `s162b`. Push ONLY `qa/s162b-*` branches, and only through
  `node docs/loops/qa-281/push-qa.mjs <branch>`, run from your `qa281-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config and key files report only counts, names, paths and hash match/no-match, never values (G-051).
- Commit `docs/loops/s162b-qa-report.md` on `qa/s162b-report`.
- One verdict for #445 r4 with its pinned head. For #457 and #458, HOLDS or FINDINGS (they are merged). The report's
  last line is exactly `QA-281: REPORT COMPLETE`.
