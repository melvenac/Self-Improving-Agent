# SIM T358: predicted and observed effect on a task - check every prediction before the brief is pinned

Runtime: CC (claude -p, Sonnet). SEAT: job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-20, session 178. **Task:** T-358. **Tag:** `sim-t358`. **Base:** the START sha the
launcher names (the `loop/sim-t358` commit: origin/master plus `docs/loops/t358/`, `docs/loops/t358-brief.md` and this
file).

```text
IMPACT-TARGETS: none: review only; no repository file is changed
```

## What is measured

`docs/loops/t358-brief.md` is a drafted build brief. Nothing in it was type-checked or run. This run does its steps
1 to 5 (shell, npm ci, apply, type check, the nine files, the fifteen mutants) and reports what happened against what
the brief predicts. **A red row or a mutant result that differs from a prediction is a result, not a failure of the
run: report it and carry on.** The only stops are: `apply.cjs` does not print the expected line, or `npm ci` fails.

## Steps

You are in a fresh clone detached at START. Read `docs/loops/t358-brief.md` sections "What changes" and "Steps" first.

1. Do the brief's step 1 and step 2, WITHOUT creating a branch (stay detached). The brief's "Forbidden" list applies.
2. Do the brief's step 3 (apply, copy the test file, both type checks, build). Paste each exit code. **If a type check
   fails, do NOT stop:** paste the full error text, then go on to step 3 below anyway (vitest runs the sources through
   tsx and may still run).
3. Do the brief's step 4 (the nine files). Paste `Test Files`, `Tests`, and for EACH failed row its name and its
   assertion message (expected and received), in full. Use `grep -a` if you filter.
4. Do the brief's step 5 (mutants m1 to m15), including the backups and restores. For each mutant paste the apply line
   and the names of the failed rows. Then rerun step 3's command once after the last restore and paste the totals.
5. `git status --porcelain` in the clone, pasted. Do not commit. Do not run the full suite. Do not push.

## Reply

First line: `SIM t358 DONE` or `SIM t358 STOPPED <reason>`. Then:

- Host, `node -v`, `npm ci` exit code.
- The apply line. The three exit codes of step 2, with any error text in full.
- Step 3: totals, and every failed row with its assertion message.
- A table, one line per mutant: `mN | predicted red (from the brief) | actual red | SAME or DIFFERENT`. A mutant with
  no red row is written `SURVIVES`.
- For every DIFFERENT row and every failed row of step 3: one sentence on the cause as you read it in the code or the
  test (say "not investigated" if you did not look). Do not edit any file to fix it.
- The totals of the rerun after the last restore.

Every number is pasted output, with its command. Mark anything not run `NOT RUN`.
