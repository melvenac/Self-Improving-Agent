# QA 298, session-165 batch c: BRIEFING-FIX BF-A6 (Windows ACL) — ONE row, narrow

**By:** Atlas (planner), 2026-10-09, session 165. **Machine:** the LAPTOP (clark's booking, D-065).
**Routing:** D-140 case 1 (Windows/real-process). The rest of BRIEFING-FIX is judged by Grok (grok-sia-review, turn 43).
**Under test:** SIA PR #545, branch `loop/briefing-fix`, pinned at **`3ded135d08a52338010c442ae65e33349aff7464`**
(planner-verified r3: 14 files 177/177, tsc 0, scope; BF-A6 dry-run on the r1 head passed). **Row:** brief `docs/loops/briefing-fix-brief.md` §Acceptance BF-A6.
**Prefix** `s165c`. **Report:** `docs/loops/s165c-qa-report.md` on `qa/s165c-report`, pushed only by
`node docs/loops/qa-298/push-qa.mjs qa/s165c-report`. No open-brain MCP is needed or used.

## Rows

| # | Command | Pass when |
|---|---|---|
| P1 | `node -v` | `v22.*`, else STOP → INCOMPLETE |
| P2 | `git ls-remote origin refs/heads/loop/briefing-fix` | = the pin, else STOP → INCOMPLETE `pin moved` |
| P3 | `git worktree add --detach C:/qa-scratch/qa298-pr545 3ded135d08a52338010c442ae65e33349aff7464`; then in `C:/qa-scratch/qa298-pr545/open-brain`: `npm ci && echo EXIT=0 || echo EXIT=nonzero` and `npm run build && echo EXIT=0 || echo EXIT=nonzero` | both `EXIT=0`. **Any failure → STOP INCOMPLETE `build`. No fixes, no retries beyond one re-run of a failed `npm ci`.** |
| P4 | `git -C C:/qa-scratch/qa298-pr545 log -1 --format=%H` | = the pin |
| A6 | From the `qa298-wt` dispatch tree: `powershell -NoProfile -ExecutionPolicy Bypass -File docs/loops/qa-298/bf-a6.ps1 -Cli C:/qa-scratch/qa298-pr545/open-brain/build/cli.js -Fixture C:/qa-scratch/qa298-pr545/open-brain/tests/fixtures-state/state.json`. Paste the WHOLE output | CASE 1: `has 'not writable': True` and `has 'commit or stash': False`. CASE 2: `has 'is not readable (permissions)': True` and `has 'commit or stash': False`. Every `icacls after (restored)` shows no `(DENY)` entry for your user. The final listing is exactly `keep.txt` (nothing was written) |
| G1 | `icacls C:\qa-tmp\qa298\repo\.claude\commands` and `icacls C:\qa-tmp\qa298\repo\stray.txt` once more after the script | no `(DENY)` entry for your user. If any remains: run `icacls <path> /remove:d "%USERDOMAIN%\%USERNAME%"` and report it as a FINDING |

## Rules

- Read-only on every repo except the scratch worktrees and your own `qa/s165c-*` branch. Never push to `loop/briefing-fix`.
- Every number is pasted output with its command; anything not run is `NOT RUN` with the reason.
- Kill nothing by name; a process you started that hangs past 10 minutes is stopped by its recorded PID only.
- **Verdict:** ACCEPT if P1–P4, A6 and G1 pass. A6 failing either expectation is REJECT naming the case. A STOP is INCOMPLETE.
- The report's last line is exactly `QA-298: REPORT COMPLETE`.
