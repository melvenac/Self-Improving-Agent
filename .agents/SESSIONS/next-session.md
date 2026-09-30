<!-- generated from .agents/state.json rev 164 by open-brain v0.44.2 — do not edit; change state via ob_state -->

# Next Session Handoff

## planner [sia-planner] _(written session 149)_

### Pick up here

Planner session 149 ends at about 2026-09-29 06:45Z, with weekly Claude usage at 99%; A2A-Hub's Loop 8b is paused until 2026-09-30 00:00 local on Aaron's word. MASTER is 8b3bc56 and green (the last code merge 7fcbfa0 ran test=success, run 36521817728). FIRST: QA 227 (record 220 r2, T-158, code e23e622) and QA 228 (record 219 r2, T-196+T-197, code 3059ca9) are dispatched on master 8b3bc56 (#212) and NOT launched. The QA PC is idle and awaits Aaron's launch line: -Queue 227,228 -Checkout 8b3bc56461c9bb763ab035ca297ee2913a55952a (qa-launch.md form, QA PC). Then rule on each. SLICE THREE IS OPEN: candidate C r4 (T-155) is queued in Forge's room (hub turn 234), scoped exactly to QA 213's partial rows (CC-1.2, CC-2.2, CC-5.6, CC-13.1, CC-13.2, CC-17). Forge's window is CLOSED (Aaron closed it for CPU); Aaron reopens it in C:\Users\melve\Worktrees\sia-forge with the first line from the planner's reply. Record 217 r2 (T-198) follows C r4 on Forge (turn 235). Builder has record 221 (T-164) done locally at 567657a (held, unpushed) and T-194 (record 214) done locally at f15f2cf (held); T-194 is owed a base proof of its 'unrelated' failures (turn 66, unread), and its PH-4 consequence for Aaron (every D-032 docs merge becomes grant-only) is his call before registering the hook. T-199 is next after those. Infra is idle after 219 r2.

### Watch out

- MERGE A PR, THEN READ MASTER'S OWN RUN, not the PR's. #201's PR run was green and master went red, because tests/shared/state-schema.test.ts r3b read origin/master's live state.json (fixed by #210). This session read master's run after every merge after that.
- A PR's pull_request run checks out the PR HEAD, not a merge with master. Closing and reopening a PR does NOT pick up a master fix; only merging master into the branch does (gh pr update-branch, on Aaron's word for a seat's branch). After an update-branch, the concurrency group cancels the push run and the PR reads UNSTABLE: re-run the cancelled run, and it reads CLEAN.
- Developer seats' 'unrelated' suite failures must be shown at the BASE (a git-archive copy in C:\qa-tmp, never a worktree). Known on this desktop and not code: tests/harness/qa104-a9-probe2.test.ts R72 EPERM on symlink (it should skip, not fail; nobody has fixed it). Forge once quoted exit 0 through a pipe with 4 failures: ask for unpiped exit codes.
- A QA ACCEPT with partial rows is not an automatic accept. QA 213's ACCEPT of C r3 was overruled (five partial rows, including CC-13, the ledger tamper check, and a surviving mutant). C's own criteria make partial give would-not-merge. The session-11 planner's QA 212 ruling had dropped C-212-2, and that is recorded as a planner error.
- Seats are the cursor-agent CLI in VS Code terminals, NOT the Cursor app (no Cursor.exe). Aaron opens and closes them; only he can. Never kill a seat by PID: four cursor-agent processes cannot be told apart safely. Cursor seats do not read the hub on their own until T-196 lands; Aaron pastes a first line (hub-talk --as <name> --session <room> --inbox).
- Hub names and rooms: builder cursor-builder k57098epn7qz32vt0cazfjpbes8f6kdq; Forge grok k57frxw0ptb8tadmqdwy0khhks8ey006; infra cursor-infra k5702788wctxj75begyt4x2k5x8f6mav; the planner is atlas. Presence: GET http://100.124.212.87:4000/a2a/agents/presence (reads only ?name=). 'polling, 0 unread' means a LISTENER consumed the turn, not that the seat read it.
- D-063: tcm is now A2A-Hub's TEST hub. Before any redeploy, auth flip or load test, Relay (a2a-planner) sends a notice by native A2A; GO or HOLD; 10 minutes of silence means wait. No AUTH_MODE=strict until each SIA identity has its own key in T-196's seat file. Relay's shared Loop 8b room is k5722tvj0zw47sftjfww3sxnrn8fbya1 (the planner is a silent reader).
- QA machines: the new QA PC (i5-14500, 7.7 GB) runs a QA in about 14 minutes and is memory-bound (it pages heavily), not CPU-bound. Its sleep AND display timeouts on AC were set to 0 this session: it is Modern Standby, and a 10-minute screen-off dropped it offline mid-evening. The laptop still has a 10-minute AC display timeout and a 4-minute DC sleep; Aaron has not answered whether to set it. Anchor any queue-end watcher on that queue's own start line, not on tail content.
- Every QA dispatch requires an E_t.json beside the report, validated (C criteria section 8, P1). Drivers generated from master since #194 (e83b8fc) use the fixed template: quotes are delivered intact.
- QA 203's report for record 198 is on the QA PC ONLY (local 120dc44 on qa/qa-probes-report); record 198 itself merged as #198. The stranded report is still Aaron's call.

### Open questions

- Aaron: launch QA 227+228 on the QA PC (line in the pick-up).
- Aaron: reopen Forge (sia-forge) for candidate C r4, which closes slice three.
- Aaron: set the laptop's display timeout on AC to 0 (Modern Standby, like the QA PC)?
- Aaron: T-194's hook makes every D-032 docs merge grant-only. Accept that, or ask for a follow-up that checks PR paths without gh?
- Aaron: cli-config.json's default model may have been changed by Rivet's spike (Relay is asking him).
- Aaron: QA 203's stranded report; Telegram (D-058) is on hold.

### Loop state

**Open PRs:** 
- #195 loop/15-slice-3-candidate-c (5f7c9a0) — QA: rejected — candidate C r3: QA 213 said ACCEPT, the planner OVERRULED it; r4 is queued to Forge (turn 234)

**SHA frozen for QA:** `e23e622 (record 220 r2, QA 227); 3059ca9 (record 219 r2, QA 228)`

**Questions pending for Aaron:** 
- Launch QA 227+228
- Reopen Forge for C r4
- Laptop display timeout
- T-194 PH-4 grant-only consequence

**Rulings made mid-loop:** 
- Merged this session on Aaron's word: #200 (CI fix), #201 (record), #210 (r3b test fix), #194 (192 r6), #198 (record 198), #209 (T-195); docs-only by the planner: #202-#208, #211, #212
- ACCEPTED: 215 r2 (T-195, QA 222), 192 r6 (QA 226). REJECTED and returned: 220 (QA 223), 219 (QA 224), 217 (QA 225), 192 r5 (QA 218)
- QA 213's ACCEPT of C r3 overruled -> r4
- D-062 (the record reaches seats through master); D-063 (the tcm notice protocol)
- Planner errors this session: #201 turned master red; a stale laptop-queue hold; trace over-claims; the close/reopen assumption

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

Session 149 — 2026-09-30 — planner [sia-planner] — `c407df9c-3dd7-4273-891b-798b4bd527f4` (5 writing session(s) in the record)
