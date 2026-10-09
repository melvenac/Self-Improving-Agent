# T-255 review r2 (grok-sia-review, delta), verbatim

Room k57c639j4wkyp3y3vhfxxytn1s8fsdx6, job turn 55 (atlas); reply REVIEW 1/1. Committed verbatim by Atlas (s166) per
D-127. Reviewed: PR #564 delta 7a6f870f..2c7b9594 (round 2).

**Planner ruling: ACCEPT-level** (0 blocking, 0 major). r1 F1, F2, F4 and F6 are closed. Each session id converges
on one log, with no loop.

The planner's own checks were first-hand: mutants M1 and M3–M8 each turned red, and the suite ran 80/80.

F1–F5 are recorded on T-255 as follow-ups, worked only if one bites (D-143):
- **F1:** a null id grows logs on the record path, which is the same behaviour as the local path.
- **F2:** a same-id race leaves an orphan log.
- **F3 and F4:** test survivors (takenNumber is never asserted absent; the EEXIST-only filter is untested).
- **F5:** the note appears only in the legacy header.

```text
--- grok-sia-review ---
REVIEW 1/1 2c7b959

Verdict: delta matches brief ROUND 2 verbatim; no blocking. r1 F1, F2, F4, F6 closed. Two minor new edge cases (null-id growth, same-id race now duplicates instead of refusing), two test survivors. Tests at head, token-free scratch clone, Node v22.23.3: session-log-id, session-log-id-skip, session-log, tests/t048-* (5), tests/pipelines/sync/t048-* (4), briefing = 13 files, 146/146 pass. tsc --noEmit clean.

F1 [minor] open-brain/src/pipelines/session-start/index.ts:68 at 2c7b959
claim: with sessionId null (discovery failed), each ob_start in the same session now mints a NEW log on the record path (N, N+1, ... up to N+19); r1 refused after the first.
evidence: session-log.ts:51 "if (!sessionId) return null;" (no reuse possible); session-log.ts:136 "for (let n = firstNumber; n < firstNumber + SESSION_LOG_PROBE_LIMIT; n++) {"
scenario: discovery fails, agent retries ob_start 3 times -> Session_55/56/57.md, all id-less, record still says next=55. The local path always behaved like this (max+1), so it is parity, not a new class; but it is the one way the record path can grow logs. Optional: when sessionId is null, do not probe (keep r1 refusal), or stamp a placeholder.

F2 [minor] open-brain/src/pipelines/session-start/session-log.ts:115 at 2c7b959
claim: two concurrent ob_start calls with the SAME id now yield two logs (N and N+1, both stamped with that id) instead of r1-F2's predicted one log + refusal.
evidence: index.ts:43 findExistingSessionLog runs before the claim, no lock; :115 "if ((err as NodeJS.ErrnoException).code === \"EEXIST\") return \"\";" then claimSessionLog moves on to n+1.
scenario: retry/reconnect fires two ob_start within ms. Both miss lookup, A wins Session_55 (wx), B gets EEXIST and creates Session_56 with same id. Later calls converge on Session_56 (highest wins, :65) so it is not a loop; Session_55 is an orphan. Rare; acceptable if recorded.

F3 [minor] open-brain/tests/pipelines/session-start/session-log-id.test.ts:111 at 2c7b959
claim: survivor: takenNumber is only asserted when present; nothing asserts it is ABSENT on the no-collision path.
evidence: mutant index.ts:68 condition "claimed.sessionNumber !== sessionNumber" -> "true" : 66/66 pass (session-log-id, -skip, session-log, briefing).
scenario: regression that always sets takenNumber makes every greeting say "Session_N.md was already taken" falsely. Add expect(takenNumber).toBeUndefined() in an existing create row.

F4 [minor] open-brain/src/pipelines/session-start/session-log.ts:115 at 2c7b959
claim: survivor: the EEXIST-only filter is untested; widening the catch to swallow all errors passes.
evidence: mutant replacing the EEXIST line with an unconditional 'return "";' : 66/66 pass.
scenario: someone "simplifies" the catch; then EACCES/EPERM on every number silently probes 20 numbers and reports the misleading "all already exist" message.

F5 [nit] open-brain/src/server.ts:332 at 2c7b959
claim: the takenNumber note is only in the legacy session header line; renderBriefing receives sessionNumber but no takenNumber.
evidence: server.ts:332 note in template; server.ts:426 "sessionNumber: result.session.logPath ? result.session.sessionNumber : null," and briefing.ts:115 "`Session ${i.sessionNumber}`" — no note field.
scenario: both renders are pushed into the same lines[] (server.ts:420 lines.push("", ...renderBriefing(...))), so the note is in the returned text either way; the briefing just says "Session 56". Acceptable. No test covers the server.ts note (A3 manual).

Answers:
(1) F1 closed: refusal replaced by probe (session-log.ts:136), SL-7 proves record path 55 taken -> 56, second call reused. F2 closed: wx create (:113), early existsSync removed; SL-5 now exercises it. F4 closed: cli.ts:212 else-if prints skippedReason. F6 closed: SL-7 is a real end-to-end record-path test with repeated ob_start.
(2) Converges: created log is stamped (W1 id line), findExistingSessionLog runs before any claim (index.ts:43) and scans all Session_*.md regardless of number, so Session_N+k.md is found; record number constant doesn't matter since lookup precedes it. Exceptions: null id (F1), same-id concurrent first call (F2, converges after, orphan left), and an unreadable own log (T-048 path; warned) which would mint another. No loop found.
(3) Cap exhausted: null -> skippedReason "Session_N.md through Session_N+19.md all already exist (not matched...)", accurate (SL-6, SL-8). 20 is ample: collisions come from other checkouts landing numbers the record hasn't caught up on; needing >20 means the record is 20+ sessions stale, which deserves a loud stop. Note the message would be wrong if non-EEXIST errors were ever swallowed (F4).
(4) EEXIST-only is right. Windows: an existing file under wx gives EEXIST; EPERM/EBUSY (AV lock, pending-delete, read-only dir) throw out of createSessionLog -> sessionStart -> ob_start errors. Pre-r2 writeFileSync threw identically, so no regression; swallowing them as "taken" would be worse (F4). Optional hardening: catch at sessionStart and set skippedReason.
(5) Legacy header only; reaches output in both modes because both share lines[]; briefing line lacks it. Acceptable (F5).
(6) Survivors beyond M1, M3-M8: takenNumber always-set (F3), catch-all swallow (F4). Killed: probe returning firstNumber instead of n (2 red), message "LIMIT - 1" -> "LIMIT" (SL-6 red).

looked: r1 F1/F2/F4/F6 closure — closed
looked: reuse/claim convergence, loops — F1, F2
looked: probe cap and message — found nothing
looked: wx / Windows error codes — F4
looked: server.ts/briefing note path — F5
looked: test strength / survivors — F3, F4
looked: security (paths, id injection) — found nothing
time spent: ~15 min


```
