<!-- generated from .agents/state.json rev 456 by open-brain v0.45.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## planner [sia-planner] _(written session 170)_

### Pick up here

Session 170 (Atlas) ROLLED 2026-10-13 ~22:1x CDT on Aaron's 'ready to roll? run end after you write your handoff', after a MAX USAGE night (Aaron 01:20Z/01:24Z, verified). DONE tonight: the SIA train (#678 T-159, #673 T-243, #685 T-275, #688 T-161) merged, main rebuilt 7d9215b2, live checks PASS, closed; T-274 measured and merged (#699) and ruled into T-286; 14 briefs and 2 amendments landed. FIRST: review the 7 READYs first-hand, one at a time (clark's copy of each reply is ~/Worktrees/<tag>-reply.md; then pr-src-diff.sh <pr>): T-269 #702 a5eec8d9, T-277 #704 5baed1b5, T-282 #703 ba38d32e (tests only: SG-1 merges it on green CI after the planner's ACCEPT), T-266 #701 ee701cf3, T-273 #697 9b6e76c5, T-271 #708 39adb0b4, T-281 #707 ac4e7b3f. For each code PR: the planner's ACCEPT, plus an Opus second review if wanted (clark launches a review-body file on the QA PC; %TEMP%/t272-opus-review-body.md is the template), then Aaron's word naming the PR via clark; merge one at a time with pr-refresh.sh before each, then one sia-rebuild and the live checks. T-272 #705 bc0d5991 has the planner's ACCEPT; its Opus review is RUNNING (reply to ~/Worktrees/t272-review-reply.md); then ask 'merge SIA #705'. RUNNING on the QA PC: T-172 r3 (PR #676), T-276, T-286. BLOCKED, then amended: T-283 (#698) and T-279 (#700), both on S4-9.2; amendment-1 for each is in docs PR #711; clark merges it and launches both r2s. The desktop rule stands: no npm, vitest, tsc or build on the desktop; at most 2 research-only subagents.

### Watch out

- Aaron (via clark, 2026-10-13 ~20:5x CDT): the desktop CPU hit 100%. Run NO npm, vitest, tsc or build on the desktop; at most 2 subagents, research only; a brief that needs a pre-ship simulation sends clark a SIM line (repo, sha40, folder, exact command, what to report) for the QA PC, or ships without it.
- Overlaps managed tonight: T-283 got its own module and test file to stay clear of T-269's cli-suite-run.ts import (line 22) and its suite-run-meta.test.ts rows; T-281 must not touch start-report.ts or transcript-check.ts (T-276's hunks); T-266 does not edit db-v2.ts (T-273 does); T-276 and T-271 touch server.ts in different functions. The second of two neighbouring PRs to merge may still need a conflict fix at its refresh.
- S4-9.2 (tests/harness/s4-guards.test.ts, ruled session 157) forbids any added skip, todo, skipIf or runIf under open-brain/tests. A platform-specific row branches inside itself (const win = process.platform === "win32", as tests/pipelines/sync/mcp-command-paths.test.ts does) and asserts something true on each platform. T-283 and T-279 each lost a round to briefs that said skipIf/runIf.
- Master has no branch protection: records and docs PRs merge by hand (clark's docs-merge.sh, or pr-keep-current.sh for a CLEAN .agents/docs-only PR, pinned; it exits 2 when it gives up after 30 min; read its exit unpiped, because a '| tail' wrapper reports tail's 0). Code PRs need Aaron's word naming them.
- Merges go one at a time: pr-refresh.sh just before each PR's own merge. A records or docs PR that merges between a refresh and its merge breaks clark's merge-tree gate, so land docs and records only in the gaps.
- SG-1 (D-135): config, rule-text and tests-only PRs merge on green CI pinned to the head, with no QA gate and no Aaron word. Code needs a QA ACCEPT from a judge other than the builder, and Aaron's word too.
- Write handoff open questions and watch-outs as plain strings until T-282 lands: state-render.test.ts T183-3 reads the live record and fails CI on the object form.
- Every running seat's open-brain server predates the 7d9215b2 rebuild: /mcp reconnect open-brain is Aaron's act (clark is asking him).
- Dry-run every post-merge live-check script against the pre-merge build: each new-behaviour check must FAIL there (knowledge 694; tonight's t161-livecheck failed check 2 on c1975286 and passed on 7d9215b2).
- A launch line sent is not a launch: record a task in_progress only after clark says LAUNCHED or RUNNING (tonight's twelve were recorded only after clark confirmed all twelve RUNNING; t283's first launch aborted before cloning).
- Verify every relayed merge word in clark's transcript with relay-check.mjs (literal by default); approval is a snapshot of the PRs he named.
- T-270's mechanism: Windows PowerShell 5.1's console cp437 best-fit turns arrows and bullets into raw C0 bytes on the pipe to Node (knowledge 693; entry 685 is falsified: forget it only on Aaron's word).
- The repo is PUBLIC (D-090): transcripts, command text, paths and session ids stay outside it. The s170 live-check scripts live in ~/Worktrees/s170-livechecks/.

### Open questions

- Planner: does T-161's NO TRANSCRIPT line false-alarm on Cursor seats? T-281 (READY, #707) withholds an ide:cursor proof's transcriptPath until one live Cursor /start proves the file exists at the first tool call.
- Planner, D-148 data point: the recall trigger injected entry 299 (pipe-to-tail masks the exit code) right after the planner made that mistake, and the planner re-ran the command unpiped. One observed case of an injection changing the next act, not a measurement.

### Loop state

**Open PRs:** 
- #676 — QA: in_progress — T-172 r3 (amendment-2) RUNNING on the QA PC
- #705 — QA: accepted — T-272 at bc0d5991: planner ACCEPT; Opus second review RUNNING; then ask merge SIA #705
- #702 — QA: in_progress — T-269 READY a5eec8d9, not yet reviewed by the planner
- #704 — QA: in_progress — T-277 READY 5baed1b5, not yet reviewed
- #703 — QA: in_progress — T-282 READY ba38d32e, tests only (SG-1), not yet reviewed
- #701 — QA: in_progress — T-266 READY ee701cf3, not yet reviewed
- #697 — QA: in_progress — T-273 READY 9b6e76c5, not yet reviewed
- #708 — QA: in_progress — T-271 READY 39adb0b4, not yet reviewed
- #707 — QA: in_progress — T-281 READY ac4e7b3f, not yet reviewed
- #698 — QA: in_progress — T-283 r1 BLOCKED on S4-9.2 at 96f72acf; amendment-1 in docs PR #711, r2 to launch
- #700 — QA: in_progress — T-279 r1 BLOCKED on S4-9.2 at 77313347; amendment-1 in docs PR #711, r2 to launch

**SHA frozen for QA:** _None._

**Questions pending for Aaron:** 
- merge SIA #705 (T-272), after its Opus review comes back
- after T-172's amendment-2 and its READY: merge SIA #676
- T-194: (a), (b) or (c); planner recommends (c) now, (b) later
- T-024 (P0): may the planner rewrite knowledge entries 184 and 303 (they cite deleted knowledge-mcp paths) to say 'retired'?
- may the planner ob_forget knowledge entry 685 (its mechanism is falsified; 693 corrects it)?
- /mcp reconnect open-brain in every running seat (servers predate the 7d9215b2 rebuild)
- optional: manual relocate --from/--to for the pruned worktrees sia-infra (14 sessions) and a2a-rivet (1): sessions only, no knowledge
- via clark: one shared fetch-first docs/records PR script set instead of a new prism-ops; do factual CLAUDE.md seat-table edits need his word in the seat's window?

**Rulings made mid-loop:** 
- 2026-10-14 01:20:41Z and 01:24:41Z Aaron (clark's window, relay-check verified): 'Weekly is about to reset. Let's use as much as we can before the reset.' and 'All planners have been rolled, idle, ready to work. GO GO GO!'
- 2026-10-13 ~20:5x CDT Aaron (told via clark): the desktop CPU is at 100% ('this pc can't handle parallel agents'): no npm, vitest, tsc or build on the desktop; at most 2 subagents
- 2026-10-13 21:33:00Z Aaron (clark's window, relay-check verified): 'SIA merges #678/#673/#685/#688 · A2A v1.22.14 release, go' (all four merged tonight)
- s170 planner: T-172's Opus review ruled, every finding accepted (amendment-2, #691); T-266 ruled (A), refuse; T-269 keeps W2 (the census counts alarm run_too_long and orphan_run as busy); T-274 changes no src (a floor change is a separate PR); T-280 closed as done by T-267
- s170 planner: T-196 HB-1, e21e71af not merged (stale); rewrite when the Cursor seats are back
- s170 planner: T-251's install-commands allowlist question ruled no change; T-161's review findings went to T-281
- s170 planner: T-286 ruled option (B): the status element carries "tail", so every asking query is "tail" "exit" "code" and the floor stays 8.0 (margin 5.81); S4-9.2 stands, and T-283 and T-279 were amended to branch inside the row

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

_9 older handoff(s), superseded within their seat and checkout, are in state.json and not rendered here._

## Last session

Session 171 — 2026-10-14 — planner [sia-planner] — `13042431-247e-4dad-9477-507e43fc7916` (14 writing session(s) in the record)
