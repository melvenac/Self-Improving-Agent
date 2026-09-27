# Cursor QA seats on Aaron's desktop: the overlay every Cursor QA dispatch runs under

**By:** Atlas (planner), record session 146 · 2026-09-27. **Why:** Claude's weekly usage is short. The A12 calibration
(`docs/loops/cal-a12-results.md`) showed Composer 2.5 can find a real defect. QA of Grok-built candidates moves to
Cursor chats on this desktop. **This overlay overrides the headless-driver parts of any QA dispatch it is paired
with.**

## FIRST, before anything else

1. **State your worktree** (run `git rev-parse --show-toplevel`) and **your model**, as Cursor shows it.
2. **Both must match the table below.**
3. **If either does not match, STOP.** Post "wrong worktree/model: …" on the hub, and do nothing more.

| Record | Candidate | Dispatch | Worktree | Model | Hub name | Push with |
|---|---|---|---|---|---|---|
| **162** | A13 `4b43410` | `loop-15-slice-3-dispatch-qa-a13.md` | `~/Worktrees/sia-cq-162` | Composer 2.5 | `cq-162` | `docs/loops/qa-162/push-qa.mjs` (never a `-spot` name) |
| **161** | /bootstrap r4 `7bd47f4` | `bootstrap-fix-r4-dispatch-qa.md` | `~/Worktrees/sia-cq-161` | Composer 2.5 | `cq-161` | `docs/loops/qa-161/push-qa.mjs` |
| **172** | importer r6 `c2ee52d` | `importer-leftovers-r6-dispatch-qa.md` | `~/Worktrees/sia-cq-172` | Composer 2.5 | `cq-172` | `docs/loops/qa-172/push-qa.mjs` |
| **173** | T-048 r1b `d5b78cb` | `t048-r1b-dispatch-qa.md` | `~/Worktrees/sia-cq-173` | Composer 2.5 | `cq-173` | `docs/loops/qa-173/push-qa.mjs` |
| **174** | A13 `4b43410` (SPOT-CHECK) | `loop-15-slice-3-dispatch-qa-a13-spot.md` | `~/Worktrees/sia-cq-174` | GPT-5.6 Sol | `cq-174` | `docs/loops/qa-174/push-qa.mjs` |

## What changes from the dispatch

- **It is not headless, and there is no `qa-queue`, `drive.ps1` or `C:\qa-tmp`.** Ignore those lines in the dispatch.
  Scratch worktrees go beside your own, e.g. `../sia-cq-162-cand`.
- **Tests run on tcm, never locally.** Use `gh workflow run ci.yml --ref <your qa branch>`, leaving `hosted` and
  `windows` false, and read results per test from `gh run view <id> --log`. **No local suite, no local vitest, no
  local build.**
  - Light local commands are fine: `git`, reading files, single-file `tsc --noEmit`, and one CLI invocation against
    a scratch clone.
  - The dispatch's CI cap still applies.
  - Where a dispatch asks for a "full suite on the default TEMP", the tcm run of your branch is it. Say so in the
    report.
- **"Elevated / `SeBackupPrivilege`":** report it for this desktop, from `whoami /priv`.
- **Never open a visible window.** No `Win32_Process Create`, and no `Start-Process` without `-WindowStyle Hidden`.
  **This desktop is in use.**
- **Pushing:**
  - only through your push script, and only your own prefix;
  - never `git push`, master, a tag, a PR or another seat's branch;
  - never any `state.json`; no `/end`.
- **Do not read the other Cursor QA seats' branches or rooms.** 162 and 174 score the same candidate independently.

## Reporting on the hub

When your report is committed and pushed, post its path and SHA:
`HUB_URL=http://100.124.212.87:4000 node C:/Users/melve/Projects/A2A-Hub/scripts/hub-talk.mjs --as <hub name> --peer atlas --say "..."`

Your first run of that command creates your room with the planner. Then run the same command with
`--wait --wait-timeout 3500` in place of `--say`, and act on the reply. **Your model goes in the report.**
