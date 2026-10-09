You are the SIA QA seat, record session 165 (QA 297), running HEADLESS as Claude Code on Opus, on the DESKTOP (Windows). Nobody is watching live.

## THE RULE

This is a `claude -p` job: **your turn IS the whole job.** Run every command in the foreground, to completion: no `run_in_background`, no `&`, and no detached process. **Never end your turn to wait.**

## Setup (do this first, exactly)

1. Your current directory is the desktop's SIA QA checkout (`C:/Users/melve/Worktrees/sia-qa`). Do NOT check out, reset or clean it, and never edit files in it.
2. Run `git fetch origin`, then `git worktree add --detach C:/qa-scratch/qa297-wt <DISPATCH_SHA>`, where `<DISPATCH_SHA>` is the SHA on this prompt's first line. Write `git -C C:/qa-scratch/qa297-wt log -1 --format=%H` into the report.
3. All temporary files go in `C:/qa-tmp/qa297`.
4. Never write:
   - any `.agents/state.json` other than the one in `C:/qa-scratch/qa297-mk` (row A6a);
   - the real knowledge DB or `~/.claude/open-brain/`;
   - a real vault;
   - any settings file;
   - any file outside `C:/qa-scratch/qa297-*` and `C:/qa-tmp/qa297`.

   Never print a key, token or env value, except the two path variables that row P2 prints.
5. Use `gh` only to read. Never create, comment on or edit an issue or a PR. Never push to `melvenac-makerspace`.
6. **open-brain tools** (`ob_set_session`, `ob_start`, `ob_state`):
   - Call them ONLY after row P2 passes.
   - Call them ONLY with `project_root` / `project_dir` = `C:/qa-scratch/qa297-mk`.

## The job

Read and follow `docs/loops/qa-297-s165b-dispatch.md` in the `qa297-wt` tree. Rows A1–A4 and A8 refer to `docs/loops/qa-296-s165a-dispatch.md` in the same tree for their commands, run against `C:/qa-scratch/qa297-mk`. You are QA 297, and your prefix is `s165b`. Run every row in order. A STOP in P1–P3 ends the job with an INCOMPLETE report.

Write the report as `docs/loops/s165b-qa-report.md`:
1. Create the branch with `git -C C:/qa-scratch/qa297-wt switch -c qa/s165b-report`.
2. Commit only that file.
3. Push ONLY with `node docs/loops/qa-297/push-qa.mjs qa/s165b-report`, run from the `qa297-wt` tree.

## Finishing

- The report's last line is exactly `QA-297: REPORT COMPLETE`.
- The LAST line of your final output must be exactly one of:
  `VERDICT: ACCEPT QA-297 <report branch SHA>`
  `VERDICT: REJECT QA-297 <report branch SHA>`
  `VERDICT: INCOMPLETE QA-297 <one-line reason>`
