# STANDING-BUDGET: standing rules fit the budgeted briefing

**By:** Atlas (planner), session 165, 2026-10-08. **Ruled by:** clark (coordinator, SG-1/D-135), 2026-10-08, on the
planner's proposal. It is a rendering detail inside E3/T-236, so it needs no word from Aaron. **Size:** LIGHT. Do not take
the QA PC's HEAVY lease: rivet's A2A L19 fix-1 has priority there. **Base:** `origin/master` at the SHA named in the
dispatch turn. **Branch:** `loop/standing-budget`. **PR:** its own small PR to master. Do not fold it into BRIEFING-FIX.

## The bug

PR #530 tags 20 decisions `standing: true` (E4). Its CI run 37850957063 fails one test:
`tests/pipelines/session-start/missing-handoff.test.ts:215` ("the budget still holds with the notice on and a pick-up at
its cap") reports `expected 37 to be less than or equal to 30`.

There are two causes, and both must be fixed:

1. `renderBudgeted` (`open-brain/src/pipelines/session-start/briefing.ts:230`) pushes `standingRulesLines(s)`. That is
   FLEET-AE E3's list: a blank line, a header, and one line per rule, **never capped**. The budgeted layout has a
   30-line / 4096-char budget (`BRIEFING_BUDGET`), so any standing rule at all eats into it without bound.
2. The test builds its state with `stateWith` → `readRepoRecord()`, the **live** `.agents/state.json`. So a records-only
   change (tagging decisions) can fail a code test. A test of the layout must not depend on what the live record holds.

## The ruling (do exactly this)

1. **Budgeted layout only:** standing rules render as **ONE line**, newest first, ids only:
   `STANDING RULES (N): D-137 D-135 D-130 …`
   If the ids would overflow the line, cut whole ids (never half an id) and end with `+K more`, where K is the number of
   ids not shown. Choose a char cap for the line and name it as a constant beside `CAPS`. When there are no standing
   rules, print **no line**, not `(0)`.
2. **The legacy layout is unchanged:** `renderBriefing`'s default path keeps the full list from `standingRulesLines`
   (briefing.ts:124). SIA's own greeting uses that layout, and it was verified to render all 20 rules on 2026-10-08.
3. **Tests:**
   - `stateWith` in `missing-handoff.test.ts` strips `standing` from every decision it copies. Check whether any other
     test reads `readRepoRecord()` and then renders a briefing, and fix those the same way. **List each file you checked
     in the report.**
   - A new test renders the budgeted layout's worst case **with N standing rules**, where N is large enough to force the
     `+K more` cut (for example 60). It asserts `lines <= BRIEFING_BUDGET.lines` and `chars <= BRIEFING_BUDGET.chars`,
     that the standing section is exactly one line, and that the line ends `+K more` with the right K.
   - A test where every id fits: no `+K more`, all N ids present, newest first.
   - A test with zero standing rules: no STANDING RULES line at all.
   - The existing E3 legacy-layout tests still pass unchanged.

## What the checks must NOT react to

- A records-only change to `.agents/state.json` (tags, decisions, handoffs). After this fix, `missing-handoff.test.ts`
  passes at #530's record (rev 360, 20 standing rules) **and** at master's (0 standing rules).
- The legacy layout's length. Only the budgeted layout has a budget.

## Building checks

Read `.agents/roles/developer.md` § **Building checks** and follow it. Under D-061 you do not run CI; report local
output only. **Mutants (D-137):** these are scoped to the changed lines. Show at least: (a) the cap removed (the ids
are never cut), so the N-rule test goes red; (b) `standingRulesLines` restored at the budgeted call site, so the budget
test goes red; (c) the `stateWith` strip removed, with a fixture of 20 standing rules, so the line-count test goes red.
Each mutant is one commit off your head. Name the test that goes red in each one.

## Report (reply in the hub room; end the turn after posting)

`READY <head sha40>`, the PR number, the files changed, local test output (the vitest summary line verbatim plus its
exit code; the exit code is read separately from the summary, see G-042), each mutant as `<sha> <test that went red>`,
and the list of files checked for `readRepoRecord()`.

## Acceptance (narrow QA: a Grok reviewer, not Claude QA, per clark)

| # | Check |
|---|---|
| SB-1 | The new tests and `missing-handoff.test.ts` pass on the head |
| SB-2 | On #530's record (`git show origin/docs/s165-standing:.agents/state.json`), the budgeted render gives one `STANDING RULES (20): …` line and the whole briefing is ≤ 30 lines / ≤ 4096 chars |
| SB-3 | The legacy render on that record still lists all 20 rules, one per line |
| SB-4 | The three mutants are each red on their named test |
| SB-5 | No file outside `open-brain/src/pipelines/session-start/briefing.ts` and `open-brain/tests/` changed |

On ACCEPT, clark merges under SG-1. #530 then updates its branch and goes green.

## Round 2 (hub turns 89 + 90, 2026-10-08)

Round 1 READY 914a6400 (PR #532). The planner found: mutants not on origin, mutant (c) guarded only on #530's record, and the cap checked before the `+K more` suffix. Turn 90 (below, verbatim) replaces turn 89's procedure and brings the brief up to `~/Worktrees/cursor-brief-checklist.md` (Aaron 10-08, via clark).

```text
TASK: STANDING-BUDGET ROUND 2 CORRECTION
Atlas to Infra. This turn REPLACES the procedure in turn 89. Turn 89's three items still stand, except where this turn changes them. Change: DO NOT PUSH MUTANTS.

SHELL: PowerShell. First run: $env:Path = 'C:\Program Files\nodejs;' + $env:Path; node -v. If it prints v24, STOP and reply BLOCKED. Paste the node -v output.
START STATE: your sia-infra checkout, branch loop/standing-budget. Run git rev-parse HEAD; git rev-parse origin/loop/standing-budget; git status --porcelain. Both SHAs must be 914a64002996a840728d171d8c0cc84104359ce8 and status must be empty. On any mismatch, STOP and reply BLOCKED.
FORBIDDEN: git stash, reset --hard, --force, rebase, amend, cd into any other tree. Do not touch PR #530 or branch docs/s165-standing.

FILES ALLOWED: open-brain/src/pipelines/session-start/briefing.ts, open-brain/tests/pipelines/session-start/missing-handoff.test.ts, open-brain/tests/pipelines/session-start/standing-budget.test.ts. Nothing else.
THE CAP: keep STANDING_RULES_LINE_CHARS = 200. The whole line, INCLUDING " +K more", is <= 200. Cut whole ids from the right (keep the newest).
STATEWITH: signature stateWith(sessions, handoffs, base: State = readRepoRecord().state). It structuredClones base, strips standing from every decision, then sets sessions/handoffs.
NEW TEST, in missing-handoff.test.ts: name it "the budget holds with 20 standing rules in the base record". Build the base as structuredClone(readRepoRecord().state) with decisions[0..19] each set standing: true. Then stateWith([], [same handoff as line 216 with pick_up "Pick up ".repeat(300)], base). renderBriefing(base(s, { budget: true, missingHandoff: NOTICE })). Expect lines.length <= BRIEFING_BUDGET.lines.
In standing-budget.test.ts's 60-rule test, also assert line.length <= 200.

COMMIT: exactly ONE commit on top of 914a6400, message: "STANDING-BUDGET r2: stateWith base param, 20-standing fixture test, cap includes +K more". Afterwards: git log --oneline 914a6400..HEAD shows 1 line, and git status --porcelain is empty.

TESTS (from open-brain/): npx vitest run tests/pipelines/session-start/missing-handoff.test.ts tests/pipelines/session-start/standing-budget.test.ts tests/pipelines/session-start/briefing.test.ts --no-file-parallelism --testTimeout=20000; echo EXIT=$LASTEXITCODE
No whole suite and no watch mode. Never pipe into head or tail. If it runs past 10 minutes, kill it and reply BLOCKED. If briefing.test.ts does not exist, run the files git grep -ln "renderBriefing" -- open-brain/tests lists instead, and paste that list.
TYPECHECK (from open-brain/): npx tsc --noEmit; echo EXIT=$LASTEXITCODE. Expect 0.
KNOWN RED: if a test fails that your change did not touch, run the same file at 914a6400 (git switch --detach 914a6400, run it, git switch loop/standing-budget) and paste both outputs. At most 2 fix attempts on your own failures, then STOP and reply BLOCKED.

MUTANTS: LOCAL ONLY, NEVER PUSHED. For each one: git switch -c mut-X <new head>, edit, commit "MUTANT X", run the tests command above, paste the red test name and its assertion line, then git switch loop/standing-budget. The tree must be clean after each.
 mut-a: in standingRulesBudgetLine, delete the length check (every id is shown). Expect red: the 60-rule test.
 mut-b: in renderBudgeted, replace the standingRulesBudgetLine push with out.push(...standingRulesLines(s)). Expect red: the 20-standing fixture test, and the 60-rule test.
 mut-c: in stateWith, delete the strip of standing. Expect red: "the budget holds with 20 standing rules in the base record", on the master record.
For each, paste git show --stat mut-X and the full diff from git diff <new head> mut-X.

PUSH: git push origin loop/standing-budget (never --force). Then git ls-remote origin refs/heads/loop/standing-budget must equal git rev-parse HEAD; paste both. If the push is rejected, STOP and reply BLOCKED. PR #532 already exists, so do not open a new one.
SCOPE: git diff --name-only 465de55b0b3d5c6113c9b8181a4ee8a97323b518..HEAD, pasted. It must list only the 3 allowed files.

REPLY: HUB_URL=http://100.124.212.87:4000 node <your A2A-Hub checkout>/scripts/hub-talk.mjs --as cursor-infra --session k57d92gqtjm9wpfs74ekbx9rns8fmy2f --say "<text>"
The first line is exactly "READY STANDING-BUDGET <sha40>" or "BLOCKED STANDING-BUDGET <reason>". Every number is pasted command output, with the command above it. Anything not run is marked NOT RUN. Then end your turn.
```
