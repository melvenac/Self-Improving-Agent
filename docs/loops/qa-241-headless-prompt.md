You are the SIA QA seat, record session 241, running HEADLESS as Claude Code on Opus on the laptop (DESKTOP-0GV3HAD). Nobody is watching live. Aaron ruled on 2026-09-30 (D-068) that QA runs on Opus in Claude Code until the Cursor reset on 2026-10-03. Ignore every instruction below that assumes the Cursor QA driver (queue logs, drive.ps1, cli.json deny files); the rest applies in full.

## THE RULE (QA 232's first attempt died of it)

This is a `claude -p` job: **your turn IS the whole job.** QA 232's first attempt put its suite in the background,
wrote "I'll be notified when...", ended its turn, and exited with no report. In headless mode no notification ever
arrives. So:

- **Run EVERY command in the foreground, to completion.** No `run_in_background`, no `&`, no `Start-Process` without
  `-Wait`. Use long command timeouts; 105+ mutants take a long time, so split them into slices if one call would pass
  10 minutes, but run every slice.
- Poll tcm CI runs in the FOREGROUND (`gh run watch <id> --exit-status`) until they complete.
- **Never end your turn to wait.** End it only after the report is pushed and the VERDICT line is printed.

## Setup (do this first, exactly)

1. Your current directory is the laptop's SIA QA checkout. Do NOT check out, reset or clean it, and never edit files in it.
2. Run `git fetch origin`, then create your own working copy, detached at the dispatch commit:
   `git worktree add --detach C:/qa-scratch/qa241-wt <DISPATCH_SHA>`
   where <DISPATCH_SHA> is the SHA on this prompt's FIRST LINE. Then run `git -C C:/qa-scratch/qa241-wt log -1 --format=%H` and write that SHA into the report.
3. Do ALL work inside `C:/qa-scratch/qa241-*` trees. Set TEMP and TMP to `C:/qa-tmp` for test runs.
4. Never write a live `.agents/state.json`, the real knowledge DB (`~/.claude/open-brain`), or any file outside `C:/qa-scratch` and `C:/qa-tmp`.
5. **The candidate is a PreToolUse hook. Never register it, or anything else, in any settings file.** Drive it through the built CLI with fixture input. Make no live Jev call and no live GitHub merge.

## The job

Read and follow `docs/loops/qa-241-t194-r6-dispatch.md` in your working copy; it names every other file to read. You are QA 241, and your prefix is `t194-r6`. Push ONLY `qa/t194-r6-*` branches, and only through `node docs/loops/qa-241/push-qa.mjs <branch>` run from `C:/qa-scratch/qa241-wt`. Commit the report and its `.E_t.json` on `qa/t194-r6-report`.

## Finishing

- The report's last line is exactly `QA-241: REPORT COMPLETE`.
- If something blocks you, write it into the report's "Open for the planner" section and finish the report anyway. Do not retry in a loop.
- The LAST line of your final output must be exactly one of:
  `VERDICT: ACCEPT QA-241 <report branch SHA>`
  `VERDICT: REJECT QA-241 <report branch SHA>`
  `VERDICT: INCOMPLETE QA-241 <one-line reason>`
