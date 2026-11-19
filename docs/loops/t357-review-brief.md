# T357 review: scripts/ctx-metrics.mjs, a weekly context-efficiency row per seat with a change log (PR #1160)

Runtime: CC (claude -p, Opus)
SEAT: job runner (QA PC or Lenovo), NOT the desktop. No hub key. **Read-only: no commit, no push, no PR, no PR comment,
no edit outside the launcher's clone.** Ends at a VERDICT, which decides an SG-1 merge. You are the QA judge; the build
was a separate run (job 1529).
REPLY: the absolute reply path the launcher names. Print it FIRST. Line 1 of the reply is `VERDICT: ACCEPT`,
`VERDICT: ACCEPT-WITH-NOTES` or `VERDICT: REJECT`; line 2 is `MODEL: <your model id>`.

**By:** Atlas (planner), 2026-11-19, session 178. **Task:** T-357. **Tag:** `t357-review`.
**Spec:** `docs/loops/t357-brief.md` (in the launcher's clone).
**START:** `6de2663c15580587fcc57f26f8d442466c910457`. **CAND:** `bc63a40af6b5b02b8306ff79de4b98f5155cdbf0` (one commit on START,
branch `loop/t357`). Review CAND, never the launcher's own sha: `git fetch origin loop/t357` and
`git checkout -q bc63a40af6b5b02b8306ff79de4b98f5155cdbf0`.

```text
IMPACT-TARGETS: none: review only; no repository file is changed
```

## What it does

A fleet-only script (Aaron's decision, 2026-11-19) that reads Claude Code transcripts and appends one row per seat per
CLOSED ISO week to a jsonl outside the repository, so a later change to how the seats work has a before and an after.
The row's fields and the reason for each are in the script's header comment and in the spec's "What changes". A second
command, `--note`, appends a dated line to a change log beside the out file. Two new files, no existing file edited:
`scripts/ctx-metrics.mjs` and `open-brain/tests/t357-ctx-metrics.test.ts` (rows CM-1 to CM-14).

Ruled by the planner and NOT findings: the output lives under `~/.claude/open-brain/`, not in the repository; a row is
written once and never updated; window medians cover only windows ended by a compaction; `sidechain_share` is by call
count; `win_hours_median` is wall time and includes idle time; there is no default seat map; no scheduler, reader or
CLI command is in scope.

## Already proved by the planner / reported by the build

- CAND is one commit on START adding exactly the two paths, and each blob equals the brief's copy
  (`527eb3ed...` script, `f955e8d4...` test file).
- Build (Lenovo, Linux): `tsc --noEmit` and `tsc -p tsconfig.tests.json --noEmit` exit 0; the three step-4 files 29
  passed; m1-m18 each red exactly as predicted; full suite on the committed tree 5060 passed, 7 skipped, 1 failed
  (`tests/harness/checks.test.ts` D4, known red at START, an npm error); step 8's three commands as predicted.
- The record shapes in the spec's "Measured premises" were measured on the desktop's real transcripts. You cannot
  repeat that and must not try: take them as given, and judge whether the code handles those shapes.

## Rules

- Do not read, copy or print `~/.claude.json`, `~/.claude/settings.json`, any `.mcp.json`, `.env` or key file. **Do not
  read any real transcript under `~/.claude/projects` on the host, and never run the script without `--root` and `--out`
  pointing into a temp folder outside the clone.** Every transcript you feed it is one you wrote.
- Paste each command with its output. Every number is pasted output. Mark anything not run NOT RUN, with the reason.
- A finding needs file:line at CAND and a concrete failing input.

## Steps

1. `node -v` must print `v22.*`. `git rev-parse HEAD` must print CAND. Paste `git diff --name-status 6de2663c..HEAD`
   (expect two `A` paths).
2. **Read** `scripts/ctx-metrics.mjs` whole. Answer each, with the line:
   a. **Reads only, tells nothing.** Does the script write anywhere except the out file and the change log (and their
      parent folders)? Does any path print, log or store message text, a tool result's content, a prompt or a file
      path from a transcript (as opposed to counts, model ids and version strings)? Does anything in either new file
      carry a user name, home path, email address or seat name of a real fleet?
   b. **Closed weeks.** Is a row ever written for a week that has not ended at `now`? Check the boundary at exactly
      Monday 00:00:00.000 UTC, a `--now` with a non-UTC offset, a record whose timestamp has an offset, and a call at
      Sunday 23:59:59.999 UTC.
   c. **Written once.** Can a rerun duplicate a seat+week row, or drop or rewrite an existing line? What happens when
      the out file's last line has no trailing newline, or is half a JSON object (a crash mid-append): is the new row
      glued to it, and is either row lost to a later reader? When two seats are given the same seat name?
   d. **Calls and context.** Is a call counted once per message id across the seat's files, with `<synthetic>` left
      out? Is `first_call_ctx_median` the first real call of each main-thread file? Is `growth` ever sampled across a
      compaction, or across two files? Is a tool result's size booked to the call that carried it, once?
   e. **Windows.** For a window ended by a compaction: are its calls, typed turns and hours those between the previous
      boundary (or the file's start) and this one? What does a compaction with no call since the last boundary do?
      Two `compact_boundary` records with one uuid? A boundary without `compactMetadata`? Is a window that spans a
      week boundary booked to one week only, and which?
   f. **Typed turns.** With the premises' shapes: is a `user` record that carries a tool result, a peer message, a task
      notification, a compact summary or a meta record ever counted? Is a turn typed while the model works
      (`queued_command`, human origin) counted once, including when the same turn also appears as a `user` record with
      a different uuid (the premises saw 7 such pairs: say what the script does with them; an over-count of that size
      is a NOTE)? For a record with no `origin`, name any injected text the `INJECTED` pattern lets through.
   g. **Sidechains.** Is every call in a `subagents/` file counted as sidechain and none as a main-thread call, typed
      turn, compaction or window?
   h. **The command line.** Exit codes 0, 1 and 2 as the spec says; a flag wins over the config; a `--seat` folder
      name containing `=`; `--dry-run` writes nothing (neither file, no folder); `--note` with a bad date, an empty
      text, a two-line text, and the same line twice; a config file that is not JSON or has no `seats`.
   i. **The tests.** Do the rows write only under a temp folder and remove it, on Windows and Linux? Do they read
      `HOME` or the real `~/.claude`? Does any row pass for a reason other than the behaviour it names?
3. **Run**, in `open-brain` with a scratch HOME: `npm ci`; `node -e "require('better-sqlite3')"`;
   `npx vitest run --no-file-parallelism --testTimeout=180000` (the FULL suite; paste `Test Files`, `Tests`, any
   `Errors` line and any Unhandled Errors section). A red row other than `tests/harness/checks.test.ts` D4: run that
   file alone at CAND and at START (use `git worktree add ../t357-start 6de2663c` and `npm ci` there; `git stash` is
   forbidden) and say which side is red. A single `Timeout calling "onTaskUpdate"` unhandled error with every file
   green is the known T-292 flake: rerun once and report both runs.
4. **Live shape.** In a temp folder outside the clone, write a small seat by hand: two main-thread `.jsonl` files and
   one `<session>/subagents/x.jsonl`, with calls in two closed weeks and the open week, one compaction with
   `compactMetadata`, one typed `user` turn, one `queued_command` turn, one peer message and one tool result. Run
   `node scripts/ctx-metrics.mjs --root <T> --seat <folder>=demo --out <T>/o.jsonl --now <a time you choose>` twice.
   Paste both stdouts, the exit codes and `o.jsonl`. Work out each field of one row by hand and say where the script's
   value differs. Then append half a line (no newline) to `o.jsonl`, add a call in a newly closed week (move `--now`
   forward), run again, and paste the file: answer 2c from what you see.
5. **Surviving mutants.** Name any single-line change to the script that rows CM-1 to CM-14 would not catch; apply,
   run `npx vitest run tests/t357-ctx-metrics.test.ts`, paste, restore with `git checkout -- scripts/ctx-metrics.mjs`.
   Try at least: `weekClosed` using local time; `p90` off by one rank; the `have.add(key)` inside the append loop
   removed; `endFile` not called; the `isCompactSummary` test dropped; `--dry-run` creating the out folder.

## Verdict

REJECT for: any write outside the two output files, or any transcript text, path or personal detail printed or stored
(2a); a row for an open week (2b); a rerun that duplicates, drops or corrupts a row, including after a half-written
line (2c); a call, turn or window counted wrongly on a shape the premises name, beyond the 7-pair case in 2f (2d-2g);
a wrong exit code or a `--dry-run` that writes (2h); a row that touches the real home (2i); a row red at CAND and
green at START; or a surviving mutant that changes a number a row carries. A surviving mutant that is only a test gap
on an input the source handles correctly is a NOTE (planner ruling, T-351). ACCEPT-WITH-NOTES for anything else.
List findings, then NOTES and NITS, then what was NOT RUN.
