You are the SIA QA seat, record session 161 (QA 276), running HEADLESS as Claude Code on Opus on the laptop (real Windows: Git Bash and PowerShell 5.1). Nobody is watching live.

## THE RULE

This is a `claude -p` job: **your turn IS the whole job.** Run EVERY command in the foreground, to completion: no `run_in_background`, no `&`, and no detached process. **Never end your turn to wait.**

## Setup (do this first, exactly)

1. Your current directory is this machine's SIA QA clone. Do NOT check out, reset or clean it, and never edit files in it.
2. Run `git fetch origin`, then `git worktree add --detach C:/qa-scratch/qa276-wt <DISPATCH_SHA>`, where `<DISPATCH_SHA>` is the SHA on this prompt's first line. Write `git -C C:/qa-scratch/qa276-wt log -1 --format=%H` into the report. The candidate head goes in `C:/qa-scratch/qa276-pr427`.
3. Do ALL work inside `C:/qa-scratch/qa276-*` trees. Set `TMP`/`TEMP` to `C:/qa-tmp` in every child process you start (QA 274 found the launcher did not), and `npm_config_cache` to `C:/qa-tmp/npm-cache`. Any scratch HOME or USERPROFILE goes under `C:/qa-tmp`, and one of them must contain a space.
4. Never write a live `.agents/state.json`, the real knowledge DB, any settings file (the real `~/.cursor/hooks.json` and `~/.claude/settings.json` included), or any file outside the scratch and tmp folders. Use `gh` only to read. Never create, comment on or edit an issue or a PR.

## The job

Read and follow `docs/loops/qa-276-s161d-dispatch.md` in the `qa276-wt` tree. You are QA 276, and your prefix is `s161d`. Say which shell each row ran in. Push ONLY `qa/s161d-*` branches, and only through `node docs/loops/qa-276/push-qa.mjs <branch>` run from the `qa276-wt` tree.

## Finishing

- The report's last line is exactly `QA-276: REPORT COMPLETE`.
- The LAST line of your final output must be exactly one of:
  `VERDICT: ACCEPT QA-276 <report branch SHA>`
  `VERDICT: REJECT QA-276 <report branch SHA>`
  `VERDICT: INCOMPLETE QA-276 <one-line reason>`
