# T-003: a server knows its OWN session. Brief for a FRESH developer session (record 137)

**By:** Atlas (planner), record session 109 · 2026-09-26. **To:** the Claude developer seat (Forge), record **137**, a
fresh session (D-035) in `~/Worktrees/sia-builder`. **Authority:** Aaron (session 109: "two devs still open…"), and T-179's
rulings (R179-2: "T-003 is scheduled next"). Merging is Aaron's (D-019).

## Why

- **T-003 (P0):** `active-session.json` is keyed on `<project_dir>::<ide>`. Two Claude sessions in one checkout share the
  slot, and a reconnected MCP server **adopts the other session's uuid**. It is proven live: feedback row **#348** sits
  under a foreign uuid (Session 53). "v0.21.0 fixed an absence by introducing a wrong value."
- **It is now load-bearing:** T-179 keys every record entry by the registered session. QA 125's **D2** (A7, A8, A9)
  are the paths by which the WRONG session registers. T-179 round 2 closed only the different-checkout case (R179-2).
  The same-checkout A7 (explicit registration as a victim's uuid), A8 (reconnect adoption from the slot) and A9 (the
  server surviving `/clear` with the old registration) are this task's.

## Base: STACKED on T-179 round 2

Branch `loop/t003` from `origin/loop/t179-r2` (`d0335d7`). T-179 round 2 changed `ob_set_session` and `writeSessionId`.
If round 2 gets a fix round after QA 134, merge it in (never rebase).

## Step 0: measure first (no product change)

**What can a server process know about its own session, deterministically, at spawn and after a reconnect?**
Candidates to MEASURE, not assume:
- environment variables Claude Code passes to MCP servers at spawn, and whether a reconnect (`/mcp reconnect`)
  re-spawns with the same values;
- the parent process's identity (PID and command line) and its transcript file;
- what the SessionStart hook knows (it receives `session_id`) and how it could hand that to the server without a
  shared per-project slot;
- **what `/clear` changes:** the new session id, and whether the server process survives (QA 125 could not observe A9
  headless; you can, interactively).

Record each candidate: available or not, the same across a reconnect or not, and correct after `/clear` or not.
**This measurement decides the design.** Report it to atlas BEFORE building, with your proposed design.

## The rule the fix must meet (the class, not one path)

**A server writes under a session id only when it can prove that id is its own.** It never adopts from a shared slot a
value another session could have written. When it cannot know, it **refuses** attributed writes, as T-179 already
refuses unregistered ones. It never guesses. Absence is detectable; a wrong value is not.

## Tests (red first, on `d0335d7`)

QA 125's A7, A8 and A9 as rows, in the same checkout. Plus:
- two sessions in one checkout each write, and each lands under its own uuid;
- a reconnect keeps the right uuid;
- `/clear` gives the new session a new uuid, and never the old one's.

A mutant per protection. `npx tsc --noEmit -p .` before every push. No full local suite. **Never write SIA's live
`state.json` or `~/.claude/open-brain/` stores:** scratch homes only.

## Also in scope

Row **#348**: say how to correct it (a one-off repair, listed for Aaron), without doing it.

## Hand back

`docs/loops/t003-developer-handoff.md`: Step 0's table, the design, the rows, the runs and mutants, and your effort from
your transcript. **Push it BEFORE messaging atlas.** No `/end`. Push only `loop/t003` and `loop/t003-*`.
