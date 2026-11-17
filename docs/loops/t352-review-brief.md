# T352 review: the greeting-metrics row's budget_chars counts the printed pick-up (PR #1146)

Runtime: CC (claude -p, Opus)
SEAT: job runner (QA PC or Lenovo), NOT the desktop. No hub key. **Read-only: no commit, no push, no PR, no PR comment,
no edit outside the launcher's clone.** Ends at a VERDICT, which decides an SG-1 merge. You are the QA judge; the build
was a separate run (job 1351).
REPLY: the absolute reply path the launcher names. Print it FIRST. Line 1 of the reply is `VERDICT: ACCEPT`,
`VERDICT: ACCEPT-WITH-NOTES` or `VERDICT: REJECT`; line 2 is `MODEL: <your model id>`.

**By:** Atlas (planner), 2026-11-17, session 178. **Task:** T-352. **Tag:** `t352-review`.
**Spec:** `docs/loops/t352-brief.md` (in the launcher's clone).
**START:** `d1cbfdd6683e89ebc167e2d72a813fe1c690cc64`. **CAND:** `4b8abecf3506154e185785a9bd934fdb7989251c` (one commit on START,
branch `loop/t352`). Review CAND, never the launcher's own sha: `git fetch origin loop/t352` and
`git checkout -q 4b8abecf3506154e185785a9bd934fdb7989251c`.

```text
IMPACT-TARGETS: none: review only; no repository file is changed
```

## What it does

Since PR #1133 the budgeted briefing prints the reader's pick-up whole (cut only past 4000 characters) and the 4400
budget (`BRIEFING_BUDGET.chars`) is measured without the pick-up text. The greeting-metrics row still wrote
`greeting_chars` = the whole block beside `budget_chars` = 4400, and the fleet dashboard marks a greeting "does not fit"
when `greeting_chars > budget_chars`, so a correct briefing with a long pick-up read red. CAND: `renderBriefing` takes an
optional second argument (`BriefingPrinted`) that the budgeted layout fills with the length of the pick-up text as
printed; `renderStartReport` passes it to the row; `budget_chars` = 4400 + that length when the budgeted layout is on,
null when off. `greeting_chars` is unchanged. No new field, no schema bump.

## Already proved by the planner / reported by the build

- CAND is byte-for-byte START + `docs/loops/t352/edits.txt` + the copied test file (4 files SAME, no EXTRA).
- Build (Lenovo, Linux): eleven step-4 files 182 passed; m1-m7 each red exactly as predicted. Full suite, run BEFORE the
  commit: 5045 passed, 7 skipped, 2 failed: `tests/harness/checks.test.ts` D4 (known red at START on that host, an npm
  error) and `tests/harness/s4-guards.test.ts` D1b (the new test file was still untracked at that step; the build reran
  that file alone after the commit: 15 passed). **The full suite has not been seen clean on the committed tree: step 3
  runs it.**

## Rules

- Do not read, copy or print `~/.claude.json`, `~/.claude/settings.json`, any `.mcp.json`, `.env` or key file. Do not
  touch the real `~/.claude/open-brain/`: use a scratch HOME for anything that runs.
- Paste each command with its output. Every number is pasted output. Mark anything not run NOT RUN, with the reason.
- A finding needs file:line at CAND and a concrete failing input.

## Steps

1. `node -v` must print `v22.*`. `git rev-parse HEAD` must print CAND. `git diff --name-status d1cbfdd6..HEAD` must print
   three `M` source files (`briefing.ts`, `greeting-metrics.ts`, `start-report.ts`) and one `A` test file.
2. **Read** `git diff d1cbfdd6..HEAD -- open-brain/src`. Answer each, with the line:
   a. **The same quantity.** The T-344 rows in `tests/pipelines/session-start/briefing-budget.test.ts` measure the
      budget as `lines.join("\n").length - pickUp.length`. Is the number CAND adds to `budget_chars` exactly that
      excluded text's length in every case: a short pick-up, one with runs of whitespace or newlines (flattened), one
      past 4000 (cut, with its `(N chars)` suffix), an empty or whitespace-only pick-up, a reader with no handoff, and
      when notes ride the pick-up line (`Handoff MISSING`, `Already in origin/...`, `MAYBE SHIPPED`)? Name any input
      where `greeting_chars <= budget_chars` and "the briefing without its pick-up is within 4400" disagree, and by how
      many characters. `greeting_chars` is the block between the Briefing markers: say whether the markers or anything
      else outside `renderBriefing`'s lines enters `greeting_chars` and so shifts the comparison (that offset exists at
      START too; report its size, it is a NOTE unless CAND changes it).
   b. **Which handoff.** Is the length taken from the pick-up the briefing actually printed for this reader, and can the
      row ever carry a length from a different handoff or from a previous call (the `printed` object: where is it
      created, can it be shared across two `renderStartReport` calls in one server process)?
   c. **Off and legacy.** With `briefing_budget` off, is `budget_chars` null and is nothing else in the row or the
      printed briefing changed? Is the legacy layout's output byte-identical to START?
   d. **Callers.** Every caller of `renderBriefing` and `buildGreetingMetricsRow` in `open-brain/src` and the tests:
      do all still compile and behave the same with the new optional argument and field absent?
   e. **The row's shape.** Same keys in the same order as START, `GREETING_METRICS_SCHEMA` unchanged?
3. **Run**, in `open-brain` with a scratch HOME: `npm ci`; `node -e "require('better-sqlite3')"`;
   `npx vitest run --no-file-parallelism --testTimeout=180000` (the FULL suite on the committed tree; paste
   `Test Files`, `Tests`, any `Errors` line and any Unhandled Errors section). A red row other than
   `tests/harness/checks.test.ts` D4 on the Lenovo host: run that file alone at CAND and at START (use
   `git worktree add ../t352-start d1cbfdd6` and `npm ci` there; `git stash` is forbidden) and say which side is red.
4. **Surviving mutants.** Name any single-line change to the new code that the six T352 rows would not catch; apply,
   run `npx vitest run tests/pipelines/session-start/t352-budget-chars.test.ts`, paste, restore with
   `git checkout -- <file>`. Try at least: the `own.pick_up.trim() !== ""` guard dropped; `pickUp.length` replaced by
   the unflattened `own.pick_up.length`; `printed.pickUpPrintedChars` not passed in `start-report.ts`; the addition
   applied when the budget is off.

## Verdict

REJECT for: any input in 2a where the comparison gives the wrong answer because of CAND (a real over-budget briefing
reads as fitting, or a fitting one reads over); a length from the wrong handoff or a previous call (2b); any change to
the printed briefing or to the row with the budget off (2c); a changed key order or schema (2e); a row red at CAND and
green at START; or a surviving mutant that changes the number the row carries. A surviving mutant that is only a test
gap on an input the source handles correctly is a NOTE (planner ruling, T-351). ACCEPT-WITH-NOTES for anything else.
List findings, then NOTES and NITS, then what was NOT RUN.
