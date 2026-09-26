# QA 111 scripts: importer fixes round 3 (candidate `063662b`)

Everything here ran on the QA PC `DESKTOP-O4EGB1E`, headless, with `TEMP`=`TMP`=`C:\qa-tmp` (Defender-excluded) and
all scratch work under `C:\qa-scratch\qa111` (Defender-excluded). The one full suite ran with the default temp, the
8.3 path `C:\Users\AARONM~1\AppData\Local\Temp` (the Defender-on control). The report is
`docs/loops/importer-fixes-r3-qa-report.md`.

| Script | What it does |
|---|---|
| `probes-r3.mjs <worktree> <scratch>` | Round 3's protections through the BUILT CLI, by class. **R3-1:** a same-day snapshot plus `--commit` and `--commit --accept-stale` (the whole project compared with mtimes and the read-only bit); the snapshot copy itself failing (a file under `.agents/` held open by PowerShell with `FileShare.None`) with `archive/` absent, empty, holding an earlier snapshot, and under `--force-snapshot` (the aside); `--force-snapshot` plus a render failure. **R3-2:** the shapes Windows PowerShell 5.1 leaves when it APPENDS a line to an existing file (`>>` and `Add-Content`, onto UTF-8, UTF-8 with a BOM, and Windows-1252), a stray NUL, and a Windows-1251 item's content in the draft. **R3-3:** QA 106's rollback failure (PowerShell holds SUMMARY.md, share=Read), then `--draft`, `--commit`, `--commit --force-snapshot` and `--commit --accept-stale --force-snapshot`, with every original file looked for, byte-identical, in the live tree and in every directory under `archive/` after each step; then the way out exactly as the refusal words it (the paths are parsed from the message), `--commit`, and `--commit --force-snapshot`. Also a marker from an earlier day, two markers, and a marker beside a `state.json`. Run it against the candidate, `aba35de` and `65e3a89` with the same arguments. |
| `mutants-r3-qa.mjs <outdir> [id …]` | Run from `<worktree>/open-brain`. Twelve mutants the developer's `mutants-r3.cjs` does not target (Q1–Q20; Q20 is QA 106's N5 over all six files), by the developer's method: each edit must match its stated count and land, `tsc --noEmit -p .` must exit 0, then the six importer test files run through vitest's JSON reporter. The source is restored and hashed after each mutant. |
| `append-shapes.ps1` | Writes the six append shapes with Windows PowerShell 5.1 and nothing else, for the byte dump in `evidence/ps51-append-bytes.out`. |
| `procs.ps1` | QA 106's process and CPU-load listing, unchanged (blob `74967e0`), for the full suite's before and after record. Called with a forward-slash path from bash (QA 106's E5). |

**Run byte-exact, not copied here** (each extracted with `git cat-file blob` and checked with `git hash-object`):
- the developer's `docs/loops/dev-scripts-importer-r3/mutants-r3.cjs` (blob `8c5527e`, on `00244d3`), run from
  `open-brain/` in a worktree at `00244d3`, whose `open-brain/` is identical to `063662b`'s;
- QA 106's `probes-r2.mjs` (`bf970cc`), `probe-existing-snapshot.mjs` (`e015912`) and `mutants-r2.mjs` (`70e129d`),
  from `origin/qa/importer-fixes-r2-report`;
- QA 102's `probes.mjs` (`a23d5d6`) and `fidelity.mjs` (`71dfd82`), from `origin/qa/importer-fixes-report`.

`evidence/` holds the raw output of every run the report cites. `evidence/dev-mutants/` and `evidence/qa-mutants/` hold
each mutant's `git diff`.

`evidence/qa-mutants/mutants-r3-qa.out` is the one run of Q1–Q19 plus a first Q20 that did not count (`tsc` failed on
`&& false`: TS18047). `evidence/qa-mutants/Q20-rerun.out` is Q20 alone, rewritten as QA 106's N5 (`=== "never"`), and
that is the counted result. `evidence/dev-mutants/R33-write-rerun-{1,2}.out` are the developer's R33-write, run alone.
