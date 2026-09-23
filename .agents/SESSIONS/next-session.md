<!-- generated from .agents/state.json rev 102 by open-brain v0.44.1 — do not edit; change state via ob_state -->

# Next Session Handoff

## planner _(written session 81)_

### Pick up here

PLANNER SESSION 81 (Atlas) handing off to a FRESH planner (record session 90) at about 39% context left, 2026-09-23. CANDIDATE A4 is in flight: Grok 4.7 in Cursor, developer record session 88, branch loop/15-slice-3-candidate-a4, draft PR #130. It is 544cf15 (R49-R52 on A3 5010199) PLUS one R54 fix commit pending. Its first full suite failed CA-4f (config-channel.test.ts:348) because R44 merged the read gate with stage attribution; rulings-11 R54 (master 2c0ead2) separates them. The hub room is k57frxw0ptb8tadmqdwy0khhks8ey006 ('sia-a4', A2A-Hub v1.8.0, read receipts live; check GET /a2a/session/<id>/reads). NEXT ACTIONS: (1) When Grok pushes the R54 commit: verify on origin (scope, ancestors, master untouched); confirm Relay's hold is still on and A2A-Hub's local stack is still STOPPED (stopped on Aaron's word, 11 processes, ports free); then give Grok ONE full suite with you idle (start your hub listener only after a sleep). (2) Freeze, then dispatch a FRESH QA seat as record session 89 against the criteria at 6672e83 read with rulings-9/10/11. Every CA-15 probe runs against A4, A3 5010199, A2 2add792 and 3b19287, including QA report A3's four new shapes (A3 is their known positive), R52's five POSIX tests read from CI's per-test lines, and one mutant per protection with R49 and R54 each revertible alone. Tell QA to report to the live planner found by ListAgents, not by name. (3) After the QA suite, lift Relay's hold; whether A2A-Hub's stack restarts is Relay's and Aaron's call. (4) If A4 is accepted: the merge is Aaron's; then B (G-042 repair plus E_t; G-042 now has two idle-vs-contended pairs) and C (T-155) go to the CLAUDE developer. If rejected: rule on the class, not the instance; a fresh Grok session builds A5.

### Watch out

- FOUR PLANNER ERRORS TONIGHT IN ONE FAMILY, ALL ON CA-15: a ruling written from the case in front of it without reading back every criteria row it touches (the Grok dispatch omitted D-A2/D-A4; R36 silent on the read; R39's unqualified base; R43/R44 as instances, not a class; R44 merging read gate and stage attribution, which broke CA-4f). CONTAINMENT: before sending any ruling, list every criteria row it changes behaviour for, and say for each whether it still passes. R49 (a principle) and R54 (two baselines) were written that way.
- A CURSOR SEAT IS NEVER WOKEN BY A HUB MESSAGE (T-160). Read receipts now make it VISIBLE: GET /a2a/session/<room>/reads shows 'unread by grok since T'. Grok still needs Aaron to nudge it when it goes idle (T-050's wake is open, and Relay will ask for a live trial). Always --session and never --peer; run hub-talk only from ~/Projects/A2A-Hub (v1.8.0), and never --inbox or --wait without reading the output: that marks turns read.
- FULL-SUITE RUNS NEED A QUIET MACHINE (G-042). Tonight's evidence: the suite was red with the planner running light commands, or with A2A-Hub's local stack up (its daemons poll every 2 s), and green with everything idle. Hold Relay's seats, keep the stack stopped, and do NOT run your own listener or CI polling during a run: delay the listener with a sleep.
- stop_reason "refusal" is the API safety layer. Candidate A's link-handling work goes to Grok (T-177); nobody rephrases around it. B and C go to Claude.
- GROK: 256k context; brief it by SECTION with verified line pointers, one commit per item, red before green, stop at about 70%. approvalMode is unrestricted, so verify master after every push it reports.
- D-038/D-039: Aaron speaks only to the planner. Quote his words verbatim when relaying, with where and when. A permission stop in another seat's window (Relay's SSH, for example) cannot be cleared by relay: tell Aaron which window. A2A-Hub's seats have standing push authority (their D-005).
- update_task, update_gap and set_objective REPLACE their field. Compose old+new in a SCRIPT FILE (never an inline node -e with apostrophes), DRY-RUN FIRST (skipped once tonight), then verify byte for byte.
- build-freshness fails after every docs commit in this tree. Check `git diff --name-only <build> HEAD -- open-brain` before calling it stamp-only.

### Open questions

- Does A4, with R54, pass? The clause-3 principle (R49) is the first ruling stated as a class; if QA still finds a sibling, the principle needs sharpening, not another instance.
- T-050: can Cursor's stop hook wake an idle seat? Relay will ask for a live trial through the planner.
- Were Forge's two refusals false positives? Aaron was advised to /feedback; not recorded as done.
- T-165: Grok has built A2, A3 and A4; each delivered its scope; every rejection traced to planner rulings. Worth a deliberate comparison once slice three closes.

### Loop state

**Open PRs:** _None._

**SHA frozen for QA:** _None._

**Questions pending for Aaron:** 
- If QA accepts A4: the merge to master is his.
- Whether A2A-Hub's local stack restarts after SIA's QA run (Relay's and his call).

**Rulings made mid-loop:** 
- D-031 release commit after acceptance
- D-032 standing merge authority for record/docs-only PRs
- D-033 and D-036: slice three closes at A, B and C
- D-034 other projects' seats are recorded, pause on request
- D-035 fresh seat sessions at each candidate boundary
- D-037 memory is lookup by default (T-170)
- D-038 Aaron speaks only to the planner; seats push their own working branches
- D-039 A2A-Hub's planner routes through the SIA planner for shared work
- Rulings R1-R54 in docs/loops/loop-15-slice-3-rulings-1..11.md (R28 is the brief's)
- A rejected (D-A1); A2 rejected (A2-1..5); A3 rejected (A3-1..3); A4 = R49-R52 + R54 in flight

## developer _(written session 74)_

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

## qa _(written session 75)_

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

## Last session

Session 76 — 2026-09-21 — planner — `22631f4e-433a-4f29-8669-47ee2f543bec`
