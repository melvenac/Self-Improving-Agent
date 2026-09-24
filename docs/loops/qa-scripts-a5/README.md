# QA scripts behind report A5 (Loop 15 slice three), tracked so the next QA session can rerun them

**By:** Probe (QA seat), record session 92, 2026-09-24. These are the scripts that produced
`docs/loops/loop-15-slice-3-qa-report-a5.md`, **byte-identical to the copies that ran** (compared with
`git hash-object` before commit). The A4 set they extend is `docs/loops/qa-scripts-a4/`.

## Before you run anything

1. **Hard-coded paths.** Two constants hold this session's scratchpad `.../0a0b5075-.../scratchpad/qa` and
   `C:/Users/melve/Worktrees/sia-qa`: `S` and `REPO`, in `archive.mjs`, `build.mjs` and `runmut.sh`. The same
   scratchpad path is also in `runp15.sh`, `inforefs.sh`, `plainsync.sh`, `cilog.sh` and `mkbranch.sh`.
   - Copy the directory into your own scratchpad, and edit those constants with an editor, not `sed`.
   - `build.mjs` pins `SHA` to A5 `4c1287f…`, and it imports `mutants-a5.mjs`.
   - **Never run the probes inside a checkout.**
2. **Never `rm -rf` an archive or mutant copy while its `node_modules` junction exists.** Remove the junction first,
   with a non-recursive `rmdirSync`.
3. **Run nothing beside a mutant's rows.** Report A5 §12: this seat's own probe, running concurrently, reddened an
   unrelated test.

## Files

| File | What it does | Report A5 section |
|---|---|---|
| `archive.mjs <label> <sha>` | `git archive <sha> open-brain` into `arch/<label>`, and junctions `node_modules` | header, §3 |
| `probe15-a5.mts <open-brain tree> <probe…>` | report A4's `probe15-a4.mts` plus **r35edit** and **r35anchorEdit** | §3.1 |
| `runp15.sh <label…>` | all 31 probes, per archive copy | §3.1 |
| `probe2.mts` | unchanged from A3/A4: H, R34, SINGLE, DFORK, DMGconfig/head/index, COMPOSE | §2, §10 |
| `route.mts <tree>` | prints the route `recordChain` records for an anchor junction and a mid junction (A5-1 mechanism (b)) | §3.4 |
| `probe-r59.mts <tree>` | R59's rollBack sentence in both directions: SNEAKY, CFGONLY, BOTH | §3.5 |
| `probe-r57.mts <tree>` | A5-4: a file absent at base appears before a stage and is unchanged in it (NEWBETWEEN), plus its CONTROL | §3.6 |
| `inforefs.sh` | watches the R19 test's own setup for a background `.git/info` writer (none found) | §3.6 |
| `mutants-a5.mjs` | report A4's mutant specs, re-asserted at A5 by count, plus M-R55-route, M-R55-realpath, M-R57, M-R59-read, M-R59-revert, M-R59-never | §4 |
| `build.mjs <mutant>` | archives the SHA, applies the edits, **asserts each landed and reads it back**, runs `tsc --noEmit` | §4 |
| `runmut.sh <mutant…>` | the six candidate row files with `--reporter=json`, then each mutant's probes | §4 |
| `tabcmp.mjs`, `rec.mjs`, `tabmut-a4.mjs`, `failmsg.mjs` | summarisers, unchanged from A4 (run from the scripts directory) | §3, §4 |
| `mkbranch.sh <base> <msg> <path>=<file>…` | builds a commit = base + files with a **temporary index**, so the QA tree is never touched | §3.2 |
| `cilog.sh <run-id> [pattern]` | fetches a CI run's log once, strips ANSI, and prints summary, failures and matching per-test lines | §3.2, §5 |
| `plainsync.sh` | plain `sync` and `sync --check` exit codes in a scratch clone at the candidate | §6 |
| `qa92-a5-probe.test.ts` | the Linux probe file as run at `dfbac1b` (`qa/loop-15-slice-3-a5-probe`); QA 89's file runs beside it unchanged | §3.2 |

Run the probes with `node <QA tree>/open-brain/node_modules/tsx/dist/cli.mjs <script> <tree> …`.

## The Linux runs

The POSIX probes are test files on this seat's `qa/*` branches. CI is dispatched with
`gh workflow run CI --ref <branch>` (D-040):

| Branch | What it holds |
|---|---|
| `qa/loop-15-slice-3-a5-probe` | A5 + QA 89's file + `qa92-a5-probe.test.ts` |
| `qa/loop-15-slice-3-a5-probe-on-a4` | A4 + the same two files |
| `qa/loop-15-slice-3-a5-mut-r55route` | A5 + M-R55-route's `configwatch.ts` + both files |
| `qa/loop-15-slice-3-a5-mut-r55realpath` | A5 + M-R55-realpath's `configwatch.ts` + both files |
| `qa/loop-15-slice-3-a5-mut-gate` | A5 + M-R49-machine's `configwatch.ts` + both files |
| `qa/loop-15-slice-3-a5-head` | exactly `4c1287f`, for CI on the candidate's own head |

## For the next candidate

- **The known positives.** For A5-1, **A5 `4c1287f` is the positive** (`35952428545`, and win32 r35anchorEdit), and A4 is
  the negative for seven of its eight Linux shapes. For A5-4, A5 is the positive by `probe-r57.mts`. For A4-1, A4
  remains the positive.
- **Print the route.** A route whose last entry is not `realpath(p)` is A5-1's class, whatever the record says.
