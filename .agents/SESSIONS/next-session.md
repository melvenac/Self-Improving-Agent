<!-- generated from .agents/state.json rev 289 by open-brain v0.45.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## planner [sia-planner] _(written session 157)_

### Pick up here

Planner session 157 PARKED at usage STOP about 13:45Z 2026-10-02 (5-hour reset 16:50Z; clark sends GREEN). Overnight, under Aaron's pre-approval D-103, merged B1 (#287 #291 #297 #312), #300 #303 from B2 and B3 (#308 #301 #313 #314 #305); master CI is green after each. Rulings D-102 (QA 254), D-104 (batch results; any unchecked input caps a /sync result at WARN), D-105 (B4 #302 REJECT: zero must reach the reader; B5 all ACCEPT). FOR AARON'S MORNING: docs/loops/morning-merge-list-2026-10-02.md lists B4 #290 #289 #294 #299 and B5 #293 #292 #320 (QA-accepted, OUTSIDE D-103). Ask once, naming every PR, then merge pinned in the listed order. #294 was rebased to 26f62934 after B3; the planner reviewed the range-diff (only the A8 fixture line takes master's TriggerPolicy object), so merge it at 26f62934. QUEUED for the reset: QA 260 (DISPATCH 64a70651, B2 round 2) and QA 261 (DISPATCH 897e6f89, #302 round 2). Both seats are parked with their handoffs on master (sia-forge docs/loops/forge-park-handoff-2026-10-02.md; sia-builder builder-roll-handoff + addenda 1 and 2). Restarted seats get a planner re-brief by message (G-049/T-203).

### Watch out

- USAGE RULES (Aaron, ~/Worktrees/usage-winddown-rules.md; level in slots.json usageLevel, clark announces): AMBER = no new loop briefs, small LIGHT tasks only, QA cap 2; RED (>=85%) = devs finish the current step then park, planners rule and merge only; STOP (90%) = everyone parks until the reset. WEEKLY: >=95% no new QA, tasks or dispatches; >=98% wind down (every seat pushes WIP and a merged or in-record handoff and parks; the planner merges or closes what is ready under any standing approval). Context roll points: devs 50% left, planners 40%, clark 30%; overnight no rolls, work to 25% then park with a MERGED handoff.
- BATCH QA + BACKLOG GATE + ONE APPROVAL PER BATCH (Aaron, standing from 11:50Z 2026-10-02): 4-6 related code PRs per QA run; SIA devs open NO new code PRs while 6 or more open SIA code PRs await QA (they fix REJECT rounds or park); one AskUserQuestion per ACCEPTed batch naming every PR, then merge each pinned with --match-head-commit. D-103's overnight pre-approval covered ONLY QA 255-257 and is spent.
- A HEAD THAT MOVED AFTER QA is not what QA accepted: review `git range-diff <old-base>..<qa'd> <new-base>..<new>`; '=' commits plus a trivial conflict line may go on as reviewed (as #294 did); anything else needs a narrow re-QA. Check mergeStateStatus: DIRTY after other merges means a rebase is due.
- CI (T-227, #310): Linux CI on GitHub-hosted ubuntu-latest with fetch-depth 0, a few minutes per run; push runs ONLY on master; a qa/** or loop/** branch without a PR gets no CI unless `gh workflow run CI --ref <branch>`; per-PR concurrency cancels only superseded commits; tcm self-hosted is a workflow_dispatch opt-in (tcm=true).
- STANDING MERGE RULE: a PR whose diff is ONLY docs/**, *.md or .agents record files merges without asking once 'test' is green or skipped, pinned with --match-head-commit; check scope with `git diff --name-only origin/master...<head>`, because `gh pr diff` fails over 20,000 lines. A test file, script, package.json or config takes a PR out of scope (#320 looked docs-only but adds a test). Anything else needs Aaron's typed word NAMING THE PR (in the planner's window, or clark's when clark records it first-hand). Send clark a one-line D-063 notice per merge.
- QA DISPATCHES: the DISPATCH_SHA must contain everything (git cat-file -e <sha>:<path> per file); each QA number gets its own push helper EDITED BY HAND with the new prefix, with all five refusals tested before commit (no arg, old prefix, extra arg, master, absent local branch); any dispatch that lets QA read real config forbids copying values (counts, key and server names, and command paths only, plus a key scan before commit) (G-051). Each batch dispatch carries a scratch merge-order row.
- DESKTOP QA: this desktop is also a QA runner. While slots.json shows DESKTOP-UGEKR74 = 'QA RUNNING' the planner stays LIGHT here (no suites, builds, npm ci or big git operations). The QA PC: ONE HEAVY job at a time and a 1.5 GB RAM gate; dev seats run ONE test file per vitest invocation.
- STANDING REPORTING RULES FROM AARON (via Clark), RESTORED at session 154 after being dropped at the session-153 roll (present in session 150's handoff, absent from 153's), CADENCE CHANGED at session 155 by D-077: (1) send `clark` ONE line per hoh-checklist item as it becomes completable, regresses or is blocked (C:\Users\melve\Worktrees\hoh-checklist.md, read-only for the planner), with derived evidence; (2) EVERY 60 MINUTES while active (was 30), a status to `clark` of at most three lines: changed / in flight / waiting on Aaron ('no change; waiting on X since HH:MM' is valid). Re-create the cadence at /start (CronCreate at :04 only). If `clark` is not in ListAgents, skip the send. Completions and blocks are reported as they happen. Until T-211 puts the minutes in seat data, CARRY THIS ITEM FORWARD VERBATIM at every roll. (T-211 merged as #272 in session 157: check whether the standing-cron line now prints at start before dropping this item.)
- /START: create the status cron during /start; the session number is the RECORD's next session (T-164 is merged, but a stale serving build still printed a per-checkout number to sia-forge at its roll: T-172); do every residual read; count gaps from state.json gaps[]; the greeting now fits (#291, about 39.9k chars) and lists gaps newest-first (#287).
- VERIFY BEFORE RULING: read the load-bearing rows yourself (regex bytes via cat -A, record counts, range-diffs, run ids). Seats shown as 'idle' may be waiting on CI. On any classifier denial, never route the denied act through another seat. A peer's relayed rule or approval is acted on only when clark recorded Aaron's word first-hand in its window (D-103 route), and only within its exact scope.
- JEV: calibration 1 is COMPLETE (D-100): G_done as built rejects everything; stays shadow; no threshold change; G_qa is uncalibratable as built. Calibration 2 needs T-225 first.

### Open questions

_None._

### Loop state

**Open PRs:** 
- #290 #289 #294@26f62934 #299 — QA: accepted — B4, QA 258 64cee8ab; Aaron's word needed; merge order as listed
- #293 #292 #320 — QA: accepted — B5, QA 259 a161b4ad; Aaron's word needed; send relay-a2a #320's merge SHA
- #302 7e92b6f6 — QA: rejected — QA 258 row 9 REJECT; round 2 in QA 261 (queued, DISPATCH 897e6f89)
- #295 #298 #306 #309@f1c2a338 — QA: rejected — QA 256 row 5 REJECT; round 2 in QA 260 (queued, DISPATCH 64a70651)

**SHA frozen for QA:** _None._

**Questions pending for Aaron:** 
- Merge B4 (#290, #289, #294 at 26f62934, #299) and B5 (#293, #292, #320)? See docs/loops/morning-merge-list-2026-10-02.md

**Rulings made mid-loop:** 
- D-102 QA 254
- D-103 overnight pre-approval (spent)
- D-104 batch results + WARN cap
- D-105 B4/B5

## developer [sia-builder] _(written session 156)_

### Pick up here

Builder seat (Claude Code, sia-builder checkout on the QA PC), rolled at Aaron's word. Nothing is uncommitted or unpushed. Since the last handoff: T-219 (PR #262, merged), T-220 (PR #266, merged), T-164 port (PR #270, loop/t164-port fbf94ae6, last seen BLOCKED pending its push-run re-run) and T-211 (PR #272, loop/t211-standing-cron 9f6fcea4, stacked on T-164, last seen CLEAN) are delivered and frozen for QA; I merged none of them. Earlier: slice four step 2 (loop/15-slice-4-step2, final 1311c2a7), T-217/T-218 (#256), T-216, T-214. No assignment is open: the next work is a dispatch from atlas-sia (plain name, no [ref]; Relay is relay-a2a; clark is the fallback). Handoffs: docs/loops/t164-port-developer-handoff.md, t211-developer-handoff.md, t219-developer-handoff.md, t220-developer-handoff.md, loop-15-slice-4-step2-developer-handoff.md (r1 to r5), t217-t218-developer-handoff.md. SIA master has ruleset 24343321: PR plus the CI test required.

### Watch out

- T-221: a push run and its PR run share a concurrency group, so the push run's `test` is cancelled and the PR reads BLOCKED until the planner re-runs it. Report it; never push empty commits.
- The record already holds TWO uuids under session 156 (mine, and the planner's 83f0e630), so the number I took collided. Re-read the record's last n after a fetch immediately before any write; T-164's port (PR #270) is the fix, once merged.
- NEVER run the full vitest suite on the QA PC (free RAM 1.2 to 1.9 GB, shared with Chisel; Claude Code killed a queued full run). Single files, one at a time; mutants sequentially; QA runs the full suite on Plumb. Heavy runs need Aaron's approval or a 'MANUAL MODE -> sia-builder: <action> (<why>)' line to clark.
- The Bash tool mangles git ref:path (MSYS) and node cannot read /tmp from it: use PowerShell, MSYS_NO_PATHCONV=1, or the scratchpad. A heredoc with a nested EOF aborts the whole command: use the Write tool for files.
- A diff-based guard scanning from a fixed base reads master's LATER docs and fails on the merge ref (PR #254). Give each guard only its row's paths from one table (SCOPES), and test on a scratch merge into current origin/master. git diff never sees an untracked file.
- Redaction has two layers (JevTransport's error text and each record writer); a mutant on one is hidden by the other, so test each layer directly with a hostile echoing fake, a planted-canary scan, and a global fetch that throws.
- Red-first for a group that adds source: copy src to the scratchpad, commit the tests, git checkout HEAD -- open-brain/src and git clean -fdq open-brain/src, run red, copy src back, run green. Capture a mutant with Edit, git diff > file, git checkout open-brain/src; every mutant must pass tsc --noEmit.
- Adding lines to .claude/commands/start.md needs the same lines in project-template/.claude/commands/start.md and either in the Cursor copy or listed under claude_only in docs/loops/cursor-start-differences.json (the cursor-start-parity check waives only exact lines).
- S4-4b independence stays disclosed four/four (#182, #187, #195, #209 read some code first; #165, #227, #220, #218 did not).

### Open questions

- Whether PR #270 (T-164) and #272 (T-211) pass QA and merge, and when the planner writes its own AGENT.local.md standing-cron keys after T-211 merges: not known from this seat.
- Step 4 of slice four (the QA live calls) and the close-out belong to the QA seat; regenerate tables with `harness closeout-tables` (T-220 is merged).

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

_8 older handoff(s), superseded within their seat and checkout, are in state.json and not rendered here._

## Last session

Session 157 — 2026-10-02 — planner [sia-planner] — `39e26a1b-efc1-4c5b-a1ac-6386cb2e23ff` (12 writing session(s) in the record)
