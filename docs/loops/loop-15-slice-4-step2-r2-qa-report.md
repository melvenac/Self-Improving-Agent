# Loop 15 slice four, step 2 r2: QA report (QA 242)

**By:** the QA seat, record session 242, 2026-10-01, on **Plumb** (the Linux QA seat), headless Claude Code on Opus 5.5
(D-068). **Dispatch:** `docs/loops/qa-242-s4-step2-r2-dispatch.md` at the launch-line SHA `321f3424`.
**Worktree:** `~/qa-scratch/qa242-wt`, detached at `321f3424a45536d927a1d7b7740e651ca51eb46f`
(`git -C ~/qa-scratch/qa242-wt log -1 --format=%H`). **Candidate:** `779be4d657b0c84ebc7e5ea57044f1e9548f3607`
(`origin/loop/15-slice-4-step2`, read back by `git rev-parse`). **r1:** `2d4cd863`. **Base:** `2448a6ea`.
**Scratch trees:** `~/qa-scratch/qa242-cand` (candidate) and `~/qa-scratch/qa242-base` (base), both detached.
`TMPDIR=~/qa-tmp`. Toolchain: node v22.22.1, npm 11.21.0.

**No live Jev call was made.** Every command ran through `docs/loops/qa-242/tools/qa242-run.mjs`,
`qa242-mut.mjs` or `qa242-d1-commit.mjs`. Each builds its child's environment from scratch (`HOME`, `PATH`,
`TMPDIR`, `CI`, a scratch `KNOWLEDGE_V2_DB`) and never spreads `process.env`, so no `TYPESAFE_API_KEY` could reach
anything that ran.

## Verdict: REJECT

All seven r2 items are met. Every QA 240 mutant the dispatch names goes red on the builder's own tests, and the
regression set holds: 19 of 19 builder mutants and q01 to q09 are red. **S4-9.3 is unmet.** The base is not green on
Plumb, so D-082's reading applies, and under it the candidate **adds one failure over the base**:
`s4-g1-records.test.ts` › **P4** hits vitest's default 5 s timeout. It did so in **both** full candidate runs. It is the
same class of defect as D2: a test that spawns `tsx` three times with no per-test timeout, and it takes 4.5 s even when
run alone on an idle machine. The fix is test-side and one line (see §8).

## 1. S4-9.3: the full suite, strict

Run in `open-brain/` with the constructed env. Clark's npm fix holds: `tests/trigger/hook.test.ts` passes 12/12 at
base and candidate, so the 9 environmental failures QA 240 saw are gone.

| | npm ci | npm run build | tsc --noEmit | vitest run | Test files | Tests | Errors |
|---|---|---|---|---|---|---|---|
| base `2448a6ea`, run 1 | 0 | 0 | 0 | **1** | 137 passed (137) | **1940 passed**, 5 skipped (1945) | 1 |
| base `2448a6ea`, run 2 | | | | **1** | 137 passed (137) | 1940 passed, 5 skipped (1945) | 1 |
| candidate `779be4d6`, run 1 | 0 | 0 | 0 | **1** | 1 failed, 143 passed (144) | **1 failed, 2072 passed**, 5 skipped (2078) | 1 |
| candidate `779be4d6`, run 2 | | | | **1** | 1 failed, 143 passed (144) | 1 failed, 2072 passed, 5 skipped (2078) | 1 |

Durations: base 454.2 s and 441.7 s; candidate 502.4 s and 471.1 s. Machine load average was about 3 when the runs
began. The summary lines are in `docs/loops/qa-242/results/j-full-suite-lines.txt`.

- **The base still fails on this machine, so D-082's reading applies.** Every base test passes, but vitest exits 1 on
  one **unhandled error**, `[vitest-worker]: Timeout calling "onTaskUpdate"`, in both base runs. It is a
  worker-to-main RPC timeout, and vitest does not attribute it to any test. The same error appears in both candidate
  runs. It is the only base failure, so it is the one this report names.
- **The candidate adds one failure: `s4-g1-records.test.ts` › S4-4a › "P4 `harness validate gate-record` exits 0 on a
  good record and non-zero on a hand-written bad one".**
  - The error is `Test timed out in 5000ms.`, at `s4-g1-records.test.ts:143`. It failed in run 1 and again in run 2.
  - P4 makes three sequential `spawnSync(process.execPath, [TSX, CLI, …])` calls. The spawn helper sets its own
    `timeout: 120_000` (line 44), but the `it(...)` sets none, and `vitest.config.ts` sets none, so the test gets
    vitest's 5 s default.
  - Alone on an idle machine it takes **4489 ms**, and C6 (two spawns) takes 2953 ms
    (`node vitest.mjs run tests/harness/s4-g1-records.test.ts`, JSON reporter). Under full-suite load P4 goes over 5 s.
  - With `--testTimeout=120000`, P4 passes, both in the 190-test control set and in every mutant run.
  - P4 was added at r1 and r2 did not touch it. QA 240's r1 run happened to pass it, which is why nobody named it until
    now. It is still a failure the candidate adds over the base on the same machine.
- **D1 and D2 are fixed.** `s4-guards` passed 11/11 and `s4-g4-reconstruct` passed 45/45 (12.5 s) in both candidate
  runs.

**Counts.** The candidate passed 2072 tests against the base's 1940, and failed 1 against 0.

## 2. Rows

| Row | Score | Evidence |
|---|---|---|
| R2-1 (D1) | **met** | §3 |
| R2-2 (D2) | **met** | R6 now ends `}, 120_000);` (`s4-g4-reconstruct.test.ts:149`). `s4-g4` passed 45/45 in both full candidate runs (12.5 s for the file), against R6's 14.2 s fail in QA 240's run. |
| R2-3 (G3) | **met** | q05 is red on `s4-g5` R9 and q06 is red on `s4-g3` D9. Both use a `t195` loop and assert `source: "seat"` in the returned record and in the file on disk. |
| R2-4 (G4, G5) | **met** | q10 is red on C7 and q11 is red on C8(auth). QA 242's r04, r05 and r06 make `request-invalid`, `unexpected-status` and `malformed-response` retryable in turn. Each is red on its own C8 case, and r04 is also red on C3. C9 confirms the three retryable outcomes still pass. |
| R2-5 (G6) | **met** | Both files are in `THRESHOLD_SCAN_TARGETS`, and the list assertion in `policies.test.ts` was updated. q13 (a literal in `shadow-qa.ts`) is red on Q8, Q5 and `policies` A6. QA 242's r07 plants `0.4` in `shadow-gates.ts`'s `decideDoneGate` call and is red on the same three. |
| R2-6 (G7) | **met** | q12 is red on `s4-g3` D8 **and** `s4-g5` R10 without `gate-live.test.ts` in the run set: `transport`, fetch reached once, `countAttempts().total === 1`. |
| R2-7 (disclosure) | **met**, with one residual | §4 |
| S4-9.3 | **unmet** | §1: the candidate adds the P4 failure over the base, in 2 of 2 runs. |
| Regression | **met** | §5: 19/19 builder mutants and q01 to q09 are red. QA 240's scored rows are re-checked by their tests. |
| S4-6d.3 (optional test) | **partial** | §6: it catches a `doneGate` written into the CLI call (r01 red). It misses one passed by spread (r02) and one wired inside `prepareShadowVerdict` itself (r03). |
| CI | **0 runs** | `gh` is not installed on Plumb (`which gh` exits 1). No `qa/s4-step2-r2-ci-*` branch was pushed. |

## 3. R2-1 (D1): the skip guard, in call position

The pattern as committed (`08dab8f3`) is
`\b(it|test|describe)(\.\w+(\([^)]*\))?)*\.(skip|todo|skipIf|runIf)\b`.

- **The guard fires on a committed plant in the real tree.**
  - Tool: `tools/qa242-d1-commit.mjs`, with results in `results/h-d1-committed-plants.json`.
  - Method: in `qa242-cand`, a scratch commit appends lines to the tracked
    `open-brain/tests/harness/s4-g6-closeout.test.ts`, then runs `s4-guards -t S4-9.2`. After each step the tree is
    reset to `779be4d6`. It ended at `779be4d6`, clean. Nothing was pushed.

  | Scratch commit | Planted | S4-9.2 |
  |---|---|---|
  | `136ed863` | `it.skip("qa242 planted", …)` | **failed**: `expected [ Array(1) ] to deeply equal []` (line 107) |
  | `626e1fa7` | `it("qa242 names skipIf, runIf, todo and skip in a title", …)` | **passed**: a title is not a hit |
  | `f5ee3696` | `test.only.skip(`, `describe.skipIf(true)(`, `it.concurrent.skip(` | **failed**: 3 hits |
  | `768aee92` | `it.each([f(1)]).skip(`, `it["skip"](`, `suite.skip(` | **passed**: missed, see below |

- **Spellings.** `tools/qa242-d1-spellings.mjs` evaluates the committed `const SKIPS` line as written. Results are in
  `results/g-d1-spellings.txt`.
  - **Hits** on all three dispatch-named spellings, plus `it.skipIf(cond)(`, `describe.runIf(a)(`, `test.todo(`,
    `it.each([[1, 2]]).skip(`, `test.for([1]).skip(` and `test.extend({}).skip(`.
  - **Misses**, so they are residual and not blocking:
    - nested parentheses inside a modifier's arguments: `it.each([f(1)]).skip(` and `it.each([{ a: f(1) }]).skip(`;
    - a tagged-template `each`;
    - `it .skip(` (whitespace before the dot);
    - `it["skip"](`;
    - vitest's `suite` alias of `describe`;
    - an in-body `ctx.skip()` or `({ skip }) => skip()`.
  - **One false positive:** a title string that contains `describe.skip` verbatim is a hit.
- **D1** (the builder's temp-repo test) and **D1b** (no untracked file under `open-brain/tests`) are green at the
  candidate. Together they close the hole that made r1 look green.

## 4. R2-7: the disclosure, re-derived

`tools/qa242-touch.mjs` repeats QA 240's method: the files each merge commit touches, intersected with the files the
builder edited in `2448a6ea..1da79279^`. Results are in `results/i-disclosure-touch.txt`.

- #182 touches `runtime.ts`, `schema.ts` and `artifacts.ts`, **not `gate.ts`**. The handoff now says so.
- #209 touches `brief-plan-gate.ts`, `cli.ts` and `t195-plan-gate.test.ts`. The handoff says so.
- #195 touches `policies.ts` and `cli.ts`. The handoff says so.
- #187 touches `runtime.ts`, `schema.ts`, `declared.ts` and `cli.ts`. **The handoff's #187 entry leaves out
  `runtime.ts`**, which QA 240 §4 named for #187 and which the builder had edited before `1da79279`. `runtime.ts` is
  disclosed under #182, so the set of files read is complete, but the per-PR attribution is not.
- #165, #227, #220 and #218 touch none of the named files and none of the builder's pre-`1da79279` edits. **The
  four/four split stands.**

The three corrections the r2 dispatch required are made. The `runtime.ts`-under-#187 omission is noted here and does
not change the score.

## 5. Mutants

All runs were sequential in `qa242-cand`, using `tools/qa242-mut.mjs`. The steps for each diff:

1. `git apply`;
2. `tsc --noEmit`;
3. vitest with `--testTimeout=120000`;
4. `git apply -R`;
5. assert that `git status --porcelain` is unchanged.

`tsc` exited 0 and the revert was clean for every mutant. **SET** is `s4-g1-records`, `s4-g2-key`, `s4-g3-done`,
`s4-g5-qa`, `s4-g6-closeout`, `s4-guards`, `policies` and `t195-plan-gate`: 130 tests. The unmutated control (SET plus
`shadow-merge` and `cli`) is 190/190 green.

**QA 240's six, run on the builder's tests** (`results/a-qa240-six-on-builder-tests.txt`). The builder's copies are
byte-identical to QA 240's originals (`tools/qa242-fetch-mutants.mjs`). `gate-live` is not in SET.

| Mutant | Red on |
|---|---|
| q05 | `s4-g5` R9 |
| q06 | `s4-g3` D9 |
| q10 | `s4-g1` C7 |
| q11 | `s4-g1` C8(auth) |
| q12 | `s4-g3` D8, `s4-g5` R10 |
| q13 | `s4-g5` Q8, Q5; `policies` A6 half two |

**Builder's 19 (regression; `results/c-*.json`, `d-*.json`, `e-*.json`): 19/19 red.** Each is red on the same tests
QA 240 recorded, or on a superset:

| Mutant | Red on |
|---|---|
| m01 | P2, P4, P6, T5 |
| m02 | P2, P4, P6 |
| m03 | 17 tests: W1, C1 to C9, C6, D6, D7, D8, R10 |
| m04 | C2, D6 |
| m05 | `s4-g2` K1(200) |
| m06 | `s4-g2` K3 |
| m07 | A3, T7 |
| m08 | D5 |
| m09 | D2 |
| m10 | D3 |
| m11 | R1, R2, R4 |
| m12 | R7 |
| m13 | R3, R5, R7 |
| m14 | Q5, Q7, two `policies` tests |
| m15 | Q5, Q6, one `policies` test |
| m16 | T1 |
| m17 | T4 |
| m18 | `s4-g3` K1(200) |
| m19 | `s4-g5` K1(200) |

**QA 240's q01 to q09 (regression; `results/f-qa240-q01-q09.json`, plus q05 and q06 above): 9/9 red.**

| Mutant | Red on |
|---|---|
| q01 | D5, `s4-g3` K1(200) |
| q02 | `s4-g3` K1(200, 422), `s4-g2` K3 |
| q03 | `s4-g5` K1(200, 422), `s4-g2` K3 |
| q04 | `s4-g2` K1(200, 422), K3 |
| q07 | R3 |
| q08 | R3 |
| q09 | R7 |

The two-layer property QA 240 showed for q02, q03 and q04 (K1(422) newly red) holds.

**QA 242's own** (`docs/loops/qa-242/mutants/r*.diff`, `results/b-qa242-own.json`):

| Mutant | What it does | Result |
|---|---|---|
| r01 | `cli.ts` passes `doneGate: <parsed --done-record>` inside the `prepareShadowVerdict({…})` call | **red**: `s4-guards` S4-6d.3 |
| r02 | the same `doneGate`, built as `const wired = {…}` and passed as `...wired` | **survives** (`s4-guards`, `shadow-merge`, `cli`, `s4-g3`, `s4-g5`: 107/107) |
| r03 | `prepareShadowVerdict` defaults `doneGate` to the slice's `<loop>.G_done.json` when it exists | **survives** (the same 107) |
| r04 | `request-invalid` made retryable | **red**: C3, C8(request-invalid) |
| r05 | `unexpected-status` made retryable | **red**: C8(unexpected-status) |
| r06 | `malformed-response` made retryable | **red**: C8(malformed-response) |
| r07 | literal `0.4` planted in `shadow-gates.ts`'s `decideDoneGate` call | **red**: Q8, Q5, `policies` A6 |

## 6. The optional S4-6d.3 test

The test is static. It checks that the four slice files never import `./shadow-merge.js`, and that the text between
`prepareShadowVerdict({` and the next `});` in `cli.ts` does not contain `doneGate` or `planGate`.

- It **does** catch the plain wiring: r01 is red.
- It misses the same wiring passed by **spread** (r02).
- It misses wiring **inside `prepareShadowVerdict`** (r03). That is where `computeShadowMergeVerdict` would act on a
  `reject` record regardless of `require_done_gate`, and it is the case Open 4 described.

So it guards the CLI call site as written, not the property. The property needs a behavioural test as well: write a
`reject` `G_done` record where the runner writes it, run `harness shadow-verdict prepare`, and assert the verdict
equals the one given without the record. That test would turn r03 red. For r02, the static check could also refuse a
spread (`...`) in the call. The dispatch marked this item optional, so this does not affect the verdict.

## 7. QA 240's met rows, re-checked by their tests

- The S4 test files are all green in the 190-test control set at the candidate, with the 120 s per-test timeout.
- In both full runs every S4 test passed except P4, which failed on time and not on an assertion.
- The canary walk (K0, K1, K2, K3), the independence table (`s4-g4`, 45/45) and the guards (`s4-guards`, 11/11:
  S4-5b, S4-5c, S4-8, S4-9.1 and S4-9.2) are green in both full runs.
- Every builder and QA 240 mutant that QA 240 scored red is still red (§5).

## 8. For the builder (what would turn the REJECT)

1. **Give P4 a timeout**: `it("P4 …", () => { … }, 120_000)`.
2. **Better, give every slice-four test that spawns `tsx` a timeout at the describe level**, as `policies.test.ts` does
   with `describe(..., { timeout: 60_000 }, …)`. That covers `s4-g1` P4 and C6, and the spawning K2 tests in
   `s4-g2`, `s4-g3` and `s4-g5`. Only R6 has an explicit timeout today, and P4 shows the 5 s default is not enough under
   full-suite load on Plumb.
3. Then rerun the full suite on Plumb. Expected result: the candidate adds no failure over the base.

Optional:

- the behavioural S4-6d.3 test in §6;
- the D1 residuals in §3 (nested parentheses in a modifier's arguments, and the `suite` alias);
- adding `runtime.ts` to the #187 line of the disclosure.

## 9. Open for the planner

1. **The base is not green on Plumb, even with clark's npm fix.** All 1940 base tests pass, but vitest exits 1 on an
   unattributed `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled error. It happened in 2 of 2 base runs and
   2 of 2 candidate runs. Until it is fixed or ruled environmental, "exit 0" cannot pass on Plumb for any candidate.
   This report applied D-082's reading.
2. **P4 passed in QA 240's r1 run and failed in both of QA 242's r2 runs**, so it is timing-dependent. The code is from
   r1, not r2. QA 242 counts it under the strict reading because it is a failure the candidate adds over the base, it
   reproduced 2 of 2, and its isolated time is within 10% of the limit.
3. **No CI run:** `gh` is not installed on Plumb. The PR's CI on tcm is still the second half of S4-9.3's reading.
4. **S4-6d.3** is guarded at the CLI call site only (§6). Rule whether the behavioural test is wanted before the
   close-out.

QA-242: REPORT COMPLETE
