# Record 219, `cursor-infra` (Composer 2.5): T-196 then T-197. Cursor seats learn the hub and run the real `/start`

**Planner session 149, 2026-09-28.** Record rev 152: the notes of T-196 and T-197, on `docs/session-100-qa99-dispatch`,
reaching master with #201. **Do T-196 first, then T-197.** Both edit Cursor's `start.md`, so one seat does both, in
that order.

## Authority

Aaron's "yes", twice, relayed to the planner by the general session `worktrees-d5` on 2026-09-28. The chain has two
links: Aaron → `worktrees-d5` → Atlas. **It covers building and dispatching these two tasks. It does not cover any
merge.**

## Why

- **The hub procedure exists nowhere a new seat reads.** `shared.md`, `planner.md`, the seat `AGENTS.md` files and the
  Cursor `/start` have **zero** matches for `hub-talk`, `--wait` or `room`. That is at origin/master `c933a44`.
- **This session it cost about an hour.** Builder and Forge sat on their dispatches (hub turns 57 and 217). Forge's
  Cursor `/start` asked Aaron for work instead, and proposed `T-003`, the top backlog item.
- **The Cursor `/start` contradicts the tracked rules.** It is `project-template/.cursor/commands/start.md` on master,
  byte-identical, ignoring CR, to the installed `~/.cursor/commands/start.md`:
  - it reads the four rendered prose files instead of `ob_start`'s State block;
  - **step A5 tells the seat to hand-edit rendered views;**
  - step A6 creates its own session log;
  - step A3 calls `ob_recall` with trigger `start` while start injection is suspended (Loop 10 C2);
  - step A7 "Proposed: {top open INBOX item}" presents the backlog as a decision.

  This is G-001 and G-009, both open since session 54.

## T-196: the hub procedure becomes tracked knowledge

**Reuse, do not rewrite.** A2A-Hub already tracks a hub-transport section (`a2a-planner` `.agents/roles/shared.md`
lines 147-166) and a root `AGENTS.md` for Cursor seats. Point at them, or adapt them.

**Scope:**
1. **A tracked seat hub-data file,** beside or inside `.agents/SYSTEM/worktree-seats.json`. For each seat it holds the
   hub name, the room id, and the `hub-talk` invocation. `/sync` validates it.
   - The current values: builder `cursor-builder` `k57098epn7qz32vt0cazfjpbes8f6kdq`; Forge `grok`
     `k57frxw0ptb8tadmqdwy0khhks8ey006`; infra `cursor-infra` `k5702788wctxj75begyt4x2k5x8f6mav`; the planner is
     `atlas`.
   - Verify each value against the hub's own records. Do not copy these lines.
2. **A short "Talking to Cursor seats" section in `planner.md`.** It says the hub carries same-machine Cursor seats,
   because native A2A is Claude-to-Claude only, and points at the data file. `ob_start` already prints `planner.md` in
   full. **A role-file change is its own PR to Aaron (D-062).** Keep it separate from the rest.
3. **A tracked `.cursor/rules` hub rule (`alwaysApply`).** It tells the seat: your room, from the data file; run
   `--wait` on open and after every post; act on the next atlas turn.
4. **Cursor's `/start` joins the seat's room** and reads unread atlas turns **before** its greeting proposes anything.
   An unread atlas turn is reported as the seat's assignment.

| Row | Observable |
| --- | --- |
| **HB-1** | A fresh planner session arms one listener per seat room from what `/start` printed, with no memory read. |
| **HB-2** | A fresh Cursor chat in each seat runs `--wait` after its first post, with no nudge from Aaron. This is live, once per seat, and the planner observes it. |
| **HB-3** | A fresh Cursor `/start` in `sia-forge` with an unread atlas turn names that turn as its assignment and proposes nothing else. This is live. |
| **HB-4** | `/sync` fails when the data file names a seat that `worktree-seats.json` does not, or lacks a room for a Cursor seat. Show it red, then green, with a mutant. |

## T-197: Cursor's `/start` matches Claude Code's `/start`

| Row | Observable |
| --- | --- |
| **CS-1** | The Cursor `/start` steps equal Claude Code's `/start` steps (`.claude/commands/start.md`). Every difference is listed in one tracked table, for example `CallDynamicTool` for MCP calls. |
| **CS-2** | `/sync` fails on any difference not in that table. Show it red against master's template. The current `checkMirrorParity` compares `~/.cursor/commands` only to the template, never to Claude Code's `/start`. |
| **CS-3** | No step tells the seat to hand-edit `INBOX.md`, `task.md`, `next-session.md`, `SUMMARY.md`'s marked region, or `state.json`. |
| **CS-4** | A live Cursor `/start` in a developer seat prints NEXT as a ranked backlog, not "Proposed:". |

**To verify, not asserted:** Forge's Cursor SessionStart wrote no by-pid session proof, so its recalls are unlinked.
Establish whether that is T-046's fail-closed PreToolUse or a defect of its own, and report which.

## Common

- **Base:** `origin/master` `a749821` or later.
- **D-061:** local tests only, no CI. Quote failing lines and exit codes.
- **Branches:**
  - `loop/t196-hub-knowledge` for the data file, the rule, `/start` and the check;
  - `loop/t196-planner-md` for the role-file change alone;
  - `loop/t197-cursor-start-parity` for T-197.
- **Handoffs:** `docs/loops/t196-developer-handoff.md` and `docs/loops/t197-developer-handoff.md`. Each row is mapped
  to its test, red then green.
- **Commit locally and post your local SHAs** in your room. QA runs may be active, and the planner clears pushes.
- **No acknowledgement.** Do the work in the turn, and post only when it is done.
