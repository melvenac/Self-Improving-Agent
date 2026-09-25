# QA scripts behind report A8 (Loop 15 slice three), tracked so the next QA session can rerun them

**By:** the QA seat, record session 99, 2026-09-25, on the QA PC `desktop-o4egb1e` (D-045), headless. These are the
scripts that produced `docs/loops/loop-15-slice-3-qa-report-a8.md`, **byte-identical to the copies that ran**
(compared with `git hash-object` before commit). The scratch directory was `C:/qa99` (no space in the path; the user
profile has one).

Reused **unchanged** from earlier seats, and not copied here:
- `docs/loops/qa-scripts-a7/`: `qa96-a7-probe.test.ts`, `qa96-seam.test.ts`, `qa96-b2.test.ts`, `mutants-a7.mjs`,
  `shapev.mjs`;
- `docs/loops/qa-scripts-a6/`: `qa94-a6-probe.test.ts`, `qa94-handle.test.ts`, `qa92-a5-probe.v3.test.ts` (committed
  on CI as `qa92-a5-probe.test.ts`), `mutants-a6.mjs`, `probe-r62.mts`, `shape.mjs`;
- `docs/loops/qa-scripts-a5/`: `mutants-a5.mjs`, `probe15-a5.mts`, `probe2.mts`, `probe-r57.mts`, `probe-r59.mts`;
- QA 89's `qa89-a4-probe.test.ts`, from `origin/qa/loop-15-slice-3-a6-probe`.

`mutants-a8.mjs` imports `./mutants-a7.mjs`, which imports `./mutants-a6.mjs` and `./mutants-a5.mjs`: copy all four
into one directory before use.

## Before you run anything

1. **Hard-coded paths.** `C:/qa99` and `C:/Users/Aaron Melven/Worktrees/sia-qa` are constants in most scripts.
   Search for both and repoint.
2. **`mkbranch8.sh` needs ABSOLUTE source paths** (it refuses a relative one), and it sets the git identity per
   command, because this PC has none configured and the seat does not write `~/.gitconfig`.
3. **Push only through `node docs/loops/qa-99/push-qa.mjs <branch>`** (the dispatch's rule for QA 99).
4. **Never `rm -rf` an archive or mutant copy while its `node_modules` junction exists.** Remove the junction first.
5. **Run nothing beside a mutant's rows or the full suite.**

## Files

| File | What it does | Report section |
|---|---|---|
| `qa99-a8-probe.test.ts` | R69's edges (hard link, created-then-linked, symlink same/other name, parent link XDG/HOME, case-renamed, FIFO, git config's first write, appeared-then-linked); observations (renamed into place, new parent dir, parent absent at base, move-in); R68 facts on every unread record (stable, not-a-file, unreadable stable/later, size-only, mtime-only, type in both sides); R71 texts (unreadable start/base, the "base" label) | §2, §3, A8-1 to A8-4 |
| `qa99-a8-probe.v1.test.ts` | the same file before `R68-SIZE-ONLY`/`R68-MTIME-ONLY` were added (blob `1a760243`): what the A8 probe branch and the four CI mutant branches carry | §3.2 |
| `qa99-seam.test.ts` | the `openSync` seam: R70 on an appeared file and its control; the handle record's facts; R37's gap (parent swapped inside open; the object moved out inside open) | §3.3, A8-1 |
| `mutants-a8.mjs` | the carried set, A8 equivalents of the specs A8 broke, the developer's four rebuilt, and one per R68-R71 protection | §4 |
| `applic8.mjs` | counts every spec's edits against A8's blobs (applicable / not) | §4 |
| `build8.mjs <mutant>` | archive A8, apply, assert landed and read back, `tsc --noEmit` | §4 |
| `runmut8.sh <mutant…|BASELINE>` | the row files + the seam tests + every probe file (JSON reporter), then the mutant's loop probes | §2, §4 |
| `allmut8.sh [mutant…]` | build, then run, one at a time | §4 |
| `tabmut8.mjs [mutant…]` | kills = reds not red at BASELINE; healed; unhandled. A missing JSON prints MISSING | §4 |
| `mkarch.sh <label> <sha>` | `git archive` a SHA's `open-brain`, then `npm ci` and `npm run build` in it | §1 |
| `runprobes.sh <label>` | every probe file on an archive copy (win32), JSON + verbose reporters | §2, §3 |
| `sumj.mjs <json> [filter]` | per-test status from a vitest JSON report (`MSG=1` adds the first failure line) | §2 |
| `qalines.mjs <out> [prefix]` | the probes' printed `QAnn-` lines, ANSI stripped, temp paths shortened | §3 |
| `mkbranch8.sh`, `mkprobe8.sh` | build the probe and mutant commits with a temporary index; the QA tree is never touched | §3.2, §13 |
| `cilog.sh <run> [pattern]` | fetch a CI run's log once, strip ANSI (ESC or caret form), print runner identity, totals, reds | §3.2, §5 |
| `cidiff.sh <base-run> <run>` | tests red in a mutant run and not in the A8 probe run (kills), and the reverse (healed) | §4 |
| `p15.sh`, `suite.sh`, `plainsync8.sh` | the loop probes on A8 and A7; the full suite in a worktree at A8 with process lists before and after; plain `sync` in a scratch clone | §3.4, §5, §6 |
| `shapev8.mjs A B` | QA 96's `shapev.mjs` with this PC's temp path and R68's `size`/`mtimeNs` normalised; run from the directory holding `p15-A.json` and `p15-B.json` | §3.4 |

**Two scripts changed after first use, and the change is stated here:**
- `mkprobe8.sh` gained the `QA99PROBE` override after it built the two probe commits. With the variable unset it is
  the script that built them. The four mutant commits were built with `QA99PROBE=…/qa99-a8-probe.v1.test.ts`, so they
  carry the same probe blob as the A8 probe branch.
- `qa99-a8-probe.test.ts` gained R69-FIFO-APPEAR after the first local mutant and R68-SIZE-ONLY/R68-MTIME-ONLY after
  the tenth. The final BASELINE and the re-runs of M-R68-size and M-R68-mtime carry all three (report §12).
