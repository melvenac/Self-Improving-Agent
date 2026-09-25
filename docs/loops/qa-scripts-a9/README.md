# QA scripts behind report A9 (Loop 15 slice three), tracked so the next QA session can rerun them

**By:** the QA seat, record session 104, 2026-09-25, on the QA PC `desktop-o4egb1e` (D-045), headless. These are the
scripts that produced `docs/loops/loop-15-slice-3-qa-report-a9.md`, **byte-identical to the copies that ran**
(compared with `git hash-object` before commit). The scratch directory was `C:/qa104` (no space in the path; the user
profile has one).

Reused **unchanged** from earlier seats, and not copied here:
- `docs/loops/qa-scripts-a8/` (QA 99): `qa99-a8-probe.test.ts`, `qa99-seam.test.ts`, `mutants-a8.mjs`, `sumj.mjs`,
  and `shapev8.mjs` (the base of `shapev9.mjs`);
- `docs/loops/qa-scripts-a7/`: `qa96-a7-probe.test.ts`, `qa96-seam.test.ts`, `qa96-b2.test.ts`, `mutants-a7.mjs`;
- `docs/loops/qa-scripts-a6/`: `qa94-a6-probe.test.ts`, `qa94-handle.test.ts`, `qa92-a5-probe.v3.test.ts` (committed
  on CI as `qa92-a5-probe.test.ts`), `mutants-a6.mjs`, `probe-r62.mts`;
- `docs/loops/qa-scripts-a5/`: `mutants-a5.mjs`, `probe15-a5.mts`, `probe2.mts`, `probe-r57.mts`, `probe-r59.mts`;
- QA 89's `qa89-a4-probe.test.ts`, from `origin/qa/loop-15-slice-3-a6-probe`.

`mutants-a9.mjs` imports `./mutants-a8.mjs`, which imports `./mutants-a7.mjs`, `./mutants-a6.mjs` and
`./mutants-a5.mjs`: copy all five into one directory before use.

## Before you run anything

1. **Hard-coded paths.** `C:/qa104` and `C:/Users/Aaron Melven/Worktrees/sia-qa` are constants in most scripts.
   Search for both and repoint.
2. **`mkbranch9.sh` needs ABSOLUTE source paths** (it refuses a relative one), and it sets the git identity per
   command, because this PC has none configured and the seat does not write `~/.gitconfig`.
3. **Push only through `node docs/loops/qa-104/push-qa.mjs <branch>`** (the dispatch's rule for QA 104).
4. **Never `rm -rf` an archive or mutant copy while its `node_modules` junction exists.** Remove the junction first.
5. **Run nothing beside a mutant's rows or the full suite.**
6. **Probe 3 leaves `.git/hooks` at mode 000 if it is killed mid-run** on POSIX. Its `afterEach` restores it; a
   killed run does not.

## Files

| File | What it does | Report section |
|---|---|---|
| `qa104-a9-probe.test.ts` | R72: the bare `before` placeholder in three shapes, the unreadable write through `runLoop`, and an unreadable repository file at the window's start. R73: facts on read records, a dangling link, the lstat-failure code, and `absent` as `before`. R74: the labels, and `type` on every fact set. The size mutant's reason: the candidate's R72 and R74 shapes, printed, with twins whose mtime is forced to move. Observations | §2, §3 |
| `qa104-a9-probe2.test.ts` | written after the first CI run: an `lstat` EACCES inside `compare()` (unit and `runLoop`), and a dangling link's bare `absent` | §3.2, A9-2 |
| `qa104-a9-probe3.test.ts` | the repository twin: a planted `core.fsmonitor` plus `.git/hooks` at mode 000, through `runLoop`, with a control showing the planted program fires | §3.1, A9-1 |
| `qa104-seam.test.ts` | the `openSync` seam: the gained-a-name text on the base route and the single-name route, a lost name, and a swapped-file control | §3.3 |
| `mutants-a9.mjs` | the carried set, A9 equivalents of the specs A9 broke, the developer's seven rebuilt, one per R72–R74 protection, and `FIX-before-facts` (a known negative, not a mutant) | §4 |
| `applic9.mjs` | counts every spec's edits against A9's blobs (applicable / not) | §4 |
| `build9.mjs <mutant>` | archive A9, apply, assert landed and read back, `tsc --noEmit` | §4 |
| `runmut9.sh <mutant…\|BASELINE>` | the row files + the seam tests + the probe files (JSON reporter), then the mutant's loop probes | §2, §4 |
| `allmut9.sh [mutant…]` | build, then run, one at a time | §4 |
| `tabmut9.mjs [mutant…]` | kills = reds not red at BASELINE; healed; unhandled. A missing JSON prints MISSING | §4 |
| `mkarch9.sh <label> <sha>` | `git archive` a SHA's `open-brain`, then `npm ci` and `npm run build` in it | §1 |
| `runprobes9.sh <label>` | every probe file on an archive copy (win32), JSON + verbose reporters | §2, §3 |
| `qalines9.mjs <out> [prefix]` | the probes' printed `QAnn-` lines, ANSI stripped, temp paths shortened | §3 |
| `mkbranch9.sh`, `mkprobe9.sh` | build the probe and mutant commits with a temporary index; the QA tree is never touched | §3.4, §13 |
| `cilog9.sh <run> [pattern]` | fetch a CI run's log once, strip ANSI (ESC or caret form), print runner identity, totals, reds | §3.4, §5 |
| `cidiff9.sh <base-run> <run>` | tests red in a run and not in the base run (kills), and the reverse (healed) | §4 |
| `p15-9.sh`, `suite9.sh`, `plainsync9.sh` | the loop probes on A9 and A8; the full suite in a worktree at A9 with process lists before and after; plain `sync` in a scratch clone | §3.5, §5, §6 |
| `shapev9.mjs A B` | QA 99's `shapev8.mjs`, plus R73/R74's labels normalised; `NOMF=1` drops the machine findings, so the victim, token and in-record fields are compared alone | §3.5 |
| `cmpj9.mjs <prefix> A B` | a field-by-field diff of two probe JSON outputs (p2, r57, r59, r62), after the same normalising | §3.5 |
| `effort9.mjs` | the model and effort, read as JSON from the driver's stream and the host transcript | §0.1 |
| `ca9.sh` | CA-9's pin, run against this PC's `claude` 2.1.282 by putting its directory on `PATH` for that one test | §7 |

**Changed after first use, and the change is stated here:**
- `qa104-a9-probe.test.ts` gained the four R75-SIZE-REASON tests after its first two local runs (06:56Z on A9, 06:57Z on
  A8), and before the BASELINE and every CI commit. Every CI branch carries the final blob `e2193d85`.
- `mkprobe9.sh` gained the `probe2`, `probe3` and `probe3-on-a8` cases, and its file list `P` gained probe 2 and then
  probe 3, as those files were written. Each commit was built with the list as it stood then:
  `qa/loop-15-slice-3-a9-probe` and `-probe-on-a8` without probe 2 and 3; `-probe2` and `-m-dev9-size` with probe 2;
  the rest with both. `git ls-tree` of each branch shows which.
- `shapev9.mjs`: a `sed` edit to add the label normalising did nothing; the edit was then made by hand, before its first
  use (report §12).
