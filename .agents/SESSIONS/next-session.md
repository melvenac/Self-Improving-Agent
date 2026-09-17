<!-- generated from .agents/state.json rev 29 by open-brain v0.38.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 63)_

Loop 12 is complete and merged: PRs #26-#30, v0.38.0 tagged, state rev 28. Loop 13 is Idea B - the module boundary - ruled by Aaron; the Planner is writing the brief. Read it from docs/loops/ by the largest loop number rather than from the mailbox, which no longer exists. Base is master @ 917fd68 at the time of writing - check it rather than assume it, and expect it to have moved.

## Watch out

- AN INSTRUMENT THAT CANNOT DISTINGUISH 'NOTHING THERE' FROM 'I DID NOT LOOK' IS NOT A MEASUREMENT. Six instances in session 63: a `|| echo 0` fallback, a blank `echo` firing over a real hit, MSYS mangling `git show <ref>:<path>`, a `find | head -25` truncation read as a complete inventory, a multi-line replace matching bare linefeeds against a CRLF file and printing 'fixed' while deleting a line, and escape sequences un-escaped in transit. THREE OF THEM ARRIVED INSIDE THE DOCUMENT DESCRIBING THE PATTERN. Reading the artifact caught all six; knowing the failure mode prevented none.
- Never count from a truncated list, and never act destructively on one. `find ... | head -25` produced 'six channels' for a directory that held nine - while enumerating what was about to be deleted.
- Line endings are NOT uniform in this repo: .agents/AGENT.md is LF, docs/loops/*.md is CRLF. Detect per file in any scripted edit, and READ THE FILE BACK afterwards - a tool reporting success is not the edit having landed.
- G-027: expected_revision serialises writes within one lineage, not across branches. Two seats read rev 25 and both wrote rev 26 on the same day; the collision was invisible until a git conflict at merge. Before writing state, check no other seat is about to, and hand over the NUMBER rather than the base.
- A retired name in prose is textually identical whether it is a defect or an obituary. If a check fires on correct text, add the path to that retirement's allowed_referrers - NEVER reword to dodge a check, which is how a check becomes decorative.
- The test suite is NOT type-checked (T-152). tsconfig is 'include: [src/**/*]' with one tsconfig, so `tsc --noEmit` exits 0 on a test file naming a deleted symbol. '603 tests passing' means behaviour is proven and the tests' own types are not.
- A test that pins a retired thing's behaviour FAILS WHEN YOU DO THE RIGHT THING, and is therefore the referrer most likely to be 'fixed' by restoring the behaviour instead of retiring the test.
- Read the ob_state dry run before the real call, every time - and note that gaps take what/evidence/recommended_update, NOT title/note. Both seats made that identical mistake on the identical file hours apart.

## Open questions

- Does the memory half get used at all? THREE consecutive loops have ended with ob_recalled returning 'No knowledge entries recalled this session'. Session-start injection is suspended (Loop 10 C2) and no deliberate mid-task recall was wanted in any of them. This is Loop 13's subject and the reason it was chosen over G-026.
- Is the intermittent suite failure one flake or two? One identified instance is sync/index.test.ts > 'does not auto-fix in check-only mode'; G-016 names state-writer.test.ts. Attribution deliberately left open.
- What forces a retirement to be RECORDED in the first place? The check verifies that recorded referrers are still present; nothing compels a new retirement to get an entry. The successor gap: a CUT ruling should not be closeable without one.
- docs/loops/ carried this loop's conclusions as a HABIT, not a mechanism. Nothing compels the next loop to put its boundary reports there - the same asymmetry as the retirement record, one layer up.

## Last session

Session 63 — 2026-09-17 — `fb43e236-e52a-4698-a7c0-8e1126975f7c`
