<!-- generated from .agents/state.json rev 353 by open-brain v0.45.0 — do not edit; change state via ob_state -->

# Inbox

Legend: `[ ]` open · `[~]` in_progress · `[!]` blocked

Titles only. Full rationale for a task is its `note` in `.agents/state.json` under `tasks[]` — read it before you rule on, work or retire a task, not when you merely pick one.

## P0

- [ ] **T-022** Replace-on-write for `state` facts
- [ ] **T-024** Rewrite the two genuine `obsolete-reference` hits
- [ ] **T-031** Add agent attribution to sessions
- [ ] **T-044** The slot needs an OWNER, not just a timestamp
- [ ] **T-046** Cursor + Git Bash: PowerShell hook wrapper fail-closes every tool
- [ ] **T-160** Hub transport: make silence unambiguous (push or long-poll), a Stop-hook seat wake, per-agent keys
- [ ] **T-167** The scope layer did not travel: PRD/DECISIONS/ENTITIES were untracked, so no seat worktree had them — tracked at session 77; make prd-version an ISSUE, and render the problem statement at /start
- [ ] **T-194** Planner seat hook: a tracked PreToolUse hook mechanically refuses the planner's out-of-boundary acts (source/tests/hooks/build writes, hand edits to rendered views, git merge/push/tag without per-occasion authority), fails closed, and names the rule it enforces
- [ ] **T-196** The hub procedure is tracked knowledge: each seat's hub room and hub-talk invocation in a tracked data file beside .agents/SYSTEM/worktree-seats.json; a short 'Talking to Cursor seats' section in planner.md (printed in full at /start) pointing at it; a tracked alwaysApply .cursor/rules hub rule; and Cursor's /start joins the seat's room and reads unread atlas turns before proposing anything
- [ ] **T-197** Cursor's /start matches Claude Code's /start except for documented tool-call differences, and /sync fails on any other difference: it reads ob_start's State block, never hand-edits rendered views, lets ob_start create the session log, and presents NEXT as a ranked backlog rather than a proposal
- [ ] **T-200** A seat started from a stale tree is briefed from STALE state: when the local record is older than origin/master's, ob_start renders the State block and the role files from origin/master (git show) and says so, so D-062 holds at every /start
- [ ] **T-233** Deterministic /start greeting: ob_start renders the whole briefing and /start prints it verbatim; the record's session number; Latest brief by commit date; a Usage line from slots.json; open questions carry resolvedBy; the status cron replaced by dashboard reads — and FIRST make master's fixes reach the session (T-172: the serving main tree is 597 commits behind)
- [ ] **T-246** END-FIX: /end leaves a record that matches the session in any project and either layout (ob_end refuses when work has no record update; SessionEnd marks work after /end; dedup recalls not rated)

## P1

- [ ] **T-146** Run the recency sweep at 0.01 / 0.02 / 0.04
- [ ] **T-154** Give /start a memory-free documented route, and make the SessionStart hook installable by a stranger
- [ ] **T-159** The trigger's cheap not-asked path — record a not-asked fire without opening the store
- [ ] **T-161** /start must assert a transcript exists for the session's own uuid — the CLAUDE_CODE_CHILD_SESSION check would be a permanent false positive
- [ ] **T-166** GitNexus impact() missed a call site on the exact path under repair while reporting epistemic 'exact' - the MUST-run-impact rule is only as good as the resolver
- [ ] **T-168** 'Run the full suite alone' must become a check: assert peer idleness before the run and refuse or flag when a peer is busy
- [ ] **T-170** Memory is LOOKUP by default and INJECTION only on a deterministic match against the act; fix the WRITE side first, so every stored lesson carries the key (command pattern, path or error string) that would have caught the mistake
- [ ] **T-172** The main tree serves every session and nothing says when it is behind master: the greeting must print the SERVING build's distance from origin/master, and one refusing command must update, rebuild and verify it
- [ ] **T-181** Adopt Aaron's active projects onto SIA per docs/loops/adoption-plan-2026-09-25.md: frogger (fresh install) and co-op-mailer (import) as pilots, then Tarrant County Makerspace record-only BEFORE its cutover (D-048), then foundry and worth-it-window-washing
- [ ] **T-182** The claude adapter passes --permission-prompts, which tcm's installed Claude Code lacks (2.1.282 on the QA PC has it): declare a minimum Claude Code version, make CA-9 name the installed and required versions, and decide whether tcm's claude is updated
- [ ] **T-202** The planner learns when a seat comes online: each seat worktree's SessionStart reports seat, checkout SHA, record rev and runtime (Claude Code or Cursor CLI) to the planner seat, deterministically
- [ ] **T-225** Jev calibration 2 prerequisites: G_qa request with requirement statuses stripped, a run with real deterministic checks, a held-out set, and score.mjs matching the current gate reason text
- [ ] **T-235** Cursor parity with Claude Code: measure every CC surface under cursor-agent CLI, then close the ruled gaps
- [ ] **T-245** #437 Option A: replace the lock cascade with a simple wx claim and accept rare doubles, after making the two non-idempotent hook stages idempotent (handoff-marker append, SessionStart git fetch); plus make ob_end idempotent

## P2

- [ ] **T-101** Commit the entry-455 archive move as one commit
- [ ] **T-102** Distil and sanitise the v1 stores into v2, then retire the v1 vault
- [ ] **T-162** The element table's growth rule: the store cannot be consulted for act shapes the table does not name
- [ ] **T-165** Evaluate an alternate harness/model as the DEVELOPER seat via T-155's shadow merge gate — the driver is a SECOND METER, not cost; Aaron's named candidate is DeepSeek v4.1 Flash
- [ ] **T-174** Win32 job-object launcher so the role's whole process tree is killed on a NORMAL exit too (R22's named limit on Windows)
- [ ] **T-184** state import: an input changed between --draft and --commit commits the DRAFT's content with no note (QA 102 PROBE-7): record each input's hash in the draft and have --commit refuse or say so when one differs
- [ ] **T-191** Per-seat greeting profiles: ob_start renders what each seat needs, from a data file, and names every section it omits
- [ ] **T-206** The assignments sidecar gets the record's protections: a /sync erasure check (no entry dropped by a hand edit or a merge resolution), a stale-assignment flag (the assigned task is no longer active), and a planner-only writer once T-203 resolves seats by checkout
- [ ] **T-241** Frogger pilot re-run: reset ~/Projects/frogger to its pre-migration state, re-run /bootstrap on current SIA master with the bootstrap fixes, grade against T-181 pilot 1's F1-F15
- [ ] **T-242** Grok bots in hub-partner-seats.json: add grok-sia-review and grok-qa-sia as atlas reader partners, and unpin the two tests that freeze the live map
- [ ] **T-244** planner-watch misses peer turns: diff on each room's newest turn number, not unread, and keep prev in memory per process (shared STATE file across instances)
- [ ] **T-247** Pin QA 288's unpinned checks: assertPathUnderDir (H1, plus a date check in writeSummary), secure_delete (H2), and the hub-room guard's clause-scope negation (G1)

## P3

- [ ] **T-188** sync's ci-status check reads gh's 'gh auth login' hint in a clone whose origin is not GitHub as 'gh is not authenticated'
- [ ] **T-243** #484 LOW residuals and pre-existing audit lows: recall-trigger.log keeps a ~10-char excerpt of a malformed payload; single-quoted YAML tags keep their quotes; normalizeProject splits 'C++ Tools' oddly; A2 (repo-local .gitnexus/run.cjs runs on /sync), A4 (ob_start project_root trust), A5 (OPEN_BRAIN_VAULT_DIR override): document the trust boundaries

## Done (last 3 sessions)

- [x] **T-025** Reconcile the experience `type` field across three sources (session 162) — `.agents/SYSTEM/ENTITIES.md` documents `type: gotcha | pattern | decision | fix | optimization`; `vault-writer.ts` emits no `type` at all except `writeFailure`'s hardcoded `type: failure`; live vault notes carry one. Deliberately left out of the v0.10.0 work so the inconsistency stayed visible rather than being buried inside a feature. Worth noting while fixing it: **all five documented types are events** — there is no state type, which is why state facts get written as experiences and never replaced. No `/sync` check validates experience frontmatter today, so whatever is decided should come with one. (Session 48) — Session 161: RULED B2: fact_kind is the taxonomy; frontmatter type is an optional one-token free label, neither retired nor enumerated. ENTITIES.md updated (#448 merged, docs/loops/t025-ruling.md). effectiveKind was removed in e05ad9a7 (Loop 10), so T-022's gate is only the count of recorded fact_kind labels; the schema cannot tell an explicit ob_store kind from another writer. REMAINING: the /sync frontmatter check (rows R1-R5 in the ruling doc), queued until #424 and #442 merge (sync checks.ts). — Session 162: the /sync experience-frontmatter check (ruling B2, Follow-up R1-R5) built by cursor-builder as #466; QA 282 REJECTED r1 (existsSync passed an unreadable vault), QA 283 ACCEPTED r2 b4ad38a3 (qa/s162d-report 29a398b3); merged on Aaron's word 2026-10-06 'Merge both': master b8ab0f04. Includes a deliberate vault-writer change: a BOM-prefixed note's frontmatter is now read.
- [x] **T-156** A scan that matches the sentence forbidding a thing, as though it were the thing (G-040): every source-text scan in the harness tests must be validated against a known positive and a known negative in the same test, or replaced by a parser (session 162) — From G-040 (opened session 65). The 'no git push in harness source' scan fired on the DENIED_SUBCOMMANDS constant; the 'no shell spawn' scan fired on a doc comment. Both were caught because the scan went red while someone was looking; the same flaw in the other direction — a pattern too narrow to match the real thing — is a green that means nothing. Same family as the command-names / command-tool-names checks in /sync. Acceptance: each such scan has a fixture that MUST match and one that MUST NOT, both asserted; or the scan is a parse over the module graph. Sits in slice two's plan unless Aaron sequences otherwise. — Session 162: #445 r4 1e21deae ACCEPTED by QA 281 (qa/s162b-report ae2baca7) after QA 279/280 rejects; merged under Aaron's P2 rule (tests and docs only, path list posted on the PR): master ecbfb169.
- [x] **T-187** /sync rebuilds the GitNexus index when it is behind (D-049): plain /sync runs analyze where a .gitnexus exists and the indexed SHA is not HEAD, then verifies the new SHA; sync --check stays read-only; a tree with no index stays SKIP (never PASS) (session 162) — Session 100, Aaron's D-049. Build notes: T-055 (incremental analyze is unreliable here) and G-043 (gitnexus clean deletes nothing without --force) bear on the command used; .gitnexusrc noStats:true keeps tracked files clean; the check must prove it looked (the SHA read back after the rebuild). The main checkout's index is 98 commits behind its own HEAD, which is itself 111 behind master (T-172). — Session 162: #451 merged on Aaron's word (s161 'merge'; reconfirmed in the planner window 2026-10-05 'Yes, merge when green'), after infra's conflict merge cc14c5a7 read with --remerge-diff and update-branch b6e5200e, CI green: master 27dd1e77.
