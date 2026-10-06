# QA 280 report: session-162 batch a (prefix `s162a`), narrow re-runs of #437 r3 and #445 r3, #425 after its conflict, and the batch merge (Plumb, Linux)

**Seat:** QA, headless Claude Code on Opus, record session 162. Machine: Plumb (Linux). 2026-10-05.
Dispatch: `docs/loops/qa-280-s162a-dispatch.md`.

**Worktree:** `git -C ~/qa-scratch/qa280-wt log -1 --format=%H` = `5e28a9103c21342666017a447ecd3e3317b4bed6` (the
DISPATCH_SHA). `git worktree add` refused because `~/qa-scratch/qa280-wt` **already existed** (created 18:32 local today,
before this job's first command). It was a registered worktree of this clone, detached at the DISPATCH_SHA, with a clean
`git status`, so I used it as is. `origin/master` at fetch = `1671d005` (#458), which contains the DISPATCH_SHA.

## Verdicts

| PR | Task | Pinned new head | Verdict | Deciding rows |
|---|---|---|---|---|
| #437 | T-235 P2-7 r3 | `8e751360ba2190b810323a623f74ee08def34b6a` | **REJECT** | **Row 5 fails.** A reclaim lock left by a crashed process gives **two claims at N=8**: 3/300 on the plain head build (1, 0, 2 per 100) and 4/100 on an fs-instrumented copy. Rows 1, 2, 3 and 6 pass. Row 4 passes as worded, but see F2: the PR's own N=8 rows cannot fail. |
| #445 | T-156 r3 | `260d68352fb89030a92029eae56053d00ed3f7d0` | **REJECT** | **Row 9(b) fails.** A narrowed (typo'd) needle in R-BF-21's real `git grep` stays **green**, even with a real code-line hit planted in `src/cli.ts`. Re-run by the QA lead. Rows 1, 2, 7, 8 and 11 pass. Row 10 passes with two Low drifts. |
| #425 | T-235 P2-4 (merge of master `2f8e6489`) | `1eea3cdb3740690078fb2254b8c8b41887c3b3cd` | **ACCEPT** | Rows 1, 2, 12 and 13 pass. **Merge-order caution (F5):** #425 without #437 runs `cli-session-end` twice per Cursor session end. |
| Batch merge | #437 → #425 → #445 onto `origin/master` `1671d005` | scratch merge `2cbfc317` (not pushed) | **REJECT** | Rows 14 and 15 **pass mechanically**: no conflicts, every check green, one session end per Cursor session. The batch is rejected because two of its three heads are rejected. |

**Overall: REJECT.** ACCEPT needs all three PRs and the batch merge accepted.

## Method and environment

- Node v22.22.1, Linux. Every npm, tsc and vitest run went through `~/qa-tmp/qa280/run.mjs` or a node driver that sets
  `TMPDIR=~/qa-tmp` and `npm_config_cache=~/qa-tmp/npm-cache`.
- **Install and trees.**
  - `npm ci` ran once, in `qa280-pr437/open-brain`. Every other tree has `node_modules` as a symlink to it, which shows
    as `?? open-brain/node_modules`.
  - No head changes `package-lock.json`. `better-sqlite3` (with FTS5) and `esbuild` load.
  - Trees: `qa280-pr{437,445,425}` hold the pinned new heads, `qa280-prev{437,445,425}` the previous QA'd heads, and
    `qa280-merge` the batch.
- **Head drift: none.** `git fetch origin pull/<N>/head` gives exactly the pinned SHA for all three.
- **LIGHT.** One test file per vitest invocation, and no full suite. Mutants went only on touched files: the `#437`
  module and its call site, and #445's test files plus the `src` files they scan. Each source mutant was `tsc`-checked
  and restored with `git checkout --`. The #437 barrier mutants are copies of the **built** module in the gitignored
  `build/shared/` directory.
- **Subagent.** #445 rows 7–11 ran in one foreground subagent while I ran the #437 barrier rows. **I re-ran row 9(b)
  myself**, because it decides the PR, and I read CC-19 at the head. Rows 3–6 (#437) and 12–15 are entirely my own
  runs. The subagent reports that one of its mutant batches ran past the 600 s tool limit and was moved to the
  background. It touched neither tree until that batch finished, and every #445 number comes from completed runs.
- **Tree state at the end:**
  - `qa280-wt` (this branch) and `qa280-pr437` are clean.
  - Every other `qa280-*` tree shows only `?? open-brain/node_modules`.
  - Build output exists only where it is gitignored.
  - The QA clone (`~/work/qa-242`) is clean, on `master`, and untouched.
- **Real profile, G-051** (presence and mtime only, no content read):
  - `~/.claude/settings.json`: present, mtime 2026-10-01.
  - `~/.claude.json`: mtime 23:37Z (18:37 local), which is the job's launch time: written by the launcher, not by QA.
  - Absent: `~/.claude/settings.local.json`, `~/.claude/open-brain/knowledge-v2.db`, `~/.cursor/hooks.json`,
    `~/.cursor/mcp.json` and `~/.claude/.mcp.json`.
- Nothing live was touched: no `.agents/state.json`, real DB, Jev call or hub call. `gh` was used read-only (`run list`,
  `run view`). Row 15 ran the hooks against a scratch `HOME`, with every open-brain path override pointing into
  `~/qa-tmp/qa280/row15*`.
- **Builder model (G-055):** composer-2.5, according to the dispatch. QA is Opus, so builder ≠ judge holds.

## Rows 1–2 (every PR)

### Row 1: Confined

| PR | Diff | Files | Outside the task? |
|---|---|---|---|
| #437 | `3dfa2424..8e751360`: 1 commit, a descendant | `docs/loops/t235-p2-7-plan.md`, `open-brain/src/shared/session-hook-claim.ts`, `open-brain/tests/shared/session-hook-claim.test.ts`; +164/−53 | none |
| #445 | `43ed65a9..260d6835`: 1 commit, a descendant | `docs/loops/t156-scan-list.md`, `open-brain/tests/harness/shadow-merge.test.ts`, `open-brain/tests/pipelines/bootstrap-fix-r4.test.ts`; +49/−20, tests and docs only | none |
| #425 | `git show --remerge-diff 1eea3cdb` (parents `9fcb97ca`, `2f8e6489`) | `open-brain/tests/setup-hooks.test.ts`, `scripts/setup-hooks.mjs`, `scripts/setup.mjs`. All three are `remerge CONFLICT (content)` files, and every hunk is a conflict hunk. | none |

**Row 1: PASS for all three.**

### Row 2: CI (read only)

| PR | Run | headSha | event | `test` | `changed` | `test-windows` |
|---|---|---|---|---|---|---|
| #437 | 37387305360 | = pin `8e751360` | pull_request | **success** | success | skipped |
| #445 | 37386476451 | = pin `260d6835` | pull_request | **success** | success | skipped |
| #425 | 37388333093 | = pin `1eea3cdb` | pull_request | **success** | success | skipped |

**Row 2: PASS for all three.** `test-windows` was skipped on every head.

## #437 r3 (rows 3–6): REJECT

At the head, `tsc --noEmit` and `typecheck:tests` exit 0. In `session-hook-claim.test.ts`, the 9 unit rows pass and the
whole file passes 15/15 on the merged tree. `cli-session-end-dedupe.test.ts` passes 2/2.

**The mechanism, read at head (`session-hook-claim.ts`):**
- The hot path is `wx` on the claim.
- On EEXIST, `reclaimStale` takes `wx` on `<claim>.reclaim` (L73-84). Under that lock it stats the claim (L104) and
  renames it to `.stale.<pid>` (L111). If the tombstone turns out fresh, it unlinks it and returns `duplicate`
  (L113-120). Otherwise it unlinks the tombstone and returns `reclaimed`.
- The lock is released in `finally` (L131-133), **before** the second `wx` on the claim (L178).
- There is no put-back.
- **Lock TTL:** `RECLAIM_LOCK_TTL_MS = 60_000`, set at L9 and used at L76. A lock older than that is broken by
  `existsSync`, `statSync`, then `unlinkSync`, then `wx` (L76-78).
- **The sweep also removes the lock.** `sweepExpiredClaims` deletes **any** entry in `hook-claims/` whose mtime is past
  the **claim** TTL (120 s), so it removes `*.claim.reclaim` too. It does this with a `statSync` and then an `unlinkSync`
  (L155-156), with no re-check in between.

### Row 3: the stale barrier: PASS

- **Driver:** `~/qa-tmp/qa280/p437/race.mjs`, built the way QA 279 built it.
  - Each child imports the **built** head module first, then spins to one shared instant (now + 800 + 400·N ms), then
    calls `tryClaimHookRun` once.
  - Each trial has a fresh HOME and a claim pre-created with an mtime 10 minutes old.
  - No child arrived late in any run below.

| Procs | Trials | Exact one claim | Double claims | Throws | Leftover files |
|---|---|---|---|---|---|
| 2 | 100 | 100 | **0** | 0 | `.claim` only (100) |
| 3 | 100 | 100 | **0** | 0 | `.claim` only (100) |
| 8 (run 1) | 100 | 100 | **0** | 0 | `.claim` only (100) |
| 8 (run 2) | 100 | 100 | **0** | 0 | `.claim` only (100) |
| 8 (run 3) | 100 | 100 | **0** | 0 | `.claim` only (100) |

### Row 4: the window cannot reopen: PASS as worded, with F2

**By reading.** The window is closed while exactly one process holds the reclaim lock:
- Nobody else can rename the claim, because only the lock holder renames.
- The hot-path `wx` cannot create while the stale file is present.
- The lock holder's tombstone therefore cannot be fresh.

It **reopens when two processes hold the lock at once**. That is possible, because both lock-removal paths are
check-then-unlink (the sweep at L155-156, and the breaker at L76-78). See row 5.

**By mutant, on my N=8 stale barrier** (100 trials each, built-module copies):

| Mutant | Result | Row that turns red |
|---|---|---|
| (a) no reclaim lock: r2's order of stat then rename, unlocked | **red, 47/100 doubles** | QA N=8 stale barrier |
| (b1) r2's put-back: a fresh tombstone is `renameSync`'d back over the claim | survives, 0/100 | equivalent today: under a single lock holder the fresh-tombstone branch cannot run |
| (b2) the claim after a reclaim is written with an overwriting write instead of `wx` | **red, 18/100 doubles** | QA N=8 stale barrier |
| (c) QA 279's skip-self mutant (the sweep may delete the path being claimed) | **red, 35/100 doubles** | QA N=8 stale barrier (**a concurrency row**). It is also red on the PR's single-process row "sweep never unlinks the keep path". |

**The PR's own N=8 rows are vacuous (F2).** Both mutants below were applied to `src` and run through the PR's test,
whose `beforeAll` rebuilds `build/`:
- Skip-self removed, on "stale claims N=8: 100 trials run 1": **green**.
- No reclaim lock at all, on the same row: **green**.

The cause: the PR's barrier gives 8 cold child processes `start = Date.now() + 400`.
- With that 400 ms offset, my driver flagged **a late child in 50/50 trials**.
- Under that offset, the no-lock mutant fell from 47% to **2%** doubles.
- So the PR's three "N=8, zero doubles" rows mostly test processes that do not overlap.

### Row 5: the new lock's own failure modes: FAIL

**The setup.** The stale claim (10 min old) as in row 3, plus a hand-made `claim.reclaim` with an old mtime, as if left
by a crashed hook.

| Case | Procs | Trials | Exact | **Doubles** | Throws | Lock after |
|---|---|---|---|---|---|---|
| crashed lock, 10 min old (removed by the sweep) | 8 | 100 | 99 | **1** | 0 | cleared (100/100) |
| same, run 2 | 8 | 100 | 100 | 0 | 0 | cleared |
| same, run 3 | 8 | 100 | 98 | **2** | 0 | cleared |
| same, fs-instrumented copy (identical logic plus logging) | 8 | 100 | 96 | **4** | 0 | cleared |
| crashed lock, 10 min old | 2 | 100 | 100 | 0 | 0 | cleared |
| crashed lock, 10 min old | 3 | 100 | 100 | 0 | 0 | cleared |
| crashed lock, 90 s old (removed by the breaker at L76-78, not the sweep) | 8 | 100 | 100 | 0 | 0 | cleared |
| **live** lock (mtime now, a live holder) | 8 | 100 | 0 (all `duplicate`) | 0 | 0 | **same inode survives 100/100**: never broken |

- **"Exactly one of N=8 gets the claim": fails.** On the plain head build that is 3/300, and 4/100 instrumented.
- **The cleanup half holds:** the leftover lock is always cleared, and a fresh live lock is never broken.

**Trace** (instrumented, trial 10, pids shortened):
1. The sweep in …196 stats the crashed lock as 604 s old. Meanwhile …202's sweep unlinks it.
2. …195 `wx`-creates a fresh lock, and …196's late `unlinkSync` deletes it. …202 then `wx`-creates its own lock.
   **Two processes now hold the "exclusive" lock.**
3. Both stat the claim as stale. …195 renames it to its tombstone, and …196 (on its first or second `wx`) creates a
   **fresh claim**.
4. …202 renames **…196's fresh claim** to its own tombstone. It sees age 0, unlinks it and returns `duplicate`, which
   leaves the path empty.
5. …195's `wx` succeeds. Result: `claimed` twice.

Trial 16 has the same shape. This is r2's steal, reached through a second lock holder.

- **The same TOCTOU is in the breaker** (L76-78: `statSync`, then `unlinkSync`). It was not observed in 100 trials at
  90 s, but it has the same shape.
- **Real-world exposure is narrow.** It needs a crashed hook's lock older than 120 s, **and** a stale claim, **and**
  three or more concurrent claimers for one session. The real dual hook is N=2, which is clean.
- I rule on the row as written.

**Fix direction:** never unlink a lock you only stat'd.
- Rename the old lock aside, then re-check that the aside's `ino` and mtime still match the stale one. Or break a stale
  lock only through a second `wx` lock.
- Exclude `*.reclaim` from the sweep.
- Add a crashed-lock N=8 row whose barrier actually overlaps the processes: import first, and allow at least 800 ms plus
  400 ms per process.

### Row 6: rows 9, 11 and 12 still hold: PASS

Source mutants are applied, `tsc --noEmit` exits 0, one file is run, and the mutant is restored
(`~/qa-tmp/qa280/p437/srcmut.mjs`).

| Row | Mutant | Result |
|---|---|---|
| 9 | M1: read-then-write instead of `wx` (`existsSync` then plain write) | **red**: "fresh claims: 2 children … exactly one wins" fails |
| 11 | M2: `cli-session-end.ts:58` `… \|\| true` (always dedupe) | **red**: "Claude-shaped SessionEnd without cursor_version is never skipped" fails |
| 11 | inverse (`&& process.pid < 0`, never dedupe) | **red**: "second cursor SessionEnd … is skipped" fails |
| 12 | sweep TTL check removed | **red**: the "expired claims … at most 32 per call" row |
| 12 | `SWEEP_CAP` 32 → 1000 | **red**: the "sweep removes at most SWEEP_CAP" row (QA 279: survived) |
| 12 | cap check removed | **red**: the same row |
| 12 | skip-self removed | **red**: the "sweep never unlinks the keep path" row (QA 279: survived), and red on QA's N=8 row (row 4) |

**The seat's "sweep cap of 40 that leaves 8", checked against the code:**
- The cap is `SWEEP_CAP = 32` (L137, enforced at L151).
- The new test plants **40** stale files and expects **8** left (`40 - SWEEP_CAP`).
- So 40 is the input count, not the cap. The behaviour is right; only the wording is off.

The sweep now swallows per-entry errors (QA 279 F3). An `oops/` directory no longer throws, per the PR row, which is
green.

### #437 findings

1. **F1, blocking (row 5).** A crashed `.reclaim` lock plus a stale claim gives two claims at N=8 (3/300 plain).
   - Cause: the sweep's stat→unlink TOCTOU deletes a live lock, so two processes hold it, and the second steals and
     deletes the winner's fresh claim.
   - The breaker at L76-78 has the same shape.
2. **F2, Medium-High (test adequacy).** The PR's "stale claims N=8" rows cannot detect the defect they are named for.
   - r2's no-lock order and the skip-self mutant both pass them.
   - The barrier's 400 ms offset leaves a child late in every trial measured. Import first, then use a larger offset or
     a ready-file handshake.
3. **F3, Low.** A lock held by a live process for more than 60 s is broken by the breaker. That is unlikely for a hook,
   but the TTL is not tied to a liveness check.
4. **F4, note.** QA 275 row 18 / QA 279 F5 is still open: the plan's after-counts sit under "Live counts (QA PC)".

## #445 r3 (rows 7–11): REJECT

At the head, `tsc --noEmit` and `typecheck:tests` exit 0. `shadow-merge.test.ts` passes 43/43 and
`bootstrap-fix-r4.test.ts` 11/11, on both r3 and r2.

### Row 7: F1, CC-19 paired: PASS

CC-19 (`shadow-merge.test.ts:356-369`) now uses the shared `codeHas` with a planted positive (`prepareShadowVerdict();`),
a `//` near-miss and a `/* */` near-miss (L361-363), then `codeHas(runtime, …)` false (L364). Read by the QA lead.

| Mutant in `src/harness/runtime.ts` | r3 head | r2 control |
|---|---|---|
| SRC-SM-C: a `//` comment naming `prepareShadowVerdict` | **green** 43/43 | red (CC-19) |
| a `/* prepareShadowVerdict */` comment | **green** 43/43 | red (CC-19) |
| a real `import { prepareShadowVerdict }` plus a call | **red** (CC-0 and CC-19) | red |

**Low:** CC-19 keeps two raw `cli` `toContain` presence checks (L365, L368). With the `shadow-verdict` dispatch commented
out, CC-19 stays green. CC-20, CC-18 and CC-6 go red, so the file still catches it.

### Row 8: F2, doc readers: PASS

- **All five readers are now under "Out of scope: reads docs"**, each with a reason: hub-talk-exit-codes 10-40,
  bootstrap-fix 278-281, bootstrap-fix-r3 343-347, bootstrap-fix-r4 93-98, and shadow-merge 360 (`PROCEDURE.md`).
- **The two borderline ones are decided as out of scope**, with reasons: s4-g4-reconstruct 124-131 (record prose) and
  template-seed 21-44 (shipped template files, exact equality).
- QA 279's lower-severity omissions (s4-guards 202-241, s4-g5-qa Q5, t048-r2b D4) are now listed too.
- **The subagent's own scan of `open-brain/tests`** (about 30 sites, table in `~/qa-tmp/qa280/p445/notes.md`) found
  **one scan neither paired nor listed**:
  - `harness/t195-plan-gate.test.ts:153` is a raw-text `toContain("has_observable_acceptance_min")` on
    `src/harness/policies/plan-gate.json`. **Low**: it is a presence check on a JSON key.
  - Info: `t214-declared-blank` reads a `docs/loops` markdown file as parser input. It is not under "reads docs".

### Row 9: F3, R-BF-21 controls the real scan: FAIL on (b)

**The test at head** (`bootstrap-fix-r4.test.ts:137-168`):
- r3 strips `path:line:` from each `git grep` row and drops comment lines (`renameHookInSourceLine`).
- It has a planted comment-only grep row.
- It **removed** r2's `status === 1` and `stdout === ""` asserts.

| Mutant | r3 head | r2 control |
|---|---|---|
| (a) a `//` near-miss naming `OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK`, appended to tracked `src/cli.ts` | **green** 11/11 | red |
| (a′) a one-line `/* … */` near-miss, same file | green | red |
| a real code line `export const … = process.env.OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK;` in `src/cli.ts` | **red** | red |
| **(b) a typo'd needle in the real `git grep`** (`RENAME_HOOK_VAR + "_TYPO"`), **with that real code line planted** | **green**: re-run by the QA lead, R-BF-21 1 passed | green |
| (b) control: the correct needle with the same planted line | red (QA lead: `expected [ Array(1) ] to deeply equal []`) | — |
| pathspec typo `open-brain/srcX`, with the real line planted | green | — |
| `sourceLineFromGitGrep` returns "" for every row, with the real line planted | green | — |

- **(a) is fixed:** a `//` near-miss in a real file stays green.
- **(b) still fails:** the real scan has no positive control. A narrowed needle, a broken pathspec, an erroring
  `git grep`, or a blinded line extractor all leave the test green while a real hit sits in `src`.
- **Fix:**
  - Add a planted code-line grep row that must give one hit.
  - Assert `g.error` is undefined and `g.status` is 0 or 1.
  - Add a positive control for the real `git grep` itself: the same spawn args on a temp repo with a planted line, or a
    known-present token.

### Row 10: F4, ranges: PASS, with two Low drifts

The subagent checked 16 cited ranges.
- **Exact:** CC-0 313-354, R-BF-21 137-168, D4 194-217 (pair 200-211), checks 141-160, s4-g2-key 236-241, s4-g5-qa Q5
  134-139, bootstrap-fix 278-281, bootstrap-fix-r3 343-347, bootstrap-fix-r4 93-98, PROCEDURE 360, and s4-g4 124-131.
- **Within one line:** hub-talk 10-40 (to 41), template-seed 21-44 (to 45), and s4-guards.
- **Drift (Low):**
  - **CC-19** is cited as 356-367 but runs to 369, which misses the L368 check.
  - **git.test** is cited as 61-66 (the pair), but the real scan is at 74-99. This entry is unchanged since r2.

### Row 11: QA 279 row 18 holds: PASS

All 16 mutants are red, as written or faithfully adapted:
- `codeHas` ×3, `skipCall` ×2, `badReturn` ×3;
- `renameHookInSourceLine` (was `namesHook`; adapted to the new name and `RENAME_HOOK_VAR`): `/*` widen and `=` narrow;
- the `probe-markers` and `worktree-layout` `wired` guards ×2 each;
- the two one-line `/* checks.push(...) */` source mutants.

**One mutant changed meaning.** QA 279's "widened real `git grep`" (to `OPEN_BRAIN_`) is now **equivalent**: every row is
re-filtered by `renameHookInSourceLine`, which needs the full name, so a wider grep cannot produce a false hit. Its widen
intent was replaced by a widened real-scan filter (keep comment rows), which is **red**.

### #445 findings

1. **F1, blocking (row 9b).** R-BF-21's real `git grep` has no positive control. A narrowed needle survives, with a real
   code-line hit planted. r3 also dropped the exit-status assert, so a failing `git grep` is green.
2. **F2, Low.** `t195-plan-gate.test.ts:153` is an unlisted raw-text scan of a `src` JSON file.
3. **F3, Low.** CC-19's two raw `cli` presence checks are unpaired.
4. **F4, Low.** The CC-19 and git.test cited ranges have drifted.

## #425 (rows 12–13): ACCEPT

### Row 12: union, nothing else: PASS

Each remerge-diff hunk is a conflict hunk, and each takes both sides.

**`setup-hooks.test.ts`:**
- The import now names `withCursorSessionEndHook` **and** `withCursorRecallHook`.
- Both describes are kept, closed separately: "Cursor sessionEnd (T-235 P2-4)" at L120 and "Cursor recall hook (T-235
  P2-5)" at L175.

**`setup-hooks.mjs`:** `withCursorSessionEndHook` (L142) and `withCursorRecallHook` (L169) are separate exports. The
merge only closes the first function body before the second's doc comment.

**`setup.mjs`:**
- It imports both functions plus `copyCursorSlashCommands` (L16).
- It defines both `OPEN_BRAIN_SESSION_END` (L25) and `OPEN_BRAIN_RECALL_TRIGGER` (L26).
- `main` (L305) calls `registerCursorHooks()` (L314), `registerCursorRecallHook()` (L315) and
  `installCursorSlashCommands()` (L316).

### Row 13: tests at head, each file on its own: PASS

`setup-hooks.test.ts` passes **19/19**, `setup-cursor-commands.test.ts` **8/8** and `t235-p2-5-cursor-recall.test.ts`
**5/5**. `tsc --noEmit` and `typecheck:tests` exit 0.

### #425 findings

- **F5, merge-order caution.**
  - #425 registers `cli-session-end.js` on Cursor's `sessionEnd`. Cursor also runs the `~/.claude/settings.json`
    `SessionEnd` hook.
  - On the **#425 head alone** (no #437 dedupe), my row-15 fixture ran `cli-session-end` **twice in 30/30** Cursor
    session ends: sequential in either order, and concurrent.
  - **#425 must not merge before a working #437.** With #437 rejected here, merging #425 alone would double every Cursor
    session end.

## The batch merge (rows 14–15): REJECT (rows pass; the batch contains two rejected heads)

### Row 14: order and outcome: PASS

- **The merge.** In `~/qa-scratch/qa280-merge`, starting from `origin/master` `1671d005`, I ran
  `git merge --no-ff` of `8e751360` (giving `d41e55fd`), then `1eea3cdb` (`c5d6b031`), then `260d6835` (`2cbfc317`).
  **There were no conflicts.**
- **Typechecks** on the merged tree: `tsc --noEmit` exit 0, and `typecheck:tests` exit 0.
- **Test files, one per run, all exit 0:**
  - #437: `cli-bootstrap` 16/16, `cli-session-end-dedupe` 2/2, `shared/session-hook-claim` 15/15.
  - #425: `setup-hooks` 19/19, `setup-scratch-home` 1/1, `setup-cursor-commands` 8/8, `t235-p2-5-cursor-recall` 5/5.
  - #445: `harness/s4-g5-qa` 22/22, `harness/shadow-merge` 43/43, `pipelines/bootstrap-fix-r4` 11/11,
    `pipelines/sync/probe-markers` 5/5, `pipelines/sync/worktree-layout` 6/6, `t048-r2b` 7/7.

### Row 15: one session end per Cursor session: PASS

**The dedupe test does not exercise the path #425 registers.**
- `cli-session-end-dedupe.test.ts` runs `src/cli-session-end.ts` through tsx, twice, with a hand-made payload.
- It never registers hooks, and it never runs the built `cli-session-end.js` through the command strings that
  `withSessionHooks` and `withCursorSessionEndHook` write.

**So I built the smallest fixture that does** (`~/qa-tmp/qa280/row15.mjs`):
- It builds the merged tree and uses the merged `scripts/setup-hooks.mjs`, as `setup.mjs`'s `registerCursorHooks` does:
  `withSessionHooks({}, OB)`, then `withCursorSessionHook`, then `withCursorSessionEndHook`.
- It writes `~/.claude/settings.json` and `~/.cursor/hooks.json` into a **scratch HOME**.
- It then runs the **exact registered command strings** through a shell, with the hook payload on stdin:
  - settings.json `SessionEnd`: `node "<OB>/build/cli-session-end.js"`;
  - hooks.json `sessionEnd`: `"<node>" "<OB>/build/cli-session-end.js"`.
- Cursor fires both (`active-session.ts:85-89`). Claude Code fires only settings.json.

| Case (merged tree) | Sessions or runs | `cli-session-end` ran past the gate |
|---|---|---|
| A. Cursor end (`cursor_version` present): hooks.json then settings.json, sequential | 10 | **exactly once in 10/10** |
| B. Cursor end: settings.json then hooks.json | 10 | **once in 10/10** |
| C. Cursor end: both commands concurrently | 10 | **once in 10/10** |
| D. Claude Code end (no `cursor_version`), settings.json only, twice per session id, 5 ids, plus one id Cursor had already claimed | 11 runs | **skipped 0/11**; every exit is 0 |

- The metrics file has 31 `claimed` and 30 `duplicate`, as expected.
- **Control: the same fixture on the #425 head alone** runs `cli-session-end` **twice** in 10/10 for each of A, B and C,
  and D is unchanged. So the fixture discriminates, and the single run on the merged tree comes from #437's gate.

**The batch merge verdict: REJECT.** Rows 14 and 15 pass on the merged tree, but #437 (row 5) and #445 (row 9b) are
rejected. The batch cannot be accepted as a whole.

## Findings summary

1. **#437 F1, blocking (row 5).** A crashed reclaim lock gives two claims at N=8 (3/300 plain, 4/100 instrumented).
   - Cause: the stat→unlink in the sweep (and in the lock breaker) can delete a **live** lock. That puts two processes
     in the lock, and the second steals the winner's fresh claim.
   - N=2 and N=3 are clean.
2. **#445 F1, blocking (row 9b).** R-BF-21's real `git grep` has no positive control. A typo'd needle stays green with a
   real hit in `src`. r3 also removed the status assert.
3. **#437 F2, Medium-High.** The PR's own N=8 barrier rows are vacuous: r2's no-lock order and skip-self both pass them,
   because children arrive late with the 400 ms offset.
4. **#425 F5, merge-order caution.** Without #437, a Cursor session end runs `cli-session-end` twice. Do not merge #425
   ahead of a working #437.
5. **Low:** #437 F3 (60 s lock TTL breaks a long live holder); #445 F2–F4 (t195 scan unlisted, CC-19 raw `cli` checks,
   two range drifts).

Working notes and drivers are in `~/qa-tmp/qa280/` (`p437/`, `p445/notes.md`, `row15.mjs`, `row15ctl.mjs`,
`merge-tests.mjs`). They are on Plumb and not committed.

QA-280: REPORT COMPLETE
