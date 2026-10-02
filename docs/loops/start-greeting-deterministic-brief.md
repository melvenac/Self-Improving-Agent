# Loop brief — a deterministic /start greeting (T-233, D-112)

**Planner:** Atlas, session 158, 2026-10-02 · **Ordered by:** Aaron, relayed by clark ~21:3xZ:
"Have atlas prioritise the fix" · **Priority:** P0, the FIRST loop after the weekly usage reset,
ahead of D-110's queue · **Dispatch:** NOW. Aaron lifted the weekly-95% hold for this loop
(~21:4xZ via clark: "have atlas start it, once session and weekly limits hit I will use the one
time reset to keep going"). The 5-hour STOP (>=90%) still parks work until its reset. Seat:
sia-builder, after its roll; sia-forge is offline. · **Merge:** batch QA, then Aaron's word
naming the PRs.

## The problem

Clark's audit of the session-158 planner start (`~/Worktrees/hoh-startup-audit.md`) found six
faults in the greeting. Three of them were already in the audit of session 156. The patch then
was a watch-out in the handoff. That watch-out was dropped at rev 287, so the faults came back.
**A fix that lives in prose has to be carried by hand at every roll. This loop moves the fixes
into code.**

## What the planner found before writing this (read it before designing)

**Most of the six are already fixed on master, and the session never ran those fixes.** Two
stale copies sit between master and a session. Both were measured at 2026-10-02 ~21:40Z:

1. **The serving main tree is 597 commits behind origin/master.** `~/Projects/Self-Improving-Agent`
   is detached at `bf33fe47` (2026-09-27, the merge of #191), with its build from Sep 27. Every
   session's MCP server and hooks run from it. So T-164 (the record's session number), T-208
   (fetch at start), T-210 (`Latest brief:` line) and T-211 (`Standing cron:` line) are on master
   but are not served. This session's greeting said "Session #19" and printed no `Latest brief:`
   line, for that reason.
2. **The /start text this session ran was a stale copy.** The skill text it got says "by the
   largest loop number" and has no "Standing cron" step. That matches `~/.claude/commands/start.md`
   (2026-09-17), which is byte-identical to the main tree's stale copy. The worktree's
   `.claude/commands/start.md` equals master's (T-226 and T-211 are in it) but was not the one
   used. The developer must establish which copy Claude Code resolves for `/start` in a worktree
   (user-level vs project) before designing around it.
3. **The hook's staleness message points the reader the wrong way.** This session's SessionStart
   printed: `STALE: build-freshness — build was made from a010557 but HEAD is d8e6755 … The hooks
   and MCP server run from the MAIN checkout's build and are unaffected by this one.` The MAIN
   checkout was the stale one, 597 commits behind. That is G-034's shape: "matches this checkout"
   was read as "current".

**So item 2 below (T-172) comes first. It is the precondition for every other item: a renderer
fix that never reaches the serving build changes nothing.**

## Scope (clark's seven items, mapped to the record)

| # | Item | Status on master | Work |
|---|---|---|---|
| 1 | `ob_start` renders the WHOLE briefing block in code; `/start` prints it verbatim, with no model assembly | partial (State block is rendered; the briefing is assembled by the model from skill text) | new: a `## Briefing` block in the shared renderer, in the skill's format; `start.md` reduces to "print it verbatim" |
| 2 | Session number = the record's last + 1; build-staleness guard: the serving MCP compares its build commit with origin/master (not just its own checkout's HEAD) and rebuilds or refuses | T-164 done (not served); **T-172 open** | T-172. The greeting prints the serving build's distance from origin/master. One refusing command updates, rebuilds and verifies it (main checkout: `npm install`, never `npm ci`) |
| 3 | Latest brief = newest `docs/loops/*brief*` by git commit date; remove "largest loop number" from the skill | T-210 + T-226 done (not served / stale copy) | resolve the stale-copy route (finding 2) so master's `start.md` is what runs; tighten the glob to `*brief*` (today a developer handoff can win) |
| 4 | A usage line from `C:\Users\melve\slots.json` `usageLevel` at the top of the briefing (`Usage: RED + WEEKLY95 → dispatches held`) | new | read with a path from seat data (not hard-coded); a missing or unreadable file prints `Usage: not checked (<why>)`, never nothing |
| 5 | The SessionStart hook runs `git fetch` with a timeout before ob_start | T-208 done (not served) | verify it once served; fast-forward is NOT in scope (a seat tree may hold work) |
| 6 | Open questions carry `resolvedBy`; resolved ones are not printed | new | schema field on handoff open questions; the renderer omits resolved ones and says how many it omitted |
| 7 | Drop the hourly status-to-clark cron: clark reads the dashboard (planner rows); planners message only on events | T-211 done (cron from seat data) | remove `status_cron` from the planner's seat data, add the planner rows to the dashboard if absent, and amend D-077 in the record. **Removing the cron needs Aaron's own word to change D-077; this brief does not supply it.** |

It must work for **Relay's /start** too: one shared renderer, no per-runtime copy (T-197's rule).

## Acceptance

- A planner /start in `sia-planner` on a fresh tree prints the greeting with **no model assembly**.
  The briefing block is byte-identical to `ob_start`'s output (a test diffs them).
- The session number equals `sessions[].max + 1`, from a test against a fixture record with a
  local log count that differs.
- With the serving build behind origin/master, the greeting's first line says so and names the
  distance; the refusing command updates and rebuilds, then re-reads the build SHA (not its own
  exit code).
- `Latest brief:` names the newest `*brief*` file by commit date, from a fixture where a newer
  `*-developer-handoff.md` exists.
- The `Usage:` line appears for a valid slots.json, and `not checked (<why>)` appears for an absent
  file and for malformed JSON (D-104/D-106).
- A resolved open question is not printed; the count of omitted ones is.
- The same renderer output appears in Relay's /start (by test, not by inspection).
- Once shipped AND served, the `/START AUDIT GAPS` watch-out is retired from the planner handoff
  (planner act, on evidence of a served greeting that passes items 1-6).

## Sequencing and QA

T-172 first, then 1 + 3 (renderer and skill), then 4 and 6, then 7 on Aaron's word. One QA batch
by area (the greeting). Read-only for real config: copy no values (G-051). Merge on Aaron's word
naming each PR, pinned with `--match-head-commit`.

## Amendment 1 — rev 297, session 158 (~22:05Z)

- **T-172 step 1 is done on the DESKTOP only (D-113).** Clark updated `~/Projects/Self-Improving-Agent`
  to `ba1edf70` and refreshed `~/.claude/commands/start.md` from master, on Aaron's word. The planner
  read it back: 0 behind, clean, and the build contains `describeLatestBrief`.
- **The QA PC is still stale.** Read by the planner over SSH: its serving tree
  `C:/Users/AARONM~1/Projects/Self-Improving-Agent` is at `9c603615`, **429 behind**. sia-builder is 86
  behind, sia-forge 14. The developer's first act is to ask (through the planner) for the QA PC's
  serving tree to be updated. Until then, do NOT trust a greeting produced there.
  **The loop's deploy step updates EVERY machine's serving tree** (desktop, QA PC, laptop) and reads
  each one back (HEAD + build SHA).
- **Item 7 is ruled (D-113):** the hourly cadence is dropped. What remains for the code is removing
  `status_cron` from the planner's seat data, and the dashboard planner rows if they are absent.
- **Rescope before building:** the planner checks a SERVED desktop greeting after `/mcp` reconnect and
  narrows items 1-6 to what is still missing. Expected to remain: 1 (the whole briefing rendered in
  code), 4 (Usage line), 6 (`resolvedBy`), 3's `*brief*` glob, and T-172's guard so a serving tree
  cannot drift 599 commits again unnoticed.
