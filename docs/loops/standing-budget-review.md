# STANDING-BUDGET review (grok-sia-review), verbatim

Room [atlas, grok-sia-review] k57c639j4wkyp3y3vhfxxytn1s8fsdx6, job turn 41 (atlas), reply posted by grok-sia-review. Committed verbatim by Atlas (planner, s165) per D-127. Head reviewed: loop/standing-budget@42d974963ec093b2de74bb0b020d80966084985d (PR #532). The judge per clark's ruling: grok-sia-review, plus the planner's own re-run (35/35, tsc 0, mutants a/b/c red).

```text
REVIEW 1/1 42d97496
Scope: git diff 465de55b..42d97496 (3 commits, 3 files). Tree read only at 42d974963ec093b2de74bb0b020d80966084985d in a token-free scratch clone. Brief from master: docs/loops/standing-budget-brief.md. Not read: any QA report/job/evidence for this head. Ran Node v22.23.3.

Acceptance SB-1..SB-5 and the STANDING_RULES_LINE_CHARS check: all pass. No findings.

SB-1 PASS. At 42d97496, from open-brain/:
npx vitest run tests/pipelines/session-start/missing-handoff.test.ts tests/pipelines/session-start/standing-budget.test.ts --no-file-parallelism --testTimeout=20000
→ Test Files 2 passed (2); Tests 35 passed (35); EXIT=0
(missing-handoff 31, standing-budget 4).

SB-2 PASS. Record from origin/docs/s165-standing:.agents/state.json (20 standing). renderBriefing(..., { budget: true }) yields exactly one standing line:
STANDING RULES (20): D-137 D-135 D-130 D-127 D-126 D-125 D-123 D-120 D-119 D-118 D-117 D-113 D-091 D-069 D-065 D-062 D-060 D-055 D-031 D-029
Briefing size: 24 lines, 2275 chars (≤ 30 / ≤ 4096). Line length 140 ≤ STANDING_RULES_LINE_CHARS (200). Newest-first matches [...standing].reverse().

SB-3 PASS. Legacy renderBriefing(..., { budget: false }) on that record still includes header STANDING RULES and all 20 rules as one `- D-… — …` line each via standingRulesLines (briefing.ts:73-80); missing ids: none.

SB-4 PASS. Each mutant is one commit off the head; named test(s) red:
- origin/mutant/standing-budget-a @ 12f99b5b (no char cap): RED standing-budget.test.ts "60 standing rules: one capped line with +K more and the whole briefing inside budget" (expected line to match / \+\d+ more$/; got all 60 ids uncapped).
- origin/mutant/standing-budget-b @ 71d809e8 (standingRulesLines in budgeted): RED missing-handoff "the budget still holds with 20 standing rules in the record (fixture base, not live tags)" (34 ≰ 30) and the inject twin (37 ≰ 30); also RED standing-budget 60-rule and every-id-fits rows.
- origin/mutant/standing-budget-c @ 775c3a3f (stateWith no standing strip): RED missing-handoff "the budget still holds with 20 injected standing rules after live-record strip (master-safe)" (STANDING RULES (20): assertion false under polluted live mock).

SB-5 PASS. git diff --name-only 465de55b0b3d5c6113c9b8181a4ee8a97323b518..42d974963ec093b2de74bb0b020d80966084985d lists only:
open-brain/src/pipelines/session-start/briefing.ts
open-brain/tests/pipelines/session-start/missing-handoff.test.ts
open-brain/tests/pipelines/session-start/standing-budget.test.ts

STANDING_RULES_LINE_CHARS check PASS. Constant is 200 at briefing.ts:183. standingRulesBudgetLine (briefing.ts:84-101) reserves suffix space before each whole-id add, then appends ` +K more`; probe for N∈{1,5,20,60,100,200} always had line.length ≤ 200, whole ids only (/^D-\d+$/), newest first; N=0 → null (no line). renderBudgeted pushes that single line at briefing.ts:252-253.

Code notes (not findings): stateWith strips standing on the live path and on injectStanding (missing-handoff.test.ts), and keeps tags on an explicit fixture base — matches the round-2 intent that fixture bases keep their tags. Cap includes the ` +K more` suffix. Legacy path still uses uncapped standingRulesLines at briefing.ts:144.

looked: SB-1 missing-handoff.test.ts + standing-budget.test.ts at 42d97496 — found nothing; 35/35 pass
looked: SB-2 budgeted render on origin/docs/s165-standing 20-standing record — found nothing; one STANDING RULES (20) line, 24 lines / 2275 chars
looked: SB-3 legacy render on that record — found nothing; all 20 rules one per line
looked: SB-4 mutants a/b/c (origin/mutant/standing-budget-{a,b,c}, one commit off head) — found nothing; each red on named test(s) above
looked: SB-5 name-only diff vs 465de55b — found nothing; only briefing.ts + the two test files
looked: STANDING_RULES_LINE_CHARS=200 incl. +K more, whole ids, newest first (briefing.ts:84-101, :183, :252-253) — found nothing
looked: correctness/security/regressions in the three changed files — found nothing
Assumptions: decisions[] is oldest-first so .reverse() is newest-first (same as standingRulesLines; confirmed on the s165 record). Mutant "named test" = the red test(s) each mutant is designed to trip per the brief round-2 mut-a/b/c list.
time: ~18 min CT
```
