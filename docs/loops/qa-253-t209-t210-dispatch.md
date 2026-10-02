# QA 253: T-209 (gaps newest-first) + T-210 (latest brief by git commit date)

**By:** Atlas (planner), 2026-10-02, record session 157. **Dev dispatch:** `docs/loops/session-157-dev-dispatches.md`,
the sia-builder section. Each task's acceptance text is its `note` in `.agents/state.json`.

**Candidate:** `6c495794145097d47f009963c2c93dadfb1a319b` on `origin/loop/t209-t210-render` (PR #287), by
sia-builder.

- **Base:** `79d1f5d9`.
- **Handoff:** `docs/loops/t209-t210-developer-handoff.md` at the branch tip `5ceb6eef`. That tip is the code plus the
  handoff only.
- **T-183** is measured in the handoff and ruled by D-100. It is **not** under test here.

**QA runs on Opus. Job class: LIGHT.** Touched test files, mutants on those files only, and `gh` reads. No full
suite, because CI runs it on the head. **Make no live Jev call.**

## Rows

1. **Confined.** `git diff 79d1f5d9...6c495794` touches only the files below, with no edits outside T-209 and T-210:
   - `session-start/latest-brief.ts` (new), `session-start/state-render.ts`, `server.ts`;
   - their two test files.

   Quote the `server.ts` hunk and say what it changes.
2. **T-209 red then green.** Run `state-render.test.ts` from the candidate against `state-render.ts` from the base:
   the T-209 row fails. Then run it against the candidate: it passes.
   - Your own fixture: gaps opened in sessions 54, 150 and 65, with ids that are not in session order. They render
     150, then 65, then 54.
   - Two gaps from the same session render by id **descending, numerically**, so G-100 comes before G-99. Show it.
3. **T-209 mutant of your own:** order by id only. Report which row catches it.
4. **T-209, the record is untouched.** The render reorders, but `state.json`'s `gaps[]` order is unchanged after
   `ob_start`. Show it on a scratch copy.
5. **T-210, your own fixtures** (scratch git repos under `~/qa-scratch`, with commit dates set through
   `GIT_COMMITTER_DATE`):
   - **(a)** `loop-16-brief.md`, committed earlier, and `t201-brief.md`, committed later: `t201` wins.
   - **(b)** An old brief whose mtime you touch to now does not win.
   - **(c)** No `*brief*.md` under `docs/loops`: the line is **absent**. It is not blank and not "none".
   - **(d)** A brief deleted at HEAD is not named.
   - **(e)** A file named `briefing-notes.md` or `debrief.md`. Report whether the `*brief*` glob takes it, and whether
     that matters.
   - **(f)** Not a git repo, or git missing from PATH: it prints `not determined (git: …)`. It never claims there is
     no brief.
6. **T-210 mutants of your own:**
   - (a) sort by path;
   - (b) use mtime instead of the commit date.

   Report which rows catch each one.
7. **The live line.** At the candidate, run `ob_start` (the CLI in a scratch copy of this repo, never the live record)
   and quote the `Latest brief:` line. Check it with `git log -1 --format=%cI -- <that path>` against the other briefs.
8. **Nothing else moved.** Run the touched tests and the `session-start` neighbours (`standing-cron`,
   `record-session-number`, `session-log`, `start-parity`). Check that `tsc --noEmit` is 0.
9. **CI on the head (read only).** `gh run list --commit 6c495794` and `--commit 5ceb6eef`: give the event,
   conclusion and `test` job for each run.

## Rules (headless Claude Code)

- You are **QA 253**, and your prefix is `t209-t210`. Push ONLY `qa/t209-t210-*` branches, and only through
  `node docs/loops/qa-253/push-qa.mjs <branch>`, run from `~/qa-scratch/qa253-wt`.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read CI.
- Commit `docs/loops/t209-t210-qa-report.md` with its `.E_t.json` on `qa/t209-t210-report`. Give each task its own
  verdict line. The last line is exactly `QA-253: REPORT COMPLETE`.
