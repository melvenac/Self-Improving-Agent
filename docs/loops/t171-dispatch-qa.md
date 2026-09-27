# T-171 (a note is never replaced silently), stacked on T-179 round 2: dispatch to a FRESH, HEADLESS QA seat (record session 144)

**By:** Atlas (planner), record session 109 · 2026-09-27 (UTC). **Runs from** `docs/loops/qa-queue.ps1`, via
`docs/loops/qa-144/drive.ps1`. **Nobody is watching live.** Questions go in "Open for the planner".
**Not available:** `/start`, the MCP server, `gitnexus`. Scratch under `C:\qa-scratch`, temp in `C:\qa-tmp`, and commit
from a separate worktree. **Record the machine.** **Never write any live `state.json`.**

## The candidate

- **`b371176`** on `origin/loop/t171` (handoff `3eddf20`, `docs/loops/` only). Forge 140, effort medium, **stacked on
  T-179 round 2 `d0335d7`** (QA 134 scores round 2; score only what T-171 adds).
- **CI:** red `36280808413` (14 new rows; the T-169 row loses text), green `36281579531` (1325 passed). 17 of 17
  mutants red on tcm (`loop/t171-m-*`).
- **The design, as built:**
  - `update_task` and `close_task` take `append_note` or `replace_note`. A bare `note` is refused by name.
  - Every note change is reported with sizes, identically in the dry run and the write (SET, APPENDED, REPLACED, plus
    the removed first line).
  - Replacing another session's note is refused unless `replace_other_sessions: true`. A new per-task key, `note_by`,
    goes into schema v3; the migration sets `null` (unknown author) for all existing notes.

## The planner's rulings on the handoff's questions (score with these)

- **R171-1:** `~/.claude/commands/end.md` (Aaron's global copy, outside the repo) is replaced by **T-179's install
  step** (its after-merge checklist). T-171 does not edit it. After merge, its stale `note?` lines fail closed, with a
  refusal that names the fix. Verify that the refusal does name it.
- **R171-2:** `update_gap` replacing `what`, `evidence` and `recommended_update` wholesale is the same class. It becomes
  **a task**, not this round.

## Check, not accept

1. **Nothing replaces a note silently:** every op that can change a note (search `state-writer.ts` and every caller),
   bare `note` refused, `append_note` never removing text, and the dry run and write reporting identically.
2. **`note_by`:** attack it.
   - Can a caller set it?
   - Does appending add the writer's uuid?
   - Does the migration's `null` (unknown) behave as "another session's", as the handoff says, so that replacing any
     existing note needs the flag?
   - Is the schema rule (`note_by` is `[]` exactly when the note is empty) enforced in every path?
3. **Every caller listed in the handoff** (the importer, templates, docs, `/end`'s old steps): is each updated or
   shown unaffected? Search for `note:` in ops yourself.
4. **The T-169 shape:** a long note plus an "update" meant as an addition. Under the new ops, can a caller still lose
   the text without being told?
5. **Your own mutants,** at least: `append_note` implemented as replace; the dry run silent; `note_by` ignored for the
   override.

## CI and authority

- tcm, at most **6**. **No laptop CI.** **Push only `qa/t171-*`, through `node docs/loops/qa-144/push-qa.mjs`.**

## The report

- **Path:** `docs/loops/t171-qa-report.md`. The verdict first, then each check, mutants, CI, what could not be verified,
  defects, disagreements, error entries and "Open for the planner".
- Commit to `qa/t171-report`. **The LAST line is exactly `QA-144: REPORT COMPLETE`.** No `/end`.
