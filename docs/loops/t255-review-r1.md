# T-255 review r1 (grok-sia-review), verbatim

Room k57c639j4wkyp3y3vhfxxytn1s8fsdx6, job turn 53 (atlas); reply REVIEW 1/1. Committed verbatim by Atlas (s166) per
D-127. Reviewed: PR #564, 7094f086..7a6f870f.

**Planner ruling:** no blocking findings.
- **F1 (major) is real.** A W2 refusal is sticky when the session number comes from the record. Maker's own state
  (record n=56, and Session_57.md present with no id) would trigger it on the next start.
- **To round 2** (brief §ROUND 2): F1 and F2 (take the next free number, with an atomic `wx` create), F4 (the CLI
  prints the skip) and F6 (a record-path test).
- **Reworded within R2:** F3.
- **Recorded only:** F5 and F7.

```text
--- grok-sia-review ---
REVIEW 1/1 7a6f870

Verdict: W1-W3 correct as specified; no blocking. One major design gap in W2 (refusal is sticky for a record-sourced number). Tests run at head in token-free scratch clone, Node v22.23.3: session-log-id, session-log-id-skip, session-log, tests/t048-*, tests/pipelines/sync/t048-* = 12 files, 95/95 pass. Full tests/pipelines/session-start/ = 503/503.

F1 [major] open-brain/src/pipelines/session-start/index.ts:44 at 7a6f870
claim: W2's refusal persists for the whole session (and later sessions) when the number comes from the record; nothing moves the number, so every ob_start refuses and the session never gets a log.
evidence: index.ts:44 "const { sessionNumber, source } = nextGreetingSessionNumber(options.projectRoot, state.stateJson);"; session-log.ts:19 "return { sessionNumber: nextSessionNumber(stateJson.data.sessions), source: \"record\" };"; state-schema.ts:410 "Math.max(...sessions.map((s) => s.n)) + 1"; session-log.ts:88 "if (existsSync(logPath)) return \"\";"
scenario: record says max n=56, Session_57.md already exists from another checkout/seat (the Maker case). Every ob_start this session computes 57, refuses, skippedReason set; repeats until the record gains n=57. The "local" source cannot collide (findNextSessionNumber is max+1, :35), so this only bites the record path. Downstream: /end, end-record-guard, handoff-guard do not read Session_N.md or session.logPath (grep of src finds no consumer), so a skip is not worse than a duplicate for /end/set_handoff — but the briefing loses its number: server.ts:426 and :435 pass null when logPath is "" ("sessionNumber: result.session.logPath ? result.session.sessionNumber : null"), so readsOwed/briefing watch_out expiry run with sessionNumber null. Suggest: on collision, bump to max(record-next, local-next) or Session_N-<shortid>.md, rather than no log.

F2 [minor] open-brain/src/pipelines/session-start/session-log.ts:88 at 7a6f870
claim: TOCTOU between existsSync and writeFileSync; two concurrent ob_start calls (different ids, same number) can both pass the check and the second overwrites the first — the exact W2 bug.
evidence: :88 "if (existsSync(logPath)) return \"\";" ... :113 "writeFileSync(logPath, content, \"utf-8\");"
scenario: two subagents/seats call ob_start within ms. Yes, writeFileSync(logPath, content, { encoding: "utf-8", flag: "wx" }) with catch EEXIST -> return "" is the right tightening (keep the early existsSync as a fast path or drop it). Same-id concurrent calls would then yield one log + one refusal instead of reuse; acceptable.

F3 [minor] open-brain/src/pipelines/session-start/index.ts:53 at 7a6f870
claim: skippedReason asserts the existing file "does not carry this session's id", but it may simply have been unreadable (T-048 path skips it), in which case it might be this session's own log.
evidence: session-log.ts:61 "try { content = readFileSync(logPath, \"utf-8\"); } catch { onUnreadable?.(f); continue; }"; index.ts:53 "already exists and does not carry this session's id"
scenario: Session_57.md unreadable (perms/lock) and it is this session's log; message is wrong (warning at :38 does appear separately). Wording fix: "already exists (not matched to this session's id)".

F4 [minor] open-brain/src/cli.ts:209 at 7a6f870
claim: CLI session-start prints nothing when W2 refuses; skippedReason is only rendered by server.ts:336.
evidence: cli.ts:209 "if (result.session.logPath) {" with no else branch for skippedReason.
scenario: CLI user gets no log and no notice. Pre-existing for the no-SESSIONS skip, but W2 adds a new silent case.

F5 [nit] open-brain/src/pipelines/session-start/index.ts:50 at 7a6f870
claim: skip branch drops sessionNumberSource and hard-codes sessionNumber 0; 0 does not leak (all readers gate on logPath: server.ts:326, :426, :435; cli.ts:209), but no test pins it.
evidence: :50 "sessionNumber: 0,"; mutant sessionNumber:0 -> sessionNumber survives all 503 session-start tests.
scenario: a future reader that checks sessionNumber without the logPath gate would see 0. Low risk.

F6 [minor] open-brain/tests/pipelines/session-start/session-log-id-skip.test.ts:11 at 7a6f870
claim: W3 is tested only with createSessionLog mocked; no end-to-end test of the real collision (valid state.json record pointing at an existing Session_N.md), which is the production path of F1.
evidence: :11 "createSessionLog: () => \"\","; SL-5 (session-log-id.test.ts:111-117) exercises createSessionLog alone.
scenario: a regression where index.ts uses findNextSessionNumber vs record differently would not be caught; also no test for repeated ob_start after a refusal (F1 stickiness).

F7 [nit] open-brain/src/pipelines/session-start/session-log.ts:109 at 7a6f870
claim: W1 fallback inserts LF into a CRLF template (mixed endings) and puts the id inside YAML front matter if line 1 is "---".
evidence: :109 "content = nl === -1 ? `${content}\n${idLine}\n` : `${content.slice(0, nl + 1)}${idLine}\n${content.slice(nl + 1)}`;"
scenario: harmless for matching — SESSION_ID_LINE (:23) "\s*$" absorbs a trailing \r and (\S+) excludes it; a front-matter template would get an invalid YAML line. Edge cases checked: first line a "> " quote -> id goes after it, still matched; empty template -> "\n> **Session ID:** x\n", matched; template "\r" -> "\r\n> ...\n", matched; "Status:" outside a quote line -> Status regex misses, fallback used, correct. Mutant inserting \r\n instead of \n is killed by SL-1 (split("\n") line check).

looked: W1-W3 correctness — F1, F3
looked: W1 fallback edge cases (quote first line, empty, "\r", CRLF, Status outside quote) — F7
looked: W2/W3 consequences, callers of logPath/sessionNumber, sessionNumber 0 leak — F1, F4, F5
looked: TOCTOU / wx — F2
looked: test strength / survivors — F5, F6
looked: security (paths, injection of sessionId into file) — found nothing
time spent: ~25 min


```
