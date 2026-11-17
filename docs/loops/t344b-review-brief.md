# T344b review, round 2 (delta only): the budgeted briefing's new test rows (PR #1133, supersedes #1127)

Runtime: CC (claude -p, Opus)
SEAT: job runner (QA PC or Lenovo), NOT the desktop. No hub key. **Read-only: no commit, no push, no PR, no PR comment,
no edit outside the launcher's clone.** Ends at a VERDICT, which decides an SG-1 merge. You are the QA judge; the build
was a separate run (job 1294).
REPLY: the absolute reply path the launcher names. Print it FIRST. Line 1 of the reply is `VERDICT: ACCEPT`,
`VERDICT: ACCEPT-WITH-NOTES` or `VERDICT: REJECT`; line 2 is `MODEL: <your model id>`.

**By:** Atlas (planner), 2026-11-17, session 178. **Tasks:** T-344, T-312. **Tag:** `t344b-review`.
**Spec:** `docs/loops/t344b-brief.md` and `docs/loops/t344-brief.md` (both in the launcher's clone).
**START:** `d132ae00cddc0963b90afe0c5b41694b351075d1`. **CAND:** `2c7080cb76154064a78493db20f2b0e7a4e80608` (one commit on START,
branch `loop/t344b`). **Round-1 CAND:** `4ebf6d23f2b82868d752bedf581aeef5abb93165` (branch `loop/t344`).
Review CAND, never the launcher's own sha: `git fetch origin loop/t344b loop/t344` and
`git checkout -q 2c7080cb76154064a78493db20f2b0e7a4e80608`.

```text
IMPACT-TARGETS: none: review only; no repository file is changed
```

## Scope: the delta, not the source again

Round 1 (job 1287, on 4ebf6d23) read and ran the source and found it correct on behaviours (a) to (e), the legacy layout
unchanged and no budget check weakened. Its REJECT was four surviving mutants (F, G, H, J) and one nit (E), all test
gaps. The planner accepted them. CAND's source is byte-identical to round 1's; only
`open-brain/tests/pipelines/session-start/briefing-budget.test.ts` differs (+43 lines: one assertion in T312-1 and rows
T344-3 to T344-6). **Do not re-review the source.** The build run reported 168 passed in the twelve files and m1-m11
each red as predicted (m8-m11 are F, G, H, J).

## Steps

1. `node -v` must print `v22.*`. `git rev-parse HEAD` must print CAND.
   `git diff --stat 4ebf6d23 HEAD -- open-brain` must list exactly one file, the test file above, insertions only.
   `git diff --quiet 4ebf6d23 HEAD -- open-brain/src` must exit 0. Paste both.
2. Read the +43 lines. For each new row: is the fixture what its title says (count the lengths by running a one-line
   node expression, not by eye), and is the assertion exact (`toBe`/`toEqual` on the whole line or its length) rather
   than a loose `toContain`? Could the row pass for a reason other than the behaviour it names?
3. In `open-brain`: `npm ci`; `node -e "require('better-sqlite3')"`;
   `npx vitest run tests/pipelines/session-start tests/pipelines/sync --no-file-parallelism --testTimeout=180000`.
   Paste `Test Files` and `Tests`.
4. Apply round 1's F, G, H and J one at a time (the single-line changes at `briefing.ts:283`, `:286`, `:285`, `:266`
   that round 1 describes; `docs/loops/t344b/m8.txt` to `m11.txt` are the planner's versions and may be applied with
   `node docs/loops/t344b/apply.cjs . docs/loops/t344b/mN.txt`), run
   `npx vitest run tests/pipelines/session-start/briefing-budget.test.ts`, paste the red rows, restore with
   `git checkout -- open-brain/src`. Each must be red.

## Verdict

REJECT only for: a source difference from 4ebf6d23, a row red at CAND, one of F, G, H, J still surviving, or a new row
that asserts something false about the spec. **A further surviving mutant that is a test gap is a NOTE this round, not
a REJECT** (planner ruling: the source has been read and run by a judge and held; more rows go to a follow-up task).
Report any you happen to see under NOTES with file:line and the input. ACCEPT-WITH-NOTES otherwise; ACCEPT if none.
