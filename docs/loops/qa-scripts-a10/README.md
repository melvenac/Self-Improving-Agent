# QA scripts behind report A10 (Loop 15 slice three), tracked so the next QA session can rerun them

**By:** the QA seat, record session 108, 2026-09-25, on the QA PC `desktop-o4egb1e` (D-045), headless. These are the
scripts that produced `docs/loops/loop-15-slice-3-qa-report-a10.md`, **byte-identical to the copies that ran**
(compared with `git hash-object` before commit). The scratch directory was `C:/qa-scratch/qa108` (a Defender
exclusion, like `C:/qa-tmp`, per `drive.meta`).

Reused **unchanged** from earlier seats, and not copied here:
- `docs/loops/qa-scripts-a9/` (QA 104): `qa104-a9-probe.test.ts`, `qa104-seam.test.ts` (their probe2 and probe3 are in
  the candidate's tree, byte-identical), and the bases of `cilog10.sh`, `cidiff10.sh`, `build10.mjs`, `mkbranch10.sh`,
  `mkprobe10.sh`, `p15-10.sh`, `shapev10.mjs`, `cmpj10.mjs`, `effort10.mjs`, `plainsync10.sh`;
- `docs/loops/qa-scripts-a8/` (QA 99): `qa99-a8-probe.test.ts` (blob `25aa8693`), `qa99-seam.test.ts`;
- `docs/loops/qa-scripts-a7/`: `qa96-a7-probe.test.ts`, `qa96-seam.test.ts`, `qa96-b2.test.ts`;
- `docs/loops/qa-scripts-a6/`: `qa94-a6-probe.test.ts`, `qa94-handle.test.ts`, `qa92-a5-probe.v3.test.ts` (committed on CI
  as `qa92-a5-probe.test.ts`), `probe-r62.mts`;
- `docs/loops/qa-scripts-a5/`: `probe15-a5.mts`, `probe2.mts`, `probe-r57.mts`, `probe-r59.mts`;
- QA 89's `qa89-a4-probe.test.ts`, from `origin/qa/loop-15-slice-3-a9-probe3`.
Every carried probe was taken from `origin/qa/loop-15-slice-3-a9-probe3` (QA 104's last probe branch).

## Before you run anything

1. **Hard-coded paths.** `C:/qa-scratch/qa108` and `C:/Users/Aaron Melven/Worktrees/sia-qa` are constants in most
   scripts. Search for both and repoint.
2. **`mkbranch10.sh` needs ABSOLUTE source paths**, and sets the git identity per command (this PC has none configured,
   and the seat writes no git config).
3. **Push only through `node docs/loops/qa-108/push-qa.mjs <branch>`** (the dispatch's rule for QA 108).
4. **Never `rm -rf` an archive or mutant copy while its `node_modules` junction exists.** Remove the junction first
   (`cmd /c rmdir <junction>`).
5. **Run nothing beside a mutant's rows or the full suite.** `runmut10.sh` copies `probes/qa108-a10-probe.test.ts` into
   every mutant: do not edit it while a batch runs (report §12).
6. **The POSIX rows chmod directories to 0600, 0100, 0000 and 0555.** Each restores the mode in `finally`/`afterEach`;
   a killed run does not.

## Files

| File | What it does | Report section |
|---|---|---|
| `qa108-a10-probe.test.ts` | R77 per helper (identify, listTree, readState, the stop before git) with a `spawnSync` spy that counts git calls after the role; the old path (hard-link and symlink shapes); R82 (POSIX EACCES shapes, win32 junction/ENOENT shapes); R79's placeholders; R80's link facts on every platform; R61's shape on win32; QA 99's R71 rows in R79's form | §3.1–§3.4, §3.6 |
| `qa108-a10-probe2.test.ts` | written after CI run `36200429242`: begin's null snapshot (a user's hook in a hooks dir already 0600) | §3.1, A10-1b |
| `qa108-r61-copy.test.ts` | the candidate's R61 row, verbatim, without its win32 skip, to measure its detector under mutants here | §3.4 |
| `mutants-a10.mjs` | the developer's kill set rebuilt on A10, this seat's mutants, and three FIX builds (known negatives, not mutants) | §4 |
| `build10.mjs <mutant>` | archive A10, apply, assert landed and read back, `tsc --noEmit` | §4 |
| `runmut10.sh <mutant…\|BASELINE>` | the row files + carried probes + this seat's (JSON reporter) | §2, §4 |
| `tabmut10.mjs [mutant…]` | kills = reds not red at BASELINE; healed; a missing JSON prints MISSING | §4 |
| `mkbranch10.sh`, `mkprobe10.sh` | build the probe, mutant and FIX commits with a temporary index; the QA tree is never touched | §3.5, §13 |
| `cilog10.sh <run> [pattern]` | fetch a CI run's log once, strip ANSI, print runner identity, totals, reds | §3.5, §5 |
| `cidiff10.sh <base-run> <run>` | kills and heals between two runs, by test name | §3.5 |
| `cidev10.sh <run…>` | re-read the developer's runs: head, runner, totals, reds | §5.2 |
| `qalines.mjs <out> [prefix]` | the probes' printed `Q108-` / `QAnn-` lines, ANSI stripped (`FAIL=1` adds the failure blocks) | §3 |
| `w32codes10.mjs` | the error codes win32 gives for odd link targets | §3.2 |
| `p15-10.sh`, `shapev10.mjs`, `cmpj10.mjs`, `retest.mjs` | QA 92's 31 loop probes, probe2, r57, r59, r62 on the A10 and A9 archives; the comparators with this run's `C:\qa-tmp` normalised, and the table test of that normalisation | §3.6 |
| `suite10.sh`, `plainsync10.sh` | the full suite once in the worktree at the frozen SHA, default temp, process lists before and after; plain `sync` in a scratch clone | §5.1, §6 |
| `effort10.mjs` | the model and effort, read as JSON from the driver's stream and the host transcript | §0.1 |
| `ca9-10.sh` | CA-9's pin against this PC's `claude` 2.1.282, put first on `PATH` for the one test (first run inline, then re-run from the file) | §2, §7 |

`w32codes10.mjs` and `ca9-10.sh` were first run inline with the same code, then saved and re-run from the file; the
report quotes the file runs (and says where the inline run differed: the UNC code, §3.2).

**Changed after first use, and the change is stated here:**
- `qa108-a10-probe.test.ts` gained, before its first CI commit: the fixes to two of my own assertions (report §12), the
  R79-ANCESTOR-*, R79-ELOOP-ALONE, R79-FILE000-ALONE and FIFO rows, and R82-ELOOP's assertion. Every CI branch carries the
  final blob `1ef4dab4`.
- `mutants-a10.mjs` gained `FIX-q108-all` after CI run `36200429242` and `FIX-q108-all2` after `36201157136`, each
  appended at the end; the batch of 28 had already been built. Four block mutants' neutraliser changed from a leading
  `false &&` (which failed `tsc`) to a trailing `&& process.pid < 0` before their builds in the table.
- `mkprobe10.sh` gained the `probe2` case after probe 2 was written.
- `qalines.mjs`'s line cut was raised from 4 000 to 30 000 characters after three long lines were cut.
