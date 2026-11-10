# T336: no brief folder is not a missing latest_brief; the FLEET stamp is the file's, named once (T-336, T-337)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-09, session 177. **Tasks:** T-336, T-337. **Tag:** `t336`. **Size:** SMALL (two greeting
lines, three source files, test rows). **Base:** the START sha the launcher names (a master that contains this brief).
**Authority:** the backlog (D-145); merge on Atlas's QA ACCEPT, sent to clark. No auth, deps, workflows or hooks.

```text
IMPACT-TARGETS: describeNoBrief (latest-brief.ts), buildGreetingMetricsRow (greeting-metrics.ts), verifiedStale and describeFleet's budget/legacy lines (fleet.ts)
```

## What changes

`docs/loops/t336/edits.txt`, 15 edits in 6 files. No new file.

- **T-336, `latest-brief.ts` `describeNoBrief`:** when the brief folder does not exist (no `docs/loops/` and no
  `docs/loop-*-brief.md`, or a `greeting.json` `brief_dir` that does not exist) the line reads
  `Latest brief: none (no brief folder: ...)`. A folder that exists with no brief keeps `none (looked in ...)`.
- **T-336, `greeting-metrics.ts`:** `missing_pointers` counts `latest_brief` only on `Latest brief: none (looked in `.
  Fleet has no brief folder, so every Clark start was scored missing forever.
- **T-337, `fleet.ts`:** `verifiedStale` returns a boolean. The FLEET budget line ends
  `<dot> seats maker <dot> fleet.json verified <stamp>` plus `, STALE` when over 24 h, instead of
  `seats maker (verified <stamp>) <dot> STALE (verified <stamp>)`, which read as maker's status with STALE as a seat
  (Maker S75). The legacy header keeps `## Fleet (fleet.json, verified <stamp>)` and appends ` <dot> STALE` without the
  repeated stamp. (`<dot>` stands for the middle-dot separator U+00B7 the code prints; edits.txt has the real character.)

## Existing tests that pin this behaviour (planner read; not simulated)

| file / row | verdict |
|---|---|
| t298-greeting-truth G6 (bare repo) | edited in commit: now the no-folder line |
| t298-greeting-truth G8 (fixture REPORT, looked-in line) | stays green, still `latest_brief` missing |
| t298-greeting-truth G12 (handleStart, repo with no docs/) | edited in commit: the no-folder line |
| latest-brief.test.ts:181 (docs/loops/ holds a non-brief) | stays green, looked-in line |
| briefing.test.ts:476, :597 (latestBrief passed as a string) | stays green |
| briefing-fix BF-F1 (budget, not stale) | edited in commit |
| briefing-fix BF-F3 (stale) | edited in commit: STALE once, after the file's stamp |
| t252-briefing-followups :45, :47, :71, :108 | edited in commit; :111 legacy header unchanged, green |

New rows: T336-1 (metrics, in G8-G11's describe) and T336-2 (latest-brief, after G6), both in
`t298-greeting-truth.test.ts`.

## Steps

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b build/t336`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci` (exit code), then `node -e "require('better-sqlite3')"`; on "Could not locate the
   bindings file" run `npm rebuild better-sqlite3` and say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes, any MCP config, `npm install`,
     and anything under `docs/`.
3. **Apply.** `node docs/loops/t336/apply.cjs . docs/loops/t336/edits.txt` must print exactly
   `APPLIED 15 edits to 6 files`. In `open-brain`: `npx tsc --noEmit` (exit 0),
   `npx tsc -p tsconfig.tests.json --noEmit` (exit 0), `npm run build` (exit 0).
4. **The five files.** In `open-brain`:
   `npx vitest run tests/pipelines/session-start/t298-greeting-truth.test.ts tests/pipelines/session-start/briefing-fix.test.ts tests/pipelines/session-start/t252-briefing-followups.test.ts tests/pipelines/session-start/latest-brief.test.ts tests/pipelines/session-start/briefing.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed. Paste `Test Files` and `Tests`. A red row here: STOP, `BLOCKED t336 rows <rows>`, with each assertion
   message (expected vs received).
5. **Mutants**, each on the applied tree. Back up once from the clone root:
   `Copy-Item open-brain/src/pipelines/session-start/latest-brief.ts "$env:TEMP\t336-lb.bak" -Force`,
   `Copy-Item open-brain/src/pipelines/session-start/greeting-metrics.ts "$env:TEMP\t336-gm.bak" -Force`,
   `Copy-Item open-brain/src/pipelines/session-start/fleet.ts "$env:TEMP\t336-fl.bak" -Force`.
   For each `docs/loops/t336/mN.txt`: apply (must print `APPLIED 1 edits to 1 files`), run step 4's command, paste the
   failed rows, restore that file with Copy-Item (never git checkout). Predicted red (NOT simulated):
   m1 T336-1; m2 G6 and G12; m3 T336-2; m4 BF-F1, BF-F3 and t252's four budget rows; m5 BF-F3.
   **A mutant with NO red row is a STOP** (`BLOCKED t336 <m> survives`). Other differences from the prediction are not
   a STOP: paste the rows and go on; the planner rules. After the last restore, rerun step 4: 0 failed.
6. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap). Expect 0
   failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook timeout is rerun
   alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole `Unhandled Errors` section if any.
   A red `tests/harness/checks.test.ts` D4 is not a STOP: paste its last stderr line and go on; CI judges it. Any other
   red row: STOP, `BLOCKED t336 suite <rows>`.
7. **Sync.** From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`.
   Paste every line; both must be `[pass]`.
8. **Commit.** One commit, `T336: no brief folder is not a missing latest_brief; FLEET stamp named once (T-336, T-337)`.
   - Stage exactly the 6 paths: `open-brain/src/pipelines/session-start/latest-brief.ts`,
     `open-brain/src/pipelines/session-start/greeting-metrics.ts`, `open-brain/src/pipelines/session-start/fleet.ts`,
     `open-brain/tests/pipelines/session-start/t298-greeting-truth.test.ts`,
     `open-brain/tests/pipelines/session-start/briefing-fix.test.ts`,
     `open-brain/tests/pipelines/session-start/t252-briefing-followups.test.ts`.
   - The message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows those 6 paths, all `M`.
9. **Push and open the PR.**
   - Push, never force. `git ls-remote origin refs/heads/build/t336` must equal HEAD.
   - `gh pr create --base master --head build/t336 --title "T336: no brief folder is not a missing latest_brief; FLEET stamp named once (T-336, T-337)" --body "Brief: docs/loops/t336-brief.md."`.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Reply

- **First line:** `READY t336 <sha40> PR #<n>` or `BLOCKED t336 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild.sh <mergesha>`. Live check, read-only: in `~/Worktrees` (Fleet, no brief folder), the CLI start line must
print `Latest brief: none (no brief folder: ...)`, and Clark's next greeting-metrics row must not list `latest_brief`.
In this planner tree the line is unchanged. Any greeting's FLEET line ends `<dot> fleet.json verified <stamp>` (`, STALE`
when over 24 h).
