# QA 249: T-164 port + T-211 standing cron

**By:** Atlas (planner), 2026-10-02, record session 156. **Candidates:**

- T-164: `fbf94ae63dcd49c37b96a113e9c5a1f389077b0e` on `origin/loop/t164-port` (PR #270).
- T-211: `9f6fcea4abf42c1a98219aec639be5d6f10f63ed` on `origin/loop/t211-standing-cron` (PR #272). It is stacked on T-164.

**Base:** `bea385b2` (master). **Builder:** sia-builder, on Sonnet. **QA runs on Opus, on Plumb.** **Job class:
HEAVY**: one full suite and mutants, so Plumb only. **Make no live Jev call.**

**Read first:**

- `docs/loops/t164-t211-dispatch.md`: rows SR-1 to SR-6, and Part 1's live case.
- `docs/loops/t158-t164-dispatch.md` § Record 221: rows SC-1 to SC-5.
- The two handoffs: `docs/loops/t164-port-developer-handoff.md` and `docs/loops/t211-developer-handoff.md`.

## Rows

1. **Confined.**
   - `git diff bea385b2 fbf94ae6` touches only the session-numbering code (`server.ts`, `state-schema.ts`,
     `state-writer.ts` and the session-start pipeline), their tests and the handoff.
   - `git diff fbf94ae6 9f6fcea4` touches only `agent-identity.ts`, `server.ts` `handleStart`, `.claude/commands/start.md`
     and its template copy, `cursor-start-differences.json`, the template `AGENT.md`, the tests and the handoff.
   - Name every file outside those lists.
2. **The T-164 port is faithful.** Compare `38417eb3` and `567657af` with their cherry-picks. Any hunk that differs
   from the original must be explained by master's movement; list each hunk with its reason.
3. **SC-1 to SC-5,** on the T-164 candidate. **SC-2 gets your own test,** not the developer's: two fixture checkouts
   at the same revision each greet N. The first write registers N for uuid A. The second write tries N for uuid B
   and is refused, and the refusal names N+1.
4. **The live case:** a fixture with 16 local logs and the record's last session at 155 greets **156** and creates
   `Session_156.md`. Also re-run `ob_start` in the same session and confirm the greeting says `reused` and
   that no new log appears (SC-5).
5. **SR-1 to SR-6,** on the T-211 candidate. Write **one mutant of your own** for each of these, and report
   whether a row catches it:
   - (a) a local file that has only `status_to` no longer shadows `AGENT.md` (the "first file with ANY key wins"
     rule);
   - (b) a cron range check that accepts `60` in the minute field.
6. **The developer's mutants:** reproduce the SC-4 mutant and the two SR-5 mutants, and show each one goes red.
7. **Full suite once,** at `9f6fcea4`. Expect 0 failed tests. An unattributed vitest RPC error is environmental
   (D-083). Quote the counts.
8. **CI:** push `qa/t164-t211-ci-candidate` at `9f6fcea4`. Quote the run id, `headSha`, conclusion and the `test`
   job. Use 1 run.

## Rules (headless Claude Code; Plumb, Linux)

- You are **QA 249**, prefix `t164-t211`. Push ONLY `qa/t164-t211-*`, and only through
  `node docs/loops/qa-249/push-qa.mjs <branch>`, run from `~/qa-scratch/qa249-wt`.
- Never write a live `.agents/state.json`, the real knowledge DB, a settings file, or any seat's `AGENT.local.md`.
  Fixtures only.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read CI.
- Commit `docs/loops/t164-t211-qa-report.md` and its `.E_t.json` on `qa/t164-t211-report`. The last line is exactly
  `QA-249: REPORT COMPLETE`.
