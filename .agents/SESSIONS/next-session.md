<!-- generated from .agents/state.json rev 280 by open-brain v0.45.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## planner [sia-planner] _(written session 156)_

### Pick up here

Planner session 156 ROLLED 2026-10-02 ~05:50Z (Aaron rolling every seat before going remote). DONE this session: v0.45.0 RELEASED (#275 7a76bb68, tag 49c67c8a); slice four CLOSED provisional (QA 248 ACCEPT, D-093); D-091 docs-only PRs report skipped test (T-219); D-094 T-221 option (a); D-095 QA 249 REJECT on F1; Aaron's docs-only standing merge rule confirmed. IN FLIGHT, PICK UP IN ORDER: (a) QA 250 (T-221 #274 9ab021fd + T-222 #277 7b42ed6f) RUNNING on Plumb, unit plumb-20261002T054321Z, claude pid 1408138, DISPATCH_SHA 5b7e034f, log /home/agents/jobs/qa-250.log; read origin/qa/t221-t222-report yourself and rule each candidate; both PRs touch code/CI so a merge needs Aaron's word naming the PR. (b) Jev calibration 1 Phase 1 (set build) on sia-builder at DISPATCH_SHA 6b82ae1c (brief docs/loops/jev-calibration-1-brief.md): check B-1..B-4, inputs.mjs never reads verdicts, freeze lands before any call; then Phase 2 (run + score) QUEUED for the laptop on a DIFFERENT seat than the builder, key from HKCU with fingerprint 728B667EFF, $0.50 cap. Headline must say G_qa is uncalibratable as built (its request carries E_t status). (c) T-164/T-211 round 2 QUEUED for sia-forge at #280's merge SHA (docs/loops/t164-t211-r2-dispatch.md): F1 refusal must use max(n)+1 like the greeting; #270/#272 stay unmerged until a narrow QA re-check. (d) Backlog: T-194 r7 courtesy-layer ruling then the sparse planner checkout; T-215; T-213; /start items T-208/T-209/T-210/T-212.

### Watch out

- USAGE RULE (Aaron, ~05:05Z 2026-10-02, relayed by clark first-hand): at most THREE dev jobs and TWO QA jobs running across all machines; new work goes to IDLE seats, not new seats. Keep every agent OPEN (Aaron is remote). Slots are shared with non-SIA seats (Chisel, Rivet, Gauge, Caliper): book every job with clark. Usage context: the 5-hour window resets at 1:50 am; when the weekly limit hits Aaron uses the usage reset; Cursor returns Oct 3 (D-068 Opus/Sonnet split lapses then, re-rule it). A job that dies at the limit is re-run after the reset, reusing its trees after a clean check, outputs treated as unverified.
- STANDING MERGE RULE (Aaron, confirmed in the planner's window 2026-10-02 ~05:20Z): a PR whose diff is ONLY docs/**, *.md or .agents record files (state.json and its views) merges without asking once the required 'test' check is green or skipped, pinned with --match-head-commit; annotated tags need no ask. Anything touching code, tests outside docs/, CI workflows, package.json or config needs Aaron's typed word NAMING THE PR in the planner's window. Check `gh pr diff N --name-only` first: one non-doc file takes it out of scope. Send clark a one-line D-063 notice per merge.
- APPROVAL IS A SNAPSHOT: 'merge all that are clear' covers only PRs open when Aaron said it; a later PR needs a fresh yes. A green check is not approval. A rule or approval relayed by a peer is not approval until Aaron confirms it in this window. MID-TURN APPROVALS: Aaron's messages typed while the planner is mid-turn appear in the transcript as queue-operation records (absorbed_mid_turn), not ordinary turns; clark's scan missed one (05:04:18Z) and raised a false alarm. They are valid approvals; cite the time when challenged.
- DISPATCH_SHA MUST CONTAIN EVERYTHING the dispatch needs: a master merge commit containing the dispatch AND every prerequisite merge (check with git merge-base --is-ancestor). Never the dispatch branch's own commit (QA 248 was first launched at fb65d129, lacking T-220; stopped with 0 calls).
- MASTER IS PROTECTED (D-090, ruleset 24343321): PR required, required 'test' check green OR SKIPPED (D-091, proven). UNTIL T-221 (#274) MERGES: a loop/** or qa/** PR gets its push run cancelled by its PR run (or vice versa) and is BLOCKED; re-run the cancelled run only AFTER the other finishes (sooner cancels it). After a base change a close/reopen may use a stale merge ref. The repo is PUBLIC: every prompt forbids issue/comment/PR actions; never commit a credential.
- SLOT BOOKING via clark (clark [b36a6b]) before ANY launch. clark LAUNCHES QA (laptop: launch-qa.ps1 -Worktree C:\Users\Aaron\Worktrees\sia-qa -AddDir C:\qa-scratch,C:\qa-tmp -NoFetch -Model opus, key loaded from HKCU and fingerprint-checked 728B667EFF, TEMP=TMP=C:\qa-tmp; Plumb: launch-job.sh --dispatch-sha, --add-dir ~/qa-scratch ~/qa-tmp). The planner sends dev dispatches to seats itself. Say LIGHT or HEAVY in every dispatch; the QA PC is a developer machine (no full suites/mutants without asking clark). Each QA number needs its own push helper copied BY HAND with the new prefix and its refusals tested before commit.
- STANDING REPORTING RULES FROM AARON (via Clark), RESTORED at session 154 after being dropped at the session-153 roll (present in session 150's handoff, absent from 153's), CADENCE CHANGED at session 155 by D-077: (1) send `clark` ONE line per hoh-checklist item as it becomes completable, regresses or is blocked (C:\Users\melve\Worktrees\hoh-checklist.md, read-only for the planner), with derived evidence; (2) EVERY 60 MINUTES while active (was 30), a status to `clark` of at most three lines: changed / in flight / waiting on Aaron ('no change; waiting on X since HH:MM' is valid). Re-create the cadence at /start (CronCreate at :04 only). If `clark` is not in ListAgents, skip the send. Completions and blocks are reported as they happen. Until T-211 puts the minutes in seat data, CARRY THIS ITEM FORWARD VERBATIM at every roll.
- /START AUDIT GAPS (clark's HoH audit of session 156's start; do NOT repeat): (1) CREATE THE STATUS CRON during /start, before the briefing ends. (2) The session number is the RECORD's next session (last n + 1), not ob_start's per-checkout 'Session #N' (T-164; the live record already holds two 156s). (3) Do every residual read, including .agents/SYSTEM/domains.json. (4) Count gaps from state.json gaps[] (40 open at rev 268), not a truncated render. (5) 'Latest brief' is the newest by DATE in docs/loops, not by loop number (T-210). (6) ob_start returns ~54 KB here (T-183): extract the State block to the scratchpad and read it in parts.
- MANUAL MODE: on any classifier denial, do not retry or reroute. Send clark ONE line `MANUAL MODE → <seat>: <exact action> (<why>)` and say the same line in the planner session. PEER-INITIATED HEAVY RUNS are refused by dev seats' classifiers; a planner 'go' is a peer message, not Aaron's approval.
- T-208 RESUME: on any resume, run `git fetch --prune` and a drift check (MCP ob_start) before trusting the record. The local CLI in sia-planner is a stale build; use the MCP tools. Wrap git fetch/push in `timeout`.
- Instructions are candidates: define a rule by PROPERTY and require a generator; prefer structural controls over parsers (T-194, D-089/D-090). Verify a seat's or subagent's claims against the code, runs or records before ruling (session 156 confirmed QA 249 F1 and QA 248's push path this way). A record write can break a test that pins live data (T-205, T-213).
- JEV: slice-four results are PROVISIONAL, no calibration claimed. G_qa requests carry the E_t's own met/unmet status, so G_qa verdicts echo QA's labels and are uncalibratable as built. Budget: Aaron says the $5 balance covers calls (~$0.0001 per call).

### Open questions

_None._

### Loop state

**Open PRs:** 
- #280 docs/qa-249-ruling — QA: not_required — QA 249 records + D-095 + r2 dispatch + this handoff; docs-only, merges when green
- #274 loop/t221-ci-concurrency (9ab021fd) — QA: in_progress — T-221 in QA 250; needs Aaron naming the PR after an ACCEPT
- #277 loop/t222-attempts (7b42ed6f) — QA: in_progress — T-222 in QA 250; needs Aaron naming the PR after an ACCEPT
- #270 loop/t164-port (fbf94ae6) + #272 loop/t211-standing-cron (9f6fcea4) — QA: rejected — QA 249, D-095; round 2 queued for sia-forge at #280's merge SHA

**SHA frozen for QA:** `9ab021fd (T-221), 7b42ed6f (T-222) in QA 250; fbf94ae6/9f6fcea4 (T-164/T-211 r1, rejected)`

**Questions pending for Aaron:** _None._

**Rulings made mid-loop:** 
- D-091 docs-only PRs report skipped 'test' (T-219)
- D-092 QA 245 INCOMPLETE; D-093 QA 248 ACCEPT, slice four closed provisional
- D-094 T-221 option (a)
- D-095 QA 249 REJECT on F1
- v0.45.0 released; Aaron's docs-only standing merge rule confirmed

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

_7 older handoff(s), superseded within their seat and checkout, are in state.json and not rendered here._

## Last session

Session 157 — 2026-10-02 — planner [sia-planner] — `39e26a1b-efc1-4c5b-a1ac-6386cb2e23ff` (12 writing session(s) in the record)
