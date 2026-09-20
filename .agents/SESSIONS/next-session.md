<!-- generated from .agents/state.json rev 44 by open-brain v0.41.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 65)_

LOOP 15 SLICE ONE IS ACCEPTED. Candidate 4414bcc6f2d46fa62296d0ed65cb16a9b3c31752 on branch loop/15-hoh-runtime, accepted by Probe in QA report 2 at a2cb718 on branch qa/loop-15-report — every report-1 defect re-observed as fixed against the built candidate rather than taken from the handoff, 823/823 and 648/648 reproduced in the QA tree, sync --check clean with gitnexus-index reporting for real there. The first candidate was NOT accepted: enforcement observed the working tree, and a commit is invisible to a working-tree observer, so a role that committed its work bypassed both the allowlist and the freeze. The class was fixed rather than the instance. ONE DEFECT REMAINS OPEN AND IS RULED ONTO SLICE TWO AS ITS MANDATORY REPAIR TARGET: a role can force-move an existing tag, which is the same class through a third channel — refs. Nothing is pushed and nothing is tagged on master; the merge order and the v0.41.0 tag are Aaron's to give.

## Watch out

- A ROLE CAN ACT THROUGH A CHANNEL THE OBSERVER DOES NOT WATCH. Three channels found so far: the working tree, commits, and refs. Each was fixed only after a role used it. When adding an enforcement check, ask what ELSE reaches the repository — and watch refs rather than tags, because naming the channel narrowly is how the next one gets missed.
- ENFORCEMENT THAT READS `git status` IS BLIND TO A COMMIT, and committing is how a real session leaves its work. Any check about what a stage did must compare against a base commit, not against the working tree.
- A PIPELINE'S EXIT CODE IS NOT THE PROCESS'S. `npx vitest run | tail -8; echo $?` returns tail's 0 for a suite exiting 1. Redirect to a file and echo $? on the next line; never read a status through a pipe.
- THE SUITE CAN EXIT 1 WHILE PRINTING '823 passed'. A vitest unhandled error fails the run without failing a test. Read the exit code AND the Errors line, not the passed count.
- A NAME IS NOT EVIDENCE THAT A COMMAND RUNS. defaultChecks was asserted by matching /^npm(\.cmd)?$/ and never spawned, so a check that could not start on this platform passed its test for the life of a candidate. If a test is about whether something runs, run it.
- A SOURCE SCAN CAN MATCH THE SENTENCE FORBIDDING A THING AS THOUGH IT WERE THE THING. Twice in one session (G-040). Validate a scan against a planted positive AND a planted near-miss that must not fire, and read what its hits actually are.
- THE MAIN CHECKOUT IS NOT A QA FIXTURE. Both session hooks and the MCP server run from its build, so checking a candidate out there and rebuilding makes every session on this machine run unevaluated code until someone restores it. QA runs in the QA tree, made to resemble the main tree.
- NODE REFUSES TO SPAWN A .cmd WITHOUT A SHELL (18.20/20.12/22). Resolve npm to its JS entry and run it through node. Do not reach for shell: true.
- NOTHING IS PUSHED AND NOTHING IS TAGGED ON MASTER. A push needs Aaron's word for that push; a peer relay is not his approval.

## Open questions

- DOES THE MEMORY HALF GET USED AT ALL? Measured three times in this one session and recorded as G-039: entry 299 described the pipe defect, developer.md described the exit-code defect, and shared.md described the main-checkout hazard. All three were in context. None fired. Atlas ruled the fix must be a DETERMINISTIC trigger on an observable condition, with the unconditional-read shape used by CC memory as the other candidate. Not yet sequenced as a loop.
- Do the repo's own /sync source scans share the prohibition-vs-instance flaw? retirements handles it deliberately with allowed_referrers; command-names and command-tool-names match names in instruction files, where prohibitions get written, and nobody has looked.
- Is the vitest worker-timeout condition present on CI or on another machine? Load-dependent, one machine, and nothing in CI is known to distinguish it from a real test failure.
- Should a close note be amendable? Still open from session 64; ob_state makes it write-once.

## Last session

Session 65 — 2026-09-19 — `dbdce9b2-cd52-4ddd-81db-7105c4be4cd9`
