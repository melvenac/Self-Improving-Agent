# T348 review: the first state write of a session names the reads owed at start (PR #1135)

Runtime: CC (claude -p, Opus)
SEAT: job runner (QA PC or Lenovo), NOT the desktop. No hub key. **Read-only: no commit, no push, no PR, no PR comment,
no edit outside the launcher's clone.** Ends at a VERDICT, which decides an SG-1 merge. You are the QA judge; the build
was a separate run (job 1264).
REPLY: the absolute reply path the launcher names. Print it FIRST. Line 1 of the reply is `VERDICT: ACCEPT`,
`VERDICT: ACCEPT-WITH-NOTES` or `VERDICT: REJECT`; line 2 is `MODEL: <your model id>`.

**By:** Atlas (planner), 2026-11-17, session 178. **Task:** T-348. **Tag:** `t348-review`.
**Spec:** `docs/loops/t348-brief.md` (in the launcher's clone).
**START:** `6ca47038b1032b6feee1150cc37698968b200df7`. **CAND:** `9c41a23ef909e65d3b084572e7f1b6288bc67b80` (one commit on START,
branch `loop/t348`). Review CAND, never the launcher's own sha: `git fetch origin loop/t348` and
`git checkout -q 9c41a23ef909e65d3b084572e7f1b6288bc67b80`.

```text
IMPACT-TARGETS: none: review only; no repository file is changed
```

## What it does

`ob_start` saves the session's READS OWED list to `.reads-owed.json` in the per-project end-record directory (outside the
repo). The first applied `ob_state` write of that proven session appends one line to its result,
`READS OWED at start (N), confirm each was read: <paths>`, then never again. It is a reminder, not a check that a read
happened: nothing in SIA records a Read, and that is the planner's accepted design. It must never refuse or alter the
write.

## Already proved by the planner / reported by the build

- CAND is byte-for-byte START + `docs/loops/t348/edits.txt` + the copied test file (4 files SAME, no EXTRA).
- Build (Windows QA PC): ten step-4 files 141 passed; m1-m5 red exactly as predicted. Its full suite ran slowly:
  4940 passed, 75 skipped in 7 files, 1 failed (`s4-guards` D1b, because the new test file was still untracked at that
  step; green after `git add`), and four unhandled `Timeout calling "onTaskUpdate"` errors (the known T-292 class).
  **The full suite has therefore not been seen clean on this change: step 3 runs it.**

## Rules

- Do not read, copy or print `~/.claude.json`, `~/.claude/settings.json`, any `.mcp.json`, `.env` or key file. Do not
  touch the real `~/.claude/open-brain/` or its end-record directories: use a scratch HOME for anything that runs.
- Paste each command with its output. Every number is pasted output. Mark anything not run NOT RUN, with the reason.
- A finding needs file:line at CAND and a concrete failing input.

## Steps

1. `node -v` must print `v22.*`. `git rev-parse HEAD` must print CAND. `git diff --name-status 6ca47038..HEAD` must print
   three `M` source files (`reads-owed.ts`, `start-report.ts`, `server.ts`) and one `A` test file.
2. **Read** `git diff 6ca47038..HEAD -- open-brain/src`. Answer each, with the line:
   a. **Never harms the write.** Can any failure in the new code (unwritable or missing directory, corrupt or
      hand-edited `.reads-owed.json`, a `paths` value that is not an array of strings, a huge list) throw out of
      `handleState` or `renderStartReport`, change the write's result apart from the one appended line, or turn a
      successful write into an error? Is the line appended only AFTER the state write has been applied?
   b. **Once, for the right session.** Line printed: on the first applied write only; not on a dry run (and a dry run
      does not use it up); not for an unproven session; not for another session's record; not when the list is empty.
      Two sessions in one checkout (planner and a developer seat share a repo in different worktrees: is the store keyed
      by project directory, by checkout, or by repo?): can session B's start erase session A's unreminded list, and can
      A then get B's list? Say what happens and whether it is only a lost reminder or a wrong one.
   c. **A second `/start`** in the same session, before and after the reminder: what is stored and printed?
   d. **`describeReadsOwed` unchanged.** Is its printed line byte-identical to START for every input, and do all its
      existing callers still compile and behave the same with the new optional last parameter?
   e. **Read-only and CLI paths.** `renderStartReport` has a readOnly mode and a CLI route (`cli.js start`, no proven
      session): does either write the file? Should they?
   f. **Where the file lands.** Is `.reads-owed.json` ever written inside the repository or a tracked directory? Does
      `/sync` or any guard scan the end-record directory and now report a new unknown file?
   g. The appended line: with 7 or more paths, is the `+K more` count right; can a path containing a newline or a
      control character break the single line?
3. **Run**, in `open-brain` with a scratch HOME: `npm ci`; `node -e "require('better-sqlite3')"`;
   `npx vitest run --no-file-parallelism --testTimeout=180000` (the FULL suite; paste `Test Files`, `Tests`, any
   `Errors` line and any Unhandled Errors section). A red row: run that file alone at CAND and at START (use
   `git worktree add ../t348-start 6ca47038` and `npm ci` there; `git stash` is forbidden) and say which side is red.
   `tests/harness/checks.test.ts` D4 is known red at START on the Lenovo host (an npm error) and is not this change.
4. **Surviving mutants.** Name any single-line change to the new code that the six T348 rows would not catch; apply,
   run `npx vitest run tests/pipelines/session-start/t348-reads-owed-reminder.test.ts`, paste, restore with
   `git checkout -- <file>`. Try at least: the session-id comparison dropped (another session's list is used); the
   reminder appended before the write is applied; the `readOnly` guard dropped; the 6-path cap off by one.
5. **Live shape.** `npm run build`. With a scratch HOME and a fixture project whose handoff names an existing `.md`
   brief committed after the previous session date (the T348-5 fixture shape), drive `handleStart` then `handleState`
   twice from a small node script against the build (the way `tests/server.test.ts` proves a session), and paste the
   two `ob_state` results' last lines. If proving a session outside vitest needs more than the fixture has, say so and
   mark it NOT RUN.

## Verdict

REJECT for: any path where the new code throws out of, alters or blocks a state write or a start (2a); the line printed
for the wrong session or with another session's paths (2b); a write inside the repository (2f); a changed
`describeReadsOwed` line (2d); a row red at CAND and green at START; or a surviving mutant that changes who sees the
line or what it lists. A lost reminder when two sessions share one store is a NOTE if the report says so plainly.
ACCEPT-WITH-NOTES for anything else. List findings, then NOTES and NITS, then what was NOT RUN.
