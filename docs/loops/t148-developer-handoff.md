# T-148: the titles-only legend covers ruling on and retiring a task

**By:** Forge (builder, sia-builder), 2026-10-02. **Branch:** `loop/t148-legend-retire` from `origin/master` `5ec37cdf`. **Code SHA to freeze: `9a42f7db9307ff2afac016d56eca18a896d50f7b`.** Not merged. LIGHT: one test file per vitest run, `tsc --noEmit`.

## What changed
The sentence "read it when you work the task, not when you pick one" is now **"read it before you rule on, work or retire a task, not when you merely pick one"** in four places: the INBOX.md legend (`open-brain/src/pipelines/state-views/index.ts:95`), `.claude/commands/start.md:74`, `project-template/.claude/commands/start.md:74` and `project-template/.cursor/commands/start.md:77`. The three start.md copies carry identical wording, so the cursor-vs-claude difference table is untouched.

## Evidence
- New `tests/pipelines/sync/start-legend.test.ts` (4 rows: the rendered INBOX legend, and each of the three start.md copies). **Red before: 4 failed (4). Green after: 4 passed (4).**
- `state-views.test.ts` gains the legend assertion: 14 passed. `start-parity` 4, `command-parity` 9, `mirror-parity` 13: all passed, each run as its own file. `tsc --noEmit` exit 0.

## Overlap and one consequence
- **Overlap with #297 (T-226):** it also edits the same three start.md files, but different hunks (step 5, the briefing template line, the omit sentence), not line 74. Whoever merges second rebases; I expect no textual conflict. The new test file is separate from `start-parity.test.ts` for the same reason.
- **The tracked `.agents/TASKS/INBOX.md` still shows the old legend** until the next `ob_state` write re-renders the views. I did not edit it (rendered views are never hand-edited). `sync --check` shows no drift issue from it (30 passed, the same four standing issues).
- Found while checking: `sync`'s `ci-status` warns that master `5ec37cdf` concluded `failure`. The push run for that SHA succeeded; the failing run is a `workflow_dispatch` run (36984810269), not mine.
