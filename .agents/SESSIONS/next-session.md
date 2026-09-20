<!-- generated from .agents/state.json rev 42 by open-brain v0.41.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 65)_

Loop 15 slice one is on its THIRD candidate: 4414bcc6f2d46fa62296d0ed65cb16a9b3c31752, branch loop/15-hoh-runtime, unpushed, awaiting Probe's re-evaluation. The first candidate was NOT ACCEPTED — Probe found four defects, three of them one class: enforcement observed the working tree, and a commit is invisible to a working-tree observer, so a role that committed its work bypassed both the allowlist and the freeze. Fixed by comparing against the diff from each stage's base commit, refusing any stage that moves HEAD, verifying identity before every tag, and asserting the candidate is the evidence commit's first parent. The fourth defect: default checks picked npm.cmd on win32 with shell:false, which Node refuses, so the README's own documented command exited 1 for anyone following it. Probe re-evaluates from its section 1; Atlas will run the checks in the main checkout so rule 13 is met on the re-evaluation.

## Watch out

- ENFORCEMENT THAT READS `git status` IS BLIND TO A COMMIT. This is the defect that failed QA and it is not exotic — committing is how a real session leaves its work, which is exactly what slice two's roles will be. Any future check about what a stage did must compare against a base commit, not against the working tree.
- A PIPELINE'S EXIT CODE IS NOT THE PROCESS'S. `npx vitest run | tail -8; echo $?` returns tail's 0 for a suite exiting 1. Redirect to a file and echo $? on the next line; never read a status through a pipe.
- THE SUITE CAN EXIT 1 WHILE PRINTING '823 passed'. A vitest unhandled error fails the run without failing a test. Read the exit code AND the Errors line, not the passed count.
- A SOURCE SCAN CAN MATCH THE SENTENCE FORBIDDING A THING AS THOUGH IT WERE THE THING. Twice in one session: the git-push scan fired on its own deny list, the shell scan on a comment saying 'the fix is not shell: true'. Validate a scan against a planted positive AND a planted near-miss that must not fire (recorded as G-040).
- A NAME IS NOT EVIDENCE THAT A COMMAND RUNS. defaultChecks was asserted by matching /^npm(\.cmd)?$/ and never spawned, so a check that could not start on this platform passed its test for the life of the candidate. If a test is about whether something runs, run it.
- NODE REFUSES TO SPAWN A .cmd WITHOUT A SHELL (18.20/20.12/22, CVE-2024-27980). On win32, resolve npm to its JS entry and run it through node. Do not reach for shell: true — that is how `^` got eaten and how an exit code stops belonging to the process under test.
- REGENERATE RENDERED VIEWS ON A REBASE CONFLICT, NEVER HAND-MERGE THEM. Take the base side, then run /sync.
- NOTHING IS PUSHED AND NOTHING IS TAGGED ON MASTER. Every commit on loop/15-hoh-runtime is local. A push needs Aaron's word for that push; a peer relay is not his approval.

## Open questions

- DOES THE MEMORY HALF GET USED AT ALL? Answered with a cost this session and recorded as G-039: entry 299 described the exact defect I then committed, ranked first for the question, and nothing asked. Atlas ruled the fix must be a DETERMINISTIC trigger on an observable condition, not an instruction to remember, and that the unconditional-read shape used by CC memory is the other candidate. Not yet sequenced as a loop.
- Is the vitest worker-timeout condition present on CI or on another machine? Load-dependent, measured on one Windows machine only, and nothing in CI is known to distinguish it from a real test failure.
- Do the repo's own /sync source scans share the prohibition-vs-instance flaw found twice in the harness tests? Nobody has looked.
- Should a close note be amendable? Still open from session 64; ob_state makes it write-once.

## Last session

Session 65 — 2026-09-19 — `dbdce9b2-cd52-4ddd-81db-7105c4be4cd9`
