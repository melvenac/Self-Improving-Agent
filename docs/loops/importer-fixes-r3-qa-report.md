# Importer fixes round 3 (R3-1 to R3-3): QA report, record session 111

**By:** the QA seat, record session 111, headless on the QA PC `DESKTOP-O4EGB1E` (D-045), launched by
`docs/loops/qa-111/drive.ps1`, in `C:\Users\Aaron Melven\Worktrees\sia-qa` (HEAD `30bf724`), 2026-09-26 UTC (the
driver started at 00:39:20Z; the local date, and so the CLI's `today`, was 2026-09-25 throughout).
**Candidate:** `063662b` on `origin/loop/importer-fixes-r3`, built on round 2's tip `665b3a2`. The handoff was read at
the branch tip `00244d3`, whose diff from `063662b` outside `docs/loops/` is empty. **Redcheck:** `27e4a1d` on
`origin/loop/importer-fixes-r3-redcheck` (its parent `6fe96df`, whose parent is `aba35de`).
**Dispatch:** `docs/loops/importer-fixes-r3-dispatch-qa.md`. **Scored against:** `docs/loops/importer-fixes-round-3-brief.md`
§3 (IF-16 to IF-20), with IF-1 to IF-15 from `importer-fixes-brief.md` and `importer-fixes-round-2-brief.md`, all read at
`30bf724`, and QA 106's report on `origin/qa/importer-fixes-r2-report` `9d50e1f`.
**Preconditions (the dispatch's one-at-a-time rule):** `%USERPROFILE%\sia-qa108\done` exists (written 19:37 local).
At the start, the only `claude.exe` on this PC was this run's own. The driver's `drive.meta` records
`procs_at_start=` as empty.
**Model and effort:** `claude-opus-5-5`, effort `high`. Both are read from this run's own process command line: PID
12388, `claude.exe -p "You are the QA seat, record session 111, …" --model claude-opus-5-5 --effort high …`. Its parent
is the driver, `powershell … -File …/docs/loops/qa-111/drive.ps1`, PID 5624. The stream-json transcript is
`%USERPROFILE%\sia-qa111\run-0.jsonl`, session `5707de3b-ae6c-4a5d-b70a-1d0ac54dce13`. When counted mid-run, it named
`claude-opus-5-5` on 126 of 126 assistant records. It records no effort value.
**The candidate's own build effort:** the handoff reads `medium` from the developer's transcript and records their own
first self-read of `low` as wrong. That transcript is not on this PC, so I could not check it. The dispatch gives
Aaron's word and the 191-record count, both of which say medium.
**Temps (T-190):** everything except the one full suite ran with `TEMP`=`TMP`=`C:\qa-tmp`. The suite ran with
`QA_DEFAULT_TEMP`=`C:\Users\AARONM~1\AppData\Local\Temp` (the 8.3 path, Defender on). All scratch work is under
`C:\qa-scratch\qa111`.
**Scripts and raw output:** `docs/loops/qa-scripts-importer-r3/` (README there).

## Verdict

**All five round-3 rows pass: IF-16 to IF-20. IF-1 to IF-15 still hold. Tested by class on this PC's NTFS, round 3
closes QA 106's three defects:**
- **D6 is closed.** Both same-day-snapshot refusals leave the whole project byte-identical, mtimes and the read-only bit
  included. At `aba35de` the snapshot is gone. The same holds for the snapshot copy itself failing, with `archive/`
  absent, empty, holding an earlier snapshot, or under `--force-snapshot`: only what the run created goes. N13 is red
  3/60.
- **D5 is closed.** The three Windows-1252 shapes, written here by Windows PowerShell 5.1 itself, are 3 STALE. Bare
  `--commit` refuses, and each evidence string ends `(read as Windows-1252: …)`.
- **D7 is closed.** I reproduced it at `aba35de` with QA 106's real PowerShell handle. The originals are lost at the
  plain `--commit` re-run, and `Session_7.md` exists nowhere. On the candidate, no original file is lost at any of the
  eight steps. Every re-run refuses and names the snapshot and the marker. Following that message literally restores
  the tree byte for byte, and `--force-snapshot` then completes.

**It does not close D5's class. D8 (new to QA, present since round 2, medium–high): a judged input that Windows
PowerShell 5.1 has APPENDED to with `>>` is filed as "could not tell", and a STALE project then commits without
`--accept-stale`.** PS 5.1's `>>` appends UTF-16LE with no BOM onto an existing UTF-8 or Windows-1252 file. The file
then holds NUL bytes after a perfectly readable ASCII `Session 6` line. That is three shapes, plus a stray NUL in plain
UTF-8. Round 1 refuses three of those four, and `aba35de` and the candidate commit all four. The brief's ruling kept
"could not tell" for "the NUL case, UTF-16 without a BOM", and these files are not UTF-16 without a BOM. This is the
answer to the dispatch's question: **yes, other shapes are filed "could not tell" that should be judged.** Whether D8
blocks is a ruling, because the brief ruled NUL as unreadable. My recommendation is in "Open for the planner".

**Two test gaps, found by mutants:**
- **D9 (low–medium; round 3 removed the only guard):** the refusal of a SUMMARY.md with NUL bytes (`index.ts:833`)
  now has no test that fails without it. It survives 0/60. The behaviour is right: the candidate refuses, and round 1
  rewrote the file.
- **D10 (low):** four of my mutants survive.
  - Q1, a marker from any day except today is ignored. This is the case of a rollback that fails before midnight and
    is re-run after it.
  - Q17, `--draft` reads the marker after `state.json`.
  - Q15, ROLLBACK FAILED no longer names the marker.
  - Q6, the Windows-1252 note on non-STALE verdicts.
  In each case the candidate behaves correctly; no test holds it there.

**The developer's claims, checked rather than accepted:**
- I ran their 14 mutants byte-exact: 14 of 14 red, and 13 of 14 give their per-test lists exactly.
  **R33-write is red 3/60 here, not 4/60, in three runs out of three.** Their fourth red does not reproduce.
- D7's platform dependence is confirmed both ways. On NTFS here, both redcheck sequence variants fail on
  `expected [Function] to throw`. On tcm (Linux), the first fails on `state.json already exists` and the copy-back
  variant fails on D7 itself.
- R3-1's aside and first-created directory never overlap. This is shown by reading the code, by four `--force-snapshot`
  probes that leave the tree identical, and by Q8 and Q16 being red.
- R3-3's refusal names the way out.

**Full suite, once, at `063662b`, Defender-on temp:** 76 files, **1086 of 1086 passed**, no skip, `SUITE_EXIT=0`. The
win32 8.3 test passed. No failure appeared only in this control run. **CI:** `36206625098` on `063662b`, `tcm-1`:
success, 1085 passed and 1 skipped (1086). `36206825879` on the redcheck `27e4a1d`, `tcm-1`: 11 failed, all in
`state-import-r3`, all `AssertionError`. That is 2 of the 8 runs allowed.

## Rows IF-16 to IF-20

| Row | Result | Evidence (mine unless marked) |
|---|---|---|
| **IF-16** | **PASS** | **Probe** (`probes-r3.mjs`, through the built CLI): a same-day snapshot plus plain `--commit`, and plus `--commit --accept-stale` on a stale project, each exit 1 with `already exists — pass --force-snapshot`. The **whole project** is identical afterwards (sha256, size, mtime, read-only bit). At `aba35de` both runs remove the snapshot's 4 entries. **QA 106's `probe-existing-snapshot.mjs`**, byte-exact (`e015912`): candidate `STILL EXISTS; its Session_6.md survives` twice, `aba35de` `IS GONE` twice. **Red at `aba35de`:** the redcheck `27e4a1d`, here on Windows and on tcm (`36206825879`), fails both R3-1 tests on `expected { …(9) } to deeply equal { …(10) }`. **N13 is red 3/60** (the developer's script, run here), and the new guard's mutant **R31-path is red 3/60**. So are Q8 (1/60) and Q16 (7/60), mine. |
| **IF-17** | **PASS** | The handoff's §2 table matches `063662b`, line for line. `index.ts:857` removes `made.created`, `:899` and `:918` remove the marker, `:900` removes the aside on success, `:911` removes the live originals in the rollback, and `:917` removes `created`. `shared/state-writer.ts:563` unlinks its own `.tmp-<pid>`. I searched `src/` for `rmSync`, `unlinkSync` and `rmdirSync`: the only other removes are in `state-migrate` and `topics`, which the importer does not reach, and `cli.ts`'s import door removes nothing. `:911` is the one remove of D7's shape left. It is named as such, and its protection is the kept snapshot plus R3-3's refusal. |
| **IF-18** | **PASS as written; the class FAILS (D8)** | QA 106's `probes-r2.mjs`, byte-exact (`bf970cc`): the three Windows-1252 shapes (Node-built with em dashes, and PS 5.1 `Set-Content` and `Add-Content` written here) are **3 STALE**, bare `--commit` exits 1 and writes nothing, and `--accept-stale` exits 0. The evidence ends `(read as Windows-1252: not valid UTF-8, and no byte-order mark)`. At `aba35de` all three are could-not-tell and commit. `utf16le-nobom` is still could-not-tell (`contains NUL bytes…`). The PS 5.1 **append** shapes are in [Probes](#probes): `Add-Content` onto UTF-8, UTF-8+BOM and 1252 is judged STALE, and **`>>` onto any of them is could-not-tell and commits (D8)**. |
| **IF-19** | **PASS** | QA 106's induction (PowerShell 5.1 holds SUMMARY.md open, share=Read), step by step, with **every original file looked for, byte-identical, in the live tree and in every directory under `archive/` after each step**. Candidate: **0 lost at every step (0–8)**. `--draft`, `--commit`, `--commit --force-snapshot` and `--commit --accept-stale --force-snapshot` each exit 1 with `.agents/ is half-restored…`. `aba35de`: `--draft` exits 0 on the damaged tree, and the plain `--commit` then loses 5 originals (`Session_6.md`, `Session_7.md`, `next-session.md`, the draft and the report). QA 106's own run of this sequence also passes on the candidate: "exist NOWHERE … none". A marker from an earlier day refuses, and so does a marker beside a `state.json`. |
| **IF-20** | **PASS** (as ruled) | IF-1 to IF-15 hold: see the next table. **QA 106's `probes-r2.mjs` against the candidate: 24 passed, 1 failed.** The one FAIL is `IF-9 utf16le-nobom`, which QA 106's probe expects STALE and the brief (R3-2) rules could-not-tell. Scored, as the dispatch says, as the rule changing by ruling. The candidate's behaviour there is `aba35de`'s: round 3 confirmed the rule rather than changing it, as the handoff says. Against `aba35de`: 21 passed, 4 failed (that shape plus D5's three). **Other shapes filed could-not-tell that should be judged: yes, D8.** |

## Rows IF-1 to IF-15, re-checked on the candidate

| Row | Result | Evidence |
|---|---|---|
| IF-1 | PASS | QA 102's `probes.mjs`, byte-exact (`a23d5d6`): **26 passed, 0 failed**. M1 (QA 106's set) is red 3/44. |
| IF-2 | PASS | The same run, on A2A-Hub `e0bc3f8` (a fresh `git archive` from my own clone): next-session STALE at 13 against `Session_14.md`, INBOX STALE at 11. The `--accept-stale` snapshot has 37 files, with 0 missing or differing. |
| IF-3, IF-4 | PASS | The same run. M3, M4 and M5 are red 3, 1 and 1 of 44. |
| IF-5 | PASS | M1 3/44, M2 9/44, M3 3/44. `tsc` exits 0 on each. |
| IF-6 | PASS | `origin/loop/importer-fixes-redcheck` is still `e082983`. Re-run here on `65e3a89`'s install: **9 failed of 9**, all `AssertionError`, with QA 102's breakdown (5× `expected undefined to be defined`, and one each of seed deep-equal, `verified 0 · gaps 0`, `to throw`, `+0 to be 1`). |
| IF-7 | PASS | `state-import.test.ts` and `-seeds.test.ts` are unchanged since `65e3a89`. From `aba35de` to `063662b` the tests change only `-r2.test.ts`: the one test the brief ordered changed, which now asserts `/NUL/` and carries a comment saying why. They also add `-r3.test.ts`. QA 102's `fidelity.mjs` (`71dfd82`): identical 7 of 7. M7, re-anchored, is red 3/44. |
| IF-8 | PASS (the ruled-out part unrun) | Plain `open-brain sync` in a scratch clone at `063662b`, rebuilt: `25 passed, 0 fixed, 2 warnings, 1 issues, 2 skipped`, and the tree is clean afterwards. The issue is the known ENTITIES.md retirements finding, and the warnings and skips are the ones QA 106 listed (`obsidian-vault`, `spec-provenance`; `gitnexus-index`, `ci-status`). `build-freshness` passes at `063662b`, and `merge-markers` counts 470 files. |
| IF-9 | PASS as written | See IF-18 and IF-20: 16 of 17 shapes as QA 106 expects them, and the 17th is ruled. D8 is the class. |
| IF-10 | PASS | `probes-r2.mjs` R2-2: +13 and +1 are could-not-tell with both numbers named, equal is current, and −1 is STALE and refuses. These are identical to QA 106's lines. |
| IF-11 | PASS | `probes-r2.mjs` R2-3: PROBE-2 completes. With a read-only INBOX.md the tree is identical, mtimes included, and a re-run completes once it is writable. `--force-snapshot` leaves the tree identical. A junction is rolled back as a link, and its target is untouched (on this PC the snapshot copied the junction, so this path ran; see O11). QA 106's "but" (D6, D7) is closed. |
| IF-12 | PASS | `probes-r2.mjs`: **60 of 60** matrix runs exit 1 and leave A, B and C unchanged. The edges are as QA 106 recorded, O1 included (`""` still commits the cwd's project, as ruled out of scope). |
| IF-13 | PASS | QA 106's `mutants-r2.mjs`, byte-exact (`70e129d`), against the candidate's source: `tsc` exits 0 on every applied mutant. M1–M16, N1–N4, N6–N8, N10–N12, N15–N17, R1, R2 and R4 are red. **N9, N13, N13b, N14 and R3 are VOID**: round 3 rewrote exactly those lines (`archiveExisted` is gone). Their successors are the developer's R31-path, N13, R31-record and R31-rollback, all red. **N5 survives 0/44** (see D9). E1 is equivalent, as before. |
| IF-14 | PASS | `origin/loop/importer-fixes-r2-redcheck` is still `c3e3297`. Re-run here on `65e3a89`: **17 failed of 21**, all `AssertionError`. |
| IF-15 | PASS | CI `36206625098` (below), and the full suite at 1086/1086 (below). |

## Probes

### QA 106's scripts, byte-exact, against the candidate and `aba35de`

`probes-r2.mjs` gives candidate 24 passed and 1 failed, and `aba35de` 21 passed and 4 failed
(`evidence/probes-r2-063662b.out`, `-aba35de.out`). `probe-existing-snapshot.mjs` is in the IF-16 row. The only lines
where the two builds differ:

| Probe | `aba35de` | Candidate `063662b` |
|---|---|---|
| 1252 with em dashes; PS 5.1 `Set-Content`; PS 5.1 `Add-Content` (stale) | 3 could not tell, **commits** | **3 STALE, refused**; evidence ends `(read as Windows-1252: …)` |
| SUMMARY.md in Windows-1252 | refused ("not valid UTF-8 … cannot be read") | refused ("can only be guessed"), tree identical |
| The rollback itself fails: `archive/` afterwards | the snapshot | the snapshot **and `pre-state-migration-2026-09-25.import-incomplete`** |
| Re-run 1, `--draft` | exit 0 on the damaged tree | exit 1, half-restored |
| Re-run 2, `--commit` | exit 1, "already exists", **snapshot gone** | exit 1, half-restored; the snapshot still holds `Session_7.md` |
| Re-run 3, `--commit --force-snapshot` | exit 0; `Session_7.md` exists nowhere | exit 1, half-restored; "exist NOWHERE … none" |

In both builds, the live tree right after the failed rollback has lost the same 5 entries, because of the `readdir`
order on NTFS. What differs is that nothing later can make it worse.

### Mine: `probes-r3.mjs`, by class, against the candidate, `aba35de` and round 1 `65e3a89`

Candidate: 17 passed and 4 failed (the 4 are D8). `aba35de`: 7 passed, 12 failed. `65e3a89`: 8 passed, 11 failed
(`evidence/probes-r3-*.out`).

**R3-1, only what the run created goes.** "Identical" means the whole project, `archive/` included, with mtimes and
the read-only bit. The snapshot copy was made to fail by a file under `.agents/notes/` that PowerShell held open with
`FileShare.None` (`EBUSY … copyfile`).

| Case | Candidate | `aba35de` | Round 1 |
|---|---|---|---|
| same-day snapshot + `--commit` | refused, identical | refused, **snapshot deleted** | refused, identical |
| the same + `--accept-stale` (stale) | refused, identical | refused, **snapshot deleted** | refused, identical |
| copy fails, `archive/` absent | identical (`archive/` gone again) | identical | partial snapshot left |
| copy fails, `archive/` present and empty | identical (`archive/` kept, empty) | identical | partial snapshot left |
| copy fails, `archive/` holds an earlier snapshot | identical | identical | partial snapshot left |
| copy fails under `--force-snapshot` (the aside) | identical: the aside is back byte for byte | identical | partial copy merged in |
| `--force-snapshot` + render failure | identical | identical | 11 entries merged into the earlier snapshot |

**R3-2, PowerShell 5.1 appending.** Each judged input was written whole, then Windows PowerShell 5.1.19041.6456 on
this PC appended one line with an em dash. The bytes are in `evidence/ps51-append-bytes.out`: `>>` always appends
**UTF-16LE with no BOM** (`2d 00 20 00 …`, the em dash as `14 20`), whatever the file already is. `Add-Content` appends
Windows-1252 (`97`).

| Shape (stale: Session 6 vs log 7) | First NUL | Round 1 | `aba35de` | **Candidate** |
|---|---|---|---|---|
| UTF-8, then `>>` | byte 103 | 3 STALE, refused | could not tell, **commits** | **could not tell ("contains NUL bytes…"), commits: D8** |
| UTF-8, then `Add-Content` | none | 3 STALE, refused | could not tell, commits | 3 STALE, refused (read as 1252) |
| UTF-8+BOM, then `>>` | byte 106 | could not tell, commits | could not tell, **commits** | **could not tell, commits: D8** |
| UTF-8+BOM, then `Add-Content` | none | could not tell, commits | 3 STALE, refused | 3 STALE, refused |
| 1252, then `>>` | byte 104 | 3 STALE, refused | could not tell, **commits** | **could not tell, commits: D8** |
| 1252, then `Add-Content` | none | 3 STALE, refused | could not tell, commits | 3 STALE, refused (read as 1252) |
| UTF-8 with one stray NUL at the end | at the end | 3 STALE, refused | could not tell, **commits** | **could not tell, commits: D8** |

"Commits" means bare `--commit` exits 0 and writes `state.json` with no `--accept-stale`. In each D8 row, the text
before the first NUL holds the whole `> **Last Updated:** Session 6` line. The current-session variants (Session 7) are
could-not-tell in the D8 rows and current elsewhere.

**R3-2, other checks.**
- A SUMMARY.md in UTF-16LE with no BOM: the candidate and `aba35de` refuse `--commit`, and the tree is identical.
  Round 1 commits and rewrites it. This is the behaviour D9's mutant removes with no test noticing.
- A **Windows-1251** (Cyrillic) INBOX item, `Задача`, is drafted by the candidate as `"Çàäà÷à"`, with the verdict
  judged and the note `read as Windows-1252`. At `aba35de` and round 1 the draft has `"������"`. See O6.

**R3-3, the sequence, the way out, and the marker.** On the candidate (`evidence/probes-r3-063662b.out`):

| Step | Exit | Originals lost | `archive/` |
|---|---|---|---|
| 0 drafted | – | none | – |
| 1 `--commit`, SUMMARY.md held | 1: `EBUSY … ROLLBACK FAILED (EBUSY … unlink …SUMMARY.md) … Restore it by hand from …, which was kept. --draft and --commit refuse until ….import-incomplete is deleted` | none (6 live entries gone, all in the snapshot) | snapshot + marker |
| 2 `--draft` | 1: half-restored | none | the same |
| 3 `--commit` | 1: half-restored | none | the same |
| 4 `--commit --force-snapshot` | 1: half-restored | none | the same |
| 5 `--commit --accept-stale --force-snapshot` | 1: half-restored | none | the same |
| 6 the way out, done literally: the paths are parsed from step 3's message, `.agents/` is restored from the named snapshot, and the named marker is deleted | – | none; **the live tree is identical to the original** | snapshot |
| 7 `--commit` | 1: `already exists — pass --force-snapshot` | none | snapshot |
| 8 `--commit --force-snapshot` | **0**, committed | none; the new snapshot holds 8 of 8 originals byte-identical | snapshot |

Step 3's refusal is:
*".agents/ is half-restored: an earlier --commit failed and its rollback did not finish. Restore .agents/ by hand from
.agents/archive/pre-state-migration-2026-09-25/, which holds every original, then delete
.agents/archive/pre-state-migration-2026-09-25.import-incomplete. Nothing written"*. Both named paths exist.

At `aba35de`, the same script gives the following. Step 2 exits 0. **Step 3 (plain `--commit`) loses 5 originals**,
`archive/` is empty, and the message is "already exists". Step 4 then commits from the damaged tree. Round 1 adds
`state.json`, loses nothing, and refuses every re-run with `state.json already exists`, as QA 106 recorded.

Also on the candidate:
- A marker dated `2026-01-01` refuses both doors, and the tree is identical.
- Two markers are both named (O7).
- A marker beside a `state.json` gets the half-restored refusal from both doors, not `state.json already exists`.

## Mutants

**The developer's `mutants-r3.cjs`, run byte-exact.** The blob `8c5527e` was checked with `git hash-object`. It ran
from `open-brain/` in a worktree at `00244d3`, whose `open-brain/` is identical to `063662b`'s (source sha256/12
`b11130490235`, as the handoff records). Output: `evidence/dev-mutants/mutants-r3.out`.
- **All 14 are red, and `tsc` is clean on each.** Each of my 14 `git diff`s is byte-identical to theirs in
  `evidence/mutant-diffs-063662b/`. The source was restored after each, and `git status` was clean at the end.
- **The red-test lists match theirs exactly, except R33-write:** 3/60 here against their 4/60. Their extra red is "a
  completed rollback leaves no marker, and a re-run completes (archive/ absent before)". That test cannot depend on
  whether the marker is written: with no marker, the rollback still completes and the tree is still equal. I re-ran
  R33-write alone twice, with nothing else running, and got **3/60 both times**
  (`evidence/dev-mutants/R33-write-rerun-{1,2}.out`). Their fourth red was most likely the Windows rename EPERM their
  §4 describes.
- **So the handoff's "a completed rollback: … R33-write (one variant)" is not reproduced.** That guard is still killed
  by R31-rollback and R31-record (both variants), and by my Q16.

**Mine: `mutants-r3-qa.mjs`, by the developer's method** (`evidence/qa-mutants/`):

| Mutant | Protection | Red of 60 | Red tests |
|---|---|---|---|
| **Q1** | R3-3: a marker from ANY day refuses (mutant: only today's) | **0: survives** | none. Every marker test uses `TODAY`. The probe shows a 2026-01-01 marker refusing, so the behaviour is right. |
| Q3 | R3-3: a FAILED rollback keeps the marker | 2 | both sequence variants |
| **Q6** | R3-2: the 1252 note on every verdict (mutant: STALE only) | **0: survives** | none |
| Q8 | R3-1: a failed snapshot puts the aside back | 1 | the `--force-snapshot` partial-snapshot test |
| Q10 | a completed rollback puts the aside back | 1 | atomic `--force-snapshot` |
| Q13 | the NUL rule for **valid** UTF-8 (D8's site) | 2 | the r2 and r3 "UTF-16 with no BOM" tests. D8's behaviour is pinned by tests. |
| **Q15** | R3-3: ROLLBACK FAILED names the marker | **0: survives** | none. The re-run refusal names it anyway. |
| Q16 | R3-1: `made.created` is the FIRST directory created (mutant: always the snapshot) | 7 | 5 atomic failure points, the partial snapshot, the completed rollback with `archive/` absent |
| **Q17** | R3-3: `--draft` reads the marker before `state.json` | **0: survives** | none. Only `--commit`'s order is pinned (R33-commit). With the mutant, a process that died after `state.json` gets "already exists" from `--draft`, which does not name the way out. |
| Q18 | R3-2: `--draft` passes `readAs` | 3 | the three 1252 shapes |
| Q19 | R3-2: `--commit`'s re-judgement passes `readAs` | 0 | **equivalent at the CLI**: `--commit` prints input names, never evidence (`cli.ts:492-494`). |
| **Q20** | QA 106's N5, over all six files: a SUMMARY.md with NUL bytes refuses `--commit` | **0: survives** | none: **D9** |

`tsc --noEmit -p .` exits 0 on each counted mutant. Q20's first form (`&& false`) failed `tsc` (TS18047), did not
count, and was re-run alone in N5's form (`evidence/qa-mutants/Q20-rerun.out`). The source was restored and hashed
after each mutant (`b11130490235`), and `git status` was clean.

**QA 106's `mutants-r2.mjs`, byte-exact:** see IF-13. Output is in `evidence/mutants-r2-asis.console`, with the diffs
beside it.

## Full suite and CI

**The full suite, once, at `063662b`** (`evidence/full-suite-063662b.out`): run from `open-brain` in the candidate
worktree, clean at `063662b` (`git status --porcelain` empty), **01:14:06Z–01:16:23Z**, as
`TEMP="$QA_DEFAULT_TEMP" TMP="$QA_DEFAULT_TEMP" npx vitest run > file 2>&1; SUITE_EXIT=$?`, giving **`SUITE_EXIT=0`**.
- **Temps:** `C:\Users\AARONM~1\AppData\Local\Temp` (8.3, not Defender-excluded). Every other run used `C:\qa-tmp`.
- **Result:** Test Files **76 passed (76)**, Tests **1086 passed (1086)**, with no skip, in 134.34 s. The importer
  files are 9, 17, 16, 8, 8 and 2. **The 8.3 test passed** (433 ms). `onTaskUpdate`/`Unhandled`: 0. **No failure in
  the control run**, so there is no temp-only failure to report. This is CI's 1085 + 1 skipped, with the skip run.
- **Processes, before and after** (`evidence/processes-before-suite.txt`, `-after-suite.txt`; QA 106's E5 avoided with
  forward-slash paths):
  - Before (01:13:59Z): CPU load 0%. Only this run's `claude.exe` 12388, the driver 5624, QA 99's log tail 3884 (O5),
    the listing itself and `MsMpEng.exe`. My mutant runs and CI waits had all ended.
  - After (01:16:23Z): 1%, with the same processes.

**CI: 2 runs of the 8 allowed**, on branches I created and pushed with `push-qa.mjs`:
- `qa/importer-fixes-r3-ci` at `063662b`: `pushed and read back … 063662bb12ca…`.
- `qa/importer-fixes-r3-redcheck` at `27e4a1d`: `pushed and read back … 27e4a1dc435e…`.

Both were dispatched as `gh workflow run ci.yml --ref <branch> -f hosted=false`.

| Run | SHA (from the log's `git log -1`) | Runner (from the log) | Result |
|---|---|---|---|
| `36206625098` | `063662bb12ca…` | `tcm-1`, machine `tcm`. 9 `blocked:` and `denied: /opt/doorctl`. The checkout first reset another seat's `02871d7` | **success**: 76/76 files, **1085 passed, 1 skipped (1086)**. The importer files are 9, 16, 17, 8, 8 and 2, all ✓. The skip is the win32 8.3 test. `onTaskUpdate`/`Unhandled`: 0. This agrees with the developer's `36198263294` on `tcm-2`. |
| `36206825879` | `27e4a1dc435e…` | `tcm-1`, egress checks the same | failure, as intended: **11 failed** / 1073 passed / 1 skipped (1085). All 11 are in `state-import-r3`, and all are `AssertionError`: R3-1 ×2 `{ …(9) } to deeply equal { …(10) }`; R3-2 ×3 `{ …(3) }`; `'\ufffd do it'`; `to match /NUL/`; **sequence (removing `SYSTEM/`) `…matching /half-restored/ but got '.agents/state.json already exists…'`**; **sequence (copy-back) `expected [Function] to throw an error`**; marker-first `expected false to be true`; dead process `to throw`. The five other importer files are ✓. This is the developer's `36197521563`, test for test. |

The same redcheck on this PC (`evidence/redcheck-27e4a1d.out`) is also 11 failed of 15 in `state-import-r3` (48 of 59
importer tests passed). **Both sequence variants fail on `expected [Function] to throw an error`**: on NTFS,
`state.json` goes first, so `--draft` runs. This is the platform difference the handoff's §0 describes, seen on both
platforms.

The only warning in either log, which predates the candidate, is the Node 20 deprecation for `actions/checkout@v4` and
`actions/setup-node@v4`. The logs, with ANSI codes stripped, are `evidence/ci-36206625098.txt` and
`evidence/ci-36206825879.txt`. They are `.txt` because the repository ignores `*.log`: my first commit silently left
them out, and I caught it by counting the files in the commit before pushing.

## What could not be verified

- **GitNexus `impact` / `detect_changes`, and `/sync --check` after an analyze:** `gitnexus` is not available here, by
  the dispatch.
- **The developer's transcript** (their effort and the 191 records) is not on this PC.
- **Their EPERM flake** (§4) did not appear here. Across my 63 mutant test runs (vitest JSON reports), `EPERM`
  occurs only in N13, R31-record and R31-rollback. It is in tests those mutants break themselves: the partial snapshot
  is left in the way, so the aside's rename back fails. The developer lists the same tests as red for those mutants.
  No unmutated or unrelated test failed on EPERM, so I could not observe their flake or its cause.
- **A real adopting project** written with PS 5.1's `>>`, Windows-1252 or Windows-1251: the shapes were made here.
  A2A-Hub's inputs are UTF-8.
- **UTF-16BE with no BOM** was not probed. By `index.ts:143` it is could-not-tell, with the same ruling as LE.
- **The other doors and the marker** (O9): not tested.
- **The main checkout's build** (T-172) is not on this PC.

## Defects

QA 102 numbered D1–D4 and QA 106 D5–D7. **D5, D6 and D7 are closed at `063662b`**, by the probes and the row evidence
above. The numbering continues here.

| # | Severity | New? | Defect | Evidence | Suggested fix |
|---|---|---|---|---|---|
| **D8** | **medium–high** (a way past T-180's block; D5's class) | new to QA; **present since round 2 (`aba35de`)**, and round 1 refuses 3 of its 4 shapes | A judged input that holds a NUL byte is could-not-tell, however readable its marker line is, and so it does not block. Windows PowerShell 5.1's `>>` (Out-File -Append) appends **UTF-16LE with no BOM** onto an existing UTF-8 or Windows-1252 file, so a hand-appended INBOX line makes the whole file "unreadable" (`index.ts:143`; `:140` for the 1252 case). A STALE project then commits without `--accept-stale`. The brief kept could-not-tell for "the NUL case, UTF-16 without a BOM"; these files are UTF-8 or 1252 with a UTF-16 tail, and a stray NUL in plain UTF-8 behaves the same. | the R3-2 append table; `evidence/ps51-append-bytes.out`; Q13 shows the r2 and r3 tests pin this behaviour | Either **make an unreadable judged input block like STALE, unless `--accept-stale`** (QA 106's alternative for D5, now cheap because 1252 is read), or judge the text with its NUL bytes removed and fall back to could-not-tell only when no marker is found. Add the four shapes as tests (bytes only, so they run on Linux too). |
| **D9** | low–medium (an unguarded protection; round 3 moved its only guard) | new: round 2's N5 was red 1/44 at `aba35de` | The refusal of a SUMMARY.md with NUL bytes (`index.ts:833`) has no test that fails without it (Q20, and N5, 0/60 and 0/44). The one test that used to kill N5 writes Windows-1252 bytes, which now reach the new 1252 check at `:836` instead. Without `:833`, a UTF-16-no-BOM SUMMARY.md would be rewritten in place through a UTF-8 read with NULs in it, as round 1 does. | Q20; `probes-r3` "SUMMARY.md as UTF-16LE with no BOM" (candidate refuses; round 1 commits) | One test: a UTF-16LE SUMMARY.md with no BOM, plus `--commit`, refuses and leaves the tree identical. |
| **D10** | low (test gaps; behaviour verified correct) | new | Four protections have no killing test. **Q1:** only today's marker is tested, so a refactor that checks `pre-state-migration-<today>.import-incomplete` passes every test. That is exactly the case of a rollback that fails late in the evening and is re-run the next morning. **Q17:** `--draft`'s marker-first order. **Q15:** ROLLBACK FAILED naming the marker. **Q6:** the 1252 note on current and could-not-tell verdicts. | `evidence/qa-mutants/mutants-r3-qa.out`; `probes-r3` "a marker from an earlier day" | Q1 and Q17 first: a marker with another date refuses both doors, and a marker plus `state.json` gets the half-restored refusal from `--draft`. |

**Observations, not scored:**
- **O6 (R3-2's guess reaches `state.json`).** A Windows-1251 item `Задача` is drafted as `Çàäà÷à`. When committed,
  that is what `state.json` and the re-rendered INBOX.md hold. The candidate's own reason for refusing a 1252
  SUMMARY.md ("a wrong guess would rewrite its other text") applies to the three rendered views too. It is not a
  regression: `aba35de` and round 1 give `������`. The original is kept in the snapshot, and the report's evidence
  says `read as Windows-1252`. But `--commit`'s output never shows that note.
- **O7 (two markers).** The refusal reads "Restore .agents/ by hand from A/ and B/, which holds every original, then
  delete …". The verb is singular, and it does not say which snapshot to restore from (the newest).
- **O8 (message grammar, also at `aba35de`).** "`.agents/SYSTEM/SUMMARY.md is contains NUL bytes, …`": `:833`
  prefixes "is" to `:143`'s reason.
- **O9 (the marker has one reader).** Only `state import --draft` and `--commit` read the marker. On a filesystem
  whose `readdir` order keeps `state.json` through a failed rollback (Linux, by the developer's CI and mine), the
  half-restored project has a `state.json` that other doors could treat as migrated. Out of R3-3's scope, and not
  tested here.
- **O10 (after the way out).** Step 7 then advises `--force-snapshot`, which on success deletes the kept snapshot, the
  one complete copy of the originals. With a correct hand restore, the new snapshot holds all of them (8/8 here). With
  an incomplete one it would not. The refusal could say to keep a copy of the snapshot until the re-run completes.
- **O11 (the junction, this PC versus the developer's).** Here the snapshot copied `.agents/linked` as a link, so the
  render failure and rollback path ran. The target was untouched and the link was restored as a link. The developer's
  box took the partial-snapshot path instead (no symlink privilege). Both paths are safe.
- **O5 (still open).** QA 99's `Get-Content … -Wait` (PID 3884) is still running on this PC. It is in both process
  lists.

## Disagreements, returned rather than scored

1. **IF-18 "PASS as written; the class FAILS".** The row names the three 1252 shapes and the NUL and UTF-16-no-BOM
   shapes, and all five behave as it says. D8 fails R3-2's own sentence ("an encoding detail never turns a STALE input
   into could not tell"), but the ruling put "the NUL case" on the could-not-tell side. How to score that is the
   planner's call.
2. **The handoff's R33-write count** (4/60): 3/60 here, three times out of three. See Mutants.
3. **IF-20's `utf16le-nobom`:** scored as ruled. Strictly, round 3 did not change the rule there. It kept `aba35de`'s
   rule, and the handoff says so too.

## Error entries and near-misses (mine)

- **E1: a verdict line read after `--commit` had moved the report.** The first run of `probes-r3.mjs` printed
  `(no INBOX line)` for the shapes that committed. Its counts were right, because they were taken before `--commit`,
  but the quoted line was read afterwards, when the report was already in the snapshot. I fixed it and re-ran all three
  builds, and the evidence is from the re-run.
- **E2: a mutant that did not typecheck.** Q20 as `&& false` failed `tsc` (TS18047), so it was recorded as not
  counted. I re-ran it alone in QA 106's N5 form. Both outputs are kept.
- **Near-miss: runs that overlapped.** The developer's mutant run (00:43:45Z–00:48:15Z) overlapped my first
  `probes-r3.mjs` run and the PowerShell append writes. Its results match the developer's except R33-write, so I re-ran
  that mutant alone twice with nothing else running. Nothing else ran beside the full suite (the process list before it
  shows so).
- **Near-miss: another seat's build.** QA 106's round-1 worktree `C:\qa-scratch\r1` was still on this PC, built. I
  built my own at `C:\qa-scratch\qa111\r1` instead, so no result rests on a build I did not make.
- **Two harmless command errors:** a `tail -3` with two files (a syntax error; nothing read from it), and one
  `gh run view` from a directory that is not a git repository (re-run from the repo).
- **Git identity:** there is none on this PC. The commit passes `-c user.name=… -c user.email=…` for that command only.
  No config was written.
- **Left behind on purpose, for reproduction:**
  - worktrees under `C:\qa-scratch\qa111`: `cand` (`063662b`), `base` (`aba35de`), `red` (`27e4a1d`), `dev`
    (`00244d3`), `r1` (`65e3a89`) and `report`, all clean;
  - the clones `sync-cand` and `a2a-hub`, and every probe directory;
  - the local branches `qa/importer-fixes-r3-ci`, `-redcheck` and `-report`.
  `git worktree remove` clears the worktrees. The shared tree's HEAD was never moved.

## Reproduction

```sh
# S = docs/loops/qa-scripts-importer-r3 ; Q6 = QA 106's scripts, Q2 = QA 102's, each extracted with git cat-file and
# checked with git hash-object (bf970cc, e015912, 70e129d; a23d5d6, 71dfd82). W = C:/qa-scratch/qa111
for p in "cand 063662b" "base aba35de" "red 27e4a1d" "dev 00244d3" "r1 65e3a89"; do set -- $p
  git worktree add --detach $W/$1 $2 && (cd $W/$1/open-brain && npm ci && npm run build); done
node $Q6/probes-r2.mjs $W/cand $W/pr2-cand ; node $Q6/probes-r2.mjs $W/base $W/pr2-base   # 24/1 ; 21/4
node $Q6/probe-existing-snapshot.mjs $W/cand $W/snap-cand                                 # STILL EXISTS x2
node $S/probes-r3.mjs $W/cand $W/pr3-cand   # and $W/base, $W/r1                          # 17/4 ; 7/12 ; 8/11
node $Q2/probes.mjs $W/cand $W/a2a-hub $W/p102-cand ; node $Q2/fidelity.mjs $W/cand $W/a2a-hub   # 26/0 ; 7 of 7
(cd $W/dev/open-brain && node ../docs/loops/dev-scripts-importer-r3/mutants-r3.cjs $W/ev/dev-mutants)   # 14 red
(cd $W/dev/open-brain && node $S/mutants-r3-qa.mjs $W/ev/qa-mutants)
node $Q6/mutants-r2.mjs $W/dev $W/ev/mutants-r2-asis
(cd $W/red/open-brain && npx vitest run tests/pipelines/state-import)                    # 11 failed of 15 in -r3
# Suite: (cd $W/cand/open-brain && TEMP="$QA_DEFAULT_TEMP" TMP="$QA_DEFAULT_TEMP" npx vitest run > f 2>&1; SUITE_EXIT=$?)
# CI:    git branch qa/importer-fixes-r3-ci 063662b && node docs/loops/qa-111/push-qa.mjs qa/importer-fixes-r3-ci
#        gh workflow run ci.yml --ref qa/importer-fixes-r3-ci -f hosted=false
```

## Open for the planner

None of these blocks this report. Each has my recommendation.

1. **D8: judge it, block it, or accept it?** *Recommendation: block.* An input the importer cannot read should block
   `--commit` like STALE, unless `--accept-stale` is passed. QA 106 turned that down for D5 because it would stop every
   ANSI project. Round 3 now reads Windows-1252, so what is left unreadable is rare, and blocking costs little. It also
   closes the class for shapes nobody has thought of, UTF-16 without a BOM included, without a new decoder.
2. **Merge, or a round 4?** *Recommendation: a short round 4 on D8, with D9's test and D10's Q1 and Q17 tests, before
   T-181 adopts a Windows project.* `>>` in Windows PowerShell 5.1 is the plainest way to add a line to INBOX.md on
   Windows 10. If the planner rules D8 out of scope, round 3 is sound on its own terms: every row passes, and D5, D6
   and D7 are closed by class.
3. **IF-18 and IF-20 scoring** (Disagreements 1 and 3). *Recommendation:* IF-18 "PASS as written; class fails
   (D8)", and IF-20 "PASS as ruled".
4. **The handoff's R33-write 4/60.** *Recommendation:* take 3/60 as the number. Nothing depends on it, because the
   guard it was credited with has three other killers.
5. **O9, the marker's single reader.** *Recommendation:* no change in this loop. Note it for T-181: if another door
   meets a project with a marker, it should say so.
6. **O5.** QA 99's log tail (PID 3884) is still running on the QA PC. The driver could end its own viewer on exit.

**Branch:** this report and `docs/loops/qa-scripts-importer-r3/` are committed on `qa/importer-fixes-r3-report`, based
on `30bf724`, and pushed with `push-qa.mjs`. The driver records the read-back. `qa/importer-fixes-r3-ci` (`063662b`)
and `qa/importer-fixes-r3-redcheck` (`27e4a1d`) are this seat's only other pushes.

QA-111: REPORT COMPLETE
