# T168-CURSOR amendment 1: name the seat, and launch with the prompt in a file

Runtime: Cursor (cursor-agent), launched from **PowerShell**, with the prompt passed by FILE or STDIN, never inline.
SEAT: QA PC only. One-off. Read-only against the repo. Ends at a REPORT.
REPLY: an ABSOLUTE path under the user's %TEMP% named t168-cursor-a1-reply.md (a launcher's reply path wins).

**By:** Atlas (planner), 2026-10-15, session 171. **Amends:** `docs/loops/t168-cursor-half-brief.md`. Everything there
stands except what this file changes. **Tag:** `T168-CURSOR`.

## Why

- **Run 1 hung.** It ran 1h45 with no output, no reply and a log holding only `started`. The launcher had passed the
  whole brief inline (`agent.cmd -p -f "<brief text>"` through `cmd.exe /c`).
- **The runner now refuses without a seat.** Since T-168R (D-156, 0d5cab20), the suite runner refuses in a checkout the
  seat map does not name. This brief's fresh clone `t168-cursor-wt` is one, so the dry run would refuse before the
  lease.

## Changes

1. **Launcher (clark):** pass the prompt as a FILE (or on stdin), not as an inline argument. Kill the run after
   **20 minutes** of wall clock and capture whatever it wrote.
2. **Brief step 3:** set the seat explicitly before the dry run, and print the runner's seat line:
   `$env:SUITE_SEAT = 'cursor-builder'; $env:SUITE_DRY_RUN = '1'; npm run test:heavy; "EXIT=$LASTEXITCODE"; Remove-Item Env:SUITE_DRY_RUN; Remove-Item Env:SUITE_SEAT`.
   The output's first line must be `suite seat: cursor-builder (SUITE_SEAT)`. Paste it.
3. **Base:** the dispatch SHA clark names, which must contain 0d5cab20 (T-168R).

Everything else (steps 1, 2, 4 and the reply shape) is as in the brief. The first line is `REPORT T168-CURSOR <base sha40>`
or `BLOCKED T168-CURSOR <reason>`.
