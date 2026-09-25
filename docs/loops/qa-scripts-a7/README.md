# QA scripts behind report A7 (Loop 15 slice three), tracked so the next QA session can rerun them

**By:** Probe (QA seat), record session 96, 2026-09-24. These are the scripts that produced
`docs/loops/loop-15-slice-3-qa-report-a7.md`, **byte-identical to the copies that ran** (compared with
`git hash-object` before commit). QA 94's set (`docs/loops/qa-scripts-a6/`) and QA 92's
(`docs/loops/qa-scripts-a5/`) are reused **unchanged** for:
- `mutants-a6.mjs` and `mutants-a5.mjs`, which `mutants-a7.mjs` imports;
- `probe15-a5.mts`, `probe2.mts`, `probe-r57.mts`, `probe-r59.mts` and `probe-r62.mts`;
- `archive.mjs`, `runp15.sh`, `mkbranch.sh` and `shape.mjs`;
- the probe files `qa94-a6-probe.test.ts`, `qa94-handle.test.ts` and `qa92-a5-probe.v3.test.ts`.

QA 89's file is taken from `origin/qa/loop-15-slice-3-a6-probe`. Only the scratchpad constants were repointed: by
`repoint7.mjs` (asserted), and by `sed` for `mkbranch.sh`, whose one replacement was then read back with `grep`.

## Before you run anything

1. **Hard-coded paths.** This session's scratchpad (`…/07fe8094-…/scratchpad/qa`) and `C:/Users/melve/Worktrees/sia-qa`
   are constants in `build7.mjs`, `runmut7.sh`, `allmut7.sh`, `win1.sh`, `win3.sh`, `plainsync7.sh`, `cilog.sh`,
   `mkmut7.mjs`, `devcmp7.mjs` and `applic7.mjs`. Copy the directory into your own scratchpad and repoint them
   (`repoint7.mjs`: change `OLDS`/`NEW`, add your file list).
2. **`mkbranch.sh` needs ABSOLUTE source paths.** It runs `git -C <repo> hash-object`, which resolves a relative path
   against the repository (report A7 §12).
3. **Never `rm -rf` an archive or mutant copy while its `node_modules` junction exists.** Remove the junction first.
4. **Run nothing beside a mutant's rows, and ask the planner before any local measurement.**

## Files

| File | What it does | Report A7 section |
|---|---|---|
| `qa96-a7-probe.test.ts` | ABSENT-BASE-UNIT/LOOP, TWO-NAME-LATER, WRITEONLY-LATER, R65-FACTS, R65-EVERY-LOOP, STAGE-START-UNREAD; D-042's trade (LOCKRENAME, HARDLINK-ELSEWHERE, NEW-TWO-NAME); third cases (MOVE-IN, LINK-UNLINK), BASE-TWO-NAME | §3.2, §3.4, A7-1, A7-2 |
| `qa96-seam.test.ts` | HANDLE-NLINK and its two controls: the `openSync` seam adds a second name inside `open` | A7-3 |
| `qa96-b2.test.ts` | REPO-FACTS (the repository side's unread record) and REFWATCH-REPEAT (refwatch (ii) × 20) | A7-4, §3.5 |
| `mkmut7.mjs` | writes M-R29-both, M-R67-realpath and M-R67-nlink's `configwatch.ts` for CI, with edit counts asserted | §3.3 |
| `mkall7.sh`, `push7.sh` | builds the probe/mutant commits with a temporary index; pushes, reads back with `ls-remote`, dispatches CI | §3.2, §13 |
| `mutants-a7.mjs` | QA 94's set plus A7 equivalents of the six specs A7 broke, the developer's eight rebuilt, and this seat's three | §4 |
| `applic7.mjs` | counts every spec's edits against A7's blobs (applicable / not) | §4 |
| `devcmp7.mjs` | the local rebuilds of the developer's eight (and this seat's three) are byte-identical to their branch blobs | §4 |
| `build7.mjs <mutant>` | QA 94's `build6.mjs` repointed to A7 and `mutants-a7.mjs` (asserts before archiving; `tsc --noEmit`) | §4 |
| `runmut7.sh <mutant…|BASELINE>` | the row files + seam tests with the JSON reporter, then the mutant's probes | §2, §4 |
| `allmut7.sh [mutant…]` | build, then run, one at a time; the cut list is the command line in report §4 | §4 |
| `tabmut7.mjs` | kills = reds not red at BASELINE; healed; unhandled. A missing JSON prints MISSING | §4 |
| `p15cmp7.mjs` | each mutant's probe15 verdict fields against unmutated A7 | §4 |
| `shapev.mjs A B` | `shape.mjs` with R65's per-stage rows filtered to changes only; validate on `a2` (A6-2) first | §3.1 |
| `sumjson.mjs <json>` | per-file durations, counts and failed tests from a vitest JSON report | §2 |
| `win1.sh`, `win3.sh` | the local window: archives, baseline, win32 probe files, loop probes; then checkout, build, suite | §2, §3.1, §5 |
| `plainsync7.sh` | plain `sync` and `sync --check` exit codes in a scratch clone at A7 | §6 |
| `cilog.sh <run> [pattern]` | QA 92's, plus the runner-identity lines (`Hosted Compute Agent`, `Image:`, `Runner name:`) | §3.2 |
| `repoint7.mjs` | repoints QA 92/94 scripts at this scratchpad, asserting each replacement | — |

Run the probes with `node <QA tree>/open-brain/node_modules/tsx/dist/cli.mjs <script> <tree> …`.
