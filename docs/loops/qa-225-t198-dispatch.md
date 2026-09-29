# QA 225: record 217 (T-198, `/start` shows whether each seat is listening)

**Read `docs/loops/qa-222-225-common.md` first.** Prefix `t198`. Report `docs/loops/t198-qa-report.md` on `qa/t198-report`.

## The candidate

- **Code at the tip, `231f501f99b217fd65ab496139cb0d11feba8eb1`,** on `origin/loop/t198-presence`. Its last commit changes `hub-presence.ts`, so the tip is the code. The base is `a749821`.
- Built by Grok (Forge).
- **The brief:** `docs/loops/t198-presence-dispatch.md`, with rows PR-1 to PR-6.
- **The mutant:** `-mut-swallow` `bbf4b78`.

## Specifically

1. **No live hub in tests.** Fixture HTTP server only. You may make ONE read-only live call, `GET http://100.124.212.87:4000/a2a/agents/presence` (header `X-Agent-Key: dev-key`), to show the fixture's shape matches the real one. Quote the field names, never the values.
2. **The listener-versus-seat case (planner note, 2026-09-28).**
   - In A2A-Hub's Loop 8b spike, a background `hub-listen.sh` marked a turn read, and presence showed "polling, unread=0" while the agent itself had never seen the turn.
   - So "polling" means a LISTENER process is polling, not that the seat read anything.
   - **Say whether the candidate's printed line could lead a planner to read "polling, 0 unread" as "the seat has seen my turn".** If it could, score it as a defect against PR-1/PR-2 wording.
3. **PR-3.**
   - A timeout, a non-2xx response and a malformed body each print one visible `UNKNOWN` line with its cause.
   - The timeout is bounded. Measure how long `/start` waits against an unreachable host.
4. **PR-6.** Report the greeting-size number with the block and without it.
5. **The seat-file collision with record 219** (see QA 224, item 4). Say whether this parser still reads the extended file at `origin/loop/t196-hub-knowledge` (blob `344bd46`).
