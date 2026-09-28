# T-046 D1 (`cursor-hook-compat` unreadable installPath): QA report, record session 209

**By:** QA seat, GPT-5.6 Sol medium, headless on the Windows laptop, 2026-09-28.
**Dispatch:** `docs/loops/t046-d1-dispatch-qa.md`.
**Scored record:** 207, the QA 197 D1 follow-up in `docs/loops/session-147-dispatches.md`.
**Candidate:** `origin/loop/t046-d1` at product/tip
`a8adca0140342ced92bcc7bc847c4ea73b1f4b22`, based on
`d1e86740bd68827979cfbd5757034f849c38ad41`.

## Verdict

**ACCEPT.** The candidate reports ISSUE for each unreadable
`installPath` shape, names the plugin and says `hooks/hooks.json` could not be read. Zero installs and
an existing install without `hooks/hooks.json` remain PASS. All tested paths use fixture profiles.
QA split the developer's combined test into three independent red rows, because the combined base
failure stopped at its first severity assertion and did not prove each input independently.

## 1. Score

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Missing, empty, and nonexistent `installPath` are red on master and ISSUE/SKIP on candidate | **pass** | QA test commit `0081dab` has one test per input. On base, tcm run `36388552496` failed exactly those three tests while both preserves passed: 3 failed, 1812 passed, 6 skipped. Candidate full run `36388061123` passed the developer row; the QA-only file passed 5/5 locally. Every message assertion names its plugin, its path reason, and `could not read hooks/hooks.json`. |
| 2 | Preserve zero installs, no `hooks/hooks.json`, and record-194 rows | **pass** | The QA base run shows both preserve rows green, and the same QA file is 5/5 on the candidate. Candidate full CI passed all 9 `cursor-hook-compat.test.ts` tests and the full suite (131 files; 1812 passed, 6 skipped). |
| 3 | Fixture isolation (G-044) | **pass** | Every new QA test creates a temp `home` and `local`, asserts `home !== homedir()`, and passes both explicitly to `checkCursorHookCompat`. The developer's tests also pass explicit fixture paths. No test calls the defaults or reads the real profile. |
| 4 | At least two QA mutants on `qa/t046-d1-mut-*` | **pass** | `qa/t046-d1-mut-empty` `2a6e6ae` removes only the empty-path finding; tcm `36388868490` failed the developer combined row and independent empty-path row. `qa/t046-d1-mut-ghost` `e88229e` removes only the nonexistent-path finding; tcm `36388868410` failed the combined row and independent nonexistent-path row. Both runs typechecked successfully and had 2 failed / 1815 passed / 6 skipped. |

## 2. Candidate review

The product diff adds explicit findings for absent, non-string, empty, and nonexistent paths before
joining `hooks/hooks.json`. It leaves the zero-install loop and the absent-hooks-file `continue`
unchanged. `git diff --check` is clean.

GitNexus impact for `checkCursorHookCompat` is **LOW**: one direct caller (`runSync`), 10 upstream
symbols, one affected module, and two affected server processes (`handleSync`, `handleScore`).

## 3. CI and local checks

Four tcm runs were dispatched, the maximum allowed. No `windows=true` run was requested.

| Purpose | Run | Branch / head SHA | Conclusion |
|---|---:|---|---|
| green | `36388061123` | `loop/t046-d1` / `a8adca0140342ced92bcc7bc847c4ea73b1f4b22` | **success** |
| red | `36388552496` | `qa/t046-d1-red` / `552021048fc42662746602db1790992b20ee38ad` | **failure as intended**: all three issue rows failed independently; preserves passed |
| empty mutant | `36388868490` | `qa/t046-d1-mut-empty` / `2a6e6ae1d7b4ff31a7a96841e1403b6dd526c58a` | **failure as intended**: combined row plus independent empty row |
| nonexistent mutant | `36388868410` | `qa/t046-d1-mut-ghost` / `e88229e05daa5b5eeacdf75b6fc96ca37b11f78b` | **failure as intended**: combined row plus independent nonexistent row |

Local candidate checks: typecheck exit 0; original T-046 file 9/9; QA file 5/5; build exit 0
and stamped `a8adca0`. Each mutant was type-clean and killed only its intended QA row locally.

## 4. Evidence file

`docs/loops/t046-d1-qa-report.E_t.json` uses loop id `207-hook-compat-d1` and the full product SHA.
From `open-brain/`, `node build/harness/cli.js validate evidence
../docs/loops/t046-d1-qa-report.E_t.json` exits **0**.

## 5. Defects

None in the candidate. The developer's combined test was insufficient to demonstrate three distinct
red observations, so QA supplied the independent rows used for this score.

## 6. Open for the planner

None.

QA-209: REPORT COMPLETE
