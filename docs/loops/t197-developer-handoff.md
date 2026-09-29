# T-197 — Cursor `/start` matches Claude Code's `/start` (record 219)

**By:** Forge, `cursor-infra`. **Branch:** `loop/t197-cursor-start-parity` from `loop/t196-hub-knowledge` (`56b06a2`). Local only (D-061).

Cursor's template `start.md` is Claude's `start.md` plus the lines named in `docs/loops/cursor-start-differences.json` (CallDynamicTool / GetDynamicTools, and the Hub room step that reads `hub-partner-seats.json`). It does not tell the seat to hand-edit rendered views, create `SESSION_TEMPLATE.md`, or print `Proposed:`.

## Rows

| Row | Test | Red then green |
| --- | --- | --- |
| CS-1 | The two template `start.md` files, difference table `docs/loops/cursor-start-differences.json`. | Documented phrases are the only extras. |
| CS-2 | `open-brain/src/pipelines/sync/start-parity.ts`, wired in `runSync`. | `npx vitest run tests/pipelines/sync/start-parity.test.ts`. Red: `is red against master's Cursor /start` loads `origin/master` templates and expects `issue` (the message matches `Proposed:` or an undocumented line). Green: `is green on this tree` expects `pass`. 3 passed, exit 0, together with the hub-seats file (7 passed). |
| CS-3 | The same check hard-fails `Proposed:`, `fix mismatches`, `hand-edit`, and `SESSION_TEMPLATE.md` in the Cursor file. | Master's template hits that list. This tree does not. |
| CS-4 | The briefing block is Claude's `NEXT` list, not `Proposed:`. | A fresh Cursor `/start` was not opened in this seat. The live `~/.cursor/commands/start.md` was restored byte-for-byte from `origin/master`'s template (MATCH ignoring CR). Installation happens after Aaron merges. |

## To verify, not asserted

Whether Forge's Cursor SessionStart writes no by-pid session proof because of T-046's fail-closed PreToolUse, or because of a separate defect, was not established in this turn.

## Record 219 r2 (QA 224)

QA 224 rejected `929673b`. The one major is CS-2: a difference-table entry waived any line that contained it. `takeExact` waives a line only when it equals one entry, and each entry is consumed once. A leftover entry is itself an issue.

`cursor-start-differences.json` now lists the three complete Cursor-only lines. `.agents/SYSTEM/hub-partner-seats.json` keeps the readers superset and adds `talk_tokens`, which says to replace `<A2A-Hub>` with the local A2A-Hub checkout. That token is not a brace placeholder. T-198 still ignores extra keys.

Red on `929673b`'s checker, with the new row in place: `a table phrase does not waive a different line that mentions it` expected `issue`, received `pass`, at `start-parity.test.ts:53`. Vitest exit 1.

Green on this tree: `npx vitest run tests/pipelines/sync/start-parity.test.ts` — 4 passed, exit 0. The mutant SHA is recorded after its red run.

The planner-role sentence is on `loop/t196-planner-md`, not this branch. Defects other than CS-2 are not labeled major. The installed-command absence was the QA machine; this desktop's live `start.md` was restored in record 219.
