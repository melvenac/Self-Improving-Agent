# Record 217, Forge (Grok 4.7, `sia-forge`): T-198, `/start` shows whether each seat is listening

**Planner session 149, 2026-09-28.** Record rev 151 (T-198's note, on `docs/session-100-qa99-dispatch`, reaching
master with #201).

## Authority

Aaron's words: "yes and move the hub's Loop 8b ahead of Funnel". They were relayed to the planner by the general
session `worktrees-d5` on 2026-09-28, so the chain has two links: Aaron → `worktrees-d5` → Atlas. **This covers
building and dispatching T-198. It does not cover any merge.**

## Problem

Tracked text does not make a planner check its seats.
- A2A-Hub's tracked `shared.md` already says "check presence before assuming a seat sees a turn", and its planner's
  `/start` still never checked.
- In SIA this session, builder and Forge sat on turns 57 and 217 for about an hour. The planner learned it only
  from a listener's "unread by" line.

## The instrument, verified live by the planner on 2026-09-28

`GET http://100.124.212.87:4000/a2a/agents/presence` (hub v1.13.0, hub T-077) returns **200** with:
- `agents[]`: `name`, `state` (e.g. `not_live`), `lastSeen`, `lastSeenAgeMs`, `polling`;
- `rooms[]` inside each agent: `sessionId`, `unread`, `pollingNow`, `pollAgeMs`.

**It ignores an `?agents=` filter.** `?agents=grok,cursor-builder,cursor-infra` returned the whole roster, so the
client filters by name. The literal `dev-key` passes under the hub's `AUTH_MODE=warn`.

## Goal

At `/start` (`ob_start`), print one line per partner seat: `<seat>: polling | not polling, N unread since <time>`.

**Where the seat names and rooms come from:** T-196's tracked data file. T-196 is not built yet, so read a named
interim source until it lands, and say in the output which source was read. **Replacing the interim source is
T-196's step, not yours.**

**It must never fail silently.**
- A timeout, a non-2xx response or an unparseable body prints `presence: UNKNOWN (<cause>)`.
- The timeout is bounded, so `/start` never hangs.
- Say which process makes the call. G-033 applies: a check served through the MCP server cannot report that
  server's own staleness.

## Acceptance

Every row is red against master or a mutant, and then green. Use a fixture HTTP server only; tests make no call to
the live hub.

| Row | Observable |
| --- | --- |
| **PR-1** | A seat with `pollingNow: true` in its room prints as polling. |
| **PR-2** | A seat not polling, with unread turns, prints the count and the age. |
| **PR-3** | Hub unreachable, non-2xx or malformed: one visible `UNKNOWN` line, with its cause. **Never nothing.** |
| **PR-4** | A partner seat absent from the presence roster prints as absent, not skipped. |
| **PR-5** | A mutant that swallows the fetch error goes red on PR-3. The mutant is on its own branch and `tsc --noEmit` clean. |
| **PR-6** | Preserved: every existing `ob_start` section, and the tests that cover them, are unchanged. The one new block is **measured against greeting-size**, which was already over its limit (T-183), and the number is reported. |

## Common

- **Base:** `origin/master` `315b245`.
- **D-061:** local tests only, no CI. Quote failing lines and exit codes.
- **Branch** `loop/t198-presence`.
- **Handoff** `docs/loops/t198-developer-handoff.md`: each row mapped to its test, red then green.
- **Commit locally and post your local SHA.** QA 216 and QA 213 may be running by then, and the old driver charges
  another seat's mid-run push to the QA seat. The planner clears the push. Read it back with `ls-remote` and post
  the tips.
- **If QA 213 rejects candidate C r3, C r4 comes first.** Park this if the planner says so.
