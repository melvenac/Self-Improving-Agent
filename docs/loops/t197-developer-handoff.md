# T-197 — Cursor `/start` matches Claude Code's `/start` (record 219)

**By:** Forge, `cursor-infra`. **Branch:** `loop/t197-cursor-start-parity` from `loop/t196-hub-knowledge` (`56b06a2`). Local only (D-061).

Cursor's template `start.md` is Claude's `start.md` plus the lines named in `docs/loops/cursor-start-differences.json` (CallDynamicTool / GetDynamicTools, and the Hub room step that reads `hub-seats.json`). It does not tell the seat to hand-edit rendered views, create `SESSION_TEMPLATE.md`, or print `Proposed:`.

## Rows

| Row | Test | Red then green |
| --- | --- | --- |
| CS-1 | The two template `start.md` files, difference table `docs/loops/cursor-start-differences.json`. | Documented phrases are the only extras. |
| CS-2 | `open-brain/src/pipelines/sync/start-parity.ts`, wired in `runSync`. | `npx vitest run tests/pipelines/sync/start-parity.test.ts`. Red: `is red against master's Cursor /start` loads `origin/master` templates and expects `issue` (the message matches `Proposed:` or an undocumented line). Green: `is green on this tree` expects `pass`. 3 passed, exit 0, together with the hub-seats file (7 passed). |
| CS-3 | The same check hard-fails `Proposed:`, `fix mismatches`, `hand-edit`, and `SESSION_TEMPLATE.md` in the Cursor file. | Master's template hits that list. This tree does not. |
| CS-4 | The briefing block is Claude's `NEXT` list, not `Proposed:`. | A fresh Cursor `/start` was not opened in this seat; this session was already inside record 219. The installed `~/.cursor/commands/start.md` was copied from the template so the next fresh `/start` prints NEXT. |

## To verify, not asserted

Whether Forge's Cursor SessionStart writes no by-pid session proof because of T-046's fail-closed PreToolUse, or because of a separate defect, was not established in this turn.
