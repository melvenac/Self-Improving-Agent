# QA PC verification: T-267's live check (skills-audit under a home with a space) and T-168's CC-seat lease check

Runtime: CC (claude -p, Opus 5.5)
SEAT: **QA PC only** (its Windows user is "Aaron Melven", a home with a space: that is the point). One-off, no hub key
needed for T-267. **Read-only against the repo: no commit, no push, no PR.** Ends at a REPORT, which the planner rules.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named qapc-verify-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Tasks:** T-267 (P1), T-168 (P1). **Tag:** `QAPC-VERIFY`.
**Base:** the dispatch SHA clark names (master after #721 if it has merged); if none, `origin/master` after the fetch.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: none: no code changes; two live checks of merged code
```

## Why

- **T-267** (merged #656 on 10-13, main rebuilt since): the transcript folder now follows Claude Code's own rule
  (`deriveProjectKey` replaces every non-alphanumeric character with `-`), and git runs without a shell. Before it,
  `open-brain skills-audit` threw on a home with a space. Its live check is owed **on the QA PC**, the one machine whose
  home has a space; the desktop's does not.
- **T-168** (the heavy suite's peer census and machine lease): the lease check (take 0 / release 0) is owed on the QA
  PC, where the lease helper lives, from one CC seat and one Cursor seat. This run is the **CC half**; the Cursor half
  stays owed. T-283 (merged tonight, #698) fixed the vitest JSON path that split on this home's space; T-269 (#702)
  taught the census that an alarm run_too_long seat is busy.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "qapc-verify-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED). Print
   `$env:USERPROFILE` (it must contain a space; if it does not, STOP: `BLOCKED QAPC-VERIFY not the QA PC`).
2. **Start state.** Fresh clone into `(Join-Path $env:TEMP "qapc-verify-wt")` unless the launcher named one;
   `git checkout -q --detach <base>`; print `git rev-parse HEAD`; porcelain empty. In `open-brain`: `npm ci`, then
   `npm run build` (exit 0). **Forbidden:** any commit, push, branch or PR; `git stash`, `reset --hard`, `--force`;
   `npm run test:heavy` WITHOUT `SUITE_DRY_RUN=1`; a full vitest run; killing any process; editing any file in the clone.
3. **T-267: skills-audit under this home.** From the clone root, in PowerShell:
   - `node open-brain/build/cli.js skills-audit --last 1 .` then print `$LASTEXITCODE`.
   - The same command from Git Bash (`bash -lc 'node open-brain/build/cli.js skills-audit --last 1 .; echo EXIT=$?'`).
   - Paste both outputs in full (cap 60 lines each). This run's own transcript is under
     `~\.claude\projects\<key>` where `<key>` is the clone path with every non-alphanumeric character replaced by `-`:
     print `Test-Path` of that folder and the count of `*.jsonl` in it.
   - **What the planner needs:** whether the command found this session's transcript and listed rows (or said plainly
     that it found none), versus throwing / exiting non-zero on the path. Do not judge it; paste it.
4. **T-168: the CC half of the lease check.** In `open-brain`, from PowerShell:
   - `$env:SUITE_DRY_RUN = '1'; npm run test:heavy; "EXIT=$LASTEXITCODE"; Remove-Item Env:SUITE_DRY_RUN`
   - Then the same from Git Bash: `bash -lc 'cd open-brain && SUITE_DRY_RUN=1 npm run test:heavy; echo EXIT=$?'`.
   - Paste both outputs in full, and the meta file the run writes (find it with
     `Get-ChildItem -Recurse -Filter 'suite-run-meta*.json' open-brain | Select-Object -First 3`; paste each).
   - **What the planner needs, per run:** the owner (pid and source), the lease take and release exit codes, the census
     line (available or not, the busy SIA seats it named, and the seat it resolved for this checkout), and the exit
     code. A refusal is a valid result: paste its reason. If the lease is held by another run, say so and do not retry.
5. `git status --porcelain` in the clone must still be empty (the dry run must not dirty the tree). Paste it.

## Reply

- **First line:** `REPORT QAPC-VERIFY <base sha40>` or `BLOCKED QAPC-VERIFY <reason>`.
- Then each command with its output, in order. Mark anything not run `NOT RUN`. No verdicts: the planner rules.
