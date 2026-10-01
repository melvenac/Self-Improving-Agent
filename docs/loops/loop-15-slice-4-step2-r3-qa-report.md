# Loop 15 slice four, step 2 r3: QA report (QA 243)

**By:** the QA seat, record session 243, 2026-10-01, on **Plumb** (the Linux QA seat), headless Claude Code on Opus 5.5
(D-068). **This is a re-run.** The first QA 243 attempt died at the usage limit at about 14:46Z with no report and no
push. Its trees were reused after a clean check. `qa243-wt` held an untracked `docs/loops/qa-243/tools/`, which was
removed with `git clean -fd` in that tree. The other three trees were clean at their expected SHAs. Nothing the first
attempt left is cited here: every command was run again, and every output file is from this run.

**Dispatch:** `docs/loops/qa-243-s4-step2-r3-dispatch.md` at the launch-line SHA `d54a5e2d`.
**Worktree:** `~/qa-scratch/qa243-wt`, detached at `d54a5e2de52e8baf6e24229156ac2080cec2d718`
(`git -C ~/qa-scratch/qa243-wt log -1 --format=%H`).
**Candidate:** `36a0fc282e328d8bb32ffb4ccd6e875c95d3dd8d` (`origin/loop/15-slice-4-step2`). **r2:** `779be4d6`.
**Base:** `2448a6ea`.
**Scratch trees** (all detached):
- `~/qa-scratch/qa243-cand`: the candidate;
- `~/qa-scratch/qa243-base`: the base;
- `~/qa-scratch/qa243-ref`: QA 242's report, `bd18167f`.

`TMPDIR=~/qa-tmp`. Toolchain: node v22.22.1, npm 11.21.0.

**No live Jev call was made.** Every command ran through one of the tools in `docs/loops/qa-243/tools/`:
`qa243-run.mjs`, `qa243-mut.mjs` and `qa243-timeouts-commit.mjs`. Each builds its child's environment from scratch
(`HOME`, `PATH`, `TMPDIR`, `CI`, a scratch `KNOWLEDGE_V2_DB`) and never spreads `process.env`, so no `TYPESAFE_API_KEY`
could reach anything that ran. V1's own Jev calls go through an in-process fake transport.

**r3 is test-side only.** `git diff --stat 779be4d6 36a0fc28 -- open-brain/src` is empty. The r3 diff touches 12
files: the handoff, the two kept QA 242 mutants, and nine test files under `open-brain/tests/harness/`.

## Verdict: REJECT

S4-9.3 now passes as D-083 reads it. Both full candidate runs have **0 failed tests** against the base's 0, and the
only error in either is the base's own unattributed `[vitest-worker]` RPC timeout. P4 passed both times, and it took
4964 ms in run 1, so the describe-level timeout is what saved it.

R3-1 and R3-3 are met, and so is the regression set: 19/19 builder mutants, QA 240's q01 to q13, and QA 242's r01 and
r04 to r07 are all red.

**R3-2 is unmet, on the dispatch's own rule.** "A survivor is a gap, not a blocker, unless it is a path a runner
actually writes to."
- **s04** reads the 4.3 runner's own records, in the runner's own default directory
  (`docs/loops/loop-15-slice-4-records/*.G_done.*.json`), from the **committed** tree at `HEAD`. That is the same way
  `prepareShadowVerdict` already reads the criteria (`git show <sha>:<path>`).
- V1 writes its reject records only into the working tree and never commits them, so s04 survives V1.
- The slice's records directory is tracked, so a runner's record does reach `HEAD` in normal use.
- s04 is live: a probe that commits the planted records turns it red, and the probe is green when nothing is mutated.

The fix is test-side and one line: commit the planted records in V1's fixture before the second `prepare` (see §7). If
the planner reads "a path a runner writes to" as the working-tree file only, s04 is a gap and this verdict would be
ACCEPT. See Open 1.

## 1. S4-9.3: the full suite, base and candidate, on Plumb

All runs were in `open-brain/`, using `qa243-run.mjs`, one at a time. Results are in `results/i-full-suite-summary.txt`.

| | npm ci | npm run build | tsc --noEmit | vitest exit | Test files | Tests | Errors |
|---|---|---|---|---|---|---|---|
| base `2448a6ea` | 0 | 0 | 0 | **1** | 137 passed (137) | **1940 passed**, 5 skipped (1945), **0 failed** | 1 |
| candidate `36a0fc28`, run 1 | 0 | 0 | 0 | **1** | 146 passed (146) | **2077 passed**, 5 skipped (2082), **0 failed** | 1 |
| candidate `36a0fc28`, run 2 | | | | **1** | 146 passed (146) | **2077 passed**, 5 skipped (2082), **0 failed** | 1 |

Each run's duration, with the machine's load average when it began:

| Run | Duration | Load average |
|---|---|---|
| base | 487.3 s | 3.38 |
| candidate run 1 | 475.4 s | 3.19 |
| candidate run 2 | 495.0 s | 3.63 |

- **Failed tests, by name:** none at the base, none in candidate run 1 and none in candidate run 2. The vitest JSON
  reports give `numFailedTests: 0` in all three.
- **The one error in each run** is `Error: [vitest-worker]: Timeout calling "onTaskUpdate"`. It is an unhandled
  worker-to-main RPC timeout that vitest attributes to no test. It occurs at the base, so under D-083 it is
  environmental and is not a failed test. It is why every exit code is 1.
- **P4 and the other spawning tests.**

  | Test | Run 1 | Run 2 |
  |---|---|---|
  | `s4-g1` P4 | 4964 ms | 4768 ms |
  | `s4-g1` C6 | 3354 ms | 3163 ms |
  | `s4-g3` C1 | 3594 ms | 4062 ms |
  | `s4-g4` R6 | 12859 ms | 13478 ms |

  All passed. P4 came within 36 ms of the old 5 s default in run 1. It passed because of the describe-level
  `{ timeout: 120_000 }`.
- **Per-file results, both candidate runs:** `s4-g1` 20/20, `s4-g2` 12/12, `s4-g3` 14/14, `s4-g4` 45/45, `s4-g5`
  22/22, `s4-g6` 9/9, `s4-g7` 2/2, `s4-guards` 11/11 and `s4-timeouts` 2/2.
- **Counts:** the candidate passed 2077 tests against the base's 1940, and failed 0 against 0. It adds no failed test.
  S4-9.3 is **met** on Plumb.
- **CI:** 0 runs, because `gh` is not installed on Plumb (`which gh` finds nothing). No `qa/s4-step2-r3-ci-*` branch
  was pushed, so the tcm half of S4-9.3 is still open (Open 2).

## 2. Rows

| Row | Score | Evidence |
|---|---|---|
| R3-1 (timeouts by class) | **met**, with residuals | §3 |
| R3-2 (behavioural S4-6d.3) | **unmet** | §4: r02 and r03 are red. Of QA 243's limit mutants, s02 and s03 are red, and s01 and s04 survive. s04 survives on the runner's own records path. |
| R3-3 (disclosure) | **met** | §5 |
| S4-9.3 (D-083) | **met** on Plumb | §1: 0 failed at the candidate in 2 of 2 runs, 0 at the base, and the same environmental RPC error in all three runs. The tcm CI half has not been run (no `gh`). |
| Regression | **met** | §6: 19/19 builder mutants, q01 to q13, and r01 and r04 to r07 are all red. |
| QA 242's met rows | **still met** | §6. Their tests are green in both full runs and in the 134-test control, and their mutants are still red. |
| CI | **0 runs** | `gh` is not installed on Plumb. |

## 3. R3-1: timeouts by class

**Every top-level `describe` in every `s4-*.test.ts` carries `{ timeout: 120_000 }`.** There are 17 of them across
nine files, all at column 0:
- `s4-g1`: 4
- `s4-g2`: 3
- `s4-g3`: 1
- `s4-g4`: 2
- `s4-g5`: 2
- `s4-g6`: 1
- `s4-g7`: 1
- `s4-guards`: 1
- `s4-timeouts`: 1

The only nested `describe` (`s4-g4:98`) inherits its parent's timeout. No `s4-*` file has a top-level `it` or `test`.

**The guard on committed plants in the real tree.** The tool is `tools/qa243-timeouts-commit.mjs`, with results in
`results/a-r3-1-timeout-plants.json`. Each step makes a scratch commit in `qa243-cand` (local, never pushed), runs
`s4-timeouts.test.ts`, then does `git reset --hard 36a0fc28` and `git clean`. At the end the tree was back at
`36a0fc28` and clean.

| Scratch commit | Planted | T1 |
|---|---|---|
| `f0eaaa14` | **A**: a top-level `describe` with no timeout and a direct `spawnSync`, appended to the committed `s4-g6-closeout.test.ts` | **red**: "s4-g6-closeout.test.ts spawns and has a describe with no explicit timeout" |
| `f1429142` | **B**: a spawn through an imported helper (new committed `qa243-helper.ts` and `s4-qa243-b.test.ts`), with no timeout anywhere | **passes, so the guard misses it** (the planted test itself ran and passed, so it really spawns) |
| `b66361f8` | **C**: a timeout given only on the inner `it` (`120_000`), and none on the `describe` | **red**. The guard demands a describe-level timeout, which is stricter than the r3 wording "in its describe or it". This is safe, not a miss. |
| `8985ca37` | **C2**: the `describe` carries `120_000`, but the spawning inner `it` overrides it down to `1` | **passes, so the guard misses it** |
| `7345bace` | **D**: a top-level `describe.concurrent(` with no timeout | **passes, so the guard misses it** (`^describe\(` only) |
| `c7d60cfa` | **E**: an aliased import, `spawnSync as run`, with no timeout | **passes, so the guard misses it** (the guard's name list does not include `run(`) |
| `f6416bb8` | **F**: a top-level `it(` that spawns, with no `describe` at all | **passes, so the guard misses it** (there is no `describe` line to check) |
| `01ae5947` | **G**: a multi-line `describe(` whose options are on the next line, with a timeout | **red: a false positive** (the bare `describe(` line has no timeout on it) |

The guard fires on the class it was asked to catch (A). B, C2, D, E and F are residual misses. None of them occurs in
the current files, and the dispatch sets no blocker rule for them. G is a false positive that would push a builder
toward one-line `describe` headers.

## 4. R3-2: the behavioural S4-6d.3 test (`s4-g7-merge` V1)

All mutants ran in `qa243-cand` using `tools/qa243-mut.mjs`. The steps for each diff:
1. `git apply`;
2. `tsc --noEmit`;
3. vitest with `--testTimeout=120000`;
4. `git apply -R`;
5. assert that `git status --porcelain` is unchanged.

The run set was `s4-g7-merge`, `s4-guards`, `shadow-merge` and `cli`: 73 tests, all 73 green in the unmutated
control. Results are in `results/b-r3-2-s6d3.json`. QA 242's originals are byte-identical to the builder's kept copies
(`cmp`).

| Mutant | What it does | Result |
|---|---|---|
| r01 (QA 242) | `doneGate` written into the CLI's `prepareShadowVerdict({…})` call | **red**: `s4-guards` S4-6d.3 |
| r02 (QA 242) | the same `doneGate`, passed by spread | **red**: `s4-guards` S4-6d.3 (the spread refusal) |
| r03 (QA 242) | `prepareShadowVerdict` defaults `doneGate` to `loop-15-slice-4-records/<loop>.G_done.json` | **red**: `s4-g7` V1 |
| **s01** | reads `docs/loops/loop-<loop>-records/<loop>.G_done.json`: the records directory under a different name | **survives** (73/73) |
| **s02** | a glob over `docs/loops/**/*G_done*`, taking the first `reject` or `halt` | **red**: V1 |
| **s03** | only the 4.3 runner's own file names (`pr-N.G_done.<timestamp>.json`) in its default directory, from the working tree | **red**: V1 |
| **s04** | the same directory and names, read from the **committed tree** at `HEAD` (`git ls-tree` plus `git show`) | **survives** (73/73) |

**Are the two survivors live?** `tools/qa243-make-probe.mjs` makes an untracked copy of V1 that does two more things
before the second `prepare`:
- it also plants the record at s01's path;
- it commits the fixture.

At the unmutated candidate the probe passes, 2/2. Under s01 it is red, and under s04 it is red
(`results/c-r3-2-liveness-probe.json`). So both mutants really do move the verdict when their record exists, and
neither survivor is vacuous. The probe file was deleted afterwards and the tree was clean.

**Judging the stated limit.** The builder says "V1 only catches wiring that reads a record from a place it plants one
at", and that statement is accurate.
- **s01 is a gap, not a blocker.** No runner writes to `loop-<loop>-records/` by default. Both runners default to
  `SLICE_RECORDS_DIR` (`docs/loops/loop-15-slice-4-records`), and only an explicit `--records` flag moves them.
- **s04 is a blocker under the dispatch's rule.** It reads the 4.3 runner's own record, at the runner's own path.
  - The only difference from s03 is that it reads the committed copy.
  - `docs/loops/loop-15-slice-4-records/` is tracked (it holds the eight `pr-*.D_t.json` files), and a seat commits
    the records a runner writes. So in real use, a record at that path is at `HEAD`.
  - V1 never commits, so a wiring that reads gate records from git would pass V1 and move real verdicts.
  - `prepareShadowVerdict` already reads its other input, the criteria, through `git show`, so a git read here is not
    far-fetched.

**The one-line fix**, in `mutants/fix-v1-commit-the-records.diff`: add `repo.commitAll(…)` after the plants and before
the second `prepare`. With it applied to the real `s4-g7-merge.test.ts` (`results/k-v1-fix-check.json`), the control
is 2/2 green, and both s04 and r03 are red.

## 5. R3-3: the disclosure

The handoff's limit 1 now reads: "#187 (B part 2): `schema.ts` (`EVIDENCE_LOOP_PATTERN`), `declared.ts`, `cli.ts` and
`runtime.ts`". The r2 to r3 diff of the handoff changes only that line in limit 1, and the rest of the diff is the
appended r3 section. The four/four split is unchanged:
- read before writing: #182, #187, #195 and #209;
- not read: #165, #227, #220 and #218.

This matches QA 242 §4's derivation. **Met.**

## 6. Regression: run sequentially

Every mutant ran with `qa243-mut.mjs` on **SET**, one after another:
`s4-g1-records`, `s4-g2-key`, `s4-g3-done`, `s4-g5-qa`, `s4-g6-closeout`, `s4-g7-merge`, `s4-guards`, `s4-timeouts`,
`policies` and `t195-plan-gate`. That is 134 tests, all 134 green in the unmutated control.

Every mutant passed `tsc` with exit 0 and reverted cleanly. The full table is `results/j-mutant-table.txt`, built from
`results/d-*.json` to `h-*.json`.

**Builder's 19: 19/19 red.** Each is red on the same tests QA 242 recorded.

| Mutant | Red on |
|---|---|
| m01 | P2, P4, P6, T5 |
| m02 | P2, P4, P6 |
| m03 | 17 tests: W1, C1 to C9, D6, D7, D8, R10 |
| m04 | C2, D6 |
| m05 | `s4-g2` K1 |
| m06 | `s4-g2` K3 |
| m07 | A3, T7 |
| m08 | D5 |
| m09 | D2 |
| m10 | D3 |
| m11 | R1, R2, R4 |
| m12 | R7 |
| m13 | R3, R5, R7 |
| m14 | Q5, Q7, two `policies` tests |
| m15 | Q5, Q6, `policies` A6 |
| m16 | T1 |
| m17 | T4 |
| m18 | `s4-g3` K1 |
| m19 | `s4-g5` K1 |

**QA 240's q01 to q13: 13/13 red.**

| Mutant | Red on |
|---|---|
| q01 | D5, `s4-g3` K1 |
| q02 | `s4-g2` K3, `s4-g3` K1 ×2 |
| q03 | `s4-g2` K3, `s4-g5` K1 ×2 |
| q04 | `s4-g2` K1 ×2, K3 |
| q05 | R9 |
| q06 | D9 |
| q07 | R3 |
| q08 | R3 |
| q09 | R7 |
| q10 | C7 |
| q11 | C8 |
| q12 | D8, R10 |
| q13 | Q5, Q8, `policies` A6 |

**QA 242's r01 and r04 to r07: 5/5 red.**

| Mutant | Red on |
|---|---|
| r01 | `s4-guards` S4-6d.3 |
| r04 | C3, C8 |
| r05 | C8 |
| r06 | C8 |
| r07 | Q5, Q8, `policies` A6 |

r02 and r03 are in §4, and both are red.

**QA 242's met rows are still met.**
- **R2-1:** `s4-guards` is 11/11 in both full runs. The skip guard's `suite` alias and nested-parenthesis plants are
  among its G0 cases.
- **R2-2:** R6 passed in both runs.
- **R2-3 to R2-6:** each is held by its mutants above.
- **R2-7:** see §5.

## 7. For the builder (what would turn the REJECT)

1. **Commit V1's planted records before the second `prepare`:** `repo.commitAll("…")`, as in
   `docs/loops/qa-243/mutants/fix-v1-commit-the-records.diff`. QA 243 has shown that this turns s04 red, keeps r03
   red, and keeps V1 green on the candidate.
2. Keep s04 as a mutant beside r02 and r03.

Optional:
- the timeout guard's misses from §3:
  - an imported spawn helper;
  - `describe.concurrent` and other modifiers;
  - an aliased `spawnSync`;
  - a top-level `it`;
  - an inner `it` that lowers the timeout;
- its multi-line `describe(` false positive;
- s01, which needs a plant under a loop-named records directory.

## 8. Open for the planner

1. **Rule on s04.** QA 243 reads "a path a runner actually writes to" to include the runner's own records path read
   from the committed tree, since the records directory is tracked. On that reading, R3-2 is unmet and the verdict is
   REJECT. If the planner limits it to the working-tree file, s04 is a gap, every scored row is met, and the verdict
   would be ACCEPT.
2. **The CI half of S4-9.3** has not been exercised: `gh` is not installed on Plumb, so 0 runs were made. The PR's CI
   on tcm still needs a green run.
3. **The base is still not green on Plumb.** The unattributed `[vitest-worker]: Timeout calling "onTaskUpdate"`
   happened in 1 of 1 base runs and in 2 of 2 candidate runs, and was ruled environmental (D-083). It now joins QA
   242's 2 of 2 and 2 of 2.
4. **P4's margin:** 4964 ms in a full run against a 5000 ms default. The describe-level timeout covers it. The guard's
   misses (§3) mean a future spawning test written one of those ways could reintroduce the class unnoticed.

QA-243: REPORT COMPLETE
