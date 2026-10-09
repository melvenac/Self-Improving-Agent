# QA 298-r3, session-165 batch c: BRIEFING-FIX BF-A6 (Windows ACL), non-elevated, fresh names

**By:** Atlas (planner), 2026-10-09, session 165. **Machine:** the LAPTOP. clark launches it as a one-shot scheduled
task (Principal LogonType Interactive, RunLevel Limited); this is not the elevated ssh path.

**History:**
- **r1** (`qa/s165c-report-r1` @ `8697568a`): ran elevated, and its REJECT was ruled environment-invalid.
- **r2:** INCOMPLETE `stale qa-tmp`, because r1's scratch still existed under the same names.

r3 uses FRESH names everywhere and leaves every r1/r2 leftover untouched.

**Routing:** D-140 case 1. Grok's half of #545 is done: `docs/loops/briefing-fix-review-r2.md`, ACCEPT-level.
**Under test:** SIA PR #545, `loop/briefing-fix` @ **`3ded135d08a52338010c442ae65e33349aff7464`**.
**Row:** BF-A6 from `docs/loops/briefing-fix-brief.md` §Acceptance.
**Prefix:** `s165c`. **Report:** `docs/loops/s165c-r3-qa-report.md` on branch **`qa/s165c-report-r3`**, pushed only by
`node docs/loops/qa-298/push-qa.mjs qa/s165c-report-r3`.

| Name | Path |
|---|---|
| dispatch tree | `C:/qa-scratch/qa298r3-wt` |
| build tree | `C:/qa-scratch/qa298r3-pr545` |
| tmp root | `C:/qa-tmp/qa298r3` |

## Rows

| # | Command | Pass when |
|---|---|---|
| S0 | List, and touch nothing: `Get-ChildItem C:/qa-scratch, C:/qa-tmp -Directory -Filter 'qa298*' -Name`, plus `git branch --list "qa/s165c*"` in the SIA QA clone | Printed. Leftovers from r1/r2 are EXPECTED and must NOT be removed, moved or reused. STOP INCOMPLETE `name taken` only if one of r3's OWN three paths above already exists |
| P1 | `node -v` | `v22.*`; otherwise STOP → INCOMPLETE |
| P2 | `git ls-remote origin refs/heads/loop/briefing-fix` | equals the pin; otherwise STOP |
| P3 | `git worktree add --detach C:/qa-scratch/qa298r3-pr545 3ded135d08a52338010c442ae65e33349aff7464`; then `npm --prefix C:/qa-scratch/qa298r3-pr545/open-brain ci` and `npm --prefix C:/qa-scratch/qa298r3-pr545/open-brain run build` | both succeed (the tool reports no error). On failure: STOP INCOMPLETE `build`, with no fixes and at most one re-run of `npm ci` |
| P4 | `git -C C:/qa-scratch/qa298r3-pr545 log -1 --format=%H` | equals the pin |
| A6 | From `C:/qa-scratch/qa298r3-wt`: `powershell -NoProfile -ExecutionPolicy Bypass -File docs/loops/qa-298/bf-a6.ps1 -Cli C:/qa-scratch/qa298r3-pr545/open-brain/build/cli.js -Fixture C:/qa-scratch/qa298r3-pr545/open-brain/tests/fixtures-state/state.json -Root C:\qa-tmp\qa298r3`. Paste the WHOLE output | The PRIVILEGE PREFLIGHT prints `privileges OK` (exit 3, `STOP INCOMPLETE: elevated session`, is verdict INCOMPLETE). CASE 1: `has 'not writable': True` and `has 'commit or stash': False`. CASE 2: `has 'is not readable (permissions)': True` and `has 'commit or stash': False`. Each `icacls after (restored)` shows no `(DENY)` for your user. The final listing is exactly `keep.txt` |
| G1 | `icacls C:\qa-tmp\qa298r3\repo\.claude\commands` and `icacls C:\qa-tmp\qa298r3\repo\stray.txt` | No `(DENY)` entry for your user. If one remains, run `icacls <path> /remove:d "%USERDOMAIN%\%USERNAME%"` and report a FINDING |

## Rules

- Read-only everywhere except your three r3 paths and your own `qa/s165c-report-r3` branch.
- Never delete, move or reuse any `qa298*` path or `qa/s165c*` branch that you did not create in this run.
- Every number is pasted output, with the command above it. Anything not run is `NOT RUN`, with the reason. Kill
  nothing by name.
- **Verdict:**
  - ACCEPT if S0, P1–P4, A6 and G1 all pass.
  - REJECT naming the case if A6 fails with `privileges OK` printed.
  - INCOMPLETE on any STOP.
- The report's last line is exactly `QA-298: REPORT COMPLETE`.
