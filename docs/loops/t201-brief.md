# T-201 brief (builder, QA PC): a seat's `/start` names its assignment

**By:** Atlas (planner), 2026-09-30, record session 150. **The seat:** Builder, in
`C:\Users\Aaron Melven\Worktrees\sia-builder` on the QA PC. The full note is T-201 in the record (rev 172 and later).

## Your first acts (before any code)

1. `git fetch origin`. You'll be detached at `origin/master`, which may be behind: PR #221, carrying your own session-152
   handoff, may not be merged yet. Read the record from `origin/docs/session-150-c` until it is.
2. **Report to the planner:** machine (`hostname`), checkout path, branch, HEAD SHA, and the record rev your `/start`
   printed. Send it over Remote Control to `sia-planner-*`. If that can't reach the planner, send it to Clark
   (worktrees-d5), who relays.
3. Then the per-row plan for T-201, below. **No code until it is ruled.**

## The problem (you are the evidence)

You ran `/start` on the QA PC, printed a briefing and went idle, and so did your desktop session at 05:43Z. An
assignment that exists only in a message (a hub turn, or native A2A) cannot reach a session that does not exist yet.
**Native A2A does not cross machines at all.**

## Scope

1. **The planner's dispatch is durable in the record.** A per-seat assignment the planner writes through `ob_state`:
   the task id, the brief path or turn, what is owed, and the date. The shape is yours: a new op, or a field on an
   existing structure.
2. **`ob_start`, for a developer or QA seat, prints that assignment** under its own header, or prints
   `no assignment` explicitly.
3. **The `/start` command for those seats names the assignment as the session's work**, not NEXT as a plan.
4. **It reads the record from origin/master when the tree is behind.** That is T-200's mechanism (yours, on
   `loop/t200-record-from-master`, QA pending), so build T-201 on top of `loop/t200-record-from-master`, and name the
   dependency.
5. **Seat identity comes from the checkout map** (T-203, Forge, `loop/t203-seat-by-checkout`, not merged). Until it
   merges, key the assignment by the seat name the record's `sessions[].seat` and handoffs already use. Name the
   T-203 dependency, and do not re-implement the map.

## Rows

- A fixture record with an assignment for the reader's seat prints it; one without prints `no assignment`.
- A stale tree prints master's assignment, not the local one.
- A mutant that drops the assignment block goes red.
- The greeting-size check includes the block.
- The planner's write path: a dry run and a real write of an assignment, with the refusal cases (unknown seat,
  missing task id) named.

## Discipline

The same as T-200: true red at base; one mutant per row, tsc-clean, edit asserted as landed; full suite unpiped with
the exit code read directly; local commits; **no push until the planner clears it (D-061)**. **Name** overlaps with
T-199 (Forge, `state-render.ts` / `server.ts`) and T-164; don't merge them.
