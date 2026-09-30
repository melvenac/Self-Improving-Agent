<!-- generated from .agents/state.json rev 210 by open-brain v0.44.2 — do not edit; change state via ob_state -->

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
- [ ] **T-155** Shadow merge gate: the runtime records what it would have done at each merge, and disagreements with Aaron are counted
- [ ] **T-159** The trigger's cheap not-asked path — record a not-asked fire without opening the store
- [ ] **T-161** /start must assert a transcript exists for the session's own uuid — the CLAUDE_CODE_CHILD_SESSION check would be a permanent false positive
- [ ] **T-166** GitNexus impact() missed a call site on the exact path under repair while reporting epistemic 'exact' - the MUST-run-impact rule is only as good as the resolver
- [ ] **T-168** 'Run the full suite alone' must become a check: assert peer idleness before the run and refuse or flag when a peer is busy
- [ ] **T-169** At Loop 15 close, rewrite PRD.md and README.md against what ships, take PRD.md off retirements.json's historical list, and retire the maturity lifecycle
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
- [ ] **T-214** declared.ts rejects a blank line inside a qa-declared block, so the first live shadow verdict was undefined

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

- [x] **T-205** MASTER IS RED: T-158's TG-2 test asserts specific gap ids against the LIVE record, and the planner's G-049 broke it; prove the citation skip on a fixture record instead (session 150) — Opened planner session 150, 2026-09-30. Master run 36681093114 at 9c60361 (the planner's docs-only #219 merge, which carried rev 175's explicit G-049) FAILS tests/shared/state-writer.test.ts 'a dry-run add_gap on this repo skips G-046, G-047 and G-048 and names them (TG-2)': expected false to be true. It is the only failure (1 of 1856). CAUSE (derived): the test runs add_gap against this repo's LIVE .agents/state.json. With G-049 present, the next generated id is G-050, so the skip of 046-048 never occurs. Same class as r3b (#210) and G-044: live record data asserted as an invariant. The TEST is the defect; the record is NOT reverted. FIX (builder, branch fix/tg2-fixture-record from origin/master): prove the citation skip on a FIXTURE record in a scratch repo whose tracked files cite the ids the fixture's next id would hit. A live-repo run, if any, asserts only 'the assigned id is not cited', never specific ids. Rows: red at 9c60361, green after; a mutant dropping the citation scan goes red on the fixture row; a sibling grep of the test tree for other assertions on specific live task, gap or decision ids, each named. Push cleared, PR, merge is Aaron's. PLANNER ERROR ENTRY: the planner's record write reached master and turned it red. Caught by reading master's own run after the merge. The planner had checked that G-049 was uncited in the tree but not whether a test pinned the next id. PR #220 is held until master is green again, so its merge is attributable. — MERGE AUTHORITY, planner session 150: Aaron, directly in the planner session, verbatim: 'merging the TG-2 fix PR when the builder posts it'. It covers ONE PR: the builder's fix/tg2-fixture-record PR. The planner merges it only on MERGEABLE/CLEAN, pinned to its head, after reading the red/green and mutant evidence, then reads master's own run. It does not cover any other PR. — FIXED, planner session 150: PR #222 (fix/tg2-fixture-record a4d540c, builder) merged by the planner on Aaron's word ('merging the TG-2 fix PR when the builder posts it') as cdf079d, pinned; PR run 36684022227 success. MASTER'S OWN RUN 36687172648 at cdf079d: SUCCESS; master is green again. The builder's sibling audit found no other assertion a routine record write can break. It found one tree-behind fragility in greeting-size.test.ts, which is T-200's to fix before QA.
