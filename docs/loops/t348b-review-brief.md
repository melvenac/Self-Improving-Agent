# T348b review, round 2 (delta only): three new test rows for the reads-owed reminder (PR #1141, supersedes #1135)

Runtime: CC (claude -p, Opus)
SEAT: job runner (QA PC or Lenovo), NOT the desktop. No hub key. **Read-only: no commit, no push, no PR, no PR comment,
no edit outside the launcher's clone.** Ends at a VERDICT, which decides an SG-1 merge. You are the QA judge; the build
was a separate run (job 1310).
REPLY: the absolute reply path the launcher names. Print it FIRST. Line 1 of the reply is `VERDICT: ACCEPT`,
`VERDICT: ACCEPT-WITH-NOTES` or `VERDICT: REJECT`; line 2 is `MODEL: <your model id>`.

**By:** Atlas (planner), 2026-11-17, session 178. **Task:** T-348. **Tag:** `t348b-review`.
**Spec:** `docs/loops/t348b-brief.md` and `docs/loops/t348-brief.md` (in the launcher's clone).
**START:** `748bf793190918a2a65f719cf009aae3b5888195`. **CAND:** `796b4fcca99f2e963360a29942d28d2ff7bdb03a` (one commit on START,
branch `loop/t348b`). **Round-1 CAND:** `9c41a23ef909e65d3b084572e7f1b6288bc67b80` (branch `build/t348`).
Review CAND, never the launcher's own sha: `git fetch origin loop/t348b build/t348` and
`git checkout -q 796b4fcca99f2e963360a29942d28d2ff7bdb03a`.

```text
IMPACT-TARGETS: none: review only; no repository file is changed
```

## Scope: the delta, not the source again

Round 1 (job 1301, on 9c41a23e) read and ran the source and found it correct on every question (2a to 2g), with the
full suite clean on Linux apart from D4, which is red at START too. Its REJECT was two surviving mutants, both test
gaps: M12 (`collect.push(...paths.slice(0, 6))`: the count and list are unpinned for 7 or more owed paths) and M5 (the
refusal branch also calls `readsOwedReminder`: a refused first write uses the reminder up), plus the two-line M4 (the
reminder computed before the write is applied) and a note, M7 (the string check on a hand-edited record's `paths`).
The planner accepted them. CAND's three source files are byte-identical to round 1's; only
`open-brain/tests/pipelines/session-start/t348-reads-owed-reminder.test.ts` differs (+72 lines: rows T348-7, T348-8,
T348-9). **Do not re-review the source.** The build run reported 144 passed in the ten step-4 files and m1-m8 each red
exactly as predicted (m6 = M12, m7 = M5, m8 = M7).

## Steps

1. `node -v` must print `v22.*`. `git rev-parse HEAD` must print CAND.
   `git diff --stat 9c41a23e HEAD -- open-brain` must list exactly one file, the test file above, insertions only.
   `git diff --quiet 9c41a23e HEAD -- open-brain/src` must exit 0. Paste both.
2. Read the +72 lines. For each new row: is the fixture what its title says, and is the assertion strong enough to
   mean it? In particular:
   - T348-7 asserts relationally (the reminder's N equals the start line's N, N is at least 7, the same six paths,
     `, +(N-6) more`). Print the start line and the reminder line the row actually produces (add a temporary
     `console.log`, run the row, then `git checkout -- <file>`), and say what N is and whether the six listed paths are
     the first six the start line shows.
   - T348-8: is the first call really refused before any state change (the revision unchanged afterwards), and does
     the row check the refused result has no reminder line, the next applied write has it, and a third has none?
   - T348-9: does the write still succeed with the malformed record, with no line?
   Could any of the three pass for a reason other than the behaviour it names?
3. In `open-brain`: `npm ci`; `node -e "require('better-sqlite3')"`;
   `npx vitest run tests/pipelines/session-start tests/server.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste `Test Files` and `Tests`.
4. Apply `docs/loops/t348b/m6.txt`, `m7.txt` and `m8.txt` one at a time
   (`node docs/loops/t348b/apply.cjs . docs/loops/t348b/mN.txt`), run
   `npx vitest run tests/pipelines/session-start/t348-reads-owed-reminder.test.ts`, paste the red rows, restore with
   `git checkout -- open-brain/src`. Each must be red. Then round 1's two-line M4 (the reminder computed before
   `applyStateOps`, as round 1 describes it): apply by hand, run the same file, paste; it must be red on T348-8.

## Verdict

REJECT only for: a source difference from 9c41a23e, a row red at CAND, M12, M5 or M4 still surviving, or a new row
that asserts something false about the spec. **A further surviving mutant that is a test gap is a NOTE this round, not
a REJECT** (planner ruling: a judge has read and run the source and it held; more rows go to a follow-up task). M7
surviving would be a NOTE. Report anything else you see under NOTES with file:line and the input.
ACCEPT-WITH-NOTES otherwise; ACCEPT if none.
