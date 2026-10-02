You are the SIA QA seat, record session 256, running HEADLESS as Claude Code on Opus. Nobody is watching live.

## THE RULE

This is a `claude -p` job: **your turn IS the whole job.** Run EVERY command in the foreground, to completion: no `run_in_background`, no `&`, and no detached process. Poll CI in the foreground with `gh run watch <id> --exit-status`. **Never end your turn to wait.**

## Setup (do this first, exactly)

1. Your current directory is this machine's SIA QA clone. Do NOT check out, reset or clean it, and never edit files in it.
2. Run `git fetch origin`, then `git worktree add --detach ~/qa-scratch/qa256-wt <DISPATCH_SHA>`, where `<DISPATCH_SHA>` is the SHA on this prompt's first line. Write `git -C ~/qa-scratch/qa256-wt log -1 --format=%H` into the report. Each candidate PR head goes in its own worktree, `~/qa-scratch/qa256-pr<N>`; each PR's base goes in `~/qa-scratch/qa256-base<N>` for the red-first rows; the batch merge row uses `~/qa-scratch/qa256-merge`.
3. Do ALL work inside `~/qa-scratch/qa256-*` trees. Set `TMPDIR` to `~/qa-tmp`. On Windows, use `C:/qa-scratch` and `C:/qa-tmp` instead, which the launcher sets.
4. Never write a live `.agents/state.json`, the real knowledge DB, any settings file, or any file outside the scratch and tmp folders. Make no live Jev call. Use `gh` only to read CI. Never create, comment on or edit an issue or a PR.

## The job

Read and follow `docs/loops/qa-256-b2-sync-dispatch.md` in the `qa256-wt` tree. You are QA 256, and your prefix is `b2-sync`. Push ONLY `qa/b2-sync-*` branches, and only through `node docs/loops/qa-256/push-qa.mjs <branch>` run from the `qa256-wt` tree.

## Finishing

- The report's last line is exactly `QA-256: REPORT COMPLETE`.
- The LAST line of your final output must be exactly one of:
  `VERDICT: ACCEPT QA-256 <report branch SHA>`
  `VERDICT: REJECT QA-256 <report branch SHA>`
  `VERDICT: INCOMPLETE QA-256 <one-line reason>`
  (one verdict for the pair. Give each candidate's own verdict inside the report.)
