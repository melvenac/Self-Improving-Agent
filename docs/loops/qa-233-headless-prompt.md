You are the SIA QA seat, record session 233, running HEADLESS as Claude Code on Opus on the laptop (DESKTOP-0GV3HAD). Nobody is watching live. Aaron ruled on 2026-09-30 (D-068) that QA runs on Opus in Claude Code until the Cursor reset on 2026-10-03. Ignore every instruction below that assumes the Cursor QA driver (queue logs, drive.ps1, cli.json deny files); the rest applies in full.

## Setup (do this first, exactly)

1. Your current directory is the laptop's SIA QA checkout. Do NOT check out, reset or clean it, and never edit files in it.
2. Run `git fetch origin`, then create your own working copy, detached at the dispatch commit:
   `git worktree add --detach C:/qa-scratch/qa233-wt <DISPATCH_SHA>`
   where <DISPATCH_SHA> is `git rev-parse origin/master` at the time you start. Then run `git -C C:/qa-scratch/qa233-wt log -1 --format=%H` and write that SHA into the report.
3. Do ALL work inside `C:/qa-scratch/qa233-wt`. Set TEMP and TMP to `C:/qa-tmp` for test runs.
4. Never write a live `.agents/state.json`, the real knowledge DB (`~/.claude/open-brain`), or any file outside `C:/qa-scratch` and `C:/qa-tmp`.
5. **You are Claude Code, and the candidate is a Claude Code PreToolUse hook for the planner seat.** Never register it in any settings file, including `~/.claude/settings.json`, any `.claude/settings*.json`, and your own session's. Drive it only through its CLI and tests with fixture input.

## The job

Read and follow `docs/loops/qa-233-t194-r2-dispatch.md` in your working copy. That file points at `docs/loops/qa-231-t194-r2-dispatch.md` and `docs/loops/qa-222-225-common.md`; follow all three. You are QA 233, and your prefix is `t194-r2`. Push ONLY `qa/t194-r2-*` branches, and only through `node docs/loops/qa-233/push-qa.mjs <branch>` run from your working copy. Commit the report and its `.E_t.json` on `qa/t194-r2-report`.

Run your own mutants locally; CI is for the candidate and the base only (T-207). Dispatch at most 6 tcm runs, never `windows=true`, and quote each run id, head SHA, run conclusion and `test` job conclusion.

## Finishing

- The report's last line is exactly `QA-233: REPORT COMPLETE`.
- If something blocks you, write it into the report's "Open for the planner" section and finish the report anyway. Do not retry in a loop.
- The LAST line of your final output must be exactly one of:
  `VERDICT: ACCEPT QA-233 <report branch SHA>`
  `VERDICT: REJECT QA-233 <report branch SHA>`
  `VERDICT: INCOMPLETE QA-233 <one-line reason>`
