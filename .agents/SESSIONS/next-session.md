<!-- generated from .agents/state.json rev 157 by open-brain v0.44.2 — do not edit; change state via ob_state -->

# Next Session Handoff

## planner [sia-planner] _(written session 149)_

### Pick up here

Planner session 149. THREE QA RUNS ARE LIVE: QA 216 (record 215, T-195) on the QA PC since 00:31:11Z from 315b245; QA 213 (candidate C r3; ACCEPT closes slice three) then QA 218 (192 r5) on the laptop since 00:34:05Z from 842375f. Read each report and its drive.meta when the queues end (queue.log 'end='). If QA 213 ACCEPTs: shadow-verdict prepare on its E_t BEFORE Aaron merges #195, decide after (C criteria §8 P4). AARON'S STANDING ORDER (this session, verbatim): 'launch QA 216 on the QA PC  one at a time: the laptop queue (QA 213, then QA 218), #201, and #198'. Launches are done; #201 (the record catch-up, including the D-061 developer.md change) and then #198 are HELD by the planner until the queues end, because a master merge mid-run lands in every running driver's ref_violations. #198 also needs its own PR run showing test green. THIS REVISION (153) IS COMMITTED LOCALLY ON docs/session-100-qa99-dispatch AND NOT PUSHED, for the same reason; push it when the queues end, then #201 carries it. Seats, all on PUSH HOLD (clearances withdrawn at hub turns 227/71/58): Forge has T-198 (record 217) done locally (b920b98, mutant bbf4b78); infra has record 219 (T-196 56b06a2, planner.md 6d01c12, T-197 35fc1d8, mutant 20898e5) locally, with two fixes owed (restore the live ~/.cursor/commands/start.md it overwrote; one seat file with Forge's hub-partner-seats.json); builder has T-194 committed locally (7d68bcf, handoff 36dd9c9) but has not posted. Hub listeners die with the session: re-arm one per room (rooms in docs/loops/t196-t197-dispatch.md on master).

### Watch out

- REF-AUDIT TRACE FOR QA 216 (started 00:31:11Z): the PLANNER moved two refs mid-run: refs/heads/docs/qa-213-to-master created at a4205c9, and refs/heads/master 334fee5 -> 842375f (#205's merge, docs-only). Both will appear in QA 216's ref_violations. They are the planner's, not the QA seat's: do not charge QA 216 with them. Anything else in that list needs tracing by SHA.
- QA drivers record ANY non-qa/ remote ref that moves during a run as ref_violations (drive.ps1 Compare-Refs). That includes master merges and the planner's own docs branches. Do not merge or push while a queue runs, or trace every move by SHA at the time.
- Every QA seat still runs the OLD driver template until #194 (record 192) merges: a sanctioned push can be refused, and another seat's mid-run push reads as ref_violations. Hold seat pushes during QA runs, or trace them by SHA.
- D-062 (this session): briefs and QA dispatches reach master BEFORE they are cited, through a docs-only PR the planner merges (four this session: #202, #203, #204, #205). A dispatch cites an origin/master SHA. Role-file changes go in their own PR to Aaron.
- Every QA dispatch requires an E_t.json beside the report, validated (C criteria §8 P1). QA 216, 213 and 218's dispatches all require one.
- D-061: developers NEVER run CI. QA dispatches it. Seats echo old briefs ('tcm at most 6'); correct them on sight.
- Composer (sia-infra) ends its turn on a bare acknowledgement, and this session it also wrote OUTSIDE its worktree (it copied its candidate /start into the live ~/.cursor/commands/start.md). Say 'do it in this turn; no acknowledgement' and 'write nothing outside your worktree'.
- Cursor seats do not read the hub on their own until T-196 lands: builder and Forge sat on their dispatches for about an hour. Aaron needs a first line per seat (hub-talk --as <name> --session <room> --inbox). Hub names: builder cursor-builder, Forge grok, infra cursor-infra.
- Presence check (until T-198 lands): GET http://100.124.212.87:4000/a2a/agents/presence?name=<one agent> with X-Agent-Key dev-key. It reads ONLY ?name= (hub T-079). 0 unread with pollingNow false means 'read and idle', not 'working'.
- qa-launch.md is stale: it says qa-queue.ps1 is 6,330 bytes and unchanged since 2667c6b. It is 15,068 bytes on both QA machines and on master (SHA-1 9FF81DE0...), changed by c6fb300 and f590448. The launch lines themselves still work (both ran this session).
- A process search whose pattern appears in its own command line matches itself: two 'running driver' PIDs on the QA PC were the planner's own query. List processes by name and print their command lines, never filter on the words you are searching for.
- QA 203's report for record 198 is on the QA PC ONLY (local 120dc44 on qa/qa-probes-report, plus two mutant branches); it is Aaron's call, still open.

### Open questions

- Aaron: push QA 203's stranded report from the QA PC (his hand), or wait until #194 lets a QA seat push it?
- Aaron: Telegram approval for QA (D-058) is on HOLD by his choice.
- Aaron: register T-194's planner hook in sia-planner/.claude/settings.local.json once QA accepts it (his hand, not the planner's).
- Aaron: his memory file reference_a2a_hub_tcm.md says the hub is cross-machine only, which is wrong for Cursor seats; his to correct.

### Loop state

**Open PRs:** 
- #194 loop/qa-driver-cursor-r2 (bbfb724) — QA: in_progress — record 192 r5 (harness-only launch-quoting fix); QA 218 queued on the laptop after 213
- #195 loop/15-slice-3-candidate-c (5f7c9a0) — QA: in_progress — candidate C r3 (product 20c2dfd); QA 213 RUNNING on the laptop since 00:34Z; ACCEPT closes slice three
- #198 loop/qa-probes-on-master (1c2fbb1) — QA: accepted — record 198; Aaron ordered it merged after #201; held until the QA queues end and its PR run shows test green
- #201 docs/session-100-qa99-dispatch — QA: not_required — the record catch-up + D-061 developer.md; Aaron ordered the merge; held until the QA queues end; CI test passed on run 36502407979 at 1d286a3

**SHA frozen for QA:** `603be51 (record 215, QA 216); 20c2dfd (candidate C r3, QA 213); bbfb724 (192 r5, QA 218)`

**Questions pending for Aaron:** 
- QA 203's stranded report
- Register T-194's hook after QA
- Correct reference_a2a_hub_tcm.md

**Rulings made mid-loop:** 
- D-062: the record reaches seats through origin/master only
- T-194..T-199 opened (T-160 raised to P0; T-191 not raised)
- #200 merged on Aaron's word (c933a44); live master run 36494231337 ran test green
- Record 215's DT-9 returned (it compared ancestry, not content); fixed at 603be51
- 192 r5: the laptop cmd /c failure is the route (PS 5.1 drops quotes), not the environment
- A2A-Hub builds the idle-seat wake (hub T-076, D-029/D-030); SIA T-160 tracks it

## developer [legacy] _(written session 74)_

### Pick up here

LOOP 16 IS MERGED AND TAGGED: PR #83 at f075482, origin/master 579d894, v0.44.0. The recall trigger is live — it fired in a real session and the production store carries its fire rows. THE DURABLE ACCOUNT IS docs/loops/loop-16-developer-handoff.md: sections 1-16 for candidates 1 and 2, 17-21 for candidate 3, with section 5 and section 18 carrying what went wrong. The planner's close-out is docs/loops/loop-16-closeout.md at 579d894. THE RECORD'S OBJECTIVE IS STILL THE PRE-LOOP ONE ('NEXT LOOP: the G-039 recall trigger — not yet briefed') and G-039 is still open: both are the planner's to rule at its own close-out write, and this seat deliberately did not touch either. The next developer session is a FRESH seat for whatever is briefed next.

### Watch out

- A DERIVED VALUE IS ONLY AS GOOD AS THE CHANNEL THE ASSERTION READS FROM. execFileSync returns ONLY STDOUT, so a harness that hardcoded stderr:'' made every expect(stderr).toBe('') pass without ever looking — on the exact observable a ruling had just been written to require. A mutant found it; no amount of reading would have. When a test asserts on a value, check the instrument actually carries that value to the assertion.
- A THRESHOLD COMPARED AGAINST bm25 IS CORPUS-RELATIVE, AND A FIXTURE THAT DOES NOT RESEMBLE THE CORPUS CANNOT TEST IT. The same query scores about 5e-6 against three documents and 14.01 against 599. At the shipped floor a small store is silent for EVERY input, so 'the floor silenced the weak match' passes with the floor doing no work at all. floor.test.ts carries a row asserting its own corpus is still at production scale; if that row ever goes red, every floor assertion under it has gone vacuous rather than wrong.
- A STACKED FIXTURE PROVES AS LITTLE AS A VACUOUS ONE — IT JUST FAILS IN THE FLATTERING DIRECTION. Decoys at 235-343 characters against a 566-character target reported rank 9; rebuilt at comparable length, rank 4. The wrong number was the one that made the problem someone else's, and I reported it before catching it.
- A RULING CAN BE ASKED FOR, AGREED, REPORTED AS SETTLED, AND NEVER BUILT. R7 was the answer to my own question and produced no code and no test. Nothing between the ruling and QA's verdict could tell: 153 tests, tsc clean, sync clean, five boundary reports and a handoff checklist were all green. Loading a rule, agreeing with a rule, and applying a rule are three different things.
- PER-INSERT TRANSACTIONS ON A FILE-BACKED SQLite FIXTURE ARE 20x SLOWER: 599 inserts is 599 fsyncs, 2999ms against 148ms wrapped. Survivable locally and over vitest's 10s HOOK timeout on CI, where the whole file then reports its tests SKIPPED — which reads like a missing suite rather than a slow one. :memory: fixtures are unaffected, which is why only one file went red.
- A BULK EDIT THAT MATCHES `it(` DOES NOT MATCH `it.each([...])(`. Three rows kept vitest's default timeout and passed alone every single time, including in CI where an earlier failure hid them. PER-FILE GREEN IS NOT SUITE GREEN: run the full suite alone before calling a change done, including when the change is 'only tests'.
- `git show <ref>:<path>` IS MANGLED BY MSYS IN THE BASH TOOL — it becomes a backslash path and git refuses it. Use PowerShell for ref:path reads. Every amendment and every cross-branch file in this loop was read that way.
- THE HOOK RUNS THE BUILD ITS REGISTRATION POINTS AT, and ob_stats is the only honest test of which build is serving a session — the RECONNECT MESSAGE REPORTS SUCCESS EITHER WAY. Note the trap: the recall-trigger census value `hook` is visible from the OLD build too, because that query predates the loop; only the three FIRE COUNTS prove the new one.

### Open questions

- IS THE FLOOR SET TOO HIGH? The first production numbers are 5 not-asked, 10 asked-silent, 1 injected — so ten recognised commands asked the store and got nothing. That is either a correctly conservative floor or a floor that will train seats to ignore a channel that never speaks. The fire table now makes it answerable; nobody has answered it.
- DOES A SEAT ACT ON WHAT IS SURFACED? Unmeasured by design. This loop makes the store ask; whether the answer changes an error rate is the next loops' count, against the error table, by family.
- IS THE 0.28s PER Bash CALL ACCEPTABLE? R22 kept the census's denominator for the evaluation period and put the cost to Aaron. The named follow-up is a cheap not-asked path that appends to the log the hook already writes and lets the session-end hook reconcile it into trigger_fires.
- SHOULD THE RANKING BE REPAIRED, AND HOW? Entry 299 ranks 4 of 11 against ten same-topic competitors; the live store ranks it first only because five entries match all three terms. Key-column weighting moves it (x10 to first, by 0.56) but a weight chosen to make a test pass is tuning to the test.

## qa [legacy] _(written session 75)_

### Pick up here

THIS IS THE QA SEAT'S HANDOFF for Loop 16, the G-039 recall trigger, ACCEPTED at 5351270 and released as v0.44.0. Read the planner's close-out at docs/loops/loop-16-closeout.md for the loop's disposition; the four QA reports are in #85 (75e307d) — report 1 at a13f3c5 with its correction at ef79340, report 2 at c1b977a, report 3 at 87b4cef, report 4 at 31fec1a. Seats roll after every complete loop, so the next QA session is a FRESH one for whatever the planner briefs — Loop 15 slice three per D-023, whose mandatory first repair is G-045. Its first act is the same as this seat's was: write docs/loops/loop-<N>-qa-criteria.md from the brief's rows BEFORE any candidate exists, in the shape of loop-16-qa-criteria.md at 75f05eb, every pass clause derived from the brief's words, anything added marked [mine] and returned to the planner in a numbered section rather than applied. Nine criteria commits this loop and not one of them moved while a candidate was under evaluation; that is the property worth keeping. The probe shapes are in report 1 §10, report 2 §14 and report 3 §10 and are rerunnable from the descriptions — the scripts were scratchpad-only and are not tracked. Evaluate in ~/Worktrees/sia-qa; the tree carries its own .gitnexus/ index so /sync runs 0 skipped. TWO GAPS THIS SEAT FOUND ARE UNWRITTEN AND ARE IN V-071 AND THE OPEN QUESTIONS BELOW, because writing them would have reused two closed gap ids.

### Watch out

- CLOSED GAP IDS ARE HANDED BACK BY THE NEXT add_gap. At rev 60 a dry run assigned G-046 and G-047 — ids closed at rev 59 whose OLD meanings are cited in ten tracked files, including .claude/commands/end.md, which explains the per-seat handoff by citing G-046. Done-task retention now protects ids the tree cites (it KEPT T-157 in this very write, with a NOTE); gaps have no such guard, and the gap failure is worse: an evicted task id goes DANGLING and announces itself, while a reused gap id points at something WRONG and does not. DRY RUN EVERY add_gap AND CHECK THE ASSIGNED ID AGAINST `git grep` BEFORE THE REAL CALL.
- ob_stats SHOWING `hook: 1` IS NOT EVIDENCE THE SERVER KNOWS ABOUT THE TRIGGER. That census is a GROUP BY over recall_log values, so a stale build prints it from data alone. The three fire counts from trigger_fires are the discriminator, and the planner's check was worded to require them — one word looser and a pre-0.44.0 server would have been declared current.
- A QUOTING LAYER BETWEEN YOU AND THE ARTIFACT EDITS THE CONTENT AND REPORTS SUCCESS. Four instances this session: a heredoc'd backslash became a real newline inside a TypeScript string literal (syntax-broken mutant, all twelve tests red, looks exactly like the result you wanted); a heredoc'd regex never compiled so a fixture was never modified and the test passed against it — which read as A FALSE ACCUSATION against a working guard; a backticked word in a hub message was executed as a command substitution and the clause arrived missing its subject; and json.dumps without ensure_ascii=False escaped every em-dash in Aaron's settings.json. WRITE EVERY SCRIPT AND EVERY MESSAGE TO A FILE, including one-liners, and have mutation scripts ASSERT THE EDIT LANDED before running anything.
- tsc --noEmit ON EVERY MUTANT, BEFORE COUNTING IT. Three mutants this session were type-invalid and proved nothing while looking red or green as convenient — TS2349 from calling an object instead of its method, and an invented field that fell back to the real one at run time. A mutant that breaks syntax or types is not a mutant.
- A FIXTURE CAN FAIL IN THE FLATTERING DIRECTION, and that is harder to see than a vacuous one because it looks like rigour. My first A1 decoy carried all three query terms in one short sentence and beat entry 299; the developer's rank-9 fixture gave every decoy a length advantage. Both exaggerated the defect. Measure your fixture's shape — decoy lengths against the target's — and report the range.
- THE DERIVATION READS ELEMENTS, NOT WORDS. `zzqqxxyy 2>&1 | tail -3; echo $?` derives all three terms and injects, because the recogniser sees a trimmer pipeline and a $? read. You cannot produce a SILENT fire with nonsense command text; use a three-document store, where bm25's IDF collapses and nothing clears the floor.
- EVERY ROW YOU RUN, RUNS ON THIS MACHINE. CI is the second machine and it found two faults in one file the first time it looked, both of which passed every local run including three full suites. Cite a CI run id as evidence, and treat an empty statusCheckRollup as PRE-REGISTRATION and not a pass — mine was genuinely empty for ~3.5 minutes after the push before the run appeared.
- NOTHING IS PUSHED FROM THIS SEAT. The planner pushes QA branches by the SHA this seat reports, on Aaron's word for that push. Every push names a BRANCH TIP, never an interior commit — a report correction is auditable only if the thing it corrects travels with it.
- REGISTERING THE HOOK IN ~/.claude/settings.json IS MACHINE-WIDE, not QA-tree-wide: two of the ten fire rows from the A7 probe carry other seats' session uuids. Aaron's word is for THAT ACT AT THAT SHA and does not carry forward. Back up first, hash before and after, and verify the restore BY BYTES — 'PostToolUse is [] again' is a semantic restore, not a restore.

### Open questions

- WHERE DOES A CLAUDE CODE SESSION'S TRANSCRIPT ACTUALLY LIVE? Not at ~/.claude/projects/<slug>/<uuid>.jsonl for this session — three .jsonl files there, none this uuid, none holding the probe string; a recursive search found it only in open-brain/knowledge-v2.db-wal, the trigger's own fire row. Until that is answered, no criteria row can evidence that the host DELIVERED a hook's additionalContext to the model, only that the hook emitted it. A7 was scored on the fire rows for exactly this reason. UNWRITTEN AS A GAP because the id would have collided.
- DOES A SEAT APPLY WHAT THE TRIGGER SURFACES? Unchanged and unmeasured, and the loop's own premise was demonstrated against it while the candidate was being built — the developer piped to tail and read tail's exit code while measuring A10, against a store containing entry 299, with the hook built and not registered. A trigger built and not registered is exactly as useful as no trigger.
- IS THE RANKING GAP (R26) WORSE THAN THE LIVE STORE SUGGESTS? Entry 299 ranks first on the real 599-entry store only because five entries there carry all three derived terms — a thin field. Against ten same-topic competitors it ranks 4th (developer, comparable length) or 3rd (mine). The key-weight table is in the close-out as evidence; the loop that owns ranking chooses.
- IS G-042 ANYTHING BUT THIS MACHINE? Eight sightings, one machine, and now three clean full runs in a row in the QA tree at rising counts (1021, 1027, 1031). CI has never shown the worker-heartbeat signature — but CI has now shown two OTHER load-dependent faults in the same file, which is the first evidence that the QA tree is a fast machine rather than a representative one. UNWRITTEN AS A GAP because the id would have collided.

_3 older handoff(s), superseded within their seat and checkout, are in state.json and not rendered here._

## Last session

Session 149 — 2026-09-28 — planner [sia-planner] — `c407df9c-3dd7-4273-891b-798b4bd527f4` (5 writing session(s) in the record)
