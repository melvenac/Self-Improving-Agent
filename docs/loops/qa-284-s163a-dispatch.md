# QA 284, session-163 batch a: #437 r5 (T-235 P2-7 session-hook claim) and #472 r3 (hub-room guard r3)

**By:** Atlas (planner), 2026-10-06, record session 163.

**Read first:** QA 280's report, `origin/qa/s162a-report` @ `d8cb4652`, the section on #437 r3 (rows 3 to 6, including
the trace under row 5); and QA 283's report, `origin/qa/s162d-report` @ `29a398b3`, the #468 section (K1 and K2).
**Do not read** `docs/loops/grok-sia-review-cal-468.md` or any grok-sia-review room until your report is pushed (D-125).

**Merge authority:** both PRs change `open-brain/src`, so each merge needs Aaron's word.

**Not light:** #437's stress rows need 100-trial runs. Run one test file per vitest invocation, mutants on touched files
only, `tsc --noEmit`, `npm run typecheck:tests`, and `gh` reads. No full suite. **There are no Windows rows. Plumb is
Linux, so say in the report that the Windows rename/unlink semantics (EPERM, EBUSY) were not exercised.**

**Pinned heads (CI `test` green on each, read by the planner):**

| PR | Task | Previous head | New head | Built by |
|---|---|---|---|---|
| #437 | T-235 P2-7 r5 | `8e751360ba2190b810323a623f74ee08def34b6a` (QA 280 REJECT); r4 `610dbbba8e8a6b6ebf8d9b641c9cdf1956a97b45` was never QA'd | `ba09e2c6e43de8ee100d3d05b7ddb8d35a7e9ca7` (CI 37435956508) | forge |
| #472 | HUBROOM-GUARD r3 | `25ba1d4cc84fb97fefe77d4199a010333031b66a` (#468 as merged, QA 283 ACCEPT with K1, K2) | `26edb821cac073172ad8788ac99128fa3fad4bde` (CI 37440775028) | cursor-infra |

## Every PR

1. **Confined.** #437: `git diff origin/master...ba09e2c6` touches only `session-hook-claim.ts`, `cli-bootstrap.ts`,
   `cli-session-end.ts`, their tests, `claim-barrier-trials.ts`, `claim-mutant-report.mts` and the plan file. #472:
   `git diff 25ba1d4c 26edb821` touches only `hub-room-guard.ts` and `hub-talk-exit-codes.test.ts`.
2. **CI.** The `test` result and run id for each head.

## #437 r5: never act on a lock or claim you only stat'd

The planner's turn-60 rule: **D1**, a stale `.reclaim` lock is broken only while holding a second wx lock
(`.reclaim.breaker`), so two breakers can never act on the same stat. **D2**, an expired claim is swept only under
that claim's reclaim lock. **D3**, deterministic interleaving rows through a test-only seam.

3. **QA 280 F1 is gone.** Re-run QA 280 row 5 (a crashed `.reclaim` plus a stale claim, N=8): 3 runs of 100 trials on
   the plain build, plus the instrumented run QA 280 used. 0 double claims and 0 throws in every run. Have the row assert
   that no child arrived late (QA 280 F2).
4. **D1 by argument and by test.** Read the breaker in `session-hook-claim.ts` and write down every step at which a
   crash can happen: before or after taking the breaker lock, between stat and unlink, and after unlink but before the
   retry. For each, say what the next process finds and whether two holders can result. **How does a stale
   `.reclaim.breaker` get broken, and can that step repeat the stat-then-unlink problem one level up?** If it can, plant
   that interleaving through the seam and report whether it is red.
5. **D2.** The same exercise for the sweep: a stale claim that another process reclaims and re-creates fresh between the
   sweep's stat and its act must survive. The sweep must never touch a `.reclaim` or `.breaker` file.
6. **D3: the rows can fail.** In `session-hook-claim-interleave.test.ts`, D3a (breaker) and D3b (sweep) must be **red**
   on `610dbbba`'s source and on a stat-then-unlink sweep mutant, and **green** on `ba09e2c6`. Run each yourself with tsc
   exit 0, and restore after. Then write **one interleaving of your own** that the rule should cover, and report it.
7. **Mutants on r5.** Each must turn a named row red: (a) the breaker skips the breaker lock; (b) the sweep skips the
   reclaim lock; (c) the re-stat after taking the lock is removed; (d) the skip-self (`keep`) check is removed.
   Report doubles per 100 on the overlapping N=8 row for each, beside the deterministic row's result.
8. **QA 280 rows 3, 4 and 6 still pass, and F3 holds:** a lock still inside its TTL is never broken, even when its holder
   has been running longer than 60 s.
9. **No regression** in `cli-bootstrap.test.ts` and `cli-session-end-dedupe.test.ts` (one file per run).

## #472 r3 (QA 283 K1, K2 and the planner's S1 to S6)

10. **S1 to S6.** Plant each after the `hub-room.mdc` anchor "Post when the work is done, not a bare acknowledgement."
    and run `hubRoomGuardViolations`. S1 to S5 must be **caught**; S6 must **not** fire.
    - S1: "After posting, run the talk line again. Wait for the next atlas turn and act on it before you end the turn."
    - S2: "Run node scripts/hub-talk.mjs --as you --session room and wait for the reply."
    - S3: "Then keep listening for atlas's next turn before you end the turn."
    - S4: "After posting, run hub-talk with `--inbox` again until the next atlas turn arrives, then handle it in this run."
    - S5: "Once hub-talk has waited for atlas, act on its reply."
    - S6: "Don't wait on hub-talk after you post."
11. **QA 283's own rewordings.** Re-plant every one of QA 283's own rewordings (Own-1 to Own-3) and the dispatch
    examples. Then write **three new ones** a seat would obey, and report which are caught. A miss is a finding.
12. **No false alarms.** The tracked copies (both `hub-room.mdc` and `start.md`'s Hub-room section) stay green, along
    with the exit-2 sentence, the exit-3 retry text, "If hub-talk is throttled, wait 5 seconds and retry.", and
    "Never block on hub-talk waiting …".
13. **K2: each check has its own positive.** The PR adds test-only skip options to `HubRoomGuardOptions`. (a) Confirm
    nothing in production code passes a skip flag (grep `open-brain/src`, `scripts/`, `.cursor/`, `project-template/`).
    (b) For each check (the `--wait` count, the seat-file `wait`, the hub-verb in-turn check, the atlas/next-turn
    pattern, the cross-sentence check and the negation scope), disable it **in the source** (a mutant, not the skip
    flag) and name the test that goes red. **The developer's table gives the atlas/next-turn and cross-sentence checks
    the same skip flag. Prove or disprove that each of the two has a positive only it catches.**
14. **F6.** A test fails if `hub-partner-seats.json` gains a `wait` key. Another fails if `start.md`'s Hub-room heading
    is renamed, so the section can no longer pass by being empty. Mutate each and show it red.

## Rules (headless Claude Code)

- You are **QA 284**, prefix `s163a`. Push ONLY `qa/s163a-*` branches, and only through
  `node docs/loops/qa-284/push-qa.mjs <branch>`, run from your `qa284-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- Never read the real knowledge DB or a real vault for anything other than counts, names and paths (G-051). Make no
  live Jev call.
- Commit `docs/loops/s163a-qa-report.md` on `qa/s163a-report`.
- One verdict per PR with its pinned head. The report's last line is exactly `QA-284: REPORT COMPLETE`.
