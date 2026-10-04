# QA 276, session-161 batch d: #427 r2's real-Windows walk (QA 274 row 20, re-run)

**By:** Atlas (planner), 2026-10-04, record session 161. Clark booked the laptop for it on Aaron's "get all agents
working".

**Why this job exists.** #427 r2 (`987901c9cb43f3dd3a31b9e22fec164edd9769dd`, CI 37189839577 green) replaced the
Windows walk: one `Get-CimInstance Win32_Process` query walked in memory, instead of one `powershell.exe` spawn per
ancestor. It also starts the walk at `process.ppid` and matches the host by cursor-agent's `versions/<ver>/index.js`
entry. QA 274's row-20 evidence (`origin/qa/s161b-report` @ `bfc22508`) is for the OLD walk. QA 275 on Plumb covers
r2's Linux rows. **This job covers Windows only.** Read QA 274's row 20 and F2/F3 first; reuse its method.

**Machine:** the laptop (DESKTOP-0GV3HAD), real Windows, Git Bash and PowerShell 5.1. Take `machine-lease.ps1`, and
call it with `-File` (G-054: `-Command` loses the exit code). **LIGHT:** the fixture, probes and the touched test
files one per run. No full suite. Nothing against the real home directory or a live record.

## Rows

1. **Confined and pinned.** `refs/pull/427/head` equals `987901c9`. List the files changed since `270b550b`.
2. **CI (read only).** Run 37189839577 belongs to `987901c9`; `test` result.
3. **The new walk on real Windows, both shells.** QA 274's legs A to F again, at r2: the fixture host found from
   PowerShell 5.1 and from Git Bash, the proof at `by-pid/<hostPid>.json` with the right four fields, and with no host
   a visible "not written" reason and no file. Note that r2's e2e fixture lives at
   `tests/fixtures-t003/cursor-agent/versions/e2e-fixture/index.js`.
4. **F2 is fixed on Windows.** Reach the repo through a directory whose name contains `cursor-agent`, with no host:
   NO proof is written. Then with a host: the proof is for the host's pid, never the hook's.
5. **F3 timing.** Time SessionStart with a host nearby and with no host (the walk to the root), three runs each, and
   compare with QA 274's 2–4 s and 7–9 s. Report the CIM query the code runs (command and filter) and whether it is
   one process spawn per SessionStart.
6. **The matcher against a real install.** If cursor-agent is installed on the laptop, read (do not run) its
   process's command line shape from one live process, or else from its install directory, and say whether
   `isCursorAgentHostCommandLine` would match it. Report paths only; no tokens or values.

## Rules (headless Claude Code)

- You are **QA 276**, prefix `s161d`. Push ONLY `qa/s161d-*` branches, and only through
  `node docs/loops/qa-276/push-qa.mjs <branch>`, run from your `qa276-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config and key files report only counts, names, paths and hash match/no-match, never values (G-051).
- Commit `docs/loops/s161d-qa-report.md` on `qa/s161d-report`.
- One verdict for #427 r2's Windows rows, with the pinned SHA. The report's last line is exactly
  `QA-276: REPORT COMPLETE`.
