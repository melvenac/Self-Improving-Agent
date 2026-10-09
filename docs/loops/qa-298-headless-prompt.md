You are the SIA QA seat, record session 165 (QA 298), running HEADLESS as Claude Code on Opus, on the LAPTOP (Windows). Nobody is watching live.

## THE RULE

This is a `claude -p` job: **your turn IS the whole job.** Run every command in the foreground, to completion: no `run_in_background`, no `&`, and no detached process. **Never end your turn to wait.**

## Setup (do this first, exactly)

1. Your current directory is this machine's SIA QA clone. Do NOT check out, reset or clean it, and never edit files in it.
2. Run `git fetch origin`, then `git worktree add --detach C:/qa-scratch/qa298-wt <DISPATCH_SHA>`, where `<DISPATCH_SHA>` is the SHA on this prompt's first line. Write `git -C C:/qa-scratch/qa298-wt log -1 --format=%H` into the report.
3. Create `C:/qa-tmp/qa298` fresh. If it already exists, STOP and report INCOMPLETE `stale qa-tmp`. All temporary files go there.
4. Never write:
   - any real `.agents/state.json`;
   - the real knowledge DB or `~/.claude/open-brain/`;
   - a vault;
   - any settings file;
   - any file outside `C:/qa-scratch/qa298-*` and `C:/qa-tmp/qa298`.

   Never print a key, token or env value.
5. Use `gh` only to read. Never create, comment on or edit an issue or a PR.

## The job

Read and follow `docs/loops/qa-298-s165c-dispatch.md` in the `qa298-wt` tree. You are QA 298, prefix `s165c`. One row (BF-A6) plus preflight and guard. Run the script `docs/loops/qa-298/bf-a6.ps1` exactly as the dispatch shows; do not edit it. Its finally blocks restore every ACL it changes. Row G1 double-checks the restore.

Write the report as `docs/loops/s165c-qa-report.md`:
1. Create the branch with `git -C C:/qa-scratch/qa298-wt switch -c qa/s165c-report`.
2. Commit only that file.
3. Push ONLY with `node docs/loops/qa-298/push-qa.mjs qa/s165c-report`, run from the `qa298-wt` tree.

## Finishing

- The report's last line is exactly `QA-298: REPORT COMPLETE`.
- The LAST line of your final output must be exactly one of:
  `VERDICT: ACCEPT QA-298 <report branch SHA>`
  `VERDICT: REJECT QA-298 <report branch SHA>`
  `VERDICT: INCOMPLETE QA-298 <one-line reason>`
