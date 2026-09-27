# T-048 round 1: developer handoff (Forge, record 148)

**Branch** `loop/t048-r1` from `1646567`. **Candidate `7913c5f`** (red rows `a061f72`).
**Model:** Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`. **Effort:** my transcript gives no effort level, so I
am not reporting one. Fresh session: `/clear` before the dispatch, with nothing from `/bootstrap` or any earlier round.

## Audit rows against the code at `1646567`

All five rows match the code. Line numbers moved: SILENT 3 is now at `:382/:392` (unchanged), SILENT 1 at `:1083`,
SILENT 20 at `:1150`, SILENT 26 at `:1159/:1165`, and SILENT 2 at `:1245`. Four observations the audit does not make:

1. **SILENT 3: the "binary" half of the catch never fires.** `readFileSync(p, "utf-8")` does not throw on a binary: it
   decodes to U+FFFD and the file is scanned. So only an **unreadable** file ever reached that catch. The comment
   described a case that cannot happen and hid the one that can.
2. **SILENT 2 has a sibling that throws rather than drops:** `readFileSync` on each `.ts` file (`:1271`) had no try.
   An unreadable file there crashed the check. It was never a silent pass. It now gets the same named ISSUE.
3. **SILENT 1 has a sibling that throws:** the `allowed_referrers` read (`:1073`) has no try either. That is a crash,
   not a pass, so this round **did not change it**. It is still open.
4. **SILENT 20/26: `git ls-files` succeeding with zero files also fell back to the walk silently.** The fallback
   label now names that reason, alongside "git ls-files failed".

## What changed (`open-brain/src/pipelines/sync/checks.ts` only)

| Row | Now |
|---|---|
| SILENT 1 `checkRetirements` | Each scanned file is read once, and a read failure lands in `unreadable`. Any unreadable path makes the check an **issue** naming `path (CODE)`. The pass reads `0 unexpected across N live files read (<source>); excluded by extension (…): .diff 76, …; historical: K (by rule)`. |
| SILENT 20 `listScannableFiles` | **Widened** to `md ts mts cts mjs cjs js json sh ps1 yml yaml toml` (`SCANNED_EXT`). It returns every listed file, and the caller counts the rest by extension. On this tree the wider list finds **nothing new** (checked before widening: 2 non-historical candidates, 0 hits). |
| SILENT 26 `walkTracked` | Records unlistable directories and unstatable paths. The label is `listed by a filesystem walk — FALLBACK, <why>[, PARTIAL: n path(s) unreadable][, skipped n build/dependency dir(s) …]`. A partial walk is an issue. |
| SILENT 2 `checkModuleBoundary` | Unlistable directories and unreadable `.ts` files are collected **before** the graph is built. Any of them is an issue naming them. The pass adds `excluded N non-.ts file(s), not modules in the graph`. |
| SILENT 3 `checkTemplatePersonalNames` | An unreadable directory or file is an issue naming it. The pass reads `No personal names in project-template/ — N file(s) read; excluded …` and names the `node_modules`/`.git` dirs it skipped. |

## Rows: `open-brain/tests/pipelines/sync/t048-unreadable.test.ts`, 14 rows

**Mechanism:** `vi.mock("node:fs")` for this file only. `readFileSync`, `readdirSync` and `statSync` throw an
`EACCES`-shaped error for a denied path, and the denial can be scoped to specific ops. **Platform limit: none.** The
rows run on Windows and Linux alike. **They do not prove the real kernel error:** the error is synthetic, and the
property asserted is "any throw is unreadable". One row runs real `git init`/`git add` with no try/catch, so it
**requires git**, and a machine without git fails it rather than skipping it.

**At `1646567`, 13 of 14 were red (tcm run 1).** The green one is the preserve row: a readable `ENTITIES.md` still
fires. Run 2 confirmed that 12 of the 13 fail on their own assertion. The 13th (`cli.ts` unreadable) throws EACCES
out of the check at base, which is the crash in observation 2.

## Mutants (tcm run 6: one script, 13 vitest invocations of the one file)

| # | Put back | Result |
|---|---|---|
| P1 | retirements read `catch { continue }` | **SURVIVED** (see below) |
| P2 | walkTracked readdir `return out` | killed (partial-walk row) |
| P3 | walkTracked stat `continue` | killed (unstatable row, and SILENT 1 row as written then) |
| P4 | old extension regex | killed (`.sh` row) |
| P5 | drop excluded-by-extension note | killed (2 rows) |
| P6 | drop `FALLBACK` from label | killed |
| P7 | module readdir `return` | killed |
| P8 | module readFile drop | killed |
| P9 | drop module excluded count | killed |
| P10 | template readdir `return` | killed |
| P11 | template readFile swallow | killed |
| P12 | drop template read count | killed |
| P13 | drop git source label | killed |

**P1 survived because the SILENT 1 row was wrong, not the code.** It denied `docs/b.md` for all three ops, so the
walk's `statSync` refused it first and the read catch was never reached. The row was then covering P3, not P1. In
`7913c5f` it denies `readFileSync` only. **That fix is UNVERIFIED on tcm:** it came after run 6, the limit. By
reading: with the stat allowed, the file is listed, the read throws and `unreadable` gets the path, so P1 turns it red.
**It needs one run to confirm the row is green on the candidate and red under P1.** Run 7 is atlas's call, or QA's.

A second test fix after red: in run 3 the partial-walk row denied `docs` for all ops, so `statSync(docs)` refused it
before `readdirSync` could. It now denies `readdirSync` only (run 4 was spent on a script that failed before writing).

## Preserve

- **`sync --check` on this tree, base vs candidate** (the three checks' lines, from source via tsx): `retirements` is
  an **issue on both**, with identical text naming `.agents/SYSTEM/ENTITIES.md` (dream, reflection queue), so the
  readable path QA and Grok saw is intact. `module-boundary` passes on both (73 files, 52 core). The candidate adds
  `excluded 8 non-.ts file(s)`. `template-personal-names` passes on both. **No new finding.**
- `git status --porcelain` is the same before and after `sync --check`, so it stays read-only.
- Existing sync tests: `tests/pipelines/sync` is 257 of 258 green in run 3, and the one red was the partial-walk row
  above.

## Suite (tcm run 5, at the candidate minus the P1 row fix)

`tsc --noEmit -p .` exit 0, run before each commit. Full vitest: **1320 passed, 3 failed**, and all 3 are `Test timed
out in 5000ms`, in files this round does not touch (`describeRoleFiles`, `describeTreeCurrency`, `resolveRepoRoot`,
all git-subprocess tests). **I did not rerun them at base, because there was no run to spare, so "pre-existing" is
unverified.** They take about 5.1s under full-suite load.

## Runs: 6 of 6 used

1 red at base · 2 failure reasons at base · 3 tsc and sync dir · 4 failed script (wasted) · 5 tsc and full suite ·
6 mutants. No laptop or windows CI. The live `.agents/state.json` was not written. No `/end`.
