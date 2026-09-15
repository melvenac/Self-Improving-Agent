<!-- generated from .agents/state.json rev 12 by open-brain v0.32.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 58)_

FIRST ACTION, five minutes: verify the R2 fix at n=1 (T-090). Session 58's end was the first time the SessionEnd hook ever ran with a real session uuid. Query the store for uuid 4a395fd1-3504-4c5b-95df-515bd2ba90e0: `SELECT ended_at FROM sessions WHERE uuid=...` is the sharp test — ended_at is set on 1 of 56 rows all-time and its only writer is chunk-indexer.ts:86 inside that pipeline, so a non-NULL value means the hook completed for the first time. Then confirm feedback_log for that uuid holds 13 rows with rating_method='direct' and ZERO with 'heuristic'. A heuristic row means the gate failed. Do not rate anything from that run - Loop 7's population was fixed before the change.

THEN: Loop 7 is COMPLETE. Draft PR #8 (https://github.com/melvenac/Self-Improving-Agent/pull/8) at c3ec2c3, CI green, base master, untagged at 0.31.0. Merging is Aaron's - do NOT re-do Loop 7 work. The live decision is T-145: Aaron rules on C2's three-way split (keep session-start retrieval, suspend the maturity lifecycle, leave the causal question unasked). T-146 is the recency sweep and T-147 the skill-proposal triage, both unblocked by C2, neither started. Deliverables are in the vault, not the repo, because /docs/ is gitignored: Research/loop-7-c1-reconciliation-2026-09-15.md and Research/loop-7-c2-injection-decision-2026-09-15.md, beside the two pre-registrations they reconcile. If C2 is adopted the first move is a LIFECYCLE_CONFIG change (matureBoost/provenBoost -> 1.0, apoptosis gate off, counters still recording) - reversible, and it makes T-004's remaining parts unnecessary rather than unblocked.

## Watch out

- VERIFY A REPAIR AT n=1 AND PUT THE CHECK IN THE RECORD, not in conversation. The rating-method prereg's §7 already said 'verify the pipe at n=1' - and session 58's own C1 found that had it been applied PER-ARM rather than per-column, the dead heuristic arm would have surfaced on 2026-09-01 instead of two weeks later. Session 58 then shipped the fix for that exact bug and left its n=1 verification in chat rather than in the handoff, until Aaron asked. A verification step that lives only in a conversation does not exist. This is why T-090 is now the first action.
- The heuristic rating arm is FIXED BUT GATED OFF (enableHeuristicRatings defaults false, decision D-005). Do not flip it as a tidy-up. It emits `helpful` on a tag substring appearing in the session summary - mentioned, not worked - into success_rate, whose per-entry mean 0.311 sits one hundredth above the apoptosis threshold 0.3. It stays off until C2 is ruled on, and if C2 is adopted there is nothing left for it to feed.
- STANDING, unchanged: do NOT 'fix' the neutral signal by rating unused entries harmful. Not being used is neutral. And do NOT fix the success_rate denominator on its own - adding neutral moves the corpus's central tendency onto the pruning threshold and makes roughly half the rated corpus prune-eligible overnight. Denominator and threshold are one change or neither; if apoptosis is suspended, they are neither.
- Every rating in the corpus came from an agent deliberately calling ob_feedback. The unattended sweep has produced NONE, ever. Any historical reasoning that assumed a two-arm corpus was reasoning about one arm - re-check anything that leaned on 'the automatic path produces most of the data'.
- An archived note is SUPERSEDED, not neglected - look for its replacement before citing it. The Loop 7 brief's central claim against injection was a vault note retracted 26 minutes after it was written, and the brief pointed at the archived copy by path. Also: scoping a search to one folder is still a grep with extra steps (there is no STEM Agent note in Research/ at all).
- Verify a claim before it enters a conclusion, and keep the wrongness count in both directions. Loop 7: five brief instructions wrong or incomplete, and one of mine (success_rate 'reads 1.0 or NULL and nothing else' - it has three counterexamples). The count only works if reporting it stays cheap.
- Bare `npx vitest` from the repo root loads no config and fails 36 tests on a vault guard. Use `npm test` from the repo root, or vitest from open-brain/. Fetch before reading any SHA off this working copy.
- G-016: state-writer.test.ts failed once under the full suite and passed in isolation and on re-runs. If it recurs, suspect cross-file database or temp-dir state leakage rather than the writer.
- README.md line 121 says 'No separate hook scripts needed' three lines above a table listing two hook scripts. Wrong, predates session 58, deliberately left rather than rewritten mid-loop. Worth fixing.
- The D-NNN/ADR-NNN id split reproduced again: decisions titled ADR-029 and ADR-030 were assigned ids D-004 and D-005.

## Open questions

- T-090 - did the SessionEnd hook actually complete for session 4a395fd1? This is the n=1 proof of the R2 fix and it is cheap. Answer it before anything else.
- T-145 - does Aaron adopt C2? All three parts are separable; he can take the suspension without the keep, or vice versa.
- Loop 8's scope. The strongest candidate the loop surfaced is not on the gap list: the store repeatedly holds a correct observation of a live defect, filed as a curiosity, a healthy zero, a superseded note, or a minor inconsistency - four instances in one night (entry 473, the archived WikiSkill note, apoptosis-eligible:0, and G-015's key-names-without-values). Recorded as knowledge 563. Making that re-reading step routine would be worth more than any single gap on the list.
- G-015 - may a session uuid hold more than one project key at all? If not, writeActiveSession should evict any other key carrying the same uuid. If yes, project scoping cannot be derived from the slot file and needs its own record. Either way, store the SessionStart `source` VALUE so the trigger is readable instead of re-derived.
- Three loops have now shipped untagged at 0.31.0. G-012 (remove project.version from state.json, 7 consumers, none authoritative, decided in ADR-027) would settle it. It compounds.

## Last session

Session 58 — 2026-09-15 — `4a395fd1-3504-4c5b-95df-515bd2ba90e0`
