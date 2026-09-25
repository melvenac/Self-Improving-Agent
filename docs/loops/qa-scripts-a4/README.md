# QA scripts behind report A4 (Loop 15 slice three), tracked so the next QA session can rerun them

**By:** Probe (QA seat), record session 89, 2026-09-23. These are the scripts that produced
`docs/loops/loop-15-slice-3-qa-report-a4.md`, **byte-identical to the copies that ran** (compared with
`git hash-object` before commit). The A3 set they extend is `docs/loops/qa-scripts-a3/`.

## Before you run anything

1. **Hard-coded paths.** `S` (this session's scratchpad `.../scratchpad/qa`) and `REPO` (`C:/Users/melve/Worktrees/sia-qa`)
   are set in `archive.mjs`, `build.mjs` and `runmut.sh`. Copy the directory into your own scratchpad and edit those
   three constants with an editor, not `sed` (report A3 §12, report A4 §12). **Never run the probes inside a
   checkout.** Every probe makes its victims, repositories and scratch `HOME` under `os.tmpdir()`.
2. **Never `rm -rf` an archive or mutant copy while its `node_modules` junction exists.** Remove the junction first
   with a non-recursive `rmdirSync`.
3. **The summarisers are run from the scripts directory** (`p15-<label>.json`, `mut/<mutant>.*` are relative).

## Files

| File | What it does | Report A4 section |
|---|---|---|
| `archive.mjs <label> <sha>` | `git archive <sha> open-brain` into `arch/<label>`, junctions `node_modules` from the QA tree | header, §3 |
| `probe15-a4.mts <open-brain tree> <probe…>` | report A3's `probe15.mts` (unchanged, `docs/loops/qa-scripts-a3/`) plus **newHook, baseHardCfg, baseHardEdit, r54Twice, r54Revert, machineReplace, plannerPlant, r35anchor, hooksReplacedHard, ca4fBase** | §3.1 |
| `probe2.mts` | unchanged from A3: H, R34, SINGLE, DFORK, DMGconfig/head/index, COMPOSE | §2, §10 |
| `mutants-a4.mjs` | mutant edit specs against A4 `f9a1aa8`: A3's set (two re-derived for A4's text) plus M-R49-repo/machine/both, M-R49-repo+M-R43-repo, M-R54, M-R50, M-R50+agrees(-v2), M-R51-refuse-cmd, and `M-R51-refuse-cmd@a3` (a `{sha, edits}` entry: archives `5010199`) | §4 |
| `build.mjs <mutant>` | archives the SHA, applies the edits, **asserts each landed and reads it back**, runs `tsc --noEmit` | §4 |
| `runmut.sh <mutant…>` | the six candidate row files with `--reporter=json`, then each mutant's probes | §4 |
| `tabcmp.mjs <label…>` | one line per probe per tree, verdict fields only | §3.1 |
| `rec.mjs <label> <probe…>` | the record text (config verdicts, machine findings, reason) | §3.4 |
| `tabmut-a4.mjs <mutant…>`, `failmsg.mjs <mutant> <title part>` | red tests and probe outcomes per mutant; one test's failure message | §4 |

Run the probes with `node <QA tree>/open-brain/node_modules/tsx/dist/cli.mjs probe15-a4.mts <tree> <probes>`.

**The POSIX probe** (A4-1, and R52's rows in their own shapes) is not here: it is a test file on the branch
`qa/loop-15-slice-3-a4-probe` (`9f58fbc`, `open-brain/tests/harness/qa89-a4-probe.test.ts`), run by CI with
`gh workflow run CI --ref qa/loop-15-slice-3-a4-probe` (D-040). Its observations are printed as `QA89-…` lines.

## For the next candidate

- **Rebase the mutant specs.** `build.mjs` pins `SHA = f9a1aa8…`, and the `find` strings are A4's text. The builder
  refuses an edit whose `find` count is wrong. Re-derive it; do not loosen the count.
- **The known positives.** For A4-1, **A4 `f9a1aa8` is the positive** (CI run `35928008495`). For A3-1, A3-2 and A3-3,
  A3 `5010199` is. The in-test control (A4-1 CONTROL) is the instrument's own positive.
- **A read hidden behind attribution text passes every record-based probe** (report A4 §3.4). Read the gate by the
  code path.
