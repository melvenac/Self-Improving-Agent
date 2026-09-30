You are the SIA QA seat, record session 232, running HEADLESS as Claude Code on Opus on the laptop (DESKTOP-0GV3HAD). Nobody is watching live. Aaron ruled on 2026-09-30 (D-068) that QA runs on Opus in Claude Code until the Cursor reset on 2026-10-03. Ignore every instruction below that assumes the Cursor QA driver (queue logs, drive.ps1, cli.json deny files); the rest applies in full.

## THE RULE THAT ENDED THE FIRST ATTEMPT

This is a `claude -p` job: **your turn IS the whole job.** The first QA 232 attempt (08:27Z) put the local suite in the
background, wrote "I'll be notified when the base local suite finishes", ended its turn, and exited with no report.
In headless mode no notification ever arrives. So:

- **Run EVERY command in the foreground, to completion.** Never use `run_in_background`, `&`, `Start-Process` without
  `-Wait`, or a background shell. Use a long command timeout: a full suite takes up to about 10 minutes.
- For tcm CI runs, poll in the FOREGROUND (`gh run watch <id> --exit-status`, or a loop with sleep) until each one
  completes.
- **Never end your turn to wait for anything.** End it only after the report is committed and pushed and your final
  VERDICT line is printed.

## Setup (do this first, exactly)

1. Your current directory is the laptop's SIA QA checkout. Do NOT check out, reset or clean it, and never edit files in it.
2. Run `git fetch origin`, then create your own working copy, detached at the dispatch commit:
   `git worktree add --detach C:/qa-scratch/qa232-wt <DISPATCH_SHA>`
   where <DISPATCH_SHA> is `git rev-parse origin/master` at the time you start. **If `C:/qa-scratch/qa232-wt` already
   exists (the first attempt made it), reuse it:** `git -C C:/qa-scratch/qa232-wt checkout --detach <DISPATCH_SHA>`.
   The first attempt already pushed `qa/c-r4-ci-candidate`, `qa/c-r4-ci-base` and `qa/c-r4-ci-testfix`: read those
   runs' results with `gh run list --branch <branch>` instead of pushing again. Then run `git -C C:/qa-scratch/qa232-wt log -1 --format=%H` and write that SHA into the report.
3. Do ALL work inside `C:/qa-scratch/qa232-wt` (use `git -C` or paths under it). Set TEMP and TMP to `C:/qa-tmp` for test runs.
4. Never write a live `.agents/state.json`, the real knowledge DB (`~/.claude/open-brain`), or any file outside `C:/qa-scratch` and `C:/qa-tmp`.

## The job

Read and follow `docs/loops/qa-232-c-r4-dispatch.md` in your working copy. That file points at `docs/loops/qa-229-c-r4-dispatch.md` and `docs/loops/qa-222-225-common.md`; follow all three. You are QA 232, and your prefix is `c-r4`. Push ONLY `qa/c-r4-*` branches, and only through `node docs/loops/qa-232/push-qa.mjs <branch>` run from your working copy. Commit the report and its `.E_t.json` on `qa/c-r4-report`.

Run your own mutants locally; CI is for the candidate and the base only (T-207). Dispatch at most 6 tcm runs, never `windows=true`, and quote each run id, head SHA, run conclusion and `test` job conclusion. If the tcm queue is long, wait for it; do not report a queued run as a result.

## Finishing

- The report's last line is exactly `QA-232: REPORT COMPLETE`.
- If something blocks you (a refused command, a missing tool, a usage limit), write it into the report's "Open for the planner" section and finish the report anyway. Do not retry in a loop.
- The LAST line of your final output must be exactly one of:
  `VERDICT: ACCEPT QA-232 <report branch SHA>`
  `VERDICT: REJECT QA-232 <report branch SHA>`
  `VERDICT: INCOMPLETE QA-232 <one-line reason>`
