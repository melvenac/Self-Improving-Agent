# T343c review, round 3 (delta only): one new test row for the stale-tree change (PR #1138, supersedes #1131)

Runtime: CC (claude -p, Opus)
SEAT: job runner (QA PC or Lenovo), NOT the desktop. No hub key. **Read-only: no commit, no push, no PR, no PR comment,
no edit outside the launcher's clone.** Ends at a VERDICT, which decides an SG-1 merge. You are the QA judge; the build
was a separate run (job 1300).
REPLY: the absolute reply path the launcher names. Print it FIRST. Line 1 of the reply is `VERDICT: ACCEPT`,
`VERDICT: ACCEPT-WITH-NOTES` or `VERDICT: REJECT`; line 2 is `MODEL: <your model id>`.

**By:** Atlas (planner), 2026-11-17, session 178. **Task:** T-343. **Tag:** `t343c-review`.
**Spec:** `docs/loops/t343c-brief.md`, `docs/loops/t343b-brief.md`, `docs/loops/t343-brief.md` (in the launcher's clone).
**START:** `993dba24c06cb7aaf49a9d9c814f896a33728df8`. **CAND:** `668bbc3748feff4f964ccc5bd5c67a8ea5f6fe62` (one commit on START,
branch `loop/t343c`). **Round-2 CAND:** `7486b537f4e07f192605d7c5dcc2595d6fa1f992` (branch `loop/t343b`).
Review CAND, never the launcher's own sha: `git fetch origin loop/t343c loop/t343b` and
`git checkout -q 668bbc3748feff4f964ccc5bd5c67a8ea5f6fe62`.

```text
IMPACT-TARGETS: none: review only; no repository file is changed
```

## Scope: the delta, not the source again

Round 1 (job 1285) and round 2 (job 1295) read and ran the source. Round 2 found F1 and F2 fixed and the source correct;
its REJECT was one surviving mutant, N2 (the `"--", ".agents"` pathspec dropped from the new `git status` call passed all
19 rows, yet turned "behind by code only, with an uncommitted edit to a tracked file outside `.agents/`" from the calm
line into STALE). The planner accepted it. CAND's source is byte-identical to round 2's (blob
`584e195173b0a42c52b8e72325a49ed609c2776d`); only the test file differs (+21 lines: row T343-20). **Do not re-review the
source.** The build run reported 62 passed in the six step-4 files and m1-m14 each red as predicted (m14 is N2, red on
T343-20 only; m1 gains T343-20).

## Steps

1. `node -v` must print `v22.*`. `git rev-parse HEAD` must print CAND.
   `git diff --stat 7486b537 HEAD -- open-brain` must list exactly one file,
   `open-brain/tests/pipelines/session-start/t343-tree-currency-content.test.ts`, insertions only.
   `git diff --quiet 7486b537 HEAD -- open-brain/src` must exit 0. Paste both.
2. Read the +21 lines. Is the fixture what the title says (a clone behind by one non-record file, with an uncommitted
   edit to a tracked file outside `.agents/`, proved by the row's own `git status` assertion), and is the assertion
   exact (the severity and the whole calm line)? Could the row pass for a reason other than the pathspec?
3. In `open-brain`: `npm ci`; `node -e "require('better-sqlite3')"`;
   `npx vitest run tests/pipelines/session-start --no-file-parallelism --testTimeout=180000`. Paste `Test Files`, `Tests`.
4. Apply N2 (`node docs/loops/t343c/apply.cjs . docs/loops/t343c/m14.txt`), run
   `npx vitest run tests/pipelines/session-start/t343-tree-currency-content.test.ts`, paste the red rows, restore with
   `git checkout -- open-brain/src`. It must be red on T343-20.

## Verdict

REJECT only for: a source difference from 7486b537, a row red at CAND, N2 still surviving, or T343-20 asserting
something false about the spec. **A further surviving mutant that is a test gap is a NOTE this round, not a REJECT**
(planner ruling: two judges have read and run the source and it held; more rows go to a follow-up task). Report any you
happen to see under NOTES with file:line and the input. ACCEPT-WITH-NOTES otherwise; ACCEPT if none.
