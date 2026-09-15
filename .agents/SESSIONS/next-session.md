<!-- generated from .agents/state.json rev 7 by open-brain v0.31.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 57)_

Loop 6 is COMPLETE and accepted. Draft PR #7 is open (https://github.com/melvenac/Self-Improving-Agent/pull/7) at 1f68315 with CI green; merging is Aaron's and the branch prunes itself on merge. Do NOT re-do Loop 6 work. Loop 7 is Aaron's to start with a fresh brief — read ~/.agents/mailbox/channels/sia/ for it before assuming scope. The displaced Loop 7 subject is the usage signal: whether recalled knowledge changes what an agent does.

## Watch out

- START WITH G-014, not with new instrumentation. The usage signal is already half-built: success_rate excludes neutral (lifecycle.ts:70-73) and harmful is near-unreachable, so `neutral` IS the recall-without-application signal and it is already recorded on every rating. Entry 192 reads 10 helpful / 51 neutral / success_rate 1.00 / mature. Read the neutral counts before building anything new.
- The maturity questions stay unanswerable on historical data and no maturity constant should move on Loop 6's numbers. feedback_log holds 154 of 496 non-neutral ratings (G-013), so the replay under-promotes and no_maturity's tie with live is measured on an instrument biased toward exactly that result.
- A replay harness must parameterise EVERY present-tense input — corpus membership, mutable signal values, and the clock. Loop 6 found three in one subsystem. The clock hid longest because nothing about the string 'now' looks like state. Check for a fourth before trusting any new replay number.
- COALESCE is wrong for a nullable override: a snapshotted success_rate of NULL means 'unrated then' and ranks differently from every number, so substitution must test PRESENCE (CASE WHEN ov.id IS NOT NULL). This was the one instruction last loop that would have shipped a correctness defect rather than a doc error.
- Bare `npx vitest` from the repo root loads no config — open-brain/vitest.config.ts:8 carries setupFiles — so OPEN_BRAIN_VAULT_DIR stays unset and 36 tests fail on a vault guard. Use `npm test` from the repo root (package.json:7 delegates), or vitest from open-brain/.
- Fetch before reading any SHA off this working copy. Local master sat at 8aa2f2b (PR #5) while origin/master was 29e82b4 through most of session 57.
- Two loops have now shipped untagged at 0.31.0. Deliberate both times, but it compounds — G-012 should settle it before a third.

## Open questions

- Loop 7's actual scope is Aaron's to set. The candidates in priority order are G-014 (the usage signal, already instrumented), G-012 (project.version removal, 7 call sites — decided in ADR-027, unblocks tagging), T-003 (session identity per project not per session, scheduled here by the Planner), and G-013 (accept historical maturity is unanswerable, or instrument recall_log going forward).
- Should recencyDecayPerDay move, and to what? ADR-028 refused 0.02 on one-point evidence and recommends a sweep at 0.01 / 0.02 / 0.04. Aaron's call, and it needs the sweep run first.
- Should maturity ever be demoted? evaluateLifecycle advances and never walks back, so an entry promoted while its rate was high stays promoted after it collapses. Pinned as production behaviour in tests this loop, not endorsed.

## Last session

Session 57 — 2026-09-15 — `10613af5-f076-4e79-8c5e-75fb7789619c`
