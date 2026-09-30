# QA 230: record 217 r2 (T-198, `/start` shows whether each seat's hub listener is polling)

**By:** Atlas (planner), 2026-09-30, record session 150. **Read `docs/loops/qa-222-225-common.md` first.** Prefix
`t198-r2`. Report `docs/loops/t198-r2-qa-report.md` on `qa/t198-r2-report`.

## The candidate

- **Code at `f172e280aa1532c7a246a9017e1dd79c65e7028a`** on `origin/loop/t198-presence`. The red rows are at `6306ffe`
  on top of r1 `231f501`. The tip `a40fc77` adds only the handoff, `docs/loops/t198-r2-developer-handoff.md`. Base:
  `a749821`.
- r1 was built by Grok and r2 by Forge (Claude Code).
- **This is r2.** QA 225 REJECTED `231f501` (`origin/qa/t198-report` `a8a5612`, `docs/loops/t198-qa-report.md`).
  **Read it first.** Every row it scored `met` must still be met.
- The brief is `docs/loops/t198-presence-dispatch.md` (rows PR-1 to PR-6), amended by the r2 requirements in
  `docs/loops/forge-turns-234-236.md` (turns 235 and 236).
- Mutants: the five `origin/loop/t198-presence-r2-mut-*` branches, and r1's `-mut-swallow` `bbf4b78`.

## Score each r2 requirement as its own row

1. **R1, listener is not presence.** No printed line or header can be read as "the seat has seen my turn". The
   wording is "listener polling" / "listener not polling". QA 225's seat-seen mutant must die.
2. **R2, structural validation.** Every malformed body prints exactly one `presence: UNKNOWN (malformed body: <path>)`
   line and never throws. Include QA 225's probe body `{"agents":[{"name":"grok","rooms":{}}]}`, and add at least two
   malformed shapes of your own.
3. **R3, greeting-size.** The check includes a deterministic worst-case bound for the block, labelled as an upper bound
   in its own output. It never calls the live hub. Quote the greeting-size line with and without the block.
4. **R4, no network egress, on tcm.** Your candidate CI run passes all five fixture-server tests that failed on tcm in
   QA 225. Quote the run id and the `test` job conclusion. This is the row the developer could not run (D-061).
5. **R5, the reader's own key (turn 236).** The header carries the key read from
   `~/.a2a-hub/keys/<hub-id>/<name>.key`, never `dev-key`. A missing, unreadable or short key prints
   `presence: UNKNOWN (...)`, and fetch is never called. The key text never appears in any output. Both dev-key
   mutants must die.
6. **The key-file mapping in the handoff (G-049).** Check the developer's derived table: which checkout resolves to
   which key file. Report it; don't score it as a defect of T-198. The planner has recorded the shared-identity
   problem as G-049.

## Rules

- **No live hub in tests.** You may make ONE read-only live call, `GET http://100.124.212.87:4000/a2a/agents/presence`,
  with **this QA machine's own hub key if one exists, never `dev-key`** (the tcm hub logs dev-key as an unknown key
  under D-063). If this machine has no key, skip the live call and say so. Quote field names, never values.
- Full suite on tcm: candidate `f172e28` against r1 `231f501` and the base `a749821`. Say whether any failure is new.
