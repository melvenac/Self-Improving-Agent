<!-- generated from .agents/state.json rev 259 by open-brain v0.44.2 — do not edit; change state via ob_state -->

# Next Session Handoff

## planner [sia-planner] _(written session 155)_

### Pick up here

Planner session 155 (ob_start numbered it #16, per-worktree counter T-164), 2026-10-01 ~08:30Z to ~21:00Z. MERGED this session: #245 (T-216), #250 (T-214), #254 (slice-four step 2, after QA 240/242/243 rejects and QA 244 ACCEPT plus r5's guard scoping), and the records PRs up to #253. Slice four: step 4 is READY but PARKED. Its dispatch is docs/loops/qa-245-s4-step4-dispatch.md (+ qa-245-headless-prompt.md, qa-245/push-qa.mjs): the QA seat on the LAPTOP (D-087) makes <=14 live calls (+<=3 transport retries), then writes the close-out with 4.3 reported three ways. BLOCKED on Aaron, who is remote until he is back at the makerspace: (1) TYPESAFE_API_KEY as a user env var on the laptop (checked ~20:45Z: NOT SET; it is set on the desktop, user scope). He sets it by his own hand (D-070); the planner never moves it. Before launch, check EXISTENCE only, and that a WMI-launched job sees it. (2) The read-only GitHub token for Plumb's gh (clark installs the binary; Aaron creates the PAT). T-194: r7 (docs/loops/t194-r7-dispatch.md, D-084) is with Forge (sia-forge), the one SIA dev job; when it pushes, write QA 246's dispatch by hand (the laptop, for real shells) and book with clark. Records rev 254-255 on origin/docs/session-155i: open its PR.

### Watch out

- USAGE RULE (D-077, amended by D-079 and D-080): Rule change from Aaron (~11:50Z): the USAGE RULE is now at most TWO dev jobs and TWO QA jobs running across all machines (was 1+1). Rule change from Aaron (~11:20Z): keep every agent OPEN. He's remote and can't restart or exit seats. The usage rule now limits RUNNING jobs only; idle seats stay open. Don't ask him to close seats, and don't have seats exit. Remote Control's "idle" only means between turns; confirm work from commits or a reply. The 2+2 pace burned the 5-hour window in about 3h on 2026-10-01 (QA 237 and QA 243 died at the limit and were re-run). A job that dies at the limit is re-run after the reset, REUSING its trees after a clean check and treating its outputs as unverified.
- SLOT BOOKING via clark (clark [9f38ff]; address it by ref while the retired clark 76cf17 is listed) for every QA and dev job before ANY launch (by hand until T-204). Plumb's launch-job.sh takes --dispatch-sha and stamps the SHA as the prompt's first line; on the laptop the planner stages the prompt with that line itself (git show <sha>:<prompt>, via cmd /c) and launches with launch-qa.ps1 (docs/loops/qa-launch.md). The QA PC is a DEVELOPER machine with ~1.2-1.8 GB free: no full suites there; full suites run on Plumb (npm fixed by clark 12:58Z; an unattributed vitest 'onTaskUpdate' RPC timeout there is environmental, D-083). Plumb has no gh until Aaron's token: CI then comes from the PR's own runs, and a PR's pull_request run tests the MERGED ref (that is how #254's fixed-base guard was caught).
- STANDING REPORTING RULES FROM AARON (via Clark), RESTORED at session 154 after being dropped at the session-153 roll (present in session 150's handoff, absent from 153's), CADENCE CHANGED at session 155 by D-077: (1) send `clark` ONE line per hoh-checklist item as it becomes completable, regresses or is blocked (C:\Users\melve\Worktrees\hoh-checklist.md, read-only for the planner), with derived evidence; (2) EVERY 60 MINUTES while active (was 30), a status to `clark` of at most three lines: changed / in flight / waiting on Aaron ('no change; waiting on X since HH:MM' is valid). Re-create the cadence at /start (CronCreate at :04 only). If `clark` is not in ListAgents, skip the send. Completions and blocks are reported as they happen. Until T-211 puts the minutes in seat data, CARRY THIS ITEM FORWARD VERBATIM at every roll.
- MANUAL MODE: on any classifier denial, do not retry or reroute. Send clark ONE line `MANUAL MODE → <seat>: <exact action> (<why>)` and say the same line in the planner session. Aaron approves from his phone.
- PEER-INITIATED HEAVY RUNS ARE REFUSED by dev seats' own classifiers (Forge: 'Interfere With Workloads'). A planner 'go' is a peer message, not Aaron's approval. Plan for Aaron's approval in the seat's window, or relay his verbatim words labelled as his (it worked for r6). Dev seats send clark a MANUAL MODE line when they need it.
- T-208 RESUME: on any resume, run `git fetch --prune` and a drift check (MCP ob_start) before trusting the record. The local CLI in sia-planner is a stale build (a010557); use the MCP tools.
- Instructions are candidates (slice-three finding): define a rule by PROPERTY and require a generator. T-194: enumerating spellings caused r2-r4 rejects; a property generator still had edges (QA 237); inverting the default for constructs (r6) still left characters and command words (QA 241), so r7 allow-lists those too (D-084). Check a dispatch or criteria file against what it governs before a seat builds to it. Derive QA prompts and push helpers by hand, not by sed, and test the helper's refusal before committing.
- A record write can break a test that pins live data (T-205, T-213). Run the tests that read a file before editing it. Corollary from #254: a guard that diffs from a FIXED base reads everything merged after that base; scope every guard to the paths its row names.
- D-068 until 2026-10-03: planner Opus, devs Sonnet, QA Opus headless; Cursor BLOCKED. Re-rule at the reset.
- RELEASE (D-073): no version for slice three alone. Cut ONE release covering slice three (A, B, C) AND slice four once slice four lands (after step 4's close-out), with the CHANGELOG entry and package.json bump together.

### Open questions

_None._

### Loop state

**Open PRs:** _None._

**SHA frozen for QA:** `17767aac (master with slice-four step 2, the code step 4 uses); 9cf8c7eb (T-194 r6, REJECTED; r7 in build)`

**Questions pending for Aaron:** 
- Set TYPESAFE_API_KEY on the laptop (back at the makerspace)
- Create the read-only GitHub token for Plumb

**Rulings made mid-loop:** 
- D-074..D-076 slice-four seats, T-214 rule, criteria
- D-077/079/080 usage rule (2 dev + 2 QA running; all agents open)
- D-081 T-194 r6 by inversion; D-084 r7 extends it to characters and command words
- D-082/083/085 step 2 r1-r3 REJECT rulings; QA 244 ACCEPT; #254 merged after r5
- D-086 Aaron: merge all, r7 to Forge, Plumb token; D-087 step 4 on the laptop after Aaron sets the key

## developer [sia-builder] _(written session 152)_

### Pick up here

Builder seat (Claude Code, desktop) is being moved to the QA PC. Every branch below is pushed to origin and read back with ls-remote. T-201 (P0, /start names the seat's assignment; builds on T-200) is NEXT, NOT STARTED, brief pending from Atlas. T-199 moved to Forge (loop/t199-missing-handoff). DONE and pushed, none merged (except PR 222 which Atlas merges on CLEAN), none CI-run (D-061): T-194 r2b on loop/t194-planner-hook 0f69e041 (product 699789e1; mutants loop/t194-r2-mut-m1..m5, old loop/t194-planner-hook-mut-ph1..8); T-200 on loop/t200-record-from-master 5b9eab0a (product 92f9cc0f; mutants loop/t200-mut-m1..m6); T-164 on loop/t164-record-session-number 567657af (mutant loop/t164-record-session-number-mut-sc4 956755d6); TG-2 fixture fix on fix/tg2-fixture-record a4d540cf, PR 222 (mutant loop/tg2-mut-drop-scan b4bc641b); T-196+T-197 merge on loop/t196-t197-merge dde3cf5d, PR 220. Handoffs in docs/loops/t194-developer-handoff.md and docs/loops/t200-developer-handoff.md. This write is the SECOND attempt (session 152, on rev 183); the first, docs/forge-session-t200-handoff 611d1721 on rev 178, is kept only as its record.

### Watch out

- T-200 and T-199 OVERLAP IN server.ts handleStart, in different hunks. T-199 (Forge) adds sessionUuid: proven.id to the renderState call and a function after renderHandoffs in state-render.ts. T-200 leaves that call's argument list alone (it rebinds sj upstream of it). git merge-tree of loop/t200-record-from-master against origin/loop/t199-missing-handoff, loop/t164-record-session-number and origin/master was clean; whoever merges second rebases. T-164 (567657af) also touches server.ts and the session-log path.
- T-194 r2 needs a token to work at all on a keyring-only machine: this desktop's gh stores its token in the keyring, so the hook cannot read it and every docs merge stays grant-required until GH_TOKEN (fine-grained, Pull requests: Read, scoped to melvenac/Self-Improving-Agent only) is in the planner seat's env block. That is Aaron's hand, at hook registration.
- THE FULL SUITE EXITS 1 ON THE OVERLOADED DESKTOP WITH ZERO FAILED TESTS OR ONLY 5000ms TIMEOUTS. Every full run showed 3 unhandled [vitest-worker] Timeout calling onTaskUpdate errors, and a moving set of 3-14 tests timing out at the 5000ms default (state-import-r6, t048-r3, repo-root V6, role-files, runSync); all pass alone. The last run, on fix/tg2-fixture-record, had 0 failed tests and exit 1. Read the exit code AND the failure list, and re-run a failing file alone before calling it a regression.
- Bash ref:path is mangled by MSYS: git show origin/master:path fails in the Bash tool. Use PowerShell, or MSYS_NO_PATHCONV=1 with quotes. A node -e script written through a heredoc silently turned backslash-n into a real newline and backslash-d into d in three files; use the Edit tool for anything with a backslash.
- A diff check written as git diff c8165f5 origin/master cannot equal a merge's diff (it contains the reversal of the candidate). Compare each side against the merge-base. Atlas recorded that error as its own.
- THE SESSION-NUMBER COLLISION HAPPENED TWICE ON THIS HANDOFF: the local counter said Session #13 while the record's last was 150 (T-164), then the first attempt took 151 which Forge also took, so this one is 152. Take the number from the record on the branch you are writing to, immediately before the write, and re-read it after a fetch.

### Open questions

- Atlas to rule: docs/idea-b-probe a77e73d9, docs/loop-13-developer-testimony e68abdce and loop/7-injection e865f488 are older sessions' work, local-only in the desktop's shared .git. Atlas said not to push or retire them; they stay named here until it decides.
- Sequencing: the developer handoff at session 152 lands with PR 221 (fast-forwarded to this branch, docs/builder-handoff-qa-move); docs/forge-session-t200-handoff 611d1721 (rev 178) is superseded and is not to be merged.

## developer [sia-forge] _(written session 151)_

### Pick up here

Forge (Claude Code, checkout sia-forge) is MOVING to the QA PC; the hub enrollment (forge.key) happens there and Aaron runs it. EVERYTHING IS PUSHED AND READ BACK, no branch is local-only that is mine. State of the work: C r4 (T-155) is on loop/15-slice-3-candidate-c at 0dc20ff with 7 loop/15-slice-3-candidate-c-r4-mut-* branches, docs/loops/loop-15-slice-3-c-r4-developer-handoff.md; T-198 r2 is on loop/t198-presence at a40fc77 with 5 loop/t198-presence-r2-mut-* branches, docs/loops/t198-r2-developer-handoff.md (QA 230 pending); T-199 is on loop/t199-missing-handoff at 621d49e with 6 mut branches, docs/loops/t199-developer-handoff.md, and its planner.md commit 58aad85 is a ROLE FILE that merges only on Aaron's word; T-203 (closes G-049) is on loop/t203-seat-by-checkout at a5a1206 with 6 loop/t203-seat-by-checkout-mut-* branches, built ON t198, docs/loops/t203-developer-handoff.md; merge order t198, then #220, then T-203. NEXT for the next Forge session: T-204 (P1, the QA PC compute lease, brief on origin/docs/session-150-c until PR #221 merges): plan per row to the planner BEFORE code, and the plan must include the re-copy step for docs/loops/qa-queue.ps1 on the QA machines, written for Aaron to run. Every branch above has a handoff file that states, per row, which red is a true base red and which is mutant-only.

### Watch out

- git show ref:path is MANGLED by MSYS in the Bash tool (becomes a backslash path); use PowerShell for ref:path reads, or git -C with plumbing.
- A node child_process.spawnSync of npx.cmd returns status null on this machine and a mutant run reported null for every mutant; call process.execPath on node_modules/typescript/bin/tsc and node_modules/vitest/vitest.mjs directly and REFUSE a null status. A mutant that fails tsc is not a mutant (mutant a of T-203 needed two rewrites).
- The full suite on this desktop is load-noisy: exit 1 with 0 failed tests happens (a vitest-worker 'Timeout calling onTaskUpdate' error, the G-042 shape), and 5000 ms timeouts hit different files on different runs. Known failures: qa104-a9-probe2 R72 (EPERM symlink), state-schema T-171 r3b (moving origin/master). Report every run separately with its exit code and failing tests, and re-run a file alone before attributing a failure; do not call a load failure clean or caused.
- Python on Windows rewrote a UTF-8 file with the wrong codec and CRLF endings (git file said 'data'); do not edit source with Python. Use the Edit tool, or node with explicit utf8. A node -e heredoc turns backslash-n in a template literal into a real newline; prefer the Edit tool for anything with escapes.
- The auto-mode classifier DENIED the hub enrollment (--init-key --invite) as Secret-Store Writes and a detached ( ... ) & subshell as Unauthorized Persistence. Do not retry or route around either; run a background command with run_in_background and no subshell. The enrollment belongs to Aaron in his own window, on the QA PC. The one-time code Aaron pasted into the earlier window is in that transcript (expires 24 h); treat it as exposed.
- An identity is not a seat: sia-builder and sia-infra AGENT.local.md say Forge / developer, which is why T-203 exists (the seat file is the single map, keyed by checkout basename). Do NOT edit another seat's untracked AGENT.local.md; each seat fixes its own once T-203 merges. The .git of this desktop is SHARED by every seat worktree: local branches of other seats (t194, t200, t164) are visible here and are not mine to push; push clearance is per branch.
- A developer never runs CI (D-061), no push without the planner's clearance for those branches, no PR unless told, and every push is read back with git ls-remote. Aaron speaks only to the planner (D-038).

### Open questions

- T-203 set seats.forge.cursor to false in hub-partner-seats.json (the forge seat is Claude Code now); the planner accepted it (it is true now).
- Session number 151 is used for this record write (the record's last session is 150 and this worktree's local counter would collide, T-164); the planner accepted it.
- T-163's /sync check (no close-out removes another seat's uuid) was not verified; T-199's note asked for it to be reconciled when T-199 lands.

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

_7 older handoff(s), superseded within their seat and checkout, are in state.json and not rendered here._

## Last session

Session 155 — 2026-10-01 — planner [sia-planner] — `6ed7ada0-65ef-43fe-83a5-1fd42c871777` (11 writing session(s) in the record)
