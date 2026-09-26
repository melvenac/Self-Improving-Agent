# QA 122 scripts: importer fixes round 4 (candidate `78a7d13`)

Everything here ran on the QA PC `DESKTOP-O4EGB1E`, headless, with `TEMP`=`TMP`=`C:\qa-tmp` (Defender-excluded) and
all scratch work under `C:\qa-scratch\qa122` (Defender-excluded). The one full suite ran with the default temp, the
8.3 path `C:\Users\AARONM~1\AppData\Local\Temp` (the Defender-on control). The report is
`docs/loops/importer-fixes-r4-qa-report.md`.

| File | What it is |
|---|---|
| `probes-r4.mjs <worktree> <scratch>` | R4-1 through the BUILT CLI, by class. Every INBOX.md shape is **written by Windows PowerShell 5.1 itself** (cmdlets where PS 5.1 has one; a .NET encoding through PS 5.1 where it has none): IF-21's six (`>>` onto UTF-8, UTF-8 with a BOM and Windows-1252; a stray NUL; UTF-16LE and UTF-16BE with no BOM), then nine other shapes (a UTF-8 BOM then UTF-16LE, all NULs, zero bytes, zero bytes then `>>`, UTF-32LE, UTF-32BE, UTF-16LE with a BOM then `Add-Content` or `>>`, UTF-7). Each in a STALE project (INBOX.md declares Session 6, the latest log is 7) and a CURRENT one: the bytes, the `--draft` summary, the verdict and its `could_not_tell` reason (read in process from the built module's `buildImportDraft`), a bare `--commit` with the WHOLE project compared before and after (sha256, size, full `mtimeMs`, the read-only bit, with a read-only file under `.agents/notes/`), then `--commit --accept-stale` and the tasks that reached `state.json`. Then an INBOX.md held open by another process three ways, a DECISIONS.md with an ADR appended by `>>`, and IF-22's three non-blocking reasons through the CLI. Run against the candidate and `063662b` with the same arguments. |
| `state-import-qa122.test.ts` | D11 as a vitest file (bytes only, so it runs on tcm): UTF-32LE with a BOM and UTF-7, each declaring Session 6 against a latest of 7, must make a bare `--commit` refuse; plus a UTF-32BE guard. It is committed on `qa/importer-fixes-r4-d11` (`aff7135`, on `78a7d13`) and is **red on the candidate by design**. It is copied here as evidence; it is not a candidate test. |

**Run byte-exact, not copied here** (each extracted with `git cat-file -p` and checked with `git hash-object`):
- QA 106's `probes-r2.mjs` (`bf970cc`), `probe-existing-snapshot.mjs` (`e015912`), `mutants-r2.mjs` (`70e129d`) and
  `procs.ps1` (`74967e0`), from `origin/qa/importer-fixes-r2-report`;
- QA 111's `probes-r3.mjs` (`b3ecab0`) and `mutants-r3-qa.mjs` (`50cabf3`), from `origin/qa/importer-fixes-r3-report`;
- QA 102's `probes.mjs` (`a23d5d6`) and `fidelity.mjs` (`71dfd82`), from `origin/qa/importer-fixes-report`;
- the developer's `docs/loops/dev-scripts-importer-r4/mutants-r4.cjs` (`53f9419`, on `2005a3e`).

The mutant scripts ran from a worktree at `2005a3e`, whose `open-brain/` is identical to `78a7d13`'s
(`git diff --stat 78a7d13 2005a3e -- open-brain` is empty).

`evidence/` holds the raw output of every run the report cites; `timestamps.txt` holds the UTC windows.
`evidence/qa106-mutants-r2/`, `evidence/qa111-mutants/` and `evidence/dev-mutants/` hold each mutant's `git diff`.
CI logs are `evidence/ci-<run>.txt`, with ANSI codes stripped (`.txt`, because the repository ignores `*.log`).
