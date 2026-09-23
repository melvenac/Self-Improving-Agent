<!-- generated from .agents/state.json rev 100 by open-brain v0.44.1 — do not edit; change state via ob_state -->

# Next Session Handoff

## planner _(written session 81)_

### Pick up here

PLANNER SESSION 81 (Atlas), 2026-09-23, written while candidate A3 is being built overnight and Aaron is asleep. STATE: candidate A2 2add792 (Grok 4.7 in Cursor, session 84) was REJECTED by QA (Probe, session 85; report at 8cddfc7, merged). A2 CLOSED D-A1's write/delete route in 13 probe shapes. CA-15 failed on the read half, the record and one silent pass. Rulings-9 (R42-R48, on master aef8195) scopes CANDIDATE A3 as a new commit on 2add792. A3 is being built by a FRESH Grok session (developer, record session 86) on branch loop/15-slice-3-candidate-a3, from docs/loops/loop-15-slice-3-a3-grok-brief.md; its plan was accepted in hub turn 12 with two rulings (a new a3 branch; machine-config absent-to-link is reported, never restored or read through). NEXT ACTIONS: (1) Grok reports in hub room k579hndqdr1mxnahy0px1dy8ks8eyef3 (A2A-Hub, reached via ~/Projects/A2A-Hub/scripts/hub-talk.mjs with --session). It asks before a full suite; before saying go, pause Relay (a2a-planner-26) and its Rivet/Gauge. (2) When A3 is frozen and pushed, verify on origin (scope, ancestors, master untouched), open a DRAFT PR so CI runs the POSIX rows, and dispatch a FRESH QA seat (Probe; the session in ~/Worktrees/sia-qa has not run /start, so tell it to) as record session 87, against the criteria at 6672e83 read with rulings-9, including D-A2/D-A4 (R47) and every CA-15 probe against 3b19287 AND 2add792. (3) If A3 is accepted: the merge is Aaron's; then B (the G-042 repair plus E_t) and C (T-155) go to the CLAUDE developer seat (Aaron's question, answered as a recommendation). Session numbers used: 81 planner, 82 QA, 83 developer (Claude, stopped by refusals), 84 developer (Grok, A2), 85 QA, 86 developer (Grok, A3); the next is 87.

### Watch out

- A CURSOR SEAT IS NEVER WOKEN BY A HUB MESSAGE (T-160, now P1). Grok sees a turn only when it runs hub-talk itself; it sat idle through two turns tonight while the send receipts looked like success. Every dispatch tells it to end each turn with `hub-talk --wait --wait-timeout 1800 --session <room>`; if it goes quiet, Aaron must nudge it in its window. ALWAYS pass --session: without it hub-talk joins the newest lobby (Grok landed in grok-room once). NEVER pass --peer: it re-registers the peer's name (A2A-Hub T-051).
- RE-ARM THE HUB LISTENER AFTER EVERY DELIVERY. A `hub-talk --wait` background job exits on the first peer turn; once, none was running and Aaron saw a Grok message before the planner did. And never 'drain' with --wait into a file you do not read: under A2A-Hub's coming read receipts, that marks the turn read though the model never saw it (disclosed to Relay).
- EVERY RULING NAMES THE CRITERIA CLAUSE IT SERVES. Three planner errors tonight, one family, each written from the case in front of it without being read back against the row it serves: the Grok dispatch omitted D-A2/D-A4, which amendment 4 had made candidate rows; R36 was silent on the read; R39's 'base' was unqualified. All escaped to the developer and QA (rulings-9).
- stop_reason: "refusal" IS THE API SAFETY LAYER, NOT SIA AND NOT THE HARNESS (read from Forge's transcript, 05:30:35Z and 05:34:24Z). No seat rephrases around it, and no other seat takes the same work to get past it; only Aaron decides. Candidate A's link-handling work went to Grok on his word (T-177). B and C return to the Claude developer.
- GROK IN CURSOR HAS A 256k CONTEXT. The first A2 session reached 50.7% on reading and design alone. Brief it by SECTION with line pointers (checked against the SHA), with test output to files and a stop at about 70%. Cursor compacts automatically near 90% and the summary loses detail. Its config says approvalMode unrestricted, so D-038's push limits rest on its compliance: verify master after every push it reports.
- D-038 SUPERSEDES the session-78 watch-out 'RELAY IS NOT AUTHORITY FOR A PUSH ... one push question per branch'. Seats push their own working branches without asking; questions for Aaron route through the planner, and his quoted answer is the authority for that act; a host-level stop in another seat's window is the one thing a relay cannot clear. D-039: A2A-Hub's planner (Relay) routes through the SIA planner for shared work, and the SIA planner relays and does NOT plan A2A-Hub. Aaron gave A2A-Hub's seats the same standing push authority tonight (relayed quoted to Relay; its record carries it).
- FULL-SUITE RUNS NEED A QUIET MACHINE (G-042). Before any SIA full suite, ask Relay to hold Rivet and Gauge, wait for its confirmation, and lift the hold as soon as the run ends. Tonight QA's suite ran green at 1107 passed / 5 skipped with the peers idle.
- `build-freshness` FAILS AFTER EVERY DOCS COMMIT IN THIS TREE because it compares commits. Before calling it stamp-only, run `git diff --name-only <build-commit> HEAD -- open-brain` and state the result; otherwise rebuild.
- update_task REPLACES THE NOTE (T-171). Compose old+new in a SCRIPT FILE (an apostrophe inside a bash single-quoted node -e ends the quoting), pass the full text, and verify byte for byte. Done tonight for T-177 twice and T-160 once.

### Open questions

- Does A2A-Hub Loop 1 (Relay; Rivet building T-049 read receipts plus T-051 --peer) make a Cursor seat's silence visible? It helps SIA only after two steps that are Aaron's word: updating ~/Projects/A2A-Hub (the hub-talk every SIA seat runs) and a tcm redeploy (image plus convex deploy, verified with a real send) while no SIA hub traffic is live.
- Were the two refusals false positives? Aaron was advised to run /feedback in Forge's window; whether he did is not recorded.
- T-165's first data point exists (Grok built A2: sound design, clean reports, rejected on the read and record halves, like Claude's candidate A on its blocker). Not yet compared deliberately.
- Does the effort level change the error rate? (carried) Is G-042 external load or the suite's own? (carried; tonight's suites were all green with the peers idle).

### Loop state

**Open PRs:** _None._

**SHA frozen for QA:** _None._

**Questions pending for Aaron:** 
- Morning: merge A3 to master if QA accepts it (the merge is his).
- When A2A-Hub's receipts pass its QA: his word to update ~/Projects/A2A-Hub and to redeploy tcm (Relay will ask through the SIA planner).

**Rulings made mid-loop:** 
- D-031 release commit after acceptance
- D-032 standing merge authority for record/docs-only PRs
- D-033 and D-036: slice three closes at A, B and C
- D-034 other projects' seats are recorded, pause on request
- D-035 fresh seat sessions at each candidate boundary
- D-037 memory is lookup by default (T-170)
- D-038 Aaron speaks only to the planner; seats push their own working branches
- D-039 A2A-Hub's planner routes through the SIA planner for shared work
- Rulings R1-R48 in docs/loops/loop-15-slice-3-rulings-1..9.md (R28 is the brief's)
- Candidate A rejected (D-A1); A2 rejected (A2-1..A2-5, with D-A2/D-A4 unmet by the dispatch); A3 = R43-R48 on 2add792

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
