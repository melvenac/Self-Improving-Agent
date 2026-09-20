<!-- generated from .agents/state.json rev 56 by open-brain v0.42.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## developer _(written session 71)_

### Pick up here

SECOND CANDIDATE FOR LOOP 14, UNEVALUATED. Branch loop/14-three-seat-record, record rev 55. The first was 7e1c041; QA's report is 867790b on qa/loop-14-report - eight of nine rows passed, six mutants all red, and the honest no was C2d. THE DURABLE ACCOUNT IS docs/loops/loop-14-developer-handoff.md: section 3 carries C2d's enumeration table, section 9 QA's four findings repaired, section 7 the one deliberate non-green. C2D WAS SORTED, NOT BUILT - the near-miss register belongs to the close-out DOCUMENT, by family and never numbered, per the planner's ruling; it is a record-shaped question with a document-shaped answer. F1-F4 rode with it because the SHA had to move for that sentence anyway.

### Watch out

- THE RECORD IS AT REV 53 AND IS SCHEMA v2. An older build cannot read it at all — ob_state through the main checkout's v1 build refuses outright, which is the loud failure the z.literal is for. Any write needs expected_revision 53 from a build carrying this schema. NOTE THE REFUSAL MESSAGE IS SLIGHTLY WRONG HERE: it advises /mcp reconnect, which cannot help when the schema change is on a branch the main build does not have — only a rebuild does. G-033/G-034's family.
- F1 IS REPAIRED AND ITS WINDOW WAS EVERY /end. The greeting derived a SHA from HEAD and rendered the words from disk, so between a set_handoff and its commit every seat's greeting named a commit that does not contain the line beneath it. It now offers NO SHA when they differ. The no-SHA path will therefore appear during every /end, which is the most common moment a seat reads its own greeting - check how it reads, not only that it is correct.
- ob_start NOW REFUSES AN UNKNOWN schema_version WITH NO PROSE FALLBACK, and the narrowness is the design: an ABSENT state.json still keeps the prose regime, and a malformed-but-known-version record still falls back. If a project without a record ever stops greeting, this is the first place to look and that distinction is the thing to check.
- THE HOOK NOW REFUSES A MALFORMED PAYLOAD AND EXITS NON-ZERO. If a host ever sends one routinely, sessions will fail to start rather than start wrongly. That is the intended direction - a confident greeting for the wrong directory under a generated identity is worse - but it is a behaviour change at the outermost edge, and nothing in this repo can see how hosts actually call it.
- A WELL-FORMED PAYLOAD WITH NO session_id NOW WRITES NO SLOT. Anything relying on the hook to populate the slot for an IDE that supplies no id - Cursor was the case that led to generating one at all - loses that fallback. ob_set_session from /start is the path that remains.
- THREE VACUOUS ASSERTIONS IN ONE LOOP, the third inside the repair for the second. A negative assertion against a path nothing writes is indistinguishable from a passing guard, and it was caught only because the POSITIVE case failed the same way. Assert the positive beside every negative.
- A MUTANT THAT BREAKS SYNTAX PROVES NOTHING. One was discarded this candidate for exactly that: its red said 'this file does not compile', not 'this guard is load-bearing'. tsc clean is part of calling a mutant valid.

### Open questions

- Does refusing a malformed payload break any real host? Nothing in this repo can observe how hosts invoke the hook, and both observations of the malformed case were seats' own shell-quoting errors rather than a host's behaviour.
- Is the no-SHA path read as 'unknown' or as 'broken'? It fails closed by design and is correct, but it now appears in the ordinary /end window rather than only in an unusual one.
- Should the slot ever be written without a supplied id? The ruling says no, and Cursor - the case generating a uuid was built for - supplies none. Whether Cursor sessions still get provenance through ob_set_session alone is untested here.
- DOES THE MEMORY HALF GET USED AT ALL? ob_recall was not called once across either candidate. Eight loops.

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
