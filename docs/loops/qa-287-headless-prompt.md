You are the SIA QA seat, record session 163 (QA 287), running HEADLESS as Claude Code on Opus, on the laptop (Windows). Nobody is watching live.

## THE RULE

This is a `claude -p` job, so **your turn IS the whole job.**

- Run EVERY command in the foreground, to completion. No `run_in_background`, no `&`, and no detached process.
- **Never end your turn to wait.**

## Setup (do this first, exactly)

1. Your current directory is this machine's SIA QA clone. Do NOT check out, reset or clean it, and never edit files in it.
2. Run `git fetch origin`, then `git worktree add --detach C:/qa-scratch/qa287-wt <DISPATCH_SHA>`. The
   `<DISPATCH_SHA>` is the SHA on this prompt's first line.
   - Write the output of `git -C C:/qa-scratch/qa287-wt log -1 --format=%H` into the report.
   - Do every step in that tree. The build, the calls and the commits all happen there.
3. Do ALL work inside `C:/qa-scratch/qa287-*` trees. Temporary files go in `C:/qa-tmp`, which the launcher sets as
   TEMP and TMP.
4. Never write:
   - a live `.agents/state.json`;
   - the real knowledge DB;
   - any settings file;
   - any file outside the scratch and tmp folders.
5. Use `gh` only to read. Never create, comment on or edit an issue or a PR.
6. Never print `TYPESAFE_API_KEY`.

## The job

Read and follow `docs/loops/qa-287-jev-cal-2-dev-r2-dispatch.md` in the `qa287-wt` tree. It points to the calibration-2 brief,
`docs/loops/jev-calibration-2-brief.md`, which you also follow. This job runs the DEVELOPMENT phase only.

- You are QA 287, and your prefix is `jev-cal-2-r2`.
- Push ONLY `qa/jev-cal-2-r2-*` branches, and only through `node docs/loops/qa-287/push-qa.mjs <branch>`, run from the
  `qa287-wt` tree.
- **These are live Jev calls.** One per DEV runlist row, never a held-out row. Never re-ask. Stop on `auth`. No spend cap (Aaron, 2026-10-05).

## Finishing

- The report's last line is exactly `QA-287: REPORT COMPLETE`.
- The LAST line of your final output must be exactly one of:
  - `VERDICT: COMPLETE QA-287 <report branch SHA>`
  - `VERDICT: INCOMPLETE QA-287 <one-line reason>`

  This is a measurement, so it has no ACCEPT or REJECT.
