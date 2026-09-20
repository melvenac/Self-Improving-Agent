<!-- generated from .agents/state.json rev 54 by open-brain v0.42.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## developer _(written session 71)_

### Pick up here

LOOP 14's DEVELOPER BUILD IS COMPLETE AND UNEVALUATED. Branch loop/14-three-seat-record, five commits on 7c7e04b, record rev 53 on the branch. THE DURABLE ACCOUNT IS docs/loops/loop-14-developer-handoff.md, not this slot — read it, including section 5 (what went wrong) and section 7 (a deliberate non-green). Staleness, C1, C2, C3, G-047 and T-157 are in; acceptance is Probe's from a frozen SHA against criteria written before this existed. THE ONE THING TO CHECK BY HAND rather than against its tests: the derived close-out SHA in the greeting. At this SHA the QA seat's handoff should resolve to c0d69d5, 'session 70 close-out — QA seat'. It was wrong once in a way 946 green tests could not see.

### Watch out

- THE RECORD IS AT REV 53 AND IS SCHEMA v2. An older build cannot read it at all — ob_state through the main checkout's v1 build refuses outright, which is the loud failure the z.literal is for. Any write needs expected_revision 53 from a build carrying this schema. NOTE THE REFUSAL MESSAGE IS SLIGHTLY WRONG HERE: it advises /mcp reconnect, which cannot help when the schema change is on a branch the main build does not have — only a rebuild does. G-033/G-034's family.
- sync --check REPORTS ONE ISSUE AT THIS SHA AND IT IS DELIBERATE: mirror-parity, live<->template, end.md. 'live' is ~/.claude/commands/, Aaron's GLOBAL commands directory, outside this repo and read by every session on this machine. It was identical before 1e40e23; the 42-line drift is mine. NOT written mid-loop for the reason the main tree is not a QA fixture — two seats have open sessions under those instructions and the new text needs a schema only this branch has. It belongs in the merge choreography. Recorded rather than suppressed with a MIRROR_EXCEPTION, which would silence a real signal for good.
- GREEN ON THE FIRST RUN IS NOT INFORMATION. Three mutants survived a passing suite this session, including the guard against trusting an exit code, which was itself being trusted. Mutate every new guard: it found three real holes and cost minutes each.
- AN ASSERTION CAN ACCEPT THE DEFECT IT WAS WRITTEN TO EXCLUDE. A fetch-time test searched for the word 'fetch' and passed on 'fetch time unknown' — the exact failure it existed to catch, in every seat checkout. G-040's family. Read every assertion as the set of strings it PERMITS.
- A LINKED-WORKTREE FIXTURE IS NOT OPTIONAL HERE. git rev-parse --git-path returns a relative path in a clone and an ABSOLUTE WINDOWS path in a linked worktree, and the per-worktree FETCH_HEAD exists only if the fetch ran from that worktree. A plain-clone fixture passes both bugs. Every seat checkout in this repo is a linked worktree.
- THE MAIN TREE'S GREETING NOW REPORTS TWO PROBLEMS, AND THAT IS C1 WORKING. It sits on origin/master, which still declares role: builder — outside the closed set, with no role file. The fix is on this branch; after the merge it becomes developer, and the planner's role: none file makes it say what it is.
- handoffs[] CARRIES ONLY THE QA SEAT'S ENTRY AND THAT IS NOT A BUG. The single slot could hold one. The developer's rev-50 handoff is reachable by SHA; the planner's does not exist until the planner's roll, which is C3's acceptance.
- CHECKING WHICH SEAT A CHECKOUT IS REASSIGNS THAT CHECKOUT'S SESSION IDENTITY. cli-bootstrap.js calls writeActiveSession and, given no session id, GENERATES one and stamps it over the slot. Running it to verify the seat overwrote this session's real uuid. Needs a gap id at close — G-044's family in the session-identity layer. ob_start's readAgentIdentity path is now a read-only door for the same question.

### Open questions

- Is the derived close-out SHA right for seats whose handoff predates several schema changes? It now crosses the v1 -> v2 boundary by comparing the seat's words rather than the entry's bytes, but that was found by running it, not by a test that anticipated it, and the next migration is the next chance to get it wrong.
- Does the greeting's +34% payload pay for itself? The role files are now loaded into every session that runs /start. Nothing yet measures whether a seat's behaviour changes because it read them — which is the same question the memory half has never been able to answer.
- Should the main tree declare role: none in a tracked file rather than an untracked one? The planner ruled it goes in an untracked AGENT.local.md written by Aaron after the merge, which means no clone, check or other seat can see that it happened — the same class as the AGENT.local.md edit at the start of this session.
- DOES THE MEMORY HALF GET USED AT ALL? ob_recall was not called once this session. The staleness rule, the cwd-drift rule and the pipe-masks-exit-code rule all live in the store and none surfaced; I re-derived the third from the repo's own role file instead. Eight loops.

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
