# Loop 14 re-brief — amendment 1 (after Loop 15 slice two)

**From:** Atlas (planner) · **Date:** 2026-09-20 · **Amends:** `loop-14-rebrief.md` (2026-09-19),
which amends `loop-14-brief.md` (2026-09-17). Neither is retro-edited; where this file is silent, the
re-brief applies, and where the re-brief is silent, the original.
**Base:** `origin/master` at the revision carrying `D-024` (rev 52 or later — read the number from
`state.json`). **Branch:** `loop/14-three-seat-record`. **Fresh developer and QA sessions**, per the
roll rule (`D-023`).

> **Why this file exists.** The re-brief was written on 2026-09-19 with Loop 15 slice one not yet
> run. Both slices have now run and closed (`D-022`, `D-024`), the seats roll on the record after
> every loop, and three of the re-brief's "still true" rows are no longer true. Run it as written and
> C2 would be scoped against a defect that is now recorded, numbered and half-decided.

---

## 1. What changed under the re-brief, verified 2026-09-20 rather than recalled

| Claim in the re-brief | Status now | Checked by |
| --- | --- | --- |
| `handoff` is one slot, written only by the developer; "Probe never runs `/end` either" | **Both seats now run `/end` at every loop close** (`D-023`, the roll rule), and **the second overwrites the first — `G-046`**, with Planner 49 as its evidence. The overwrite is now structural, every loop. | `state.json` at rev 52; #61/#63 and #71/#72. |
| Count 46 / 26 | **50 Planner / 30 Developer / 2 QA** at slice two's close. The QA seat has a table now. | `loop-15-slice-2-closeout.md` §6. |
| "Loop 15 produces `D_t`, `A_t.gitref`, `E_t`" | **Also `G_plan.json` and `G_done.json`** — the gates' typed answers, the policy applied, the runtime's decision, in every mode. | `open-brain/src/harness/artifacts.ts`. |
| Open for Aaron: "after slice one or after slice two?" | **Answered by sequencing:** after slice two (`D-023`). | This file. |
| Open for Aaron: confirm C2's re-scoping | **Ruled below (§2), on evidence that did not exist on the 19th.** | — |
| `G-032` — role files tracked, nothing reads them | **Still open.** Nothing under `open-brain/src` or `.claude/commands` references `.agents/roles/`. C1's remainder stands. | `grep -rln 'agents/roles' open-brain/src .claude/commands` → nothing. |
| The planner's roll: `/checkpoint` → `/compact` → nothing | **Still true**, and now with a comparison: both other seats rolled on the record twice this week and the planner did not roll at all. | `last_session` 70; the planner's session stamp is still 64. |
| The session number counts sessions | **False — `G-047`.** It counts close-out writes; one developer session took three numbers in slice two. Any per-session rate C3/C4 quote is an upper bound on the denominator. | `loop-15-slice-2-developer-handoff.md` §10. |

## 2. C2 — ruled, not re-asked

The re-brief left C2's shape open: enumerate what the planner needs at a roll and sort it into
*carried by the runtime's artifacts* or *carried by nothing*, with a per-seat `handoff` as the
fallback "if that list is long." **Two facts since then decide it:**

1. **`G-046` made the single slot a structural defect.** With the roll rule, every loop close
   overwrites one seat's handoff with the other's. The fallback is no longer a fallback; it is the
   only shape under which two seats can roll at all without citing each other's commits by hand.
2. **The runtime's artifacts carry the loop, not the seat.** `D_t`, `E_t`, `G_*` say what a loop
   decided, built, judged and gated. They do not carry what the re-brief's enumeration lists —
   open PRs and which were QA'd, the SHA frozen for a QA in progress, questions pending for Aaron,
   rulings made mid-loop — because none of those is an iteration's output. Slice two confirmed it:
   every one of those was carried by A2A messages and by the planner remembering.

**Ruling:** **C2's deliverable is a per-seat handoff** — `handoff` keyed by seat, or a `handoffs[]`
list with a seat field, the developer's choice — **and the greeting renders the reader's own seat's
last handoff and names the other seats' by SHA.** The enumeration is still done, once, as the *test*
of the shape: every item on the "carried by nothing" list must have a place in the per-seat handoff
or be shown to live in a runtime artifact. `set_handoff` and `end_session` take a seat; a write
without one is refused. **`G-047` is folded in:** `end_session` becomes idempotent per uuid (a second
write for the same uuid updates its entry rather than taking a new number), so the number counts what
its name says.

## 3. C1, C3, C4 — unchanged, with one sharpening each

- **C1's remainder (`G-032`)** stands as the re-brief states it: the session-start pipeline loads the
  seat's role file and `shared.md` and the greeting names the file and its commit. **Sharpening:**
  the greeting also names the seat's *own* last handoff and its commit (C2's output), so C1 and C2
  are observed by the same line.
- **C3** stands: a planner close-out that is run, not remembered. **Sharpening:** the planner seat
  rolls on this loop's close — the first time — and its `/end` is C3's acceptance: the rows the
  runtime does not carry are written by the command, not by the seat deciding to. Returning the tree
  to detached after a push is still the first piece and still done by hand; it has now been run by
  hand more than twenty times.
- **C4** stands, binary: kill the planner session, `/start` fresh in `~/Worktrees/sia-planner`,
  then the same in `~/Worktrees/sia-qa`. **Sharpening:** the fresh planner must come back knowing
  which loop is live *from the record*, and the greeting must say which seat's handoff it rendered.
  A greeting that shows the developer's handoff to the planner is C4 failing on the row C2 exists
  for.

## 4. What Loop 14 inherits from Loop 15 that it did not have on the 19th

- **`T-157`** (retention evicts cited task ids) — in scope for the developer if it touches the
  same writer; otherwise named as out of scope, not forgotten.
- **`G-045`** does not block Loop 14 (no role runs through the harness runtime here) and is slice
  three's first repair. Not this loop.
- **The three-seat process as slice two ran it** — criteria before candidate, frozen SHA, QA in its
  own tree with zero skipped, probes withheld until the report, the record moving one seat at a time,
  citing branches by rev — is the process here too. It is in `shared.md` and the two close-outs;
  not restated.
- **The main tree runs every session's hooks.** Loop 14 changes the session-start pipeline; **its
  candidate is evaluated in the QA tree, and the main tree moves only on the merge** (the rule added
  to `shared.md` in slice one). A candidate that breaks `/start` must be found in a tree where that
  breaks one seat, not four.

## 5. Not held for Aaron

Sequencing is ruled. C2's shape is ruled above. Merge order at close is the slice-two order.
