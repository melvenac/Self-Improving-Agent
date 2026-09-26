# Importer fixes round 4 (R4-1 to R4-3): QA report, record session 122

**By:** the QA seat, record session 122, headless on the QA PC `DESKTOP-O4EGB1E`. It was launched by
`docs/loops/qa-122/drive.ps1` in `C:\Users\Aaron Melven\Worktrees\sia-qa` (HEAD `7729943`) on 2026-09-26 UTC. The
driver started at 03:23:01Z. The local date, and so the CLI's `today`, was 2026-09-25 throughout.
**Candidate:** `78a7d13` on `origin/loop/importer-fixes-r4`, built on round 3's tip `00244d3`. The handoff was read at
the branch tip `2005a3e`. Its diff from `78a7d13` is 71 files, all under `docs/loops/`. **Redcheck:** `94704f4` on
`origin/loop/importer-fixes-r4-redcheck`, three test-only commits on `063662b`.
**Dispatch:** `docs/loops/importer-fixes-r4-dispatch-qa.md`.
**Scored against:**
- `docs/loops/importer-fixes-round-4-brief.md` §1 and §3 (IF-21 to IF-25), read on `origin/docs/session-100-qa99-dispatch`;
- IF-1 to IF-20 from the round 1–3 briefs on the same branch;
- QA 111's report on `origin/qa/importer-fixes-r3-report` (`5abe44f`).

**Preconditions (the dispatch's one-at-a-time rule):** `%USERPROFILE%\sia-qa120\done` exists (written 22:08 local).
At the start, the only `claude.exe` on this PC was this run's own, and the driver's `drive.meta` records
`procs_at_start=` as empty.
**Model and effort:** `claude-opus-5-5`, effort `high`, from two sources:
- **This run's process command line:** PID 10152, `claude.exe -p "You are the QA seat, record session 122, …" --model
  claude-opus-5-5 --effort high …`. Its parent is the driver, `powershell … -File …/docs/loops/qa-122/drive.ps1`, PID
  5692.
- **The transcript:** `~/.claude/projects/C--Users-Aaron-Melven-Worktrees-sia-qa/b223402c-b889-465c-8f8d-245ad26b7424.jsonl`,
  counted at 03:56Z. It names `claude-opus-5-5` on 280 of 280 assistant records, with `effort="high"` and
  `perTurnEffort="high"` on 280 of 280. The driver's stream-json copy (`%USERPROFILE%\sia-qa122\run-0.jsonl`) has the
  same 280 records and no effort field.

**The candidate's own build effort:** the dispatch that launched the developer said *medium*. The developer read *high*
on 286 of 286 transcript records and recorded high (D-047). That transcript (`6c2dffdd-…`) is not on this PC, so I
could not recount it. As the dispatch asks, this is scored as a finding about the dispatch, not the build (F1 below).
**Temps (T-190):** everything except the one full suite ran with `TEMP`=`TMP`=`C:\qa-tmp`. The suite ran with
`QA_DEFAULT_TEMP`=`C:\Users\AARONM~1\AppData\Local\Temp` (the 8.3 path, Defender on). All scratch work is under
`C:\qa-scratch\qa122`.
**Scripts and raw output:** `docs/loops/qa-scripts-importer-r4/` (README there).

## Verdict

**All five round-4 rows pass: IF-21 to IF-25. IF-1 to IF-20 still hold. R4-1 closes D8 by class, R4-2 closes D9,
and R4-3 closes D10's first half:**
- **D8 is closed.** I wrote each shape with Windows PowerShell 5.1 itself (5.1.19041.6456), not only as bytes: the
  four QA 111 shapes, plus UTF-16LE and UTF-16BE with no BOM, in a stale and in a current project.
  - Each is could-not-tell with the reason `unreadable`. A bare `--commit` exits 1, and the whole project is identical
    afterwards (sha256, size, full `mtimeMs`, the read-only bit). The refusal names the file, its NUL count, its first
    offset (counted in the file, BOM included) and `--accept-stale`.
  - `--accept-stale` completes and prints `Imported UNREADABLE under --accept-stale`.
  - That is 12 of 12 here. At `063662b`, all 12 commit on a bare `--commit`.
- **IF-22's list is the code's list.** Four producers set `could_not_tell` (`index.ts:535`, `:539`, `:544`, `:551`).
  One table, `COULD_NOT_TELL` (`:457-462`), marks only `unreadable` as blocking. One function, `blocksCommit`
  (`:468`), reads it, and it is the only test the report (`:699-700`), `runCommit` (`:865`) and the CLI
  (`cli.ts:481`) use. `no_session_log`, `no_declared_session` and `ahead_of_latest` each commit through the CLI, and
  IF-10's +13 and +1 still commit.
- **D9 and D10 (Q1, Q17) are closed.** QA 106's N5 is red 1/45, and QA 111's Q20 3/83, Q1 1/83 and Q17 1/83. All are
  byte-exact, here and on tcm.

**Other shapes: yes, there is another way past the block. D11 (new to QA, present since round 2's decoder
`a1269b2`, low–medium): a STALE INBOX.md written with `Set-Content -Encoding UTF32` or `-Encoding UTF7` commits on a
bare `--commit` and imports none of its tasks.**
- UTF-32LE's BOM `FF FE 00 00` matches the UTF-16LE test at `:124`. The UTF-16 paths never look for NULs, so the text
  is "S\0e\0s\0…".
- UTF-7 is plain ASCII with `>`, `*`, `[` and `]` encoded (`+AD4-`, `+ACoAKg-`).
- Both are filed `no_declared_session`, which does not block. The live INBOX.md is then re-rendered with 0 tasks; the
  original survives only in the snapshot.
- Both are the same at `063662b`, and the ruling's rationale ("closes the class … with no new decoder") did not
  foresee them.
- It is reproduced as a vitest file on `qa/importer-fixes-r4-d11`, red on tcm (`36215197448`) and on NTFS.
- The other candidates the dispatch named are judged as they read: a UTF-8 BOM then UTF-16, all NULs, and UTF-32BE
  block. Zero bytes and a file held open are in O12 and O13.

**D12 (low–medium, a scope question): a DECISIONS.md with an ADR appended by `>>` commits silently without that ADR.**
DECISIONS.md is not judged, so its NUL bytes neither block nor appear anywhere in the draft, the report or the
`--commit` output. The report says "Imported 1 ADRs". That is also `063662b`'s behaviour. Whether R4-1's "an input the
importer cannot read BLOCKS" covers inputs that are not judged is for the planner ("Open", 2).

**The developer's claims, checked rather than accepted:**
- **Their 13 mutants, byte-exact, reproduce.** 13 of 13 are red with their local counts. My 13 `git diff`s are
  byte-identical to theirs, and `tsc` is clean on each.
- **Their account of QA 106's and QA 111's scripts reproduces.** `probes-r2` gives 24/1, `probes-r3` 17/4 with all 21
  checks run, and `probe-existing-snapshot` gives `STILL EXISTS` twice. Every FAIL is re-derived below and each has
  its ruling.
- **QA 106's M7, M8 and M9 are VOID**, because R4-1 rewrote their anchor. M7-r4, M8-r4 and M9-r4 make the same edits
  on the new line and are red 13, 14 and 14.
- **The duplicated R4-2 test guards the same refusal on the same shape, but it is not the same test** (see IF-23).
  QA 106's N5 is red only through the copy in `-r2`.
- **Two lines of their own `mutants-r2` evidence do not reproduce, and the handoff flags neither.** Their N17 is 2/45
  and E1 exits 1 with 0 red; here N17 is 1/45 and E1 exits 0 (Disagreements, 2).

**Merge check:** `9473b0d` (T-185) merged into `78a7d13` in a scratch clone with `--no-commit --no-ff` shows no
conflict. `cli.ts` auto-merges, and the import section reads coherently: R4-1's `blocksCommit` and
`accepted_unreadable` lines sit beside T-185's flag handling. `tsc --noEmit -p .` exits 0 on the merged tree. The merge
was aborted, and the clone was clean afterwards.

**Full suite, once, at `78a7d13`, Defender-on temp:** 77 files, **1109 of 1109 passed**, no skip, `SUITE_EXIT=0`.
The win32 8.3 test passed. No failure appeared only in this control run.

**CI:** 6 of the 8 runs allowed, all on tcm:
- `36214934011` on `78a7d13` (`tcm-2`): success, 1108 passed and 1 skipped.
- `36214935429` on the redcheck (`tcm-1`): 12 failed, all `AssertionError`, all in `state-import-r4`.
- `36215197448` on D11 (`tcm-2`): 2 failed, the D11 rows.
- Three mutants: N5 = Q20 (`36215539599`) red 3; Q1 (`36215778575`) red 1; Q17 (`36215783935`) red 2.

## Rows IF-21 to IF-25

| Row | Result | Evidence (mine unless marked) |
|---|---|---|
| **IF-21** | **PASS** | **Probe** (`probes-r4.mjs`, through the built CLI, every shape written by PS 5.1 here). **The six shapes, stale and current, 12 of 12:** `could_not_tell/unreadable`; bare `--commit` exit 1; the **whole project identical** (sha256, size, full `mtimeMs`, the read-only bit of a read-only file under `.agents/notes/`); the refusal reads `1 input(s) cannot be read, so whether they are current cannot be told: .agents/TASKS/INBOX.md contains N NUL byte(s), the first at byte B …`, with N and B equal to the file's own (25 at 110, 25 at 113, 25 at 104, 1 at 109, 100 at 1, 100 at 0); `--accept-stale` exit 0, `state.json` written, `Imported UNREADABLE under --accept-stale: .agents/TASKS/INBOX.md`, and the read-only file still read-only. The `--draft` summary says `--commit will REFUSE while … cannot be read (NUL bytes)`. **At `063662b`, 0 of 12:** each bare `--commit` exits 0. **Red at `063662b`:** the redcheck `94704f4` fails the six shape rows on `expected +0 to be 1` on tcm (`36214935429`) and on NTFS (`evidence/redcheck-94704f4.out`). **Mutants:** R41-block 9, R41-reason 10, R41-refusal 8, M7-r4 13, M8-r4 14, M9-r4 14 (the developer's, byte-exact). |
| **IF-22** | **PASS** | The handoff's §2 table matches `78a7d13` line for line. The `could_not_tell` field is set at `:535` (`unreadable`), `:539` (`no_session_log`), `:544` (`no_declared_session`) and `:551` (`ahead_of_latest`), and `detectStaleness` produces no other could-not-tell verdict. `COULD_NOT_TELL` (`:457-462`) marks only `unreadable` `blocks: true`. `blocksCommit` (`:468-471`) is the one reader; the report (`:699-700`), `runCommit` (`:865`) and `cli.ts:481` all go through it. **Through the CLI** (`probes-r4`): no session log, no `Session N`, +13 and +1 are each could-not-tell with that reason, and a bare `--commit` exits 0 and writes `state.json`. **IF-10 re-checked:** `probes-r2` R2-2 gives +13 and +1 as could-not-tell with both numbers named and exit 0, equal as current, and −1 as STALE with exit 1. These lines are identical to QA 111's. **Mutant:** R41-scope, red 9. |
| **IF-23** | **PASS** | The `:875` refusal (the brief's `:833`; round 4 moved it) has two tests: `-r4` "UTF-16LE with no BOM: --commit refuses, names the NUL bytes…", and the copy in `-r2`. **QA 106's N5, byte-exact, is red 1/45**, and its one red test is the `-r2` copy. **QA 111's Q20, byte-exact, is red 3/83.** Q20's diff is N5's (`index 4a76862..c10ce64`, `=== "never"`). On tcm, `qa/importer-fixes-r4-mut-n5` (`5ddcce2`, N5's diff applied to `78a7d13`) is red 3 (`36215539599`: the `-r2` copy, the `-r4` test and O8). **The developer's claim about the duplicate:** `mutants-r2.mjs` does run a fixed list of five files, which excludes `-r4`, and N5 is red only through the copy. The copy guards the same refusal on the same shape (UTF-16LE with no BOM, `runDraft`, then `runCommit` throws, tree unchanged). **It is not the same test:** its fixture text differs (LF, "old status line"); its regex `/SUMMARY\.md .*NUL byte/` does not require "rewrites it in place"; and `-r2`'s `tree()` compares paths and bytes only, with no size, mtime or read-only bit. It is strong enough to kill N5. The stronger assertion lives in `-r4`. |
| **IF-24** | **PASS** | **QA 111's Q1, byte-exact, is red 1/83** ("Q1: a marker with another day's date refuses both doors"), and Q17 is red 1/83 ("Q17: a marker plus a state.json…"). On tcm, QA 111's own diffs applied to `78a7d13`: Q1 `8533bd0` is red 1 (`36215778575`), and Q17 `f605a4b` is red 2 (`36215783935`: the `-r4` Q17 test, plus `-r3`'s "rollback failing while removing SYSTEM/" sequence, on Linux only, as the handoff says). The developer's own Q1 and Q17 are red 1 and 1 here. |
| **IF-25** | **PASS** (as ruled) | IF-1 to IF-20 hold: see the next table. **QA 106's `probes-r2.mjs`: 24 passed, 1 failed. QA 111's `probes-r3.mjs`: 17 passed, 4 failed, all 21 checks run.** The five FAILs are each re-derived and named with their ruling in [Probes](#probes). None is outside R3-2 and R4-1. `probe-existing-snapshot.mjs`: `STILL EXISTS` twice. QA 106's `mutants-r2.mjs`: every non-VOID mutant is red, and E1 is equivalent. QA 111's `mutants-r3-qa.mjs`: Q6, Q15 and Q19 survive, as at `063662b` (the brief required neither Q6 nor Q15). |

## Rows IF-1 to IF-20, re-checked on the candidate

| Row | Result | Evidence |
|---|---|---|
| IF-1 | PASS | QA 102's `probes.mjs`, byte-exact (`a23d5d6`): **26 passed, 0 failed**. M1 (QA 106's set) is red 3/45. |
| IF-2 | PASS | The same run, on A2A-Hub `e0bc3f8` (a fresh `git archive` from my own clone): next-session STALE at 13 against `Session_14.md`, INBOX STALE at 11, and `--commit` refuses. |
| IF-3, IF-4 | PASS | The same run. M3, M4 and M5 are red 3, 1 and 1 of 45. |
| IF-5 | PASS | M1 3/45, M2 9/45, M3 3/45. `tsc` exits 0 on each. |
| IF-6 | PASS (not re-run) | `origin/loop/importer-fixes-redcheck` is still `e082983`. QA 111 re-ran it, and nothing it runs against has changed. |
| IF-7 | PASS | From `063662b` to `78a7d13`, `git diff --numstat -- open-brain/tests` is `12 0` (`-r2`) and `265 0` (`-r4`): insertions only, so no existing assertion changed. QA 102's `fidelity.mjs` (`71dfd82`) gives identical 7 of 7. M7 is VOID, and its successor M7-r4 is red 13/83. |
| IF-8 | PASS (the ruled-out part unrun) | Plain `open-brain sync` in a scratch clone at `78a7d13`, rebuilt: `25 passed, 0 fixed, 2 warnings, 1 issues, 2 skipped`, and the tree is clean afterwards. The issue is the known ENTITIES.md retirements finding. The warnings are `obsidian-vault` and `spec-provenance`, and the skips `gitnexus-index` and `ci-status`, as QA 111 listed. `build-freshness` passes at `78a7d13`, and `merge-markers` counts 496 files. |
| IF-9 | PASS as written | 16 of 17 shapes behave as QA 106 expects. The 17th (`utf16le-nobom`) is ruled (R3-2, R4-1), and it now refuses a bare `--commit`. |
| IF-10 | PASS | See IF-22. |
| IF-11 | PASS | `probes-r2.mjs` R2-3: PROBE-2 completes. With a read-only INBOX.md the tree is identical, read-only bit included, and a re-run completes once it is writable. `--force-snapshot` plus a render failure leaves the tree identical. A junction's target is untouched. The rollback-fails sequence shows "exist NOWHERE … none". |
| IF-12 | PASS | `probes-r2.mjs`: **60 of 60** matrix runs exit 1 and leave A, B and C unchanged. The edges are as QA 106 recorded, O1 included (`""` still commits the cwd's project, ruled out of scope). |
| IF-13 | PASS | QA 106's `mutants-r2.mjs`, byte-exact (`70e129d`): `tsc` exits 0 on every applied mutant. M1–M6, M10–M16, N1–N8, N10–N12, N15–N17, R1, R2 and R4 are red, and N5 is red 1/45. **M7, M8 and M9 are VOID** (R4-1's line), and their successors M7-r4, M8-r4 and M9-r4 are red. N9, N13, N13b, N14 and R3 are VOID as at QA 111. E1 is equivalent (0/45). |
| IF-14 | PASS (not re-run) | `origin/loop/importer-fixes-r2-redcheck` is still `c3e3297`, re-run by QA 111. |
| IF-15 | PASS | CI `36214934011` and the full suite at 1109/1109 (below). |
| IF-16 | PASS | `probes-r3.mjs`: both same-day-snapshot refusals leave the whole project identical, with mtimes and the read-only bit. `probe-existing-snapshot.mjs`: `STILL EXISTS; its Session_6.md survives`, twice. Q8 and Q16 are red 1 and 7 of 83. |
| IF-17 | PASS | R4-1 adds no remove. The `rmSync` calls in `runCommit` are round 3's, and the diff from `063662b` to `78a7d13` in `src/` adds none. The copy-fails rows of `probes-r3` are all identical. |
| IF-18 | PASS as written (D8 now closed) | `probes-r2`: the three Windows-1252 shapes are 3 STALE and refuse. `probes-r3`: the three `Add-Content` shapes are 3 STALE and refuse, and the `>>` shapes now refuse by R4-1. |
| IF-19 | PASS | `probes-r3.mjs`, all 21 checks run, including both way-out checks that `4b88f5d` skipped (the developer's E1). Re-runs refuse, and 0 originals are lost at steps 0–5. The way out, followed as parsed from the refusal, restores the tree identically, and `--force-snapshot` then completes with 8 of 8 originals in the new snapshot. |
| IF-20 | PASS (as ruled) | Superseded by IF-25. The four could-not-tell NUL rows are ruled. |

## Probes

### QA 106's and QA 111's scripts, byte-exact, against the candidate and `063662b`

Blobs were checked with `git hash-object`: `probes-r2.mjs` `bf970cc` and `probe-existing-snapshot.mjs` `e015912` (QA
106), and `probes-r3.mjs` `b3ecab0` (QA 111). They ran 03:25:06Z–03:28:02Z with nothing else running
(`evidence/probes-r*-*.out`).

| Script | `78a7d13` | `063662b` | What differs between the two |
|---|---|---|---|
| `probes-r2.mjs` | **24 passed, 1 failed** | 24 passed, 1 failed | No verdict. `IF-9 utf16le-nobom` is now bare `--commit` exit **1** with nothing written and `--accept-stale` exit 0 (stale), and the current project also exits 1. At `063662b` both exit 0 and write 16 entries. |
| `probes-r3.mjs` | **17 passed, 4 failed; 21 checks** | 17 passed, 4 failed; 21 | No verdict. The four NUL rows now exit **1** with no `state.json`, stale and current alike. At `063662b` they exit 0 and write `state.json`. |

**Each FAIL, re-derived from the output rather than taken from the handoff.** All five are one check: "the stale
inputs are all STALE, **and** bare `--commit` refuses". On the candidate each fails the first conjunct only (`0 stale /
3 could not tell`), and the second holds (exit 1, nothing written). At `063662b` the same five failed both conjuncts.

| FAIL row | Script | What fails at `78a7d13` | Ruling that changed the expectation |
|---|---|---|---|
| `IF-9 utf16le-nobom` | `probes-r2` | 0 STALE / 3 could not tell (`contains 93 NUL byte(s), the first at byte 1…`) | **R3-2** (round 3 brief `:45-46`: "Keep 'could not tell' only for text that really cannot be read (the NUL case, UTF-16 without a BOM)"; IF-18 at `:68`), kept by **R4-1** ("it stays the verdict. What changes is the verdict's CONSEQUENCE") |
| `R3-2 class: utf8 then PS 5.1 >>` | `probes-r3` | 0 / 3 (`25 NUL byte(s), the first at byte 103`) | **R3-2**'s NUL case, as **R4-1** ruled on QA 111's D8 (block, do not judge) |
| `R3-2 class: utf8-bom then PS 5.1 >>` | `probes-r3` | 0 / 3 (byte 106) | the same |
| `R3-2 class: cp1252 then PS 5.1 >>` | `probes-r3` | 0 / 3 (byte 104) | the same |
| `R3-2 class: UTF-8 with one stray NUL at the end` | `probes-r3` | 0 / 3 (`1 NUL byte(s), the first at byte 102`) | the same |

No FAIL is outside those two rulings. The developer's §5 account is reproduced exactly, including the change for the
current project on `utf16le-nobom`, which is R4-1 as written ("an input the importer cannot read BLOCKS").

### Mine: `probes-r4.mjs`, by class, against the candidate and `063662b`

The candidate gives **16 passed, 0 failed**: IF-21 12 of 12 and IF-22 4 of 4. `063662b` gives **0 passed, 16
failed**. Its 12 IF-21 checks fail on D8 itself (each bare `--commit` exits 0). Its 4 IF-22 checks fail only on the
missing reason field, and they commit in both builds. The evidence is `evidence/probes-r4-*.out`, from the second run
(see E1).

**The other shapes, stale project (Session 6 against a latest of 7).** Every file was written by PS 5.1 on this PC.
"Tasks" counts the entries in `state.json`. The source holds one task, and the two UTF-16LE-BOM rows append a second.

| Shape | First bytes | Candidate: verdict | Bare `--commit` | Tasks | `063662b` | Judged as it reads? |
|---|---|---|---|---|---|---|
| a UTF-8 BOM, then UTF-16LE (a BOM-only file, then `>>`) | `ef bb bf 23 00…` | could not tell / `unreadable` | exit 1, identical | – | exit 0 | yes |
| all NULs (64 bytes) | `00 00…` | could not tell / `unreadable` | exit 1, identical | – | exit 0 | yes |
| UTF-32BE (`-Encoding BigEndianUTF32`) | `00 00 fe ff` | could not tell / `unreadable` | exit 1, identical | – | exit 0 | yes |
| zero bytes, then `>>` | `ff fe 23 00` (PS writes a BOM onto an empty file) | STALE | exit 1, identical | – | the same | yes |
| UTF-16LE with a BOM (`>`), then `Add-Content` or `>>` | `ff fe 23 00` | STALE | exit 1, identical | – | the same | yes |
| **UTF-32LE (`Set-Content -Encoding UTF32`)** | `ff fe 00 00 23 00 00 00` | could not tell / `no_declared_session` | **exit 0, committed** | **0 of 1** | the same | **no: D11** |
| **UTF-7 (`Set-Content -Encoding UTF7`)** | `2b 41 43 4d 2d` (`+ACM-`) | could not tell / `no_declared_session` | **exit 0, committed** | **0 of 1** | the same | **no: D11** |
| zero bytes (`New-Item`) | – | could not tell / `no_declared_session` | exit 0, committed | 0 of 1 | the same | as ruled (O12) |

The current-project variants behave the same, except where the verdict turns current.

**Held open by another process** (a stale project, drafted first, then INBOX.md held by a PowerShell 5.1 process):

| Hold | What the importer read | Bare `--commit` |
|---|---|---|
| `Open`, `Read`, share `None` | the whole file; STALE | exit 1, identical. On this PC Node 22's `readFileSync` reads a file held with `FileShare.None`, while .NET's `ReadAllText` and Node's `copyFileSync` fail (EBUSY). See O13. |
| `Open`, `Write`, share `ReadWrite` (not truncated) | the whole file; STALE | exit 1, identical |
| `Truncate`, `Write`, share `Read` (an `Out-File` in progress) | **0 bytes: `no_declared_session`**, so it does not block | exit 1: `EPERM … rename …INBOX.md.tmp-… -> …INBOX.md. ROLLBACK FAILED (EBUSY … unlink …)`. R3-3's path follows: the marker is written, the snapshot holds all 9 originals (INBOX.md as the 0-byte file it read), and a re-run refuses with the way out. See O12. |

**R4-1's consequence under `--accept-stale`:** the three `>>` shapes and the stray NUL import the original task and
drop the appended line. UTF-16LE and UTF-16BE with no BOM import 0 tasks. INBOX.md is then re-rendered from
`state.json`, so what could not be read leaves the live tree; it is kept in the snapshot. The operator is told only
`Imported UNREADABLE …`. That is the ruling's "import it as it stands" (O15).

**A NOT-judged input with NUL bytes (D12):** in a current project, a DECISIONS.md holds `ADR-1` in UTF-8 and `ADR-2`
appended by `>>` (88 NULs, the first at byte 86). `--draft` lists it as "not judged: imported as a dated log…", and
the report says "Imported 1 ADRs". A bare `--commit` exits 0, and `state.json` has `["ADR-1"]`. The same happens at
`063662b`.

## Mutants

**The developer's `mutants-r4.cjs`, byte-exact** (blob `53f9419`, run from `open-brain/` in a worktree at `2005a3e`,
whose `open-brain/` is identical to `78a7d13`'s). Output is in `evidence/dev-mutants/`.
- **All 13 are red, with their local counts:** M7-r4 13, M8-r4 14, M9-r4 14, R41-block 9, R41-scope 9, R41-reason 10,
  R41-refusal 8, R42-Q20 3, and 1 each for Q1, Q17, O8, O10 and O10-order, of 83.
- **Each of my 13 `git diff`s is byte-identical to theirs** in `evidence/local-78a7d13/`. The source was restored and
  hashed after each (`cd7922a2cfdf`), and `git status` was clean at the end.
- `tsc` exits 0 on all 13.

**QA 111's `mutants-r3-qa.mjs`, byte-exact** (`50cabf3`). Its six-file glob now picks up `-r4`, so it runs 83 tests.
- **Red:** Q1 1, Q3 2, Q8 1, Q10 1, Q13 15, Q16 7, Q17 1, Q18 3, Q20 3.
- **Surviving:** Q6, Q15 and Q19, as at `063662b`. Q19 is equivalent at the CLI (QA 111). The brief made Q6 and Q15
  optional.
- The per-test lists match the developer's run of the same script (`qa111-mutants-78a7d13.console`) line for line.

**QA 106's `mutants-r2.mjs`, byte-exact** (`70e129d`): see IF-13. Output is in `evidence/mutants-r2-asis.console`,
with the diffs beside it. It matches the developer's run except N17 and E1 (Disagreements, 2).

The mutant chain ran from 03:30:57Z to 03:48:58Z. My one local D11 test run (03:33:36Z–03:33:41Z) overlapped it
(near-miss, below).

## Full suite and CI

**The full suite, once, at `78a7d13`** (`evidence/full-suite-78a7d13.out`, `.meta`):
- **How:** run from `open-brain` in my candidate worktree, clean at `78a7d13` (`git status --porcelain` empty), from
  03:53:29Z to 03:55:51Z, as `TEMP="$QA_DEFAULT_TEMP" TMP="$QA_DEFAULT_TEMP" npx vitest run > file 2>&1;
  SUITE_EXIT=$?`. That gave **`SUITE_EXIT=0`**.
- **Temps:** `C:\Users\AARONM~1\AppData\Local\Temp` (the 8.3 path, not Defender-excluded). Every other run used
  `C:\qa-tmp`.
- **Result:** Test Files **77 passed (77)**, Tests **1109 passed (1109)**, with no skip, in 139.41 s.
  - The importer files are 9, 18, 16, 22, 8, 8 and 2.
  - **The 8.3 test passed.** `onTaskUpdate`/`Unhandled`: 0.
  - **No failure in the control run**, so there is no temp-only failure to report. This is CI's 1108 + 1 skipped, with
    the skip run.
- **Processes before and after** (`evidence/processes-before-suite.txt`, `-after-suite.txt`, from QA 106's `procs.ps1`
  byte-exact): CPU load was 2% at 03:53:27Z and 1% at 03:55:51Z. The only processes were this run's `claude.exe`
  10152, the driver 5692, `MsMpEng.exe` and the listing itself. **QA 99's log tail, PID 3884 (O5), is gone.**

**CI: 6 runs of the 8 allowed.** Each branch was created by me and pushed with `push-qa.mjs`, and each push was read
back. Each run was dispatched as `gh workflow run ci.yml --ref <branch> -f hosted=false`.

| Run | Branch, SHA (from the log's fetch) | Runner (from the log) | Result |
|---|---|---|---|
| `36214934011` | `qa/importer-fixes-r4-ci`, `78a7d131a2b4…` | `tcm-2`, machine `tcm`. 9 `blocked:`, `denied: /opt/doorctl`. The checkout first reset another seat's `b32d3b8` | **success**: 77/77 files, **1108 passed, 1 skipped (1109)**. The importer files are 9, 16, 22, 18, 8, 8 and 2, all ✓. This agrees with the developer's `36212603856`. |
| `36214935429` | `qa/importer-fixes-r4-redcheck`, `94704f45…` | `tcm-1`, egress checks the same | failure, as intended: **12 failed** / 1096 passed / 1 skipped. All 12 are in `state-import-r4`, and all are `AssertionError`: the six shapes on `expected +0 to be 1`; in-process, IF-22 `unreadable` blocks, O8 and O10 on `to throw`; the reason key on `expected undefined to be 'unreadable'`; the draft on `to contain '--commit will REFUSE whi…'`. The six other importer files are ✓. This is the developer's `36212605596`, test for test. |
| `36215197448` | `qa/importer-fixes-r4-d11`, `aff7135b…` | `tcm-2` | failure, as intended (D11): **2 failed** / 1110 passed / 1 skipped (1113), both D11 rows on `expected [Function] to throw an error`. The UTF-32BE guard and the fixture check pass. |
| `36215539599` | `qa/importer-fixes-r4-mut-n5`, `5ddcce25…` (N5's diff = Q20's) | `tcm-1`; the checkout first reset another seat's `473cc85` | red as required: **3 failed** (`-r2` copy, `-r4` refusal, O8). |
| `36215778575` | `qa/importer-fixes-r4-mut-q1`, `8533bd0d…` | `tcm-2`; reset `ce05011` first | red: **1 failed** (Q1). |
| `36215783935` | `qa/importer-fixes-r4-mut-q17`, `f605a4b4…` | `tcm-1` | red: **2 failed** (Q17, and `-r3`'s removing-SYSTEM/ sequence on Linux: `…matching /half-restored/ but got '.agents/state.json already exists…'`). |

The same redcheck on this PC (`evidence/redcheck-94704f4.out`) is also 12 failed of 83. All 12 are in `-r4` and all
are `AssertionError`; the six other importer files pass. Another seat (T-185 round 2's mutants) was using tcm at the
same time. Every log shows the checkout resetting that seat's commit and then fetching mine. The logs, with ANSI codes
stripped, are `evidence/ci-*.txt`.

## What could not be verified

- **GitNexus `impact` / `detect_changes`:** `gitnexus` is not available here, by the dispatch.
- **The developer's transcript** (its 286 records at *high*) is not on this PC. F1 rests on the handoff's word.
- **IF-6 and IF-14's redchecks** were not re-run. The branches are unchanged (`e082983`, `c3e3297`), and QA 111 re-ran
  both.
- **A read that fails:** with Node 22 on this PC, no share mode I tried made `readFileSync` fail (O13). So an
  unreadable input the READ refuses was not tested, only files whose bytes cannot be decoded.
- **A real adopting project** written with `>>`, UTF-32 or UTF-7: the shapes were made here with PS 5.1. A2A-Hub's
  inputs are UTF-8.
- **O9** (the marker's other doors): not tested, as at QA 111.

## Defects

QA 102 numbered D1–D4, QA 106 D5–D7 and QA 111 D8–D10. **D8, D9 and D10's Q1 and Q17 are closed at `78a7d13`**, by
the rows above. D10's Q6 and Q15 remain as QA 111 left them (the brief did not require them). The numbering continues
here.

| # | Severity | New? | Defect | Evidence | Suggested fix |
|---|---|---|---|---|---|
| **D11** | **low–medium**: the consequence is D8's (a STALE project commits without `--accept-stale`), but the shapes need an explicit `-Encoding` | new to QA; **present at `063662b`**, and since round 2's one decoder (`a1269b2`, R2-1), which added the BOM tests | A judged input in **UTF-32LE** (`Set-Content -Encoding UTF32`, BOM `FF FE 00 00`) or **UTF-7** (`-Encoding UTF7`) is read without error and filed `no_declared_session`, which does not block. UTF-32LE matches `decodeText`'s UTF-16LE test (`index.ts:124`), and the UTF-16 paths never look for NULs, so the text is `#\0 \0I\0…`. UTF-7 holds no NUL; its `>` and `*` are `+AD4-` and `+ACoAKg-`, so no status line is found. A STALE INBOX.md then commits on a bare `--commit`, `state.json` gets 0 of its tasks, and the live INBOX.md is re-rendered empty (the original is in the snapshot). The `--draft` summary does show `1 could not tell` and `Tasks: 0`. | `probes-r4` "other shapes" table; `qa/importer-fixes-r4-d11` `aff7135` (`state-import-qa122.test.ts`), red 2 on tcm (`36215197448`) and on NTFS | Test `FF FE 00 00` before `FF FE` and file UTF-32 as unreadable, or decode it. Put the NUL check on the BOM paths too, so a BOM that lies becomes `unreadable` rather than a judged text. For UTF-7 (or any encoding nobody named), consider filing a judged input with no readable `# ` title as `unreadable` rather than `no_declared_session`. Add the two shapes as byte tests. |
| **D12** | low–medium (silent; not a way past the STALE block) | new to QA; present at `063662b` | A **not-judged** input with NUL bytes is imported as far as it can be read, with no mention. A DECISIONS.md with an ADR appended by PS 5.1's `>>` commits on a bare `--commit` with that ADR missing from `decisions[]`. `readInputs` records `undecodable` for DECISIONS.md (`:571`), and nothing reads it: `detectStaleness` skips inputs that are not judged (`:533`). | `probes-r4` DECISIONS.md section | This depends on the planner's reading of R4-1's scope ("Open", 2). At least name the file, its NUL count and the ADRs imported in the report and the `--commit` output. Or let R4-1's block cover it, since `--commit` imports it. |

**Finding about the dispatch, not the build:**
- **F1 (the dispatch's effort).** The dispatch that launched the developer said *medium*. The developer's transcript,
  by the handoff's count, says *high* on 286 of 286. D-047 makes the transcript the source. So the record for
  session 116 is *high*, and the dispatch misstated it, or the launch did not do what the dispatch said. I could not
  recount it here.
- **F2 (a figure in this dispatch).** It gives `4b88f5d`'s `cli.ts` as "+3/−1". The commit's own `git show --numstat`
  is `4 1`, and the handoff's "5 (+4 −1)" is right.

**Observations, not scored:**
- **O12 (a zero-byte judged input).** It is filed `no_declared_session`, as IF-22's list says, and does not block. The
  realistic case is an INBOX.md being rewritten (`Out-File` truncates, then writes). Here that took a stale project
  into `--commit`, which failed at the render (`EPERM`, the writer holds the file) and then at the rollback (`EBUSY`).
  R3-3's recovery worked: the marker, the kept snapshot, and a re-run that refuses with the way out. But the snapshot
  holds the 0-byte INBOX.md, not what the writer was writing. With a writer that shares delete, the commit would
  succeed with 0 tasks. The ruling covers this. A one-line change would make a 0-byte judged input `unreadable`.
- **O13 (holding a file does not stop Node reading it).** With Node 22 on this PC, `readFileSync` reads a file that
  PowerShell 5.1 holds with `FileShare.None`, while .NET's `ReadAllText` and Node's `copyFileSync` fail with EBUSY. So
  a hold cannot make the importer's read fail; it fails later, at the snapshot copy (QA 111's R3-1 probes) or at a
  rename.
- **O14 (`blocksCommit` fails open).** A could-not-tell verdict with no reason does not block (`:470`), and the field
  is optional (`:465`). Every producer sets it today, and R41-reason and R41-scope would catch a regression by test. A
  type that required the reason on could-not-tell would make the compiler hold the list.
- **O15 (`--accept-stale` on an unreadable INBOX).** It imports what parses and re-renders INBOX.md from it: 0 tasks
  for UTF-16 with no BOM, and the `>>` line dropped from the append shapes. The CLI says `Imported UNREADABLE …: <file>`
  and not how much was lost. The originals are in the snapshot.
- **O5 (closed here).** QA 99's `Get-Content -Wait` (PID 3884) is not in either process list.

## Disagreements, returned rather than scored

1. **The duplicate R4-2 test** is "the same refusal test" in what it guards, not in what it asserts (IF-23). This
   affects no score: N5 is red either way.
2. **The developer's `qa106-mutants-r2-78a7d13.console`** shows two results that do not reproduce here, and the
   handoff flags neither:
   - **N17 red 2/45.** Their extra red is `state-import-atomic` "failing while rendering next-session.md…", in code
     N17 does not touch (N17 edits the CLI's missing-directory refusal). Here N17 is 1/45.
   - **E1 with `vitest exit 1` and 0 red.** Here it is `vitest exit 0`.

   Both look like the Windows rename EPERM of their §4. The handoff reports one such flake (R41-reason at `4b88f5d`),
   not these two.

## Error entries and near-misses (mine)

- **E1: a probe fixture in the wrong format.** The first run of `probes-r4.mjs` wrote DECISIONS.md with `## D-001`
  headings. `importDecisions` reads `### ADR-N:` (`:317`), so even the UTF-8 decision was not imported, and that
  section's result was void. I fixed the fixture, added a task count, and re-ran both builds. The evidence is from the
  re-run, and its other results match the first run's.
- **Near-miss: runs that overlapped.** My one local run of the D11 test (03:33:36Z–03:33:41Z, 4 tests, about 5 s)
  overlapped the mutant chain (03:30:57Z–03:48:58Z), during QA 106's M3–M4. Those two match the developer's counts (3
  and 1). Nothing else overlapped: the probes, the mutants, the second chain (03:48Z–03:53Z) and the suite each ran
  alone.
- **One harmless command error:** a `mklink /J` through Git Bash failed on argument handling ("Invalid switch"). I made
  the junction with PowerShell's `New-Item -ItemType Junction` instead. Nothing ran against the failed attempt.
- **A junction:** `C:\qa-scratch\qa122\qatest\open-brain\node_modules` points to the candidate worktree's
  `node_modules`, so the D11 test ran without a second `npm ci`. It is ignored by git and left in place.
- **Git identity:** there is none on this PC. Each commit passes `-c user.name=… -c user.email=…` for that command
  only. No config was written.
- **Left behind on purpose, for reproduction:**
  - worktrees under `C:\qa-scratch\qa122`: `cand` (`78a7d13`), `base` (`063662b`), `red` (`94704f4`), `dev`
    (`2005a3e`), `qatest` (`qa/importer-fixes-r4-d11`), `mut` (`qa/importer-fixes-r4-mut-q17`) and `report`, all
    clean;
  - the clones `merge` (at `78a7d13`, clean, rebuilt) and `a2a-hub` (no checkout), and every probe directory;
  - the local branches `qa/importer-fixes-r4-*`.

  `git worktree remove` clears the worktrees. The shared tree's HEAD was never moved.

## Reproduction

```sh
# S = docs/loops/qa-scripts-importer-r4 ; Q6 = QA 106's scripts, Q11 = QA 111's, Q2 = QA 102's, D = the developer's
# mutants-r4.cjs, each extracted with git cat-file and checked with git hash-object. W = C:/qa-scratch/qa122
for p in "cand 78a7d13" "base 063662b" "red 94704f4" "dev 2005a3e"; do set -- $p
  git worktree add --detach $W/$1 $2 && (cd $W/$1/open-brain && npm ci && npm run build); done
node $Q6/probes-r2.mjs $W/cand $W/pr2-cand ; node $Q6/probes-r2.mjs $W/base $W/pr2-base      # 24/1 ; 24/1
node $Q6/probe-existing-snapshot.mjs $W/cand $W/snap-cand                                    # STILL EXISTS x2
node $Q11/probes-r3.mjs $W/cand $W/pr3-cand ; node $Q11/probes-r3.mjs $W/base $W/pr3-base    # 17/4 ; 17/4
node $S/probes-r4.mjs $W/cand $W/pr4-cand ; node $S/probes-r4.mjs $W/base $W/pr4-base        # 16/0 ; 0/16
node $Q2/probes.mjs $W/cand $W/a2a-hub $W/p102-cand ; node $Q2/fidelity.mjs $W/cand $W/a2a-hub  # 26/0 ; 7 of 7
node $Q6/mutants-r2.mjs $W/dev $W/ev/mutants-r2-asis                                         # N5 1/45; M7-9 VOID
(cd $W/dev/open-brain && node $Q11/mutants-r3-qa.mjs $W/ev/qa111-mutants)                    # Q1 1, Q17 1, Q20 3
(cd $W/dev/open-brain && node $D $W/ev/dev-mutants)                                          # 13 of 13 red
(cd $W/red/open-brain && npx vitest run tests/pipelines/state-import)                       # 12 failed of 83
# Merge: git clone <repo> merge && cd merge && git checkout --detach 78a7d13 && git merge --no-commit --no-ff 9473b0d
#        (cd open-brain && npm ci && npx tsc --noEmit -p .) ; git merge --abort               # no conflict; tsc 0
# Suite: (cd $W/cand/open-brain && TEMP="$QA_DEFAULT_TEMP" TMP="$QA_DEFAULT_TEMP" npx vitest run > f 2>&1; SUITE_EXIT=$?)
# CI:    git branch qa/importer-fixes-r4-ci 78a7d13 && node docs/loops/qa-122/push-qa.mjs qa/importer-fixes-r4-ci
#        gh workflow run ci.yml --ref qa/importer-fixes-r4-ci -f hosted=false
```

## Open for the planner

None of these blocks this report. Each has my recommendation.

1. **D11: UTF-32LE and UTF-7.** *Recommendation: a small fix before T-181 adopts a Windows project, but not a merge
   blocker on its own.*
   - Testing `FF FE 00 00` before `FF FE`, and a NUL check on the BOM paths, close UTF-32 and any BOM that lies. That
     is two lines and two byte tests, in the class R4-1 already rules (unreadable blocks).
   - UTF-7 is obsolete and needs `-Encoding UTF7`. Filing a judged input with no readable `# ` title as `unreadable`
     would close it, and any encoding nobody has named, without a decoder.
   - If the planner would rather not, R4-1 still closes the shapes an operator reaches without asking for an encoding
     (`>`, `>>`, `Set-Content`, `Add-Content`, `Out-File`).
2. **R4-1's scope, and D12.** *Recommendation: say it explicitly.* The code reads R4-1 as "a JUDGED input that cannot
   be read", as the brief's body does. Its headline ("an input the importer cannot read BLOCKS") also covers
   DECISIONS.md, which `--commit` imports. I would not block on DECISIONS.md, which is a log, but I would name its NUL
   bytes, and what was and was not imported, in the report and the `--commit` output.
3. **Merge?** *Recommendation: round 4 is sound on its own terms.* Every row passes, D8, D9 and D10's Q1/Q17 are
   closed by class and by mutant, the merge with T-185 is clean, and CI and the full suite are green. D11 and D12 are
   older than round 4, and neither is a regression. Whether they go in a round 5 or a task is the planner's call.
4. **O7 (two markers: which snapshot to name).** *My view: the OLDEST, and fix only the grammar.* Every door refuses
   while any marker exists, whatever its date (R3-3 plus Q1). So the importer cannot create a second marker unless
   the first is gone. Two markers therefore mean an operator deleted one without restoring from it, or put one back by
   hand, or two runs raced across midnight.
   - In the first case the older snapshot holds the originals from before any import, and the newer one holds what a
     later run found, which may already be damaged.
   - QA 111 said "the newest". I think that is wrong for the one realistic sequence, and the developer's hesitation
     was right.
   - I suggest: "Restore .agents/ by hand from A/ (the oldest; it holds the originals from before the first failed
     --commit); B/ holds the tree as a later run found it."
   - It is rare enough that a message change, not a test, is proportionate.
5. **F1.** *Recommendation:* record session 116 as *high*, from the transcript. Check how the launch's effort is set,
   so that a dispatch's stated effort is what the seat runs at.
6. **O12 (zero bytes).** *Recommendation:* no change in this loop unless D11's "no readable title" rule is taken,
   which would cover it too.

**Branch:** this report and `docs/loops/qa-scripts-importer-r4/` are committed on `qa/importer-fixes-r4-report`, based
on `7729943`, and pushed with `push-qa.mjs`. The driver records the read-back.
- I committed them from a separate worktree (`C:\qa-scratch\qa122\report`), so the shared tree's HEAD did not move.
  The report is copied, untracked, into `C:\Users\Aaron Melven\Worktrees\sia-qa\docs\loops\`, where the run's check
  looks, as the earlier QA seats' reports are. HEAD there is still `7729943`.
- This seat's other pushes: `qa/importer-fixes-r4-ci` (`78a7d13`), `-redcheck` (`94704f4`), `-d11` (`aff7135`),
  `-mut-n5` (`5ddcce2`), `-mut-q1` (`8533bd0`) and `-mut-q17` (`f605a4b`).

QA-122: REPORT COMPLETE
