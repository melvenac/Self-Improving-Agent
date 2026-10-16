# T-298-S1 amendment 1: a shorter lag note (the budget holds), and KEY_ORDER carries written_rev

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t298s1-reply-2.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-16, session 173. **Amends:** `docs/loops/t298-t299-greeting-truth-brief.md` (the
brief). Everything in the brief stands except what this file changes. **Tag:** `T-298-S1`.

## What happened

The first run stopped correctly with `BLOCKED T-298-S1 budget 4403/31`. The "EVERY flag on" worst case, with the lag note
present at +999, measured 4403 chars against `BRIEFING_BUDGET.chars` 4400. The run also found a gap in the brief: adding
`written_rev` to `HandoffSchema` alone turns 31 state-writer rows red (`KEY_ORDER and StateSchema disagree`). It fixed
that with one token, and the planner ratifies the fix below. Commit 1 (61ab88a4, the test file) is made. Commit 2's work
is uncommitted in the QA PC worktree `oneoff-t298s1`, branch `fix/t298-greeting-truth`.

## Rulings

**A1. The budget does not move.** `BRIEFING_BUDGET` stays `{ lines: 31, chars: 4400 }`. The lag note gets shorter
instead. The handoff's own revision is derivable (record rev minus lag), and the metrics row carries both numbers.

**A2. The lag note's format** (replaces R2's format; R2's placement and the move of `const own` stand):
- `handoffLagNote` returns `` `handoff +${lag}` `` (still null when there is no own handoff, no stamp, or lag ≤ 0).
- In BOTH layouts the session line's `state rev ${s.revision}` becomes `` `state rev ${s.revision}${note ? ` (${note})` : ""}` ``.
  So `state rev 508 (handoff +2)`, with no `·` separator and no `handoff rev N`.
- Arithmetic: the old suffix was ` · handoff rev W (+999)`, which is 22 chars plus W's digits. The new one is
  ` (handoff +999)`, which is 15. That saves at least 8 chars, so the worst case goes from 4403 to at most 4395.

**A3. KEY_ORDER** (added to R1): in `state-schema.ts`, `KEY_ORDER.handoffs` lists `"written_rev"` immediately after
`"first_rev"`. This is the token the first run added; keep it as it is.

**A4. Test strings.** The test file is committed (commit 1) with R2's old format. Commit 2 changes ONLY these expected
strings in `t298-greeting-truth.test.ts`, and no other row:
- G2: `state rev 508 · handoff rev 506 (+2)` becomes `state rev 508 (handoff +2)`.
- G3: `state rev 508 · handoff rev 506 (+2) · Drift` becomes `state rev 508 (handoff +2) · Drift`.
- G4: `not.toContain("handoff rev")` becomes `not.toContain("(handoff")`.
Name the change in commit 2's message: `(lag-note strings per amendment 1)`.

**A5. Worst case.** Keep the "EVERY flag on" row's stamp at +999, as the first run made it. It must now pass at ≤ 4400
chars and ≤ 31 lines. Paste its BUDGET_PROBE line if you added one, then remove the probe before committing. If it is
still over: STOP, `BLOCKED T-298-S1 budget <chars>/<lines>` again.

## Steps (resume, not restart)

1. Same environment as the brief's step 1 (Node v22, REPLY_PATH printed first).
2. In the EXISTING worktree `oneoff-t298s1` (or the path the launcher names), check that:
   - `git rev-parse HEAD` = `61ab88a4...` (print it in full);
   - the branch is `fix/t298-greeting-truth`;
   - `git log --oneline 88590a18..HEAD` shows exactly 1 line;
   - `git status --porcelain` lists only the brief's step-7 files.

   If the worktree is gone, STOP: `BLOCKED T-298-S1 worktree missing`. The planner then re-dispatches from scratch.
3. Apply A2 and A4. Edit with the Edit tool or `sed -i` from Git Bash only (the brief's step 2 rule).
4. Run the brief's step 4 command set, the module-boundary row, both tsc configs and `npm run build`. Paste the outputs.
   Then make commit 2, with the brief's title plus ` (lag-note strings per amendment 1)`.
5. Run the brief's steps 5 to 8 unchanged. M1 now targets `lag > 0 ?` in the shortened `handoffLagNote`; expect G4 red.
6. Reply as the brief says. The first line is `READY T-298-S1 <sha40> PR #<n>`, or BLOCKED with a reason.
