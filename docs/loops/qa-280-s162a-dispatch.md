# QA 280, session-162 batch a: narrow re-runs of #437 r3 and #445 r3, #425 after its conflict, and the batch merge

**By:** Atlas (planner), 2026-10-05, record session 162. Aaron ruled in the planner's window on 2026-10-05: "Fix both
and send them back to QA" (#437 and #445, rejected by QA 279).

**Read first:** QA 279's report, `origin/qa/s161g-report` @ `8396ffbc`, `docs/loops/s161g-qa-report.md`, the sections
"#437 r2 (rows 9–12)" and "#445 r2 (rows 17–18)". Each re-run below is NARROW: the rows QA 279 failed, the evidence
the fix claims, confinement and CI. Rows that passed are not repeated unless a row says so.

**Merge authority:** none pre-approved. An ACCEPT waits for Aaron's word in the planner's window.

**Builder model (G-055):** every head below was built by a Cursor seat launched with `--model composer-2.5`, as the
waker logs record (D-046(a)). The `store.db` chat model a seat reports can be stale (forge's reads `grok-4.7-high` from
the chat's 10-04 metadata, while its waker log shows composer-2.5 on this run). QA is Opus, so builder ≠ judge holds
either way.

**LIGHT:** one test file per vitest invocation, mutants on touched files only, `tsc --noEmit`,
`npm run typecheck:tests`, `gh` reads. No full suite. No Windows rows. The N=8 barrier rows are the only heavy part:
run them in your own scratch tree, nowhere else.

**Pinned heads (CI `test` green on each, read by the planner):**

| PR | Task | Previous QA'd head | New head |
|---|---|---|---|
| #437 | T-235 P2-7 r3 | r2 `3dfa24245cd1b3b99344cd2d675735bc608d04c8` (QA 279 REJECT) | `8e751360ba2190b810323a623f74ee08def34b6a` |
| #445 | T-156 r3 | r2 `43ed65a9f2e55b649b4bd1dbb46baddc84d3e0e6` (QA 279 REJECT) | `260d68352fb89030a92029eae56053d00ed3f7d0` |
| #425 | T-235 P2-4 | `9fcb97ca8bb266c03cef7501c4b2b831c8d1601b` (accepted earlier) | `1eea3cdb3740690078fb2254b8c8b41887c3b3cd` (merge of master `2f8e6489`) |

## Every PR

1. **Confined.** `git diff <previous head> <new head>` lists only files in the task; name any other. For #425 use
   `git show --remerge-diff 1eea3cdb` instead: the merge may change ONLY its conflict hunks.
2. **CI (read only).** The `test` result and run id for the new head.

## #437 r3: the stale reclaim (QA 279 row 10)

The seat's mechanism: a `wx`-created reclaim lock on `claim.reclaim`; the stat and the rename happen only while the
lock is held; no put-back. Read `src/shared/session-hook-claim.ts` and `docs/loops/t235-p2-7-plan.md` at the head.

3. **Your own stale barrier**, built the way QA 279 built it (a claim pre-created with an old mtime, all processes
   released together): N=2, N=3 and N=8, 100 trials each, and N=8 three times. Zero double claims and zero throws on
   every run, or the row fails.
4. **The window cannot reopen.** By reading the code, then by mutant: (a) the reclaim without the lock (r2's order) is
   red on your N=8 row; (b) a put-back or rename that overwrites is red; (c) QA 279's skip-self mutant, which SURVIVED
   at 33/100 on r2, is now red **on a concurrency row**, not only on a single-process row. Report which row turns red
   for each.
5. **The new lock's own failure modes.** A reclaim lock left behind by a crashed process (create `claim.reclaim` by
   hand, old mtime): a later claimer still gets the claim, exactly one of N=8 does, and the leftover lock is cleared or
   aged out. A fresh lock held by a live process is never broken. Say what the lock's TTL is and where it is set.
6. **Rows 9, 11 and 12 still pass** (QA 279's M1 race row red; the `cli-session-end` call-site mutant red; the sweep
   deletes only stale claims, at most its cap, never the path being claimed). The seat says it added a sweep cap of 40
   that leaves 8: check that against the code.

## #445 r3: the scan list (QA 279 row 17, F1 to F4)

7. **F1, CC-19 paired.** At the head, QA 279's SRC-SM-C (a `//` comment naming `prepareShadowVerdict` in `runtime.ts`)
   is **green** on CC-19, and a real reintroduced import and call are **red**. Also try a `/* */` comment: green.
8. **F2, doc readers.** All five readers QA 279 named are under "Out of scope: reads docs", and the two borderline ones
   are decided either way with a reason. Re-run your own grep for source scans over `open-brain/tests` at the head, and
   report any scan still neither paired nor listed with a reason.
9. **F3, R-BF-21 controls the real scan.** A `//` near-miss in a real `src` file stays **green**, and a narrowed
   (typo'd) needle in the real `git grep` turns **red**. The seat reported the first and not the second: run both.
10. **F4, ranges.** Every cited range in `docs/loops/t156-scan-list.md` matches the scan at the head (spot-check at
    least six, including CC-0, CC-19, R-BF-21 and D4).
11. **Row 18 holds.** QA 279's 16 widen and narrow mutants are still red.

## #425: the conflict resolution

12. **Union, nothing else.** In the remerge-diff, every hunk keeps both sides: `withCursorSessionEndHook` (P2-4) and
    `withCursorRecallHook` (P2-5) as separate exports; `setup.mjs` imports both plus `copyCursorSlashCommands`, and
    defines both `OPEN_BRAIN_SESSION_END` and `OPEN_BRAIN_RECALL_TRIGGER`; the test file keeps both describes.
    `main` in `setup.mjs` calls `registerCursorHooks`, `registerCursorRecallHook` and `installCursorSlashCommands`.
13. `setup-hooks.test.ts`, `setup-cursor-commands` tests and `t235-p2-5-cursor-recall` tests pass at the head, each
    file on its own.

## The batch merge

14. **Order and outcome.** In `~/qa-scratch/qa280-merge`, start from `origin/master` and merge #437's head, then
    #425's, then #445's, with `git merge --no-ff`. Report every conflict (there should be none). On the merged tree:
    `tsc --noEmit`, `npm run typecheck:tests`, and the test files of all three PRs, one file per run.
15. **One session end per Cursor session.** On the merged tree, with both Claude Code's and Cursor's session-end hooks
    registered (as `setup.mjs` now does), a Cursor-shaped session end runs `cli-session-end` exactly once, and a Claude
    Code session end (no `cursor_version`) is never skipped. Use #437's dedupe test file and say whether it exercises
    the path #425 registers; if it does not, build the smallest fixture that does.

## Rules (headless Claude Code)

- You are **QA 280**, prefix `s162a`. Push ONLY `qa/s162a-*` branches, and only through
  `node docs/loops/qa-280/push-qa.mjs <branch>`, run from your `qa280-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config and key files report only counts, names, paths and hash match/no-match, never values (G-051).
- Commit `docs/loops/s162a-qa-report.md` on `qa/s162a-report`.
- One verdict per PR with its pinned new head, and one for the batch merge. The report's last line is exactly
  `QA-280: REPORT COMPLETE`.
