# T-298 step 3: a usage level of OFF prints one short true line

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t298s3-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-17, session 173. **Task:** T-298 (P1) item (4). **Tag:** `T-298-S3`. **Size:** SMALL
(one src file, two verbatim edits). **Base:** the dispatch SHA clark names (a master that contains this brief).
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: describeUsage (briefing.ts; USAGE_CONSEQUENCES gains OFF)
```

## Why

- **What happened.** Aaron lifted usage restrictions on 10-11. Clark then removed `usageLevel` from `slots.json`
  (`usageLevelRemoved`, 10-16).
- **The effect.** Every seat's greeting now prints `Usage: not checked (C:/Users/melve/slots.json has no usageLevel
  string or usageLevel.level string)`. That line is true but useless (scorecard row 5), and it feeds the
  `usage_not_checked` alarm streak in every metrics row.
- **The fix.** A level of `OFF` states the real condition in one short line: `Usage: OFF → no usage gate (restrictions
  lifted)`.
- **After this ships,** clark decides whether to set `"usageLevel": "OFF"` in `slots.json`.
- **Item (5) is NOT changed.** Item (5) is NEXT listing an objective-named task that is done. The SIM showed that
  `briefing-budget.test.ts:187` pins T-236's ruling ("a done task is marked done, not dressed as work to start"). An
  objective can name a done task on purpose ("Verify T-x"), and `[done]` already says so.

## The change, exactly

All files are under `docs/loops/t298-s3/`.

- `edits.txt`: 2 exact-once replacements in `open-brain/src/pipelines/session-start/briefing.ts`:
  - `USAGE_CONSEQUENCES` gains `OFF: "no usage gate (restrictions lifted)"`;
  - `describeUsage` returns `Usage: OFF → ${consequence}` right after the consequence lookup. That means no weekly or
    stale suffix for OFF.
- `t298-s3.test.ts` → `open-brain/tests/pipelines/session-start/` (new, verbatim).

## Measured before dispatch (QA PC SIMs by clark at f3c2b6b3; master since then adds only record commits)

- **SIM T298S3** included the NEXT change: 1 red existing row (`briefing-budget.test.ts:187`), so the NEXT change was
  dropped.
- **SIM T298S3-2** (these exact files: edits `fa6c71bb826e72bc…`, test `a0399a5dba7f22bc…`):
  - the new file on the unpatched base: U1 red, U2 green;
  - after apply: both tsc runs exit 0, and `tests/pipelines/session-start tests/server.test.ts` passes 668/668
    (44 files);
  - mutant m1: U1 red.

## Existing tests (verdicts)

No existing row changes, including `briefing.test.ts`'s PURPLE row (which uses a prefix match). Any red existing row:
STOP, `BLOCKED T-298-S3 <test name>`.

## Steps

1. **Set up the shell.** In PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t298s3-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`; otherwise STOP.
2. **Clone and install.**
   - Make a fresh clone into `(Join-Path $env:TEMP "t298s3-wt")`, unless the launcher named one.
   - `git checkout -q -b fix/t298-s3-usage-off <base>`. HEAD must equal the base and the porcelain must be empty.
   - In `open-brain`: `npm ci`, then the better-sqlite3 probe.
   - Forbidden, as in the earlier T-298 briefs: stash, reset --hard, force, rebase, amend, other checkouts,
     test:heavy, kills by name, the real `~/.claude/open-brain/`, any `greeting.json`, and anything under `docs/`.
3. **Commit 1** (`T-298-S3: rows for a usage level of OFF`), the test file only:
   - `Copy-Item docs/loops/t298-s3/t298-s3.test.ts open-brain/tests/pipelines/session-start/`.
   - Run `$env:NO_COLOR='1'`, then `npx vitest run tests/pipelines/session-start/t298-s3.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect U1 red and U2 green. Paste the summary and the `x` rows.
4. **Commit 2** (`T-298-S3: a usage level of OFF prints one short true line`):
   - `node docs/loops/t298-s3/apply.cjs . docs/loops/t298-s3/edits.txt` must print exactly
     `APPLIED 2 edits to 1 files`.
   - Run both tsc commands (exit 0) and `npm run build` (exit 0).
   - Run `npx vitest run tests/pipelines/session-start tests/server.test.ts --no-file-parallelism --testTimeout=180000`
     and expect `668 passed`. Paste the `Test Files` and `Tests` lines.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   `git log --oneline <base>..HEAD` shows 2 lines, and status is empty.
6. **Mutant.**
   - Run `node docs/loops/t298-s3/apply.cjs . docs/loops/t298-s3/m1.txt`, then the new test file. Expect U1 red.
   - Restore with `git checkout -- open-brain/src/pipelines/session-start/briefing.ts`. Status must be empty.
   - Never commit it.
7. **Check the diff.** `git diff --name-only <base>..HEAD` shows exactly:
   - `open-brain/src/pipelines/session-start/briefing.ts`
   - `open-brain/tests/pipelines/session-start/t298-s3.test.ts`
8. **Push and open the PR.**
   - Push (never force). `git ls-remote origin refs/heads/fix/t298-s3-usage-off` must equal HEAD.
   - Then run `gh pr create --base master --head fix/t298-s3-usage-off --title "T-298-S3: a usage level of OFF prints one short true line" --body "Brief: docs/loops/t298-s3-usage-off-brief.md."`.
   - Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

First line: `READY T-298-S3 <sha40> PR #<n>` or `BLOCKED T-298-S3 <reason>`. At most 2 attempts at any step. A STOP
still writes the reply. Every number is pasted output, with its command above it. Do not merge.
