# T348: the first state write of a session repeats the READS OWED list once (T-348)

Runtime: CC (claude -p, Opus)
SEAT: job runner (Lenovo or QA PC), NOT the desktop. No hub key. Code. Ends at READY with a PR, or HANDBACK; no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-17, session 178. **Tasks:** T-348. **Tag:** `t348`. **Size:** SMALL (three source
files, one new test file). **Base:** the START sha the launcher names (a master that contains this brief; drafted
against `e7405958976623fd11def9a48fffa622f6cdd5d0`).
**Authority:** the backlog (D-145); merge on Atlas's QA ACCEPT, sent to clark. No auth, deps, workflows or hooks.

```text
IMPACT-TARGETS: describeReadsOwed (session-start/reads-owed.ts), renderStartReport (session-start/start-report.ts), handleState (server.ts)
```

## What changes

`docs/loops/t348/edits.txt`, 10 edits in 3 files, plus one new test file copied in. No hook registration, no settings,
no new dependency.

The problem: `ob_start` prints `READS OWED (N): <paths>` and nothing later asks whether the files were opened. On
2026-11-17 two of six planner sessions greeted with owed briefs unread and did not say so.

**What this builds is a reminder, not a check.** Nothing in SIA records that a file was opened: the role-reads store
(`.agents/role-reads.local.json`) records what `ob_start` itself printed in full, for role docs only, and the
PostToolUse recall trigger is registered for `Bash|PowerShell` and `Edit|Write`, so it never sees a Read. So the line is
printed once per session whether or not the files were read, and asks the seat to confirm.

- **`session-start/reads-owed.ts` `describeReadsOwed`:** a new optional last parameter `collect?: string[]`. When given,
  every owed path is pushed onto it (all of them, not only the six the line shows). The returned line is unchanged.
- **`session-start/reads-owed.ts`, new `recordReadsOwed(projectRoot, sessionId, paths)`:** writes
  `{session, paths, reminded: false}` to `.reads-owed.json` in the per-project end-record directory
  (`endRecordProjectDir`, outside the repo, where the other once-shown markers live). One record per checkout: the last
  started session's. A session already reminded keeps its record, so a second `/start` does not arm it again.
- **`session-start/reads-owed.ts`, new `readsOwedReminder(projectRoot, sessionId, dryRun)`:** returns
  `READS OWED at start (N), confirm each was read: a, b, c` (six paths at most, then `, +K more`) and sets
  `reminded: true`; or null when the session is not proven, the run is a dry run, the record is another session's or
  absent, it was already reminded, or the list is empty. Every failure is silent and means no line.
- **`session-start/start-report.ts` `renderStartReport`:** passes a `collect` array to `describeReadsOwed` and, after
  the briefing, calls `recordReadsOwed` when the session is proven and the start is not read-only (T-314).
- **`server.ts` `handleState`:** after the `Rendered` line of a successful result, appends the reminder when there is
  one. It never refuses or changes the write. A refused write returns before this point.

## Existing tests that pin this behaviour (planner read; not simulated)

| file / row | verdict |
|---|---|
| `tests/pipelines/session-start/g062-reads-owed.test.ts` O1, O2, O5 (`describeReadsOwed` with 5 or 6 arguments; the line text) | stay green: the new parameter is optional and the line is unchanged |
| `tests/pipelines/session-start/briefing-fix.test.ts` BF-R rows, BF-F8 | stay green, same reason |
| `tests/pipelines/t329-fresh-start.test.ts` F5 | stays green, same reason |
| `tests/pipelines/session-start/briefing.test.ts` (:478, :598 call `describeReadsOwed` with 5 arguments) | stays green |
| `tests/server.test.ts` ob_state rows (:322, :329, :370, :393, :421, :603; all `toContain`) | stay green: where a session is proven, `handleState` runs before any `handleStart`, or the record is another uuid's; an added last line does not break `toContain` |
| `tests/pipelines/fleet-ae-f4.test.ts` (handleStart between handleState calls, `isError` and `toContain` only; no proven session, so nothing is recorded) | stays green |
| `tests/t314-start-read-only.test.ts` (a read-only start writes nothing) | stays green: a read-only start does not record, and the record is outside the project |
| `tests/t258-notice-races.test.ts` :84 (lists the end-record directory, filtered to `.claim-` names) | stays green |
| `tests/pipelines/sync/retirements-live.test.ts` (`server.ts` has pinned line hashes; this brief adds lines and changes none) | stays green |
| `tests/pipelines/sync/module-boundary.test.ts` (`reads-owed.ts` is core side; it now imports `shared/end-record-store.js`, which `shared/handoff-guard.js`, already imported there, imports too) | stays green |

New rows, all in the new file `open-brain/tests/pipelines/session-start/t348-reads-owed-reminder.test.ts`: T348-1 (line
once, then none), T348-2 (no owed reads or no record: no line), T348-3 (dry run does not use it up), T348-4 (another
session, no session, second start, a new session, `+1 more`), T348-5 (`renderStartReport` records; read-only does not),
T348-6 (`handleState`: dry run, first write, second write).

## Steps

1. **Shell.** Windows host: PowerShell, `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `$env:NO_COLOR='1'`.
   Linux host: bash, `export NO_COLOR=1`, and use `cp` where a step says `Copy-Item` (backups under `/tmp`). Either way
   `node -v` must print `v22.*`. Say which host you are on.
2. **Branch.** In the clone at START: `git checkout -q -b build/t348`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci` (exit code), then `node -e "require('better-sqlite3')"`; on "Could not locate the
   bindings file" run `npm rebuild better-sqlite3` and say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes, any MCP config, `npm install`,
     any hook registration or `settings*.json`, `package.json`, `.github/`, and anything under `docs/`.
3. **Apply.** `node docs/loops/t348/apply.cjs . docs/loops/t348/edits.txt` must print exactly
   `APPLIED 10 edits to 3 files`. Then, from the clone root:
   `Copy-Item docs/loops/t348/t348-reads-owed-reminder.test.ts open-brain/tests/pipelines/session-start/t348-reads-owed-reminder.test.ts`.
   In `open-brain`: `npx tsc --noEmit` (exit 0), `npx tsc -p tsconfig.tests.json --noEmit` (exit 0), `npm run build`
   (exit 0).
4. **The ten files.** In `open-brain`:
   `npx vitest run tests/pipelines/session-start/t348-reads-owed-reminder.test.ts tests/pipelines/session-start/g062-reads-owed.test.ts tests/pipelines/session-start/briefing-fix.test.ts tests/pipelines/session-start/briefing.test.ts tests/pipelines/t329-fresh-start.test.ts tests/server.test.ts tests/t314-start-read-only.test.ts tests/pipelines/fleet-ae-f4.test.ts tests/pipelines/sync/retirements-live.test.ts tests/pipelines/sync/module-boundary.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed. Paste `Test Files` and `Tests`. A red row here: STOP, `BLOCKED t348 rows <rows>`, with each assertion
   message (expected vs received).
5. **Mutants**, each on the applied tree. Back up once from the clone root (Windows `$env:TEMP`, Linux `/tmp`):
   `open-brain/src/pipelines/session-start/reads-owed.ts` -> `t348-ro.bak`,
   `open-brain/src/pipelines/session-start/start-report.ts` -> `t348-sr.bak`, `open-brain/src/server.ts` -> `t348-sv.bak`.
   For each `docs/loops/t348/mN.txt` (m1-m5): apply (must print `APPLIED 1 edits to 1 files`), run
   `npx vitest run tests/pipelines/session-start/t348-reads-owed-reminder.test.ts --no-file-parallelism --testTimeout=180000`
   in `open-brain`, paste the failed rows, restore that file from its backup (never git checkout).
   Predicted red (NOT simulated):
   - m1 (the once-flag is never set, `reads-owed.ts`): T348-1, T348-4, T348-6.
   - m2 (the line is printed with zero owed, `reads-owed.ts`): T348-2.
   - m3 (a dry run uses the reminder up, `reads-owed.ts`): T348-3, T348-6.
   - m4 (`ob_start` records an empty list, `start-report.ts`): T348-5.
   - m5 (`handleState` ignores `dry_run`, `server.ts`): T348-6.

   **A mutant with NO red row is a STOP** (`BLOCKED t348 <m> survives`). Other differences from the prediction are not
   a STOP: paste the rows and go on; the planner rules. After the last restore, rerun step 4: 0 failed.
6. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap). Expect 0
   failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook timeout is rerun
   alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole `Unhandled Errors` section if any.
   A red `tests/harness/checks.test.ts` D4 is not a STOP: paste its last stderr line and go on; CI judges it. Any other
   red row: STOP, `BLOCKED t348 suite <rows>`, with each assertion message. (Most likely source if one appears: a test
   that proves a session, calls `handleStart` and then compares a whole `handleState` result, which now ends with the
   reminder line.)
7. **Sync.** From the clone root: `node open-brain/build/cli.js sync 2>&1 | grep -E "module-boundary|retirements"`
   (Windows: `Select-String -Pattern "module-boundary|retirements"`). Paste every line; both must be `[pass]`.
8. **Commit.** One commit, `T348: the first state write of a session repeats the READS OWED list once (T-348)`.
   - Stage exactly the 4 paths: `open-brain/src/pipelines/session-start/reads-owed.ts`,
     `open-brain/src/pipelines/session-start/start-report.ts`, `open-brain/src/server.ts`,
     `open-brain/tests/pipelines/session-start/t348-reads-owed-reminder.test.ts`.
   - The message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - No git identity on the host and `git config` writes forbidden: commit with GIT_AUTHOR_*/GIT_COMMITTER_* env vars
     (Forge, melvenac@gmail.com).
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows those 4 paths: the three source files `M`, the test file `A`.
9. **Push and open the PR**, only on a host that can push. A host that cannot push (the Lenovo, read-only token) stops
   after step 8 and replies `HANDBACK t348 <sha40>`; the planner lands the commit with `job.mjs land`. Do not try to push there.
   - Push, never force. `git ls-remote origin refs/heads/build/t348` must equal HEAD.
   - `gh pr create --base master --head build/t348 --title "T348: the first state write of a session repeats the READS OWED list once (T-348)" --body "Brief: docs/loops/t348-brief.md."`.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Reply

- **First line:** `READY t348 <sha40> PR #<n>`, `HANDBACK t348 <sha40>` (no-push host, steps 1-8 all passed) or
  `BLOCKED t348 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Name any HIGH, CRITICAL or UNKNOWN impact target and say which rows cover its
  callers. Do not merge.

## After merge (not this run)

`sia-rebuild.sh <mergesha>`, then Aaron reconnects open-brain (the reminder is printed by the MCP server process). Live
check, read-only until the last step: in a fresh planner session whose greeting prints `READS OWED (N)` with N > 0, the
first `ob_state` write's result ends with `READS OWED at start (N), confirm each was read: ...` and the second write's
does not. A session whose greeting prints `READS OWED: none` gets no line.
