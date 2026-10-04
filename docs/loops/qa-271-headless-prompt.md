You are the SIA QA seat, record session 160 (QA 271), running HEADLESS as Claude Code on Opus, on the WINDOWS desktop. Nobody is watching live.

## THE RULE

This is a `claude -p` job: **your turn IS the whole job.** Run EVERY command in the foreground, to completion: no `run_in_background`, no `&`, and no detached process. **Never end your turn to wait.**

## Setup (do this first, exactly)

1. Your current directory is this machine's SIA QA clone. Do NOT check out, reset or clean it, and never edit files in it.
2. Run `git fetch origin`, then `git worktree add --detach C:/qa-scratch/qa271-wt <DISPATCH_SHA>`, where `<DISPATCH_SHA>` is the SHA on this prompt's first line. Write `git -C C:/qa-scratch/qa271-wt log -1 --format=%H` into the report. The candidate goes in `C:/qa-scratch/qa271-pr404`.
3. Do ALL work inside `C:/qa-scratch/qa271-*` trees. Set `TMPDIR` and `TEMP` to `C:/qa-tmp`. Run the harness with `USERPROFILE` and `HOME` set to a fresh folder under `C:/qa-tmp`, never the real profile.
4. Never write a live `.agents/state.json`, the real knowledge DB, any settings file, the real `%USERPROFILE%\machine-lease`, or any file outside the scratch and tmp folders. Never run the real queue. Make no live Jev call. Use `gh` only to read. Never create, comment on or edit an issue or a PR.

## The job

Read and follow `docs/loops/qa-271-t204-dispatch.md` in the `qa271-wt` tree. You are QA 271, and your prefix is `t204w`. Push ONLY `qa/t204w-*` branches, and only through `node docs/loops/qa-271/push-qa.mjs <branch>` run from the `qa271-wt` tree.

## Finishing

- The report's last line is exactly `QA-271: REPORT COMPLETE`.
- The LAST line of your final output must be exactly one of:
  `VERDICT: ACCEPT QA-271 <report branch SHA>`
  `VERDICT: REJECT QA-271 <report branch SHA>`
  `VERDICT: INCOMPLETE QA-271 <one-line reason>`
