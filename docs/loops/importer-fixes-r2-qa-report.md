# Importer fixes round 2 (R2-1 to R2-5): QA report, record session 106

**By:** the QA seat, record session 106, headless on the QA PC `DESKTOP-O4EGB1E` (D-045), launched by
`docs/loops/qa-106/drive.ps1`, in `C:\Users\Aaron Melven\Worktrees\sia-qa` (HEAD `56d7bdd`), 2026-09-25 UTC (the run
started 10:20:49Z).
**Candidate:** `aba35de` (`origin/loop/importer-fixes-r2`'s parent and `origin/loop/importer-fixes-r2-ci`), built on
round 1's tip `65e3a89`. The handoff was read at `origin/loop/importer-fixes-r2` `665b3a2`.
**Dispatch:** `docs/loops/importer-fixes-r2-dispatch-qa.md`. **Scored against:** `docs/loops/importer-fixes-round-2-brief.md`
§3 (IF-9 to IF-15) and `docs/loops/importer-fixes-brief.md` §3 (IF-1 to IF-8), both read at `56d7bdd`, which is
`origin/docs/session-100-qa99-dispatch`.
**Model and effort:** `claude-opus-5-5` and effort `high`, read from this run's own process command line (PID 3328,
`claude.exe -p "You are the QA seat, record session 106, …" --model claude-opus-5-5 --effort high …`, child of the
driver's `powershell … -File …\qa-106\drive.ps1`, PID 6628). The stream-json transcript
(`%USERPROFILE%\sia-qa106\run-0.jsonl`, session `6121f40d-4403-44cf-9504-d159bb89c053`) names `claude-opus-5-5` on every
assistant record (141 of 141 when counted mid-run). It records no effort value, only `per_turn_effort_active: true`.
**Temps (T-190):** `TEMP`=`TMP`=`C:\qa-tmp` for everything except the one full suite, which ran with
`QA_DEFAULT_TEMP`=`C:\Users\AARONM~1\AppData\Local\Temp` (the 8.3 path, Defender on). All scratch work is under
`C:\qa-scratch`.
**Scripts and raw output:** `docs/loops/qa-scripts-importer-r2/` (README there).

## Verdict

**Do not merge `aba35de` as it stands.** Read as they are written, all fifteen rows pass: IF-1 to IF-15. IF-9, IF-11 and IF-13 carry qualifications, given
below.
But the dispatch asked me to test the class, not the instance, and on that test **two of round 2's own fixes
introduce regressions that round 1 does not have**. Both are small to fix.

- **D6 (high, new, R2-3). A refused `--commit` deletes the snapshot it says exists.** When
  `.agents/archive/pre-state-migration-<today>/` already exists, `--commit` refuses with *"snapshot … already exists —
  pass --force-snapshot to overwrite it"*. By the time that message prints, the directory is gone. `takeSnapshot`
  throws that refusal inside the new `try` at `index.ts:791`, and the `catch` at `:795` runs
  `rmSync(snapshotDir, …)` on **any** error, including this one. Round 1 keeps the snapshot. The snapshot that dies is
  exactly the one R2-3's own failure path tells the operator to restore from (D7).
- **D5 (medium–high, new, R2-1). Windows-1252 text now gets past the STALE block.** Windows PowerShell 5.1's
  `Set-Content` and `Add-Content` write the ANSI code page, which is Windows-1252 on this PC. An em dash becomes byte
  `0x97`, which is not valid UTF-8. The candidate files such an input as *could not tell* ("not valid UTF-8 … its words
  cannot be read"), and `--commit` then goes ahead **without** `--accept-stale`. Round 1 read the ASCII `Session 6`
  correctly, called it STALE and refused. This is D2's route past T-180, reopened through a different encoding. The
  candidate's own tests assert the new behaviour.
- **D7 (medium, new; the path the handoff says is untested). When the rollback itself fails, it has already deleted
  live files.** I induced it: a PowerShell handle on SUMMARY.md, shared for read only. The rollback removed
  `SESSIONS/` (both session files), the draft and the report, then stopped on SUMMARY.md. The error is truthful and
  names the kept snapshot. But nothing stops a re-run. `--draft` proceeds on the damaged tree without a word, and then
  the next plain `--commit` destroys the kept snapshot (D6). After that, `Session_7.md` exists **nowhere**. On round 1
  the same induction adds `state.json`, deletes nothing, and refuses every later run.

**What round 2 does close, verified here by class through the built CLI:**
- **R2-1:** UTF-8 with a BOM, UTF-16LE and UTF-16BE with a BOM, CRLF, and every combination, including the bytes
  PowerShell 5.1's `>`, `Out-File` and `Out-File -Encoding utf8` really write. Each gives the same verdicts and
  **the same evidence strings** as plain UTF-8. Round 1 fails 8 of those shapes.
- **R2-2:** Session 20 or 8 against log 7 is *could not tell*, with both numbers named. Equal is current, and behind
  is STALE.
- **R2-3:** PROBE-2 now completes. My own induced failure (a read-only INBOX.md, which fails the render step) is rolled
  back byte-identical, down to mtimes and the read-only bit, and a re-run completes. So do `--force-snapshot` with a
  failure, and a junction inside `.agents/` (its target outside the project is untouched).
- **R2-4:** 60 of 60 runs of the token matrix refuse and leave all three projects untouched. Round 1 got 28 of those
  runs wrong.
- **R2-5:** every guard M6 and M13–M16 asked for is red on its mutant. So is each of the 17 round-2 protections I
  rebuilt from the handoff, with one exception. **N13**, the removal of a partial snapshot, survives when mutated
  alone (0/44). Its line matters only when `archive/` existed before the run, and that is the line D6 is about.

**The full suite ran once, at `aba35de`**, with the default 8.3 temp (Defender on): **75 files, 1070 of 1070
passed, with no skip, and `SUITE_EXIT=0`.** The win32 8.3 test passed. No failure appeared only in this control run,
because nothing failed. **CI:** run `36124999356` on `aba35de` succeeded on tcm
(`tcm-2`): 1069 passed and 1 skipped (1070). **Plain `sync`** in a scratch clone gives the same result as at
`65e3a89`, so no new issue.

## Rows IF-1 to IF-15

| Row | Result | Evidence (mine unless marked) |
|---|---|---|
| **IF-1** | **PASS** | QA 102's `probes.mjs`, byte-exact, against the build at `aba35de`: the SIA fixture's draft and `state.json` both have `verified[]` and `gaps[]` empty. The report says `verified[]: 0 · gaps[]: 0` and the CLI says `verified 0 · gaps 0`. No `V-00x`/`G-00x` appears anywhere. The same holds for a fresh `git archive` of A2A-Hub `e0bc3f8`. Mutant M1 is red. |
| **IF-2** | **PASS** | The real A2A-Hub at `e0bc3f8` (fresh archive): the first section is `## Staleness — read this first`. next-session.md is **STALE** at Session 13 against `Session_14.md`, with the line quoted, and INBOX is STALE at Session 11. Bare `--commit` exits 1 and writes nothing. `--accept-stal` refuses as an unrecognised flag. `--accept-stale` commits, taking a 37-file snapshot in which 0 original files are missing or differ, and prints `Imported STALE under --accept-stale: …`. |
| **IF-3** | **PASS** | QA 102's own negative (markers in a heading, in the title line and as a range): `0 stale · 0 could not tell · 3 current`, and `--commit` proceeds with no staleness line. An unneeded `--accept-stale` claims nothing. |
| **IF-4** | **PASS** | Body-text-only marker: *could not tell*, with its reason, never current. Its `--commit` prints exactly one `Could not tell whether current:` line. With `SESSIONS/` present and no log, all three inputs are *could not tell*. **Qualification:** D5 is IF-4's reverse failure, the same shape as round 1's D2. A judgeable STALE input is filed as *could not tell*. This time the reason is true ("not valid UTF-8"), but the words it cannot read include the ASCII `Session 6`. |
| **IF-5** | **PASS** | M1 (seeds restored) 3/44 red, M2 (detector off) 9/44, M3 (could-not-tell as current, re-anchored) 3/44. `tsc` exits 0 on each. |
| **IF-6** | **PASS** | `origin/loop/importer-fixes-redcheck` is still `e082983`. Re-run here, `state-import-fixes.test.ts` is **9 failed / 9**, all `AssertionError`, the same breakdown QA 102 recorded (5× `expected undefined to be defined`, and one each of seed deep-equal, `verified 0 · gaps 0`, `to throw`, `+0 to be 1`). The dependencies were `65e3a89`'s install, not `9bc06e3`'s. |
| **IF-7** | **PASS** | `git diff 65e3a89 aba35de` leaves `state-import.test.ts` and `-seeds.test.ts` unchanged. `-staleness.test.ts` changes one assertion only, the R2-5 tightening, plus a two-line comment. `--draft` on the real archive adds exactly the draft and the report. The snapshot is byte-complete, and the stale refusal still comes before it (M7, re-anchored, is red 3/44). |
| **IF-8** | **PASS** (the ruled-out part unrun) | Plain `open-brain sync` in a scratch clone at `aba35de`, rebuilt: `25 passed, 0 fixed, 2 warnings, 1 issues, 2 skipped`, and the tree is clean afterwards. The issue is the known ENTITIES.md retirements finding. Build-freshness passes. The warnings are `obsidian-vault` (no vault on this PC) and `spec-provenance`. The skips are `gitnexus-index` (which is not a pass) and `ci-status`, the known misreading of `gh`'s "gh auth login" in a clone whose origin is a local path. **The ISSUES, WARNINGS and SKIPPED blocks are line-for-line identical to a second scratch clone at `65e3a89`.** The only differences are the HEAD in build-freshness and `merge-markers` counting 468 files rather than 466 (the two new test files). |
| **IF-9** | **PASS as written; the class FAILS (D5)** | PROBE-8's shape (BOM on each input, Session 6 against log 7): **3 STALE**, bare `--commit` exits 1 and writes nothing beyond the draft and the report, and `--accept-stale` commits. The same inputs without a BOM: the same verdicts, and **the INBOX evidence string is identical** to the plain UTF-8 one. Across 17 shapes (the table under [Probes](#probes)), 13 behave identically. The 4 that do not are UTF-16LE without a BOM (disclosed; round 1 fails it too) and **three Windows-1252 shapes, which round 1 gets right and the candidate gets wrong: D5.** |
| **IF-10** | **PASS** | Declares 20 against log 7: `could not tell … line 3 declares Session 20 (…); the latest session log is Session 7 (…). It declares a session AHEAD of the latest log…`. `--commit` proceeds and prints the could-not-tell line. Declares 8: the same. Declares 7: current. Declares 6: STALE, and `--commit` refuses. Round 1's current and stale cases (IF-2, IF-3) are unchanged. |
| **IF-11** | **PASS as written; the class FAILS (D6, D7)** | PROBE-2: `--commit` exits 0, with `state.json` and all four views present, so it is fully migrated. A second `--commit` refuses, as it should for a migrated project. **My other induced failure:** INBOX.md read-only, so the render's rename fails with `EPERM`. The result: exit 1, `Rolled back: .agents/ was restored from the snapshot, and the snapshot removed, so nothing changed`. The tree is identical in bytes, sizes, **mtimes** and the read-only bit. Made writable, the second `--commit` completes. `--force-snapshot` plus the same failure: identical, and the earlier snapshots are intact. A junction in `.agents/`: rolled back, the junction restored as a link, and its target untouched. **But:** a refusal before the snapshot is written deletes an existing snapshot (D6). And when the rollback itself fails, the live tree has already lost files (D7). |
| **IF-12** | **PASS** | QA 102's PROBE-12 and PROBE-5b: every variant exits 1 and writes nothing, in both projects. My matrix (standing in drafted project A, naming B, with C as the other project): `-x`, `x`, a second project, and a missing directory, in every order relative to the flag and to B, for both `--draft` and `--commit`. **60 of 60 exit 1 and leave A, B and C unchanged**, in hash, size, mtime and the read-only bit. Round 1 fails 28 of the 60. Edges: `-`, `--` and an existing file all refuse. `''` before a real directory refuses. **`''` alone commits the cwd's project**, which round 1 does too (O1). The control `--commit <B>` from A changes only B and prints `Root: <B>`. |
| **IF-13** | **PASS, with one gap** | `mutants-r2.mjs`, over all five importer files (44 tests). `tsc --noEmit -p .` exits 0 on **every** mutant. **M6** is red 3/44: round 1's IF-2 typo test (now asserting `unrecognised flag(s) --accept-stal.`), R2-4's single-dash test, and the M6 guard on a current project. **M13, M14, M15 and M16** are each red 1/44, on their own R2-5 guards. Each round-2 protection's mutant is red (N1–N12, N14–N17), with the same counts as the handoff except N6 (2 here, 3 there). **The gap: N13**, which removes `rmSync(snapshotDir)` from the snapshot's `catch`, **survives, 0/44**. The partial-copy test runs with no `archive/`, so the next line's `rmSync(archive)` removes the partial snapshot anyway. Removing both lines (N13b) is red 1/44, which is probably the handoff's N13. The line is unguarded exactly where `archive/` already existed, and that is D6's case. See [Mutants](#mutants). |
| **IF-14** | **PASS** | `loop/importer-fixes-r2-redcheck` is `c3e3297`. Its parent is `65e3a89`, and it adds two test files with no source change (`git diff --stat 65e3a89 c3e3297`: 2 files, `open-brain/tests/pipelines/` only). Run here on round 1's source: **17 failed / 21**, every error an `AssertionError`. The 4 that pass are the R2-5 guards, which guard behaviour that already worked at `65e3a89`. This matches the handoff. |
| **IF-15** | **PASS** (process record incomplete: E5) | `/sync`: see IF-8, with no new issue. **CI:** run `36124999356`, `workflow_dispatch` on `qa/importer-fixes-r2-ci`. The final checkout is `aba35dee16d8…` (from the log; the runner's stale workspace had another seat's `b3a6b8f` first). Runner **`tcm-2`**, machine `tcm`. The egress self-check printed `blocked:` for all 9 targets and `denied: /opt/doorctl`. Result **success**: Test Files 75 passed, **Tests 1069 passed, 1 skipped (1070)**, and the importer files 9, 17, 8, 8 and 2, all ✓. The skip is the win32-only 8.3 test. `onTaskUpdate`/`Unhandled`: 0. This agrees with the developer's run `36100482584` on `tcm-1`. **Full suite:** once, at `aba35de`, 10:48:33Z–10:50:45Z, with `TEMP`=`TMP`=`C:\Users\AARONM~1\AppData\Local\Temp`: 75 files, **1070/1070 passed**, `SUITE_EXIT=0`. The 8.3 test passed. See [Full suite and CI](#full-suite-and-ci). |

## Probes

### QA 102's `probes.mjs`, unchanged

Copied with `git show` into a file whose `git hash-object` is `a23d5d6`, the tracked blob. Against the candidate:
**26 passed, 0 failed** (`evidence/probes-aba35de.out`). Against round 1 `65e3a89`, the control: also **26 passed, 0
failed** (`evidence/probes-65e3a89.out`). The 26 checks are rows IF-1 to IF-4. The dispatch's probes are NOTE lines,
and those are where the two builds differ:

| Probe | Round 1 `65e3a89` | Candidate `aba35de` |
|---|---|---|
| PROBE-1 (declares 20, log 7) | `current`; `--commit` proceeds | `could not tell … AHEAD of the latest log`; proceeds, and prints the could-not-tell line |
| PROBE-2 (no `SESSIONS/`) | exit 1 after writing `state.json` and rewriting INBOX/task: half-migrated | **exit 0, fully migrated** |
| PROBE-5 `-accept-stale` / `accept-stale` (stale project) | refused as *stale* (the typo is ignored) | refused as `unrecognised flag(s) -accept-stale` / `more than one directory given` |
| PROBE-5b the same, on a CURRENT project | **exit 0, committed silently** | exit 1, nothing written |
| PROBE-8 (UTF-8 BOM, Session 6 vs 7) | bare `--commit` **exit 0** | bare `--commit` exit 1, no `state.json` |
| PROBE-10 (future-session heading in a stale input) | `0 stale · 0 could not tell · 3 current`; proceeds | `0 stale · 1 could not tell · 2 current`; **still proceeds** (narrowed, not closed, as the handoff says) |
| PROBE-12 (`-accept-stale` before B, standing in A) | **exit 0; A committed**, B not | exit 1; neither committed |
| PROBE-3, 4, 4b, 6, 7, 9, 11 | as QA 102 recorded | the same |

PROBE-7 (an input edited between `--draft` and `--commit`) still commits the draft's content with no note, as QA
102 found. It was out of scope for round 2.

### Mine: `probes-r2.mjs`, the class of each fix

Run against both builds with the same arguments (`evidence/probes-r2-aba35de.out`: 21 passed, 4 failed;
`evidence/probes-r2-65e3a89.out`: 10 passed, 15 failed).

**R2-1, 17 encoding shapes.** Each shape is applied to all three judged inputs. In "stale" they declare Session 6
against `Session_7.md`; in "current" they declare Session 7. The six PowerShell rows were written by **Windows
PowerShell 5.1.19041** itself from a UTF-8 source. Their byte shapes, recorded separately in `evidence/ps51-bytes.out`,
are: `Set-Content`/`Add-Content` → Windows-1252 (em dash = `97`); `>`/`Out-File` → `ff fe`, UTF-16LE; `Out-File
-Encoding utf8` → `ef bb bf`.

| Shape | First bytes | Round 1: stale inputs | **Candidate: stale inputs** | Candidate: current inputs |
|---|---|---|---|---|
| UTF-8 | `23 20 49` | 3 STALE, refused | 3 STALE, refused | 3 current, commits |
| UTF-8 + BOM | `ef bb bf` | 3 could not tell, **commits** | 3 STALE, refused | 3 current |
| CRLF | `23 20 49` | 3 STALE, refused | 3 STALE, refused | 3 current |
| UTF-8 + BOM + CRLF | `ef bb bf` | could not tell, **commits** | 3 STALE, refused | 3 current |
| UTF-16LE + BOM | `ff fe 23 00` | could not tell, **commits** | 3 STALE, refused | 3 current |
| UTF-16LE + BOM + CRLF | `ff fe 23 00` | could not tell, **commits** | 3 STALE, refused | 3 current |
| UTF-16BE + BOM | `fe ff 00 23` | could not tell, **commits** | 3 STALE, refused | 3 current |
| UTF-16LE, no BOM | `23 00 20 00` | could not tell, **commits** | could not tell ("contains NUL bytes…"), **commits** | 3 could not tell |
| **Windows-1252 with em dashes** | `23 20 49` | **3 STALE, refused** | **3 could not tell ("not valid UTF-8…"), commits: D5** | 3 could not tell |
| Windows-1252, ASCII only | `23 20 49` | 3 STALE, refused | 3 STALE, refused | 3 current |
| Lone CR | `23 20 49` | 3 STALE, refused | 3 STALE, refused (see O2) | 3 current |
| PS 5.1 `>` | `ff fe 23 00` | could not tell, **commits** | 3 STALE, refused | 3 current |
| PS 5.1 `Out-File` | `ff fe 23 00` | could not tell, **commits** | 3 STALE, refused | 3 current |
| **PS 5.1 `Set-Content`** | `23 20 49` | **3 STALE, refused** | **could not tell, commits: D5** | 3 could not tell |
| **PS 5.1 `Add-Content`** | `23 20 49` | **3 STALE, refused** | **could not tell, commits: D5** | 3 could not tell |
| PS 5.1 `Out-File -Encoding utf8` | `ef bb bf` | could not tell, **commits** | 3 STALE, refused | 3 current |
| PS 5.1 `Get-Content \| Set-Content` of a UTF-8 file | `23 20 49` | 3 STALE, refused | 3 STALE, refused | 3 current |

"Refused" means bare `--commit` exits 1 and writes nothing beyond the draft and the report, and `--accept-stale`
then exits 0. Wherever the candidate judges, the INBOX evidence string is **identical** to the plain-UTF-8 one.

**SUMMARY.md, rewritten in place by `--commit`.** UTF-8, UTF-8 with a BOM, and UTF-16LE with a BOM and CRLF: the
candidate commits, and the file comes back as plain UTF-8 starting `# `. The title is on line 1, the rendered region
starts on line 3, and the original status blockquote is gone. **On round 1, the BOM and UTF-16 cases put the rendered
region above the title** (the first bytes are `<!--`), and the BOM case kept the blockquote, so this is fixed.
Windows-1252 SUMMARY.md: the candidate refuses before any write, and the tree is identical. Round 1 committed, reading
the file through UTF-8. Lone CR: both builds keep the blockquote (O2).

**R2-2.** Log 7: declares 20 → could not tell; 8 → could not tell; 7 → current; 6 → STALE, and `--commit` refuses. A
next-session titled `# Handoff for Session 8`, written at the end of Session 7 for the next one, is now *could not
tell*. See O3.

**R2-3.**

| Induced | Candidate | Round 1 |
|---|---|---|
| PROBE-2, no `SESSIONS/` | exit 0, fully migrated (state.json and 4 views) | exit 1, half-migrated |
| INBOX.md read-only → the render's rename fails `EPERM` | exit 1, `Rolled back…`; tree identical (bytes, mtimes, RO bit); a re-run completes once writable | half-migrated: 13 entries added (the snapshot and `state.json`) and SUMMARY.md rewritten; the re-run refuses |
| the same, with `--force-snapshot` and earlier snapshots for 09-24/25/26 | exit 1; tree identical, earlier snapshots intact | the snapshot is merged into the earlier one |
| a junction `.agents/linked` → a directory outside the project, plus the render failure | exit 1, rolled back; the link is restored as a link; **the target is untouched** | target untouched |
| **the rollback itself fails** (PowerShell holds SUMMARY.md open, `FileShare.Read`) | see below | `state.json` added, nothing removed, snapshot kept; every re-run refuses (`state.json already exists`) |
| **today's snapshot already exists; plain `--commit`** (`probe-existing-snapshot.mjs`) | refused "already exists", **and the snapshot is deleted: D6** | refused, snapshot kept |

**The rollback failure, step by step (candidate).** The dispatch asked me to induce it and record what the project is
left as.
1. `--commit` exit 1: `state import refused: EBUSY: resource busy or locked, open '…\.agents\SYSTEM\SUMMARY.md'.
   ROLLBACK FAILED (EBUSY: resource busy or locked, unlink '…\SUMMARY.md'): .agents/ is part-migrated. Restore it by
   hand from …\.agents\archive\pre-state-migration-2026-09-25, which was kept`.
2. **Left as:** 5 entries removed from the live tree: `SESSIONS/`, `SESSIONS/next-session.md`,
   `SESSIONS/Session_7.md`, `state.draft.json` and `state.import-report.md`. Nothing was added or changed. `SYSTEM/`
   and `TASKS/` were untouched: the rollback deletes in `readdir` order and stopped at `SYSTEM`. The kept snapshot is
   complete (0 of the original entries missing or differing). **The message is true, and the kept snapshot is enough
   to restore from.**
3. Re-run `--draft`: exit 0, `Current session: 0 ((no SESSIONS/ directory))`, and nothing mentions the kept snapshot
   or the failed rollback. The snapshot still holds `Session_7.md`.
4. Re-run `--commit`: exit 1, `snapshot … already exists — pass --force-snapshot to overwrite it`. **The snapshot
   directory no longer exists (D6).**
5. Re-run `--commit --force-snapshot`, as step 4 advises: exit 0, committed from the damaged tree.
   **`SESSIONS/Session_7.md` now exists nowhere in the project.**

**R2-4.** The matrix and edges are in the IF-12 row. `sync -check` and `sync --chek` in a scratch clone exit 0,
where `sync --check` exits 1 on the known issue. The handoff's table is right that `sync` takes such a typo as
something else, not as a refusal (O4).

## Mutants

**QA 102's `mutants.mjs`, unchanged** (blob `bda4593`), against `aba35de`: `evidence/mutants-qa102-as-is.out`. It
runs only round 1's three test files (19 tests). M1, M2, M4–M6 and M8–M12 are red. **M3 and M7 are VOID**, because
their anchors moved: `verdict: "could_not_tell",` now matches 4 times, and the snapshot line is inside a `try`. **M13–M16
survive**, because their guards are in the new test files. It restored the source and left the tree clean. This is
what that script measures on this tree, so I scored the set below instead.

**`mutants-r2.mjs`** (`evidence/mutants-r2.out`, one `git diff` per mutant in `evidence/mutant-diffs/`). Every edit
matched its stated count, so none was VOID. `tsc --noEmit -p .` exits 0 on **all 39**. It covers `src/` only, as QA
102 noted. After each mutant the source was restored and hashed: `index.ts` `82b4a14efc0d` and `cli.ts`
`21d04763222f`. `git status --porcelain` was clean at the end, and again after the N13b run.

| Mutant | Protection | Red of 44 | Handoff | Red tests (abridged) |
|---|---|---|---|---|
| M1 | T-175 no seeds | 3 | – | IF-1 ×2, the draft test at `state-import.test.ts:142-143` |
| M2 | detector | 9 | – | IF-2 and the R2-1/R2-2 verdict tests |
| M3 | could-not-tell never current (re-anchored on round 1's two pushes) | 3 | – | IF-4 ×3 |
| M4 | ruling 1b line | 1 | – | the `--commit` could-not-tell test |
| M5 | ruling 1a reason | 1 | – | the IF-4 report-line test |
| **M6** | T-150 unknown flag | **3** | 3 | round 1's IF-2 typo test; R2-4 single-dash; the M6 guard |
| M7 | stale refusal before the snapshot (re-anchored) | 3 | – | IF-2 ×2, R2-1 CLI BOM refusal |
| M8 | `--commit` refuses on STALE | 3 | – | the same three |
| M9 | `--accept-stale` proceeds | 3 | – | IF-2 ×2, M14/M15 guard |
| M10 | staleness section first | 2 | – | IF-2, IF-4 first-section |
| M11 | STALE line has evidence | 1 | – | IF-2 evidence |
| M12 | one behind is stale | 8 | – | IF-2 ×3, R2-1 ×3, PROBE-1, the M14/M15 guard |
| **M13** | `--accept-stale` with `--draft` | **1** | 1 | the M13 guard |
| **M14** | `Imported STALE under …` | **1** | 1 | the M14/M15 guard |
| **M15** | `--draft` `Staleness:` line | **1** | 1 | the M14/M15 guard |
| **M16** | headings are read | **1** | 1 | the M16 guard |
| N1 | UTF-8 BOM strip | 4 | 4 | PROBE-8, CLI BOM refusal, sibling reads, BOM SUMMARY |
| N2 | UTF-16LE decode | 2 | 2 | UTF-16 inputs, UTF-16 SUMMARY |
| N3 | UTF-16BE decode | 1 | 1 | UTF-16 inputs |
| N4 | undecodable input's reason | 1 | 1 | "not UTF-8 … says so" (the test that asserts D5's behaviour) |
| N5 | undecodable SUMMARY refuses | 1 | 1 | |
| N6 | SUMMARY through the decoder | 2 | **3** | BOM SUMMARY, UTF-16 SUMMARY. My rebuild reads it with `readFileSync(…, "utf-8")`; the developer's may differ. |
| N7 | log date through the decoder | 1 | 1 | sibling reads |
| N8 | ahead of the log | 1 | 1 | PROBE-1 |
| N9 | rollback on failure | 7 | 7 | all six atomic failure points, and the rollback message |
| N10 | view directories created | 1 | 1 | PROBE-2 |
| N11 | replaced snapshot kept aside | 1 | 1 | the `--force-snapshot` test |
| N12 | aside removed on success | 1 | 1 | the same |
| **N13** | partial snapshot removed (`rmSync(snapshotDir)` alone) | **0: survives** | 1 | none. See IF-13 and D6. |
| N13b | the same, both removals | 1 | – | the partial-snapshot test |
| N14 | rollback removes an `archive/` it created | 5 | 5 | five atomic failure points |
| N15 | `-` unknown token refuses | 1 | 1 | single-dash |
| N16 | second positional refuses | 1 | 1 | PROBE-12 |
| N17 | missing directory refuses | 1 | 1 | PROBE-5b |
| R1 | rollback deletes what the import wrote | 5 | – | atomic ×5 |
| R2 | rollback copies the snapshot back | 6 | – | atomic ×6 |
| R3 | rollback removes the snapshot | 1 | – | `--force-snapshot` |
| R4 | rollback puts the earlier snapshot back | 1 | – | `--force-snapshot` |
| E1 | *equivalent:* `ignoreBOM: false` | 0, as expected | – | With the explicit strip in place, the decoder's own BOM handling cannot be seen. This is why `aba35de` exists, and it confirms that commit's reasoning. |

**The developer's reverts.** Their `mutants-r2.cjs` is not on this PC, so I could not diff their edits. Every one of
my rebuilt diffs (N1–N17) changes only the line or lines its protection names: `diff 1 1` or `0 1`, except N13b's
`0 2`. All but two give the handoff's count. The two differences, N6 and N13, are explained in the table. **Neither
difference means a claim of theirs is false, but N13 shows that the handoff's "N13: 1" rests on a mutant wider than
the one line that matters for D6.**

## Full suite and CI

**The full suite, once, at `aba35de`** (`evidence/full-suite-aba35de.out`). It ran from `open-brain` in the candidate
worktree, clean at `aba35dee16d8…` (`git status --porcelain` empty), from **10:48:33Z to 10:50:45Z**, as
`TEMP="$QA_DEFAULT_TEMP" TMP="$QA_DEFAULT_TEMP" npx vitest run > file 2>&1; SUITE_EXIT=$?`, giving **`SUITE_EXIT=0`**.
- **Temps:** this run used `C:\Users\AARONM~1\AppData\Local\Temp` (the 8.3 path, not Defender-excluded). Every other
  run in this session used `C:\qa-tmp`.
- **Result:** Test Files **75 passed (75)**, Tests **1070 passed (1070)**, with no skip, in 129.43 s. The importer
  files are 9 + 17 + 8 + 8 + 2 = 44. **The 8.3-path test** (`paths.test.ts`, `resolves a real 8.3 short-name segment
  (win32 only…)`) **passed**, in 552 ms. `onTaskUpdate`/`Unhandled`: 0. **No failure appeared in this control run, so
  there is no temp-only failure to report.** This is CI's 1069 + 1 skipped, with the skip run.
- **Processes: only the after-list was captured (E5).** Both `procs.ps1` calls around the suite failed on my path
  quoting, and the suite was not re-run to repair that. The dispatch allows one run. What I can show:
  - **After** (10:50:52Z, 7 s after the end; `evidence/processes-after-suite.txt`): CPU load 2%. The only
    `node`/`claude`/`powershell` processes were this run's `claude.exe` (PID 3328), the driver (PID 6628), QA 99's
    log tail (PID 3884, O5), the listing itself, and `MsMpEng.exe`.
  - **Before**, from my own records: my last background job (the mutants) had exited, and so had the N13b run. CI run
    `36124999356` had completed at 10:38:57Z, and it runs remotely. The only mid-session listing (about 10:41Z) showed
    the same processes, plus my mutant run's `node` processes.
  - No other session was seen on this PC at any point.

**CI: 1 run of the 8 allowed.** I created `qa/importer-fixes-r2-ci` at `aba35de` and pushed it with `push-qa.mjs`
(`pushed and read back: qa/importer-fixes-r2-ci aba35dee16d8312654d48da5e55812cf9cd5e9c4`). I then ran `gh workflow
run ci.yml --ref qa/importer-fixes-r2-ci -f hosted=false` at 10:37:37Z.
- **Run `36124999356`:** `workflow_dispatch`, headSha `aba35dee16d8312654d48da5e55812cf9cd5e9c4`, **conclusion
  success**. The job ran from 10:37:42Z to 10:38:57Z.
- **Runner: tcm.** The log has `Runner name: 'tcm-2'` and `Machine name: 'tcm'`, and the tcm egress self-check ran
  and passed. `gh run view --json jobs` returns `runnerName`/`labels` as null, as QA 102 found, so the log is the
  evidence. The checkout first reset the runner's leftover workspace, another seat's `b3a6b8f`
  (`loop/15-slice-3-a10-redcheck`, deleted by the checkout), then fetched and checked out `aba35de`
  (`git log -1` → `aba35dee16d8…`).
- **Result:** Test Files 75 passed (75), **Tests 1069 passed, 1 skipped (1070)**. The skip is `paths.test.ts`'s
  win32-only 8.3 test. `onTaskUpdate`/`Unhandled`: 0. The only warning, which predates the candidate, is the Node 20
  deprecation for `actions/checkout@v4` and `actions/setup-node@v4`. The log is `evidence/ci-36124999356.log`.

## What could not be verified

- **`/sync --check` after `gitnexus analyze`, and GitNexus `impact`/`detect_changes`:** `gitnexus` is not available
  here, by the dispatch. Not run.
- **The developer's mutant script** (`mutants-r2.cjs`) and `live-r2.mjs` are in their session's scratchpad in
  `~/Worktrees/sia-infra`, which is not on this PC. I rebuilt N1–N17 from the handoff's descriptions (see Mutants), so
  I checked my rebuilds, not their scripts.
- **The other subcommands in the handoff's §2 table:** only `sync` was run (O4). `start`, `detach` and
  `state migrate` mutate, so I did not run them, even in a scratch clone.
- **A real Windows-1252 project in the wild:** D5 was shown on inputs written by PowerShell 5.1 on this PC, not on an
  adopting project. A2A-Hub's inputs are UTF-8.
- **The main checkout's build** (`~/Projects/Self-Improving-Agent`, T-172) is not on this PC.
- **The CLI's `today`** is the local date: 2026-09-25 local (UTC−5) throughout this run, and every snapshot is named for
  it.

## Defects

QA 102 numbered D1–D4. They are closed at `aba35de`: D1 by M6's three red tests, D2 by the BOM rows above, D3 by
PROBE-2, and D4 by the 60-run matrix. The numbering continues from there.

| # | Severity | New? | Defect | Evidence | Suggested fix |
|---|---|---|---|---|---|
| **D6** | **high** (data loss) | **new; round 1 keeps the snapshot** | A `--commit` refused because `.agents/archive/pre-state-migration-<today>/` exists **deletes that directory**, then tells the operator it "already exists". `takeSnapshot` throws its own refusal (`index.ts:728`) inside the new `try` (`:791`), and the `catch` runs `rmSync(snapshotDir, …)` (`:795`) for every error. No test covers a refusal leaving an existing snapshot intact, and N13's mutant (the same `rmSync`) is caught only by the partial-copy test. | `probe-existing-snapshot.mjs`: candidate "IS GONE", in both the plain and the `--accept-stale` case; round 1 "STILL EXISTS". It is also step 4 of the rollback-failure sequence. | Check `existsSync(dir) && !force` **before** the `try` and refuse there. Or remember whether this run created `snapshotDir`, and remove it only in that case. Add a test: a same-day snapshot plus a plain `--commit` leaves the snapshot byte-identical. |
| **D5** | **medium–high** (a way past T-180's block) | **new; round 1 blocks it** | An input that is not valid UTF-8 and has no BOM is *could not tell*, and so does not block. Windows-1252 text with any non-ASCII byte is exactly that, and it is the default of PowerShell 5.1's `Set-Content`/`Add-Content`. The session marker is ASCII, and round 1 read it. A stale input written that way now commits without `--accept-stale`. The candidate's test for "an input that is not UTF-8 … says so" asserts this behaviour. | 3 shapes in the R2-1 table; `evidence/ps51-bytes.out` | When the bytes are not valid UTF-8 and there is no BOM, decode them as Windows-1252 (every ASCII byte is unchanged) and judge as usual. Report the encoding in the evidence, and keep *could not tell* only for text that really cannot be read (the NUL case). Or make an undecodable judged input block unless `--accept-stale` is passed. The SUMMARY.md refusal can stay. |
| **D7** | medium alone; **high with D6** | new (the path the handoff says is untested) | When the rollback fails part-way, it has already **deleted** live entries: it removes everything outside `archive/`, then copies back. The error is true and names the snapshot, but nothing marks the project as broken. `--draft` then runs on the damaged tree without a warning, and the next `--commit` hits D6. | the rollback-failure sequence in [Probes](#probes) | Restore by copying the snapshot **over** `.agents/` first, then remove only what the snapshot does not hold, so a failure mid-way costs no original. Leave a marker file, or make `--draft`/`--commit` refuse while a same-day snapshot exists with no `state.json`, naming the snapshot. D6's fix alone breaks the data-loss chain at step 4. |

**Observations, not scored:**
- **O1 (low, both builds).** `state import --commit ""` (an empty argument, which is what an unset `"$DIR"` gives in
  bash) resolves to the cwd and commits the cwd's project. `resolve("")` is the cwd, and the new existence check
  passes. Round 1 does the same. `''` before a real directory is refused as a second positional in the candidate, and
  round 1 committed the cwd's project there too.
- **O2 (handoff wording).** The handoff says a lone-CR file "would read as one line and give *could not tell* under
  the false reason". Here, lone-CR stale inputs are judged **STALE**, because the one line starts with `# ` and so is a
  heading candidate. The quoted evidence is then the whole file. That is the safe direction. SUMMARY.md with lone CRs
  keeps its status blockquote on both builds.
- **O3 (R2-2 side effect).** A next-session titled for the next session (`# Handoff for Session 8` against log 7) is
  now *could not tell*, where round 1 said current. It does not block, but on real projects that write "for Session
  N+1" handoffs it adds a could-not-tell line every time.
- **O4 (handoff §2, confirmed for `sync`).** `sync -check` and `sync --chek` are accepted silently and exit 0. The
  real `--check` exits 1 on the known issue. The other rows of the table were not run.
- **O5 (this PC).** A `powershell -Command … Get-Content -Path C:\Users\AARONM~1\sia-qa99\run-0.jsonl -Wait` (PID
  3884) was still running from QA 99's drive, and is in both process lists. It reads a file and uses no measurable CPU.

## Disagreements, returned rather than scored

1. **The handoff's ruling for undecodable inputs**: "a judged input is *could not tell* … It does not block, which
   follows ruling 1 for 'could not tell'. The reason is at least true." Ruling 1 was about inputs whose words carry no
   session. A Windows-1252 file's session words are ASCII, and round 1 read them. The brief's R2-1 is "an encoding
   detail never turns a STALE input into could not tell". I score D5 against that sentence.
2. **IF-9 and IF-11 as written versus the protection.** Both rows pass on their named instances. I have marked them
   "PASS as written; the class FAILS" rather than FAIL, because the dispatch asked for the class. How to score them is
   the planner's call.
3. **"Byte-identical to before"** (handoff §5, IF-11) holds in every failure I induced except the rollback failure.
   The handoff says that path is untested, and it is the one that loses data.

## Error entries and near-misses (mine)

- **E1: a background `&` bound more than I meant.** My first command to run both builds' probes was
  `cd C:/qa-scratch && mkdir -p ev && (…cand…) & (…r1…) & wait`. The first `&` backgrounded the whole
  `cd && mkdir && (…)` chain, so the second subshell ran in the repo's cwd, where `ev/` did not exist, and its output
  file could not be opened. No result was read from that run. I re-ran both with absolute paths, and the evidence is
  from the re-run.
- **E2: a matrix case that was not a mis-target.** My first R2-4 matrix counted "another project" **without** B as a
  bad run (3 "BAD"). But there it is the only positional, a valid run on C. I caught it on the first output, excluded
  those orders, and added a control for the single-directory-before-the-flag case. Nothing from the first run is
  reported.
- **E3: a SUMMARY check matched the renderer's own words.** I checked for the original status blockquote with
  `/\*\*Status:\*\*/`, and the rendered region has its own `**Status:**` line, so every case said "still present". The
  check now looks for the original's text.
- **E4: a directory entry counted as a missing file.** My snapshot-completeness check keyed the `.agents/` directory
  itself as `""`, and reported "1 missing" with an empty name. Fixed.
- **E5: the process list before the full suite was not captured.** I passed the script path as
  `C:\\qa-scratch\\scripts\\procs.ps1` in bash, and PowerShell received `C:qa-scratchscriptsprocs.ps1`. Both the
  before-list and the after-list in that command failed (`evidence/processes-before-suite-FAILED.txt`). I saw it only
  in the output, after the suite had run. I did **not** re-run the suite to repair the record, because the dispatch
  allows one run. The after-list was taken 7 s later with a forward-slash path. The before-state is described from my
  own job records in [Full suite and CI](#full-suite-and-ci). The dispatch asked for both lists, and only one exists.
- **Near-miss: where the data was lost.** I first recorded the rollback-failure sequence as losing `Session_7.md` at
  step 5 (`--force-snapshot`). Reading the snapshot's `catch` showed the loss already happens at step 4. I added a
  check after every step, and that is how D6 was found. The sequence above is from the corrected run.
- **Near-miss: evidence overwritten by the thing measured.** I tried to read the PowerShell-written bytes from the
  probe directories afterwards, but `--accept-stale` had re-rendered those files as UTF-8. I recorded the byte shapes
  from a separate write instead (`evidence/ps51-bytes.out`).
- **QA 102's `mutants.mjs` run unchanged** (as the dispatch says) sees only round 1's three test files, and two of its
  anchors no longer match (`evidence/mutants-qa102-as-is.out`: M3 and M7 VOID, M13–M16 surviving). That is what the
  script measures on this tree, not a finding about the candidate. The re-anchored set over all five files is the
  scored one.
- **Git identity:** none on this PC. Every commit here passes `-c user.name="Aaron Melven" -c
  user.email=melvenac@gmail.com` for that command only. No config was written.
- **Left behind on purpose:** the worktrees `C:\qa-scratch\cand` (`aba35de`, clean) and `C:\qa-scratch\r1`
  (`65e3a89`, clean), the clones `C:\qa-scratch\sync-cand` and `sync-r1`, the A2A-Hub clone, and every probe directory
  under `C:\qa-scratch`, for reproduction. `git worktree remove` clears the two worktrees.

## Reproduction

```sh
# S = docs/loops/qa-scripts-importer-r2 ; Q = QA 102's scripts, extracted byte-exact:
#   git show origin/qa/importer-fixes-report:docs/loops/qa-scripts-importer/probes.mjs > $Q/probes.mjs   (and so on)
#   git hash-object $Q/probes.mjs   # must print a23d5d6…
git worktree add --detach C:/qa-scratch/cand aba35de && (cd C:/qa-scratch/cand/open-brain && npm ci && npm run build)
git worktree add --detach C:/qa-scratch/r1   65e3a89 && (cd C:/qa-scratch/r1/open-brain   && npm ci && npm run build)
git clone --no-checkout https://github.com/melvenac/A2A-Hub.git C:/qa-scratch/a2a-hub
node $Q/probes.mjs   C:/qa-scratch/cand C:/qa-scratch/a2a-hub C:/qa-scratch/probes-cand   # 26 passed
node $Q/probes.mjs   C:/qa-scratch/r1   C:/qa-scratch/a2a-hub C:/qa-scratch/probes-r1     # 26 passed
node $Q/fidelity.mjs C:/qa-scratch/cand C:/qa-scratch/a2a-hub                             # identical 7 of 7
node $S/probes-r2.mjs C:/qa-scratch/cand C:/qa-scratch/pr2-cand                           # 21 passed, 4 failed
node $S/probes-r2.mjs C:/qa-scratch/r1   C:/qa-scratch/pr2-r1                             # 10 passed, 15 failed
node $S/probe-existing-snapshot.mjs C:/qa-scratch/cand C:/qa-scratch/snap-cand            # D6: IS GONE
node $S/mutants-r2.mjs C:/qa-scratch/cand C:/qa-scratch/mut-r2
# IF-14: (cd C:/qa-scratch/r1 && git switch --detach c3e3297) ; vitest run the two new test files ; switch back
# IF-6:  (cd C:/qa-scratch/r1 && git switch --detach e082983) ; vitest run tests/pipelines/state-import-fixes.test.ts
# Suite: (cd C:/qa-scratch/cand/open-brain && TEMP="$QA_DEFAULT_TEMP" TMP="$QA_DEFAULT_TEMP" npx vitest run > f 2>&1; SUITE_EXIT=$?)
# Sync:  git clone <this repo> C:/qa-scratch/sync-cand && checkout aba35de && npm ci && npm run build && node open-brain/build/cli.js sync
# CI:    git branch qa/importer-fixes-r2-ci aba35de && node docs/loops/qa-106/push-qa.mjs qa/importer-fixes-r2-ci
#        gh workflow run ci.yml --ref qa/importer-fixes-r2-ci -f hosted=false
```

## Open for the planner

None of these blocks this report. Each has my recommendation.

1. **Merge or a round 3?** *Recommendation: a short round 3 on D6 and D5, with D7's marker if it is cheap.* D6 is
   a one-line move of the existence check, plus one test. D5 is a Windows-1252 fallback in `withCheck`, plus one test.
   Everything else in round 2 holds, by class.
2. **D5's rule.** Should an input the importer cannot decode **block** like STALE, or be decoded as Windows-1252 and
   judged? *Recommendation: decode as Windows-1252 and judge.* The session marker is ASCII, so the verdict is
   reliable, and blocking would stop every ANSI project for a reason the operator cannot act on from the message.
3. **D7's design.** Is "restore by hand from the kept snapshot" an acceptable end state for a failed rollback, if D6
   is fixed so that nothing destroys the snapshot? *Recommendation: yes, with a marker or a refusal on re-run*, so that
   the next `--draft` says so rather than drafting from the damaged tree.
4. **O1 (`""` as the directory).** A task, not round 3. *Recommendation:* refuse an empty positional in the same
   shared parser the §2 subcommand task will build.
5. **O3 (handoffs titled for the next session).** *Recommendation:* no change now. Watch the first adoptions' reports
   for could-not-tell lines of this shape before deciding whether "declares N+1" should count as current.
6. **O5.** QA 99's log tail (PID 3884) is still running on the QA PC. The driver could end its own viewer on exit.

**Branch:** this report and `docs/loops/qa-scripts-importer-r2/` are committed on `qa/importer-fixes-r2-report`, based
on `56d7bdd`, and pushed with `push-qa.mjs`. The driver records the read-back. `qa/importer-fixes-r2-ci` (at
`aba35de`) is this seat's only other push.

QA-106: REPORT COMPLETE
