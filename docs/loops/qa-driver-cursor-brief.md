# A Cursor QA driver, so QA runs headless on the QA machines (record 175, `cursor-infra`)

**By:** Atlas (planner), record session 146 · 2026-09-27. **Why:**
- Claude's weekly usage is short.
- Composer 2.5 passed the A12 QA calibration (`docs/loops/cal-a12-results.md`).
- Aaron wants QA off his desktop: "Can we move the qa agents to the laptop and qa pc?"

**Done by Aaron, 2026-09-27:** `cursor-agent` `2026.09.26-dd393fe` is installed on the laptop (`DESKTOP-0GV3HAD`) and
the QA PC (`DESKTOP-O4EGB1E`), and both are logged in as `melvenac@gmail.com` (`agent status`, read by the planner).

## Objective

A QA run on a QA machine drives **`cursor-agent` headless** with a chosen model, through the SAME `qa-queue.ps1` (on
master since `c4d3388`, lock included). It has the same guarantees the Claude driver has, and one more.

## Requirements

1. **A Cursor driver template.** For example `docs/loops/qa-driver-template-cursor/`, plus a flag on
   `qa-driver-copy.mjs` (`--harness cursor --model <id>`) that generates `qa-N/drive.ps1` for it. The Claude template
   stays as it is.
2. **Launch:**
   - `agent.cmd -p <first prompt> --model <id> --output-format stream-json --trust --workspace <QA tree>`, plus
     whatever flags unattended running needs.
   - **Quote every path.** The QA PC's `%LOCALAPPDATA%` and `%USERPROFILE%` contain a space (`Aaron Melven`). The
     planner broke two commands today on exactly that.
   - It resumes up to 3 times, like the Claude driver, using Cursor's own resume. Completion is the report's last
     line, as today.
3. **Parse the stream-json with a parser, never a pattern match.** Read Cursor's headless docs
   (https://cursor.com/docs/cli/headless) for the event shapes: session or chat id, result, errors, and anything like a
   refusal. Record in `drive.meta` what the Claude driver records: attempts, exit codes, the result line, the model,
   and cost if Cursor reports it.
4. **THE HARD REQUIREMENT: the seat cannot push except through `push-qa.mjs`.**
   - The Claude driver enforces this with `--disallowedTools 'Bash(git push:*)'` and friends.
   - Cursor needs its own **deny list**: `git push`, `gh pr`, `gh release`, `gh api` writes, `gh repo`. Use Cursor's
     CLI permission configuration, at the project or user level, whichever the docs say `-p` honours.
   - **Prove it:** a headless run whose prompt tells the agent to `git push` a throwaway branch must be REFUSED, and
     the ref audit must show nothing moved.
   - **Known positive:** the same prompt with the deny list removed DOES push. Push to a `qa/zz-probe-*` branch in a
     scratch clone, and delete that branch afterwards.
   - **If `--force` bypasses the deny list, do not use `--force`.** Find the mode that runs unattended AND honours
     denies. **If no such mode exists, stop, and post here. Do not weaken the requirement.**
5. **Never a visible window,** and never `claude.exe`. Keep the ref audit and the stops file (`--append-system-prompt`
   has no Cursor equivalent, so say how `stops.txt`'s content reaches the seat).
6. **Test on THIS desktop only, with a stub prompt**, never a real QA dispatch. Hidden, with `MainWindowHandle`
   checked. At least one run through `qa-queue.ps1` itself, with `-Queue 9996` and a stub `qa-9996` driver made by
   the new copier.
7. **Say what Aaron must do on each machine after the merge:**
   - copy the new `qa-queue.ps1`, if it changed;
   - any Cursor permission file the driver needs in the user profile.
   - **Do not write anything to the QA machines yourself.**

## Rules

- **Branch** `chore/qa-driver-cursor` from `origin/master` (`c4d3388`).
- Push only `chore/qa-driver-cursor*` (and the one probe branch, which you delete).
- Handoff `docs/loops/qa-driver-cursor-developer-handoff.md`, pushed before you post.
- Report in your room, then `--wait` there. No `/end`.
