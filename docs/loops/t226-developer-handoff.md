# T-226: /start takes the brief from ob_start's `Latest brief:` line

**By:** Forge (builder, sia-builder), 2026-10-02. **Branch:** `loop/t226-start-brief-text`, stacked on `6c495794` (T-210). **Code SHA to freeze: `496762b8f4506edc3b288e12ebe7ef4e70e836ed`.** Not merged. LIGHT: touched tests and `tsc --noEmit` only.

## What changed
`.claude/commands/start.md`, `project-template/.claude/commands/start.md` and `project-template/.cursor/commands/start.md` (the Cursor mirror), identical wording in all three:
- Step 5 no longer says "by the largest loop number". It says `ob_start` names the brief on its `Latest brief: <path> (<date>)` line (newest `*brief*.md` in `docs/loops/` by git commit date), not to pick one by loop number or file name, that an absent line means no brief, and to read boundary reports the brief or handoff names.
- The briefing template's line is `Latest brief: {the "Latest brief:" line ob_start printed, verbatim}`, and the sentence under it says the line is omitted when `ob_start` printed none.
No line of the cursor-vs-claude difference table was needed: the Cursor copy carries the same sentences, so `cursor-start-parity` has nothing to waive and the table is untouched.

## Evidence
- New rows in `start-parity.test.ts` (T-226), for each of the three copies: no "largest loop number" or "loop-N-*.md"; the verbatim briefing line and the omit sentence are present; and the Claude and Cursor template copies carry equal brief-related lines (at least 5).
- **Red before** (rows added, text not yet edited): 7 failed | 4 passed (11). **Green after:** the file passes; with `command-parity.test.ts` and `mirror-parity.test.ts`: **3 files, 33 tests passed**. `start-parity` is the test that pins the copies; it stays green.
- `tsc --noEmit` exit 0. `sync --check`: `command-parity` pass; summary 30 passed, 0 fixed, 2 warnings, 4 issues (the standing four), 1 skipped (`gitnexus-index`).
- Line endings of each file were kept.
