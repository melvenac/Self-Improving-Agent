# Importer fixes, round 3: developer handoff

**By:** Forge (Claude developer seat), **record session 110** (the greeting's local number was 4; T-164),
2026-09-25. Worktree `~/Worktrees/sia-infra`.
**To:** Atlas (planner, record 109), and the QA seat that scores it (QA 111).
**Brief:** `docs/loops/importer-fixes-round-3-brief.md`, read on `origin/master` `48acaa8`. QA 106's report was read in
full (424 lines) on `origin/qa/importer-fixes-r2-report` `9d50e1f`, with round 2's and round 1's briefs.
**Model and effort, read from this session's transcript** (`dd2af804-42bc-4061-8190-2459da415a73.jsonl`, 191 assistant
records when counted): `claude-opus-5-5`, and `effort="medium"` / `perTurnEffort="medium"` on every record. **Three
sources, kept apart:**
- my own self-report to the planner at the start said *low*, which was wrong;
- Aaron said *"forge infra is on effort medium"*, quoted to me by the planner (record 109, ~22:3xZ);
- the transcript agrees with Aaron.

A seat's self-read of its own effort is not reliable, which is why D-047 takes it from the transcript.
**Process record:**
- I did not run `/start` at the beginning, although the brief made it step 1. I ran it when the planner said so (Aaron
  noticed), before any further code change. The greeting was read in full (599 lines).
- `git switch -c` from a remote ref set the new branch to **track `origin/loop/importer-fixes-r2`**, so a bare
  `git push` would have pushed round 3 onto round 2's branch. I removed the upstream at once. Every push in this
  session names its refspec, and each was read back with `ls-remote`.

## 0. What to read first

- **A rollback's damage depends on the filesystem's `readdir` order, so a test of a data-loss defect can pass for the
  wrong reason on another platform.** QA 106's D7 has the rollback fail while removing `SYSTEM/`. What it removed
  before that is `readdir` order. On NTFS (case-insensitive) `state.json` goes first, as QA saw, and the damaged project
  then has no `state.json`, so `--draft` runs on it: D7. On Linux (CI) `state.json` survived. At `aba35de` my first
  version of the test was then refused by `state.json`'s own check. It was red, but not on D7. The second redcheck adds
  a variant that fails the copy BACK of `SYSTEM/`, after every live entry is gone. That gives QA's dangerous state on
  every platform, and CI shows it failing at `aba35de` on D7 itself (`--draft` did not throw). **A red on one platform
  is not evidence that the test reproduces the defect. Read which assertion failed, and why.**
- **N13 is dead**, and each of the four tests that are green at `aba35de` has a mutant that reddens it (§4).
- **R3-3 is a marker file, not the brief's rule** (§2). The planner accepted it with reasons.

## 1. Frozen candidate

**`063662b`** on `loop/importer-fixes-r3`, branched from `origin/loop/importer-fixes-r2` `665b3a2` (the candidate
`aba35de` plus round 2's handoff). This handoff and the mutant evidence are committed on top of it and touch only
`docs/loops/`.

| Commit | Item | What |
|---|---|---|
| `718ab99` | R3-2 (D5) | Windows-1252 fallback; evidence names it; 1252 SUMMARY.md refuses; the R2-1 test that stated D5's rule is renamed |
| `45077d7` | R3-1 (D6) | a failure removes only what this run created, recorded at creation |
| `ea8a7a0` | R3-3 (D7) | the `.import-incomplete` marker, and its check is the refusal, first in both doors |
| `dfa1a2a` | R3-3 test | QA 106's sequence on every platform (the copy-back variant); every original asserted at each step |
| `063662b` | R3-3 test | a completed rollback, with `archive/` absent and with it already present |

The commits are in dependency order: R3-2 is independent, and R3-3 builds on R3-1's creation record. Each commit was
typechecked and its importer tests run before it (§3).

**The redcheck:** `loop/importer-fixes-r3-redcheck` = **`27e4a1d`**. Its parent `6fe96df` has `aba35de` as its parent.
Both commits change test files only (`git diff --stat aba35de 27e4a1d`: `state-import-r3.test.ts` +280,
`state-import-r2.test.ts` 8 lines). Its test files are identical to `dfa1a2a`'s. `063662b`'s strengthening is not on
the redcheck: it adds a guard that is green at `aba35de` by design (§4, R33-rolledback).

## 2. By item

### R3-1 (D6): a refusal never deletes what it names

- **The site (`aba35de`):** `takeSnapshot`'s "already exists — pass --force-snapshot" refusal was thrown inside the
  snapshot's `try`. The `catch` removed `snapshotDir` **by path** on any error, and `archive/` too whenever it had not
  existed before.
- **The fix, by class:** `takeSnapshot(…, made)` records `mkdirSync(dir, { recursive: true })`'s return value, the
  **first directory this call created**: the snapshot, or `archive/` above it. The snapshot's `catch` and a completed
  rollback remove exactly `made.created`, and **nothing when this run created nothing**. That replaces both the
  `snapshotDir` removal and the `archiveExisted` removal.
- **"Make the existence refusal happen before anything is written":** it already did. It is thrown before
  `takeSnapshot`'s `mkdir`, and the only earlier write, the `--force-snapshot` aside rename, happens only when the
  refusal cannot fire (`aside` requires `force`). A second pre-check would be a duplicate protection whose mutant no test
  can kill (`aba35de`'s lesson), so there is none. **Planner: accepted.**
- **`--force-snapshot` and the first-created directory never overlap:** the aside is renamed away first, so the snapshot
  path is empty when `takeSnapshot` creates it, and `made.created` is the new snapshot, never the aside. The
  `--force-snapshot` partial-snapshot test shows the aside back byte for byte after a failure (§4: red under N13 and
  R31-record).

**IF-17, every failure-path remove in the importer, with its creator** (sites at `063662b`, `index.ts` unless marked):

| Site | Removes | Created by |
|---|---|---|
| :857 | `made.created` (the partial snapshot, or `archive/`) | this run's `mkdirSync` in `takeSnapshot` (R3-1) |
| :899 (success), :918 (completed rollback) | the marker | this run, at :852 |
| :900 (success only) | the `--force-snapshot` aside | this run's rename at :846 of the operator's snapshot, which the flag replaces |
| :917 (completed rollback) | `created` | this run (R3-1) |
| **:911 (rollback)** | **every live `.agents/` entry but `archive/`** | **not this run: these are the originals.** It is the one remove of the D7 shape left. It is protected by the kept snapshot plus R3-3's refusal. Copy-over was not built (below). |
| `shared/state-writer.ts:563` | `<path>.tmp-<pid>` | its own write at :559. Edge: if that write fails before creating the file and a stale file with the same pid name exists, it removes that leftover. |
| :846, :858, :886, :919 | renames, not removes: the aside out and back; the draft and report into the snapshot | n/a |

The CLI's import door (`cli.ts` `state import`) removes nothing.

### R3-2 (D5): Windows-1252 is read and judged

- Not valid UTF-8, no BOM, **and no NUL byte** → decoded as Windows-1252, and judged as usual. The table for
  0x80–0x9F is written out: `TextDecoder("windows-1252")` has decoded that range as Latin-1 on some Node builds, and a
  mutant that decodes it as Latin-1 is red (R32-table).
- Each judged input read that way ends its evidence with **`(read as Windows-1252: not valid UTF-8, and no byte-order
  mark)`**.
- "Could not tell" stays only for **NUL bytes** (UTF-16 without a BOM), whether or not the text is also invalid UTF-8.
- **SUMMARY.md read as Windows-1252 still refuses `--commit`:** a guessed encoding is safe for a verdict, which reads only
  ASCII, but not for a file written back.
- **The candidate's own test that pinned D5** was "an input that is not UTF-8 or BOM-marked UTF-16 says so". It is
  renamed to the rule that now holds, and asserts the NUL reason.
- **Known positive:** QA 106's three shapes (1252 with em dashes, PS 5.1 `Set-Content`, PS 5.1 `Add-Content`), built as
  bytes in the test (CI is Linux) and, **through the built CLI with Windows PowerShell 5.1 writing the files**, in
  `probes-r2.mjs` (§5). Every input in the test fixture carries an em dash. A first version had only INBOX.md
  non-ASCII, and the two pure-ASCII files correctly got no Windows-1252 note, which I first read as a failure (a
  fixture error, caught before commit).

### R3-3 (D7): a half-restored project refuses re-runs

- `--commit` writes **`.agents/archive/pre-state-migration-<date>.import-incomplete`** beside the snapshot, **before
  anything live changes**, and removes it when the import completes or its rollback completes.
- Left behind, by a failed rollback or a process that died part-way, it is read by `refuseHalfRestored`: **first** in
  `--draft` and in `--commit`, before every other check (`state.json` included). **That check is the refusal.**
- Its message states the way out: *".agents/ is half-restored: an earlier --commit failed and its rollback did not
  finish. Restore .agents/ by hand from .agents/archive/pre-state-migration-<date>/, which holds every original, then
  delete .agents/archive/pre-state-migration-<date>.import-incomplete. Nothing written"*. The test performs exactly
  that way out and gets the original tree back byte for byte, then `--force-snapshot` completes.
- **Why a marker and not the brief's rule** ("a same-day snapshot exists and `state.json` does not"): that rule also
  fires on the legitimate `--force-snapshot` case, which round 2's tests exercise. The marker also covers a process
  that dies mid-migrate, which leaves no failed rollback behind.
- **Why not copy-over-first:** Node's `cpSync` throws when copying a link onto an identical link ("cannot copy to a
  subdirectory of self"), and copying a directory over a live junction writes through it, outside the project. That is
  the link class A10 exists to close, so it is not cheap. **Planner: accepted, with both conditions met** (the refusal
  names its exit; a dead-process test exists).

## 3. Red, then green

**Redcheck on tcm, per test:**

| Run | SHA | Runner (from the log) | Result |
|---|---|---|---|
| `36196957023` | `6fe96df` | `tcm-2`, machine `tcm`; the checkout first reset another seat's `e6a3fd4`, and `git log -1` = `6fe96df…` | 10 failed of 14 in `state-import-r3`, all `AssertionError`. Other importer files ✓. Tests 10 failed / 1073 passed / 1 skipped (1084). onTaskUpdate/Unhandled: 0 |
| `36197521563` | `27e4a1d` | `tcm-2`, `git log -1` = `27e4a1d…` | **11 failed of 15**, all `AssertionError`. Other importer files ✓. Tests 11 failed / 1073 passed / 1 skipped (1085). onTaskUpdate/Unhandled: 0 |

Red at `aba35de` (`27e4a1d`), with each error as CI printed it:

| Test | Error |
|---|---|
| R3-1 same-day snapshot + plain `--commit` | `expected { …(9) } to deeply equal { …(10) }` (the snapshot is gone) |
| R3-1 the same with `--accept-stale` | the same |
| R3-2 ×3 shapes | `expected { …(3) } to deeply equal { …(3) }` (the verdicts are could-not-tell) |
| R3-2 decoded as 1252 | `expected [ [ 'A task', '� do it' ] ] …` |
| R3-2 UTF-16 without a BOM, also invalid UTF-8 | `expected 'not valid UTF-8, and no UTF-16 byte-o…' to match /NUL/` (**red on the reason; the verdict was already could-not-tell**) |
| R3-3 sequence, rollback failing while removing `SYSTEM/` | `…to throw error matching /half-restored/ but got '.agents/state.json already exists…'` (**Linux: state.json survived; see §0**) |
| R3-3 sequence, rollback failing while copying `SYSTEM/` back | `expected [Function] to throw an error` (**`--draft` ran on the damaged tree: D7**) |
| R3-3 marker exists at the first live write | `expected false to be true` |
| R3-3 a dead process's marker refuses | `expected [Function] to throw an error` |

On this Windows box, with `aba35de`'s `index.ts` put in place and then restored: both sequence variants fail on
`expected [Function] to throw an error`, because on NTFS `state.json` goes first.

**Green at `aba35de` by design** (regression guards, each reddened by a mutant in §4):
- the partial snapshot with `archive/` present;
- the `--force-snapshot` partial snapshot;
- the 1252 SUMMARY.md refusal;
- a completed rollback (and, at `063662b`, its `archive/`-present variant).

**Candidate on tcm:**

| Run | SHA | Runner | Result |
|---|---|---|---|
| `36197519049` | `dfa1a2a` | `tcm-1`, `git log -1` = `dfa1a2a…` | **success**: 76/76 files, **1084 passed, 1 skipped (1085)**. The importer files are 9, 8, 17, 15, 2 and 8, all ✓. The skip is the win32-only 8.3 test. onTaskUpdate/Unhandled: 0 |
| `36198263294` | `063662b` | `tcm-2`, `git log -1` = `063662b…` | **success**: 76/76 files, **1085 passed, 1 skipped (1086)**. The importer files are 9, 8, 17, **16**, 2 and 8, all ✓. onTaskUpdate/Unhandled: 0 |

**Per commit, locally** (never the full suite):
- `tsc --noEmit -p .` exit 0 before each commit.
- The six importer files: 50 tests (`718ab99`), 54 (`45077d7`) and 58 (`ea8a7a0`) passed, exit 0.
- `state-import-r3.test.ts` alone: 15 (`dfa1a2a`) and 16 (`063662b`) passed, exit 0.
- `open-brain sync` gave 26 passed with 1 issue, the known ENTITIES.md retirements finding, except at the E2 moment in
  §8.
- The six files at `063662b`, unmutated, as the baseline for the mutants: 60 of 60 passed, exit 0 (evidence/importer-files-baseline-063662b.out).

## 4. Mutants

The script is `docs/loops/dev-scripts-importer-r3/mutants-r3.cjs`, committed so QA runs mine rather than rebuilding
them (QA 106 had to rebuild N1–N17 from prose). Its output and every mutant's `git diff` are beside it. For each mutant
it:
- checks that the edit matches exactly once and landed;
- requires `tsc --noEmit -p .` to exit 0, or the mutant does not count;
- runs the six importer files through vitest's JSON reporter and lists the red tests;
- restores the source and checks its hash.

Run from `open-brain/`: `node ../docs/loops/dev-scripts-importer-r3/mutants-r3.cjs <outdir> [id…]`.

All 14 are red on `063662b`, and `tsc` was clean on each (evidence/mutants-r3-063662b.out, and one `git diff` per mutant in evidence/mutant-diffs-063662b/). The source was restored after each: sha256/12 `b11130490235`, and its git blob equals HEAD's.

| Mutant | Protection | Red on `063662b` | Red tests (abridged) |
|---|---|---|---|
| R31-path | R3-1: the snapshot's catch removes what this run created (reverted to removal by path) | **RED 3/60** | atomic: a snapshot that fails part-way is removed, with archive/ if the snapshot created i; r3: a same-day snapshot plus a plain --commit: refused, and the snapshot is byte-identical; r3: the same with --accept-stale on a stale project: refused, and the snapshot is byte-ide |
| N13 | R3-1: the partial snapshot is removed at all (QA 106's N13, on this code) | **RED 3/60** | atomic: a snapshot that fails part-way is removed, with archive/ if the snapshot created i; r3: a snapshot that fails part-way when archive/ already existed: only the partial snapsho; r3: --force-snapshot with a snapshot that fails part-way: the aside comes back byte for by |
| R31-record | R3-1: takeSnapshot records what it created | **RED 11/60** | atomic: failing while writing state.json: the error names the failure, the tree is unchang; atomic: failing while writing SUMMARY.md: the error names the failure, the tree is unchang; atomic: failing while rendering task.md: the error names the failure, the tree is unchange; atomic: failing while rendering next-session.md: the error names the failure, the tree is ; atomic: failing while moving the draft into the snapshot: the error names the failure, the; atomic: with --force-snapshot, a failure puts back the earlier snapshot it was replacing, ; atomic: a snapshot that fails part-way is removed, with archive/ if the snapshot created i; r3: a snapshot that fails part-way when archive/ already existed: only the partial snapsho; r3: --force-snapshot with a snapshot that fails part-way: the aside comes back byte for by; r3: a completed rollback leaves no marker, and a re-run completes (archive/ absent before); r3: a completed rollback leaves no marker, and a re-run completes (archive/ already presen |
| R31-rollback | R3-1: a completed rollback removes what this run created | **RED 8/60** | atomic: failing while writing state.json: the error names the failure, the tree is unchang; atomic: failing while writing SUMMARY.md: the error names the failure, the tree is unchang; atomic: failing while rendering task.md: the error names the failure, the tree is unchange; atomic: failing while rendering next-session.md: the error names the failure, the tree is ; atomic: failing while moving the draft into the snapshot: the error names the failure, the; atomic: with --force-snapshot, a failure puts back the earlier snapshot it was replacing, ; r3: a completed rollback leaves no marker, and a re-run completes (archive/ absent before); r3: a completed rollback leaves no marker, and a re-run completes (archive/ already presen |
| R32-fallback | R3-2: invalid UTF-8 with no NUL is read as Windows-1252 (reverted to aba35de's undecodable) | **RED 5/60** | r3: Windows-1252 with em dashes: STALE inputs are STALE, --commit refuses without --accept; r3: PS 5.1 Set-Content (Windows-1252, CRLF): STALE inputs are STALE, --commit refuses with; r3: PS 5.1 Add-Content (Windows-1252, CRLF, appended line by line): STALE inputs are STALE; r3: the text is decoded as Windows-1252, not as UTF-8 with replacement characters; r3: UTF-16 with no BOM is still 'could not tell' (NUL bytes), whether or not it is also in |
| R32-nul | R3-2: NUL bytes still stop the fallback | **RED 1/60** | r3: UTF-16 with no BOM is still 'could not tell' (NUL bytes), whether or not it is also in |
| R32-table | R3-2: 0x80-0x9F decode through the Windows-1252 table, not as Latin-1 | **RED 1/60** | r3: the text is decoded as Windows-1252, not as UTF-8 with replacement characters |
| R32-evidence | R3-2: the evidence names the encoding | **RED 3/60** | r3: Windows-1252 with em dashes: STALE inputs are STALE, --commit refuses without --accept; r3: PS 5.1 Set-Content (Windows-1252, CRLF): STALE inputs are STALE, --commit refuses with; r3: PS 5.1 Add-Content (Windows-1252, CRLF, appended line by line): STALE inputs are STALE |
| R32-summary | R3-2: a Windows-1252 SUMMARY.md refuses --commit | **RED 2/60** | r2: SUMMARY.md that cannot be decoded: --commit refuses before anything is written, since ; r3: a Windows-1252 SUMMARY.md still refuses --commit: a guessed encoding is not written ba |
| R33-draft | R3-3: --draft refuses while the marker exists | **RED 3/60** | r3: QA 106's sequence, the rollback failing while removing SYSTEM/ (QA 106's handle): --dr; r3: QA 106's sequence, the rollback failing while copying SYSTEM/ back, after every live e; r3: a marker left by a process that died mid-migrate (no rollback ran): --draft and --comm |
| R33-commit | R3-3: --commit refuses while the marker exists (first, before state.json) | **RED 3/60** | r3: QA 106's sequence, the rollback failing while removing SYSTEM/ (QA 106's handle): --dr; r3: QA 106's sequence, the rollback failing while copying SYSTEM/ back, after every live e; r3: a marker left by a process that died mid-migrate (no rollback ran): --draft and --comm |
| R33-write | R3-3: the marker is written before any live change | **RED 4/60** | r3: QA 106's sequence, the rollback failing while removing SYSTEM/ (QA 106's handle): --dr; r3: QA 106's sequence, the rollback failing while copying SYSTEM/ back, after every live e; r3: the marker exists before --commit's first write to the live tree, so a process that di; r3: a completed rollback leaves no marker, and a re-run completes (archive/ absent before) |
| R33-success | R3-3: a completed commit removes the marker | **RED 3/60** | atomic: with --force-snapshot, a failure puts back the earlier snapshot it was replacing, ; r3: the marker exists before --commit's first write to the live tree, so a process that di; state-import: --commit: snapshot byte-complete before any change (P2), state.json rev 0, S |
| R33-rolledback | R3-3: a completed rollback removes the marker | **RED 2/60** | atomic: with --force-snapshot, a failure puts back the earlier snapshot it was replacing, ; r3: a completed rollback leaves no marker, and a re-run completes (archive/ already presen |

**The four tests green at `aba35de`, and what reddens them:**
- the partial snapshot with `archive/` present: N13 and R31-record;
- the `--force-snapshot` partial snapshot: N13 and R31-record;
- the 1252 SUMMARY.md refusal: R32-summary;
- a completed rollback: R31-rollback and R31-record (both variants), R33-rolledback (archive/ present) and R33-write (one variant).

**N13 is dead:** red 3/60, including the partial snapshot with `archive/` present, which is D6's exact shape.

**R32-nul and the EPERM noise.** R32-nul (the NUL guard off) was red 2 in each of two runs on `dfa1a2a`, and red 1 (the stable killer alone) on `063662b`. Its stable
killer is the r3 test "UTF-16 with no BOM is still 'could not tell'…", in both runs. The second red was a different test
each time, and each failed on a Windows **EPERM** from a rename:
- run 1: `state-import-r2.test.ts` "PROBE-2: with no SESSIONS/ directory, --commit completes…", with `state import
  refused: EPERM: operation not permitted…`;
- run 2: `state-import-atomic.test.ts` "failing while rendering task.md…".

The EPERM tests have nothing to do with the mutated line and pass on the unmutated source in every run here. I read
this as an intermittent Windows rename EPERM on a shared box, the G-042 neighbourhood, not the mutant. I did not chase
it. QA can tell the two apart: the stable killer is the one that names NUL.

**Earlier counts:** on `dfa1a2a`, before `063662b`, R33-rolledback was red **1 of 59**, and only an older atomic
`--force-snapshot` test caught it. In my own test `archive/` did not exist beforehand, so removing `created` took the
marker with it. `063662b` runs that test both ways.

## 5. QA 106's probes (IF-16, IF-19, IF-20)

The scripts were extracted with `git cat-file` and verified byte-exact by `git hash-object`: `probes-r2.mjs` `bf970cc`,
`probe-existing-snapshot.mjs` `e015912`. They were run against this worktree's build at `063662b`, on this Windows 10
box, with Windows PowerShell 5.1 writing the PowerShell shapes. Outputs are in `docs/loops/dev-scripts-importer-r3/evidence/`.

- **`probe-existing-snapshot.mjs` (D6's known positive):** plain `--commit` and `--commit --accept-stale` both refuse
  with "already exists", and the earlier snapshot **STILL EXISTS; its Session_6.md survives**. At `aba35de`, QA
  recorded "IS GONE".
- **`probes-r2.mjs`: 24 passed, 1 failed.** QA at `aba35de`: 21 passed, 4 failed.
  - The three Windows-1252 shapes (1252 with em dashes, PS 5.1 `Set-Content`, PS 5.1 `Add-Content`) now PASS: 3
    STALE, bare `--commit` exits 1 and writes nothing, and `--accept-stale` exits 0. The evidence ends
    `(read as Windows-1252: …)`.
  - **The one FAIL is `utf16le-nobom`**, the NUL case. QA's probe expects STALE there. The planner's ruling keeps
    it as could-not-tell ("keep 'could not tell' only for … the NUL case, UTF-16 without a BOM"), and QA 106 disclosed
    it as failing on round 1 too. **So the probe fails only where the ruled rule differs from the probe's expectation.
    That rule was ruled in round 3 but not changed by it.** IF-20's wording ("fails only where round 3 changed the
    rule") fits it loosely. The planner should score it.
  - **The rollback failure through a real handle** (PowerShell holding SUMMARY.md open, share=Read), step by step:
    1. `--commit` exits 1, with `ROLLBACK FAILED (EBUSY … unlink …SUMMARY.md) … Restore it by hand from …, which was
       kept. --draft and --commit refuse until ….import-incomplete is deleted`. The live tree lost 5 entries (as QA
       saw), and the kept snapshot holds 10, with 0 originals missing.
    2. `--draft` exits 1.
    3. `--commit` exits 1, with `.agents/ is half-restored…`.
    4. `--commit --force-snapshot` exits 1, the same.
    5. Afterwards: "the session files from before the import that exist NOWHERE in the project any more: **none**".
       At `aba35de`, `Session_7.md` existed nowhere after step 4.
  - **The junction probe took a different path on this box.** On QA's PC, the snapshot copied `.agents/linked` as a
    link and the render step then failed and rolled back. Here the snapshot itself failed: `EPERM: operation not
    permitted, symlink '…archive\pre-state-migration-…\linked'`. Creating a symlink needs a privilege this account
    lacks. So this box exercises R3-1's partial-snapshot cleanup: `archive/` is gone, since this run created it, the
    link is still a link, and the target is untouched. The check still PASSes. I did not run `aba35de` on this box, so
    I cannot say it behaves the same there.

## 6. Acceptance rows, as this seat reads them. The verdict is QA's.

| Row | Evidence here |
|---|---|
| IF-16 | Both refusals leave the tree byte-identical (tests; the CLI probe says STILL EXISTS). Red at `aba35de` (CI `36196957023`, `36197521563`). N13 is red 3, and the new guard's mutant R31-path is red 3 (§4). |
| IF-17 | §2's table. |
| IF-18 | The three shapes refuse without `--accept-stale`, and their evidence names Windows-1252 (tests, and `probes-r2` through PS 5.1). NUL and UTF-16-without-a-BOM are still could-not-tell (test, and `probes-r2` `utf16le-nobom`). |
| IF-19 | QA's sequence loses no original at any step: tests on both platforms' damage shapes, and `probes-r2` with a real handle ("none"). Every re-run refuses. |
| IF-20 | IF-1 to IF-15's tests: all importer files ✓ on tcm (`36197519049`). `probes-r2`: 1 FAIL, `utf16le-nobom`, discussed in §5. QA 102's `probes.mjs` and the other row probes were **not** run here (§7). |

## 7. Not verified

- **The full suite: not run locally, by the planner's ruling (the box is never quiet); it is covered by tcm CI
  (`36198263294`, `063662b`, 1085 passed) and by QA 111's Windows run on the QA PC.** Aaron: *"This machine never
  really goes quiet during the day"*, quoted by the planner (record 109). How it came to that:
  - The planner cleared a run after checking that no test or build process was running.
  - My pre-check found node pid 2604, **Grok's `cursor-agent`**, busy: 1.72 CPU-seconds in a 5 s sample, the busiest
    process on the box. Total load read 81%, 13% and 45%. ListAgents does not show a Cursor seat, so "no vitest
    process" is not "quiet" (the planner recorded its near-miss).
  - I held and asked. The planner ruled that I wait for the agent to be under 0.2 CPU-s per 5 s for a minute AND total
    load under 20% on 3 samples, bounded at 20 minutes.
  - `dev-scripts-importer-r3/quiet-wait.ps1` sampled 186 times (17:56:54–18:15:35 local): the agent went quiet from
    17:59:19; the load was at or over 20% on 30 of 186 samples, with spikes up to 100%.
  - The planner then ruled the run skipped. The process list before is in
    `evidence/procs-before-full-suite-precheck.txt`, and the samples in `evidence/quiet-samples.txt`.
- **QA 102's `probes.mjs`, `fidelity.mjs` and QA 106's `mutants-r2.mjs`** were not run. IF-1 to IF-15 rest on their tests
  in CI and on `probes-r2.mjs`.
- **GitNexus `impact` / `detect_changes`:** not run. The MUST rules name them, but this tree has no `.gitnexus/`
  (`/sync`'s `gitnexus-index` skips here, and a skip is not a pass). The blast radius was read by hand: `takeSnapshot`
  (exported; its only caller is `runCommit`), `rollBack` (private), `detectStaleness` (its new parameter defaults to `{}`;
  callers are in this file), `decodeText`/`readText` (this file and its tests).
- **A real Windows-1252 project in the wild:** as for QA 106, only files written by PS 5.1 here.
- **The main checkout's build:** not touched.
- **The EPERM flake's cause** (§4): observed, not investigated.

## 8. Errors and near-misses (mine)

- **E1 (reached the planner):** my redcheck message guessed which test gave which error, and then "corrected" itself with
  a second guess. I checked it against the line numbers in the log straight away, and that check found the platform
  finding in §0. The mapping in §3 comes from the log.
- **E2 (in the commits):** before each of `718ab99`, `45077d7` and `ea8a7a0`, I built from the working tree and then
  ran `/sync`. So `build-freshness [pass]` certified the **parent** commit's stamp, not the commit being made; the check
  compares commits, and its LIMIT says so. After `ea8a7a0`, `/sync` reported it as an issue and my chained command
  committed `dfa1a2a` anyway, because `sync` exits 0 with issues. That commit only touched a test. I rebuilt at HEAD,
  and `/sync` then passed. The lesson (shared.md's compound-command rule): read the issue list, not the exit code, and
  build after the commit whose stamp you need.
- **Near-miss:** I first extracted QA's scripts through PowerShell `Out-File -Encoding utf8`, which adds a BOM and can
  re-encode. I re-extracted them with `git cat-file` and verified the hashes before running anything.
- **Near-miss:** two patch scripts written as a bash heredoc of JavaScript failed to parse (template literals inside a
  shell string). They wrote nothing, and the edits were redone with the Edit tool.
- **Near-miss:** the 1252 fixture described in §2.
- **Near-miss (an instrument of mine that never fired):** `quiet-wait.ps1` never reported QUIET, although its rule
  was met at 114 of its 186 samples. `@($loads + $load) | Select-Object -Last 3` returns a scalar when it has one
  element, and `scalar + scalar` in PowerShell ADDS, so the 3-sample load window never held 3 readings. It failed
  closed (it would have said TIMEOUT, never a false QUIET), and the planner stopped it before either. The log is kept
  unedited, so the miss can be seen in it: its `run=` counter reached 173 with low loads in between.
