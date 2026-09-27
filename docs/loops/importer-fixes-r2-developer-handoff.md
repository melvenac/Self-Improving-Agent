# Importer fixes, round 2: developer handoff

**By:** Forge (Claude developer seat), record session 105, 2026-09-25. Worktree `~/Worktrees/sia-infra`.
**To:** Atlas (planner), and the QA seat that scores it.
**Brief:** `docs/loops/importer-fixes-round-2-brief.md`, read on `origin/docs/session-100-qa99-dispatch`. QA 102's report
was read in full on `origin/qa/importer-fixes-report`, together with round 1's brief and handoff.
**Model and effort, read from this session's transcript** (`f6463e54-a2e9-4b93-b596-cdecf5439737.jsonl`, 245
assistant records): `claude-opus-5-5` and effort `medium` on every record.

## 1. Frozen candidate

**`aba35de`** (`loop/importer-fixes-r2`, and the CI pointer `loop/importer-fixes-r2-ci` at exactly that SHA), branched
from `origin/loop/importer-fixes` `65e3a89` (round 1's candidate `f6b6d44` plus its handoff). Every push was read back
with `ls-remote`. This handoff is committed on top of `aba35de` and touches only this file.

| Commit | Item | What |
|---|---|---|
| `c3e3297` | tests, red first | Rows IF-9 to IF-13 as tests: `state-import-r2.test.ts`, `state-import-atomic.test.ts`. Pushed alone as `loop/importer-fixes-r2-redcheck` (IF-14). |
| `a1269b2` | R2-1 (D2) | One decode point for every input text. |
| `8942261` | R2-2 | A declared session ahead of the latest log is *could not tell*. |
| `7fac365` | R2-3 (D3) | `--commit` completes or rolls back. Missing view directories are created. |
| `f021519` | R2-4 (D4) | `state import` refuses an unknown `-` token, a second positional, and a missing directory. |
| `8723ccf` | R2-5 (D1) | Round 1's typo assertion now names the refusal's own words, and a snapshot-copy failure point is added. The M6 and M13–M16 guards themselves are in `c3e3297`. |
| `aba35de` | R2-1, follow-up | `TextDecoder` gets `ignoreBOM: true`, so the explicit BOM strip is the only protection (mutant N1, §4). |

The CHANGELOG entries sit under round 1's `## [0.44.3] - Unreleased`, in a new *Fixed in round 2* block. **There is no
version bump and no tag** (D-019).

## 2. By item

### R2-1: an encoding detail never turns a STALE input into "could not tell"

**The class is "bytes read as text without being decoded".** The importer read every input with
`readFileSync(p, "utf-8")`, and each parser then matched the first line with `startsWith`. **The fix is one point,
`decodeText` / `readText`, which every input read now goes through:**

- **A UTF-8 BOM** is dropped. This is QA's D2. **Found while mutating:** `TextDecoder` drops a UTF-8 BOM by default
  (`ignoreBOM: false`). The first version therefore had two strips, the explicit `subarray(3)` and the decoder's
  default, and deleting either left every test green (N1 survived). **The decoder now runs with
  `ignoreBOM: true`, so the explicit strip is the only protection**, and its mutant turns 4 tests red. A protection
  that no test can see fail is not a protection (the planner's ruling, 2026-09-25).
- **UTF-16 with a BOM**, LE or BE, is decoded. Windows PowerShell 5.1's `>` and `Out-File` write UTF-16LE with a BOM
  by default, so this is the likelier encoding on this machine than a UTF-8 BOM. It was unhandled: such a file read
  as NUL-interleaved text and fell into "could not tell" under the same false reason.
- **Neither valid UTF-8 nor BOM-marked UTF-16** (for example, UTF-16 without a BOM, or Latin-1): a judged input is
  *could not tell*, and **the reason names the encoding**, not "names no `Session N`". It does not block, which follows
  ruling 1 for "could not tell". The reason is at least true.
- **CRLF needs nothing.** Every split in the module is `\r?\n`, which matches QA's CRLF probe. **A lone-CR (classic
  Mac) file is not handled.** It would read as one line and give "could not tell" with the false reason "names no
  `Session N`". I judged it too rare to add, and name it here instead.

**The three `findIndex` sites the brief named:**
- `:387` (`declaredSession`, now `:433`) is the defect. Its text now arrives decoded.
- `:530` (`planSummaryRemoval`) **had the same defect.** A BOM-led SUMMARY.md kept its status blockquote after
  `--commit`, and the draft reported 0 blockquote lines. Fixed by the same read.
- `:284` (`importObjective`) **had it only when `## Current Objective` is the file's first line.** Fixed by the same
  read, and tested.
- **Other siblings the same read fixes:** `findLastSession` read the latest log with `readFileSync`, so a BOM-led log
  lost its date (`^# Session …` with `/m`). It is tested. The INBOX and handoff parsers get decoded text too.

**SUMMARY.md is written back as plain UTF-8, whatever it was read as.** The original bytes are in the snapshot. Right
after the importer, the renderer inserts its marked region, and it finds the title with the same
`lines.findIndex(l => l.startsWith("# "))` (`state-views/index.ts:223`, `applySummaryRegion`). **A BOM kept there would
put the rendered region above the title**, as a test saw on the first attempt. **I did not change `applySummaryRegion`:
GitNexus rates its upstream impact HIGH** (`ob_state`'s `handleState` and `/sync`'s `checkSummary`). An `ob_state`
write to a BOM-led SUMMARY.md that did not come through the importer still has the defect. **It is proposed as a task
(§7).** `--commit` also **refuses before any write** when SUMMARY.md cannot be decoded, because it rewrites that file
in place and would otherwise write replacement characters into it.

### R2-2: an input ahead of the latest log is not "current"

`d.n > latest.n` is now *could not tell*, with evidence of the form: `line 3 declares Session 20 (…); the latest session
log is Session 7 (…). It declares a session AHEAD of the latest log, so the numbers disagree and cannot say whether it
is current`. Equal is still current, and lower is still stale.

### R2-3: complete, or change nothing

**Design: a rollback from the snapshot, plus creating the missing directories.** Neither alone meets the invariant.
- **Creating `SESSIONS/`, `TASKS/` and `SYSTEM/` before rendering** makes PROBE-2 *complete*. A project without
  `SESSIONS/` can import; it is not refused.
- **But the invariant covers every step, not that one directory.** Every write after the snapshot (state.json, the
  SUMMARY surgery, the directories, the render of four views, and the moves into the snapshot) runs inside one
  `try`. On any failure, `.agents/` outside `archive/` is deleted and copied back from the snapshot. Then the snapshot
  is removed, and `archive/` is removed too if this run created it. The error says `Rolled back: .agents/ was restored
  from the snapshot, and the snapshot removed, so nothing changed`.
- **The snapshot is removed only after the restore has finished.** If the restore fails part-way, the error says
  `ROLLBACK FAILED … Restore it by hand from <snapshot>, which was kept`. This path is not tested (§6).
- **A failure inside the snapshot copy itself** removes the partial snapshot, and `archive/` if the run created it.
  `.agents/` outside `archive/` has not been touched at that point.
- **`--force-snapshot`** used to merge into an existing snapshot directory. The earlier snapshot is now moved aside
  first, put back on failure, and deleted on success. The new snapshot replaces it instead of merging, which is what
  the flag's help text says.
- **Why not "refuse before the snapshot".** That fixes PROBE-2 and nothing else. Any other failure after the snapshot,
  such as a locked file, a full disk or a render refusal, would still half-migrate.

**Failures induced (`state-import-atomic.test.ts`, through a `node:fs` mock, so the importer carries no test seam):**
the state.json write, the SUMMARY.md write, the renders of `task.md` and of `next-session.md`, the move of the draft,
and the snapshot copy. After each one, the tree is **byte-identical** to before, and the second run completes. The
`--force-snapshot` case is also tested.

**One further failure, induced through the built CLI rather than a mock:** SUMMARY.md made read-only (win32
`chmod 0o444`), so the in-place rewrite fails after the snapshot. The result was exit 1, `EPERM … Rolled back:
.agents/ was restored from the snapshot, and the snapshot removed, so nothing changed`. The tree was byte-identical
to before, including the read-only bit. With the file made writable again, the second `--commit` exited 0.

**If the rollback itself fails:** the snapshot is **kept**, and the error says `ROLLBACK FAILED (<cause>): .agents/ is
part-migrated. Restore it by hand from <snapshot path>, which was kept`. The project is then in the state D3
described, but it names its own repair. **This path is not exercised by any test.** Inducing it means failing the
restore's `rmSync`/`cpSync` after a first failure, and I did not build that.

### R2-4: exactly the project named

`cli.ts`, `state import` only:
- **Any token starting with `-` that is not one of the four known flags refuses.** Before, only `--` tokens were
  checked.
- **More than one positional refuses.** PROBE-12's `accept-stale` placed before the directory is caught here.
- **A positional that is not an existing directory refuses**, naming what it resolved to. PROBE-5b's `accept-stale`
  on its own is caught here.
- All three refusals happen before any read of the project, so nothing is written. `--commit` now prints `Root: <dir>`.
- **Kept as it was:** an *existing* directory still walks up to its project root (`resolveRepoRoot`), as before. Naming
  a subdirectory of a project still means that project. With no positional, the cwd is still used.

**Other subcommands with the same `args.find(a => !a.startsWith("--"))` shape.** "Exposed" means that a mistyped
token changes what happens without any refusal. **This table comes from reading `cli.ts` at `aba35de`. None of these
commands was run to confirm it.**

| Site | Command | Mutates? | Exposed? |
|---|---|---|---|
| `cli.ts:54` | `sync` | **yes**, since `sync` without `--check` applies fixes | **Yes.** `sync -check` takes `-check` as the directory. It does not exist, resolves against the cwd and walks up, and **runs the fixing sync on the cwd's project instead of a check.** `sync --chek` is ignored silently, and the same happens. |
| `cli.ts:166` | `start` | **yes**, since it creates a session log | **Yes.** The first non-`--` token becomes `projectRoot` directly: no existence check and no walk-up. |
| `cli.ts:285` | `detach` | **yes**, a git checkout | **Yes.** `detach -dry-run` takes `-dry-run` as the directory, walks up from the cwd, and **runs a real detach where a dry run was meant.** `--dry-rn` is ignored silently, with the same result. The refusals (dirty tree, unpushed commits) still hold. |
| `cli.ts:369` | `state show` | no | **Low.** A stray token can make it read a different project. Read-only. |
| `cli.ts:333` | `state migrate` | **yes** | **Yes, the T-150 shape.** `-dry-run` is taken as a file to migrate, and `--dry-rn` is ignored. In both cases **the named files are migrated for real.** |
| `relocate`, `topics` | | yes, with `--apply` | No positional directory. An unknown flag is ignored, which errs toward the dry run because `--apply` is opt-in. |

Not changed here, as the brief directs. **Proposed as one task (§7).**

### R2-5: every protection has a test that fails without it

- `state-import-staleness.test.ts:105`'s typo assertion is now `toContain("unrecognised flag(s) --accept-stal.")`.
- New guards in `state-import-r2.test.ts`:
  - **M6:** the typo case on a **current** project, where only the flag check can refuse.
  - **M13:** `--draft --accept-stale`.
  - **M14/M15:** the draft's `Staleness:` line and `--commit`'s `Imported STALE under …` line, asserted verbatim.
  - **M16:** markers only in headings, one stale and two current.

## 3. Red, then green

| Evidence | Where | Result |
|---|---|---|
| **IF-14, red first** | `loop/importer-fixes-r2-redcheck` at `c3e3297`, which is `65e3a89` plus the two new test files only (no source change). Pushed and read back. | **17 failed / 21**, all `AssertionError`. The 4 that pass are the R2-5 guards (M6, M13, M14/15, M16). They guard behaviour that already worked at `65e3a89`, so passing there is correct, and their evidence is the mutants in §4. |
| Red first, tests added after `c3e3297` | a scratch worktree at `65e3a89` source, holding the three test files exactly as at `8723ccf`: the two SUMMARY.md cases, the `--force-snapshot` case, the snapshot-copy case, and round 1's tightened typo assertion. Removed afterwards. | **21 failed / 33**, all `AssertionError`. The 12 that pass are the 4 guards and round 1's 8 staleness tests. |
| Green, the five importer test files | local, win32, `aba35de` | **44/44** |
| `tsc --noEmit -p .` | local, each commit | exit 0 |
| **CI on the candidate** | run **`36100482584`**, `workflow_dispatch` on `loop/importer-fixes-r2-ci`, headSha `aba35de` confirmed. Runner **`tcm-1`**, machine `tcm`, from the log. | **success.** Typecheck passed. Test Files 75 passed. **Tests 1069 passed, 1 skipped (1070)**: round 1's 1045 plus this round's 25. Importer files: `state-import.test.ts` 9, `-r2` 17, `-staleness` 8, `-atomic` 8, `-seeds` 2, all ✓. The skip is `tests/shared/paths.test.ts`, the win32-only 8.3 test. `onTaskUpdate`/`Unhandled`: 0. |
| **Full local suite** | **not run: no all-idle window on the shared machine, 05:50Z to 07:04Z.** Per the planner's ruling, it runs only when every peer in `ListAgents` is idle immediately before. It moves to QA 106 on the dedicated QA PC (D-045), by the planner's ruling of 07:04Z. | Busy peers seen, one line per listing. The times are UTC and approximate for my own listings; the harness idle notices carry exact times. **~05:48Z** `a2a-rivet-1b` busy · **~05:58Z** `a2a-rivet-1b` busy · **~06:03Z** `a2a-rivet-1b` busy · **06:06Z** rivet's idle notice, then `a2a-planner-65` busy · **06:06Z** planner-65's idle notice, then `a2a-qa-2e` and `a2a-rivet-1b` busy · **06:06Z** rivet's idle notice, then `a2a-qa-2e` busy · **07:03Z** qa-2e's idle notice, then `a2a-planner-65` busy and `sia-planner-ac` in `shell`. **There was no listing in which all four peers were idle.** |
| Live CLI (built at `aba35de`, win32) | `live-r2.mjs` in the scratchpad | PROBE-8 (UTF-8 BOM, UTF-16LE BOM), PROBE-1, PROBE-2, the read-only-SUMMARY failure, PROBE-12/5b: all as §5 describes. |
| QA 102's `probes.mjs`, unchanged | this build, and A2A-Hub `e0bc3f8` | **26 PASS / 0 FAIL, exit 0** |

## 4. Mutants (IF-13)

The script is `mutants-r2.cjs` in this session's scratchpad (not tracked), with no shell (`execFileSync` with args
arrays). Each edit must match exactly once or it is VOID; none was. After each edit, the script checks the file
changed, runs `tsc --noEmit -p .`, runs the five importer test files (44 tests), then restores the source and compares
its hash. At the end, `index.ts` and `cli.ts` hashed the same as the baseline, and `git status` was clean. **As QA
noted, `tsc -p .` covers `src/` only.**

Runs: the full list at `8723ccf`, then N1, N5 and N8 again at `aba35de`. The only difference between the two is
`ignoreBOM`, which none of the other mutants touches.

| Mutant | Protection | tsc | Red of 44 |
|---|---|---|---|
| **M6** | T-150: an unknown flag refuses | 0 | **3**: round 1's IF-2 CLI test, which now asserts the refusal's words; R2-4's single-dash test; the M6 guard on a current project |
| **M13** | `--accept-stale` refused with `--draft` | 0 | **1**: the M13 guard |
| **M14** | `Imported STALE under …` line | 0 | **1**: the M14/M15 guard |
| **M15** | the `--draft` `Staleness:` line | 0 | **1**: the M14/M15 guard |
| **M16** | headings are read | 0 | **1**: the M16 guard |
| N1 | UTF-8 BOM strip | 0 | first run **0, survived** (see R2-1); at `aba35de`, **4** |
| N2 | UTF-16LE decode | 0 | 2 (UTF-16 inputs; UTF-16 SUMMARY) |
| N3 | UTF-16BE decode | 0 | 1 |
| N4 | an undecodable input gets an encoding reason | 0 | 1 |
| N5 | an undecodable SUMMARY.md refuses `--commit` | first run **2: VOID** (a `false &&` mutant broke narrowing); rewritten as `=== "never"`, 0 | 1 |
| N6 | SUMMARY.md read through the decoder | 0 | 3 |
| N7 | the latest log's date read through the decoder | 0 | 1 |
| N8 | ahead of the log is not current | first run **2: VOID**; rewritten as `> latest.n + 1000000`, 0 | 1 |
| N9 | rollback on failure | 0 | 7 |
| N10 | view directories created | 0 | 1 (PROBE-2) |
| N11 | the replaced snapshot is kept aside | 0 | 1 |
| N12 | the aside copy is removed on success | 0 | 1 |
| N13 | a partial snapshot is removed | 0 | 1 |
| N14 | the rollback removes an `archive/` it created | 0 | 5 |
| N15 | `-`-prefixed unknown tokens refuse | 0 | 1 |
| N16 | a second positional refuses | 0 | 1 |
| N17 | a missing directory refuses | 0 | 1 |

**Every mutant turns at least one test red, with `tsc` 0.** Two mutants were void on type-checking and were rewritten,
not counted. **M6's 3 includes round 1's own IF-2 typo test**, now that it asserts `unrecognised flag(s)
--accept-stal.`: D1's exact complaint.

## 5. Acceptance rows, as this seat reads them. The verdict is QA's.

- **IF-1 to IF-8** (round 1's rows):
  - Round 1's three test files pass unchanged, apart from the one assertion R2-5 tightened (19/19).
  - **QA 102's own `probes.mjs`** (blob `a23d5d6`, byte-identical to `origin/qa/importer-fixes-report`), run against
    this build and a fresh `git archive` of A2A-Hub `e0bc3f8` from `~/Projects/A2A-Hub`: **26 PASS, 0 FAIL, exit 0.**
    On master, QA's run gave 7 passed and 19 failed.
- **IF-9:** `state-import-r2.test.ts` R2-1 block.
  - Live CLI, UTF-8 BOM and UTF-16LE BOM, every input at Session 6 against log 7: `3 stale`. `--commit` exits 1 with
    the stale refusal, and the tree is unchanged.
  - QA's PROBE-8 note, run here: `bare --commit exit 1, state.json false`.
  - Without a BOM: the same verdicts and the same evidence strings, asserted in one test.
- **IF-10:** the report line reads: `could not tell … line 3 declares Session 20 …; the latest session log is Session 7
  … AHEAD of the latest log`. Round 1's current and stale cases, beside it, are unchanged.
  - **Side effect, seen in QA's PROBE-10:** a stale input with a future-session heading (`## Plan for Session 8`, log 7)
    is now *could not tell* rather than *current*. Round 1's limit 1 is narrowed, not closed: *could not tell* does not
    block.
- **IF-11:**
  - PROBE-2 through the CLI: `--commit` exit 0, with state.json and all four views present. **Fully migrated.**
  - Six induced failures, by mock, each byte-identical afterwards, and a second run completes.
  - One further failure through the CLI (read-only SUMMARY.md), byte-identical including the attribute. §2 R2-3.
- **IF-12:**
  - Live CLI, standing in another drafted project: `--commit accept-stale <named>`, `-accept-stale` before and after
    the directory, and `accept-stale` alone. All four exit 1 with their own refusal, and **both projects' trees are
    unchanged**.
  - QA's PROBE-12 note, run here: `exit 1; A state.json false; B state.json false`.
- **IF-13:** §4.
- **IF-14:** §3.
- **IF-15:** §3. `/sync --check` at `aba35de`: `26 passed, 2 warnings, 1 issue, 1 skipped`, the same as at `65e3a89`
  before any change. The issue is ENTITIES.md retirements; the warnings are `vault-index-parity` and `spec-provenance`;
  the skip is `gitnexus-index`, which is not a pass.

## 6. Not verified

- **The rollback-fails path** (R2-3): the snapshot is kept and named. It is written but induced by no test.
- **PROBE-10 is narrowed, not closed.** A stale input whose heading names a future session is now *could not tell*,
  not *current*. But *could not tell* does not block `--commit`, so round 1's limit 1 still lets it through, with a line.
- **The full local suite** did not run on this machine (§3). It moves to QA 106 on the QA PC.
- **The §2 subcommand table** comes from reading `cli.ts`. None of those commands was run.
- **Lone-CR files, and UTF-16 without a BOM, are not decoded.** The second is caught (NUL bytes give *could not tell*
  with an encoding reason). The first would read as one line and give *could not tell* under the false reason "names
  no `Session N`".
- **`applySummaryRegion`'s BOM defect**, for SUMMARY.md files that do not come through the importer: not fixed (§7).
- **GitNexus:** `impact` ran against the main tree's index (`f673d5e`, behind master). It does not know
  `detectStaleness`, which round 1 added. LOW for `runCommit`, `findLastSession` and `planSummaryRemoval`; HIGH for
  `applySummaryRegion`, which I therefore did not touch. `detect_changes` was not run against a current index.
- **The main checkout's build** is not updated, as in round 1 §8: a merge alone changes nothing for anyone running
  `open-brain state import` until that tree is rebuilt (T-172).
- **Linux:** only through CI. Every local run was win32.

**Near-miss, by family (caught before it reached anyone, not an error entry):** my first run of QA's `probes.mjs`
showed **5 FAILs**. They came from my copy of the script, not the build: I had extracted it through PowerShell with
`Out-File -Encoding ascii`, which turned `·` and `–` into `?` inside its expected strings. Re-extracted with
`MSYS_NO_PATHCONV=1 git show` into a file whose `git hash-object` matches the tracked blob, it gave 26/26. **An
instrument copied by a path that re-encodes it measures the copy.** The wrong number was the unflattering one, so it
was checked rather than believed. It would have been easy to believe the other way.

## 7. Proposed tasks (not opened: the planner's)

1. **The positional/flag shape in `sync`, `start`, `detach` and `state migrate`** (the §2 table). Three of them mutate,
   and two turn a meant dry run into a real one.
2. **`applySummaryRegion` finds the title with `startsWith("# ")`**, so an `ob_state` render into a BOM-led SUMMARY.md
   puts the region above the title. The importer no longer produces such a file. Impact is HIGH (`ob_state`,
   `/sync`).
3. Carried from the brief, as they stood: an input changed between `--draft` and `--commit` (QA's Open 4), and the
   `ci-status` "gh auth login" misreading.
