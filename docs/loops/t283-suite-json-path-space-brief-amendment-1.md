# T-283 amendment 1: P4 runs on every platform (S4-9.2 forbids an added skipIf)

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off, NOT the desktop. No hub key. Tests only in this round. Ends at READY with PR #698
updated, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t283-r2-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 170. **Task:** T-283 (P2). **Tag:** `T-283`. **Size:** SMALL.
**Branch:** `fix/t283-suite-json-path` at `96f72acff4144197033f6fae6d51c961006bcbdd` (PR #698, round 1). If clark
re-pins it at launch, that SHA wins.
**The brief's rulings stand** (`docs/loops/t283-suite-json-path-space-brief.md`), except where this changes them.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: none — test code only (tests/t283-suite-vitest-args.test.ts); no src symbol changes in this round
```

## Why

Round 1 is green on every gate the brief named. CI `test` failed on `tests/harness/s4-guards.test.ts` > "S4-9.2 no
skip, todo, skipIf or runIf is added, and no test file loses a test", because the brief told P4 to use
`it.skipIf(process.platform !== "win32")`.
- **The guard is right, and the brief was wrong.** S4-9.2 (ruled in session 157) forbids any added skip or conditional
  skip under `open-brain/tests`.
- **P4 does not need one.** The bug is not Windows-only: under `shell: true`, Node joins the arguments unquoted for
  `/bin/sh -c` too, so a cwd with a space splits `--outputFile` on Linux as well.
- **The fake `npx` just has to exist on each platform.** The repo already does this:
  `tests/pipelines/sync/mcp-command-paths.test.ts:29-35` (`onPath`) writes `name.cmd` on Windows and `name` with mode
  755 elsewhere.

## Ruling (exact; `open-brain/tests/t283-suite-vitest-args.test.ts` only)

1. P4 becomes a plain `it("P4 (the mechanism, on every platform): ...", () => { ... })`, with NO `skipIf`, `runIf`,
   `skip` or `todo`. Keep its assertions exactly as in round 1. Drop "win32 only" from its title.
2. In P4's fixture, write the fake `npx` for the platform, after the `onPath` pattern:
   - `const win = process.platform === "win32";`
   - On win32 (unchanged from round 1): `join(root, "bin", "npx.cmd")` =
     `` `@"${process.execPath}" "${join(root, "argv.cjs")}" %*\r\n` ``.
   - Elsewhere: `join(root, "bin", "npx")` = `` `#!/bin/sh\nexec "${process.execPath}" "${join(root, "argv.cjs")}" "$@"\n` ``,
     then `chmodSync(<that file>, 0o755)`. Import `chmodSync` from `node:fs`.
   - Prefix PATH with `join(root, "bin") + delimiter` (import `delimiter` from `node:path`), in place of the literal
     `";"`. Keep the case-insensitive PATH key lookup.
3. Change nothing else, in this file or any other.

## Existing tests (planner-read at 96f72acf; verdicts)

- P1-P3: **stay green**, untouched.
- `tests/harness/s4-guards.test.ts` S4-9.2: **turns green**, because no skip remains. Every other s4-guards row stays
  green.
- The suite-run-meta, t168-owner-wired, t268 and t270 files: **stay green**, untouched.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t283-r2-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.** Work in the fresh clone the launcher named. If it named none, clone into
   `(Join-Path $env:TEMP "t283-r2-wt")`.
   - Run `git checkout -q -b fix/t283-suite-json-path origin/fix/t283-suite-json-path`. `git rev-parse HEAD` must print
     `96f72acff4144197033f6fae6d51c961006bcbdd`, and `git status --porcelain` must be empty, else STOP, BLOCKED.
   - Run `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`. If that fails, run
     `npm rebuild better-sqlite3` and say so.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
     `npm run test:heavy`, killing any process by name, and any edit outside the one test file.
3. **Red at the head**, in `open-brain`:
   `npx vitest run tests/harness/s4-guards.test.ts --no-file-parallelism --testTimeout=180000`. S4-9.2 must fail,
   naming the `it.skipIf(` line. Paste it.
4. **Commit 3, `T-283 r2: P4 runs on every platform (S4-9.2 forbids an added skipIf)`:** the ruling. End the message
   with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Then run, in `open-brain`,
   `npx vitest run tests/t283-suite-vitest-args.test.ts tests/harness/s4-guards.test.ts tests/suite-run-meta.test.ts tests/t168-owner-wired.test.ts --no-file-parallelism --testTimeout=180000`
   (all green; P4 really runs on this Windows host) and `npx tsc --noEmit` (exit 0). Paste both.
5. **Mutants** (edit, run the t283 file only, paste, `git checkout -- <file>`, clean tree; never commit):
   - MU1 and MU2 exactly as in round 1. Both still go red.
   - MU3 (tests file): in P4, the fixed shape's arguments → round 1's absolute
     `["vitest", "run", "--reporter=json", "--outputFile", join(cwd, SUITE_VITEST_REPORT)]`. P4 goes red, because more
     than 5 argv elements arrive.
6. `git log --oneline 96f72acf..HEAD` shows 1 line, and `git status --porcelain` is empty. Run
   `git diff --name-only 96f72acf..HEAD`: it must show only `open-brain/tests/t283-suite-vitest-args.test.ts`.
7. `git push origin fix/t283-suite-json-path` (never force). `ls-remote` must equal `rev-parse HEAD`. Wait for CI on
   PR #698 (`gh pr checks 698 --watch --interval 30`, cap 20 min), and paste the `test` conclusion. P4 runs on Linux
   there too.

## Reply

- The first line is `READY T-283 <sha40> PR #698` or `BLOCKED T-283 <reason>`.
- Then each command with its output: the red run, the green run, tsc, the three mutants, the log, the name-only diff,
  `ls-remote` = `rev-parse`, and CI.
- Paste test output with `grep -a`, or without grep. Mark anything not run `NOT RUN`.
- At most 2 attempts at any step. Do not merge.
