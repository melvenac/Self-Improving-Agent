# T315-REVERT: unwire the exit-on-new-build watch from server.ts (T-315)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t315-revert-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-20, session 174. **Task:** T-315 (Aaron 10-20: "that's fine, go"). **Tag:**
`T315-REVERT`. **Size:** SMALL (1 src file, 2 edits; 1 existing test row replaced). **Base:** the dispatch SHA Atlas
names (a master that contains this brief). **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: watchBuild attachBuildWatch (server.ts no longer calls them; build-watch.ts and its R1-R5 rows stay, unused)
```

## Why

T315-S1 (#885, merged `97eb3481`) made each open-brain server exit when a new build is stamped on disk, so that Claude
Code would respawn it from the new build. The live test failed on 10-20:
- Every server was on `97eb348`, with the watch (started 06:18Z after `/mcp reconnect`).
- `sia-rebuild` to `9e0d5b01` finished at 06:19:27Z.
- By 06:19:57Z all six servers had exited, and Claude Code respawned none. Each seat showed open-brain as a failed
  MCP server, and its tools were gone until Aaron ran `/mcp reconnect open-brain` in every seat.

Before T-315, a stale server kept serving and the briefing's Build line said `STALE PROCESS → /mcp reconnect`. That is
better than no server. **Fix:** remove the wiring. `build-watch.ts` stays for T-315's next attempt (a respawn that
does not depend on the host), and its R1-R5 rows stay green.

## The change, exactly

All files are under `docs/loops/t315-revert/`.

- **`tests.txt`:** 1 exact-once replacement in `open-brain/tests/shared/t315-s1.test.ts`. R6 changes from "server.ts
  wires the watch" to "server.ts does not wire the watch": no `./shared/build-watch.js` import, no
  `attachBuildWatch(`, no `process.exit(0)`, and `server.connect(transport).catch(` present.
- **`edits.txt`:** 2 exact-once replacements in `open-brain/src/server.ts`, the exact inverse of
  `docs/loops/t315-s1/edits.txt`, plus a 2-line comment saying why.
- **`m1.txt`:** the mutant (the watch wired back after connect). Never committed.

## Measured before dispatch

Atlas, on the desktop, by text only (apply.cjs on a scratch copy of master `9e0d5b01`'s `server.ts`; no build, no
tests):
- `tests.txt` then `edits.txt`: `APPLIED 1 edits to 1 files`, then `APPLIED 2 edits to 1 files`.
- The reverted `server.ts` differs from pre-T-315 `16075e2a`'s only by the 2 comment lines. T315-S1 (`f17c7a25`) is
  the only commit to touch `server.ts` since `16075e2a`.
- After the revert, `server.ts` has 0 `./shared/build-watch.js`, 0 `attachBuildWatch(`, 0 `process.exit(0)`, 0
  `runningBuildDir`, 0 `LOADED_COMMIT`, and 1 `server.connect(transport).catch(`.
- `m1.txt` on the reverted file: `APPLIED 1 edits to 1 files`, and `attachBuildWatch(` is back (1).

No QA PC SIM ran. Step 3's red R6 and step 6's mutant are the checks.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/shared/t315-s1.test.ts` R1-R5 | stay green | They import `build-watch.ts` directly; it is unchanged. |
| `tests/shared/t315-s1.test.ts` R6 | replaced | Its old text asserted the wiring this run removes. |
| `tests/server.test.ts` | stays green | The watch ran only under `isDirectRun`, which tests never hit; `server.ts` returns to its `16075e2a` text. |
| `tests/shared`, `tests/pipelines/session-start` | stay green | `serving-build.ts` is unchanged; `runningBuildDir` and `LOADED_COMMIT` stay exported. |

Any other red existing row means STOP and report `BLOCKED T315-REVERT <test name>`. There are two exceptions, both
from T-292 load on the shared QA PC:
- T-292's `Timeout calling onTaskUpdate` error when every test passed: paste it and go on.
- That error with ONE red existing test outside `t315-s1.test.ts`: re-run that test's file alone. If it is green
  alone, paste both runs and go on. If it is red alone, STOP.
- A red `t315-s1.test.ts` row after step 4 is never an exception.

## Steps

1. **Shell.** In PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t315-revert-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`. Otherwise STOP.
2. **Clone and install.**
   - Make a fresh clone into `(Join-Path $env:TEMP "t315-revert-wt")`, unless the launcher named one.
   - Run `git checkout -q -b fix/t315-revert <base>`. HEAD must equal the base, and the porcelain must be empty.
   - In `open-brain`, run `npm ci`, then the better-sqlite3 probe.
   - Forbidden: stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/open-brain/`, `~/.claude/commands/`, and anything under `docs/`.
3. **Commit 1** (`T315-REVERT: R6 pins the unwired watch`). It holds the test change only.
   - From the clone root, `node docs/loops/t315-revert/apply.cjs . docs/loops/t315-revert/tests.txt` must print
     exactly `APPLIED 1 edits to 1 files`.
   - Run `$env:NO_COLOR='1'`. Then, in `open-brain`, run
     `npx vitest run tests/shared/t315-s1.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect `1 failed | 5 passed (6)`: R6 red, R1-R5 green. Paste the summary and the `x` rows.
4. **Commit 2** (`T315-REVERT: unwire the exit-on-new-build watch; Claude Code did not respawn the servers (T-315)`).
   - From the clone root, `node docs/loops/t315-revert/apply.cjs . docs/loops/t315-revert/edits.txt` must print
     exactly `APPLIED 2 edits to 1 files`.
   - Run `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build` (exit 0).
   - Run `npx vitest run tests/shared tests/server.test.ts tests/pipelines/session-start --no-file-parallelism --testTimeout=180000`
     (25-minute cap). Expect 0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
5. **Check the commits.**
   - Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <base>..HEAD` shows 2 lines.
   - The status is empty.
6. **Mutant.** On the committed fix:
   - Run `node docs/loops/t315-revert/apply.cjs . docs/loops/t315-revert/m1.txt`. It prints `APPLIED 1 edits to 1 files`.
   - Run `tests/shared/t315-s1.test.ts`. Paste the `x` rows. Expected red: R6 only.
   - Restore with `git checkout -- open-brain/src`. The status must be empty. Never commit it.
7. **Check the diff.** `git diff --name-only <base>..HEAD` shows exactly:
   - `open-brain/src/server.ts`
   - `open-brain/tests/shared/t315-s1.test.ts`
8. **Push and open the PR.**
   - Push, never force. `git ls-remote origin refs/heads/fix/t315-revert` must equal HEAD.
   - Run `gh pr create --base master --head fix/t315-revert --title "T315-REVERT: unwire the exit-on-new-build watch (T-315)" --body "Brief: docs/loops/t315-revert-brief.md."`.
   - Then run `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T315-REVERT <sha40> PR #<n>` or `BLOCKED T315-REVERT <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply.
- Every number is pasted output, with its command shown above it. Mark anything not run `NOT RUN`.
- Do not merge.

## After merge (not this run)

`sia-rebuild`. Running servers are still on `9e0d5b0`, with the watch, so **this rebuild makes every server exit one
last time**: every seat needs `/mcp reconnect open-brain` right after it. From then on a rebuild leaves servers running,
and the Build line says `STALE PROCESS` until a reconnect, as before T-315.
