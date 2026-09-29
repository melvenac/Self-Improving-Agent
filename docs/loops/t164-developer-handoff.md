# T-164 developer handoff: session number from the record

**By:** Forge (developer), record **221**, 2026-09-28.
**Branch:** `loop/t164-record-session-number` (from `origin/master` `838b1bd`).
**Brief:** `docs/loops/t158-t164-dispatch.md` §Record 221.
**D-061:** local tests only; no CI dispatched.
**Overlap:** T-198 (`loop/t198-presence`) also touches `ob_start`; this change is confined to session-numbering (`session-log.ts`, `session-start/index.ts`, `state-writer.ts` SC-2 guard, `server.ts` local note).

## What shipped

- `open-brain/src/pipelines/session-start/session-log.ts` — `nextGreetingSessionNumber()` reads `max(sessions[].n)+1` when `state.json` is present and valid; else local `findNextSessionNumber`.
- `open-brain/src/pipelines/session-start/index.ts` — uses record number for new logs; sets `sessionNumberSource`.
- `open-brain/src/pipelines/session-start/types.ts` — `SessionNumberSource` on `SessionInfo`.
- `open-brain/src/server.ts` — greeting notes when number is local (no valid `state.json`).
- `open-brain/src/shared/state-schema.ts` — `nextFreeSessionNumber()` for SC-2 refusal text.
- `open-brain/src/shared/state-writer.ts` — SC-2: refuse write when session `n` is held by a different uuid.
- `open-brain/tests/pipelines/session-start/record-session-number.test.ts` — SC-1..SC-3, SC-5.

## Row map

| Row | Test(s) | Red | Green |
| --- | --- | --- | --- |
| **SC-1** | `SC-1 — greeting number from the record` | `mut-sc4` — **1 failed**, 4 passed (uses local count with valid state) | **5 passed** |
| **SC-2** | `SC-2 — provisional number` (2) | product green; collision guard covered | **5 passed** |
| **SC-3** | `SC-3 — local fallback` | product green | **5 passed** |
| **SC-4** | same as SC-1 | `loop/t164-record-session-number-mut-sc4` | product green |
| **SC-5** | `SC-5 — second ob_start reuses` | product green | **5 passed** |

## Mutant (local only, not for merge)

| Branch | Defect | SHA |
| --- | --- | --- |
| `loop/t164-record-session-number-mut-sc4` | `index.ts` uses `findNextSessionNumber` instead of `nextGreetingSessionNumber` | 956755d |
