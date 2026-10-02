# T-164 port developer handoff: the record session number (SC-1 to SC-5)

**By:** Builder (developer seat, `sia-builder`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t164-port` from `origin/master` `bea385b2`.
**Dispatch:** `docs/loops/t164-t211-dispatch.md` at `bea385b2`. The old design (`origin/loop/t164-record-session-number`, record 221) **fits the current code**: I ported it, did not redesign it. The old handoff is `docs/loops/t164-developer-handoff.md` (cherry-picked in).

## The port

`git cherry-pick -x 38417eb3` then `git cherry-pick -x 567657af` onto master. **Conflicts: none.** Git auto-merged `server.ts`, `state-schema.ts`, `state-writer.ts` and the tests; I did not have to resolve a hunk by hand. Because the dispatch said the session-start pipeline, `server.ts` and `state-writer.ts` had moved, I checked rather than assumed: `tsc --noEmit` is clean on the port, and every touched test file passes (below). Files the port touches in `open-brain/src`: `pipelines/session-start/{index,session-log,types}.ts`, `server.ts` (the `Session #` line only), `shared/state-schema.ts` (`nextFreeSessionNumber`), `shared/state-writer.ts` (the SC-2 guard in `applyStateOps`). Nothing in the greeting other than the session-number line changed.

I added only: the live-case test, the SC-4 mutant diff, and this handoff.

## Rows

| Row | Test | Result |
| --- | --- | --- |
| SC-1 | `record-session-number.test.ts` "local logs say 6 and the record says 76 → greeting is 77 and Session_77.md is created" | green |
| SC-2 | same file, the provisional-number and refusal rows | green |
| SC-3 | same file; `server.test.ts` ("local — from this checkout's session logs; no valid state.json") | green |
| SC-4 | the mutant, below | red |
| SC-5 | `server.test.ts` ("existing log for this session id — reused"), `session-log.test.ts` | green |
| live case (new) | a fixture copy with sixteen local logs (the local counter says 17, asserted as a precondition) and a record whose last session is 155 greets **156** and creates `Session_156.md` | green |

## Mutant (SC-4), reproduced

`docs/loops/t164-port/mutants/sc4-local-count-restored.diff`: `index.ts` uses `findNextSessionNumber` instead of `nextGreetingSessionNumber`. It passes `tsc --noEmit` (exit 0) and goes **red on SC-1 and on the live case**.

## Runs (local, touched files only; CI runs the suite)

`tsc --noEmit` 0. `record-session-number` (now 6 tests, with the live case), `session-log`, `state-writer`, `session-order`: 70 passed. `state-import`, `record-erasure`, `server`, `closeout-erasure`: 66 passed. Free RAM 1.46 GB at the first run.
