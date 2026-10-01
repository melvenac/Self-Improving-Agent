# T-202 plan: the planner learns when a seat comes online (Forge; PLAN ONLY, no code; not yet approved)

Written at master e3bbc473 (record rev 219). Atlas asked for this plan; it could not be delivered (stale bridge), so it
lives here. Not read: T-076 (A2A-Hub's record). The Relay split below is a proposal against T-202's one-line account of it.

## Shape
1. New module `session-start/seat-online.ts`, called from `cli-bootstrap.ts` right after the tree-currency lines.
   Deterministic, no LLM. One fixed-format line:
   `SEAT-ONLINE seat=<s> role=<r> checkout=<basename> sha=<HEAD short> origin_sha=<short|unknown> rev=<local record rev> origin_rev=<rev at origin/master|unknown> runtime=<claude-code|cursor-cli|unknown> session=<uuid> at=<UTC>`.
   `origin_rev` lets the planner see a stale seat (the T-208 case) from the report alone.
2. Transport: ONE hub post per session start, to the seat's room with the planner, under the SEAT'S OWN key, 3 s bound
   (the bound `hub-presence.ts` uses). Seats run on other machines, so a per-seat file reaches nobody, and a hook
   cannot call SendMessage. One transport for every runtime, so no seat is reported twice.
3. The start output prints `seat-online: sent turn N` or `seat-online FAILED: <cause>` (no key file, hub unreachable,
   timeout, HTTP status). It never blocks /start beyond the bound. The key is never printed or logged.

## Dependencies
- **T-203 is the seat source**: seat, role and hub name/key come from its tracked checkout map, never `AGENT.local.md`
  (today builder, infra and forge all read 'Forge / developer'). An unmapped checkout reports `seat=unknown(checkout=<c>)`
  and posts nothing.
- **T-208 shares the hook**: it runs `git fetch --prune origin` first, then tree-currency. T-202 runs after both so
  sha/origin_sha/origin_rev are post-fetch. Both edit `cli-bootstrap.ts` around the tree-currency call. Order: T-203,
  T-208, T-202. Total hook bound = fetch bound + 3 s, stated in the rows.

## Split with Relay's T-076 waker (proposal)
SIA's hook owns "a seat STARTED" (seat, checkout, sha, rev, runtime). The waker owns "LISTENING / WOKEN" (the presence
endpoint T-198 already reads) and posts nothing about start. The planner joins the two. Questions for Relay: does the
waker post a turn on wake (it must be distinguishable: ours begins `SEAT-ONLINE `)? Does a Cursor CLI session run our
SessionStart hook at all (unverified here; `cursor-hook-compat` is SKIPPED on this PC)? If not, the waker must emit
this same line for Cursor seats. Question for Atlas: does the planner see an unprompted turn in a seat's room?

## Authority
Every seat start would post to a connected app under its own key. That needs Aaron's yes for that act, once, before code.

## Rows (red first; mutants on `loop/t202-mut-*`)
R1 one start, fixture hub: exactly ONE post with every field. R2 two invocations, one session uuid: ONE post.
R3 hub unreachable: `seat-online FAILED: <cause>`, exit 0, not blocked. R4 hung hub: bounded at 3 s, FAILED names the
timeout. R5 no key: FAILED names it, nothing posted, never another seat's key. R6 unmapped checkout: `seat=unknown(...)`,
no post. R7 builder/infra post as cursor-builder/cursor-infra, not forge. R8 runtime correct for Claude Code and Cursor
CLI, else `unknown`, never guessed. R9 a planted sentinel key appears in no stream or log. R10 same inputs, same line
(clock injected). R11 a failed T-208 fetch yields `unknown` plus the fetch time, never a stale value shown as current.
Mutants: posts under the identity name (loses R7); swallows errors (loses R3, R5); no dedupe (loses R2); prints the key (loses R9).
