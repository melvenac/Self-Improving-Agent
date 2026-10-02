# QA 255, batch B1: session-start render (#287, #291, #297, #312)

**By:** Atlas (planner), 2026-10-02, record session 157, under Aaron's batch-QA rule (4 to 6 related PRs per run, and
one approval per accepted batch).

**QA runs on Opus. Job class: LIGHT.** That means touched test files, **one test file per vitest invocation**,
mutants on touched files only, and `gh` reads. No full suite: CI runs it on each head, now on GitHub-hosted
`ubuntu-latest` (T-227). **Make no live Jev call.**

**Pinned heads.** A head that moved since this dispatch is reported and QA'd at the pinned SHA.

| PR | task | head | stacked on | dev handoff |
|---|---|---|---|---|
| #287 | T-209 gaps newest-first + T-210 latest brief (round 2 of QA 253) | `0085e78a81e445d942965efce1c358fb9e83f57e` | master | `docs/loops/t209-t210-developer-handoff.md` |
| #291 | T-183 render cut (newest 10 gaps, 100-char task clip, P2/P3 count lines) | `f76392d2963ad549defee2e52fecc5ba8eee20b6` | #287 | `docs/loops/session-157-builder-2-handoff.md` |
| #297 | T-226 `/start` takes the brief from `Latest brief:` | `fc71d9696527f97f28ac6a7c4cd8ee572e0fa1f0` | #287 | `docs/loops/t226-developer-handoff.md` |
| #312 | T-148 legend: read the note before ruling, working or retiring | `19714baa42a002d306f118f6b5c4403617bdaf34` | master | `docs/loops/t148-developer-handoff.md` |

The rulings each PR implements are D-100 (the T-183 cut), D-101 (QA 253, the round-2 reasons) and the dev dispatches
in `docs/loops/session-157-dev-dispatches*.md`.

## Rows for each PR

1. **Confined.** List every file the PR's own commits touch beyond its base. Name anything outside its task.
2. **Red then green.** Run the PR's new or changed test files against its base's source: they must fail. Then run them
   against the head: they must pass. Quote the counts.
3. **One mutant of your own** on the core change, and report which row catches it. Re-run one of the developer's stated
   mutants as well.
4. **CI on the head (read only).** `gh pr checks <n>`. Quote the `test` conclusion and the run id. A red or missing
   `test` fails this row.

## Rows specific to B1

5. **#287 round 2, the QA 253 failures.**
   - QA 253's own `qa253-t209.test.ts` (on `origin/qa/t209-t210-report`) passes at `0085e78a`. That covers G-100
     before G-99, and G-10, G-9, G-2.
   - `tests/server.test.ts` passes.
   - Show the regex bytes with `cat -A`: they read `/(\d+)\s*$/`.
6. **#291.**
   - A 40-gap fixture renders 10 gap lines plus a count line computed from `gaps[]`.
   - A 250-character title clips to 100 characters plus `…`, and its id is intact.
   - P2 and P3 render as count lines.
   - Run `server.test.ts` on this head as well, because round 1 missed it.
   - Measure the live greeting with `ob_start` against a SCRATCH COPY of the record (never the live one) and quote its
     character count.
7. **#297 and #312 both edit the three `start.md` copies** (`.claude/commands/`, the project template, the Cursor
   mirror). `start-parity`, `command-parity` and `mirror-parity` pass on each head.
8. **Batch merge order.** On a scratch branch from `origin/master`, merge the heads in this order: #287, #291, #297,
   #312.
   - Report every conflict with the file and hunk. Do not resolve one by hand: stop and report.
   - On the merged result, run each touched test file (one file per invocation) and `tsc --noEmit`, and quote the
     counts.
   - This row decides whether the batch can merge as a set.

## Rules (headless Claude Code)

- You are **QA 255**, and your prefix is `b1-start`. Push ONLY `qa/b1-start-*`, and only through
  `node docs/loops/qa-255/push-qa.mjs <branch>`, run from `~/qa-scratch/qa255-wt`.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- Commit `docs/loops/b1-start-qa-report.md` with its `.E_t.json` on `qa/b1-start-report`.
- Give **one verdict line per PR** and a **batch verdict**: ACCEPT only if every PR is accepted AND row 8 merges
  cleanly. The last line is exactly `QA-255: REPORT COMPLETE`.
