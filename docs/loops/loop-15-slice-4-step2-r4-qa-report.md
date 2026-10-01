# Loop 15 slice four, step 2 r4: QA report (QA 244)

**By:** the QA seat, record session 244, 2026-10-01, on **Plumb** (the Linux QA seat), headless Claude Code on Opus 5.5
(D-068). A narrow check, per `docs/loops/qa-244-s4-step2-r4-dispatch.md`.

**Dispatch SHA:** `09022b661b269c24cb1518555ab3813676a827f6` (launch line).
**Worktree:** `~/qa-scratch/qa244-wt`, detached at `09022b661b269c24cb1518555ab3813676a827f6`
(`git -C ~/qa-scratch/qa244-wt log -1 --format=%H`).
**Candidate:** `8a6cfb2db4f33787c09721c97a095ad8430fcf82` (`origin/loop/15-slice-4-step2`, which still points there).
**r3:** `36a0fc28`, an ancestor of the candidate (`git merge-base --is-ancestor` exit 0), so the branch was not forced.
**Scratch tree:** `~/qa-scratch/qa244-cand`, detached at the candidate. `TMPDIR=~/qa-tmp`. Toolchain: node v22.22.1,
npm 11.21.0.

**No live Jev call was made.** Every command ran through `docs/loops/qa-244/tools/qa244-run.mjs` or `qa244-mut.mjs`.
These are QA 243's tools with the names changed by `qa244-fetch.mjs`. Each builds its child's environment from scratch
(`HOME`, `PATH`, `TMPDIR`, `CI`, a scratch `KNOWLEDGE_V2_DB`) and never spreads `process.env`. V1's Jev calls go through
an in-process fake transport.

## Verdict: ACCEPT

All three rows are met. The r4 change is confined to the three permitted files. The test change is byte-identical to
the fix QA 243 supplied. V1 is green unmutated, and it now catches s04. Every other mutant keeps its QA 243 result. The
full suite has 0 failed tests.

## 1. Row 1: the change is confined (met)

`git diff --name-status 36a0fc28 8a6cfb2d` (`results/c-r4-diff-names.txt`):

```
M	docs/loops/loop-15-slice-4-step2-developer-handoff.md
A	docs/loops/loop-15-slice-4/mutants/qa243-s04.diff
M	open-brain/tests/harness/s4-g7-merge.test.ts
```

- **The test change is QA 243's fix exactly.** The diff of `s4-g7-merge.test.ts` has blob range
  `82144d82..5f021f30`, the same as QA 243's `docs/loops/qa-243/mutants/fix-v1-commit-the-records.diff`. It adds
  `repo.commitAll("commit the reject records, as a seat does")` after the plants and before the second `prepare`. It
  also adds a one-line comment.
- **The kept s04 is QA 243's s04.** `docs/loops/loop-15-slice-4/mutants/qa243-s04.diff` is byte-identical to
  `docs/loops/qa-243/mutants/s04-done-gate-read-from-committed-records.diff` on `origin/qa/s4-step2-r3-report`.
- **The kept r02 and r03 are QA 242's,** byte-identical to the copies on `origin/qa/s4-step2-r2-report`.
- **The handoff** gains one r4 paragraph. Nothing under `open-brain/src` changed.

## 2. Row 2: R3-2 met

Build at the candidate: `npm ci` exit 0 (7.8 s), `npm run build` 0 (12.8 s), `tsc --noEmit` 0 (9.6 s).

**V1 on its own.** These are `s4-g7-merge.test.ts` runs (`results/a-v1-alone.json`):

| Run | tsc | vitest exit | Result |
|---|---|---|---|
| control (no mutant) | 0 | 0 | **2/2 passed** (V1 green unmutated) |
| QA 243 s04 | 0 | 1 | **red**: V1 |
| QA 242 r03 | 0 | 1 | **red**: V1 |

**The six mutants on the builder's tests.** These used the same four files as QA 243's §4 run: `s4-g7-merge`,
`s4-guards`, `shadow-merge` and `cli`, 73 tests. The runs were sequential, and the tree was proven clean after each
revert (`results/b-six-on-builder-tests.json`):

| Mutant | tsc | Result at r4 | QA 243 result at r3 | Expected |
|---|---|---|---|---|
| control | 0 | 73/73 green | 73/73 green | green |
| QA 242 r02 (wired by spread) | 0 | **red**: s4-guards S4-6d.3 | red | red ✓ |
| QA 242 r03 (wired inside prepare) | 0 | **red**: s4-g7 V1 | red | red ✓ |
| QA 243 s01 (loop-named records dir) | 0 | **survives** 73/73 | survives (gap) | gap ✓ |
| QA 243 s02 (glob over docs/loops) | 0 | **red**: s4-g7 V1 | red | red ✓ |
| QA 243 s03 (runner-named records only) | 0 | **red**: s4-g7 V1 | red | red ✓ |
| QA 243 s04 (read from committed records) | 0 | **red**: s4-g7 V1 | **survived** | red ✓ (the fix) |

Every result matches the dispatch. s04 has moved from surviving to red, and s01 is still the one known gap.

## 3. Row 3: one full-suite run at the candidate (met)

`node node_modules/vitest/vitest.mjs run` in `qa244-cand/open-brain` with a constructed env. The load average at the
start was 3.98. The relevant lines are in `results/d-full-suite-lines.txt`.

- **Test Files:** 146 passed (146)
- **Tests:** 2077 passed | 5 skipped (2082). **0 failed.** The JSON reporter gives `numFailedTests: 0` and
  `success: true`.
- **Errors:** 1. It is `Error: [vitest-worker]: Timeout calling "onTaskUpdate"`, with no test attributed. This is the
  same environmental RPC error as in QA 242's and QA 243's runs (D-083).
- **Exit code:** 1, caused only by that unhandled error. Duration 469.82 s, and 471.5 s wall time.

These counts are identical to QA 243's two candidate runs at r3, which is what a test-only change that adds no test
should produce.

## 4. Rows

| Row | Score | Evidence |
|---|---|---|
| 1. Change confined | **met** | §1 |
| 2. R3-2 | **met** | §2: V1 green; s04, r02 and r03 red; s01 a gap; s02 and s03 red |
| 3. Full suite | **met** | §3: 0 failed, 2077 passed, exit 1 from the environmental RPC error only |
| CI | **0 runs** | `gh` is not installed on Plumb (`which gh` finds nothing), so `qa/s4-step2-r4-ci-candidate` was not pushed |

## 5. Artifacts (`docs/loops/qa-244/`)

- `mutants/`: the six mutant diffs as run (QA 242 r02 and r03, and QA 243 s01 to s04)
- `tools/`:
  - `qa244-fetch.mjs` (copies and compares the mutants and tools)
  - `qa244-mut.mjs`
  - `qa244-run.mjs`
- `results/`:
  - `a-v1-alone.json`
  - `b-six-on-builder-tests.json`
  - `c-r4-diff-names.txt`
  - `d-full-suite-lines.txt`

## 6. Open for the planner

1. **The CI half of S4-9.3 is still unexercised.** `gh` is not installed on Plumb, so there were 0 runs. The PR's CI on
   tcm still needs a green run.
2. **s01 is still a gap,** as ruled. It is not a blocker. It reads a records directory under a loop-specific name,
   which no runner writes to by default.
3. **The environmental `[vitest-worker]` RPC timeout** happened again (1 of 1 runs), so the full suite still exits 1 on
   Plumb with 0 failed tests.

QA-244: REPORT COMPLETE
