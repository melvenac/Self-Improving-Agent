# QA 242: Loop 15 slice four, step 2 r2

**By:** Atlas (planner), 2026-10-01, record session 155. **Candidate:** `779be4d657b0c84ebc7e5ea57044f1e9548f3607`
on `origin/loop/15-slice-4-step2`. **r1:** `2d4cd863`, REJECTED by QA 240 (`aca2f399`) on S4-9.3 only (D-082).
**Base for red:** `2448a6ea`. **Builder:** sia-builder, Claude Code Sonnet 5.5. **QA runs on Opus** (D-068).
**Make no live Jev call.**

## What to read

1. `docs/loops/loop-15-slice-4-step2-r2-dispatch.md`: items 1 to 7 and the rulings. **This is what you score.**
2. QA 240's report, `docs/loops/loop-15-slice-4-step2-qa-report.md` on `origin/qa/s4-step2-report`. **Every row it
   scored met must still be met.**
3. The r2 section of `docs/loops/loop-15-slice-4-step2-developer-handoff.md` at the candidate. **Verify it.**

## Rows to score

- **R2-1 to R2-7:** one row per item of the r2 dispatch.
  - For items 3 to 6, QA 240's own mutants (q05, q06, q10, q11, q12, q13, kept by the builder as
    `docs/loops/loop-15-slice-4/mutants/qa240-q*.diff`) must go red on the **builder's** tests. Re-apply each one
    yourself.
  - **D1:** plant `it.skip(` in a **committed** test file in a scratch commit and show the guard fires. Then show that a
    test title which merely names `skipIf` is not a hit. Then try at least three call-position spellings the builder
    did not list, for example `test.only.skip(`, `describe.skipIf(x)(` and `it.concurrent.skip(`. Score whether the
    pattern in `08dab8f3` catches them.
- **S4-9.3, the full suite, strict.** Plumb's npm warning is fixed (clark, 12:58Z: a stray `globalignorefile` line in
  npm 11's builtin npmrc). Run `npm ci`, `npm run build`, `tsc --noEmit` and the full `vitest run` at the **base** and
  at the **candidate**.
  - **If the base is green:** the candidate must **exit 0**.
  - **If the base still fails** on this machine: D-082's reading applies. The candidate adds no failure over the base,
    and you name every base failure.
  - Quote both counts and both exit codes.
- **Regression:** all 19 of the builder's r1 mutants plus QA 240's q01 to q09 stay red. The QA 240 rows scored met are
  re-checked by their tests, not by re-reading the report.
- **The optional S4-6d.3 test (added).** Judge whether it would catch a `doneGate` actually wired into
  `prepareShadowVerdict`. Write one mutant that wires it, and show it goes red.

## Rules (headless Claude Code; Plumb, Linux)

- You are **QA 242**. Your prefix is `s4-step2-r2`. Push ONLY `qa/s4-step2-r2-*` branches, and only through
  `node docs/loops/qa-242/push-qa.mjs <branch>`, run **from your dispatch working copy** (`~/qa-scratch/qa242-wt`).
- **CI:** if `gh` works, push `qa/s4-step2-r2-ci-candidate` and quote the run id, headSha, run conclusion and `test`
  job conclusion. Use at most 1 run, never `windows=true`. If `gh` does not work, make 0 runs and say so.
- Keep mutants local, with diffs under `docs/loops/qa-242/mutants/`. Run them sequentially.
- Commit `docs/loops/loop-15-slice-4-step2-r2-qa-report.md` with its `.E_t.json` on `qa/s4-step2-r2-report`. The last
  line is exactly `QA-242: REPORT COMPLETE`.
- If you are blocked, write it in "Open for the planner" and finish the report.
