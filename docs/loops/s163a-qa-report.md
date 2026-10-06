# QA 284 report: session-163 batch a (prefix `s163a`), #437 r5 (T-235 P2-7) and #472 r3 (HUBROOM-GUARD) (Plumb, Linux)

**Seat:** QA, headless Claude Code on Opus, record session 163. Machine: Plumb (Linux, 6 CPUs, Node v22.22.1). 2026-10-06.
Dispatch: `docs/loops/qa-284-s163a-dispatch.md`.

**Worktree:** `git -C ~/qa-scratch/qa284-wt log -1 --format=%H` = `5b0116dcb92d4d7241df1e1eb57bd1f9bc47cb24` (the
DISPATCH_SHA; `origin/master` at fetch was the same commit).

## Verdicts

| PR | Task | Pinned head | Verdict | Deciding rows |
|---|---|---|---|---|
| #437 | T-235 P2-7 r5 | `ba09e2c6e43de8ee100d3d05b7ddb8d35a7e9ca7` | **REJECT** | **New liveness regression from D2 (F1).** A resumed session's hook that runs at the same instant as **another session's** hook gets **zero claims in 83/100** trials (N=2; r4: 5/100, r3: 2/100), and 11/100 with the real dual hook plus 6 other sessions. Every hook for that session returns `duplicate`, so its SessionStart bootstrap or SessionEnd capture never runs. **Row 4: D1 is not closed one level up (F2).** The stale `.breaker` is still broken by stat → re-stat → unlink with no lock. A planted interleaving in that window gives two reclaim-lock holders and **two claims**. Row 3 passes (0/400), and rows 8 and 9 pass. |
| #472 | HUBROOM-GUARD r3 | `26edb821cac073172ad8788ac99128fa3fad4bde` | **REJECT** (narrow) | **Row 13(b) fails for the cross-sentence check (K1).** With that check deleted from the source, all 16 tests stay green, because the PR's "cross-sentence only" sample S1 is also caught by the clause-level atlas check. K2 is therefore unresolved for one of the six checks. Rows 10, 12 and 14 pass. Row 11: all of QA 283's lines are caught, but **4 of my 5 new rewordings are missed** (K2). There are also two false alarms, including the compliant sentence "Never wait for atlas inside a turn." (K3). |

**Overall: REJECT.** Both PRs are rejected.

**Windows was not exercised.** Plumb is Linux, so this report does not cover the Windows rename/unlink semantics
(`EPERM`, `EBUSY`, and the retry loops in `tryCreateClaim` and `renameExclusive`).

## Method and environment

- **Runner.** Every npm, tsc and vitest run went through `~/qa-tmp/qa284/run.mjs`, or through a node driver that sets
  `TMPDIR=~/qa-tmp` and `npm_config_cache=~/qa-tmp/npm-cache`.
- **Install.** `npm ci` ran once, in `qa284-pr437/open-brain`. `better-sqlite3` (with FTS5) and `esbuild` load. Every
  other tree has `node_modules` as a symlink to that install.
- **Trees.**
  - `qa284-pr437` is `ba09e2c6`.
  - `qa284-prev437` is `610dbbba` (r4, never QA'd).
  - `qa284-prev437r3` is `8e751360` (QA 280's REJECT head). I used it as the positive control.
  - `qa284-pr472` is `26edb821`.
  - `qa284-prev472` is `25ba1d4c` (#468 as merged).
  - `qa284-merge` is a local scratch merge, described under "Batch merge" below. Nothing from it was pushed.
- **No head drift.** `git fetch origin pull/437/head pull/472/head` returned exactly the pinned SHAs.
- **Not light.**
  - Only one test file ran per vitest invocation, and I ran no full suite.
  - Mutants went only on touched files. Every mutant was `tsc --noEmit`-checked (exit 0 for all) and restored with
    `git checkout --`.
  - Built mutant copies went to `~/qa-tmp/qa284/p437/mutbuild/`. Instrumented and gate copies went to the gitignored
    `build/shared/`.
- **Stress driver** (`~/qa-tmp/qa284/p437/race.mjs`). It follows QA 280's driver, with a ready-file handshake added:
  1. Each child imports the **built** module and prints READY.
  2. When every child is ready, the parent writes `start = now + 250 ms` to a barrier file.
  3. Each child polls that file every 1 ms, then spins to `start` and calls `tryClaimHookRun` once.
  - **LATE** means a child first read the barrier after `start`. It was **0 in every run in this report.**
  - `mixed=k` makes the first k children claim `race-sid` and the rest claim their own session (`other-<i>`).
  - Each trial uses a fresh HOME, and the stale claim's mtime is 10 minutes old.
- **Positive control for the driver.** On r3 `8e751360`, the crashed-lock N=8 row gave 0/100 plain and **2/100 doubles
  on the fs-instrumented copy**. That reproduces QA 280 F1, so the driver can see the defect class.
- **Deterministic gate** (`~/qa-tmp/qa284/p437/gate/`). Real r5 code runs in worker threads, on the real filesystem.
  - The built module's `node:fs` import is replaced by a wrapper.
  - The wrapper blocks a worker before a chosen syscall (op plus basename regex plus occurrence number), using
    `Atomics.wait`, until the main thread releases it.
  - Every syscall is logged.
  - **Caveat:** all workers share one pid, so the `.stale.<pid>` names coincide. No outcome below depends on that name.
- **Not touched:** no live `.agents/state.json`, knowledge DB, vault, settings file, Jev call or hub call. `gh` was used
  read-only (`run view`).
- **Real profile, G-051** (presence and mtime only):
  - `~/.claude/settings.json`: present, mtime 2026-10-01.
  - `~/.claude.json`: mtime 09:39Z, the job's launch time, so it was written by the launcher.
  - Absent: `settings.local.json`, `~/.claude/open-brain/knowledge-v2.db`, `~/.cursor/hooks.json`,
    `~/.cursor/mcp.json` and `~/.claude/.mcp.json`.
- **Tree state at the end:**
  - `qa284-wt` (before this commit) and `qa284-pr437` are clean.
  - Every other `qa284-*` tree shows only `?? open-brain/node_modules`.
  - The QA clone (`~/work/qa-242`) is clean, on `master` `b76e3113`, and was never edited.
- **No subagents.** Every row is my own run.

## Rows 1–2 (every PR)

**Row 1: Confined. PASS for both.**
- **#437:** `git diff origin/master...ba09e2c6` touches exactly the allowed set, +1097/−1:
  - `t235-p2-7-plan.md`;
  - `scripts/claim-mutant-report.mts`;
  - `src/cli-bootstrap.ts` and `src/cli-session-end.ts`;
  - `src/shared/session-hook-claim.ts`;
  - `tests/cli-bootstrap.test.ts` and `tests/cli-session-end-dedupe.test.ts`;
  - `tests/shared/claim-barrier-trials.ts`, `session-hook-claim-interleave.test.ts` and `session-hook-claim.test.ts`.
  - r4 → r5 changes the plan, the module and the two claim test files.
- **#472:** `git diff 25ba1d4c 26edb821` touches only `src/pipelines/sync/hub-room-guard.ts` and
  `tests/pipelines/sync/hub-talk-exit-codes.test.ts` (+331/−38). `25ba1d4c` is an ancestor of both `26edb821` and
  master.

**Row 2: CI (read only). PASS for both.**

| PR | Run | headSha | event | `test` | `changed` | `test-windows` |
|---|---|---|---|---|---|---|
| #437 | 37435956508 | = pin `ba09e2c6` | pull_request | **success** | success | skipped |
| #472 | 37440775028 | = pin `26edb821` | pull_request | **success** | success | skipped |

## #437 r5 (rows 3–9): REJECT

**At the head:**
- `tsc --noEmit` and `typecheck:tests` both exit 0.
- `session-hook-claim-interleave.test.ts` passes 4/4.
- The 12 unit rows of `session-hook-claim.test.ts` pass (`-t "T-235 P2-7"`).
- `cli-bootstrap.test.ts` passes 16/16, and `cli-session-end-dedupe.test.ts` 2/2.

**The PR's own barrier row is red on Plumb (F4).** I ran the PR's "crashed-lock N=8: 100 trials run 1" through vitest:
- It **failed after 512 s with `late` = 44/100** (`status=2 … LATE:46`).
- Its LATE test is post-spin lag over 15 ms. On a 6-CPU host, 8 spinning children get preempted: my driver measures
  50–62 ms of maximum lag in every N=8 run, with **0** late arrivals.
- So the row asserts no late child as QA 280 F2 asked, but it measures preemption, not arrival. It fails on a host with
  fewer cores than N.
- CI (run 37435956508) was green on the same row.

### Row 3: QA 280 F1 (crashed `.reclaim` plus a stale claim, N=8). PASS

| Build | Trials | Exact | **Doubles** | Throws | Late | Leftover files |
|---|---|---|---|---|---|---|
| r5 plain, run 1 | 100 | 100 | **0** | 0 | 0 | `.claim` only |
| r5 plain, run 2 | 100 | 100 | **0** | 0 | 0 | `.claim` only |
| r5 plain, run 3 | 100 | 100 | **0** | 0 | 0 | `.claim` only |
| r5 fs-instrumented (QA 280's method), my driver | 100 | 100 | **0** | 0 | 0 | `.claim` only |
| r5 fs-instrumented, **QA 280's own `race.mjs`** (800 + 400·N ms offset) | 100 | 100 | **0** | 0 | 0 | `.claim` only |
| control: r3 `8e751360` fs-instrumented | 100 | 98 | **2** | 0 | 0 | — |

The crashed lock is always cleared. The same row with a 90 s-old crashed lock (the breaker path, not the sweep) gave
100/100 exact.

### Row 4: D1 by argument and by test. FAIL (F2)

**The breaker, as read at head:**
- `tryAcquireReclaimLock` (L166-176) runs `wx` on L. On EEXIST it runs `tryAcquireBreakerLock(B)`, which is `wx` on B,
  or else `tryBreakStaleAuxLockFile(B)` and then `wx`.
- With B held, `breakStaleReclaimLockWhileBreakerHeld(L)` (L144-154) does stat → TTL → seam → re-stat (`sameSnap`) → TTL
  → unlink. Then B is released, and `wx` on L follows.

**Crash points: what the next process finds, and whether two holders can result.**

| Crash point | Left on disk | Next process | Two holders? |
|---|---|---|---|
| before taking B | stale L (if L crashed) | takes B, breaks L, takes L | no |
| after `wx` B, before the stat of L | fresh B, stale L | B is inside its TTL, so `duplicate` for up to 60 s (the claim stays stale, every hook skips). After 60 s B is broken **without a lock**, then L under the new B. | only through the B-break race below |
| between the stat/re-stat of L and its unlink | same as above | same as above | same |
| after unlink L, before release B | stale B, no L | `wx` on L succeeds directly. The orphan B is harmless until L crashes again. Nothing ever sweeps an orphan B or L (Info). | no |
| after release B, before the retry `wx` on L | nothing | `wx` on L succeeds | no |
| holding L (in `reclaimStale`, before or after the rename) | L, and possibly a `.stale.<pid>` tombstone | L is broken after 60 s. The tombstone is removed by the unlocked sweep branch. | no |

**How a stale `.reclaim.breaker` is broken.** `tryBreakStaleAuxLockFile` (L128-138) does stat → TTL → seam → re-stat →
TTL → **unlink, with no lock**.
- That is the stat-then-unlink pattern one level up.
- The re-stat narrows the window to the gap between the second `snapStat` and `unlinkQuiet`, but it does not close it.
- **The PR's seam sits before the re-stat**, so its D3a row cannot reach that gap.

**Plant** (`gate/scen.mjs A-residual`, on a stale claim, a stale L and a stale B):
1. P2 has stat'd and re-stat'd the stale B. It is held before its unlink.
2. P1 runs the same code: it unlinks the stale B, `wx`-creates B1, stats and re-stats L, and is held before unlinking L.
3. P2 resumes. It **unlinks P1's live B1**, creates B2, breaks L, and `wx`-creates L2. It is held while holding L2.
4. P1 resumes. It **unlinks P2's live L2** and creates L1. **Two processes now hold the reclaim lock.** P1 reclaims and
   gets `claimed`.
5. P2 resumes. It renames **P1's fresh claim** aside, sees it is fresh, unlinks it and gets `duplicate`. The claim path is
   now empty.
6. P3 runs and gets `claimed`.

**Result: red, 2 claims.** The same plant at the PR's seam position (`A-seam`) is **green**: P2's re-stat sees B1's new
mtime. Note that ext4 reused the inode number, so only the mtime comparison saved it.

**Stochastic:** a stale B plus a stale L at N=8 gave 0/100 plain and 0/100 instrumented. The precondition is a hook that
crashes (or stalls past 60 s) inside the breaker's few-syscall hold. That is rare, but it is exactly the class D1 claims
to close ("two breakers can never act on the same stat").

### Row 5: D2, the sweep. Passes as worded; my own interleaving fails (F1, blocking)

**As worded:**
- **A stale claim that is reclaimed and re-created fresh between the sweep's stat and its act survives.**
  - With the sweep holding the claim's reclaim lock, no other process can remove the claim, so none can re-create it.
  - The re-stat additionally covers D3b's seam shape.
  - Gate plants `C-sweepseam` and `E-sweep-residual` (head) leave the race-sid claim intact (1 claim).
- **The sweep never touches a `.reclaim` or `.breaker` file by name** (L249). But through the lock protocol, another
  session's sweep does create and release L for every stale claim it removes, and it can break a stale L and B
  (`sweeptouch.mjs`):
  - stale claim plus stale L, and stale claim plus stale L plus stale B: all removed;
  - an orphan L plus B with no claim: untouched, forever;
  - a fresh L: untouched.

**F1: D2 introduces a lost-run path.** While another session's sweep holds L(S), every hook for S finds L(S) fresh. It
cannot break it, so `reclaimStale` returns `duplicate`. A hook that gets L(S) just after the sweep removed the claim
sees `ENOENT` at L195 and also returns `duplicate`, although the path is empty.

**Planted** (`C-sweeplock`): T's sweep is held while holding L(S). S's two dual hooks both return `duplicate`. T removes
the stale claim. **Result: 0 claims for S.** Instrumented trace: `race.mjs … mixed=4 tracezero`, trials 19 and 33.

**Stochastic** (stale claim for `race-sid`, plain build unless noted):

| Shape | r5 `ba09e2c6` | r4 `610dbbba` | r3 `8e751360` |
|---|---|---|---|
| N=2: 1 race-sid hook + 1 other-session hook | **zero claims 83/100**, doubles 0 | zero 5, doubles 0 | zero 2, doubles 0 |
| N=3: the dual race-sid hooks + 1 other | **zero 72/100** | — | — |
| N=8: the dual hooks + 6 others | **zero 11/100**, doubles 0 | zero 0, **doubles 17** | — |
| N=8: 4 race-sid + 4 others (2 runs) | **zero 2 and 7**, doubles 0 | zero 0, **doubles 11** | zero 0, **doubles 19** |
| same, fs-instrumented | zero 8/100 | — | — |

**What this shows:**
- **D2 fixed a real cross-session double-claim defect** that no earlier row measured: r3 had 19/100 doubles and r4
  11/100.
- **It turned those doubles into lost runs.** A hook that runs while any other Cursor session's hook is running is
  skipped 83% of the time.
- Plausible triggers are a Cursor restart restoring several windows (several `sessionStart`s for resumed sessions), and
  quitting with several windows open (`sessionEnd`). A skipped `sessionEnd` drops that session's capture.

**Fix direction:**
- A reclaimer that finds L held should not conclude `duplicate` unless the holder is a reclaimer of the same claim. For
  example, the sweep could use its own lock name, or skip a claim whose L it cannot take, instead of taking the
  reclaimers' lock.
- `ENOENT` under L should fall through to the `wx` retry instead of returning `duplicate`.
- Add a mixed-session barrier row (at least N=2 with one other session) that asserts exactly one claim.

### Row 6: D3, the rows can fail. Partial

| Source | tsc | D3a r5 (breaker) | D3b r5 (sweep) |
|---|---|---|---|
| `ba09e2c6` head | 0 | green | green |
| **610dbbba, literal** (the r5 test file dropped into `qa284-prev437`) | **typecheck:tests exit 2** (no `setClaimTestSeamsForTest` or `sweepRemoveClaimR4ShapeForTest`) | red, `setClaimTestSeamsForTest is not a function` | red, same |
| **610dbbba transplant**: r4's rename-aside breaker and r4's unlocked stat→unlink sweep inside the r5 file, with the r5 seams at the same points | **0** | **red** (`expected false to be true`: the fresh lock was destroyed) | **red** |
| stat-then-unlink sweep mutant (no lock and no re-stat in `sweepRemoveExpiredClaimFile`) | 0 | green (as expected: it is a breaker row) | **red** |

- **The literal run is red only because the exports are missing**, so it does not count as red-first. The transplant is
  red for the right reason. Every mutant was restored, and the tree is clean.
- **F3, Medium (test adequacy). The two "(RED)" r4-shape rows are tautologies that pass.**
  - "D3a r4-shape (610dbbba): … (RED)" calls no production code: it writes a file, unlinks it, and asserts that it is
    gone.
  - "D3b r4-shape stat-unlink … (RED)" asserts that the test-only `sweepRemoveClaimR4ShapeForTest` deletes the fresh
    claim.
  - Both are green at head and under every mutant.
  - The plan's sentence "r4 rename-aside and stat-unlink sweep shapes stay red in regression tests" is not true of these
    rows.
- **My own interleaving:** `A-residual` (row 4) is **red at head**, and so is `C-sweeplock` (row 5, a zero-claim). The
  rule as stated ("never act on a lock or claim you only stat'd") should cover both. Neither is reachable through the
  PR's seams.

### Row 7: mutants on r5

The PR's deterministic rows are the interleave file (4 rows) plus the 12 unit rows. QA's gate rows are in
`gate/scen.mjs`. The N=8 rows are 100 trials each, on a built copy of the mutant.

| Mutant | PR deterministic rows | QA deterministic gate row | Overlapping N=8 row (doubles per 100) | Head on the same N=8 row |
|---|---|---|---|---|
| **(a)** the breaker skips the breaker lock (production and test export) | **all green** | `D-lock-residual`: **red**, 2 claims (head: 1) | crashed lock: **0** plain, **1** instrumented | 0 and 0 |
| **(b)** the sweep skips the reclaim lock | **all green** | `E-sweep-residual`: **red**, 2 claims (head: 1) | mixed 4+4 stale: **9** | 0 (zero claims 2 and 7) |
| **(c)** the re-stat after taking the lock is removed: (c1) in the sweep | D3b **red** | — | mixed 4+4: 0 doubles (5 zero claims) | 0 |
| (c2) in the breaker | D3a **red** | — | crashed lock: 0 | 0 |
| **(d)** the skip-self (`keep`) check is removed | unit "sweep never unlinks the keep path…" **red** | — | stale N=8: 0 | 0 |

- **(a) and (b), the two lock mutants that D1 and D2 exist for, pass every row in the PR.** Only QA's gate rows catch
  them deterministically, plus (b)'s mixed-session N=8 row. **(c) is red only on the D3 seam rows.** Under concurrency it
  is equivalent, because the lock already makes the re-stat redundant.
- QA 280 row-4 mutants on r5 (stale N=8):
  - no reclaim lock at all (r2's order): **43/100** doubles;
  - overwrite instead of `wx` after a reclaim: **24/100**.
  - Both pass every deterministic and unit row in the PR. Only the PR's barrier rows could catch them, and those rows
    fail on Plumb for an unrelated reason (F4).

### Row 8: QA 280 rows 3, 4 and 6, and F3. PASS

- **Row 3 (stale barrier):** N=2 100/100, N=3 100/100, and N=8 100/100 in each of 3 runs. 0 doubles, 0 throws, 0 late.
- **Row 4 (mutants on the N=8 stale barrier):** no lock gives 43/100 doubles and overwrite 24/100. Skip-self (d) is now
  0/100: the sweep takes the lock, so it is red only on its unit row.
- **Row 6** (source mutants, tsc 0, one file each):

| Mutant | Result |
|---|---|
| M1: `existsSync` then a plain write instead of `wx` | **red**: "fresh claims: 2 children … exactly one wins" |
| M2: `cli-session-end` always dedupes (`\|\| true`) | **red**: "Claude-shaped SessionEnd without cursor_version is never skipped" |
| M2 inverse (never dedupe) | **red**: "second cursor SessionEnd … is skipped" |
| `SWEEP_CAP` 32 → 1000 | **red**: "sweep removes at most SWEEP_CAP…" |
| cap check removed | **red**: same row |
| skip-self removed | **red**: "sweep never unlinks the keep path…" |
| sweep TTL, claim branch (first check) removed | green, **equivalent**: the re-stat TTL check at L225 still applies |
| sweep TTL, non-claim branch (L257) removed | **green, survives** (F6, Low) |
| the `.reclaim` skip removed from the sweep | **red**: "sweep never removes a .reclaim lock file…" |
| the `.breaker` skip removed from the sweep | **green, survives** (F5): the row's breaker is 65 s old, and the sweep's TTL is 120 s |
| the TTL check in the lock breaker removed | **red**: "a live reclaim lock inside TTL is not broken…" |

- **F3 holds as worded:**
  - **Live lock** (mtime now), N=8: same inode survives 100/100, all `duplicate`.
  - **Live breaker** (mtime now) over a crashed L, N=8: the breaker survives 100/100, all `duplicate`.
  - `f3.mjs`: a lock held by pid 1 (alive for days) with mtime 1 s or 59 s is **not** broken. At 61 s it is broken.
  - So the TTL is on mtime only, and a stalled live holder past 60 s still loses its lock. QA 280's F3 note stands. Its
    later release (an unconditional unlink) would then delete the next holder's lock (Low).

### Row 9: no regression. PASS

`cli-bootstrap.test.ts` passes 16/16 and `cli-session-end-dedupe.test.ts` 2/2, at the head and on the scratch merge.

### #437 findings

1. **F1, blocking (row 5).** D2's sweep holds the claim's reclaim lock, so concurrent hooks of the swept session return
   `duplicate`. `ENOENT` under the lock also returns `duplicate`.
   - **Zero claims in 83/100** at N=2 cross-session (r4: 5, r3: 2), and 11/100 for the dual hook plus 6 others.
   - The result is a lost SessionStart or SessionEnd run.
2. **F2, blocking (row 4).** The stale `.breaker` is broken by stat → re-stat → unlink with no lock. The planted
   interleaving in that gap gives two reclaim-lock holders and two claims. The PR's seam precedes the re-stat, so D3a
   cannot see it. It was not observed stochastically (0/200).
3. **F3, Medium.** The two "(RED)" r4-shape rows are passing tautologies. Lock mutants (a) and (b) pass every
   deterministic row in the PR.
4. **F4, Medium.** The PR's N=8 rows count post-spin lag over 15 ms as late, so they are red on Plumb (44/100) while
   green in CI.
5. **F5, Low.** "sweep never removes a .breaker lock file even when it is past TTL" is vacuous: 65 s is not past the
   sweep's 120 s TTL.
6. **F6, Low.** The non-claim sweep branch (tombstones) is still an unlocked stat→unlink, and its TTL check has no row.
   Planted (`B-aside`): another session's sweep deletes a live reclaimer's tombstone, and S gets 0 claims.
7. **Info.** Orphan `.reclaim` and `.breaker` files with no claim are never cleaned up.

## #472 r3 (rows 10–14): REJECT (narrow)

At the head:
- `tsc --noEmit` and `typecheck:tests` exit 0, and `hub-talk-exit-codes.test.ts` passes 16/16.
- The tracked copies give 0 violations: both `hub-room.mdc` copies and `start.md`'s Hub-room section.

**The probe** is `~/qa-tmp/qa284/p472/probe.mjs`. For each line it runs `hubRoomGuardViolations` on:
- **iso:** the line alone;
- **mdc / tpl:** each `hub-room.mdc` copy, with the line planted after "Post when the work is done, not a bare
  acknowledgement.";
- **start:** `start.md`'s Hub-room section, with the line appended to the Hub-room paragraph.

A line is CAUGHT in a context when it adds at least one violation there.

### Row 10: S1 to S6. PASS

| Line | head: iso / mdc / tpl / start | Check that fires | prev `25ba1d4c` |
|---|---|---|---|
| S1 | CAUGHT ×4 | atlas (clause) **and** cross-sentence | missed |
| S2 | CAUGHT ×4 | hub-verb (the `hub-talk.mjs` splitter fix works) | missed |
| S3 | CAUGHT ×4 | atlas (clause) | missed |
| S4 | CAUGHT ×4 | hub-verb | missed |
| S5 | CAUGHT ×4 | hub-verb | missed |
| S6 | **not fired** ×4 | — | **fired** (false alarm) |

### Row 11: QA 283's rewordings and three new ones. Passes for QA 283's lines; misses → K2

- **All of QA 283's lines are CAUGHT in all four contexts:**
  - QA 281's R1–R4;
  - **Own-1, Own-2 and Own-3**;
  - **Dispatch e.g. 1, 2 and 3**;
  - and QA 283's extra misses "the talk line listens…", "await the next atlas turn…" and "…wait for atlas, never ending
    the turn…".
- At `25ba1d4c`, Own-1 to Own-3, Disp1 and Disp3 were all missed.
- **Still missed:** QA 283's split example "After posting, run hub-talk with `--inbox` once more. Wait for what it prints
  and act on it." The second sentence names no atlas or turn term.

**My new rewordings, each a line a seat would obey:**

| Id | Text | Result |
|---|---|---|
| **N1** | "After you post, check the room again with the hub-talk `--inbox` line; if nothing new is there yet, try again in a minute, and only end this turn once there is something new to act on." | **missed** ×4 |
| **N2** | "When your reply is posted, keep this run open and run the talk line with `--inbox` every 30 seconds; as soon as the planner's next message shows up, handle it here." | **missed** ×4 |
| **N3** | "Don't end the run after posting: run hub-talk with `--inbox` again, and repeat that until the room has something new for you." | **missed** ×4 (`repeat … until` sits in a different clause from `hub-talk`) |
| N4 (extra) | "After posting, run hub-talk with `--inbox` once more. Then wait, and act on atlas's reply." | CAUGHT ×4 (**cross-sentence only**: see row 13) |
| N5 (extra) | "Stay in this turn after posting and keep checking the talk line's `--inbox` output until a new message lands." | **missed** ×4 |

**K2, Medium (non-blocking on its own): 3 of my 3 primary rewordings are missed, and 4 of 5 overall.** Each one evades a
specific pattern:
- "every minute" matches, but "every 30 seconds" does not;
- "stay in this run" matches, but "stay in this turn" and "keep this run open" do not;
- "planner" is not a synonym for atlas;
- the clause split separates `repeat … until` from `hub-talk`.

As QA 283 noted, a vocabulary list cannot close this class. A structural rule would cover more: forbid any second
invocation of the talk line after `--say` in the same turn, and forbid "until"/"once" with an end-of-turn condition.

### Row 12: no false alarms on the listed sentences. PASS, with K3

Every listed sentence is green in all four contexts:
- the tracked copies;
- the exit-2 sentence;
- the full exit-3 retry text;
- "If hub-talk is throttled, wait 5 seconds and retry.";
- "Never block on hub-talk waiting for the next atlas turn in this run — …";
- `start.md`'s "…then end this turn; never block on hub-talk waiting …";
- "If hub-talk exits 3, wait `retry-after` seconds and run the talk line again.";
- "run the `talk` line with `--inbox` before other work".

**K3, Low-Medium: false alarms beyond the list.**

| Sentence | Result |
|---|---|
| FA1 "Wait for CI to finish before you post your reply." | **flagged** ×4: `wait` plus `reply` |
| FA5 "Never wait for atlas inside a turn." | **flagged** ×4. This sentence states the rule, but the negation exemption needs a hub term in the clause. |
| FA3 "If atlas's reply asks for a test, wait until the test passes, then post." | green in the mdc copies, **flagged in `start.md`**: cross-sentence, because the previous sentence names hub-talk |
| FA2 and FA4 | green |

### Row 13: K2, each check has its own positive. FAIL on the cross-sentence check

**(a) PASS.** `git grep` for `skip(WaitCount|SeatFileWait|HubVerbInTurn|AtlasNextTurn|NegationScope)`,
`hubRoomGuardViolations` and `hub-room-guard` over the whole tree finds:
- the definitions in `hub-room-guard.ts`;
- the test file;
- one mention in a docs dispatch.

No file in `open-brain/src` (other than the guard's own definition), `scripts/`, `.cursor/` or `project-template/`
passes a skip flag, or calls the guard at all.

**(b) Source mutants** (`~/qa-tmp/qa284/p472/mut.mjs`; tsc 0 each; one vitest run each; restored):

| Check disabled in the source | Tests that go red |
|---|---|
| `--wait` count (`if (false)`) | "each guard check has a positive only it catches", "mutant table…" (`wait count full`) |
| seat-file `wait` and wait-timeout | the same two rows (`seat-file wait full`) |
| hub-verb in-turn (`clauseHubVerbInTurnWait` returns false) | "QA-281/283 rewordings…" (Own1 mdc), "planner S1–S6 table" (S2), "each guard check…", "mutant table…" |
| atlas/next-turn, **clause loop only** | "planner S1–S6 table" (S3), "each guard check…", "mutant table…" (`atlas/next-turn full`) |
| **cross-sentence loop only** | **none: 16/16 green** |
| negation scope (`negationScopeEnabled` returns false) | "tracked hub copies pass…", "planner S1–S6 table" (S6), "allowlisted hub sentences…", "mutant table…" |

**K1, blocking for this row.** The atlas/next-turn clause check **has** a positive only it catches: S3. **The
cross-sentence check does not, in the PR's suite.**
- The PR's `ONLY_CROSS_SENTENCE = S1` is also caught by the clause check, because its second sentence "Wait for the next
  atlas turn…" is a `wait` plus atlas clause with no hub term.
- The test table cannot tell the two checks apart, because it disables both with the same `skipAtlasNextTurn` flag.
- **Disproved for the PR, proved possible by QA.** N4 ("…once more. Then wait, and act on atlas's reply.") is caught at
  head and **missed with the cross-sentence loop deleted**, so a unique positive exists.
- **Fix:** add N4 (or a line like it) as `ONLY_CROSS_SENTENCE`, and give the cross-sentence check its own skip flag or
  mutant row.

### Row 14: F6. PASS, with a Low note

- **The seat file:** adding a top-level `"wait"` key to `.agents/SYSTEM/hub-partner-seats.json` makes "hub-partner-seats.json
  has no top-level wait key and start Hub section is non-empty (F6)" go **red** (`expected { …(8) } to not have property
  "wait"`).
- **The heading:** renaming `### Hub room` to `### Hub-room` in `project-template/.cursor/commands/start.md` makes the F6
  row **red** (`expected 0 to be greater than 100`), along with the rewordings row and the parity row. Emptying the
  section makes F6 and three other rows go red.
- **Low:** a `wait` key nested in a seat entry (`seats.planner.wait`) is **not** caught (16/16 green). F6 checks only
  the top level.
- All mutations were restored, and the tree is clean.

### #472 findings

1. **K1, blocking (row 13b).** The cross-sentence check has no positive of its own in the suite: deleting it leaves 16/16
   green. Fix it with a cross-sentence-only positive such as N4, and its own flag or mutant row.
2. **K2, Medium.** 4 of 5 new seat-obeyable rewordings are missed (N1, N2, N3, N5), and so is QA 283's split example.
3. **K3, Low-Medium.** False alarms: "Wait for CI to finish before you post your reply." and the compliant "Never wait
   for atlas inside a turn." In `start.md` the cross-sentence check also flags an unrelated `wait … reply` sentence.
4. **K4, Low.** F6 does not catch a nested per-seat `wait` key.

## Batch merge (informational: the dispatch has no merge row)

In `qa284-merge`, starting from `origin/master` `5b0116dc`, I ran `git merge --no-ff ba09e2c6` (giving `d0f1efce`) and
then `26edb821` (giving `74ac9f09`). There were no conflicts. Nothing was pushed.
- `tsc --noEmit` and `typecheck:tests` exit 0.
- `hub-talk-exit-codes` passes 16/16, `session-hook-claim-interleave` 4/4, `cli-bootstrap` 16/16 and
  `cli-session-end-dedupe` 2/2.

## Findings summary

| Id | PR | Severity | Finding |
|---|---|---|---|
| F1 | #437 | **Blocking** | Cross-session hooks lose the claim: **0 claims in 83/100** at N=2 (r4 5, r3 2), and 11/100 for the dual hook plus 6 others. D2's sweep holds the claim's reclaim lock, and `ENOENT` under the lock returns `duplicate`. |
| F2 | #437 | **Blocking** | The stale `.breaker` is broken by an unlocked stat → re-stat → unlink. The planted gap gives two reclaim-lock holders and 2 claims. The PR's seam precedes the re-stat. |
| F3 | #437 | Medium | The "(RED)" r4-shape rows are passing tautologies. Lock mutants (a) and (b) pass every deterministic row in the PR. |
| F4 | #437 | Medium | The PR's N=8 rows treat post-spin preemption over 15 ms as late, so they are red on Plumb (44/100) and green in CI. |
| F5 | #437 | Low | The `.breaker` sweep row is vacuous (65 s versus the 120 s sweep TTL). |
| F6 | #437 | Low | The unlocked tombstone sweep can delete a live reclaimer's tombstone (0 claims, planted). Its TTL check has no row. |
| K1 | #472 | **Blocking** | The cross-sentence check has no positive of its own (16/16 green when deleted). N4 would be one. |
| K2 | #472 | Medium | 4 of 5 new rewordings are missed, and so is QA 283's split example. |
| K3 | #472 | Low-Medium | False alarms, including "Never wait for atlas inside a turn." |
| K4 | #472 | Low | A nested per-seat `wait` key is not caught. |

Drivers, gate scenarios and mutant tools are in `~/qa-tmp/qa284/` (`p437/race.mjs`, `p437/gate/scen.mjs`,
`p437/srcmut.mjs`, `p437/batch.mjs`, `p437/sweeptouch.mjs`, `p437/f3.mjs`, `p472/probe.mjs`, `p472/mut.mjs`,
`p472/f6.mjs`). They are on Plumb and not committed.

QA-284: REPORT COMPLETE
