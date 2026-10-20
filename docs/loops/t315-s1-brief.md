# T315-S1: the open-brain server exits on a new build, so Claude Code respawns it (T-315, D-161)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t315-s1-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-20, session 173. **Task:** T-315 (P1). **Decision:** D-161 (Aaron: "Open-brain
auto-reconnect: yes"). **Tag:** `T315-S1`. **Size:** SMALL (1 src file, 2 edits; 1 new src file; 1 new test file).
**Base:** the dispatch SHA Atlas names (a master that contains this brief). **Checklist:**
`~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: describeServingBuild readStampedCommit (server.ts startup: watchBuild + attachBuildWatch; serving-build.ts read only)
```

## Why

A stdio MCP server keeps the modules it loaded for its whole life. After every `sia-rebuild`, each seat served the old
code until a human ran `/mcp reconnect open-brain`. On 10-19 that happened 3 times. In the worst case, the planner's
sparse tree ran the pre-fix citation scan until Aaron reconnected.

Step 0 (`docs/loops/t315-step0/README.md`):
- **Reloading in place is blocked.** ESM never re-evaluates a module graph, and the open DB handle and the native
  addon cannot be swapped inside one process.
- **The host respawns the server.** Probe 1 showed that Claude Code 2.1.296 respawns a stdio server that exits, about
  1.1 s later and before the next call. Probe 2 showed that it honours `tools/list_changed`.

**Fix:** a new core file, `src/shared/build-watch.ts`.
- **When the server exits:** it reports a new build only when this process loaded a stamped build, a different valid
  40-hex stamp is on disk, and no host request is in flight. `server.ts` then exits, and Claude Code respawns it from
  the new build.
- **When it checks:** after each response, and every 15 s while idle (an unref'd timer).
- **A rebuild in progress is not a new build.** `postbuild` writes the stamp last, so a missing or unstamped
  `build-info.json` doesn't count; a failed rebuild restores the old stamp.
- **Only for Claude Code:** the exit happens only when the client's name matches `/claude/i`. Cursor and other clients
  keep today's behaviour, and the briefing's Build line still says `STALE PROCESS` for them.
- **A restart loses nothing.** There is no in-memory session registration since T-003, and the DB opens lazily.

## The change, exactly

All files are under `docs/loops/t315-s1/`.

- **`edits.txt`:** 2 exact-once replacements in `open-brain/src/server.ts`.
  1. The import of `describeServingBuild` also brings in `runningBuildDir` and `LOADED_COMMIT`, and imports
     `watchBuild` and `attachBuildWatch`.
  2. The `isDirectRun` block wires the watch after `connect`. The `onNewBuild` handler checks the client name, writes
     one stderr line, and calls `process.exit(0)` after 200 ms.
- **`build-watch.ts`:** copied verbatim, as a new file, to `open-brain/src/shared/build-watch.ts`.
- **`t315-s1.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/shared/t315-s1.test.ts`.
  - R1: an in-flight request defers the report, which then fires once.
  - R2: an idle check reports at once.
  - R3: no stamp, an unstamped file, or the same stamp is not a new build.
  - R4: a process that loaded no stamp never reports.
  - R5: `attachBuildWatch` counts host requests until their responses are sent; notifications don't count.
  - R6: `server.ts` wires the watch and gates the exit on a Claude client.

## Measured before dispatch

QA PC SIM T315-S1 at `0aa3cbb8` (master `6d6a6528` plus these files) used these exact files. sha256 prefixes:

| File | sha256 prefix |
|---|---|
| edits | `391e15b84c2873f4` |
| build-watch.ts | `e4f9d7bc5a82cced` |
| test | `14f6252b01313fc9` |
| restamp.mjs | `86cf5b48bd9dd658` |
| m1 | `1e4ef26027ba40fe` |
| m2 | `84d65b8f0072a7b8` |
| m3 | `76e72da428e44e3f` |
| m4 | `1e229cabe025f92a` |

- **Baseline:** the new test file fails to load, because `build-watch.js` does not exist.
- **Apply:** `APPLIED 2 edits to 1 files`. Both tsc runs and the build exit 0.
- **The step 4 run:** `99 passed (99)` files and `1516 passed (1516)` tests, with t315-s1 at 6 passed and no Errors
  line.
- **The live test (LIVE=RESPAWNED):** the real `build/server.js` ran under a nested `claude -p`.
  - `ob_start` printed `Build fe953c8 …`.
  - `restamp.mjs` rewrote the stamp, then the run waited 25 s.
  - `ob_start` then printed `Build 0aa3cbb …`, with no `STALE PROCESS`.
- **Mutants:**

  | Mutant | What it does | Red rows |
  |---|---|---|
  | m1 | ignores in-flight requests | R1, R5 |
  | m2 | keeps reporting after the first | R1 |
  | m3 | treats a missing stamp as new | R3 |
  | m4 | drops the Claude gate | R6 |

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/server.test.ts` | stays green | It imports `server.ts`, so `isDirectRun` is false and no watch starts. Green in the SIM. |
| serving-build tests in `tests/pipelines/session-start` (T-254) | stay green | `serving-build.ts` is unchanged; it gains two importers only. Green in the SIM. |
| `tests/pipelines/sync/module-boundary.test.ts`, `t261-s1`, `t261-s2` | stay green | `build-watch.ts` is core (it imports only `serving-build.ts`); `server.ts` is memory and may import core. The count stays at 4 dynamic loads. Green in the SIM. |
| the rest of `tests/shared` and `tests/pipelines/sync` | stay green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED T315-S1 <test name>`. There are two exceptions, both
from T-292 load on the shared QA PC:
- T-292's `Timeout calling onTaskUpdate` error when every test passed: paste it and go on.
- **Ruled 10-20 after round 1.** That error together with ONE red existing test outside `t315-s1.test.ts`: re-run
  that test's file alone. If it is green alone, paste both runs and go on. If it is red alone, STOP.
  - Round 1 saw this twice, with a different test each time: `state-writer.test.ts` "reopen_gap refuses…" and
    `record-erasure.test.ts` "the v2 → v3 migration commit…". Each passed alone.
  - A red `t315-s1.test.ts` row is never an exception.

## Steps

1. **Shell.** In PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t315-s1-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`. Otherwise STOP.
2. **Clone and install.**
   - Make a fresh clone into `(Join-Path $env:TEMP "t315-s1-wt")`, unless the launcher named one.
   - Run `git checkout -q -b fix/t315-s1-build-watch <base>`. HEAD must equal the base, and the porcelain must be
     empty.
   - In `open-brain`, run `npm ci`, then the better-sqlite3 probe.
   - Forbidden: stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/open-brain/`, `~/.claude/commands/`, any real MCP config, and anything
     under `docs/`.
3. **Commit 1** (`T315-S1: rows for the build watch`). It holds the new test file only.
   - Run `Copy-Item docs/loops/t315-s1/t315-s1.test.ts open-brain/tests/shared/`.
   - Run `$env:NO_COLOR='1'`. Then, in `open-brain`, run
     `npx vitest run tests/shared/t315-s1.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect the file to fail to load (`Cannot find module '../../src/shared/build-watch.js'`). Paste the summary and
     that line.
4. **Commit 2** (`T315-S1: the open-brain server exits on a new build so Claude Code respawns it (T-315, D-161)`).
   - From the clone root, `node docs/loops/t315-s1/apply.cjs . docs/loops/t315-s1/edits.txt` must print exactly
     `APPLIED 2 edits to 1 files`.
   - Run `Copy-Item docs/loops/t315-s1/build-watch.ts open-brain/src/shared/`.
   - Run `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build` (exit 0).
   - Run `npx vitest run tests/shared tests/server.test.ts tests/pipelines/session-start tests/pipelines/sync --no-file-parallelism --testTimeout=180000`
     (25-minute cap). Expect 0 failed and about 1516 tests. Paste the `Test Files`, `Tests` and any `Errors` lines.
5. **Check the commits.**
   - Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <base>..HEAD` shows 2 lines.
   - The status is empty.
6. **Mutants.** Do this on the committed fix, for each of `m1.txt` … `m4.txt`:
   - Run `node docs/loops/t315-s1/apply.cjs . docs/loops/t315-s1/<mN>`. It prints `APPLIED 1 edits to 1 files`.
   - Run the new test file. Paste the summary and the `x` rows.
   - Restore with `git checkout -- open-brain/src`. The status must be empty.
   - Never commit a mutant.
   - Expected red rows: m1 R1, R5 · m2 R1 · m3 R3 · m4 R6.
7. **Check the diff.** `git diff --name-only <base>..HEAD` shows exactly:
   - `open-brain/src/server.ts`
   - `open-brain/src/shared/build-watch.ts`
   - `open-brain/tests/shared/t315-s1.test.ts`
8. **Push and open the PR.**
   - Push, never force. `git ls-remote origin refs/heads/fix/t315-s1-build-watch` must equal HEAD.
   - Run `gh pr create --base master --head fix/t315-s1-build-watch --title "T315-S1: the open-brain server exits on a new build so Claude Code respawns it (T-315)" --body "Brief: docs/loops/t315-s1-brief.md."`.
   - Then run `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T315-S1 <sha40> PR #<n>` or `BLOCKED T315-S1 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply.
- Every number is pasted output, with its command shown above it. Mark anything not run `NOT RUN`.
- Do not merge.

## After merge (not this run)

`sia-rebuild`. That rebuild is itself the live acceptance:
- Every running Claude Code seat's open-brain server exits within about 15 s, or after its next response, and is
  respawned from the new build with no `/mcp reconnect`.
- The next `ob_start` in an already-open session prints `Build <new> · current`, not `STALE PROCESS`.
- A registered session id still resolves, because the session proof is re-derived from the parent process.

If a seat's tools go dead instead, the fallback is `/mcp reconnect open-brain`, and the revert is this PR.
