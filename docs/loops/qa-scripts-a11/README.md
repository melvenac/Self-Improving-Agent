# QA scripts behind report A11 (Loop 15 slice three), tracked so the next QA session can rerun them

**By:** the QA seat, record session 130, 2026-09-26, on the QA PC `desktop-o4egb1e`, headless. These are the scripts
that produced `docs/loops/loop-15-slice-3-qa-report-a11.md`, **byte-identical to the copies that ran** (compared with
`git hash-object` before commit). The scratch directory was `C:/qa-scratch/qa130` (a Defender exclusion, like
`C:/qa-tmp`, per `drive.meta`).

Reused **unchanged**, and not copied here: QA 108's `docs/loops/qa-scripts-a10/` (`qa108-a10-probe.test.ts` blob
`1ef4dab4`, `qa108-a10-probe2.test.ts` `1df369d9`, `qa108-r61-copy.test.ts` `2e52ff8f`) and the carried QA 89–104
probes, every one taken byte-exact from `origin/qa/loop-15-slice-3-a10-probe2` (`2e029d7`).

Most scripts here are QA 108's, repointed (paths, SHA, names) and nothing else. Each one's first comment says what it came from.

## Before you run anything

1. **Hard-coded paths.** `C:/qa-scratch/qa130` and `C:/Users/Aaron Melven/Worktrees/sia-qa` are constants. Repoint.
2. **`mkbranch11.sh` needs ABSOLUTE source paths** and sets the git identity per command (this PC has none).
3. **Push only through `node docs/loops/qa-130/push-qa.mjs <branch>`** (QA 130's dispatch).
4. **Never `rm -rf` an archive or mutant copy while its `node_modules` junction exists.** Remove the junction first.
5. **Run nothing beside a mutant batch or the full suite.** `runmut11.sh` copies `probes/*.test.ts` into every mutant.
6. **The POSIX rows chmod directories to 0600 and 0000**, and restore them in `finally`/`afterEach`.

## Files

| File | What it does |
|---|---|
| `qa130-a11-probe.test.ts` | this seat's shapes for R83–R88 and R85b (see its header); prints one `Q130-<NAME> {json}` line per row |
| `mutants-a11.mjs` | the developer's mutants rebuilt on A11, this seat's `q130-*` mutants (one or more per ruling), and `FIX-q130` (a known negative) |
| `build11.mjs <mutant>` / `ARCH=<name>` | archive A11 `bbf9d07`, apply, assert the count before and after, read back, `tsc --noEmit` |
| `runmut11.sh <mutant…\|BASELINE>` | A11's config row files + carried probes + QA 108's three + this seat's probe, JSON reporter |
| `tabmut11.mjs [mutant…]` | kills and heals against BASELINE (by test name) |
| `cmpbase.mjs <a.json> <b.json>` | per-test status change between two JSON reports (QA 108's A10 baseline against A11's) |
| `mkbranch11.sh`, `mkprobe11.sh` | the probe, mutant and FIX commits, built with a temporary index; the QA tree is never touched |
| `cilog11.sh`, `cidiff11.sh`, `cidev11.sh` | fetch a CI run's log once; kills/heals between two runs; re-read the developer's runs |
| `qalines.mjs <out> [prefix]` | the probes' printed lines, ANSI stripped |
| `effort11.mjs` | model and effort, read as JSON from the driver's stream and the host transcript |
| `suite11.sh` | the full suite once in the worktree at the frozen SHA, default temp, process lists before and after |

**Changed after first use:** `qa130-a11-probe.test.ts` gained `Q130-R85-ELOOP-LABEL` after the first local baseline
(`BASELINE0`, which did not have it) and before any CI commit or the mutant batch; every CI branch carries the final blob.
