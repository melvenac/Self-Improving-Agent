# QA PC verification: T-168's lease check from a Cursor seat, and which SIA hooks cursor-agent fires there (T-235)

Runtime: Cursor (cursor-agent, any model clark picks), launched from **PowerShell** (T-046: Cursor + Git Bash fail-closes)
SEAT: **QA PC only**. One-off. **Read-only against the repo: no commit, no push, no PR.** Ends at a REPORT, which the
planner rules.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t168-cursor-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Tasks:** T-168 (P1), T-235 (P1). **Tag:** `T168-CURSOR`.
**Base:** the dispatch SHA clark names; if none, `origin/master` after the fetch.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: none: no code changes; a live check of merged code and a read of the QA PC's Cursor hook config
```

## Why

- **T-168:** the heavy suite takes a machine lease and reads a peer census before it runs. The QA PC's CC half PASSED
  this session (owner = the run's own claude process, lease take 0 / release 0, census available, exit 0). The same
  check from a **Cursor** process is owed: the owner detection and the census key are runtime-dependent.
- **T-235:** on the desktop, `~/.cursor/hooks.json` holds only `sessionStart`, so cursor-agent fires no SIA
  postToolUse hook there. The QA PC's file was never read.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t168-cursor-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED). Print
   `$env:USERPROFILE` (it must contain a space; if not, STOP: `BLOCKED T168-CURSOR not the QA PC`). Print
   `Get-ChildItem Env: | Where-Object Name -match '^(CURSOR|CLAUDE)' | Select-Object Name` (names only, no values).
2. **Start state.** Fresh clone into `(Join-Path $env:TEMP "t168-cursor-wt")` unless the launcher named one;
   `git checkout -q --detach <base>`; print `git rev-parse HEAD`; porcelain empty. In `open-brain`: `npm ci`, then
   `npm run build` (exit 0). **Forbidden:** any commit, push, branch or PR; `git stash`, `reset --hard`, `--force`;
   `npm run test:heavy` WITHOUT `SUITE_DRY_RUN=1`; a full vitest run; killing any process; editing any file in the clone
   or under `~/.cursor`.
3. **T-168, the Cursor half.** In `open-brain`, from PowerShell only:
   - `$env:SUITE_DRY_RUN = '1'; npm run test:heavy; "EXIT=$LASTEXITCODE"; Remove-Item Env:SUITE_DRY_RUN`
   - Paste the output in full, then the meta file the run writes (find it with
     `Get-ChildItem -Recurse -Filter 'suite-run-meta*.json' open-brain | Select-Object -First 3`; paste each).
   - **What the planner needs:** the owner (pid and source), the lease take and release exit codes, the census line
     (available or not, the busy SIA seats it named, the seat it used), and the exit code. A refusal is a valid
     result: paste its reason. If the lease is held by another run, say so and do not retry.
   - Then `git status --porcelain` in the clone; paste it (T-289 expects the meta file NOT to dirty the tree).
4. **T-235, the QA PC's Cursor hooks.** Paste, in full:
   - `Get-Content (Join-Path $env:USERPROFILE ".cursor\hooks.json")` (or `ABSENT`);
   - from the clone root, `Get-Content .cursor\hooks.json`, the clone's project-level file (or `ABSENT`);
   - the hook event names each file registers, one line per file.
   Do not judge whether a hook fired; the planner reads that from the files.

## Reply

- **First line:** `REPORT T168-CURSOR <base sha40>` or `BLOCKED T168-CURSOR <reason>`.
- Then each command with its output, in order. Mark anything not run `NOT RUN`. No verdicts: the planner rules.
