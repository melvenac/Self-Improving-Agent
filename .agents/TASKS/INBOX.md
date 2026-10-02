<!-- generated from .agents/state.json rev 269 by open-brain v0.44.2 — do not edit; change state via ob_state -->

# Inbox

Legend: `[ ]` open · `[~]` in_progress · `[!]` blocked

Titles only. Full rationale for a task is its `note` in `.agents/state.json` under `tasks[]` — read it when you work the task, not when you pick one.

## P0

- [ ] **T-008** Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [ ] **T-014** Make point-of-use rating reachable
- [ ] **T-022** Replace-on-write for `state` facts
- [ ] **T-023** Improve state-side classifier precision
- [ ] **T-024** Rewrite the two genuine `obsolete-reference` hits
- [ ] **T-025** Reconcile the experience `type` field across three sources
- [ ] **T-031** Add agent attribution to sessions
- [ ] **T-034** Move the session-start recall into `cli-bootstrap`
- [ ] **T-042** Vault pollution has a preventer but no detector
- [ ] **T-044** The slot needs an OWNER, not just a timestamp
- [ ] **T-046** Cursor + Git Bash: PowerShell hook wrapper fail-closes every tool
- [ ] **T-160** Hub transport: make silence unambiguous (push or long-poll), a Stop-hook seat wake, per-agent keys
- [ ] **T-163** Close-outs must APPEND a per-seat record, not overwrite a shared slot — plus a /sync check that no close-out reduces the recorded seat-uuid count for an open loop
- [ ] **T-164** The session counter is per-worktree, so a seat can close out on a number that collides with the record's sequence
- [ ] **T-167** The scope layer did not travel: PRD/DECISIONS/ENTITIES were untracked, so no seat worktree had them — tracked at session 77; make prd-version an ISSUE, and render the problem statement at /start
- [ ] **T-194** Planner seat hook: a tracked PreToolUse hook mechanically refuses the planner's out-of-boundary acts (source/tests/hooks/build writes, hand edits to rendered views, git merge/push/tag without per-occasion authority), fails closed, and names the rule it enforces
- [ ] **T-196** The hub procedure is tracked knowledge: each seat's hub room and hub-talk invocation in a tracked data file beside .agents/SYSTEM/worktree-seats.json; a short 'Talking to Cursor seats' section in planner.md (printed in full at /start) pointing at it; a tracked alwaysApply .cursor/rules hub rule; and Cursor's /start joins the seat's room and reads unread atlas turns before proposing anything
- [ ] **T-197** Cursor's /start matches Claude Code's /start except for documented tool-call differences, and /sync fails on any other difference: it reads ob_start's State block, never hand-edits rendered views, lets ob_start create the session log, and presents NEXT as a ranked backlog rather than a proposal
- [ ] **T-198** ob_start prints one line per partner seat from the hub's presence endpoint (listening or not, unread turns and since when), and says so visibly when the hub is unreachable, never silently
- [ ] **T-200** A seat started from a stale tree is briefed from STALE state: when the local record is older than origin/master's, ob_start renders the State block and the role files from origin/master (git show) and says so, so D-062 holds at every /start
- [ ] **T-201** A developer or QA seat's /start names its assignment, read from the record, or says 'no assignment' explicitly; it never stops at the backlog
- [ ] **T-208** A session start FETCHES before it judges currency: the SessionStart hook runs `git fetch --prune origin` (bounded timeout) before tree-currency and ob_start, says so visibly when it fails, and never calls a tree 'level' against a fetch it did not just make
- [ ] **T-219** ci.yml: docs-only PRs report 'test' as Skipped instead of no check (D-091)
- [ ] **T-221** ci.yml concurrency: a push run cancelled by its branch's PR run leaves a CANCELLED `test` on the head SHA, which ruleset 24343321 reads as failing (BLOCKED)

## P1

- [ ] **T-048** Audit remaining filters in `open-brain/src` for bare `continue`/`filter` drops (supersedes T-049)
- [ ] **T-050** v0.15.1 made a foreign `.recalled-entries.json` writer unreachable *and* uncountable
- [ ] **T-051** Add a `/sync` validator for the `.agents/skills/` frontmatter contract, asserting all three identity sources agree
- [ ] **T-055** GitNexus's incremental analyze is unreliable on this repo
- [ ] **T-061** Collect shadow-recall sessions
- [ ] **T-065** Port `cli.ts` off the v1 database, then repoint `paths.knowledgeDb`
- [ ] **T-067** Close the remaining 153 open checkboxes across session logs
- [ ] **T-091** v0.7.1 .gitignore patch
- [ ] **T-093** Archive Atlas-Forge mailbox thread
- [ ] **T-146** Run the recency sweep at 0.01 / 0.02 / 0.04
- [ ] **T-148** The note is required before you RETIRE a task, not only before you work one
- [ ] **T-152** The test suite is not type-checked at all
- [ ] **T-154** Give /start a memory-free documented route, and make the SessionStart hook installable by a stranger
- [ ] **T-159** The trigger's cheap not-asked path — record a not-asked fire without opening the store
- [ ] **T-161** /start must assert a transcript exists for the session's own uuid — the CLAUDE_CODE_CHILD_SESSION check would be a permanent false positive
- [ ] **T-166** GitNexus impact() missed a call site on the exact path under repair while reporting epistemic 'exact' - the MUST-run-impact rule is only as good as the resolver
- [ ] **T-168** 'Run the full suite alone' must become a check: assert peer idleness before the run and refuse or flag when a peer is busy
- [ ] **T-170** Memory is LOOKUP by default and INJECTION only on a deterministic match against the act; fix the WRITE side first, so every stored lesson carries the key (command pattern, path or error string) that would have caught the mistake
- [ ] **T-172** The main tree serves every session and nothing says when it is behind master: the greeting must print the SERVING build's distance from origin/master, and one refusing command must update, rebuild and verify it
- [ ] **T-173** Per-stage effort chosen by a deterministic policy, with Jev in shadow. Sequenced AFTER candidate A (it needs ProcessRole)
- [ ] **T-176** gitnexus-index measures distance in one direction only: an index on a different line of history reads as current
- [ ] **T-179** Replace /end with a small 'store lessons' step: each session's lessons stored with the key that would have caught them (T-170); the record is written as work happens, and the rest of /end is cut
- [ ] **T-181** Adopt Aaron's active projects onto SIA per docs/loops/adoption-plan-2026-09-25.md: frogger (fresh install) and co-op-mailer (import) as pilots, then Tarrant County Makerspace record-only BEFORE its cutover (D-048), then foundry and worth-it-window-washing
- [ ] **T-182** The claude adapter passes --permission-prompts, which tcm's installed Claude Code lacks (2.1.282 on the QA PC has it): declare a minimum Claude Code version, make CA-9 name the installed and required versions, and decide whether tcm's claude is updated
- [ ] **T-183** ob_start's greeting has grown about 7x since V-025 (2,142 words at rev 14; about 14,900 words, 92,131 characters, at rev 121) and no longer fits one tool result: render gaps and verified by TITLE, as tasks already are
- [ ] **T-187** /sync rebuilds the GitNexus index when it is behind (D-049): plain /sync runs analyze where a .gitnexus exists and the indexed SHA is not HEAD, then verifies the new SHA; sync --check stays read-only; a tree with no index stays SKIP (never PASS)
- [ ] **T-191** Per-seat greeting profiles: ob_start renders what each seat needs, from a data file, and names every section it omits
- [ ] **T-199** A seat session that wrote the record but left no handoff is DETECTED at that seat's next /start, and planner.md's stale 'one handoff slot, C2 unfixed' paragraph is corrected (the per-seat slot exists since schema v3)
- [ ] **T-202** The planner learns when a seat comes online: each seat worktree's SessionStart reports seat, checkout SHA, record rev and runtime (Claude Code or Cursor CLI) to the planner seat, deterministically
- [ ] **T-203** A seat is resolved by its CHECKOUT, not by AGENT.local.md's identity: one tracked map from worktree to seat, role and hub name, used by every per-seat lookup (presence key, readers row, handoff attribution, seat-online report)
- [ ] **T-204** A compute lease on the QA PC: a developer suite and SIA's qa-queue.ps1 each take one lease file before a run, so QA never starts over a developer suite and a developer suite never starts over QA; stale leases (expired, or owner process gone) are reclaimed
- [ ] **T-207** CI must not run on developer mutant branches: a push to loop/*-mut-* (and other not-for-merge mutant refs) starts a tcm run that is never evidence and starves QA and PR runs
- [ ] **T-209** ob_start renders BROKEN gaps newest-first
- [ ] **T-212** SessionStart missing-handoff check attributes commits by Claude-Session trailer, not git identity
- [ ] **T-213** Repoint the forge seat in hub-partner-seats.json to hub_name forge, room k571c0nz, and un-pin the tests from the live file
- [ ] **T-215** Finish the maturity-lifecycle cut in code: 10 LIVE referrers R-011 now records as owed, including two tests that prove nothing
- [ ] **T-220** closeout-tables: label 'no E_t' only when no E_t exists, 'not called' separately; G_plan writes repo-relative paths (QA 245 F2, F4)

## P2

- [ ] **T-101** Commit the entry-455 archive move as one commit
- [ ] **T-102** Distil and sanitise the v1 stores into v2, then retire the v1 vault
- [ ] **T-103** Retire the mailbox as *transport*, keep it as *archive (supersedes T-104)
- [ ] **T-114** Update /start monthly maintenance
- [ ] **T-156** A scan that matches the sentence forbidding a thing, as though it were the thing (G-040): every source-text scan in the harness tests must be validated against a known positive and a known negative in the same test, or replaced by a parser
- [ ] **T-162** The element table's growth rule: the store cannot be consulted for act shapes the table does not name
- [ ] **T-165** Evaluate an alternate harness/model as the DEVELOPER seat via T-155's shadow merge gate — the driver is a SECOND METER, not cost; Aaron's named candidate is DeepSeek v4.1 Flash
- [ ] **T-171** update_task REPLACES a task's note, and neither the dry run nor the write says so: an op written to append a correction silently erases the whole note
- [ ] **T-174** Win32 job-object launcher so the role's whole process tree is killed on a NORMAL exit too (R22's named limit on Windows)
- [ ] **T-184** state import: an input changed between --draft and --commit commits the DRAFT's content with no note (QA 102 PROBE-7): record each input's hash in the draft and have --commit refuse or say so when one differs
- [ ] **T-186** state-views applySummaryRegion has the same startsWith('# ') blind spot as the importer's BOM defect: a SUMMARY.md with a leading BOM is misread
- [ ] **T-190** QA PC speed without hiding Windows failures: the QA driver sets TEMP=TMP=C:\qa-tmp for probes and mutants, QA seats keep scratch in C:\qa-scratch (both Defender-excluded by Aaron), and each QA seat runs the full suite ONCE with the default TEMP as the Defender-on, user-like control
- [ ] **T-206** The assignments sidecar gets the record's protections: a /sync erasure check (no entry dropped by a hand edit or a merge resolution), a stale-assignment flag (the assigned task is no longer active), and a planner-only writer once T-203 resolves seats by checkout
- [ ] **T-210** ob_start names the newest docs/loops brief by git commit date
- [ ] **T-211** Each seat's status-cron minutes live in seat data, and /start reads them

## P3

- [ ] **T-188** sync's ci-status check reads gh's 'gh auth login' hint in a clone whose origin is not GitHub as 'gh is not authenticated'

## Done (last 3 sessions)

- [x] **T-217** Guard T-216's one-constant property at the zod level: a plan-only loop regex with a flag (e.g. /i) survives every test (session 155) — QA 236 D1 (report a1960173). Mutant M7 gives PlanSchema.loop its own copy of LOOP_ID_PATTERN with the /i flag: 68/68 target tests and the full tests/harness run stay green, because zod's JSON emission keeps the regex source and drops flags, so plan.schema.json does not move and the drift test, L3 and BE-0.1 cannot see it. Under M7 validatePlan accepts T001 and 15-Slice while evidence refuses them. Cheap kills: assert PlanSchema.shape.loop's regex IS LOOP_ID_PATTERN by identity (also kills the equivalent M6), and/or add T001 and 15-Slice-4 to L2's refusals. ALSO record, not fix (QA 236 open item 2): runtime.ts:1278 validates a runtime planner's D_t but never checks plan.loop against the run's --loop (E_t does, at :1535). Predates T-216; the accepted set is now wider. plan.loop builds no path, so not a safety issue; recorded so nobody inherits it as settled. — Session 155: built by sia-builder (loop/t217-t218-guards 1a38e3f2, with T-218); QA 247 ACCEPT (f138bc6e; 5/5 mutants incl. QA's new RegExp(source) mutant; suite 0 failed; first Plumb CI run 36948923624 success). PR #256 open, Aaron merges. — Session 155: PR #256 merged (1dc71dbe) on Aaron's word.
- [x] **T-218** T-214's test lacks a leading-whitespace row: QA 239 mutant q5 (strip leading spaces/tabs before matching) survives the builder's test (session 155) — QA 239 G1 (report d4993796). The candidate code refuses ' [unrunnable]' and '  A-1: x', and QA's generator (docs/loops/qa-239/t214-gen.mts, G4 differential) kills q5, but t214-declared-blank.test.ts's JUNK list and J2 have no leading-whitespace row although T214-2 names it. Fix: add leading-whitespace rows to J1/J2, or commit QA's G4 differential as a test. Same shape as T-217 (a guard the property needs but the tests don't hold). — Session 155: built with T-217 (1a38e3f2); QA 247 ACCEPT (q5 and QA's tab-only mutant red on J3). PR #256 open, Aaron merges. — Session 155: PR #256 merged (1dc71dbe) on Aaron's word.
- [x] **T-214** declared.ts rejects a blank line inside a qa-declared block, so the first live shadow verdict was undefined (session 155) — Found by the planner in session 153 at C's first live shadow-verdict prepare (T-155, CC-23 episode 1). loop-15-slice-3-c-criteria.md's ```qa-declared block has a blank line (line 340) between [unrunnable] and [out-of-scope]. parseDeclared refuses it with 'line is not `ID: text`: (blank)', so the verdict was undefined for a formatting reason. No fixture in B's or C's tests has a blank line in the block, so nothing caught it. Decide which rule holds: (a) the parser tolerates blank lines between sections (a natural markdown reading), or (b) the format forbids them and /sync or the criteria-authoring step rejects a criteria file whose block does not parse, BEFORE any candidate exists. Either way, add a fixture row with a blank line. Do not rewrite loop-15-slice-3-c-criteria.md after the fact: its prepared artifact is immutable. — Session 155: dispatched to sia-builder as slice four step 1 (docs/loops/loop-15-slice-4-dispatch.md), rule (a) per D-075. Branch loop/t214-declared-blank. — Session 155: BUILT by sia-builder (Aaron approved runs in its window): loop/t214-declared-blank caebe8b6 (from ec7138bb); BLANK_RE /^[ \t\r]*$/ skip in parseItems; 240+30 CRLF blank variants, 60 junk; 5 mutants red; vitest tests/harness exit 0 (490 passed). Pushed SHA read back by the planner (ls-remote). QA 239 dispatch: docs/loops/qa-239-t214-dispatch.md (own generator, NBSP/\f/\v judgement, base refusal text captured, >=2 own mutants). Target: Plumb after QA 238. — Session 155: QA 239 (Plumb, second attempt after a launcher --add-dir fault) RULED ACCEPT by the planner after reading the report (origin/qa/t214-report d4993796) against docs/loops/qa-239-t214-dispatch.md. P-blank: 6,196 independent variants, 0 disagreements (3,920 at base); T214-2..4 met; NBSP/\f/\v/ZWSP refused = matches D-075 (QA's reasoning adopted: P-blank names its members, the rest stays strict); 10/10 mutants red; regression 1 environmental failure identical at base (checks.test.ts D4 on Plumb). 0 tcm runs (no gh on Plumb): PR #250's CI is the candidate's first CI. PR #250 opened; code, Aaron merges. G1 to T-218. — Session 155: PR #250 MERGED on Aaron's 'merge pr 250' (merge commit 29014f2d). Slice four step 1 done.
- [x] **T-216** The plan schema accepts only runtime loop ids (tNNN), so no planner brief's D_t can pass harness validate plan / dispatch (session 155) — Found by the planner in session 153 (resumed) while finalising slice four. `harness validate plan docs/loops/loop-15-slice-4-brief.D_t.json` exits 1 with 'loop: loop must look like t001'. open-brain/src/harness/schema.ts:84 and :248 pin the plan's loop to /^t\d{3,}$/, while the evidence schema already accepts human-seat loop ids through EVIDENCE_LOOP_PATTERN (:180: tNNN or N-word, e.g. 15-slice-3-c), as widened by candidate B (rulings-2 R10). T-195 (DT-1, DT-7) requires every interactive planner brief to ship a D_t that harness dispatch validates, so the rule cannot be met by any planner brief; its tests must have used tNNN fixtures. FIX: the plan schema accepts the same loop pattern as evidence (one shared constant, used by both), with a fixture row for a seat loop id (15-slice-4) and a mutant. Check whether brief-plan-gate.ts or the record-name regex also assumes tNNN. It BLOCKS slice four's dispatch (its D_t keeps its true id; it is not renamed to fit). Small code fix: a dev seat, QA, then Aaron merges. The slice-three finding applies: the instruction (T-195) and the schema it relies on disagreed, and nothing checked one against the other. — Dispatch written: docs/loops/t216-dispatch.md. It goes to a new developer seat Aaron is starting at the shop, 2026-10-01. One shared loop-id constant for plan and evidence; GATE_RECORD_RE and loop-built paths audited; red then green on the unedited slice-four D_t; dry-run plan-gate. Machine: code now, no builds or tests on the QA PC until Rivet is done. — Session 155: QA 236 RULED ACCEPT by the planner after reading the report (origin/qa/t216-report a1960173) against docs/loops/qa-236-t216-dispatch.md. T216-1..5 and the regression all PASS; 21 probes, 0 schema disagreements; tcm CI candidate 36826245143 and base 36826249364 success. PR #245 opened at 9a0973f0; it is code, so Aaron merges. D1 (test strength: a plan-only regex copy with /i survives) moved to T-217 and does not block. After #245 merges, close this task and dispatch slice four. — Session 155: PR #245 MERGED on Aaron's 'merge' (merge commit b3ab05ca). Verified on merged master (ec7138bb): `harness validate plan docs/loops/loop-15-slice-4-brief.D_t.json` exits 0 via tsx. Slice four's T-216 precondition is MET.
