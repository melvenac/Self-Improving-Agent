<!-- generated from .agents/state.json rev 20 by open-brain v0.36.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 61)_

Session 61 was an inspection plus a backlog sweep, not a loop. The rewritten /start was judged against Aaron's four criteria and passed on the re-run: payload 7,971 -> 2,142 words, no disk spill, no file read that the briefing should have supplied. The backlog went 44 -> 31 active across revisions 14 -> 18. THE COMMIT IS NOT MADE: state.json, the four rendered views and Session_61.md are modified and uncommitted, and Clark (Planner, home seat) is taking it to Aaron. Nothing was branched or pushed. Loop 11's subject is still Aaron's to rule.

## Watch out

- A substring check cannot distinguish an assertion from a citation of that assertion. Grepping G-010 for its retired clause returns true, because the amendment quotes the clause in order to retire it. Verify a rewrite by the field that changed, not by the absence of old words.
- A read ordered before another seat's write is indistinguishable from a read of current state. Clark read rev 16 correctly while the file was already 17. Within one seat you can order a read after a write; across two seats neither party controls the ordering.
- close_gap DELETES. state-writer.ts:292 is s.gaps.splice(idx, 1) — no closed_session, no tombstone, no retention, and no reopen_gap to undo it. Closing a gap destroys its evidence in the same motion; G-018's survives only at 6af5592.
- A bulk close evicts unrelated done tasks through retention and announces it as one summary line. Closing 13 tasks dropped T-032 and T-052 out of the record entirely. Read the dry run before the real call, every time.
- Reading a title is the documented way to read the new INBOX.md and is NOT enough to retire a task. That is T-148, and it is the cause of this session's one real error.
- git show <ref>:<path> is mangled by MSYS on Windows when the ref contains a slash; use MSYS_NO_PATHCONV=1. Verified again this session against 6af5592.
- A heredoc through the Bash tool failed to parse on this session's long markdown; the Write tool did the same job. Do not spend turns fighting the heredoc.

## Open questions

- Does the protocol half earn its keep? Still untested against Loop 10's criterion; nothing may claim it did.
- Should success_rate be dropped from live databases? It survives as an inert column — T-053 closed because nothing computes it, which is not the same as it being gone.
- Node v24: the v22 pin is released in this repo, but Smart Connections may break in Aaron's vault where no test here would catch it.
- Should gaps and the Verified section be reconciled by something? G-010 asserted two claims that V-017 and V-022 already contradicted in the same file, and nothing reads across the two.

## Last session

Session 61 — 2026-09-17 — `8ff4db2c-ab14-44fd-be58-864a09312fb8`
