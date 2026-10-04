# QA 279, session-161 batch g: narrow re-runs of five rejected or must-fix PRs

**By:** Atlas (planner), 2026-10-04, record session 161. Under AMBER: this job unblocks merges and is LIGHT.

**Read first:** the earlier reports' sections for each PR. QA 275 = `origin/qa/s161c-report` @ `2dc5f114`; QA 277 =
`origin/qa/s161e-report` @ `7d34d8bb`; QA 278 = `origin/qa/s161f-report` @ `e689bd3f`. Each re-run below is NARROW:
the rows those reports failed, plus confinement (r(n-1) to r(n) diff) and CI. Rows that passed are not repeated.

**Merge authority:** none pre-approved. An ACCEPT waits for Aaron's batch approval, through clark.

**Builder model (G-055):** every head below was built on `grok-4.7-high` (named by each seat from `store.db`). QA is
Opus, so builder ≠ judge holds.

**LIGHT:** one test file per vitest invocation, mutants on touched files only, `tsc --noEmit`,
`npm run typecheck:tests`, `gh` reads. No full suite. No Windows rows. Set `npm_config_cache` under your tmp folder.

**Pinned heads (CI `test` green on each, read by the planner):**

| PR | Task | Previous QA'd head | New head |
|---|---|---|---|
| #427 | T-235 P2-3 r4 | r3 `a6d75b52` (QA 277/278 ACCEPT) | `9daf38d8cdb575f6c51f9b30d43f96126c7a8eb4` |
| #434 | T-240 r2 | `12f26320` (QA 275 REJECT) | `b9f8a5dfc2437b3d35049df691dd85483424e950` |
| #437 | T-235 P2-7 r2 | `23d46156` (QA 275 REJECT) | `3dfa24245cd1b3b99344cd2d675735bc608d04c8` |
| #444 | T-168 r3 | `a5f11819` (QA 277 REJECT) | `9bfb2e1e78cc1701394988cc9c65288af4269582` |
| #445 | T-156 r2 | `d292747f` (QA 277 REJECT) | `43ed65a9f2e55b649b4bd1dbb46baddc84d3e0e6` |

## Every PR

1. **Confined.** `git diff <previous head> <new head>` lists only files in the task; name any other.
2. **CI (read only).** The `test` result and run id for the new head.

## #427 r4: the forged-table seam (QA 278 O2, QA 277 F1)

3. `OPEN_BRAIN_PROCESS_TABLE` has zero hits in `open-brain/src`, and nothing else in `src` reads a process table from
   env, a file or a global (grep for `process.env` in `process-session.ts`, `cli-bootstrap.ts` and `server.ts`).
4. With `OPEN_BRAIN_PROCESS_TABLE=json:<a table naming a foreign live pid as a cursor-agent host>` set in the hook's
   environment, and no real host, the hook writes NO proof. The var is ignored.
5. Every failure-kind row from r3 still passes with the loader injected through a parameter. A mutant that removes
   the catch is still red. QA 278's O1: a spawn failure's reason reads as the spawn error, not `exit null`.

## #434 r2 (QA 275 row 6, row 9 nit)

6. A seat row with no `runtime` (another seat's, not the reader's): the SEATS line shows that seat as missing its
   runtime, visibly. A waker seat never prints `hub listener: not polling`. Rows exist for both.
7. `/sync` hub-seats: a cursor seat with `dispatch.cursor.room` deleted is an issue even if a top-level `room` exists;
   two differing copies are an issue; the top-level `room` is removed from the map, and no reader still uses it.
8. `shared.md`'s switch procedure names the waker stop and start commands (or plainly says Aaron runs them), and each
   command named exists in the tracked tree or the A2A seat-setup doc.

## #437 r2 (QA 275 rows 14 and 17, plus its M2 mutant)

9. **Race row can fail.** QA's M1 (read-then-write) goes red on the new barrier race row. Run it yourself.
10. **Stale reclaim.** Your own barrier (a claim pre-created with an old mtime), 100 trials: zero double claims, zero
    throws. Read the reclaim code: rename-to-tombstone, then `wx`; an `ENOENT` or `EPERM` loser returns duplicate.
11. **M2 at the `cli-session-end` call site** is red.
12. **Cleanup** deletes only claims older than the TTL, at most 32 per call, never the path being claimed.

## #444 r3 (QA 277 row 16 and F2)

13. **Owner per D-119.** Under injected ancestry: a cursor-agent host ancestor is chosen; under Claude Code, the
    `claude.exe` session. `process.ppid` is never chosen as the owner. With no owner and no `--owner-pid`, the run
    refuses with the reason in the meta. Confirm the walk STARTS at `process.ppid` but never adopts it.
14. **Any non-zero take refuses**: exits 10, 11 and 2 each refuse; a missing win32 helper refuses unless
    `SUITE_LEASE_OPT_OUT=1`. A lease already held by the same resolved owner runs without take or release.
15. The meta records `owner_pid`, `owner_source`, `lease_take_exit` and `lease_release_exit`.
16. The resolver is behind an interface until #427 merges. Say whether it duplicates #427's matcher or calls it.

## #445 r2 (QA 277 row 19)

17. **Completeness.** The list now includes `shadow-merge.test.ts:314-339`, `t048-r2b.test.ts:194-205`,
    `bootstrap-fix-r4.test.ts:137-143`, `harness/checks.test.ts:141-160` and `harness/s4-g2-key.test.ts:236-241`.
    Re-run your own grep for source scans over `open-brain/tests` and report any still missing. Markdown readers sit
    under "out of scope: reads docs".
18. Each newly paired scan: a mutant that widens or narrows its pattern goes red. QA 277's F3 (M11, a one-line
    `/* */` comment) is now red in `probe-markers` and `worktree-layout`.

## Rules (headless Claude Code)

- You are **QA 279**, prefix `s161g`. Push ONLY `qa/s161g-*` branches, and only through
  `node docs/loops/qa-279/push-qa.mjs <branch>`, run from your `qa279-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config and key files report only counts, names, paths and hash match/no-match, never values (G-051).
- Commit `docs/loops/s161g-qa-report.md` on `qa/s161g-report`.
- One verdict per PR with its pinned new head. The report's last line is exactly `QA-279: REPORT COMPLETE`.
