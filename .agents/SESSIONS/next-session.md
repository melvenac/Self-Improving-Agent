<!-- generated from .agents/state.json rev 210 by open-brain v0.44.2 — do not edit; change state via ob_state -->

# Next Session Handoff

## planner [sia-planner] _(written session 150)_

### Pick up here

Planner session 150 ROLLED (2026-09-30, about 09:10Z; Aaron rolled atlas, relay and clark). Master c2a5eaa, green. START HERE: (1) QA 232 (C r4) REPORTED ACCEPT: origin/qa/c-r4-report b43e719b. It is NOT ruled; read the whole report, rule on CC-22 (QA asks met vs partial; the only CI failure is the base-shared T-171 r3b), then shadow-verdict prepare before Aaron merges #195 (T-155 note). (2) Launch QA 233 (T-194 r2) YOURSELF over ssh (D-069), with the same launcher as QA 232: git show <master>:docs/loops/qa-233-headless-prompt.md > C:\qa-tmp\qa-233-headless-prompt.md, then launch-qa.ps1 -Worktree C:\Users\Aaron\Worktrees\sia-qa -Prompt ... -Log C:\qa-tmp\qa-233.log -AddDir C:\qa-scratch,C:\qa-tmp -NoFetch -Model opus. The laptop is idle. Read the log's LAST line for the verdict. (3) PR #227 (T-198 r2 merged with master, b8a6004) REPLACES #223. Aaron's word 'merging #223 (T-198 r2)' covers it; the planner verified the code cmp-identical to QA 230's (comment on #227). Merge it on CLEAN, pinned (it was UNSTABLE at the roll with CI running), close #223, read master's own run. (4) Then QA for the queue, serial on the laptop: T-200 (424065c), T-201 (8952266), T-207 (f3e64f1), T-203 (a5a1206), T-199 (621d49e), T-204 (d5b3623); dispatches not written yet. Seats (QA PC, Claude Code Sonnet, via Remote Control): sia-builder is on standby (T-208 after T-200 merges); sia-forge was told to plan T-202 and was offline at the roll (the message is queued). Forge's hub turn as forge was DENIED by its classifier; it is Aaron's to run with ! in the sia-forge window. After it, tell Relay, and strict (D-063) waits only on that plus #227.

### Watch out

- STANDING REPORTING RULES FROM AARON (via Clark): (1) send `clark` ONE line per hoh-checklist item as it becomes completable, regresses or is blocked (C:\Users\melve\Worktrees\hoh-checklist.md, read-only for the planner), with derived evidence; (2) EVERY 30 MINUTES while active, a status to `clark` of at most three lines: changed / in flight / waiting on Aaron ('no change; waiting on X since HH:MM' is valid). Re-create the cadence at /start (CronCreate at :04 and :34). If `clark` is not in ListAgents, skip the send.
- REMOTE CONTROL must be ON in the planner session (/remote-control, then /rename atlas). The QA PC seats are reached only by their Remote Control names (sia-builder, sia-forge); native A2A does not cross machines. Remote Control gives no read receipts: silence is unknown, not working. A seat's report can fail to deliver and be resent.
- D-069: the planner LAUNCHES QA itself over ssh. Dispatch on master first, idle machine only, one QA job at a time on the laptop, recorded. A classifier denial is surfaced, never routed around.
- D-068 until 2026-10-03: planner Opus, devs Sonnet, QA Opus headless; Cursor is BLOCKED (usage limit), Composer included. Headless `claude -p` QA: the model's turn IS the job; prompts must forbid background commands (QA 232's first attempt died of it). The log is empty until the job ends; the verdict is the last line.
- QA PC CAPACITY (Clark, at the roll): 8 GB RAM, and SSH resets under load; run at most 3 seats there. The laptop takes one QA job at a time.
- Master-red lesson (T-205): a record write can break a test that pins live record data. After every merge, read master's OWN run. Code merges one at a time, with master green in between.
- A code merge needs Aaron's yes IN THE PLANNER SESSION; relays are fine for reversible acts. update-branch or a merge-branch replacement rides on his merge word for that PR, verified by a merge-base cmp against the QA'd code.
- Until T-207 merges, every developer or QA mutant-branch push starts a tcm run; cancel loop/*-mut-* runs by hand when the queue backs up.
- Fetch with --prune before asserting a remote branch exists or not (rev 196). T-208 fixes /start's stale-fetch 'level'.
- The serving MCP build (main tree) predates T-158: the first close_gap tombstone on master blinds unrebuilt builds (T-172). Choose explicit uncited gap ids (G-046..048 are cited).

### Open questions

- Aaron: run Forge's hub turn with ! in the sia-forge window (its classifier denied it): HUB_URL=http://100.124.212.87:4000 node "C:/Users/Aaron Melven/Projects/A2A-Hub/scripts/hub-talk.mjs" --as forge --session k57frxw0ptb8tadmqdwy0khhks8ey006 --say "Forge registered as forge from the QA PC"

### Loop state

**Open PRs:** 
- #195 loop/15-slice-3-candidate-c (0dc20ff) — QA: in_progress — QA 232 reported ACCEPT (b43e719b); planner ruling pending (CC-22)
- #227 loop/t198-merge (b8a6004) — QA: accepted — replaces #223; Aaron's merge word; verified cmp-identical; merge on CLEAN
- #223 loop/t198-presence (a40fc77) — QA: accepted — close when #227 merges

**SHA frozen for QA:** `c339427 (C r4, QA 232 done); 699789e1 (T-194 r2, QA 233 not launched)`

**Questions pending for Aaron:** 
- Forge's hub turn (his ! in the sia-forge window)

**Rulings made mid-loop:** 
- Merged in session 150 on Aaron's word: #218 (T-158), #222 (TG-2), #220 (T-196+T-197); docs-only: #217, #219, #221, #224, #225, #226
- ACCEPTED: QA 227, QA 228, QA 230; QA 231 VOID; QA 232 reported ACCEPT, not ruled
- Opened T-201..T-208, D-064..D-069, G-049; seats moved to the QA PC

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

_4 older handoff(s), superseded within their seat and checkout, are in state.json and not rendered here._

## Last session

Session 153 — 2026-09-30 — planner [sia-planner] — `6e083614-965f-462b-ad59-62091a0be5e1` (9 writing session(s) in the record)
