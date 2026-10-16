# T-296-S2 QA review (grok-sia-review), PR #810 at ef22267c32bdb98f957aa21982b0fe284ca34c34

> Provenance: copied verbatim by Atlas (planner, session 173) from the grok-sia-review hub room
> k57c639j4wkyp3y3vhfxxytn1s8fsdx6, the reply to the T-296-S2 REVIEW job (atlas turn 75), received 2026-10-16.
> Job text: the planner scratch file grok-t296s2-review.md (same checks as docs/loops/t296-s2-qapc-review-brief.md).
> Planner re-checks (D-140): ls-remote head and the 2-commit / 5-file scope, and the two compact: call sites, re-run by the planner.

VERDICT T-296-S2 ACCEPT ef22267c32bdb98f957aa21982b0fe284ca34c34

From: grok-sia-review (QA judge). Scope T-296-S2 / PR #810. Read-only. Blind: no QA report/job/evidence for this head.

1. Clone / identity
```
git clone … t296s2r && cd t296s2r && git checkout -q ef22267c32bdb98f957aa21982b0fe284ca34c34
git rev-parse HEAD
ef22267c32bdb98f957aa21982b0fe284ca34c34

git log --oneline 24ddc764..HEAD
ef22267c T-296-S2: state_compact turns verified, gaps and other handoffs into one line each (opt-in, default off)
d5cecae9 T-296-S2: rows for the opt-in compact State block

git diff --name-only 24ddc764..HEAD
open-brain/src/pipelines/session-start/greeting-flags.ts
open-brain/src/pipelines/session-start/start-report.ts
open-brain/src/pipelines/session-start/state-render.ts
open-brain/src/pipelines/sync/checks.ts
open-brain/tests/pipelines/session-start/t296-state-compact.test.ts
```
Exactly 2 commits, exactly the 5 files. OK.

2. DEFAULT-OFF, by reading
```
git diff -w 24ddc764..HEAD -- open-brain/src/pipelines/session-start/state-render.ts
```
With whitespace ignored: zero content removals (else bodies are the prior Verified / Gaps / Other-handoffs blocks, re-indented only). Added executable material is only `compact?: boolean` + doc, `if (options.compact === true) {` / `} else {` / `}`, and lines inside the three compact-true branches. When `compact` is absent or false, `options.compact === true` is false and the else path runs the original bodies — no added/changed line does substantive work on that path.
```
git grep -n "compact:" -- open-brain/src
open-brain/src/pipelines/session-start/start-report.ts:255:      compact: greetingFlag(projectRoot, "state_compact"),
open-brain/src/pipelines/sync/checks.ts:2596:    compact: greetingFlag(projectRoot, "state_compact"),
```
Exactly two call sites, both from `greetingFlag(..., "state_compact")` (which is `=== true` only). OK.

3. DEFAULT-OFF, by running
```
cd open-brain && npm ci && node -e "require('better-sqlite3')"
better-sqlite3 OK

npx vitest run tests/pipelines/session-start/a2a-byte-identical.test.ts tests/pipelines/session-start/state-render.test.ts tests/pipelines/session-start/t296-state-compact.test.ts tests/pipelines/sync/greeting-size.test.ts --no-file-parallelism --testTimeout=180000
 ✓ tests/pipelines/session-start/state-render.test.ts (50 tests)
 ✓ tests/pipelines/sync/greeting-size.test.ts (14 tests)
 ✓ tests/pipelines/session-start/t296-state-compact.test.ts (7 tests)
 ✓ tests/pipelines/session-start/a2a-byte-identical.test.ts (3 tests)
 Test Files  4 passed (4)
      Tests  74 passed (74)
```
4 files pass; t296-state-compact has 7 tests; A2A golden file and a2a-byte-identical.test.ts are byte-unchanged vs base and green. OK.

4. No repo opts in
```
git ls-tree -r --name-only HEAD | grep -c "greeting.json"
1
```
Only `.agents/SYSTEM/greeting.json`. `git show HEAD:.agents/SYSTEM/greeting.json` has briefing_* / handoff_* / missing_handoff / role_docs_by_sha — no `state_compact`. OK.

5. Judgment (compact ON — does anything needed disappear?)
No. Compact only collapses the three surplus sections the brief names: non-reopened verified detail → REOPENED + one count line; per-gap lines → one newest/count line (Briefing already carries count+newest id); other seats' provenance+pick_up → one seat/session line. Own handoff (pick-up, watch-outs, open questions, loop state), tasks, objective, decisions line, and REOPENED verified claims are untouched in code and covered by C5/C1. Full text remains in state.json.

looked: state-render compact/else wrap (Verified, Gaps, Other handoffs) vs base -w — found nothing
looked: compact: wiring at start-report.ts:255 and checks.ts:2596 via greetingFlag — found nothing
looked: greeting.json / no state_compact at HEAD — found nothing
looked: t296-state-compact C1–C7 + a2a-byte-identical + state-render + greeting-size — 74 green; found nothing
looked: needed session-start content under compact (own handoff, tasks, objective, decisions, REOPENED) — found nothing

time spent: ~12 min

