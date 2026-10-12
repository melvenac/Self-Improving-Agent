# T-252: carry PR #580's fallback change across master's move of handleStart into start-report.ts

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: one-off (no hub key). Host: the QA PC, the laptop or the desktop, clark's choice. Code only.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the host user's %TEMP% named t252-mf-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-12, session 168. **Task:** T-252 (P2). **Tag:** `T-252-mf`. **Size:** TINY.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: the fleet fallback inside renderStartReport's report object (start-report.ts ~271; no named symbol changes); fleetFallback (added by #580, unchanged here)
```

## Why

PR #580 (branch `fix/t252-briefing-followups`, head `4f607a6f`) is accepted, but it is DIRTY against master. T-154 (#602)
moved `handleStart`'s body from `open-brain/src/server.ts` into
`open-brain/src/pipelines/session-start/start-report.ts`. #580 changed 6 lines of `server.ts` there: it imports
`fleetFallback` and replaces the fleet `catch` body. The planner trial-merged it: `server.ts` is the **only**
conflict.

The change to carry across is exactly this one: in the `catch (err)` of the `fleet: (() => { … })()` entry, the three
lines that build `FLEET: unavailable (… invalid shape: …)` become `return fleetFallback(err, process.env);`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t252-mf-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`).
2. Fresh clone under `$env:TEMP\t252-mf-wt`. `git checkout -q fix/t252-briefing-followups`, and
   `git rev-parse HEAD` must print `4f607a6f…` (the full SHA from `gh pr view 580 --json headRefOid`). If it differs:
   STOP, `BLOCKED T-252-mf head moved <sha>`. `npm ci` in `open-brain`.
   **Forbidden:** rebase, amend, `reset` in any form, `--force`, stash, another checkout.
3. `git fetch origin; git merge --no-ff origin/master`. It stops on `open-brain/src/server.ts`. Then:
   - `git checkout --theirs open-brain/src/server.ts`, which takes master's version whole. Then confirm it has no
     conflict markers and does not mention `fleetFallback`.
   - In `open-brain/src/pipelines/session-start/start-report.ts`: change `import { describeFleet } from "./fleet.js";` to
     `import { describeFleet, fleetFallback } from "./fleet.js";`, and replace the fleet `catch` body (3 lines, ~line 270)
     with `return fleetFallback(err, process.env);`.
   - Any **other** conflicted file: STOP, `BLOCKED T-252-mf conflict <path>`.
   - `git add` both files and `git commit --no-edit`, appending the trailer
     `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (use `git commit -m "Merge origin/master into fix/t252-briefing-followups (T-252 fallback moved to start-report.ts)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`).
4. Checks:
   - `git grep -n "FLEET_JSON ?? \"fleet.json\"" -- open-brain/src` prints **nothing**. The old fallback is gone everywhere.
   - `git diff origin/master..HEAD --stat` lists exactly `fleet.ts`, `start-report.ts` and
     `tests/pipelines/session-start/t252-briefing-followups.test.ts`. Paste it.
   - `npx tsc --noEmit` exits 0.
   - `npx vitest run tests/pipelines/session-start/t252-briefing-followups.test.ts tests/t154-cli-start.test.ts --no-file-parallelism --testTimeout=180000`.
     Every row is green, except the known desktop reds, which are not in these files.
   - **No bite step:** T252-6 calls `fleetFallback` directly, so no test pins the call site. That is the same as
     #580's original reviewed state. The `git grep` above is the wiring check. Also paste
     `git grep -n "fleetFallback(err, process.env)" -- open-brain/src`, which must print exactly one line, in
     start-report.ts.
5. `git push origin fix/t252-briefing-followups` (a normal push; it fast-forwards). `git ls-remote` must equal
   `git rev-parse HEAD`. Then `gh pr view 580 --json mergeStateStatus` must not be `DIRTY`.

## Reply

The first line is `READY T-252-mf <sha40> PR #580` or `BLOCKED T-252-mf <reason>`. Then each command with its
output: the start head, the conflict list from the merge, both greps, the stat, tsc, vitest, `ls-remote` =
`rev-parse`, and mergeStateStatus. At most 2 attempts at a red. Never edit a test. Mark anything not run `NOT RUN`.
