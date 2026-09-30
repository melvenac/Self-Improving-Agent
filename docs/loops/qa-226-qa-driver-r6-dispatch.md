# QA 226: record 192 r6 (the Cursor QA driver's REAL template delivers the prompt's quotes intact)

**Read `docs/loops/qa-222-225-common.md` first**, for the rows, mutants, evidence file and report rules. **Two exceptions:**
1. **Run on the LAPTOP (DESKTOP-0GV3HAD),** where the quote drop was first seen.
2. **No CI.** This is local PowerShell. Set `runtime_checks` from your harness runs.

Prefix `qa-driver-r6`. Report `docs/loops/qa-driver-cursor-r6-qa-report.md` on `qa/qa-driver-r6-report`. Never touch `%USERPROFILE%\Worktrees\sia-qa` beyond reading it.

## The candidate

- `origin/loop/qa-driver-cursor-r2` at **`d3d8e8f`** (infra has pushed it; take the exact SHA from `ls-remote` and quote it). It is one round over r5 `bbfb724`.
- Built by Composer (`cursor-infra`).
- **What changed:** the PRODUCT template `docs/loops/qa-driver-template-cursor/drive.ps1` now starts `cursor-agent`'s node through `ProcessStartInfo` quoting, including `--resume`. A new harness script, `docs/loops/qa-driver-cursor-r6-quote.ps1`, checks it.
- **The developer's mutant:** `loop/qa-driver-cursor-r6-mutant-splat` `69e5231`, which restores `& $ps @agentArgs`.
- **Read QA 218's report first** (`qa/qa-driver-r5-report` `2612015`, section 5). It found the template defect.

## Score

1. **On THIS laptop,** a driver generated from the r6 template delivers `stops.txt`'s quoted span (`"Open for the planner"`) byte for byte, in the first user event AND in a resume prompt. **Quote the event text.** Also show that r5's template (`bbfb724`) drops the quotes here.
2. **The mutant:** `69e5231` goes red on (1).
3. **Preserved:** completion, resume-at-most-3, refusal and denial handling, and the `drive.meta` keys other tools read. `qa-driver-copy.mjs` still produces a driver that parses and runs.
4. **Anything else the route loses:** find any other character PowerShell 5.1 would mangle on this route (for example `$`, a backtick, or `&`), and try it.
5. At least one mutant of your own, on `qa/qa-driver-r6-mut-*`.

**The LAST line is exactly `QA-226: REPORT COMPLETE`.** Push only `qa/qa-driver-r6-*`, through `node docs/loops/qa-226/push-qa.mjs`.

**A known master-red issue that is not this candidate's:** `tests/shared/state-schema.test.ts` T-171 r3b fails anywhere that reads origin/master's current `state.json`. A fix is in flight. If you run the suite, **do not count it against this candidate.**
