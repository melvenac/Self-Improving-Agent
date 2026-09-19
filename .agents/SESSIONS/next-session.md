<!-- generated from .agents/state.json rev 41 by open-brain v0.41.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 65)_

Loop 15 slice one is built and handed to Probe for evaluation — the first time acceptance in this project is determined by a seat that neither set the objective nor built the candidate. Frozen candidate 1c8e6ca9cc5d407da4649120426ca5defa3cd9f7 on branch loop/15-hoh-runtime, with docs/loops/loop-15-developer-handoff.md at d4e2180 as the durable handoff. The runtime runs planner -> developer -> QA with stubbed roles, enforcing a write allowlist and a frozen candidate. Two rulings are owed from Atlas and are named in the handoff: whether D_t may refuse an empty repair_targets, a rule the brief does not spell out, and whether the runtime may create loop-NNN-* tags given that HOH-JEV.md 6.2 says it never tags while brief A5 requires them.

## Watch out

- A PIPELINE'S EXIT CODE IS NOT THE PROCESS'S. `npx vitest run | tail -8; echo $?` returns tail's 0 for a suite exiting 1. This was committed THIS session while building the component whose acceptance criterion is 'check results come from exit codes'. Redirect to a file and echo $? on the next line; never read a status through a pipe.
- THE SUITE CAN EXIT 1 WHILE PRINTING '805 passed'. A vitest unhandled error fails the run without failing a test. Read the exit code AND the Errors line, not the passed count.
- THE FIRST FIX THAT LOOKS SUFFICIENT MAY CHANGE NOTHING. Cutting ~200 child processes did not clear the worker timeout; an awaited async rm over .git did. Measure after each fix separately rather than bundling them and crediting the wrong one.
- REGENERATE RENDERED VIEWS ON A REBASE CONFLICT, NEVER HAND-MERGE THEM. The four state views conflict whenever a version bump meets a state write. Take the base side, then run /sync.
- MSYS MANGLES A GIT PATHSPEC IN GIT BASH. `git show origin/master:.agents/state.json` reached git as `origin\master;.agents\state.json`. Same family as cmd.exe eating ^ — use execFileSync with an args array, or read the working-tree file.
- A SOURCE SCAN CAN MATCH THE RIGHT TEXT AND ANSWER THE WRONG QUESTION. The 'no git push in harness' scan fired on the deny-list constant, where the word appears because it is forbidden. Validate a detector against a planted positive AND check what its hits actually are.
- NOTHING IS PUSHED AND NOTHING IS TAGGED. Every commit on loop/15-hoh-runtime is local. A push needs Aaron's word for that push; a peer relay is not his approval.

## Open questions

- DOES THE MEMORY HALF GET USED AT ALL? ob_recalled has now returned nothing for five consecutive loops. Loop 13 built the instrument and Loop 15 did not use it either. Nobody has yet run a loop that deliberately exercises recall.
- May D_t refuse an empty repair_targets? Enforced on my reading of HOH-JEV.md's symmetric rule; the brief names only the new_capability rejection. This runtime would refuse a plan the brief would accept.
- May the runtime create loop-NNN-* tags? HOH-JEV.md 6.2 says it never tags; brief A5 requires loop-001-developer and loop-001-qa. Resolved by judgement as being about master, and constrained to local tags with all network git subcommands refused.
- Is the vitest worker-timeout condition present on CI or on another machine? Load-dependent, measured on one Windows machine only, and nothing in CI is known to distinguish it from a real test failure.
- Should a close note be amendable? Still open from session 64; ob_state makes it write-once.

## Last session

Session 65 — 2026-09-19 — `dbdce9b2-cd52-4ddd-81db-7105c4be4cd9`
