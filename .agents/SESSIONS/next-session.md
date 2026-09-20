<!-- generated from .agents/state.json rev 57 by open-brain v0.43.0 — do not edit; change state via ob_state -->

# Next Session Handoff

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

## qa _(written session 70)_

### Pick up here

THIS IS THE QA SEAT'S HANDOFF for Loop 15 slice two, written after the planner's acceptance ruling; the developer's close-out for the same slice is at the commit before this one on origin/master (rev 50, session 69) and the planner's close-out write follows this one, so read the planner's for the loop's disposition. Seats roll after every complete loop: the next QA session is a FRESH one, for whatever the planner briefs next (Loop 14 re-brief per D-023, or slice three). Its first act is the same as this seat's was: write the criteria file from the brief's §4 BEFORE a candidate exists, in the shape of docs/loops/loop-15-slice-2-qa-criteria.md, and derive every pass clause from the brief's text — mark any clause you add beyond it as yours (QA 2 came from two that were not). Read both reports for this slice first: docs/loops/loop-15-slice-2-qa-report.md (8f2c547, b4194a9 rejected) and loop-15-slice-2-qa-report-2.md (1ee8346, 830af70 accepted). The probe shapes are in their §5 and §4 tables and rerunnable from the descriptions: the probe scripts were scratchpad-only and are not tracked — rebuild them from the reports. Slice three's mandatory first repair is D4 (G-045 at the planner's close-out): `git update-ref -d refs/heads/main` during a stage crashes the runtime with no record because restoreHead keys on HEAD's NAME and the deferred-ref restore lives inside the rollback that is never reached; see it red before believing it. Evaluate in ~/Worktrees/sia-qa, never the main checkout; the tree carries its own .gitnexus/ index so /sync runs 0 skipped.

### Watch out

- THE SHARED CWD DRIFTS ACROSS PARALLEL BASH CALLS EVEN WITH AN EXPLICIT `cd`. Three reads in this session returned 'no such file' or an EMPTY `git diff` because a parallel call had moved the cwd to open-brain/. An empty diff reads as 'nothing changed'. Use absolute paths and `git -C <root>` for every command that runs beside another, and re-verify identity when an instrument goes blank.
- TWO INSTRUMENTS CAN LIE THE SAME WAY. `grep -c $'\r'` and `od | grep` both reported CRLF on a file that node's byte count and `git hash-object --no-filters` proved LF — after a plant had validated one of them. A plant validates the instrument on the plant, not on the file; a third instrument settles it, not an argument.
- A TEST WHOSE PATTERN ACCEPTS THE DEFECT IT EXCLUDES is the prohibition-vs-instance family with the halves swapped: refwatch-stage.test.ts asserted /moved HEAD|could not be rolled back/i and the second alternative WAS the defect. Read every regex alternative in a shipped assertion as a thing the test permits.
- CRITERIA DERIVED BEYOND THE BRIEF BECOME FALSE NEGATIVES. 'exit 0' and 'an integer inside the scale' were this seat's additions to A7; a live done gate correctly rejecting a stub diff then read as a failed row, and the wire returns score as a FLOAT in the scale's range (1.12, 0.08). Derive each pass clause from the brief's words; when a candidate meets the brief and not your addition, report both and return the clause to the planner — do not drop it after the verdict.
- THE LIVE PAIR WITH STUB ROLES ENDS AT THE DEVELOPER STAGE BY DESIGN (F11): the done gate rejects a one-file stub diff under thresholds built for real diffs. A green live loop before slice three needs either a plausible developer stub or a ruling; it is not a candidate defect.
- T-055's FTS CORRUPTION FIRES ON EVERY INCREMENTAL GITNEXUS ANALYZE IN THIS TREE — five of five today, none on a merge. `node .gitnexus/run.cjs analyze --repair-fts` then `analyze` recovers every time; `clean` without --force does nothing and exits 0 (G-043). Budget it into every commit gate.
- `cmd //c mklink /J` UNDER MSYS MANGLES THE SWITCH; make junctions from PowerShell (New-Item -ItemType Junction). ajv's default is draft-07 and the harness schemas are 2020-12 — import ajv/dist/2020.js or the validator refuses the meta-schema.
- THE KEY IS IN EVERY SESSION'S ENVIRONMENT ON THIS MACHINE (setx). Produce the no-key case with `env -u`, show it was present in the parent first, and never echo it; the preflight check is skipped by design when a transport is injected, so only the CLI path proves F3.
- NOTHING IS PUSHED FROM THIS SEAT. The planner pushes QA branches from the shared object store by the SHA the seat reports, on Aaron's word for that push.

### Open questions

- WHAT ELSE REACHES THE REPOSITORY? Four channels are watched (working tree, commits, refs/, HEAD) and every one was found after something used it; D4 shows the HEAD channel still has a case. The index, hooks, config, submodules, packed-refs (probed once, ignored correctly) and the reflog are unprobed by any seat.
- DOES THE MEMORY HALF GET USED AT ALL? Nothing was recalled in this session either; the T-055 recovery and the cwd-drift rule both lived in the record and in memory and neither surfaced when they bit. Unchanged since G-039.
- IS THE VITEST WORKER-TIMEOUT CONDITION PRESENT ANYWHERE BUT THIS MACHINE? Four full-suite runs here today (823, 882, 896, 896) showed none; the developer saw four timeouts once under its own concurrent load. Still one machine.
- THE PRD.md SYNC ISSUE IN AARON'S MAIN CHECKOUT is still open and still nowhere else.

## Last session

Session 71 — 2026-09-20 — developer — `48743f25-1d3f-4054-93f2-b9ec405f52f7`
