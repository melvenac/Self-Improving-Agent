<!-- generated from .agents/state.json rev 50 by open-brain v0.42.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 69)_

LOOP 15 SLICE TWO IS ACCEPTED AND MERGED. origin/master 4bed570, tagged v0.42.0, record rev 49 at merge; QA accepted 830af70 on all nine rows and A7's live pair was observed from the QA seat. The durable account is in tracked files, not in this slot: docs/loops/loop-15-slice-2-developer-handoff.md (the developer's — §9 covers the second candidate, §5 the two error entries, §10 an observation awaiting a gap id), docs/loops/loop-15-slice-2-qa-report.md and -2.md, and docs/loops/loop-15-slice-2-brief.md with its amendments. SEQUENCING IS ALREADY RULED: Loop 14 next, slice three after it. Slice three's mechanical first repair is G-045 — `git update-ref -d refs/heads/main` during a stage deletes the checked-out branch rather than moving it, the restore's HEAD check sees an unchanged NAME, and rev-parse fails inside enforceAllowlist before rollback runs. The principle the planner set for its A1: the restore reads nothing from the repository until the snapshot is fully restored.

## Watch out

- THIS HANDOFF SLOT IS ONE PER PROJECT AND THE NEXT SEAT'S CLOSE-OUT OVERWRITES IT. That has already cost one session: Probe's close-out at rev 46 overwrote the developer's at rev 45, and a later message then sent a fresh seat to a file that no longer held what it was said to hold. Everything above points at tracked files for that reason. Read the loop's docs/loops/ files, not only this slot.
- G-045 IS SLICE THREE'S FIRST REPAIR AND IT IS THE THIRD VARIANT OF ONE DEFECT. Delete-while-HEAD-names-it and a backwards move were closed in this loop; deleting the checked-out branch outright was not. The guard compared HEAD's NAME before and after when what mattered was whether HEAD RESOLVES — an instrument answering a different question, inside the fix for a defect of that family. Enumerate created / moved-forward / moved-backward / deleted / re-pointed against any restore: detection generalises over those and restore does not.
- FOUR CHANNELS ARE CLOSED AND THE LIST IS STILL NOT KNOWN TO BE COMPLETE. Working tree, commits, refs, HEAD — every one found only AFTER something used it. The index (`git update-index --assume-unchanged` is invisible to git status), hooks, config, submodules, packed-refs storage and the reflog are unprobed.
- A SCAN'S SCOPE AND AN ASSERTION'S ALTERNATION ARE BOTH PART OF THE CHECK. A6 failed because a correct detector was pointed at one region of one file; a shipped test passed on the defect it excluded because the second branch of `/moved HEAD|could not be rolled back/i` WAS that defect. The scan's targets are asserted as data now; the same question is owed to every alternation in an assertion.
- THE DONE GATE REJECTS THE STUB DIFF WHEN RUN LIVE, AND THAT IS THE GATE WORKING. A7 observed diff_matches_plan 0.26 and local_tests_support_claim 0.43 against a stub that writes one unrelated note file; loop exit 1. Expect it on any live run with stubbed roles rather than reading it as a regression.
- THE GATE THRESHOLDS ARE UNCALIBRATED AND THE DERIVED SCHEMA SAYS SO. Only has_observable_acceptance_min and the scope_size rule come from docs/HOH-JEV.md §4; every other number in harness/policies/*.json was chosen without data, and one live call is not a calibration.
- REDACTION DOES NOT COVER THE REQUEST BODY, BY DESIGN — HOH-JEV §8 now says so. A secret that reaches a role's deliverable travels to the API and into the D_t commit while the G_*.json beside it reads [REDACTED]. There is no second line of defence there.
- TWO DEVELOPER ERROR ENTRIES FROM THIS SEAT STAND (29 and 30): a live Jev call made from the wrong seat against this seat's own written statement, and the key value echoed into a session transcript. AARON WAS TOLD; ROTATION IS HIS CALL AND WAS NOT DONE AS OF THIS WRITE.
- RETENTION EVICTED A CITED TASK ON TWO CONSECUTIVE WRITES (G-024). T-151 and T-153, both preserved by hand into gaps, both noticed only because a dry run printed 'Dropped done tasks' in passing. The planner has taken the fix as a task; until it lands, read that line on every write.
- AN OBSERVATION IS WAITING FOR A GAP ID, IN §10 OF THE DEVELOPER HANDOFF: the record's session number counts CLOSE-OUT WRITES, not sessions. This one seat-session wrote end_session three times (67, 68, 69) under one uuid, so every per-session rate is computed against a denominator that inflates most for the loops that went worst. It was not given a number here because G-045 is reserved and taking the next free id would have broken every existing reference to it.

## Open questions

- Is TYPESAFE_API_KEY rotated? Told to Aaron 2026-09-20; not done as far as this seat knows.
- Is .agents/SYSTEM/PRD.md in Aaron's main checkout still behind? It is untracked and exists only there, so sync reports 1 issue in that tree and 0 in every other. `node open-brain/build/cli.js sync` run there fixes it. Raised across four sessions; the planner said it would put the one-line fix in front of him after merging.
- DOES THE MEMORY HALF GET USED AT ALL? ob_recalled returned 'No knowledge entries recalled this session' again — seven loops. Three entries were WRITTEN at the end of this one (594, 595, 596) and nothing read any entry during it. The ruled fix is a DETERMINISTIC trigger on an observable condition; still not sequenced.
- Do command-names and command-tool-names share the prohibition-vs-instance flaw? The four HARNESS scans each assert a planted positive and a planted near-miss; the two repo-level ones are still unexamined (T-156).
- Is the vitest worker-timeout condition (G-042) real on any machine when nothing else is running? Three full runs across two candidates — 882 and 896 here, 896 in QA's tree — all exit 0 with zero Unhandled / vitest-worker / timed-out lines. The only run that showed it had a second vitest, a tsx run and an HTTP call alongside it.

## Last session

Session 69 — 2026-09-20 — `284d6280-e781-457c-b5fc-9819f0936602`
