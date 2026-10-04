# QA 279 report: session-161 batch g (prefix `s161g`), narrow re-runs of five PRs (Plumb, Linux)

**Seat:** QA, headless Claude Code on Opus, record session 161. Machine: Plumb (Linux). 2026-10-04.
Dispatch: `docs/loops/qa-279-s161g-dispatch.md`.

**Worktree:** `git -C ~/qa-scratch/qa279-wt log -1 --format=%H` = `972c60264a336f20ece99b7eb9c55f13e83f2ec5` (the
DISPATCH_SHA). `origin/master` = the DISPATCH_SHA at fetch time.

## Verdicts

| PR | Task | Pinned new head | Verdict | Deciding rows |
|---|---|---|---|---|
| #427 | T-235 P2-3 r4 | `9daf38d8cdb575f6c51f9b30d43f96126c7a8eb4` | **ACCEPT** | 1–5 pass. Finding F1 (Medium): the r4 forge regression test is vacuous. |
| #434 | T-240 r2 | `b9f8a5dfc2437b3d35049df691dd85483424e950` | **ACCEPT** | 1, 2, 6, 7, 8 pass. Finding F1 (Medium): the "dispatch room deleted" test does not delete the key, and the r1 fallback restored verbatim survives it. |
| #437 | T-235 P2-7 r2 | `3dfa24245cd1b3b99344cd2d675735bc608d04c8` | **REJECT** | **Row 10 fails:** the stale reclaim double-claims at 8 processes (QA lead: 14/100; seat runs: 2, 3, 1 per 100). 0/100 at 2 and 3 processes. |
| #444 | T-168 r3 | `9bfb2e1e78cc1701394988cc9c65288af4269582` | **ACCEPT** | 1, 2, 13–16 pass. Row 13 has one wording ruling (ppid that *is* the host is adopted). Finding F-A (Medium): the different-owner lease case is untested. |
| #445 | T-156 r2 | `43ed65a9f2e55b649b4bd1dbb46baddc84d3e0e6` | **REJECT** | **Row 17 fails:** CC-19 is still a raw unpaired source scan that the list claims is covered, and five repo-doc readers are missing from "Out of scope: reads docs". Row 18 passes. |

**Overall: REJECT.** ACCEPT needs all five PRs accepted; #437 and #445 are not.

**How rows were judged (the same rule for all five PRs).** A row passes or fails as the dispatch words it. A surviving
test mutant blocks only where the row asks for that test, as in #437 row 9 and #434 row 6 ("Rows exist for both").
Everywhere else it is a finding. Under this rule, #427 F1 and #434 F1 are findings and not rejections. They are the same
class: the PR's new regression test is named for the defect QA rejected, and it does not fail when that defect is put
back. **I recommend both be fixed before merge.** Each fix is a few lines. The planner may rule otherwise; QA 275
rejected #437 r1 for a race row that could not fail, but there the row itself asked about the test.

## Method and environment

- Node v22.22.1, Linux. `TMPDIR=~/qa-tmp` and `npm_config_cache=~/qa-tmp/npm-cache` were set for every npm, npx, tsc and
  vitest run, through `~/qa-tmp/qa279/run.mjs` and per-PR drivers.
- `npm ci` ran once in `qa279-wt/open-brain`. Every other tree has `node_modules` as a symlink to it, which shows as
  `?? open-brain/node_modules`. No head changes `package-lock.json`. #444 adds one `package.json` script line
  (`test:heavy`) and no dependency. `better-sqlite3` (with FTS5) and `esbuild` load.
- Trees:
  - `qa279-pr<N>`: each pinned new head.
  - `qa279-base<N>`: each **previous QA'd head** (r(n-1)), used for the red-first and control rows: 427 `a6d75b52`,
    434 `12f26320`, 437 `23d46156`, 444 `a5f11819`, 445 `d292747f`.
  - No scratch merge was needed (`qa279-merge` was not created).
- **Head drift: none.** `git fetch origin pull/<N>/head` gives exactly the pinned SHA for all five.
- **LIGHT:**
  - One vitest file per invocation.
  - `tsc --noEmit` and `npm run typecheck:tests` exit 0 on all five pristine heads.
  - Mutants only on touched files, or on the scanned source a #445 scan reads. Each mutant was checked with `tsc` and
    restored with `git checkout --`.
  - No full suite.
- **Subagents.** The PR-specific rows ran as five per-PR subagents, in parallel and in the foreground. **I re-ran the
  deciding evidence myself:**
  - #437 row 10: barrier race on a fresh head build.
  - #434 H2: the mutant, run again.
  - #445 row 17: CC-19 and the doc readers, read at head.
  - #444 row 13: `suite-owner.ts`, read in full.
  - #427 F1: the forge test, read.
- **Timeouts.** Three subagents each had one mutant batch run past the 600 s foreground limit, and the harness moved it
  to the background. Each waited for the batch to finish and checked its log before going on. The verdicts above come
  from completed runs. A **prior, aborted attempt** at this job had left probes and notes in `~/qa-tmp/qa279/`
  (09:25–10:07 local). Its scripts were reused as starting points only. Every number in this report comes from runs
  made in this session (`~/qa-tmp/qa279/v2/`).
- **Tree state at the end:** every `qa279-pr<N>` and `qa279-base<N>` shows only `?? open-brain/node_modules` in
  `git status --short`. Build output exists only where it is gitignored. The QA clone (`~/work/qa-242`) is clean and
  untouched.
- **Real profile, G-051** (presence and mtime only, no content read):
  - `~/.claude/settings.json`: present, mtime 2026-10-01 (before this job).
  - `~/.claude.json`: mtime 15:37Z, which is the job's launch time (10:37 local): written by the Claude Code launcher,
    not by QA.
  - Absent: `~/.claude/settings.local.json`, `~/.claude/open-brain/knowledge-v2.db`, `~/.cursor/hooks.json`,
    `~/.cursor/mcp.json` and `~/.claude/.mcp.json`.
- No live `.agents/state.json`, real DB, Jev call, hub call or real lease was used. `gh` was used read-only (`run
  list`, `run view`).
- **Builder model (G-055):** every new commit carries `Co-authored-by: Cursor <cursoragent@cursor.com>` and names no
  model. Per the dispatch, it is `grok-4.7-high`, as named by each seat from `store.db`. QA is Opus, so builder ≠ judge
  holds.

## Rows 1–2 (every PR)

### Row 1: Confined (`git diff <previous head> <new head>`)

Each new head is a descendant of its previous head.

| PR | Commits | Files (r(n-1) → r(n)) | Outside the task? |
|---|---|---|---|
| #427 | `9daf38d8` | `open-brain/src/shared/process-session.ts` (+9/−17 net), `open-brain/tests/t235-p2-3-cursor-proof.test.ts`; 2 files, +43/−34 | none |
| #434 | `b9f8a5df` | `.agents/SYSTEM/hub-partner-seats.json`, `.agents/roles/shared.md` (role file, merges on Aaron's word), `.cursor/rules/hub-room.mdc` and its `project-template` mirror, `session-start/{focus,hub-presence,seat-map}.ts`, `sync/hub-seats.ts`, `focus.test.ts`, `seat-map.test.ts`, `hub-seats.test.ts`; 11 files, +125/−35 | none |
| #437 | `bc1b8f38`, `d8f4c9dc` (docs, already noted by QA 275), `3dfa2424` | `docs/loops/t235-p2-7-plan.md`, `src/shared/session-hook-claim.ts`, `tests/cli-session-end-dedupe.test.ts`, `tests/shared/session-hook-claim.test.ts`; 4 files, +208/−32 | none |
| #444 | `9bfb2e1e` | `docs/loops/t168-suite-meta.md`, `scripts/write-ci-suite-meta.mjs`, `src/cli-suite-run.ts`, `src/suite-census.ts`, `src/suite-owner.ts` (new), `src/suite-run-meta.ts`, `tests/suite-run-meta.test.ts`; 7 files, +461/−40 | none |
| #445 | `43ed65a9` | `docs/loops/t156-scan-list.md`, `tests/harness/shadow-merge.test.ts`, `tests/pipelines/bootstrap-fix-r4.test.ts`, `tests/pipelines/sync/{probe-markers,worktree-layout}.test.ts`, `tests/t048-r2b.test.ts`; 6 files, +85/−10, tests and docs only | none |

**Row 1: PASS for all five.**

### Row 2: CI (read only: `gh run list --commit`, `gh run view --json headSha,conclusion,jobs`)

| PR | Run | headSha | event | `test` | `changed` | `test-windows` |
|---|---|---|---|---|---|---|
| #427 | 37201798190 | = pin `9daf38d8` | pull_request | **success** | success | skipped |
| #434 | 37200725330 | = pin `b9f8a5df` | pull_request | **success** | success | skipped |
| #437 | 37205512007 | = pin `3dfa2424` | pull_request | **success** | success | skipped |
| #444 | 37203089979 | = pin `9bfb2e1e` | pull_request | **success** | success | skipped |
| #445 | 37202540671 | = pin `43ed65a9` | pull_request | **success** | success | skipped |

**Row 2: PASS for all five.** `test-windows` was skipped on every head, so no head has Windows CI coverage.

## #427 r4 (rows 3–5): ACCEPT

- **Row 3: PASS.**
  - `OPEN_BRAIN_PROCESS_TABLE` has **0 hits in `open-brain/src`**. Its only hits are in
    `tests/t235-p2-3-cursor-proof.test.ts:269,286`.
  - `process.env` in `process-session.ts`: none.
  - `process.env` in `cli-bootstrap.ts`: `:91` HOME/USERPROFILE, and `:120` and `:149` CLAUDE_PID (Claude branch only).
  - `process.env` in `server.ts`: `:57` KNOWLEDGE_V2_DB, and `:109` OPEN_BRAIN_IDE (which only switches `cursorWalk`
    on).
  - None of those hits is a process table. No table is read from a file or a global.
  - No production caller passes `loadTable`: `cli-bootstrap.ts:127` is `resolveCursorAgentHost(process.ppid)`, and
    `server.ts:110` is `proveSession(…, {cursorWalk:true})`.
  - The walk loads the table only when `process.platform === "win32"`. The code now says "There is no environment
    override" (`process-session.ts:274`).
- **Row 4: PASS.** The forged `json:` table named a **live** `sleep 300` (a foreign pid) as the cursor-agent host above
  the hook's real ppid, with no real host present:

| Tree | Platform / PATH | Result |
|---|---|---|
| r4 | linux | `Session proof NOT written: no cursor-agent host process found …`, no proof file |
| r4 | win32 preload, honest fake powershell | the same, no proof file |
| r4 | win32 preload, no powershell | `NOT written: Win32 process table: spawnSync powershell.exe ENOENT`, no proof file |
| **r3 control** | linux | **`Session proof written … host process <sleep pid>`**, and `by-pid/<sleep pid>.json` exists: the forge works on r3, so the probe is valid |
| **r3 control** | win32 preload, honest fake powershell | forged proof written |
| r4 positive control | win32 and linux, under the real fixture host | proof written for the fixture host |

  The `sleep` was killed afterwards, and its absence was verified.
- **Row 5: PASS.**
  - `t235-p2-3-cursor-proof.test.ts` at head: **12/12**.
  - Spawn ENOENT, ETIMEDOUT, status 1, empty stdout, bad JSON and status-null are all injected through
    `loadWin32ProcessTable(run)` or `proveSession(…, {loadTable})`, not through env.
  - Mutants (all `tsc` exit 0; 90 s test timeout, because the two tsx spawn rows time out at 5 s under load):

| Mutant | Result |
|---|---|
| Remove the catch in `loadWin32ProcessTable` | **red** (3 failed / 12) |
| Revert the O1 fix (`status !== undefined`) | **red** (1 failed) |
| `proveSession` ignores `loadTable` | **red** (1 failed) |
| Remove the catch around the walk in `proveSession` | survives: defensive only, nothing in the walk throws now |
| Remove the catch around the walk in `cli-bootstrap` | survives: same reason |
| **Re-add the r3 env seam** | **survives (12/12)**: see F1 |

  - **QA 278 O1: fixed.** `status != null && status !== 0` (`process-session.ts:195`). On spawn failure the hook now
    prints `Win32 process table: spawnSync powershell.exe ENOENT`; r3 printed `exit null: spawnSync powershell.exe
    ENOENT`.
- **Findings:**
  - **F1, Medium (test adequacy).** The new test "r4 OPEN_BRAIN_PROCESS_TABLE json naming a foreign pid writes no proof"
    (`t235-p2-3-cursor-proof.test.ts:269-296`) is vacuous. It passes against r3 source, and it passes with the seam
    re-added. There are two reasons, both confirmed by reading the test:
    - Its forged pid `2147483001` is not alive, so no start time can be read.
    - The forged chain starts at the vitest `process.pid`, while the hook walks from its own `process.ppid`.

    The shipped fix is real (rows 3 and 4). Nothing in the suite would catch the seam coming back. Fix: use a live
    foreign pid and key the chain on the hook's real ppid, or assert statically that `process-session.ts` reads no
    `process.env`.
  - **F2, Low.** The two outer catches are unpinned (they are equivalent today).
  - **F3, Low.** r4 removed r3's hook-level "powershell cannot spawn" output test. Only QA's probe now covers the
    hook's failure line.

## #434 r2 (rows 6–8): ACCEPT

- **Row 6: PASS.**
  - Headline case, the real `describeHubPresence` → `seatOrder` → `seatsLine` → `renderBriefing` path, with
    `builder.runtime` deleted and the atlas reader. The SEATS line is now
    `SEATS: planner — claude-code sonnet desktop hub listener:absent · builder — runtime missing in seat map · forge — …`,
    and the partner line is `cursor-builder: runtime missing in seat map`.
  - On r1 the same case dropped the SEATS line and printed
    `cursor-builder: hub listener: not polling, 2 unread, no listener poll recorded`.
  - **Sweep:** 6 runtime configs × 3 waker hubs × 8 seatStates × 8 room shapes = 1152 combos. **Head: 0 waker-seat lines
    contain `not polling`**, and the missing runtime is shown on both SEATS and the partner line in every
    missing-runtime combo. **r1: 224** such lines, and SEATS was null in every missing-runtime combo.
  - The rows exist for both halves:
    - `focus.test.ts` "T-240 r2 another seat missing runtime > stays on the SEATS line and a waker seat never falls back
      to not polling";
    - `seat-map.test.ts` T-213 rows;
    - `hub-seats.test.ts` +2.
  - At head: focus 11/11, seat-map 22/22, hub-presence 41/41, hub-seats 8/8.
  - Red-first on r1 source: focus 1 failed, seat-map 3 failed, hub-seats 2 failed.
  - Mutants M1–M6 on `focus.ts`, `seat-map.ts` and `hub-presence.ts` (including r1's `return null` and r1's
    skip-the-row) are all killed by `focus.test.ts`.
- **Row 7: PASS on behaviour, with F1.**
  - `checkHubSeats` on copies of the head map:
    - `dispatch.cursor.room` key **deleted**, top-level `room` kept: **issue** (r1: pass).
    - `null`: issue (r1: pass).
    - `""`: issue.
    - Top-level `room` differing from `dispatch.cursor.room`: **issue** (r1: pass).
  - **The tracked map at head has no top-level `room` on any of its 6 seats.**
  - **No reader uses it:** every `room` match in `open-brain/src`, `scripts/`, `.cursor/`, `project-template/` and
    `.claude/` was judged. `hub-seats.ts:56` reads `row.room` only to flag a difference, and `SeatMapRow.room` is a
    type field that nothing reads.
  - Mutants on `hub-seats.ts`:
    - Fallback-by-condition, dropping the differing check, and the differing check comparing the top-level room with
      itself: all killed.
    - **H2, r1's fallback restored verbatim: survives**, hub-seats 8/8. **Re-run by the QA lead: `tsc` exit 0, 8 passed,
      tree restored.**
- **Row 8: PASS.** `shared.md:234-241`:
  - "Aaron stops the seat's waker … with `schtasks /End /TN "a2a-seat-waker-<seat>"`" (with a `waker.pid` fallback).
  - "Aaron starts the waker with `schtasks /Run /TN "a2a-seat-waker-<seat>"`".
  - Both match A2A-Hub `docs/installing-a-seat-waker.md` §5 and §3 (read-only clone at `73d1dae`, where the doc and
    `scripts/seat-waker.mjs` are tracked).
- **Findings:**
  - **F1, Medium (test adequacy, the same class as #427 F1).** The test named
    `dispatch room deleted, top-level kept is an issue` (`hub-seats.test.ts:114-133`) sets `room: ""` and **does not
    delete the key**. r1 already called `""` an issue, and on r1 that test was red only on its message wording. So
    QA 275's exact case (key absent, top-level present) is not pinned, and H2 survives. Fix: delete the key, or add
    key-absent and `null` cases.
  - **F2, minor, pre-existing.** A cursor seat whose top-level `hub_name` is missing, or differs from
    `dispatch.cursor.hub_name`, falls out of `runtimeByHubName`. The atlas reader then prints
    `cursor-builder: hub listener: not polling, 2 unread since 1m`, and /sync passes it, at both r1 and head. That is
    the same symptom by another route. This needs a follow-up task.
  - **F3, minor, pre-existing.** `seatOrder` still drops the whole SEATS line silently when another seat has no `host`
    or `model`. /sync does flag those.
  - **F4, nit.** A top-level `room` re-added equal to the dispatch room, or a non-string one, passes /sync.
  - **F5, nit.** `a2a-seat-waker-<seat>` should read `<hub_name>`: the waker's `--seat` is the hub identity, not the map
    key.
  - **F6, nit.** The presence upper bound renders `state:unknown(state:unknown(…))`.
  - `shared.md` still merges on Aaron's word.

## #437 r2 (rows 9–12): REJECT

- **Row 9: PASS.** The PR's barrier row ("fresh claims", 2 processes × 20 trials, on the built module):
  - pristine: **10/10 green**;
  - **M1** (read-then-write): **10/10 red**, with 1–7 doubles per 20 trials.
  - Weakness, F4: the children spin first and import after, so import jitter de-syncs them. One M1 run failed on a
    single double.
- **Row 10: FAIL.**
  - Reading the code: the reclaim is rename-to-tombstone (`claim.stale.<pid>`), then `wx`. `renameExclusive` returns
    "lost" on ENOENT/EEXIST, and also after 8 EPERM/EBUSY retries; `reclaimStale` then returns `duplicate`
    (`session-hook-claim.ts:48-99, 142-144`). That is the shape the dispatch asks for.
  - The barrier: each child imports the **built** head module first, then spins to a shared instant, then claims once.
    Each trial has a fresh HOME and a claim pre-created with an mtime 10 minutes old (the TTL is 120 s).

| Module | Procs | Trials | Double claims | Throws | Who |
|---|---|---|---|---|---|
| head | 2 | 100 | **0** | 0 | QA lead |
| head | 2 | 100 | 0 | 0 | seat |
| head | 3 | 100 | 0 | 0 | seat |
| **head** | **8** | 100 | **14** | 0 | **QA lead, fresh `tsc` build** |
| head | 8 | 100 | 2 / 3 / 1 (three runs) | 0 | seat |
| r1 control | 2 | 100 | 16 | 43 trials (ENOENT) | seat |
| r1 control | 8 | 100 | 60 | 53 trials (ENOENT) | seat |

  - The ENOENT crash is gone, and N=2 (the real Cursor + Claude dual hook) is clean. Zero double claims does **not**
    hold at N=8.
  - The cause was traced with an fs-instrumented copy of the module. There is a TOCTOU between the stat (L69) and the
    rename (L76): a late reclaimer that saw the old stale file renames **another process's fresh claim** aside. While
    the path is empty, a third process's `wx` succeeds. The put-back at L85 is a plain `renameSync`, which overwrites
    on POSIX, so the steal is hidden. Every trial ended with exactly one `.claim` file and no `.stale.*` file left
    over.
  - This contradicts the plan's "one process wins the rename".
- **Row 11: PASS.**
  - The Claude Code row now exists: `cli-session-end-dedupe.test.ts:31`, "Claude-shaped SessionEnd without
    cursor_version is never skipped".
  - M2 at the `cli-session-end.ts:58` call site, `… || true`: **red** (the CC row fails).
  - The inverse, never dedupe (`&& process.pid < 0`, because a literal `&& false` fails `tsc`): **red** (the cursor
    duplicate row fails).
- **Row 12: PASS on behaviour, with coverage gaps.**
  - Probe: 45 stale `.claim` + 5 stale `.stale.<pid>` files + 6 fresh or near-TTL files + a stale target path. Three
    calls deleted **32, 18, 0**: never more than 32, only stale files, and every fresh file survived. The target was
    reclaimed by the rename path, and the sweep never touched it (traced).
  - Mutants against the PR's tests:
    - TTL check removed: red.
    - `SWEEP_CAP` 32 → 1000: **survives**.
    - Skip-self removed: **survives**. With that mutant, the N=8 barrier gives 33/100 doubles.
- **Findings:**
  - **F1, blocking (row 10).** Stale reclaim double-claims with 8 concurrent claimers (not seen at 2 or 3; the trace needs at
    least 3). Restoring with an
    exclusive put-back does not fix it, because the steal is the bug. Possible fixes:
    - a per-path reclaim lock (`wx` on `<claim>.reclaim`, then re-stat under the lock);
    - comparing `ino`/`mtime` of the aside with what was stat'd before the rename, and putting it back if they
      differ.

    Add an N≥3 (for example 8) stale barrier row.
  - **F2, Low–Medium.** The cap and the skip-self guard are unpinned. Add a row with more than 32 stale files.
  - **F3, Low.** `sweepExpiredClaims` rethrows every error except ENOENT. A stale **directory** in `hook-claims/` makes
    the claim throw EISDIR (probed), which would crash bootstrap and session-end. The sweep should swallow errors per
    entry.
  - **F4, Low.** The PR's barrier imports after the spin; it should import first.
  - **F5, note.** QA 275 row 18 is not addressed: the after-counts still sit under "Live counts (QA PC)".

## #444 r3 (rows 13–16): ACCEPT

- **Row 13: PASS, with a wording ruling.**
  - The resolver `resolveOwnerFromAncestry(startPid, rows)` (`suite-owner.ts:47-66`) was driven directly and through the
    CLI with injected ancestry:
    - tsx → npm → `cmd /c` → cursor-agent: **cursor-agent**.
    - claude.exe only: **claude.exe**.
    - Both present: cursor-agent wins at any depth.
    - Wrapper only, a cycle, a missing parent, or past depth 64: **none**. The CLI exits 2, vitest does not run, and the
      meta has `owner_pid:null, owner_source:"none", owner_reason:"no cursor-agent host and no claude.exe session in
      the ancestor chain"`.
  - **The production binding** (no ancestry, no `--owner-pid`) is `unboundOwnerProbe()`. It refuses with "no
    cursor-agent host resolver until #427 merges", and `process.ppid` is never returned. Without a flag, every
    `test:heavy` run refuses until #427 is wired; that is by design.
  - The walk starts at `process.ppid` (`cli-suite-run.ts:149`, under `SUITE_ANCESTRY`). A wrapper at ppid is never
    adopted: mutants that adopt it (M1, M1b, M2a) are all red.
  - **Ruling.** The walk includes its start, so if ppid's **own** command line is a cursor-agent host or `claude.exe`,
    ppid is the owner (`suite-owner.ts:43-45, 57-60`). Read literally, "never adopts it" differs in that one case. I
    rule it PASS, for three reasons:
    - D-119 makes the host the owner, so refusing the host would break D-119.
    - The defect QA 277 rejected was adopting ppid *because it is the parent*. That cannot happen.
    - The case cannot arise under `npm run test:heavy`, where ppid was observed to be `node …/.bin/tsx`.

    #427's walk is inclusive in the same way. The planner should reword the row as "ppid is never adopted as a wrapper
    or by default".
- **Row 14: PASS.** A fake `powershell.exe` with `process.platform` forced to win32, with calls logged:
  - Take exits **10, 11, 2** (and 1, 12): each gives CLI exit 2, vitest not run, and `lease_take_exit` recorded.
  - Missing helper: refuses. `SUITE_LEASE_OPT_OUT=1` runs (`=true` still refuses).
  - **Held by the same owner** (status 10, `pid=100`, owner 100): **status call only, no take, no release**, then it
    runs.
  - Held by another pid: status, then take, then refuses on 10.
  - The same-owner regex matches the real helper's status line (`machine-lease.ps1:81,121`).
- **Row 15: PASS.** Metas from the success, refusal and same-owner paths each carry `owner_pid`, `owner_source`,
  `lease_take_exit` and `lease_release_exit`. Success example: `owner_pid:100, owner_source:"flag", lease_take_exit:0,
  lease_release_exit:0`.
- **Row 16: duplicates, does not call.**
  - `suite-owner.ts:28-36` `isCursorAgentHostCommandLine` is **byte-identical** to #427 r4
    `process-session.ts:140-148`. It is a copy, and `suite-owner.ts` imports nothing. Master has no such export yet.
  - The walk is parallel to #427's, but adds a `claude.exe` fallback, which **must be kept** when rebasing onto
    `findCursorAgentHostPid`.
  - The interface is the injected-ancestry walk plus the unbound production binding.
- **Tests and mutants.**
  - `suite-run-meta.test.ts` at head: **21/21** with `--testTimeout=60000`. Under vitest's 5 s default, 16/21: the 5
    CLI-spawning rows time out because tsx starts cold in about 7 s on this box (F-D).
  - Head tests against r2 code (with head's `suite-owner.ts` added so they load): **6 red**. The new tests catch
    QA 277's F1 and F2.
  - Killed: M1, M1b, M2a, M2b, M2c, M3a, M3c, M4, M4b, M5b, M9.
  - Survived: M3b and QA 277's M11 (both equivalent), **M5** (a lease held by *any* pid counts as the owner's), M6
    (claude.exe preferred over cursor-agent), M7 (release exit not recorded), M8 (the real win32 missing-helper check),
    and QA 277's M2 and M5 (census code, carried over).
- **Findings:**
  - **F-A, Medium (test).** Under M5, a lease held by pid 200 runs the suite with exit 0 and no take, and all 21 tests
    stay green. Head behaves correctly (probed). Add a different-owner status row.
  - **F-B, Low.** M6, M7 and M8 are untested.
  - **F-C, Low (hardening, the same class as #427 O2).** Test env seams are honoured in production:
    - `SUITE_LEASE_EXIT=0` skips the real lease on win32;
    - a forged `SUITE_LEASE_STATUS_EXIT/OUT` runs as held-by-owner;
    - `SUITE_ANCESTRY` can name any pid as the host.

    #427 r4 removed exactly this kind of override.
  - **F-D, Low.** The CLI-spawning tests set no per-test timeout.
  - **F3 (QA 277), still open.** `vitest.errors` is always 0 from real vitest output.
  - **Info.**
    - Linux `claude` (no `.exe`) is not recognised.
    - `--owner-pid 0x10` is accepted.
    - Malformed `SUITE_ANCESTRY` exits 1 with no meta.
    - The Census bullet appears twice in `t168-suite-meta.md`.

## #445 r2 (rows 17–18): REJECT

- **Row 17: FAIL.**
  - All five QA 277 entries are now listed. The `checks.test.ts:141-160` and `s4-g2-key.test.ts:236-241` ranges match
    exactly. `shadow-merge 314-339` ends partway through CC-0 (which runs 326–354). `bootstrap-fix-r4 137-143` cites
    the predicate, and the real `git grep` is at 150–154.
  - **Code scan still missing, and wrongly claimed as covered.** The list says `shadow-merge.test.ts:314-339` covers
    "CC-0 and CC-19". CC-19 (`:356-366`) is unchanged. It still holds the raw
    `expect(runtime).not.toContain("prepareShadowVerdict")` (`:361`), plus raw `toContain` checks on `cli.ts`.
    **Confirmed by the QA lead at head.**
  - The seat's mutant SRC-SM-C (a `//` comment naming `prepareShadowVerdict` in `runtime.ts`) passes CC-0, which
    honours the near-miss, and **turns CC-19 red**. That is the G-040 shape.
  - **Repo-doc readers missing from "Out of scope: reads docs":**
    - `pipelines/sync/hub-talk-exit-codes.test.ts:10-40` (`start.md` and both `hub-room.mdc` files; confirmed by the QA
      lead);
    - `pipelines/bootstrap-fix.test.ts:278-281` (`bootstrap.md`);
    - `pipelines/bootstrap-fix-r3.test.ts:343-347`;
    - `pipelines/bootstrap-fix-r4.test.ts:93-98` (confirmed by the QA lead; a file r2 edited);
    - `harness/shadow-merge.test.ts:360` (`PROCEDURE.md`; a file r2 edited).

    Borderline: `harness/s4-g4-reconstruct.test.ts:124-131` (record text) and `pipelines/template-seed.test.ts:21-44`
    (gitignore text).
  - Lower-severity omissions:
    - the `s4-guards` diff scans at 202–241 (paired at 84–192 but not listed);
    - `s4-g5-qa` Q5 at 134–139 (a presence check);
    - `t048-r2b` D4 residue at 212–216 (raw checks).
- **Row 18: PASS as specified.**
  - **16/16** widen and narrow mutants on the newly paired predicates are red: `codeHas` ×3, `skipCall` ×2,
    `badReturn` ×3, `namesHook` ×2 plus a widened real `git grep`, and the `probe-markers` and `worktree-layout`
    `wired` guards ×2 each.
  - **QA 277 F3 is closed.** A one-line `/* checks.push(checkProbeMarkers(...)); */` in the scanned `src` file is **red**
    in `probe-markers`, and the same comment for `checkWorktreeLayout` is **red** in `worktree-layout`. All mutants
    were `tsc` exit 0 and restored.
- **Findings:**
  - **F1, Medium-High (row 17).** CC-19 is unpaired, and the list says it is covered.
  - **F2, Medium (row 17).** Five doc readers are unlisted.
  - **F3, Medium (row 18 side finding).** The R-BF-21 pair does not control the real scan. `git grep` output lines all
    start `path:line:`, and the test asserts `status === 1` and `stdout === ""` before `namesHook` runs. So the claimed
    `//` near-miss in a real `src` file goes **red** (a false red, failing closed), and a narrowed (typo'd) needle in
    the real `git grep` **survives**.
  - **F4, Low.** The cited ranges have drifted from the scans.
  - **Note.** QA 277's M9 (call vs import in `t048-r2b`) is still not red. That was not required.
  - **Info.** A multi-line `/* … */` around a wiring line is invisible to every line filter.

## Findings summary

1. **#437, blocking (row 10).** Stale reclaim gives two claims at 8 concurrent processes (14/100 in the lead's run).
   The cause is the stat→rename TOCTOU plus a non-exclusive put-back. N=2 is clean.
2. **#445, blocking (row 17).** CC-19 is a raw source scan that the list claims is paired. Five repo-doc readers are
   not under "Out of scope: reads docs".
3. **#427 F1 and #434 F1, Medium, recommended before merge.** Each PR's regression test for the rejected defect does
   not fail when that defect is restored: #427 with the env seam re-added, #434 with r1's room fallback (H2).
4. **#444 F-A, Medium.** The different-owner lease case is untested: M5 survives.
5. **#437 F3, Low.** The sweep throws on a non-file entry in `hook-claims/`.
6. **#445 F3, Medium.** The R-BF-21 planted pair is decorative against the real `git grep`.
7. **#444 F-C and #427 O2, Low.** Env test seams in production code. #427 removed its own; #444 keeps `SUITE_*`.
8. **#434 F2, pre-existing.** `hub_name` vs `dispatch.cursor.hub_name` drift still yields "not polling" on a cursor
   seat. This needs a follow-up task.

Per-PR working notes, with full tables and drivers: `~/qa-tmp/qa279/v2/{427,434,437,444,445}.md` and `p<N>/` (Plumb,
not committed).

QA-279: REPORT COMPLETE
