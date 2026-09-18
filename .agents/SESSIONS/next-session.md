<!-- generated from .agents/state.json rev 33 by open-brain v0.38.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 63)_

Loop 13 is Idea B - the module boundary - ruled by Aaron. Its brief is docs/loops/LOOP-13-brief.md, landing in PR #31. READ THAT ONE BY NUMBER, NOT BY RECENCY: a Loop 14 brief already exists (PR #34, the two-seat record) and does not jump the queue, so 'the newest brief' is the WRONG file. Merge order is #33 (a real defect fix), then #32 (this close-out), then #31 which unblocks Loop 13, then #34. Base was master @ 917fd68 rev 28 at close; it will have moved - check it.

## Watch out

- THE BRIEF TO READ IS THE ONE FOR THE LOOP YOU ARE RUNNING, BY NUMBER. An earlier version of this handoff said 'by the largest loop number', which now points at Loop 14's brief. Written before Loop 14 was briefed ahead of Loop 13 running - a sorting rule that was correct when written and false within the day.
- THERE ARE NOW THREE WORKTREES and .agents/AGENT.md is ONE TRACKED FILE saying `name: Forge`, so /start greets whoever starts in ANY of them as Forge. The seat also carries three disagreeing names: Clark in the global CLAUDE.md, Atlas in AGENT.md's partner line, Planner in every brief since Loop 9. That is Loop 14's C1; do not fix it inside Loop 13.
- RULE 13 - A CHECK IS ONLY AS TESTED AS THE TREES IT HAS RUN IN. The retirements check shipped through four boundary reports, a Planner QA and five merged PRs, then fired 115 findings the first time it ran in Aaron's MAIN tree - the only one of three with a .gitnexus/ generated index. RUN THE LOOP'S CHECKS IN THE MAIN TREE BEFORE ANY SIGN-OFF, and rebuild it first: the MCP server runs from that build and a stale server reports success.
- AN INSTRUMENT THAT CANNOT DISTINGUISH 'NOTHING THERE' FROM 'I DID NOT LOOK' IS NOT A MEASUREMENT. Seven instances in session 63: a `|| echo 0` fallback, a blank `echo` over a real hit, MSYS mangling `git show <ref>:<path>`, a `find | head -25` truncation read as a complete inventory, a replace printing 'fixed' while deleting a line, escape sequences un-escaped in transit, and vitest reporting 'no tests' for a file that would not parse. THREE ARRIVED INSIDE THE WORK DESCRIBING THE PATTERN. Reading the artifact caught all seven; knowing the failure mode prevented none.
- After #33 the retirements check scans ONLY WHAT GIT TRACKS. That is deliberate - an untracked file does not ship, and the alternative is re-deriving .gitignore by hand - but it is a real narrowing: .agents/TASKS/research-wiki-audit.md, one of the three files Loop 11 held with Aaron, names a retired thing and is no longer reported.
- G-027: expected_revision serialises writes within one lineage, not across branches. Two seats read rev 25 and both wrote rev 26 in one day. Before writing state, check no other seat is about to, and hand over the NUMBER rather than the base.
- A retired name in prose is textually identical whether it is a defect or an obituary. If a check fires on correct text, add the path to that retirement's allowed_referrers - NEVER reword to dodge a check.
- The test suite is NOT type-checked (T-152): tsconfig is 'include: [src/**/*]' with one tsconfig, so `tsc --noEmit` exits 0 on a test file naming a deleted symbol.
- Line endings are MIXED in this repo - .agents/AGENT.md is LF, docs/loops/*.md is CRLF, and checks.test.ts has both. Detect per file in any scripted edit and READ THE FILE BACK; a tool reporting success is not the edit having landed.
- Read the ob_state dry run before the real call, every time. Gaps take what/evidence/recommended_update, NOT title/note - both seats made that identical mistake on the identical file hours apart.

## Open questions

- Does the memory half get used at all? THREE consecutive loops ended with ob_recalled returning nothing recalled. This is Loop 13's subject and the reason Idea B was chosen over G-026.
- Is the intermittent suite failure one flake or two? One identified instance is sync/index.test.ts > 'does not auto-fix in check-only mode'; G-016 names state-writer.test.ts. Attribution deliberately left open.
- What forces a retirement to be RECORDED in the first place? The check verifies recorded referrers are still present; nothing compels a new retirement to get an entry. A CUT ruling should not be closeable without one.
- The error count stands at 35 Planner / 24 Developer settled, opening Loop 14 at 37/25 once the #33 QA is written - two pending Planner entries (the retirements sign-off, the detachment claim) and one Developer (the retirements defect, self-reported).

## Last session

Session 63 — 2026-09-17 — `fb43e236-e52a-4698-a7c0-8e1126975f7c`
