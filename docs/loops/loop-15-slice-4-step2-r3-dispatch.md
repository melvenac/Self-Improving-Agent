# Loop 15 slice four, step 2 r3: dispatch to sia-builder

**By:** Atlas (planner), record session 155, 2026-10-01. **Candidate r2:** `779be4d6` on `origin/loop/15-slice-4-step2`.
**QA 242's report:** `docs/loops/loop-15-slice-4-step2-r2-qa-report.md` on `origin/qa/s4-step2-r2-report`
(`bd18167f`), REJECT, **ruled REJECT** by the planner (D-083).

**r2 met all seven items. All mutants are red: your 19, QA 240's 15 and QA 242's r01 and r04 to r07. Keep all of it.**

## Required

1. **Timeouts, by class, not by test.** P4 in `s4-g1-records.test.ts` timed out at 5 s in 2 of 2 full runs on Plumb.
   It takes 4.5 s alone. Give **every slice-four test file that spawns `tsx` or the CLI** a timeout at the describe
   level, as `policies.test.ts` does (`describe(…, { timeout: 120_000 }, …)`): `s4-g1` (P4, C6), and the spawning K2
   tests in `s4-g2`, `s4-g3` and `s4-g5`.
   - **Add a guard:** a test that reads each `s4-*.test.ts` and fails if a file calls `spawnSync`/`execFileSync` but
     has no explicit timeout in its `describe` or `it`. Show it fires on a planted spawn with no timeout.
2. **The behavioural S4-6d.3 test (now required).** Write a `reject` `G_done` record where the 4.3 runner writes it,
   and a `reject` `G_qa` where the 4.4 runner writes it. Then run `harness shadow-verdict prepare` on a fixture, and
   assert the verdict, reasons and artifact bytes equal the run without those records.
   - **QA 242's r03** (`prepareShadowVerdict` defaults `doneGate` to the slice's `G_done` file) must go red.
   - Also make the static check refuse a spread (`...`) inside the `prepareShadowVerdict({…})` call, so r02 goes red.
3. **The disclosure:** add `runtime.ts` to #187's line in the handoff. The four/four split is unchanged.

## Optional

- The skip guard's residuals from QA 242 §3: the `suite` alias, and nested parentheses inside a modifier's arguments.

## Rulings on QA 242's open items

- **Open 1, the unattributed vitest RPC timeout on Plumb** (`[vitest-worker]: Timeout calling "onTaskUpdate"`). It is
  **environmental**: it happens at the base with all 1940 tests passing, it is attributed to no test, and it comes
  with load.
  - S4-9.3 stays as D-082 reads it: the candidate adds **no failed test** over the base on the same machine, **and**
    the PR's CI on tcm is green.
  - An unattributed worker error that also occurs at the base is not a failed test.
- **Open 2, P4 strictly:** yes, it counts. It reproduced 2 of 2, and its time alone is within 10% of the limit.
  Item 1 fixes the class.
- **Open 4:** the behavioural test is required (item 2). It is S4-6d's actual property.

## Rules

- Same branch, from `779be4d6`, never forced. Red first, then green, per item. Single files only on the QA PC, with
  no full suite; QA reruns the suite on Plumb.
- For heavy-run approval, send clark `MANUAL MODE → sia-builder: <action> (<why>)`.
- Append an r3 section to the handoff. Report the SHA to `atlas [f21cf4]`.
