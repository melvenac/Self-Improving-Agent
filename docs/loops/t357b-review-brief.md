# T357b review: scripts/ctx-metrics.mjs, round two after the job 1530 REJECT (PR #1163)

Runtime: CC (claude -p, Opus)
SEAT: job runner (QA PC or Lenovo), NOT the desktop. No hub key. **Read-only: no commit, no push, no PR, no PR comment,
no edit outside the launcher's clone.** Ends at a VERDICT, which decides an SG-1 merge. You are the QA judge; the build
was a separate run (job 1531).
REPLY: the absolute reply path the launcher names. Print it FIRST. Line 1 of the reply is `VERDICT: ACCEPT`,
`VERDICT: ACCEPT-WITH-NOTES` or `VERDICT: REJECT`; line 2 is `MODEL: <your model id>`.

**By:** Atlas (planner), 2026-11-19, session 178. **Task:** T-357. **Tag:** `t357b-review`.
**Spec:** `docs/loops/t357b-brief.md` (in the launcher's clone). Round one's review brief, whose steps this one reuses:
`docs/loops/t357-review-brief.md`.
**START:** `7420a541d88090d8026fa79ef0c3c3079fa2302a`. **CAND:** `d19c4f6c759acee7dcc14291a762f0cb2209baad` (one commit on START,
branch `loop/t357b`). Review CAND, never the launcher's own sha: `git fetch origin loop/t357b` and
`git checkout -q d19c4f6c759acee7dcc14291a762f0cb2209baad`.

```text
IMPACT-TARGETS: none: review only; no repository file is changed
```

## What changed since round one

Round one (PR #1160, closed) was rejected by job 1530 for two findings; its metrics were found correct. CAND is a fresh
build from master of the same two files with these changes (the spec's "Why this supersedes" lists them with lines):

1. **F1:** `appendRows` writes a leading newline when the out file is non-empty and does not end in one.
2. **F2:** a config that is not a plain object, or has a wrong-typed `root`, `out`, `changes` or `seats`, exits 2 with
   one line and no stack.
3. **N1:** `--note` with `--dry-run` writes nothing and prints the line it would add.
4. **N2:** folders that carry one seat name are read as ONE seat (one set of rows).
5. **N7:** a seat with a folder that is absent, not a folder, or unreadable is named on stderr in one line, writes no
   row in that run (even when its other folders read), exits 1, and the other seats are still written.
6. **N8:** a `--now` without a zone is refused (exit 2). **NIT:** an impossible `--date` prints the "real YYYY-MM-DD"
   message.
7. **N9:** rows CM-15 to CM-20 and m19-m41. CM-20 starts child `node` processes with `TZ` set, because a local-time
   `weekClosed` cannot be told from the right one in-process on a UTC host.
8. **Left as they are, stated in the script header as known limits, and NOT findings:** round one's N3, N4, N5, N6,
   N10. Also NOT findings: everything round one's review brief lists as ruled.

## Already proved by the planner / reported by the build

- CAND is one commit on START adding exactly the two paths; each blob equals the spec's copy (`b000f477...` script,
  `4183e206...` test file).
- Build (Lenovo, Linux, America/Chicago): both `tsc` runs exit 0; step-4 files 35 passed; m1-m41 each red exactly as
  predicted; full suite on the committed tree 5066 passed, 7 skipped, 1 failed (`tests/harness/checks.test.ts` D4,
  known red at START); the seven step-8 commands as predicted.

## Rules

The Rules section of `docs/loops/t357-review-brief.md` applies whole: no real transcript, no real `~/.claude`, every
run with `--root` and `--out` in a temp folder outside the clone, every number pasted, a finding needs file:line at
CAND and a concrete failing input.

## Steps

1. `node -v` must print `v22.*`. `git rev-parse HEAD` must print CAND. Paste `git diff --name-status 7420a541..HEAD`
   (expect two `A` paths).
2. **The two findings, reproduced.** In a temp folder outside the clone, build the hand-written seat of round one's
   step 4, run the script, then repeat job 1530's F1 cases exactly: (a) append half a JSON object with no newline and
   run with a later `--now`; (b) cut the final newline off a good file, run with a later `--now`, then delete one
   main-thread transcript and run again. After each run paste the out file line by line as `OK <seat> <week>` or
   `UNREADABLE <n> chars`. Required: every row that was complete before stays readable and unchanged, each new row is
   on its own line, an immediate rerun writes 0 rows, and in (b) the closed week's row is NOT rewritten after the
   transcript is removed. Then F2: `--config` naming a file that holds `null`, `[]`, `"x"`, `{"seats":"abc"}`,
   `{"seats":{"f":1}}`, `{"root":5}`, and text that is not JSON: each must exit 2 with one stderr line and no stack.
3. **Read** `git diff --no-index docs/loops/t357/ctx-metrics.mjs scripts/ctx-metrics.mjs` (round one against CAND; exit
   1 is expected) and the whole of `main`. Answer each, with the line:
   a. Does any change alter a number a row carries for an input round one handled correctly (compare the row for your
      step 2 seat against round one's formulae)? Field order and `schema: 1` unchanged?
   b. **One seat, several folders:** are message ids, typed-turn keys and compaction uuids shared across the folders,
      so a session present in both is counted once? Are `sessions_started` and `windows_open_end` per file across
      both? What do the same folder listed twice, and two names that differ only by case or spaces, do?
   c. **A seat that fails:** for each of absent, a file where a folder should be, an unreadable `subagents` entry and a
      transcript that disappears during the read: one stderr line, no stack, exit 1, no row for that seat, the other
      seats written? Can a failed seat leave a partial row, or stop a later seat? Is there any failure that now exits
      0?
   d. **`--dry-run`:** with and without `--note`, is anything written or any folder created? Is the "would note" text
      true when the line is already there?
   e. **`--now`:** which forms are accepted and refused (`Z`, `+05:30`, `-0600`, no zone, a date only, lower-case
      `z`)? Is a refused form ever one a user would reasonably pass, and is the default (no `--now`) unaffected?
   f. **CM-15 to CM-20:** does each pass for the reason it names? Is CM-20 safe on Windows and Linux (how it finds
      `node`, what it does when the child cannot start, whether `TZ` leaks into the runner's own process)? Does any
      new row read `HOME` or leave a temp folder behind?
4. **Run**, in `open-brain` with a scratch HOME: `npm ci`; `node -e "require('better-sqlite3')"`;
   `npx vitest run --no-file-parallelism --testTimeout=180000` (the FULL suite; paste `Test Files`, `Tests`, any
   `Errors` line and any Unhandled Errors section). Then
   `TZ=UTC npx vitest run tests/t357-ctx-metrics.test.ts` (paste; expect 20 passed). A red row other than
   `tests/harness/checks.test.ts` D4: run that file alone at CAND and at START (`git worktree add ../t357b-start
   7420a541` and `npm ci` there; `git stash` is forbidden) and say which side is red. A single
   `Timeout calling "onTaskUpdate"` unhandled error with every file green is the known T-292 flake: rerun once and
   report both runs.
5. **Surviving mutants.** Rerun round one's seven survivors (job 1530's step 5 names them) and any new single-line
   change to the code this round added that CM-1 to CM-20 would not catch; apply in a scratch `git worktree` at CAND,
   run `npx vitest run tests/t357-ctx-metrics.test.ts` under both the host's zone and `TZ=UTC`, paste, remove the
   worktree. Try at least: the leading newline written always; the failed seat's rows still appended; the folders of
   one seat read into separate seats; `checkConfig` not called; the zone test on `--now` dropped.

## Verdict

REJECT for: either F1 case still losing, gluing, duplicating or rewriting a row, or any F2 input not exiting 2 with one
line (step 2); a row's number changed for an input round one handled correctly (3a); a session counted twice across
one seat's folders (3b); a failed seat that writes a row, stops another seat, prints a stack or exits 0 (3c); a
`--dry-run` that writes (3d); a row that touches the real home, or CM-20 changing the runner's own zone (3f); a row red
at CAND and green at START; or a surviving mutant that changes a number a row carries where the source at CAND also
mishandles the input. A surviving mutant that is only a test gap on an input the source handles correctly is a NOTE
(planner ruling, T-351). ACCEPT-WITH-NOTES for anything else. List findings, then NOTES and NITS, then what was NOT
RUN.
