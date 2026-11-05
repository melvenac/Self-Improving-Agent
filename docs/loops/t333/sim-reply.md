SIM sim-t333 DONE

Result: 3 of 8 steps differed from prediction (step 4, step 6 twice over). Details below. Environment note: this runner is Linux/bash (not PowerShell); commands were translated 1:1 (`cp` for Copy-Item, `/tmp/t333-er.bak` for `$env:TEMP`). START verified: `git rev-parse HEAD` = 9d3c0f1d06d377c2ba34151746d481cf27886bc8.

## 1. Toolchain
- `node -v` -> `v22.22.1`
- `npm ci` in open-brain: completed (only the npm-audit trailer printed).
- `node -e "require('better-sqlite3')"`: printed nothing (loads). No rebuild needed.

## 2. Apply
- `node docs/loops/t333/apply.cjs . docs/loops/t333/edits.txt` -> `APPLIED 4 edits to 3 files`
- Test file copied to open-brain/tests/pipelines/store/t333-evidence-repos.test.ts.

## 3. Type-check and build
- `npx tsc --noEmit` -> exit 0
- `npx tsc -p tsconfig.tests.json --noEmit` -> exit 0
- `npm run build` -> exit 0 (`build stamped 9d3c0f1`)

## 4. The two files (+ cli-args)  -- DIFFERS FROM PREDICTION
`npx vitest run tests/pipelines/store/t333-evidence-repos.test.ts tests/pipelines/store/t332-evidence-report.test.ts tests/shared/cli-args.test.ts --no-file-parallelism --testTimeout=180000`
- `Test Files  1 failed | 2 passed (3)`
- `Tests  1 failed | 108 passed (109)`
- t333 R1-R7: 7/7 pass. t332: 7/7 pass.
- Failed row: `tests/shared/cli-args.test.ts > the declarations agree with the usage text the CLI prints > every flag evidence-report declares is documented on its own usage line`
  `AssertionError: evidence-report declares --repos-under: expected [ '--db', '--days', '--as-of', …(1) ] to include '--repos-under'`
- Cause (read from src/cli.ts:660): the evidence-report usage line still lists only `--db --days --as-of --repo`. edits.txt added the two flags to the spec but not to the usage text, so `--repos-under` and `--runs-repo` are undocumented on that line. A gap in the edit set, not in the new code.

## 5. Mutants (each: `APPLIED 1 edits to 1 files`, restored from backup afterward)
| mutant | failed rows | predicted | match |
|---|---|---|---|
| m1 | R2 (`expected false to be true`) | R2 only | yes |
| m2 | R2 (`expected true to be false`) | R2 only | yes |
| m3 | R2 (`expected false to be true`), R7 (`expected 'evidence report (shadow: nothing is g…' to contain 'entries: 1 live; evidenced 1 '`) | R2, R7 | yes |
| m4 | R6 (`expected [Function] to throw an error`) | R6 only | yes |
| m5 | R4 (`expected [] to deeply equal [ '/tmp/t333-xftMDg/empty' ]`) | R4 only | yes |

Each run: 1 failed (m3: 2 failed) | rest passed, of 7.
Rerun of the step 4 command after the last restore: `Test Files  1 failed | 2 passed (3)`, `Tests  1 failed | 108 passed (109)`. Same single cli-args failure as step 4, not 0 failed as predicted; t333 and t332 files green, so the restore is clean.

## 6. Full suite -- DIFFERS FROM PREDICTION
`npx vitest run --no-file-parallelism --testTimeout=180000` (exit 0 from the wrapper; finished well inside the 60-minute cap)
- `Test Files  3 failed | 359 passed (362)`
- `Tests  3 failed | 4987 passed | 7 skipped (4997)`
- No `Unhandled Errors` section. No `Timeout calling onTaskUpdate` lines (grep returned none), so T-292's flake rule is not triggered.
- Failed rows:
  1. `tests/shared/cli-args.test.ts > ... every flag evidence-report declares is documented on its own usage line` -- same as step 4 (`--repos-under` missing from usage).
  2. `tests/harness/s4-guards.test.ts > slice four guards > D1b the real tree has no untracked file under open-brain/tests...`
     `AssertionError: expected 'open-brain/tests/pipelines/store/t333…' to be ''`; received `open-brain/tests/pipelines/store/t333-evidence-repos.test.ts`. This is caused by step 2 itself: the brief has the test copied in untracked, and the guard rejects untracked tests. It will be red in any run that follows the brief literally; it goes away once the file is committed.
  3. `tests/harness/checks.test.ts > defaultChecks — D4 > the default BUILD check spawns successfully against a repo that has the scripts`
     `AssertionError: default build check did not run: exit 1 in 512ms; last stderr line: npm ERR!     /home/dashjobs/.npm/_logs/2026-11-05T06_04_39_822Z-debug-0.log: expected 1 to be +0`
     Rerun alone once (`vitest run tests/harness/checks.test.ts`): same failure (`exit 1 in 411ms`), 1 failed | 23 passed. Deterministic here, not a flake. I did not investigate it further; it spawns npm in a scratch repo and looks unrelated to T-333 (no touched file is in its path), but I have NOT run it on an unpatched START checkout to confirm it is pre-existing. NOT RUN: baseline comparison.

## 7. Sync
`node open-brain/build/cli.js sync 2>&1 | Select-String ...` (grep -E equivalent):
- `retirements [pass]: 11 retirements across 6 event classes, 75 allowed referrers all present and still naming their retirement, 0 unexpected across 657 live files read ...`
- `module-boundary [pass]: core does not import memory (165 file(s), 129 core; ...)`
Both `[pass]`, as predicted.

## 8. Timing
`npx tsx -e "... repoSetResolver([process.cwd()+'/..']) ..."` ->
`1 0 33 ms`
(1 repo found, 0 skipped, 33 ms.)

## Summary of deviations
1. cli.ts usage line for evidence-report lacks `--repos-under` / `--runs-repo` -> cli-args test red (steps 4, 5-rerun, 6). Fix is a usage-text edit; the brief's edit set omits it.
2. s4-guards D1b red from the untracked copied test (procedural, expected once committed).
3. harness/checks D4 red on this Linux runner, reproduced on rerun; baseline not checked.
Nothing was committed, pushed, stashed or reset. Working tree is left with the 4 applied edits (3 modified src files + 1 untracked test).
