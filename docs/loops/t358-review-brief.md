# T358 review: a task's predicted and observed effect, and the close rule (PR #1169)

Runtime: CC (claude -p, Opus)
SEAT: job runner (QA PC or Lenovo), NOT the desktop. No hub key. **Read-only: no commit, no push, no PR, no PR comment,
no edit outside the launcher's clone.** Ends at a VERDICT, which decides an SG-1 merge. You are the QA judge; the build
was a separate run (job 1535).
REPLY: the absolute reply path the launcher names. Print it FIRST. Line 1 of the reply is `VERDICT: ACCEPT`,
`VERDICT: ACCEPT-WITH-NOTES` or `VERDICT: REJECT`; line 2 is `MODEL: <your model id>`.

**By:** Atlas (planner), 2026-11-20, session 178. **Task:** T-358. **Tag:** `t358-review`.
**Spec:** `docs/loops/t358-brief.md` (in the launcher's clone).
**START:** `5ff576060819dc57f212060a9dc2098d5e8d8125`. **CAND:** `76e453736e911d8d8c4504e0436741886d8ec0b5` (one commit on
START, branch `loop/t358`). Review CAND, never the launcher's own sha: `git fetch origin loop/t358` and
`git checkout -q 76e453736e911d8d8c4504e0436741886d8ec0b5`.

```text
IMPACT-TARGETS: none: review only; no repository file is changed
```

## What the change is

`ob_state` tasks gain two optional text fields. `predicted` (set by `open_task` or `update_task`) says what the task's
change should fix or move, written before the change. `observed` (set by `update_task` or `close_task`) says what was
seen afterwards. Rules, all in `editEffect` in `open-brain/src/shared/state-writer.ts`:

1. `close_task` refuses a task that has `predicted` and no `observed` (stored or in the op).
2. `observed` is refused when the task has no `predicted` (stored or in the same op).
3. `predicted` is refused once the task has `observed`.
4. A task with neither field behaves as before. The record stays schema v3. No view prints the fields.

## Already proved by the planner / reported by the build

- CAND is one commit on START touching exactly five paths, and every file is byte-equal to START plus the spec's
  `edits.txt` and its test file (`byte-compare.sh`: five SAME, no EXTRA).
- Build (job 1535, Lenovo): both `tsc` runs and the build exit 0; the nine named files 190 passed; m1-m15 each red as
  predicted; full suite 5098 passed, 7 skipped, 2 failed: `tests/harness/checks.test.ts` D4 (known red at START) and
  `tests/harness/s4-guards.test.ts` D1b, which failed only because the new test file was not yet tracked when the suite
  ran (it passed once the file was added to the index). **The full suite has NOT been run on the committed tree.**

## Ruled already, NOT findings

- No schema version bump. A build without this change refuses a record that carries `predicted`, as a parse error
  (strict schema). The spec's "After merge" handles the order. You may NOTE a better message; it is not a REJECT.
- The printed line reads `NOTE CHANGE: <id> predicted SET: <n> chars`, reusing the note-change channel.
- `reopen_task` keeps both fields, so a reopened task can close again with its old `observed`.
- No CHANGELOG or version edit in this PR.

## Rules

No real `~/.claude`, no write to this repository's `.agents/state.json`, every record you write lives in a temp folder
outside the clone. Every number is pasted output with its command. A finding needs file:line at CAND and a concrete
failing input (the ops, the starting record, what happened, what should have).

## Steps

1. `node -v` must print `v22.*`. `git rev-parse HEAD` must print CAND. Paste `git diff --name-status 5ff57606..HEAD`
   (expect four `M`, one `A`).
2. **Read** `git diff 5ff57606..HEAD -- open-brain/src` and the whole of `applyOne`'s task cases and `editEffect`.
   Answer each, with the line:
   a. **Atomicity.** `update_task` sets title, priority, status and assignee BEFORE `editEffect` can refuse. Show by a
      run (step 4) that a refused op leaves the record on disk unchanged and the revision unbumped, also when an
      earlier op in the same call succeeded.
   b. **Order inside one call.** For each pair in one `ops` array on one task, say what happens and whether it is
      right: `update_task{predicted}` then `close_task{observed}`; `update_task{observed}` then
      `update_task{predicted}`; `open_task{predicted}` then `close_task{}`; `close_task{observed}` on a task whose
      `predicted` was set by an earlier op in the same call.
   c. **Other writers of a task.** List every place in `open-brain/src` that constructs or copies a task object
      (`reopen_task`, retention, state-migrate, state-import, any spread or pick of task keys). Does any DROP the two
      fields on a rewrite, or carry them where they should not go?
   d. **Readers.** Does any renderer, check or reader (`state-views`, `state-render`, `state-reader`, `checks-state`,
      `hub-seat-state`, `end-record-guard`) iterate task keys or use a strict pick that would now fail or print the
      fields? Run `node open-brain/build/cli.js sync` after `npm run build` against a temp project whose record has a
      task with both fields, and paste any line that names the task or the fields.
   e. **Empty and odd values.** `predicted: ""`, `"   "`, a 50,000-character string, a string with a newline, and
      `observed: null`: which are refused, by which message, and is a whitespace-only prediction a real hole in the
      close rule (it is stored, and the close then demands an observation)?
   f. **The tool description** (`server.ts`): is every sentence it adds true of the code at CAND?
   g. **The refusal shape printer (T-271).** For a refused `open_task`, `update_task` and `close_task`, paste the
      printed expected shape and confirm it names the new fields for exactly the ops that take them.
3. **Run**, in `open-brain` with a scratch HOME: `npm ci`; `node -e "require('better-sqlite3')"`;
   `npx vitest run --no-file-parallelism --testTimeout=180000` (the FULL suite, on the committed tree; paste
   `Test Files`, `Tests`, any `Errors` line and any Unhandled Errors section). Expected: only
   `tests/harness/checks.test.ts` D4 red. A red `s4-guards` D1b at CAND is a FINDING. Any other red row: run that file
   alone at CAND and at START (`git worktree add ../t358-start 5ff57606` and `npm ci` there; `git stash` is forbidden)
   and say which side is red. A single `Timeout calling "onTaskUpdate"` unhandled error with every file green is the
   known T-292 flake: rerun once and report both runs.
4. **Live, through the built writer.** After `npm run build`, in a temp folder: create a minimal valid v3 record (copy
   the fixture the T358 test file builds, or use the same helper from a small script run with `npx tsx`), then drive
   the real write path the tests use (`applyOps` or the CLI, whichever the test file calls) through: open with
   `predicted`; close with no `observed` (expect the refusal text of the spec, exactly); close with `observed`; read
   the file back and paste the task's keys in order; then the cases of 2a and 2b. Paste each result line.
5. **Surviving mutants.** In a scratch `git worktree` at CAND, try single-line changes that E1-E18 might not catch,
   and for each paste the rows that turn red under
   `npx vitest run tests/shared/t358-predicted-observed.test.ts tests/shared/t271-op-refusals.test.ts tests/shared/state-keyorder.test.ts`.
   Try at least: `"observed"` dropped from `KEY_ORDER.tasks`; `editEffect` called AFTER `t.status = "done"` in
   `close_task`; the `observed`-without-`predicted` check ignoring `op.predicted`; `predicted` accepted on
   `close_task`'s schema; `min(1)` removed from `predicted` in `TaskSchema`; `editEffect` called after `editNote` in
   `update_task`. Remove the worktree.

## Verdict

REJECT for: a refused op that changes the record on disk or bumps the revision (2a); a path that silently drops or
corrupts `predicted` or `observed` on a rewrite of the record (2c); a reader, check or view that fails on a record
carrying the fields (2d); a close of a task with `predicted` and no `observed` that succeeds by any op order (2b);
a task with neither field behaving differently from START; a description sentence that is false (2f); a row red at
CAND and green at START, including D1b; or a surviving mutant that shows the source at CAND mishandling an input.
A surviving mutant that is only a test gap on an input the source handles correctly is a NOTE (planner ruling, T-351).
ACCEPT-WITH-NOTES for anything else. List findings, then NOTES and NITS, then what was NOT RUN.
