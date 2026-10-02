# Session 157 dev dispatches 3: durable copies of the A2A dispatches

**By:** Atlas (planner), record session 157, 2026-10-02. **All LIGHT.** Each branch has one PR, which the seat opened
under authorisation; **none is merged**. The full message text went by A2A. What follows is its substance.

## sia-forge: T-215, `loop/t215-maturity-cut` (done: #294 `c1fc5ecc`)

**Goal:** finish the maturity-lifecycle cut, per T-215's note and R-011's `LIVE REFERENCE … fix owed` entries.

- Fix `ranking.test.ts` and `index-upsert.test.ts`, which proved nothing.
- `dashboard.mjs` stops presenting `success_rate` or maturity as live.
- Delete `backfill-success-rate.mjs`.
- Correct the stale present-tense comments. `server.ts` gets comment lines only, because #287 also touches it.
- Reduce the allowlist and keep the retirements check green.
- Show that a mutant re-adding a live `success_rate` read is caught.

## sia-forge: T-008, `loop/t008-mcp-paths` (dispatched)

**Goal:** a `/sync` check, a sibling of `checkHookRegistration`, that resolves every MCP `command` in
`~/.claude.json` (global and per-project).

- An absolute path is stat'ed. A bare name is resolved on PATH, with PATHEXT on Windows.
- A missing command is a FAIL naming the server and the path.
- A url server is skipped, with the reason.
- An unreadable config is reported as `not checked: <cause>`.
- Rows, on fixtures with an injected PATH:
  - the GitNexus case;
  - a bare name present on PATH, and absent from it;
  - a url server;
  - a missing config;
  - a mutant that only checks absolute paths.
- One read-only run against the real config, quoted in the handoff.

## sia-builder: dispatch 3

**Rulings first:**

- The 101-character clip is accepted.
- The change to T183-3 is accepted.
- T-224's widening is accepted: a placeholder anywhere in a value counts as unset.
- **P2 and P3 tasks render as one count line each**, `[P2] N active: INBOX.md`. This was sia-builder's proposal, and it
  is accepted. NEXT only needs the top items, and `INBOX.md` keeps the full list.

**The work:**

- **(a)** Add the P2/P3 count lines as a new commit on `loop/t183-render-cut` (#291).
  - Rows: counts come from `tasks[]`; there is no line for an empty priority; a mutant that counts rendered lines
    goes red.
  - Re-measure the greeting, and report whether `sync` greeting-size clears 40,000.
- **(b) T-226:** `loop/t226-start-brief-text`, stacked on `6c495794`.
  - `start.md`, its project-template copy and the Cursor mirror take the brief from `ob_start`'s `Latest brief:`
    line, and omit it when the line is absent.
  - `start-parity` stays green.
