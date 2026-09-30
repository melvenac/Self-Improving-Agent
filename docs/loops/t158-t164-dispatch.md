# Records 220 and 221: `close_gap` tombstones (T-158) and the record session number (T-164)

**Planner session 149, 2026-09-28.** Both tasks are existing P0s. No new task was opened for this dispatch. Their
notes are in `.agents/state.json` at rev 156, on the planner's record branch, which reaches master with #201. This
file carries everything a seat needs.

## Common

- **Base:** `origin/master` `842375f` or later.
- **D-061:** local tests only, no CI.
- **Run the FULL suite locally before you post.** From `open-brain/`, run `npx vitest run`, and quote the
  `Test Files` and `Tests` lines with the exit code. Record 215 was rejected today for a full-suite regression that
  four named suites did not show.
- Mutants go on their own branches, and each is `tsc --noEmit` clean before it counts.
- Each handoff maps every row to its test, red then green.
- **PUSH HOLD while any QA queue runs.** Commit locally and post your local SHAs. The planner clears the push.
- No acknowledgement. Post when the work is done.

---

## Record 220, `cursor-infra` (Composer 2.5): T-158, `close_gap` must never let a gap id be reused

**The problem, verified by the planner at `842375f`.**
- `close_gap` splices the entry out of `gaps[]` (`state-writer.ts`, G-010), so `nextId` hands the next `add_gap` a
  CLOSED id.
- The record's `gaps[]` stops at **G-045**.
- But G-046 is cited in 14 tracked files, G-047 in 15 and **G-048 in 2**, all outside `state.json`. A naive next id
  would reuse all three.
- A reused gap id points at the wrong thing and announces nothing. That is strictly worse than a dangling task id.
- **Until this lands, no seat may call `add_gap` (R28).**

| Row | Observable |
| --- | --- |
| **TG-1** | `close_gap` keeps the entry as a **tombstone**, with its status, `closed_session` and closing rev, instead of splicing it out. The rendered views do not list a closed gap as open. |
| **TG-2** | `add_gap`'s next id skips every id that exists in the record (tombstones included) **and** every gap id cited anywhere in the tracked tree. On today's repo, a dry-run `add_gap` is assigned an id that is neither G-046, G-047 nor G-048, and the output **names the ids it skipped and why**. |
| **TG-3** | A test proves the citation scan both ways (G-040): a known-cited fixture id is skipped, and an uncited one is not. A scan that cannot find G-046 today is the failure this row exists to catch. |
| **TG-4** | A mutant that restores the splice, and another that drops the citation scan, each go red on their row. |
| **TG-5** | **Preserved:** done-task retention (T-157), `close_task`, the rendered views and the live record's `state-schema` check are all unchanged in behaviour. If `gaps[]` gains a field, say whether the schema version changes and how an existing rev-156 record reads. |

Branch `loop/t158-gap-tombstone`. Handoff `docs/loops/t158-developer-handoff.md`. **When this is accepted and merged,
the planner lifts R28.**

---

## Record 221, `cursor-builder` (Grok 4.7): T-164, the session number comes from the record, not the checkout

**First, before this: post your T-194 report** (record 214) in your room, **with a full-suite run.** Your hook runs
`gh pr view` as a child process, and the spawn-site guard (`tests/harness/spawn-sites.test.ts`, CA-4b/R16) polices
exactly that. Then start this.

**The problem.**
- `ob_start` numbers the session from the `Session_*.md` logs in the current checkout, and those are gitignored.
- This session, the planner's greeting said **#12** while the record's last session was **#148**.
- A seat that uses its greeting's number writes a colliding session number into the shared record.

| Row | Observable |
| --- | --- |
| **SC-1** | With `state.json` present, the greeting's session number is the record's last `sessions[].n` + 1, and the log file is named to match. Show this on a fixture where the local logs say 6 and the record says 76: the greeting is 77. |
| **SC-2** | Two checkouts at the same rev would both greet the same next number. The number is **provisional until the session's first write**. A write that registers a session `n` already held by a **different** uuid is refused, and the refusal names the next free `n`. |
| **SC-3** | With `state.json` absent, the greeting falls back to the local count and **says** the number is local. |
| **SC-4** | A mutant that restores the local count goes red on SC-1. |
| **SC-5** | **Preserved:** a second `ob_start` call in the same session reuses its log ("existing log for this session id — reused"), and every other greeting section is unchanged. |

Branch `loop/t164-record-session-number`. Handoff `docs/loops/t164-developer-handoff.md`.

**Overlap note:** Forge's T-198 (`loop/t198-presence`) also touches `ob_start`. Keep your change inside the
session-numbering code, and say in the handoff which files you touched.
