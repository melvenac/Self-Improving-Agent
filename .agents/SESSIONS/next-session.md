<!-- generated from .agents/state.json rev 60 by open-brain v0.44.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## planner _(written session 73)_

### Pick up here

THE PLANNER SEAT'S FIRST HANDOFF THROUGH THE PER-SEAT SLOT (C3's acceptance, Loop 14). Loop 14 is closed: ACCEPTED at c7fbdd9, merged as #77 with the bump 3135da4, v0.43.0 on e1948a0, both seats rolled (#80, #81), the close-out at docs/loops/loop-14-closeout.md. The next loop is the G-039 recall trigger (D-026), UNBRIEFED: write its brief in docs/loops/ from g-039-ruling.md and loop-14-closeout.md section 4, then kick off fresh developer and QA sessions on Opus 5 the way loops 15 and 14 were kicked off — both seats report their /start greetings verbatim first and the planner checks them against the record before anything else. Read in order: .agents/roles/planner.md and shared.md (now loaded for you and named by commit); docs/loops/loop-14-closeout.md; docs/loops/g-039-ruling.md; the developer's and QA seat's handoffs by SHA (the greeting names them). This session's earlier record writes carry session stamp 64 (opened_session on G-045..G-047, T-156, T-157); this close-out takes 73 because the record numbers sessions by uuid and 64 predates the fix.

### Watch out

- FOUR INSTRUMENTS CAN REPORT HEALTHY ON A STALE TREE. Both fresh seats' greetings this morning were faithful renders of trees two merges behind master: clean tree, Drift: none, a valid render, a matching version. Loop 14 added the tree-currency line; still verify the greeting against origin/master's blob before trusting a claim about the record.
- THE RECORD MOVES ONE SEAT AT A TIME AND THE MERGE CHOREOGRAPHY IS THE PLANNER'S. When a candidate migrates the record schema, the main tree is rebuilt and every session's server reconnected BEFORE any seat reads the record; confirm the reconnect from a read (an ob_state dry run), never from the reconnect message. An older build refuses the file (ob_state) or, before Loop 14, fell back to prose (ob_start).
- A RELAY IS ONE LINK. When telling a seat a fact about the repository (merged as a merge commit, a branch is an ancestor), say it is a relay and have the seat verify it before acting; the developer did, and it was right to.
- DO NOT ASK FOR A CHANGE TO A DOCUMENT INSIDE A FROZEN CANDIDATE. The planner did (Loop 14) and the developer correctly refused because the freeze is a mechanism; the sentence went to the close-out instead.
- CITE, DO NOT RESTATE. A count in prose acquires an implied 'as of'; the developer restated 960 where the run said 974 in a document about restated numbers (Developer 31). Cite the SHA and the section instead.
- THE PLANNER'S OWN INSTRUCTIONS ARE ERRORS TOO: Planner 49 (a claim about the record the record did not hold, after the handoff slot was overwritten) and Planner 50 (six rows where the brief had seven). Both caught by the other seats reading the artifact.
- PARALLEL BASH CALLS SHARE ONE CWD: a call that cd's elsewhere moves every concurrent call. Use one call for sequential work in one tree, absolute paths, and git -C.
- MSYS MANGLES ref:path IN git show (origin/master:.agents/state.json becomes origin\master;...); use the SHA form.
- GITHUB ACTIONS REGISTERS RUNS LATE SOMETIMES (fifteen minutes today; three trigger events produced nothing until they did). 'no checks reported' is a pre-registration state; poll for a registered run before watching, and merge only on CLEAN/MERGEABLE.
- shared.md IS NOW LOADED INTO EVERY SESSION: it has a budget. Rules go there short with provenance; reasoning stays in close-outs. And loading a rule is not applying it (Developer 31, Loop 14).

### Open questions

- Should the planner seat roll into a fresh session now (the C4 fresh-planner test, and this session's context is very large) or continue? The planner recommends a fresh session on Fable 5.1 after this close-out merges.
- Aaron's home directory: the real active-session.json holds eight scratch-fixture keys written by QA baseline hook runs before it redirected HOME (QA report 1 section 9) — clean or ignore; and the shared repository's local master branch is 105 commits behind origin/master, a trap for a checkout by habit — fast-forward or delete.
- G-042 on a second machine: two sightings, one machine, both with the count right and only the exit code knowing. CI has never shown it. Whether it is worth a loop or a CI-only check is unruled.
- The build-freshness check goes red on docs-only commits because it compares the build's commit to HEAD rather than to the last commit that touched open-brain/; fix shape noted in loop-14-closeout.md section 5, not sequenced.

### Loop state

**Open PRs:** _None._

**SHA frozen for QA:** _None._

**Questions pending for Aaron:** 
- Fresh planner session now, or continue this one? (recommended: fresh, on Fable 5.1, after this close-out merges)
- active-session.json scratch keys and the stale local master branch: clean/fast-forward, or ignore?

**Rulings made mid-loop:** 
- Loop 14 C2d: the near-miss register belongs to the close-out document by family, never numbered; the enumeration row is met by saying so in the handoff.
- Loop 14 A7-style: QA criteria derived beyond the brief are QA's own clauses; a candidate meeting the brief and not the clause is reported both ways and the clause returned to the planner, never dropped after a verdict.
- Loop 14: ref authorship is a ledger not a name; the gate seam is async never a spawned process; a checkout may declare role: none and record writes from it are refused; the schema migration is the developer's record write and nothing else writes the record between candidate and merge; other seats' close-out SHAs are derived at read time, failing closed; C3's required rows may be empty but not absent.
- Sequencing after Loop 14: the G-039 recall-trigger loop, then slice three (Aaron, D-026).
- Models at the next fresh sessions: developer and QA on Opus 5, planner on Fable 5.1 (Aaron, 2026-09-20).

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

## qa _(written session 72)_

### Pick up here

THIS IS THE QA SEAT'S HANDOFF for Loop 14, the first entry written through the per-seat machinery this seat evaluated; read the planner's close-out for the loop's disposition. Loop 14 is ACCEPTED at c7fbdd9 and carried to the version-bump 3135da4; v0.43.0 is tagged at e1948a0. Seats roll after every complete loop, so the next QA session is a FRESH one for whatever the planner briefs next (Loop 15 slice three per D-023, whose mandatory first repair is G-045). Its first act is the same as this seat's was: write docs/loops/loop-<N>-qa-criteria.md from the brief's rows BEFORE any candidate exists, in the shape of docs/loops/loop-14-qa-criteria.md at a68c358 - every pass clause derived from the brief's or the planner's words, anything added marked [mine] and returned to the planner in a numbered section, then recorded inline as RULED at the commit the ruling arrives. Narrow a clause you added only BEFORE a candidate exists and say why in the file; never after a verdict. Read the three reports for this loop first: docs/loops/loop-14-qa-report.md (867790b, 7e1c041 rejected on C2d with four findings), loop-14-qa-report-2.md (667cd9d, c7fbdd9 accepted, R1-R4 closed) and loop-14-qa-report-3.md (97bdbe6, the bridge to 3135da4). The probe shapes are in report 1 section 10 and report 2 section 10 and rerunnable from the descriptions; the scripts were scratchpad-only and are not tracked - rebuild them: a linked-worktree fixture maker (clone --no-checkout once, `git worktree add --detach` per fixture, origin/master pinned by update-ref), a greeting runner that imports build/server.js and calls handleStart with HOME, USERPROFILE and KNOWLEDGE_V2_DB pointed at the scratchpad, and a handleState runner that hashes state.json before and after. Evaluate in ~/Worktrees/sia-qa, never the main checkout; the tree carries its own .gitnexus/ index so /sync runs 0 skipped; budget the T-055 FTS repair into every analyze (it fired on 1 of 3 today here).

### Watch out

- THE SUITE MUST RUN ALONE. A full vitest run that overlapped thirteen `git worktree add` calls printed 974 passed and exited 1 with G-042's `[vitest-worker]: Timeout calling "onTaskUpdate"`; the same run alone exited 0, four of four today. Build fixtures before or after the run, never during, and read the exit code from a variable written to a file, never from a pipe.
- A HOOK PAYLOAD BUILT BY HAND WITH WINDOWS BACKSLASHES IS INVALID JSON, and before c7fbdd9 the hook then greeted the SHELL'S cwd with a generated uuid while looking right. Two of my negative checks were reading my own checkout. Build every payload with JSON.stringify, and assert the `Project detected:` line names the fixture before reading anything else. The candidate now refuses malformed payloads (R4), but the lesson is about the instrument.
- THE SHARED CWD DRIFTS UNDER PARALLEL BASH CALLS EVEN WITH AN EXPLICIT `cd` AT THE HEAD OF EACH COMMAND. Three reads returned 'no such file' because a sibling call's `cd open-brain` landed between my cd and my sed. Absolute paths and `git -C <root>` for everything that runs beside another call; this is the third session to record it.
- GIT_TRACE=1 TO STDERR SEES NOTHING FROM THE SESSION-START MODULES because they spawn git with stderr ignored; the zero is 'did not look'. GIT_TRACE=<absolute file path> sees every call (25-29 per greeting). Validate a zero on a planted positive through the same channel, not a different one.
- `if (false && ...)` IS NOT A VALID MUTANT where the condition narrows a TypeScript union: tsc refuses it (TS2339) while vitest, through esbuild, still goes red. Run `tsc --noEmit` on every mutant before counting it; two of twelve had to be redone type-clean. The developer's own rule, and it applied to me first.
- DOCS-ONLY COMMITS MAKE build-freshness RED because it compares the build's commit to HEAD; every criteria and report commit needed `npm run build` first. Carried to the close-out as an instrument finding; until it changes, rebuild before every /sync in a seat tree.
- THE OLD BUILD IN THE MAIN CHECKOUT FALLS BACK TO PROSE AGAINST THE MERGED v2 RECORD with one notice line (report 1 F3); R3 fixed the NEW build only. A session served by a main tree that has not been rebuilt after the merge gets a greeting that looks ordinary and is old. Confirm the server from a read (a dry-run ob_state answer that accepts `seat`), never from the reconnect message.
- A CHECKOUT WITH NO AGENT.local.md NOW GREETS AS Forge (developer) AND RENDERS THE DEVELOPER'S HANDOFF AS ITS OWN, because the tracked AGENT.md says developer. The main tree is that checkout until its `role: none` file exists (report 1 F6). Not code; choreography.
- THE REAL ~/.claude/open-brain/active-session.json CARRIES 8 SCRATCH KEYS from this session's six baseline hook runs (before HOME was redirected) and the developer's two C4 runs. Harmless, refused after 12h, disclosed to Aaron in report 1 section 9, not edited by any seat. Redirect HOME and USERPROFILE before the first hook run of any fixture work.
- NOTHING IS PUSHED FROM THIS SEAT. The planner pushed both QA branches from the shared object store by the SHA this seat reported, on Aaron's word; the close-out commit goes on a branch cut from origin/master and is reported by SHA the same way.

### Open questions

- IS THE VITEST WORKER-TIMEOUT CONDITION (G-042) REAL ON ANY MACHINE WHEN NOTHING ELSE IS RUNNING? Four clean runs alone today and one red under load, all on this machine; CI has never been measured for it. The amendment to G-042 carries the counts.
- DOES THE MEMORY HALF GET USED AT ALL? ob_recalled returned 'No knowledge entries recalled this session' again; the shared-cwd rule and the GIT_TRACE-to-file trick both lived in prior handoffs and in the store and neither surfaced when they bit. Eight loops now.
- WHAT ELSE REACHES THE REPOSITORY? Unchanged from slice two: the index, hooks, config, submodules, packed-refs and the reflog are unprobed by any seat, and Loop 15 slice three (G-045) is next.
- WHY DOES handleStart REPORT 'Session ID: discovery failed' ON A FIXTURE WHOSE SLOT THE HOOK JUST WROTE with the same session id into the same (scratch) home? The slot was there with the right uuid and the read side did not find it. Not scored, not chased; T-003's family, and the reuse-the-log path was untested because of it.

## Last session

Session 74 — 2026-09-21 — developer — `46758737-4461-4480-be96-fcf65ba9fa95`
