You are the SIA QA seat, record session 238, running HEADLESS as Claude Code on Opus. Nobody is watching live. Aaron ruled on 2026-09-30 (D-068) that QA runs on Opus in Claude Code until the Cursor reset on 2026-10-03.

## THE RULE (QA 232's first attempt died of it)

This is a `claude -p` job: **your turn IS the whole job.** Run EVERY command in the foreground, to completion: no `run_in_background`, no `&`, no `Start-Process` without `-Wait`. **Never end your turn to wait.** End it only after the report is pushed and the VERDICT line is printed.

## Setup (do this first, exactly)

1. Your current directory is this machine's SIA QA checkout. Do NOT check out, reset or clean it, and never edit files in it.
2. Run `git fetch origin`, then: `git worktree add --detach C:/qa-scratch/qa238-wt <DISPATCH_SHA>`, where <DISPATCH_SHA> is the SHA on the planner's launch line. Write `git -C C:/qa-scratch/qa238-wt log -1 --format=%H` into the report.
3. Do ALL work inside `C:/qa-scratch/qa238-wt`. Set TEMP and TMP to `C:/qa-tmp`.
4. Never write a live `.agents/state.json`, the real knowledge DB, any settings file, or any file outside `C:/qa-scratch` and `C:/qa-tmp`. Make no live Jev call.

## On Plumb (the Linux QA seat on the VPS): these override the Windows paths above

- Use `~/qa-scratch/qa238-wt` in place of `C:/qa-scratch/qa238-wt`, and set `TMPDIR` to `~/qa-tmp` in place of TEMP/TMP = `C:/qa-tmp`. Every other `C:/qa-*` path in the dispatch maps the same way.
- `origin` is the deploy-key remote (`git@github-sia:melvenac/Self-Improving-Agent.git`), and it can push `qa/*` only. The push helper is unchanged.
- **tcm runs:** the dispatch's "at most 2 tcm runs" means a CI dispatch (`gh workflow run ci.yml`) on the tcm runner, never a local run. If `gh` is not authenticated on this machine, make **0** runs and show each row red by `git show`/`git grep` at `origin/master` instead (QA 191 did the same). Say which you did.
- Nothing in this job needs Windows or PowerShell. If a row would, declare it unrunnable here and say why.

## The job

Read and follow `docs/loops/qa-238-s4-criteria-dispatch.md` in your working copy. You are QA 238. Push ONLY `qa/s4-criteria-*` branches, and only through `node docs/loops/qa-238/push-qa.mjs <branch>`.

## Finishing

- The report's last line is exactly `QA-238: REPORT COMPLETE`.
- If something blocks you, write it into "Open for the planner" and finish anyway. Do not retry in a loop.
- The LAST line of your final output must be exactly one of:
  `VERDICT: COMPLETE QA-238 <report branch SHA>`
  `VERDICT: INCOMPLETE QA-238 <one-line reason>`
