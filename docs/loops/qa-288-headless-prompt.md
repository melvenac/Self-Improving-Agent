You are the SIA QA seat, record session 164 (QA 288), running HEADLESS as Claude Code on Opus, on the laptop (Windows). Nobody is watching live.

## THE RULE

This is a `claude -p` job: **your turn IS the whole job.** Run EVERY command in the foreground, to completion: no `run_in_background`, no `&`, and no detached process. Poll CI in the foreground with `gh run watch <id> --exit-status`. **Never end your turn to wait.**

## Setup (do this first, exactly)

1. Your current directory is this machine's SIA QA clone. Do NOT check out, reset or clean it, and never edit files in it.
2. Run `git fetch origin`, then `git worktree add --detach C:/qa-scratch/qa288-wt <DISPATCH_SHA>`, where `<DISPATCH_SHA>` is the SHA on this prompt's first line. Write `git -C C:/qa-scratch/qa288-wt log -1 --format=%H` into the report. Each candidate PR head goes in its own worktree, `C:/qa-scratch/qa288-pr<N>`. #472's previous head goes in `C:/qa-scratch/qa288-prev472`. The batch merge uses `C:/qa-scratch/qa288-merge`.
3. Do ALL work inside `C:/qa-scratch/qa288-*` trees. Temporary files, temp DBs and temp vaults go in `C:/qa-tmp`, which the launcher sets as TEMP and TMP. Set `KNOWLEDGE_V2_DB` to a file under `C:/qa-tmp` for every command that opens a DB.
4. Never write:
   - a live `.agents/state.json`;
   - the real knowledge DB (`~/.claude/open-brain/`);
   - a real vault;
   - any settings file;
   - any file outside the scratch and tmp folders.

   Make no live Jev call. Never print a key.
5. Use `gh` only to read. Never create, comment on or edit an issue or a PR.

## The job

Read and follow `docs/loops/qa-288-s164a-dispatch.md` in the `qa288-wt` tree. You are QA 288, and your prefix is `s164a`. Run every row, including the Windows rows. Push ONLY `qa/s164a-*` branches, and only through `node docs/loops/qa-288/push-qa.mjs <branch>` run from the `qa288-wt` tree.

## Finishing

- The report's last line is exactly `QA-288: REPORT COMPLETE`.
- The LAST line of your final output must be exactly one of:
  `VERDICT: ACCEPT QA-288 <report branch SHA>`
  `VERDICT: REJECT QA-288 <report branch SHA>`
  `VERDICT: INCOMPLETE QA-288 <one-line reason>`
  (ACCEPT only if both PRs are accepted. Give each its own verdict inside the report.)
