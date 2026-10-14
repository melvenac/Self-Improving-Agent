# T-279 amendment 1: W1 and W2 run on every platform (S4-9.2 forbids an added runIf)

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off, NOT the desktop. It must be a Windows host, so the live branch really runs. No hub key.
Tests only in this round. Ends at READY with PR #700 updated, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t279-r2-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 170. **Task:** T-279 (P3). **Tag:** `T-279`. **Size:** SMALL.
**Branch:** `fix/t279-ascii-table-pipe` at `773133470bb66d8e4b65d9e362d8b9a066c102f0` (PR #700, round 1). If clark
re-pins it at launch, that SHA wins.
**The brief's rulings stand** (`docs/loops/t279-ascii-safe-table-pipe-brief.md`), except where this changes them.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: none — test code only (tests/t279-ascii-safe-table.test.ts); no src symbol changes in this round
```

## Why

Round 1 is green on Windows on every row the brief named. CI (Linux) failed on `tests/harness/s4-guards.test.ts` >
"S4-9.2 no skip, todo, skipIf or runIf is added, and no test file loses a test", because the brief told W1 and W2 to
use `it.runIf(process.platform === "win32")`.
- **The guard is right, and the brief was wrong.** S4-9.2 (session 157) forbids any added conditional skip under
  `open-brain/tests`.
- **The fix:** each row runs on every platform and asserts what is true there:
  - On win32: the live check, unchanged.
  - Elsewhere: the loader fails closed, because there is no Windows PowerShell. `readWin32ProcessTableStdout` spawns
    `powershell.exe`, which a Linux runner lacks, and `loadWin32ProcessTable` turns that throw into
    `{ ok: false, reason: "Win32 process table: ..." }`.
- The repo branches on the platform inside a test the same way: `tests/pipelines/sync/mcp-command-paths.test.ts:14`,
  `const win = process.platform === "win32";`.

## Ruling (exact; `open-brain/tests/t279-ascii-safe-table.test.ts` only)

1. Directly inside the describe, before A1, add `const win = process.platform === "win32";`.
2. **W1:** `it.runIf(process.platform === "win32")(` becomes `it(`. The title becomes
   `"W1: on win32 a synthetic row read through the production spawn arrives as printable ASCII and parses back exactly (unescaped it does not); elsewhere the spawn throws and the loader refuses"`.
   As the body's first statements, before `const lit`, add:
   ```ts
      if (!win) {
        // No Windows PowerShell here (S4-9.2: no runIf): the production spawn throws, and the loader fails closed.
        expect(() => ps.readWin32ProcessTableStdout("Get-Date")).toThrow();
        const refused = ps.loadWin32ProcessTable();
        expect(refused.ok).toBe(false);
        if (!refused.ok) expect(refused.reason).toMatch(/^Win32 process table: /);
        return;
      }
   ```
   The rest of W1 is unchanged.
3. **W2:** `it.runIf(process.platform === "win32")(` becomes `it(`. The title becomes
   `"W2: on win32 the real table reads as printable ASCII and loads; elsewhere the loader refuses"`. As the body's first
   statements, before `await tick();`, add:
   ```ts
      if (!win) {
        const refused = ps.loadWin32ProcessTable();
        expect(refused.ok).toBe(false);
        if (!refused.ok) expect(refused.reason).toMatch(/^Win32 process table: /);
        return;
      }
   ```
   The rest of W2 is unchanged.
4. Change nothing else, in this file or any other.

## Existing tests (planner-read at 77313347; verdicts)

- A1-A4: **stay green**, untouched.
- W1 and W2 on win32: **stay green**, through the same live branch as round 1.
- `tests/harness/s4-guards.test.ts` S4-9.2: **turns green**, because no runIf remains.
- The t270, t268, t235 and t168 files: **stay green**, untouched.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t279-r2-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.** Work in the fresh clone the launcher named. If it named none, clone into
   `(Join-Path $env:TEMP "t279-r2-wt")`.
   - Run `git checkout -q -b fix/t279-ascii-table-pipe origin/fix/t279-ascii-table-pipe`. `git rev-parse HEAD` must
     print `773133470bb66d8e4b65d9e362d8b9a066c102f0`, and `git status --porcelain` must be empty, else STOP,
     BLOCKED.
   - Run `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`. If that fails, run
     `npm rebuild better-sqlite3` and say so.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
     `npm run test:heavy`, killing any process by name, and any edit outside the one test file.
3. **Red at the head**, in `open-brain`:
   `npx vitest run tests/harness/s4-guards.test.ts --no-file-parallelism --testTimeout=180000`. S4-9.2 must fail,
   naming the `it.runIf(` lines. Paste it.
4. **Commit 3, `T-279 r2: W1 and W2 run on every platform (S4-9.2 forbids an added runIf)`:** the ruling. End the message
   with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Then run, in `open-brain`,
   `npx vitest run tests/t279-ascii-safe-table.test.ts tests/harness/s4-guards.test.ts tests/t270-table-control-chars.test.ts --no-file-parallelism --testTimeout=180000`
   (all green; W1 and W2 take the live branch on this Windows host) and `npx tsc --noEmit` (exit 0). Paste both.
   - If vitest prints `Timeout calling "onTaskUpdate"`, re-run the named file alone once and say which file printed it.
5. **Mutants** (edit, run the t279 file only, paste, `git checkout -- <file>`, clean tree; never commit):
   - **M-live** (tests file): in W2's live branch, `toBeGreaterThan(10)` becomes `toBeGreaterThan(1e9)`. W2 goes red, which
     proves the live branch ran on this host.
   - **M-else** (tests file): `const win = process.platform === "win32";` becomes `const win = false;`. On this host W1 and
     W2 then take the non-win32 branch, and BOTH go red: on Windows the spawn does not throw and the loader succeeds.
     This proves the non-win32 branch asserts something.
6. `git log --oneline 77313347..HEAD` shows 1 line, and `git status --porcelain` is empty. Run
   `git diff --name-only 77313347..HEAD`: it must show only `open-brain/tests/t279-ascii-safe-table.test.ts`.
7. `git push origin fix/t279-ascii-table-pipe` (never force). `ls-remote` must equal `rev-parse HEAD`. Wait for CI on
   PR #700 (`gh pr checks 700 --watch --interval 30`, cap 20 min) and paste the `test` conclusion. On Linux, W1 and W2
   take the non-win32 branch.

## Reply

- The first line is `READY T-279 <sha40> PR #700` or `BLOCKED T-279 <reason>`.
- Then each command with its output: the red run, the green run, tsc, both mutants, the log, the name-only diff,
  `ls-remote` = `rev-parse`, and CI.
- Paste test output with `grep -a`, or without grep. Mark anything not run `NOT RUN`.
- At most 2 attempts at any step. Do not merge.
