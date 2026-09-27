# T-171 (widened by QA 125's D4): a note is never replaced silently. Brief for a FRESH developer session (record 140)

**By:** Atlas (planner), record session 109 · 2026-09-26. **To:** the Claude developer seat (Forge), record **140**, a
fresh session (D-035) in `~/Worktrees/sia-infra`. **Authority:** Aaron ("infra has been cleared"), and T-179's rulings
(D4 folded into T-171). Merging is Aaron's (D-019).

## Why

`update_task` **replaces** a task's note (`state-writer.ts`: `if (op.note !== undefined) t.note = op.note;`), and
neither the dry run nor the write says so. It was found in session 78: a one-sentence correction meant as an addition
would have erased T-169's 1,869-character note, and the dry run reported only "Applied (1): update_task T-169".
**QA 125's D4:** `close_task`'s `note` replaces in the same way. It is the class of G-024 and G-010: a record operation
whose destructive half is not reported. Under T-179 (records keyed by session), one session replacing another
session's note is also T-163's class.

## Base: STACKED on T-179 round 2

Branch `loop/t171` from `origin/loop/t179-r2` (`d0335d7`), which changed `state-writer.ts`. If round 2 gets a fix round
after QA 134, merge it in (never rebase).

## The work (design is the developer's; these must hold)

1. **Adding to a note and replacing it are different ops, named at the call.** Replacing is never the silent default.
   Either separate `append_note` and `replace_note` ops (T-171's option b), or a required `mode` field. Choose, and say
   why.
2. **The dry run AND the write report every note change** with its size: `note APPENDED: +N chars` or `note REPLACED: N
   chars -> M chars`. A replace that would remove text also prints the removed text's first line.
3. **`close_task`'s note** follows the same rule.
4. **A note written by another session** (under T-179's keys) cannot be replaced without that being named in the
   output. Refusing it outright is also acceptable; choose, and say why.
5. **Every existing caller** (`ob_state` users, the importer, `/end`'s old steps, templates and docs that show `note:`)
   is found by search and listed. Each is updated or shown to be unaffected.

## How

- Red first on tcm: the T-169 shape (a long note, an "update" meant as an addition) must fail today by losing text,
  then pass. A mutant per protection. `npx tsc --noEmit -p .` before every push. No full local suite.
- Scratch copies only. **Never write SIA's live `state.json`.** Push only `loop/t171` and `loop/t171-*`.

## Hand back

`docs/loops/t171-developer-handoff.md`, with:
- the design choice;
- the callers list;
- the red, green and mutant runs;
- your effort, from your transcript.

**Push it BEFORE messaging atlas.** No `/end`.
