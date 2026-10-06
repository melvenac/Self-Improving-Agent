# grok-qa-sia baseline first-pass on SIA master (planner s163)

**Seat:** grok-qa-sia (D-125, D-126, D-127). **Kind:** FIRST-PASS, a baseline: there's no candidate and nothing to accept
or reject. **Why:** to measure the bot's timing and SIA's test stability on Linux before its first real job, the Jev
calibration 2 dev r2 first-pass.

**Commit to test:** `42291b29` (SIA master after PR #476). Test exactly this commit, even if master has moved on.

## Rules

- Read-only token: push nothing, open no PR, comment on nothing. The report goes as hub turns in `[atlas, grok-qa-sia]`.
  The planner commits it verbatim (D-127).
- Run nothing that uses an API key, reads real user config, or needs Windows (D-125 MAY NOT). Nothing in this dispatch
  needs any of them. If a row would, mark it NOT RUN and say why.
- Each row gives the command, the exit code and the quoted output (trimmed to the lines that matter, with the counts
  line always kept). Never summarise a row as "passed" without its exit code.
- A run is evidence only when made on Node 22 (D-127).

## Rows

**R0 environment.** `node --version`, `npm --version`, `uname -a`, `nproc`, free memory. Print the NAMES (never the
values) of any environment variables matching `CLAUDE|KNOWLEDGE|OPEN_BRAIN|TYPESAFE|ANTHROPIC|HUB_`. If `node --version`
is not v22.x, stop and report `FIRST-PASS FAIL wrong node major`.

**R1 checkout.** Use a fresh clone or `git fetch` plus `git checkout --detach 42291b29`, then report `git rev-parse HEAD`
and confirm `git status --porcelain` is empty.

**R2 install and build.** `cd open-brain && npm ci`, then `npm run build`. Give the exit code and wall time for each.

**R3 typecheck.** `npm run typecheck`, then `npm run typecheck:tests`. Give the exit codes, and quote the first 20 error lines
if either is non-zero.

**R4 suite, one file per run, twice.** List every `open-brain/tests/**/*.test.ts` file (190 at this commit; report your
count). For each file, run `npx vitest run <file>` on its own, in a fresh shell with HOME set to a new empty temp
directory, and record the exit code, the tests passed/failed/skipped counts and the wall time. Do the whole pass
**twice**. Report:
- the totals per pass, and the total wall time per pass;
- a table of every file that was non-zero in either pass: file, pass-1 exit and counts, pass-2 exit and counts, and the
  first failing test's name and assertion message;
- each file that differs between the passes, labelled FLAKY;
- the 10 slowest files.
Read a file's exit code directly, not through a pipe (an exit code read after `| tail` is tail's). A file that hangs past 10
minutes is killed and reported as TIMEOUT.

**R5 static audit.** At the same commit: `git diff --check 42291b29~1 42291b29` (exit code), and
`node -e "JSON.parse(require('fs').readFileSync('.agents/state.json','utf8'))"` (exit code). For every `.json` file under
`.agents/`, report whether it parses.

## Report

Send hub turns in order (R0 to R5). The last turn's first line is exactly:

`FIRST-PASS PASS <short>` when R0 to R3 exit 0 and every R4 file exits 0 in both passes, or `FIRST-PASS FAIL <short>`
otherwise, followed by a one-line reason. On a baseline, FAIL is information, not a defect report: list every failing and
flaky file, so the planner can tell Linux-only failures apart from real ones.
