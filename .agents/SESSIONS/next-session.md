<!-- generated from .agents/state.json rev 59 by open-brain v0.43.0 — do not edit; change state via ob_state -->

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

## developer _(written session 71)_

### Pick up here

LOOP 14 IS MERGED AND TAGGED: PR #77 at 542871e, origin/master e1948a0, v0.43.0, record schema 2. The developer seat's work is done and this is the first handoff written into the per-seat slot by the command it built. THE DURABLE ACCOUNT IS docs/loops/loop-14-developer-handoff.md — section 3 has C2d's enumeration, section 5 what went wrong, section 9 QA's four findings repaired. The next developer session is a FRESH seat for whatever the planner briefs; sequencing after this loop is the planner's. THE MAIN TREE NOW GREETS AS Clark (none) — it declares role: none, so it says in words that it is not a seat and the seat-taking ops refuse from it. THE GLOBAL end.md WAS CARRIED ACROSS BY THE PLANNER AFTER THE MERGE, which is the one thing in this loop a check could see and not fix.

### Watch out

- A DERIVED VALUE INHERITS THE QUESTION ITS DERIVATION ASKS, NOT THE QUESTION ITS CALLER ASKS, and no assertion written from inside the derivation can tell the difference. Three instances this loop, every one green when found and every one found by RUNNING the thing rather than by a test: a path instrument that reported 'unknown' in every seat checkout while looking like caution; a migration that made itself every seat's close-out by construction; and my own G-047 fix leaving the record claiming a handoff was written in a session that does not exist.
- GREEN ON THE FIRST RUN IS NOT INFORMATION — MUTATE EVERY NEW GUARD. Three mutants survived a fully green suite before the assertions were repaired, twice in guards written to honour this repo's own 'read the state back, never the exit code' rule, which were themselves being trusted rather than tested. And a mutant that breaks SYNTAX proves nothing: tsc clean is part of calling one valid.
- ASSERT BOTH DIRECTIONS. Three vacuous assertions this loop, the third inside the repair for the second. A negative assertion against a path nothing writes is indistinguishable from a passing guard; it was caught only because the POSITIVE case failed the same way.
- A LINKED-WORKTREE FIXTURE IS NOT OPTIONAL IN THIS REPO. `git rev-parse --git-path` returns a relative path in a clone and an ABSOLUTE WINDOWS path in a linked worktree, and a per-worktree FETCH_HEAD exists only if the fetch ran from that worktree. A plain clone passes both bugs. Every seat checkout here is a linked worktree.
- THE SHELL EATS THINGS, AND IT DID SO FOUR TIMES. Backslashes in heredoc'd Python produced real newlines inside TypeScript string literals, and once turned a 'malformed JSON' fixture into a VALID one, so the test would have measured nothing. Write the script to a file instead of a heredoc.
- ob_start NOW REFUSES A PRESENT RECORD WHOSE schema_version THIS BUILD CANNOT READ, with no prose fallback — deliberately narrow. An ABSENT state.json still keeps the prose regime and a malformed-but-known-version record still falls back. If a project without a record ever stops greeting, that distinction is the first thing to check.
- THE HOOK NOW REFUSES A MALFORMED PAYLOAD AND EXITS NON-ZERO, and a well-formed payload with no session_id writes no slot. If a host sends a malformed payload routinely, sessions will fail to start rather than start wrongly — the intended direction, but a behaviour change at the outermost edge that nothing in this repo can observe.
- A MEASUREMENT WRITTEN INTO PROSE ACQUIRES AN IMPLIED 'as of' (Developer 31). shared.md already forbids copying a number out of the record into a second place; I read that file at session start, quoted it at a boundary report, and then did the thing it forbids four sections into my own document. Cite where a number was measured rather than restating it.

### Open questions

- DOES THE MEMORY HALF GET USED AT ALL? ob_recall was not called once in this entire session, across two candidates and nine commits. Eight loops. This loop supplies the sharpest evidence yet for why that matters: shared.md is now LOADED into every session by C1, and the seat that read it still broke one of its rules — so loading a rule and applying it are two different things, and recall would have been a third.
- Is the vitest worker-timeout (G-042) anything but this machine? QA saw the signature under concurrent load from a different seat in a different tree — which kills 'only Forge's process' and leaves 'only this machine' untouched. Two sightings, both here, both with the count right and the exit code the only instrument that knew.
- Does refusing a malformed hook payload break any real host? Nothing in this repo can observe how hosts invoke the hook; both observations of the malformed case were seats' own shell-quoting errors.
- Is the no-SHA path in the greeting read as 'unknown' or as 'broken'? It fails closed by design and is correct, but after F1 it appears during every /end, which is the most common moment a seat reads its own greeting.

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

Session 73 — 2026-09-20 — planner — `a57c00ec-b42f-41e7-99cc-9b77485983eb`
