# QA scripts behind report A6 (Loop 15 slice three), tracked so the next QA session can rerun them

**By:** Probe (QA seat), record session 94, 2026-09-24. These are the scripts that produced
`docs/loops/loop-15-slice-3-qa-report-a6.md`, **byte-identical to the copies that ran** (compared with
`git hash-object` before commit). `qa94-a6-probe.test.ts` is v3, the last of three that ran (v1 and v2 lacked
AT-PATH-SAME and GITCONFIG-LOOP); the earlier heads are in report A6 §13. QA 92's set, `docs/loops/qa-scripts-a5/`, is reused **unchanged** for
`probe15-a5.mts`, `probe2.mts`, `probe-r57.mts`, `probe-r59.mts`, `archive.mjs`, `mkbranch.sh`, `cilog.sh`,
`tabcmp.mjs`, `rec.mjs`, `runp15.sh` and `plainsync.sh`. Only their scratchpad constant was repointed, by
`repoint.mjs` (it asserts each replacement), so they are not copied here.

## Before you run anything

1. **Hard-coded paths.** This session's scratchpad (`…/08650273-…/scratchpad/qa`) and `C:/Users/melve/Worktrees/sia-qa`
   are constants in `build6.mjs`, `runmut6.sh`, `allmut6.sh` and `mkci-mut.mjs`. Copy the directory into your own
   scratchpad and edit them with an editor, or with `repoint.mjs` (change `OLD`/`NEW`).
2. `build6.mjs` pins `SHA` to A6 `dc35b24…` and imports `mutants-a6.mjs`, which imports QA 92's `mutants-a5.mjs`
   (copy that file beside it).
3. **Never `rm -rf` an archive or mutant copy while its `node_modules` junction exists.** Remove the junction first.
4. **Run nothing beside a mutant's rows** (report A5 §12; report A6 §12).

## Files

| File | What it does | Report A6 section |
|---|---|---|
| `qa94-a6-probe.test.ts` | the POSIX probe file (v3): TRADE-SAME, TRADE-DIFF, REPOINT, HARDLINK-SAME, REUSE, UNREAD-BASE, AT-PATH-SAME, R61-UNIT, GITCONFIG-LOOP (runs on win32 too), R61-LOOP | §3.2, §3.5 |
| `qa94-handle.test.ts` | the handle re-check by a deterministic swap inside `openSync` (`vi.mock` seam), with two controls; both platforms | §3.3 |
| `qa92-a5-probe.v3.test.ts` | QA 92's Linux probe file with the two `recordChain` prints made optional (A6 removed the method); nothing else changed | §3.2 |
| `mkqa92v3.mjs` | makes the v3 file from QA 92's and asserts the two replacements | §3.2 |
| `shape.mjs <A> <B>` | structural comparison of `probe15` records across trees; **validate it on A5 vs A4 first** (r35anchorEdit must differ) | §3.1 |
| `mf.mjs <probe> <label…>` | machine findings, verdict fields and base notes per tree, normalised | §3.1 |
| `probe-r62.mts <tree>` | R62 and A5-4's sibling: NEWBETWEEN, EXISTBETWEEN, EXISTBETWEEN2 and two controls | §3.6 |
| `mutants-a6.mjs` | QA 92's set rebased onto A6, plus M-handle-narrow, the developer's six rebuilt from their diffs, four A6 equivalents of specs A6 removed, and M-drifted-off | §4 |
| `build6.mjs <mutant>` | checks the edit applies to A6's blobs **before** archiving (exit 3 = not applicable), archives, applies, asserts and reads back, runs `tsc --noEmit` | §4 |
| `runmut6.sh <mutant…>` | the six row files + `qa94-handle.test.ts` with `--reporter=json`, then each mutant's probes | §4 |
| `allmut6.sh` | build then run every applicable mutant, one at a time | §4 |
| `tabmut6.mjs [--names]` | one line per mutant; a missing JSON is printed MISSING, never zero | §4 |
| `mkci-mut.mjs` | writes M-R29-attempt6 and M-typechange6's `configwatch.ts` for the CI branches | §3.4, §4 |
| `repoint.mjs` | repoints QA 92's scripts at a new scratchpad, asserting each replacement | — |
| `rest6.sh` | M-follow-a6 and M-drifted-off, then `probe2`, `probe-r57`, `probe-r59` on A6/A5/A4, then GITCONFIG-LOOP on win32 | §3.2, §3.6, §4, §10 |
| `plainsync6.sh` | QA 92's `plainsync.sh` with the SHA repointed to A6 | §6 |

Run the probes with `node <QA tree>/open-brain/node_modules/tsx/dist/cli.mjs <script> <tree> …`.

## The Linux runs

The POSIX probes are test files on this seat's `qa/*` branches (report A6 §13 has the heads). CI is dispatched with
`gh workflow run CI --ref <branch>` (D-040), and read per test with QA 92's `cilog.sh <run-id> [pattern]`.
