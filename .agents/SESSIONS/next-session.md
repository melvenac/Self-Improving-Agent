<!-- generated from .agents/state.json rev 45 by open-brain v0.41.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 65)_

SLICE TWO IS NEXT, with G-041 as its mechanical first repair, then Loop 14 (Aaron, 2026-09-20). Slice one shipped at v0.41.0 (master fdb7a8c, record rev 44) and the seat rolls after every complete loop, so this is a fresh developer session. START BY READING THE CODE, NOT THE RECORD: open-brain/src/harness/ is the whole runtime — runLoop and the stage loop in runtime.ts, the RoleSession interface and stubRoles in roles.ts, enforcement in workspace.ts, git helpers in git.ts, deterministic checks in checks.ts, the gate seam in gate.ts. The CLI entry is cli.ts, and cli.ts:167 is the line that hardcodes stubRoles() — that line is why slice one is safe with G-041 open, and slice two's first act changes it. docs/HOH-JEV.md is the loop contract and names slice two as the Jev client plus the plan and developer-done gates. The QA reports at docs/loops/loop-15-qa-report.md and -2.md are worth reading in full before touching enforcement; they found what the author and the code did not.

## Watch out

- G-041 IS SLICE TWO'S MANDATORY FIRST REPAIR AND IT GATES EVERYTHING ELSE. A role can force-move an existing tag: no commit, no file write, HEAD untouched, loop completes at exit 0. Design sketched and agreed: snapshot refs before each stage, compare after, refuse any change the runtime did not make — REFS, NOT TAGS, because watching tags alone leaves branches and update-ref. Then make the constraint mechanical rather than remembered: the runtime REFUSES any role it did not construct itself unless a ref-watch is present, one flag at runLoop entry, failing closed, SEEN RED BEFORE the first real role is wired. That refusal is slice two's A1.
- EVERY ENFORCEMENT CHANNEL SO FAR WAS FOUND ONLY AFTER SOMETHING USED IT — working tree, then commits, then refs. The list is not known to be complete. Before adding a check, ask what ELSE reaches the repository, and state the limit in the check's own output.
- COMMITTING IS HOW A REAL SESSION LEAVES ITS WORK. Slice one's tests all used stubs that wrote without committing, so the mainline path was the untested one. When the roles become real sessions, the 'adversarial' case and the normal case are the same case.
- THE SUITE CAN EXIT 1 WHILE PRINTING ALL TESTS PASSED (G-042). A vitest unhandled error fails the run without failing a test, it is load-dependent, and it is uncharacterised on CI. Read the exit code AND the Errors line. Never read a status through a pipe — `cmd | tail; echo $?` reports tail's.
- T-156 NEEDS FIXTURES, NOT A PATTERN TWEAK. The scans it covers must be validated against a planted POSITIVE and a planted NEAR-MISS that must not fire — a sentence forbidding a thing is textually identical to an instance of it. The two harness scans that hit this are in tests/harness/git.test.ts and checks.test.ts; the unexamined repo ones are command-names and command-tool-names.
- TYPESAFE_API_KEY IS READ FROM THE ENVIRONMENT AND NEVER WRITTEN TO A FILE, A PROMPT, A PAYLOAD LOG, AN ARTIFACT OR A COMMIT. gate.ts already redacts by live value AND by field name; keep both, because value-matching alone reports a clean payload when the variable is unset.
- THE MAIN CHECKOUT IS NOT A QA FIXTURE. Both session hooks and the MCP server run from its build. QA runs in the QA tree; seat worktrees are detached at rest, returned with `git checkout --detach origin/master`.
- NOTHING IS PUSHED FROM THIS SEAT. A push needs Aaron's word for that push; a peer relay is not his approval.

## Open questions

- ONE ISSUE IS OPEN IN AARON'S MAIN CHECKOUT AND NOWHERE ELSE: .agents/SYSTEM/PRD.md still names a version older than 0.41.0, so sync reports 1 issue there and 0 in every other tree, because the file is untracked and exists only in his. The fix is the auto-fix path, `node open-brain/build/cli.js sync` run in that tree. I asked Aaron whether to run it and did not get an answer before the seat rolled; it is unresolved, not forgotten, and it will block the next /sync-before-commit in the main tree.
- DOES THE MEMORY HALF GET USED AT ALL? G-039, measured three times in session 65: entry 299, developer.md and shared.md each described a defect that was then committed, all three in context, none fired. Ruled that the fix must be a DETERMINISTIC trigger on an observable condition, with the unconditional-read shape as the other candidate. Not yet sequenced.
- Do command-names and command-tool-names share the prohibition-vs-instance flaw? T-156 covers it; nobody has looked.
- Is the vitest worker-timeout condition present on CI or another machine? One machine, load-dependent.

## Last session

Session 65 — 2026-09-20 — `dbdce9b2-cd52-4ddd-81db-7105c4be4cd9`
