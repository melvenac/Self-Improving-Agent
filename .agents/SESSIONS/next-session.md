<!-- generated from .agents/state.json rev 127 by open-brain v0.44.2 — do not edit; change state via ob_state -->

# Next Session Handoff

## planner _(written session 100)_

### Pick up here

PLANNER SESSION 100 (Atlas), 2026-09-25 ~06:45Z. READ docs/loops/adoption-plan-2026-09-25.md FIRST (section 8). CANDIDATE A: A8 REJECTED (QA 99); rulings-16 (R72-R76); A9 6bd97f2 FROZEN by Grok 103 and verified by the planner (the R76 merge equals git merge-tree 9e2dd5d 9bc06e3; A8's harness code untouched). QA 104 is STAGED on the QA PC (tree at fcfbaeb; dispatch docs/loops/loop-15-slice-3-dispatch-qa-a9.md; driver docs/loops/qa-104/, made by docs/loops/qa-driver-copy.mjs) and waits for AARON to launch it (the QA 99 command with qa-104). IMPORTER: round 1 f6b6d44 passed QA 102's eight rows but is NOT to merge (D1-D4 in QA 102's report on origin/qa/importer-fixes-report); ROUND 2 is being built by developer 105 (Claude, ~/Worktrees/sia-infra, session sia-infra-32 in ListAgents; brief docs/loops/importer-fixes-round-2-brief.md; branch loop/importer-fixes-r2, not yet pushed at 06:30Z). It may run ONE full local suite when every peer is idle. Its QA is 106, headless, after QA 104 frees the QA PC. On acceptance: merge and release are Aaron's (D-019); then the MAIN checkout (111 commits behind master at 06:40Z; T-172) must be updated and rebuilt before adoption (T-181). Grok's sia-forge session and developer 101 are CLOSED (D-035). A2A-Hub's T-003 cutover is DONE. THEN one record PR for docs/session-100-qa99-dispatch under D-032.

### Watch out

- THE GREETING NO LONGER FITS ONE TOOL RESULT (T-183): ob_start's output was 92,131 characters at rev 121 and is saved to a file. READ THE WHOLE FILE IN CHUNKS before acting; the watch-outs and the handoff are inside it.
- THE MAIN CHECKOUT IS STALE (T-172): ~/Projects/Self-Improving-Agent was at f673d5e (v0.44.1), 111 commits behind master at 2026-09-25 06:40Z, and it serves every session's hooks and the MCP server on this machine. Its GitNexus index is 98 commits behind that. A merged fix reaches no project until that tree is updated and rebuilt.
- A2A-HUB T-003 IS DONE (window 2026-09-25 ~03:55Z-04:27Z, opened on Aaron's "dispatch relay A2A-Hub switchover"; K7 passed: 6 owned rows, the shared dev-key held by no name; tcm on v1.10.0, AUTH_MODE warn; ~/Projects/A2A-Hub at c4d2d1c). hub-talk now REQUIRES a key file: atlas's and grok's are in C:/Users/melve/.a2a-hub/keys/100.124.212.87-4000/ (created by the planner from ~/Worktrees/a2a-client-v1.10.0 on Aaron's word to Relay). A NEW SIA hub name needs `hub-talk --as <name> --init-key` against tcm AND Aaron's word first. Never copy a .key file anywhere. Relay's evidence: A2A-Hub docs/loops/t-003-cutover-log.md.
- RECORD SESSION NUMBERS ARE NOT THE GREETING'S (T-164). Session 100's greeting said Session #7. The sequence: planner 90, Forge-infra 97, Grok 98, QA 99, planner 100. Put the record number in every dispatch.
- READ THE INTENT DOCUMENTS AT /start (the Step-Back artifact on claude.ai, PRD.md, README.md) BEFORE THE FIRST RULING, and say in the briefing that you did. Sessions 90 AND 100 both skipped it; 100 read them only when Aaron pointed (error entry: adoption plan section 7). T-167 is the structural fix. The Step-Back stops at Loop 11 and needs a Part 6 at Loop 15 close (T-169).
- QA 99 IS HEADLESS: nobody can talk to it and it cannot ask. Its questions land in the report's 'Open for the planner' section. Watch it with `node C:/Users/melve/Worktrees/sia-planner/docs/loops/qa-99/watch.mjs` (read-only; --once prints and exits). The driver resumes at most 3 times; a refusal is never resumed and its stop_details category is in drive.meta.
- LAUNCHING A CLAUDE RUN ON THE QA PC IS DENIED TO THE PLANNER by the host classifier ('[Create Unsafe Agents]'). Do not route around it. Aaron launches with `! ssh -l "Aaron Melven" 100.73.250.101 "powershell -NoProfile -Command Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine='powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\AARONM~1\Worktrees\sia-qa\docs\loops\qa-99\drive.ps1'}"`. Remote cmd mangles nested quotes: use the 8.3 path (no space) or copy a script over.
- AARON'S TERMINAL IS OFTEN GIT BASH: it drops backslashes in Windows paths he pastes. Give him forward-slash paths.
- master HAS NO BRANCH PROTECTION (read 2026-09-25). A headless seat with git push could push it; QA 99's driver denies `git push` and audits every remote head and tag before and after. Keep that shape for any unattended seat.
- D-047: Opus 5.5 default effort is now MEDIUM. QA seats get --effort explicitly; record effort from the transcript, not the init line (the init line does not carry it).
- FULL SUITES NEED A QUIET MACHINE (G-042). SIA's QA now runs on the QA PC; A2A-Hub's seats need not pause for it. Other projects' sessions on THIS box still count for any local suite here.
- stop_reason "refusal" is the API safety layer; Opus 5.5's stop_details names the category (bio, cyber, reasoning_extraction). Record the category. Candidate A's link-handling work stays with Grok (T-177); B and C go to Claude.
- D-038/D-039/D-040: Aaron speaks only to the planner; quote him verbatim with where and when; a permission stop in another seat's window cannot be cleared by relay. A relay to A2A-Hub is acted on by Relay only for SHARED work: for A2A-Hub-only acts it confirms with Aaron directly (2026-09-25, Loop 4 merge). Relay exactly his words; do not read a tag into 'merge'.
- update_task, update_gap, set_objective and set_handoff REPLACE their field. Compose in a SCRIPT FILE, DRY-RUN FIRST, and verify byte for byte. Git Bash's /tmp and node's /tmp are different directories on this machine (AppData\Local\Temp vs C:\tmp); it bit session 100 once (a node read of a Git-Bash /tmp file printed nothing).
- build-freshness fails in this tree: build a010557, and open-brain changed since (paths.ts, PR #156), so it is a REAL staleness, not stamp-only. /sync also carries the retirements ISSUE on ENTITIES.md (dream, reflection queue), recorded in T-169 part 3.
- The recall trigger injects entry 299 (pipe-to-tail) on any Bash command with a pipe to tail/head. Check the end state or read ${PIPESTATUS[0]} rather than the piped exit line.
- DISPATCH TABLES ARE BUILT FROM EACH COMMIT'S `git diff --stat`, NEVER ITS SUBJECT (rulings-13, error entry 1). A BRIEF'S CODE POINTERS ARE ITS SCOPE (rulings-15 error entry): name every site on both sides, or name the class.
- MERGE ONLY THROUGH A GATE THAT REFUSES. `gh pr checks --watch` exits at once with 'no checks reported' when CI has not registered; a chained merge then runs on UNSTABLE (rulings-14, error entry 3).
- GitHub Actions: 1,802 of 2,000 minutes on 2026-09-24, then A8's 7 hosted runs (~21 min); QA 99 is capped at 8 hosted runs; resets Oct 1. The billing API needs the gh 'user' scope, which this machine's token lacks, so the live figure is unread. Candidate-based probe branches carry the old ci.yml and run hosted (planner 90's ruling: stay hosted, tcm has git 2.43).

### Open questions

- Is G-042 the machine's load, the worktree, or Cursor running in it? Repeat runs in the SAME tree are the missing control.
- T-050: can Cursor's stop hook wake an idle seat? Deferred by Relay (2026-09-25) until it writes a brief for Aaron after the tcm cutover; not a trial on Grok's seat.
- Were Forge's two refusals false positives? /feedback was advised; not recorded as done.
- T-165: every rejection of a Grok-built candidate (A2, A3, A4) traces at least partly to a planner ruling. Compare deliberately once slice three closes, reading it that way, not as a score for the developer seat.
- Does medium effort (D-047) change report quality? Compare the first reports after 2026-09-25 against the earlier ones, labelled by effort.
- gitnexus on the QA PC (QA 99 section 15 Q5): install it so /sync --check can run there? An install on Aaron's PC, so his call; D-049 makes /sync rebuild an index where one exists, which does not put one on that PC.
- tcm's Claude Code (T-182): update it so CA-9 can pass there? Aaron's machine, so his call.

### Loop state

**Open PRs:** 
- docs/session-100-qa99-dispatch — QA: not_required — Branch, not yet a PR: the QA 99/102/104 dispatches and drivers, the driver copier, the live view, the adoption plan, both importer briefs, rulings-16, the A9 brief, and the state writes. One record PR under D-032 after QA 104 reports.

**SHA frozen for QA:** `6bd97f2a573394ce84f986531975f3d509d484c5`

**Questions pending for Aaron:** _None._

**Rulings made mid-loop:** 
- D-031 release commit after acceptance
- D-032 standing merge authority for record/docs-only PRs
- D-033 and D-036: slice three closes at A, B and C
- D-034 other projects' seats are recorded, pause on request
- D-035 fresh seat sessions at each candidate boundary
- D-037 memory is lookup by default (T-170)
- D-038 Aaron speaks only to the planner; seats push their own working branches
- D-039 A2A-Hub's planner routes through the SIA planner for shared work
- D-040 seats dispatch CI on their own branches without asking; T-178 makes it automatic
- D-041 A6 changes approach: the OS resolves links, the runtime compares the file reached
- Rulings R1-R76 in docs/loops/loop-15-slice-3-rulings-1..16.md (R28 is the brief's)
- D-042 R67 approved: same place, not shared
- D-043/D-044 two sandboxed self-hosted runners on tcm
- D-045 QA moves to desktop-o4egb1e over SSH
- D-046 A8 goes ahead with R69; v0.44.2 released
- A to A8 rejected (A8-1, A8-2; report 95727ef); rulings-16 R72-R76; A9 6bd97f2 frozen (Grok 103), QA 104 staged
- D-047 Opus 5.5 default effort medium; QA seats set effort explicitly
- D-048 Makerspace record-only onto SIA before its cutover, after the pilots and T-175/T-180 (T-181; docs/loops/adoption-plan-2026-09-25.md)
- D-049 /sync rebuilds the GitNexus index when behind (T-187)

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
