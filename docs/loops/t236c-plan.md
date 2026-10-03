# T-236 (c) plan: FOCUS + SEATS in the budgeted briefing

**By:** sia-infra (Claude Code, Forge's developer role, seat Infra), session 160, 2026-10-03. **Dispatch:** atlas-sia,
s160. **Plan only; no product code.**

**Base:** `origin/master` `f8345f1b` for the record and the seat map. The briefing is #393's head `6f145faf`
(`renderBudgeted`, `BRIEFING_BUDGET`), which is **not merged**. Every number below says where it was measured.

T-236's note, item (c): FOCUS and SEATS are "computed from the RECORD only (never the dashboard API), after T-203/T-191
give a per-seat task field; hub presence from ob_start's existing fetch". T-203 is merged: `hub-partner-seats.json` is
the one seat map, and `resolveCheckoutSeat` resolves the checkout's seat. T-191 was deferred to P2 today, so there is no
per-seat profile, and this plan does not assume one.

## Measured before planning

1. **The budget has no line to spare.** At `6f145faf`, `briefing-budget.test.ts`'s worst case, "every section past
   its cap", renders **30 lines and 3,373 chars** against `BRIEFING_BUDGET = { lines: 30, chars: 4096 }`. That is 0
   lines of headroom and 723 chars. *Instrument:* a `console.log` of `size(lines)` added to that one row, in a
   `git archive` copy of `6f145faf` in scratch. No worktree was touched.
2. **Developer handoffs are too sparse and too stale to carry an assignment.** These are the record's
   handoffs on `f8345f1b` (rev 311 in this tree):
   - `sia-infra` has **none**.
   - `sia-builder`'s newest is session 156; `sia-forge`'s newest is session 151.
   - The only seat writing every session is the planner (153 to 160).
3. **The planner's `loop_state` names work only in prose.** `open_prs[]` is `{ref, qa_status, note}`. The seat and the
   task appear only inside `note` (for example `"T-203, QA 266 ACCEPT at 09f82a12; … sia-infra re-merging master"`).
   `LoopStateSchema` is a `strictObject` with no seat field.

## (1) Where each seat's assignment comes from: RECOMMEND a new optional task field `assignee`

| Candidate | Verdict | Why |
|---|---|---|
| Newest handoff per seat and checkout | **no** | Measured stale or absent (2 above). FOCUS would print a weeks-old pick-up as current work, or nothing for sia-infra, which is working on T-237 right now. A focus line that is stale reads exactly like one that is fresh. |
| `loop_state` (the planner's handoff) | **no** | The seat is in free text. Reading it is a pattern match on prose, which `shared.md` rules out ("the instrument for structured data is a parser"). Adding a structured `assignments[]` to `LoopStateSchema` would tie an assignment's lifetime to a planner close-out, which is overwritten every planner session and is a snapshot rather than state. |
| **New optional `tasks[].assignee`** | **yes** | The assignment lives on the thing assigned. The planner sets it at dispatch (`update_task {id, assignee: "infra"}`). It survives every handoff rewrite, ends when the task closes (the render ignores `done`), and can be checked against the seat map. |

The field is `assignee: string | null`, **optional, default null**. Its value is a key of `hub-partner-seats.json`
`seats` (`planner`, `builder`, `forge`, `infra`, `qa`, `research` on `f8345f1b`): the seat, not the hub name or the
agent name, so a hub rename (T-213) does not orphan it. A task with no `assignee` is unassigned. **A2A's record has no
such field and parses unchanged.**

- **The writer does not read the seat map**, which keeps it free of cross-file dependencies.
- A `/sync` check, `task-assignees`, reports an `assignee` that is not a seat in the map as an **issue**. It **skips**,
  with the reason, when there is no map.

## (2) What FOCUS and SEATS print, within the budget

The seat is resolved by **checkout** (`resolveCheckoutSeat`), never by `AGENT.local.md`. That is T-203's rule, and
falling back to the identity is the mutant it exists to kill.

**FOCUS** (one line, about 160 chars, `cut()` like the other sections):
- `FOCUS: T-237 hub presence accepts pollAgeMs null (P1, open)`, which is this seat's highest-priority non-done task
  with `assignee === <seat>`. Ties go to the lower id. More than one adds `· +N more: state.json tasks[] (assignee)`.
- No assigned task: `FOCUS: none assigned in the record`. This is printed, never omitted, and **never falls back to
  NEXT or the objective**: a seat told it has nothing assigned is told the truth.
- Unknown checkout: `FOCUS: seat unknown for checkout <c>`. A seatless checkout (the main one): no FOCUS line.

**SEATS** (one line, about 240 chars):
- `SEATS: builder T-235 · forge T-236 · infra T-237 · qa — · research —`, every seat in the map in map order. Each shows
  its highest-priority assigned task id, or `—`. More than one adds `(+N)`.
- **Presence comes only from the roster ob_start already fetched.** `server.ts` passes the parsed roster that
  `describeHubPresence` already holds. A seat in that roster gets ` polling`, ` not polling` or ` absent`. A seat not
  in it gets nothing.
- There is **no second fetch** (a row asserts one call), and no presence word is ever guessed. Today only the
  planner's reader row lists partners, so in practice only the planner sees presence suffixes. That is correct, not
  a gap.
- Cut at the cap with `+N more: .agents/SYSTEM/hub-partner-seats.json`.

**The budget: two new lines need two lines found.** The worst case is already 30/30. I recommend this, in order:
1. **FOCUS replaces the PICK UP HERE header line.** The header becomes `FOCUS: …`, and the pick-up text follows it
   unchanged. That is net 0 lines, and FOCUS is the pick-up's subject anyway.
2. **SEATS takes the line the latest-brief pointer has today.** Brief and skills become one line,
   `Latest brief: … · Skills: …`. Both are short pointers. That is net 0 lines, and the chars stay inside the 723 to
   spare (FOCUS about 160 plus SEATS about 240 is under 400).

Both change `renderBudgeted`, which is forge's file. The alternative is raising `BRIEFING_BUDGET.lines` to 32, but the
cap is a ruling in T-236's note, and this plan does not widen it on its own authority.

**For atlas to rule:** the trade above (recommended), or a 32-line budget.

## (3) The flag

There is a new `greeting.json` key, **`briefing_focus`**, default OFF, read through `greetingFlag` (the one reader,
`greeting-flags.ts`). It applies **only inside the budgeted layout**: `briefing_focus` without `briefing_budget`
renders nothing new.

- So that combination is not silent, the `task-assignees` check (or the flags line of `/sync`) reports
  `briefing_focus has no effect without briefing_budget`.
- **A2A** has no `greeting.json`, so both flags are off and the render is byte-identical. The A2A fixture
  `a2a-state-1c200b41.json` is already on master via #391 (sha256 `8892464b…`).
- SIA turns `briefing_focus` on in the same PR. The keys stay sorted:
  `briefing_budget, briefing_focus, handoff_caps, role_docs_by_sha`.

## (4) Acceptance rows, each red first on master plus #393, and the mutants

| Row | Asserts | Red at base because |
|---|---|---|
| F1 | sia-infra (map seat `infra`) with T-237 `assignee: "infra"` prints `FOCUS: T-237 … (P1, open)`, even though its `AGENT.local.md` says another name | no FOCUS line exists |
| F2 | a seat with no assigned task prints `FOCUS: none assigned in the record`, and no task id from NEXT or the objective appears on that line | no line |
| F3 | an unlisted checkout prints `FOCUS: seat unknown for checkout <c>`; the main checkout prints no FOCUS line | no line |
| F4 | three assigned tasks: the highest priority is shown, then `+2 more: state.json tasks[] (assignee)` | no line |
| F5 | a `done` task with `assignee` is never shown | no line |
| S1 | SEATS lists every map seat in map order, each with its task id or `—` | no line |
| S2 | with a roster, the planner's SEATS shows `polling`, `not polling` or `absent` per partner, and the fetch was called exactly once | no line |
| S3 | with no roster (UNKNOWN, timeout, no key), SEATS has no presence words at all | no line |
| B1 | worst case with `briefing_focus` on, every seat assigned, long titles and the #393 worst case: ≤ 30 lines and ≤ 4,096 chars, with FOCUS and SEATS present | the lines don't exist; with them added naively, 32 lines |
| O1 | flag OFF: byte-identical on the SIA and A2A fixtures, with `briefing_budget` both on and off | passes at base; this is the identity proof, as in #391 |
| W1 | the schema accepts `assignee` absent or null, and the A2A fixture parses; `update_task` sets it and clears it with null | the field is unknown (strict schema) |
| C1 | `/sync task-assignees`: an assignee that is not a map seat is an issue; no map is a skip with its reason | no check |

**Mutants:** each is an edit to the product with `tsc` 0, killed by the rows named.

| Mutant | Killed by |
|---|---|
| M1: seat by `AGENT.local.md` identity instead of checkout | F1, F3 |
| M2: no assignment falls back to the first NEXT task | F2 |
| M3: `done` tasks included | F5 |
| M4: SEATS does its own fetch | S2 (call count) |
| M5: a presence word printed with no roster (guessed) | S3 |
| M6: the FOCUS or SEATS cap removed | B1 |
| M7: the flag ignored (always on) | O1 |
| M8: the writer drops `assignee` on update | W1 |
| M9: the sync check always passes | C1 |

## (5) Files

| File | Change | Owner today |
|---|---|---|
| `open-brain/src/shared/state-schema.ts` | `TaskSchema.assignee` optional, nullable | **forge** |
| `open-brain/src/shared/state-writer.ts` | `update_task` and `open_task` accept `assignee` | **forge** |
| `open-brain/src/pipelines/session-start/focus.ts` (new) | pure `focusLines(state, seat, seatMap, roster)` that returns the FOCUS and SEATS lines | infra |
| `open-brain/src/pipelines/session-start/briefing.ts` | `BriefingInput.focus?`; in `renderBudgeted`, FOCUS replaces the PICK UP header and brief plus skills share a line | **forge** |
| `open-brain/src/server.ts` | resolve the seat by checkout; pass the existing roster and the flag into the briefing input | infra |
| `open-brain/src/pipelines/sync/task-assignees.ts` (new), `sync/index.ts` | the check | infra |
| `.agents/SYSTEM/greeting.json` | `briefing_focus: true` (sorted) | shared |
| tests: `focus.test.ts` (new), `briefing-budget.test.ts` (B1, O1), `state-writer.test.ts` (W1), `task-assignees.test.ts` (new) | rows above | split as the files are |
| `CHANGELOG.md` | Unreleased entry | whoever lands |

**Suggested split, for atlas to rule:**
- **forge:** a small PR first, after #393 merges: the schema and writer `assignee` (W1, M8).
- **infra:** then `focus.ts`, `server.ts`, the sync check, and the two `renderBudgeted` edits, which are forge's file.
  Forge signs off on those edits before the push, per the brief's rule.

Doing it the other way round leaves `focus.ts` reading a field the schema rejects.

## Open points for atlas

1. **The budget trade:** (2)'s recommendation, or 32 lines.
2. **The split and the order:** forge's schema PR first.
3. **Planner practice:** FOCUS is only as good as `assignee`. The planner sets it at every dispatch (`update_task`)
   and clears or reassigns it at reassignment. Without that, every seat truthfully prints `none assigned in the record`.
   A planner-side reminder belongs in `planner.md`. That is a role-doc change, which is Aaron's merge.
