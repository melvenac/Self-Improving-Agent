# T313: a seat-specific stored entry fires only for its own seat (T-313)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-313 (P3). **Tag:** `t313`. **Size:** SMALL (1 new src
file, 7 edits in 2 files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this
brief).

```text
IMPACT-TARGETS: runTrigger readAgentIdentity (new: entrySeat and resolveTriggerSeat in trigger/seat.ts)
```

## Why

The recall trigger injects a stored entry into any seat's session, so an entry that names one seat's ops script (entry
689: `bash $S/pr-status.sh`, atlas-ops) fired for clark about 30 times. Measured 10-24 on the live store (read-only):
78 of 864 live entries name a seat by a `<seat>-ops` tag or a `.claude/skills/<seat>-ops` path; replaying injected
fires by each session's registered project put about 60 of 194 seat-specific injections in another seat's session.
With this change, `runTrigger` skips an entry whose seat differs from the session's, on the element and the keyed
path, and records `seat-skip:<ids>` in the fire's query. The hook resolves the seat from its payload `cwd`
(AGENT.local.md / AGENT.md name), falling back to the project the session registered (`sessions.project_dir`: clark
runs in ~/Worktrees, which has no identity, and registers projects/fleet, which names Clark). An unresolved seat, or an
entry that names no seat, fires as before. No schema change.

## The change, exactly

Files under `docs/loops/t313/`.
- **`seat.ts`:** copied verbatim, as a new file, to `open-brain/src/trigger/seat.ts`.
- **`t313-seat.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/trigger/t313-seat.test.ts`. S1-S6.
- **`edits.txt`:** 7 edits in 2 files: `open-brain/src/trigger/run.ts` (5: import, the `seat` input, the filter on the
  element path, the filter on the keyed path, `seat-skip` in the query) and `open-brain/src/cli-recall-trigger.ts`
  (2: import, resolve and pass the seat).

## Measured before dispatch

QA PC SIM `sim-t313` (job #82) at `2258b31c`: ALL PASS. No file under `open-brain/` changed between `2258b31c` and this
brief's base. sha256 prefixes: seat.ts `db3646e226e31668`, test file `1b938bcc0122ac91`, edits `9e5dd24b0ab11ea1`, m1
`c26eab09d5f6545b`, m2 `1152f9ca44704d83`, m3 `96ef9d4df8d63be1`, m4 `8ecc1d1d75260db7`, m5 `3537714b44ec6473`.
- Baseline (the new test file, no source): the five files `1 failed | 4 passed (5)` files, `5 failed | 59 passed (64)`
  tests; the red rows are S1, S2, S4, S5 and S6, all in t313-seat.test.ts (S1 and S5: `Cannot find module
  '../../src/trigger/seat.js'`). S3 green.
- Edits: `APPLIED 7 edits to 2 files`; both tsc runs and the build exit 0; `build/trigger/seat.js` exists; the five
  files `64 passed (64)`.
- Step 4's wide run: `189 passed (189)` files, `2245 passed (2245)` tests, no Errors line. `module-boundary [pass]`.
- m1 (the filter never skips) S2, S4; m2 (a hyphenated `-ops` tag names a seat) S1 only; m3 (no registered-project
  fallback) S5 only; m4 (no `seat-skip` in the query) S2, S4; m5 (the hook does not pass the seat) S6 only.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/trigger/t170-match-keys` (incl. R3's exact `<query> match:<id>`) | stays green | No fixture entry names a seat, so nothing is skipped and the query is unchanged. Green in the SIM. |
| `tests/trigger/hook.test.ts`, `t159-fast-path`, `no-network`, `fires`, `t286-status-required` | stay green | An unresolved seat or untagged entry fires as before; a missing `sessions` table resolves to null. Green in the SIM. |
| everything else in step 4's run | stays green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t313 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the five files below, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red row in the five files after step 4 is never an exception.

## Steps

"The five files" means, from `open-brain`:
`npx vitest run tests/trigger/t313-seat.test.ts tests/trigger/t170-match-keys.test.ts tests/trigger/t286-status-required.test.ts tests/trigger/fires.test.ts tests/trigger/hook.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t313-seat-filter`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`, then `npm run build` (the hook tests run the built hook). Run
   every `apply.cjs` from the CLONE ROOT. Forbidden: stash, reset --hard, force, rebase, amend, other checkouts,
   test:heavy, `vitest -u`, killing processes by name, the real `~/.claude/`, any MCP config, and anything under
   `docs/`.
3. **Commit 1** (`T313: rows for a seat-specific entry firing only for its own seat`).
   - `Copy-Item docs/loops/t313/t313-seat.test.ts open-brain/tests/trigger/t313-seat.test.ts`.
   - Run the five files. Expect `1 failed | 4 passed (5)` files and `5 failed | 59 passed (64)` tests, the red rows S1,
     S2, S4, S5 and S6 in t313-seat.test.ts. Paste the summary and each `x` row.
4. **Commit 2** (`T313: the recall trigger skips an entry written for another seat (T-313)`).
   - `Copy-Item docs/loops/t313/seat.ts open-brain/src/trigger/seat.ts`.
   - `node docs/loops/t313/apply.cjs . docs/loops/t313/edits.txt` prints exactly `APPLIED 7 edits to 2 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0); `Test-Path build/trigger/seat.js` is True.
   - Run the five files: `64 passed (64)`.
   - `npx vitest run tests/trigger tests/shared tests/pipelines tests/setup-hooks.test.ts tests/t235-p2-5-cursor-recall.test.ts tests/audit-fix-a1-r5.test.ts tests/audit-fix-a1-r7-scrub.test.ts tests/audit-fix-a1-r9-scrub.test.ts tests/t243-audit-lows.test.ts tests/t247-pins-scrub.test.ts tests/t294-small-fixes.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground with a tool timeout of at least 40 minutes, never the 10-minute
     default). Expect 0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`).
     Paste it.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m5: `node docs/loops/t313/apply.cjs . docs/loops/t313/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the five files; paste the `Tests` line and the `x` rows (expected: m1 -> S2,
   S4; m2 -> S1 only; m3 -> S5 only; m4 -> S2, S4; m5 -> S6 only); restore with `git checkout -- open-brain/src` (this
   returns to commit 2) and check the status is empty. After m5, run the five files once more: `64 passed (64)`.
   Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 4 paths:
   `M open-brain/src/cli-recall-trigger.ts`, `M open-brain/src/trigger/run.ts`, `A open-brain/src/trigger/seat.ts`,
   `A open-brain/tests/trigger/t313-seat.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t313-seat-filter` must equal HEAD.
   `gh pr create --base master --head feat/t313-seat-filter --title "T313: the recall trigger skips an entry written for another seat (T-313)" --body "Brief: docs/loops/t313-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t313 <sha40> PR #<n>` or `BLOCKED t313 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild` (the hook is a fresh process per call, so the next Bash call uses it). Live check: `trigger_fires` rows
with `seat-skip:` in `query` appear in sessions whose seat differs from the skipped entry's seat, and none appear in
its own seat's sessions.
