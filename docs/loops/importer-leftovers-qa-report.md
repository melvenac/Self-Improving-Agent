# Importer leftovers (R4-4, R4-5, O7, O14) on T-179 round 2: QA report, record session 138

**By:** the QA seat, record session **138**, 2026-09-26/27 (UTC), headless, dispatched by
`docs/loops/importer-leftovers-dispatch-qa.md` (Atlas, record 109). **Candidate:** `d500730` on
`origin/loop/importer-leftovers-r2` (handoff `cba0e14`). **Scored against:** `docs/loops/importer-r4-leftovers-brief.md`
and `docs/loops/importer-fixes-r4-rulings-qa122.md`. **Predecessor:** QA 122 (`origin/qa/importer-fixes-r4-report`
`36c29d5`). **Comparison base:** `1646567`, T-179 round 2's candidate, i.e. the merge without the leftovers.

**Machine:** `DESKTOP-0GV3HAD`, Windows 10 Pro 19045, Node **v22.23.2**, Windows PowerShell **5.1.19041.6456**.
**This process ran ELEVATED** (High Mandatory Level, local admin, NETWORK logon: the WMI launch), with
**`SeBackupPrivilege` ENABLED**. That turned out to matter for check 5. TEMP for probes and mutants: `C:\qa-tmp`
(Defender-excluded); the one full-suite control run used the default TEMP `C:\Users\Aaron\AppData\Local\Temp`.
**Model and effort, from this session's transcript** (`~/.claude/projects/C--Users-Aaron-Worktrees-sia-qa/649d1f3a-6412-4064-bdcc-109fa7ec34da.jsonl`):
`"model":"claude-opus-5-5"` and `"effort":"high"`, 193 of 193 records each, no other value.

**Not used**, as dispatched: `/start`, the MCP server, `gitnexus`, `/end`. No real project was touched, and no live
`state.json` was written. Scratch: `C:\qa-scratch\il138\` (worktrees `cand` and `mut` at `d500730`, `base` at `1646567`,
`qat` on `qa/importer-leftovers-tests`, `report` on this branch).

## Verdict

**The leftovers do what R4-4, R4-5, O7 and O14 rule, on the merged tree. PASS, with three defects. None is a way past
the STALE block, none is a regression of the rulings, and none should hold the merge.**

- **R4-4: PASS on every shape the ruling names, for all three judged inputs** (not only INBOX.md, which is all that the
  candidate's tests and QA 122's probes cover). Each shape was written by Windows PowerShell 5.1 itself: UTF-32LE,
  UTF-32BE, UTF-7, zero bytes (`New-Item` and `Clear-Content`), a UTF-8 BOM then UTF-16, and a UTF-16LE BOM that
  lies. Each one is `could_not_tell/unreadable`, and a bare `--commit` refuses with the tree identical. On the round-2
  base (`1646567`), 18 of those 24 rows commit on a bare `--commit`. **IF-10's +13 and +1 still commit** (bare `--commit` exit 0).
- **R4-5: PASS.** The report, `--draft`'s stdout and `--commit`'s stdout each name the NUL count, the first byte, the
  ADRs imported and those NOT imported, for four PS 5.1 shapes. A readable DECISIONS.md is named nowhere.
- **O7: PASS.** With 2 and 3 markers created out of date order, the refusal names the oldest first, and the grammar
  reads right. The one-marker text is byte-identical to the base. **O14: PASS.** The union holds: no cast gets around
  it, and my widening mutant is a compile error.
- **Check 5, the EBUSY read: the importer REFUSES, it never crashes.** I found why the two machines disagreed. It is
  not the machine but the process token: **with `SeBackupPrivilege` enabled, Node's `readFileSync` reads straight
  through a `FileShare.None` hold; with it disabled, the same read gets EBUSY.** With the privilege disabled, I
  reproduced Forge's probes-r4 crash here exactly. I then held each of the importer's five input files, and in all 20
  runs the importer refused with exit 1 and wrote nothing.
- **Probes:** probes-r3 is 17/4 with the same FAIL ids. **probes-r4, byte-exact, does NOT crash here: 16/0**,
  because this run is privileged. With the recorded hold diff it is also 16/0, identical to Forge's row for row.
- **Mutants:** 13 of my own. **3 survived the candidate's tests** (the no-title rule limited to INBOX.md, the BOM
  path's NUL offset, the "it is empty" wording). All three are killed by my green tests on `qa/importer-leftovers-tests`.

**The defects** (details under Defects):
- **D1** (low): a UTF-16BE mark over an odd number of bytes throws a `RangeError` rather than filing the input
  `unreadable`. It fails closed, but the message names no file, and it also blocks a not-judged DECISIONS.md. This is
  older than the leftovers.
- **D2** (low–medium, and a ruling question): the no-title rule blocks VALID UTF-8 judged inputs that have no `# `
  line, and its evidence blames their encoding. No real file of that shape was found. But `/end`'s A7 never asks for a
  title, and the importer's own handoff parser reads `##` sections.
- **D3** (low): a UTF-16LE file with a UTF-8 tail (a Git Bash `>>`) passes as current, and the tail is dropped on a
  bare `--commit`. This is older than the leftovers.

## 1. R4-4: the shapes, written by PS 5.1 itself

Script: `qa-scripts-importer-leftovers/shapes-qa138.mjs`. For each shape and each judged input there is a STALE
project (the target declares Session 6, the latest log is 7) and a CURRENT one (it declares Session 7). The verdict
comes in process from the built module; the bare `--commit` goes through the built CLI, with a whole-tree hash before
and after. Evidence: `evidence/shapes-qa138-d500730.out` (candidate) and `…-1646567.out` (base).
**Candidate: 30 passed, 2 failed, of 32 checks. Base: 11 passed, 21 failed.**

| Shape (PS 5.1 wrote it) | INBOX / task / next, candidate | Base `1646567` |
|---|---|---|
| UTF-32LE (`Set-Content -Encoding UTF32`) | unreadable, exit 1, identical ×3 | `no_declared_session`, **exit 0** ×3 |
| UTF-32BE (`-Encoding BigEndianUTF32`) | unreadable, exit 1 ×3 | unreadable ×3 (NUL path, as before) |
| UTF-7 (`-Encoding UTF7`) | unreadable, exit 1 ×3 | **exit 0** ×3 |
| zero bytes (`New-Item`), and `Set-Content` then `Clear-Content` | unreadable (`it is empty`), exit 1 ×6 | **exit 0** ×6 |
| a UTF-8 BOM (`'' \| Out-File -Encoding utf8`), then `>>` (UTF-16) | unreadable (NUL), exit 1 ×3 | unreadable ×3 |
| **a BOM that lies:** `FF FE` (.NET), then the whole text in UTF-8 | unreadable (no readable `# ` title), exit 1 ×3 | **exit 0** ×3 |
| a BOM that lies: `FF FE` (.NET), then `Add-Content -Encoding UTF32` | unreadable (BOM-path NUL), exit 1 ×3 | **exit 0** ×3 |
| **a BOM that lies: `FE FF` (.NET), then the whole text in UTF-8** | **INBOX, task: THREW** `RangeError`, CLI exit 1 (**D1**); next: unreadable (even length) | THREW / exit 0 |
| IF-10 +13 and +1 (INBOX declares 20 and 8) | `ahead_of_latest`, **bare `--commit` exit 0**, state.json written | the same |

**Rows that are NOT lies, although I first expected them to be** (see E2). PS 5.1's `Add-Content` follows the file's
existing BOM and ignores `-Encoding`. So `FF FE` or `FE FF` followed by `Add-Content -Encoding UTF8`, and a UTF-8 BOM
followed by `Add-Content -Encoding Unicode`, produce genuine UTF-16 or UTF-8 files, and each is judged stale or
current as it reads, in both builds. **A lying BOM therefore needs a non-cmdlet writer** (.NET, Git Bash, an editor).
All nine of these rows are kept as NOTE rows.

QA 122's own probes-r4 "other shapes" (INBOX only), rerun here: the UTF-8 BOM then UTF-16LE, all NULs, zero bytes,
UTF-32LE, UTF-32BE and UTF-7 are each unreadable, and a bare `--commit` exits 1. Zero bytes then `>>`, and UTF-16LE
with a BOM then `Add-Content` or `>>`, are judged stale or current. This matches Forge 131's §6 line for line.

## 2. The no-title rule's reach

**What the rule is:** `detectStaleness` files a judged input `unreadable` when **no line anywhere** starts with `# `
(`index.ts:598`), not when the first heading is something else. So the three shapes the dispatch names are **not**
blocked:

| Shape (valid UTF-8, written by PS 5.1) | Candidate | Base |
|---|---|---|
| INBOX.md: YAML front matter, then `# Inbox` | judged: stale exit 1 / current exit 0 (PASS) | the same |
| INBOX.md: an HTML comment, then `# Inbox` | judged (PASS) | the same |
| INBOX.md: two blank lines, then `# Inbox` | judged (PASS) | the same |

**What it does block: a readable file with no line starting `# `.** Each is `unreadable` with the evidence
*"has no readable `# ` title (its encoding is not one the importer reads, UTF-7 among them)"*, which is false for
every row below: each was read correctly as UTF-8.

| Shape (valid UTF-8) | Candidate, stale / current | Base, stale / current |
|---|---|---|
| **next-session.md with `## Pick up here (Session N)` and `## Watch out for`, no `# ` line** | **unreadable, exit 1 / exit 1** | **stale exit 1 / current exit 0, `pick_up` imported** |
| next-session.md with /end A7's three parts as bold lines | unreadable ×2 | `no_declared_session`, exit 0 ×2 |
| INBOX.md with `##` headings only | unreadable ×2 | `no_declared_session`, exit 0 ×2 |
| INBOX.md `#Inbox` (no space), `#<TAB>Inbox`, `  # Inbox` (indented), setext `Inbox` / `=====` | unreadable ×8 | `no_declared_session`, exit 0 ×8 |
| INBOX.md whose text begins with U+FEFF before `# ` (a double BOM; .NET) | unreadable ×2 | `no_declared_session`, exit 0 ×2 |

**Did I find a real file of that shape? No.**
- **This PC:** 21 judged inputs under `C:\Users\Aaron` and the scratch tree (`evidence/reach-home.out`), including
  SIA's three live views (these start with a `<!-- generated … -->` line, then carry a `# ` title), the test fixtures
  and `project-template/`. Every one has a `# ` line. co-op-mailer is not on this PC.
- **The repo's whole history:** 414 distinct blobs ever committed at `TASKS/INBOX.md`, `TASKS/task.md` or
  `SESSIONS/next-session.md`, in any directory, on any ref (`evidence/reach-history.out`). Every one has a `# ` line.

**But the shape is one the framework invites.** Every version of `/end`'s A7 ("Write next-session handoff") asks
only for **Pick up here / Watch out for / Open questions**, with no title. `project-template/` ships no
`next-session.md`. And the importer's own `importHandoff` reads `##` sections (`index.ts:451`). An adopting agent that
wrote A7 as three `##` sections, which the importer can parse in full, now gets that file refused and is told to fix
its encoding. That is D2.

## 3. R4-5: DECISIONS.md, not judged, is named and does not block

Script: `r45-qa138.mjs`, current project, every DECISIONS.md written by PS 5.1. Evidence: `evidence/r45-qa138-d500730.out`.

| DECISIONS.md | NUL / first | Report, `--draft` stdout, `--commit` stdout | Bare `--commit` | state.json |
|---|---|---|---|---|
| UTF-8 ADR-1, then ADR-2 and ADR-3 appended by `>>` | 132 / 80 | all three: `132 NUL byte(s), the first at byte 80`; `ADRs imported: ADR-1`; `NOT imported …: ADR-2, ADR-3` | exit 0 | `["ADR-1"]` |
| UTF-16LE with no BOM, the whole file | 143 / 1 | all three: named; `imported: none`; `NOT imported: ADR-1, ADR-2` | exit 0 | `[]` |
| UTF-32LE (`Set-Content -Encoding UTF32`) | 245 / 2 | all three: `starts with a UTF-32LE byte-order mark`; `NOT imported: ADR-1` | exit 0 | `[]` |
| UTF-8, one stray NUL at the end | 1 / 79 | all three: named; `imported: ADR-1`; `NOT imported: none found` | exit 0 | `["ADR-1"]` |
| readable UTF-8 (control) | 0 | **nothing named** anywhere | exit 0 | `["ADR-1"]` |

No NUL reaches state.json in any row. QA 122's own DECISIONS.md shape (probes-r4: 263 bytes, 88 NULs, first at 86)
commits with `["ADR-1"]`, as Forge reports. **One exception to "does not block"** is D1: an odd-length `FE FF`
DECISIONS.md throws in the decoder, so the draft is refused.

## 4. O7 and O14

**O7** (`o7-qa138.mjs`, `evidence/o7-qa138.out`). The markers were created in the order 09-09 then 01-01, and 06-06,
01-01, 03-03. The refusal, from `--commit` and `--draft` alike, reads *"Restore .agents/ by hand from
…2026-01-01/ (the oldest; it holds the originals from before the first failed --commit); …2026-09-09/ holds the tree
as a later run found it"*. With three markers it reads *"…03-03/ and …06-06/ hold the tree…"*. With one marker the
text is **byte-identical** to `1646567`'s. probes-r3's IF-19 rows, which parse the one-marker sentence, pass.
Mutant Q11 (the newest named first) is killed.

**O14.** `InputStaleness` is a two-arm union with the reason required on `could_not_tell`. There is no `as` cast in
`state-import/` (`grep`). The verdicts are recomputed from disk at `--commit`, never deserialised. Mutant Q10 (a third
arm with no reason) is a compile error, `TS7053` at `blocksCommit`. Forge's M15 and M16 cover the other two ways.

## 5. Forge 131's EBUSY finding, and the importer's own EBUSY read

**Reproduced, and explained.** A PowerShell 5.1 process holds `INBOX.md` with `[IO.File]::Open(p,'Open','Read','None')`
(`hold.ps1`, `share-none-privilege.out`):

| Reader, same hold | Result |
|---|---|
| Node 22.23.2 `readFileSync`, this process (elevated, `SeBackupPrivilege` **Enabled**) | **OK, 20 bytes**: QA 122's O13 |
| Node `readFileSync` in a child whose `SeBackupPrivilege` I **disabled** (`AdjustTokenPrivileges`) | **EBUSY**: Forge 131's finding |
| Node `readFileSync` in a child with `SeRestorePrivilege` disabled instead (control) | OK |
| Node `copyFileSync`; .NET `File.ReadAllText` (elevated) | EBUSY; "being used by another process" |

**So the two seats did not disagree about Node or about the machine. The difference is the reader's token.** This
headless run and, I infer, QA 122's were launched elevated with the privilege enabled, while Forge's interactive
session was not. That the privilege works through libuv opening with `FILE_FLAG_BACKUP_SEMANTICS` is my reading, and
I did not verify it in libuv's source; the privilege toggle itself is measured. **With the privilege disabled, QA
122's unmodified probes-r4 crashes here exactly as it did for Forge:** 12 PASS, then `EBUSY … open …held-held-None-Open\.agents\TASKS\INBOX.md`
at `probes-r4.mjs:45`, from `tree()`. The PASS/NOTE rows are identical to Forge's
(`evidence/probes-r4-d500730-noBackupPrivilege.out`).

**The importer's own read under EBUSY is untested by the suite, so I tested it** (`ebusy-importer.mjs`,
`evidence/ebusy-importer-d500730.out`). I held each file with share `None`, ran the built CLI in a child with
`SeBackupPrivilege` disabled and again with it left enabled, and hashed the whole tree before and after:

| Held | Privilege disabled: `--draft` / `--commit` | Privilege enabled: `--draft` / `--commit` |
|---|---|---|
| `TASKS/INBOX.md` | exit 1 `EBUSY … open …INBOX.md` / the same; tree identical | exit 0 (read through) / exit 1 `EBUSY … copyfile` at the snapshot; identical, no archive |
| `SESSIONS/Session_7.md` (the latest log) | exit 1 EBUSY / exit 1; identical | exit 0 / exit 1 at copyfile; identical |
| `SYSTEM/SUMMARY.md` | exit 1 / exit 1; identical | exit 0 / exit 1 at copyfile; identical |
| `SYSTEM/DECISIONS.md` | exit 1 / exit 1; identical | exit 0 / exit 1 at copyfile; identical |
| `.agents/state.draft.json` | exit 1 / exit 1; identical | exit 1 (the write is refused) / exit 1 at copyfile; identical |

**20 of 20 refuse or complete cleanly. No run crashed, no `state.json` was written, and no snapshot was left
behind.** The message is Node's raw `state import refused: EBUSY: resource busy or locked, open '<path>'`. It names
the file, but not the cause or the way out (O-b).

## 6. The probes

Blobs were extracted with `git cat-file -p` and checked with `git hash-object`: `probes-r3.mjs` `b3ecab0` and
`probes-r4.mjs` `d475c7b`. They ran against `C:\qa-scratch\il138\cand` (built, stamped `d500730`), one at a time,
with nothing else running.

| Run | Result | Compared with |
|---|---|---|
| probes-r3, byte-exact (00:12:26Z–00:12:53Z) | **17 passed, 4 failed, 21 checks**; exit 1 | PASS/FAIL ids **identical** to Forge 136's `probes-r3-d500730.out` and to QA 122's `probes-r3-78a7d13.out`. The four FAILs are the R3-2 NUL rows (`utf8`, `utf8-bom` and `cp1252` then `>>`, and the stray NUL), which R4-1 changed. Masked full-line diff against Forge's: only path truncation differs |
| probes-r4, **byte-exact** (00:13:06Z–00:14:05Z) | **16 passed, 0 failed; exit 0. It does NOT crash here.** The share=`None` row reads `stale; bare --commit exit 1; tree identical` | This run is privileged (§5). Forge's crash reproduces once the privilege is disabled (next row) |
| probes-r4, byte-exact, `SeBackupPrivilege` disabled (00:46:28Z–00:46:53Z) | 12 PASS, then EBUSY at `probes-r4.mjs:45`; no SUMMARY | PASS/NOTE rows identical to Forge 136's `probes-r4-d500730.out` |
| probes-r4 **with the recorded one-line hold diff** (00:45:29Z–00:46:28Z) | **16 passed, 0 failed**; exit 0 | PASS/FAIL/NOTE rows **identical** to Forge 136's `probes-r4-noNone-d500730.out` (0 diff lines, paths masked). The diff is Forge's `probes-r4-noNone.diff`, applied with `patch` |

## 7. Mutants

**Mine** (`mutants-qa138.cjs`, run from `C:\qa-scratch\il138\mut\open-brain` at `d500730`, 00:33:31Z–00:40:00Z). Each
edit matches exactly once, tsc runs on every mutant, vitest runs `tests/pipelines/state-import*` (113 tests, 10
files; the baseline was 113/113 in 21 s), and the source is restored and hash-checked (`restored: … clean`). Evidence:
`evidence/mutants/` (each `.diff`; the console of the first chain is `mutants-qa138-run1.out`).

| Mutant | Protection removed | At `d500730` |
|---|---|---|
| **Q1** utf32-after-utf16 (dispatched) | the UTF-32LE test moved back after UTF-16LE's | **killed**, 1 (the evidence no longer says UTF-32; the BOM-path NUL check still blocks the shape) |
| Q1b | Q1 **plus** no NUL check on the LE BOM path (QA 122's D11 exactly) | **killed**, 2 |
| **Q2** no-title removed (dispatched) | the no-readable-title rule | **killed by 5 test rows** on their assertions (UTF-7 ×3, zero bytes, the lying LE BOM). My two forms of it also tripped tsc (`TS18047`): an artifact of how I wrote the edit (E4) |
| **Q3** commit-naming dropped (dispatched) | R4-5's lines in `--commit`'s stdout (`cli.ts`) | **killed**, 1 |
| **Q4** no-title INBOX only | the rule for task.md and next-session.md | **SURVIVED** (a lone re-run, 00:39:37Z; the first run's only red row was a timeout, see O-c) |
| **Q5** bom-nul-offset | the BOM path's first-NUL byte counted in characters | **SURVIVED** |
| **Q6** empty-branch | "it is empty" for zero bytes | **SURVIVED** |
| Q7 | `--commit`'s naming against an empty imported list | killed, 1 |
| Q8 | `runCommit` returns no `decisions_unreadable` | killed (tsc, and 1 row) |
| Q9 | `ADRs imported:` always prints `none` | killed, 2 |
| Q10 | O14: a third union arm with no reason | **killed by tsc**, TS7053 |
| Q11 | O7: the newest named as the originals | killed, 1 |

**With my test file added** (`state-import-qa138.test.ts`, below), **Q4, Q5 and Q6 are each killed** by rows beyond
the three known reds: Q4 by the four task.md and next-session.md rows, Q5 by the byte-offset row, and Q6 by the
"it is empty" row (`evidence/mutants-withqa/`). **Forge's 16 mutants were not re-run**; his evidence at `d500730` is
in the handoff.

## CI (tcm, 1 of 6 runs used) and the local control run

| Run | Branch @ SHA | Runner | Result |
|---|---|---|---|
| `36279747225` (the developer's, read, not re-run) | `loop/importer-leftovers-r2` @ `d500730` | `tcm-2` | success: **88 files, 1333 passed, 2 skipped (1335)**, tsc step included. Read from the log (`evidence/ci-36279747225.txt`) |
| **`36283551677`** (mine) | `qa/importer-leftovers-tests` @ **`c3b89d2`** (`d500730` + `state-import-qa138.test.ts`, 106 lines) | `tcm-2` | **failure, as designed: 3 failed / 1340 passed / 2 skipped (1345)**, 89 files. The 3 are D1 ×2 and D2; the other 7 of my 10 are green on Linux. `evidence/ci-36283551677.txt` |

**Full suite, local, ONE run, default TEMP** (00:40:24Z–00:43:23Z; nothing else was running):
**1334 passed, 1 failed (1335)**, exit 1. The failure is `session-start/tree-currency.test.ts > reports DIVERGED when
both sides moved`: **`Test timed out in 5000ms`** (5248 ms), which is outside the importer. All 10 importer files
pass. The 2 tests CI skips on Linux ran and passed here. Evidence: `evidence/full-suite-d500730.out`.

## What could not be verified

- **co-op-mailer's and Makerspace's real inputs.** They are not on this PC. The planner reports co-op-mailer's three
  inputs carry a `# ` title on line 1, which the rule accepts.
- **That libuv opens with backup semantics** (§5's mechanism). The privilege's effect is measured; the libuv call
  site is not read.
- **Forge's PC itself.** I reproduced his result by disabling the privilege here, not by running on his machine.
- **The EBUSY path on CI.** Linux has no share modes, and the `test-windows` job is skipped, so no suite row can hold
  §5's results. They stand on this PC's runs only.
- **Forge's own 16 mutants**, which were not re-run (§7).

## Defects

| ID | Severity | Since | What | Evidence | Suggested fix |
|---|---|---|---|---|---|
| **D1** | **low** (it fails closed) | older than the leftovers: THREW at `1646567` too (round 2's decoder) | A file that starts `FE FF` and has an **odd** byte count makes `decodeText` throw `RangeError [ERR_INVALID_BUFFER_SIZE]` from `Buffer.swap16` (`index.ts:133`), instead of reaching `withBomCheck`. Through the CLI, `--draft` exits 1 with `state import refused: Buffer size must be a multiple of 16-bits`, naming neither the file nor the cause. It hits **any** input the decoder reads: a judged input (INBOX and task in §1), a **not-judged DECISIONS.md, which then blocks the whole import against R4-5**, and **the latest session log** (`oneoffs-qa138`: all exit 1). The shape is a lying BE mark over UTF-8 text of odd length (.NET here; any non-cmdlet writer), or a UTF-16BE file with an odd-length tail. | `shapes-qa138-*.out`, `oneoffs-qa138-d500730.out`; tcm `36283551677` rows D1 ×2 | Drop the odd byte as the LE path does (`toString("utf16le")` already ignores it), or file it `unreadable` with evidence naming the UTF-16BE mark and the odd length. |
| **D2** | **low–medium**, and a ruling question | new with the leftovers (R4-4's no-title rule) | The rule files a **valid UTF-8** judged input with no line starting `# ` as `unreadable`, so it blocks a bare `--commit`, and the evidence says *"its encoding is not one the importer reads, UTF-7 among them"*, which is false. The file most likely to be written that way is next-session.md with `##` sections: `/end` A7 never asks for a title, project-template ships none, and `importHandoff` reads `##` sections. At `1646567` that file was judged by its `## Pick up here (Session N)` heading and committed with `pick_up` imported; now it is refused. Also blocked: `#Title`, `#<TAB>Title`, an indented title, a setext title, and a leading U+FEFF. **No real file of that shape was found** (§2). The way out is `--accept-stale` or adding a title, but the message points the operator at re-encoding. | `shapes-qa138-*.out` (NOTE rows); tcm `36283551677` row D2 | At least, word the evidence by decode path: a file read as valid UTF-8 "has no `# ` title line", with no claim about its encoding. Possibly narrow the rule to "no ATX heading of any level", which still closes UTF-7 (`#` is `+ACM-`), zero bytes and a lying LE BOM over UTF-8. That needs a ruling (Open 1). |
| **D3** | **low** | older than the leftovers: the same at `1646567` | A UTF-16LE judged input (PS 5.1 `>`) with a **UTF-8 tail** (Git Bash `echo … >>`, or .NET `AppendAllText`) holds no U+0000 once decoded, because ASCII byte pairs decode to CJK characters. The BOM-path NUL check cannot see it, and the file keeps its `# ` title. In a CURRENT project a bare `--commit` completes and the appended task is **dropped** (`tasks ["A task"]`), and INBOX.md is re-rendered without it; the original is in the snapshot. It is not silent: `--draft` prints `unparsed lines 2`, and the report lists the garbled line under "Could not be parsed as items". This is the mirror of R3-2's `>>` class, and a BOM that lies about part of the file. | `oneoffs-qa138-d500730.out` (c); `shapes-qa138-*.out` (`.NET AppendAllText` rows) | Record it. A check would have to be heuristic, for example a UTF-16 text whose later lines decode to CJK after ASCII lines. |

## Observations, not scored

- **O-a (O13, resolved):** whether a `FileShare.None` hold makes the importer's read fail depends on the reader's
  `SeBackupPrivilege` (§5). **A QA seat launched elevated cannot see the importer's EBUSY read path**, and probes-r4's
  share=None row only exercises it when the privilege is off.
- **O-b:** the EBUSY refusal is Node's raw message. It names the file but not "another program holds it; close it and
  re-run".
- **O-c: two tests sit at vitest's 5 s default timeout on this PC.** `state-import-leftovers.test.ts:178` (the R4-5
  CLI row, two `tsx` spawns) took 2.7–5.6 s over 15 runs and **timed out in 2** (the first chain's Q2 and Q4 runs).
  `tree-currency`'s DIVERGED row timed out in the control suite (5248 ms). Neither is a verdict, but both can redden
  a Windows run.
- **O-d:** PS 5.1's `Add-Content` ignores `-Encoding` when the file has a BOM (§1). A cmdlet-only lying BOM is not
  reachable, so R4-4's lying-BOM rows describe non-cmdlet writers.
- **O-e:** with two or more markers the refusal still ends *"Keep a copy of the snapshot until the re-run completes"*,
  in the singular. This is cosmetic.

## Disagreements, returned rather than scored

1. **With both Forge 131 (§6, §7.2) and QA 122 (O13): both are right.** "Node 22.23.2's `readFileSync` cannot read a
   file held with share None" holds for a process without an enabled `SeBackupPrivilege`. "A hold cannot make the
   importer's read fail" holds for a process with it. The planner's framing, "contradicts QA 122's O13", should become
   "depends on the token". Forge's reading that the importer would "fail the draft loudly rather than open" is
   **confirmed by run** (§5).
2. **With the dispatch's description of the no-title rule** ("any judged input whose first heading is not `# `"). The
   code tests for any line starting `# `, so front matter, a comment or blank lines first are accepted (3 PASS rows).
   The reach is untitled files and non-`# ` titles instead (§2).
3. **With the code comment at `index.ts:595`,** "Every judged input opens with a `# ` title". No template guarantees
   that for next-session.md (§2).

## Error entries and near-misses (mine)

- **E1:** the first shape run measured bytes after `--commit` had re-rendered the file (a size-409 `<!-- generated`
  head). Fixed before any recorded row; the recorded runs measure bytes right after PS writes them.
- **E2:** I first expected four `Add-Content` rows to produce lying BOMs, and the first full run showed 12 FAIL.
  **The bytes showed PS had followed the existing BOM**, so the files were genuine and my expectation was wrong. Those
  rows are relabelled NOTE, and genuine lies were added (.NET). The recorded 30/2 is the corrected run (00:27:00Z).
- **E3:** the title-search walker first reported 0 files, because Node resolves `/c/...` as `C:\c\...` and the shell
  heredoc ate a backslash. It was rewritten; the recorded runs are the rewritten script.
- **E4:** mutants Q2 and Q2b tripped tsc (`TS18047`), because the forms `if (false)` and `&& false` change narrowing.
  The kill I count is the 5 test rows, which failed on their assertions in both runs.
- **E5:** in the first mutant chain, Q2's and Q4's lists included the R4-5 CLI row failing on a **timeout** (O-c),
  not on its assertion. Q4 re-run alone survived. Q4 is scored as SURVIVED.
- **E6:** the first R4-5 run used `## ADR-N` headings, and the importer reads `### ADR-N`, so 0 ADRs imported even in
  the control. Fixed; the recorded run is the corrected one.
- **Near-miss, overlaps:** none. The probes, the privilege experiment, the mutant chain (ended 00:40:00Z), the full
  suite (00:40:24Z–00:43:23Z) and the with-QA mutant runs (from 00:43:56Z) each ran alone.
- **Left in place:** `C:\qa-scratch\il138\` (worktrees `cand`, `mut`, `base`, `qat`, `report`, and the probe
  directories). `git worktree remove` clears them. The worktrees `C:\qa-scratch\cand`, `mut` and `report` belong to
  QA 135 and were not touched, nor was `docs/loops/bootstrap-fix-qa-report.md` in `~/Worktrees/sia-qa`.

## Reproduction

```sh
# S = docs/loops/qa-scripts-importer-leftovers ; W = C:/qa-scratch/il138 ; P3/P4 = QA 111's/QA 122's probes, via git cat-file
for p in "cand d500730" "base 1646567" "mut d500730"; do set -- $p
  git worktree add --detach $W/$1 $2 && (cd $W/$1/open-brain && npm ci && npm run build); done
node P3/probes-r3.mjs $W/cand $W/pr3                       # 17/4, same FAIL ids
node P4/probes-r4.mjs $W/cand $W/pr4                       # 16/0 here (privileged)
node P4/probes-r4-noNone.mjs $W/cand $W/pr4n               # 16/0 (Forge's one-line diff)
powershell -File $S/noprivprobe.ps1 -Script P4/probes-r4.mjs -Wt $W/cand -Out $W/pr4np   # 12, then Forge's EBUSY crash
node $S/exp.mjs <file> SeBackupPrivilege                   # the privilege toggle (hold.ps1, noprivread.ps1)
node $S/ebusy-importer.mjs $W/cand $W/pr4/held-held-None-Open $W/ebusy/proj   # 20 holds (noprivrun.ps1)
node $S/shapes-qa138.mjs $W/cand $W/sh-cand ; node $S/shapes-qa138.mjs $W/base $W/sh-base   # 30/2 ; 11/21
node $S/oneoffs-qa138.mjs $W/cand $W/oneoff ; node $S/r45-qa138.mjs $W/cand $W/r45 ; node $S/o7-qa138.mjs $W/cand $W/base $W/o7
node $S/reach.mjs 'C:\Users\Aaron' ; node $S/reach-history.mjs <repo>
(cd $W/mut/open-brain && node $S/mutants-qa138.cjs <ev> [id])
(cd $W/cand/open-brain && TEMP="$QA_DEFAULT_TEMP" TMP="$QA_DEFAULT_TEMP" npx vitest run)   # 1334/1 (timeout)
git branch qa/importer-leftovers-tests d500730 ; # + tests/pipelines/state-import-qa138.test.ts -> c3b89d2
node docs/loops/qa-138/push-qa.mjs qa/importer-leftovers-tests
gh workflow run ci.yml --ref qa/importer-leftovers-tests -f hosted=false   # 36283551677: 3 failed / 1340 / 2 skipped
```

Some helper scripts carry this scratch's absolute paths (`C:/qa-scratch/il138/ebusy/hold.ps1`). Adjust them before
re-running elsewhere.

## Branches pushed (each read back by `push-qa.mjs`)

- `qa/importer-leftovers-tests` → `c3b89d2` (QA evidence; red by design on 3 rows; not for merge)
- `qa/importer-leftovers-report` → this report, its scripts and evidence

## Open for the planner

None of these blocks the rest of this work; each is a recommendation.

1. **D2, the no-title rule's reach (a ruling).** *Recommendation:* keep the rule for what it was written for, but
   (a) never blame the encoding for a file decoded as valid UTF-8, and (b) consider narrowing it to "no ATX heading
   at any level", which keeps UTF-7, zero bytes and the lying LE BOM blocked and lets a `##`-sectioned next-session.md
   be judged as at `1646567`. Decide before an adoption whose next-session.md was written from `/end` A7 without a
   title. co-op-mailer's, as the planner read it, is not affected.
2. **D1:** a small fix (the odd byte), in the same follow-up as D2's wording. It fails closed today, so it is not a
   merge blocker.
3. **D3:** *recommendation:* record it and do not block. It is the mirror of R3-2's `>>` class, it is surfaced as
   unparsed lines, and it is older than the leftovers.
4. **O-a, the privilege:** future Windows QA of read paths should run the relevant probes **with and without
   `SeBackupPrivilege`**, or dispatches should say whether the seat runs elevated. Otherwise one seat's "cannot fail"
   is another seat's crash. `noprivprobe.ps1` does it in one line.
5. **O-c:** give the CLI-spawning importer tests (and `tree-currency`) an explicit timeout, so a Windows run does not
   redden on a 5 s default.

QA-138: REPORT COMPLETE
