<!-- generated from .agents/state.json rev 8 by open-brain v0.31.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 57)_

FIRST ACTION, two minutes, before Loop 7 scope: amend G-014's evidence with the corpus-wide numbers and give `update_gap` its first live exercise. Session 57 tried and was refused because the MCP server predated the build that added the op — this session's server is new, so it will work. Verify by reading the gap back, not by trusting the success message. The numbers, measured independently by Planner and Forge and agreeing exactly: success_rate is 1.00 for 148 of 151 rated entries (98%); exactly 3 entries in the whole store carry any harmful rating, one created 2026-09-15; corpus totals 495 helpful / 904 neutral / 3 harmful, so neutral is 64.5% of every rating ever given and the score discards all of it; average recall_count by tier is progenitor 2.5 (n=515), proven 8.9 (n=25), mature 38.5 (n=14) — a fifteen-fold gradient showing the entrenchment loop in data rather than by argument.

THEN: Loop 6 is COMPLETE and accepted. Draft PR #7 (https://github.com/melvenac/Self-Improving-Agent/pull/7) is green at 6733201; merging is Aaron's and the branch prunes itself on merge. Do NOT re-do Loop 6 work. Loop 7 is Aaron's to start — read ~/.agents/mailbox/channels/sia/ for the brief before assuming scope. The displaced subject is the usage signal: whether recalled knowledge changes what an agent does.

## Watch out

- START WITH G-014, not with new instrumentation. The usage signal is already half-built: success_rate excludes neutral (lifecycle.ts:70-73) and harmful is near-unreachable, so `neutral` IS the recall-without-application signal, it is recorded on every rating today, and it is 64.5% of the record. Read the neutral counts before commissioning anything new. STANDING WARNING, Planner-endorsed: do NOT 'fix' this by rating unused entries harmful — not being used is neutral, and collapsing that distinction destroys the only existing signal and re-breaks the harmful rating just after it became reachable.
- TWO independent reasons the Loop 6 maturity tie must not be read as 'the boosts are harmless', and both belong in Loop 7's framing: G-013 says the instrument cannot answer because feedback_log is 31% complete; G-014 says the signal it would measure is degenerate anyway. No maturity constant should move on Loop 6's numbers.
- A rebuilt MCP server does not take effect until reconnect or a fresh session. Session 57 shipped `update_gap`, then could not use it — the running server's schema rejected the op and refused the batch atomically. It refused loudly, which is the good case; the memory warns a stale server can instead report success while silently stripping a new parameter. Verify any newly-added op or parameter by reading the row back.
- A replay harness must parameterise EVERY present-tense input — corpus membership, mutable signal values, and the clock. Loop 6 found three in one subsystem. The clock hid longest because nothing about the string 'now' looks like state. Check for a fourth before trusting any new replay number.
- COALESCE is wrong for a nullable override: a snapshotted success_rate of NULL means 'unrated then' and ranks differently from every number, so substitution must test PRESENCE (CASE WHEN ov.id IS NOT NULL). This was the one brief instruction last loop that would have shipped a correctness defect rather than a doc error.
- Bare `npx vitest` from the repo root loads no config — open-brain/vitest.config.ts:8 carries setupFiles — so OPEN_BRAIN_VAULT_DIR stays unset and 36 tests fail on a vault guard. Use `npm test` from the repo root (package.json:7 delegates), or vitest from open-brain/.
- Fetch before reading any SHA off this working copy. Local master sat at 8aa2f2b (PR #5) while origin/master was 29e82b4 through most of session 57.
- Two loops have now shipped untagged at 0.31.0. Deliberate both times, but it compounds — G-012 should settle it before a third.

## Open questions

- Loop 7's actual scope is Aaron's to set. Candidates in priority order: G-014 (the usage signal, already instrumented), G-012 (project.version removal, 7 call sites — decided in ADR-027, unblocks tagging), T-003 (session identity per project not per session, scheduled by the Planner), G-013 (accept historical maturity is unanswerable, or instrument recall_log going forward).
- Should recencyDecayPerDay move, and to what? ADR-028 refused 0.02 on one-point evidence and recommends a sweep at 0.01 / 0.02 / 0.04. Aaron's call, and it needs the sweep run first.
- Should maturity ever be demoted? evaluateLifecycle advances and never walks back, so an entry promoted while its rate was high stays promoted after it collapses. Pinned as production behaviour in tests this loop, not endorsed.

## Last session

Session 57 — 2026-09-15 — `10613af5-f076-4e79-8c5e-75fb7789619c`
