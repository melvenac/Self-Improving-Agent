# T-296-S1 QA review (grok-sia-review), copied verbatim

**Provenance:** hub room k57c639j4wkyp3y3vhfxxytn1s8fsdx6 (atlas <-> grok-sia-review), the reply to atlas turn 73 (job "SIA JOB: REVIEW fix/t296-task-briefs@a7092a53..."), read by the planner on 2026-10-16, session 173. **Planner ruling: ACCEPT** (SG-1 QA ACCEPT, judge other than the builder: D-135, D-140).

---

VERDICT T-296-S1 ACCEPT a7092a532bd2f38c8f207c36d66577a4569e7942

From: grok-sia-review (QA judge). Scope T-296-S1 / PR #804. Read-only.

1. Clone / identity
```
git clone … t296r && cd t296r && git checkout -q a7092a532bd2f38c8f207c36d66577a4569e7942
git rev-parse HEAD
a7092a532bd2f38c8f207c36d66577a4569e7942

git log --oneline 8230d636..HEAD
a7092a53 T-296-S1: Latest brief counts *-task.md briefs (A2A's l<N>-build-task.md)
9ee08193 T-296-S1: rows for task-named briefs

git diff --name-only 8230d636..HEAD
.claude/commands/start.md
open-brain/src/pipelines/session-start/latest-brief.ts
open-brain/tests/pipelines/session-start/latest-brief.test.ts
project-template/.claude/commands/start.md
project-template/.cursor/commands/start.md
```
Exactly 2 commits, exactly the 5 files. OK.

2. Diff vs brief Ruling (exact)
```
git diff 8230d636..HEAD -- open-brain/src .claude project-template
```
- BRIEF_NAME is exactly `/(^|-)((re)?brief|task)(-amendment-\d+)?\.md$/` (latest-brief.ts:91).
- One doc-comment line added above it (T-296: `*-task` counts too…).
- Header line-10 text replaced to include `` `-task.md` (T-296) `` / `` of any of them (T-233 C) ``.
- ROOT_BRIEF_NAME unchanged (`/^loop-.+-(re)?brief(-amendment-\d+)?\.md$/` at line 24; no ROOT_BRIEF hunk in the diff).
- Each of the three start.md copies: only the one-line replacement
  `` `*rebrief.md` or an `-amendment-N` of either `` → `` `*rebrief.md`, `*-task.md` or an `-amendment-N` of any of them ``; nothing else.
Difference vs ruling: none.

3. Tests
```
cd open-brain && npm ci && node -e "require('better-sqlite3')"
better-sqlite3 OK

npx vitest run tests/pipelines/session-start/latest-brief.test.ts tests/pipelines/sync/start-parity.test.ts --no-file-parallelism --testTimeout=180000
 ✓ tests/pipelines/session-start/latest-brief.test.ts (60 tests) 1830ms
 ✓ tests/pipelines/sync/start-parity.test.ts (11 tests) 22ms
 Test Files  2 passed (2)
      Tests  71 passed (71)
```
Both files pass; latest-brief.test.ts has 60 tests. OK.

4. Judgment (can BRIEF_NAME name a NON-brief as latest in this real repo?)
```
git ls-tree --name-only HEAD docs/loops/ | sed 's#.*/##' | grep -E -- '-task(-amendment-[0-9]+)?\.md$|^task\.md$'
t154-fix-1-task.md
t154-fix-2-task.md
t184-fix-1-task.md
t188-fix-1-task.md
t252-merge-fix-task.md
t252-mf-fix-1-task.md
t262-fix-1-task.md
t262-fix-2-task.md
```
All eight are dispatched Atlas task briefs (Runtime/SEAT/ROOM/REPLY headers; fix/build task text). None is a non-brief (job, results, notes, handoff). No `task.md` or `*-task-amendment-N.md` present. K2 exclusions (multitask.md, loop-9-task-2.md, *-task-notes.md, *.orig, etc.) do not match the regex. So in this repo the new BRIEF_NAME does not elevate a non-brief.

looked: BRIEF_NAME / isBrief / ROOT_BRIEF_NAME — match ruling; found nothing
looked: three start.md copies — one-line parity only; found nothing
looked: T-296 K1–K4 + start-parity tests — 60+11 green; found nothing
looked: docs/loops/*-task.md at HEAD — 8 dispatched task briefs only; found nothing

time spent: ~8 min

