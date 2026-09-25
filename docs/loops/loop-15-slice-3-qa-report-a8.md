# Loop 15 slice three — QA report A8: candidate A8 `9e2dd5d`: REJECTED

**By:** the QA seat, record session **99** (T-164: the dispatch assigned it) · **Date:** 2026-09-25 (UTC).
**Where:** the QA PC `desktop-o4egb1e` (D-045), in `C:\Users\Aaron Melven\Worktrees\sia-qa`, launched headless by
`docs/loops/qa-99/drive.ps1`. Nobody watched the run and the planner could not be reached. Every question I would have
asked is in **§15, Open for the planner**, with what I did instead.
**Model and effort:** the driver launched `--model claude-opus-5-5 --effort high`, and the transcript agrees (§0.1).

**Dispatch:** `docs/loops/loop-15-slice-3-dispatch-qa-a8.md` at `60334bf`. That is the QA tree's HEAD, and the commit is
on `origin/docs/session-100-qa99-dispatch`, not on master.
**Criteria:** `docs/loops/loop-15-slice-3-qa-criteria-a.md` at **`6672e83`** (FINAL), read with **rulings-9 to
rulings-15** on master. Each rulings file's blob on `origin/master` (`9bc06e3`) equals the QA tree's copy.
- **D-042 (R67)** is in force.
- **D-046** records that Aaron accepted R69; I read it from `origin/master:.agents/state.json`.
- Rulings-15's "Rows touched" table is scored as it says (§2).

**Candidate (frozen):** **`9e2dd5dd8762f95431cffc80cab65f7c02885724`** on `origin/loop/15-slice-3-candidate-a8`, five
commits on A7 `d223d1d`.
- I read each commit's `git diff --stat`, and the dispatch's table matches it row for row: `e644c96` (tests, ±22 and
  +86), `4e849a3` (±44), `d448bdd` (±14), `2052251` (±3), `270e601` (±21), and `9e2dd5d` (the handoff only).
- Built by Grok 4.7 in Cursor, developer record session 98. I read the handoff
  (`docs/loops/loop-15-slice-3-a8-developer-handoff.md` at `9e2dd5d`) in full.

**Known positives:** A7 `d223d1d` and A6 `dc35b24`. Each is a `git archive` copy with its own `npm ci` and build. Their
`configwatch.ts` blobs were compared with their SHAs: `db75d772` (A8), `e2334c4f` (A7) and `d94c1b65` (A6), all equal.
**Scored on:** win32 (Windows 10 Pro 19045), git `2.55.0.windows.5`, Node v22.23.3, npm 10.9.9. File symlinks and
junctions can be created on this PC without a prompt, so the symlink shapes ran on win32 as well as on Linux.
**Linux:** CI, on runs this seat dispatched on its own `qa/loop-15-slice-3-a8-*` branches under D-040 (§5.2).
- **Runner, for every run in this report:** GitHub-hosted, "Hosted Compute Agent", `Image: ubuntu-24.04`, git 2.55.0.
- **Not tcm.** Every probe branch is built on a candidate commit and carries the candidate's `ci.yml` (`ubuntu-latest`).
- **CI budget:** 6 of the 8 allowed runs used. None was queued for billing; every one started within seconds.

---

## Verdict: REJECTED. R69, R70 and R71's "before" texts hold, and A7-1's ordinary trigger is closed. But R68's facts reach only the text of a change: an in-place write to an unreadable machine path is still silent, and no unread record that does not change carries any facts

**What A8 fixed, measured against the named known positives:**

| Item | At A7 | At A8 | Evidence |
|---|---|---|---|
| **A7-1, the ordinary trigger:** no `~/.gitconfig` at base, then `git config --global`, then an in-place append | qa write silent | **closed, both hashes** | ABSENT-BASE-LOOP on Linux: developer `absent → 5a12139e`, qa `5a12139e → 953b9c97`. R69-GITCONFIG-FIRST (mine) on win32 and Linux: developer `absent → 5c5060e1`, qa `5c5060e1 → 6973e43c`, a line for each stage. Red at A7 (`36086117746`) |
| **A7-1, TWO-NAME-LATER** | silent | **closed** | the qa entry is a change with both fact sets (`size 29 → 62`). Red at A7 |
| **A7-1, WRITEONLY-LATER** | silent | **still silent** | **A8-2**, below |
| **A7-1, R65-FACTS** (the record) | no facts | **not met** | R69 now reads that file, so the old probe no longer tests this. My adaptation, R68-STABLE-UNREAD, keeps the path unread and fails: **A8-1** |
| **A7-2** (A6-4, A6-5) | loop base / `absent` | **closed** | STAGE-START-UNREAD `before: type file dev … ino 95434 nlink 2 size 29 …`; UNREAD-BASE `before: unreadable`; R71-UNREADABLE-START and -AT-BASE `unreadable` (Linux). Red at A7 |
| **A7-3** (the handle's `nlink`) | read | **closed** | HANDLE-NLINK and R70-APPEARED-NLINK: `handle is a different file; not read` on win32 and Linux. My M-R70-nlink reads both (`5c35b68a`, `5b6d0129`) |
| **A7-4** (repository record) | two identical sides | **closed** | REPO-FACTS: `… size 12 mtimeNs … ; not read` → `… size 22 …`. Red at A7 |
| **R69's edges** (dispatch item 3) | — | **each not read, each guard load-bearing** | §3.1: hard link, symlink at the name, parent replaced by a link, a case-renamed name, a FIFO. Each is not read on win32 and Linux, and each guard's mutant reads the planted bytes |

**Why it is rejected.**

**A8-1 (medium): R68's facts are in the text of a change only. An unread machine record that does not change carries
none.** R68: a path that is not read "carries, **in its stage record** and its attribution, the `lstat` facts type,
`dev`, `ino`, `nlink`, `size` and `mtimeNs`". R65: "not read, with the reason and the R64 facts".
- `compare()` writes an unchanged unread path as the stable entry `not read: <reason>`, `unreadable` or
  `unwatched: …` (`configwatch.ts:1116–1122`). None of those carries a fact.
- The same is true of the handle's text `handle is a different file; not read` (`:1137–1138`), of the at-path
  `type change: … ; not read through` (`:1136`) and of `absent → symlink target …; not read through` (`:1128`), even
  when they are changes.
- **Measured, win32 and Linux** (`36086115526`), each red:
  - R68-STABLE-UNREAD: a two-name file untouched in qa is written `not read: different file` on both sides; its ino
    `3659174697349683` is not in the record;
  - R68-NOT-A-FILE: a directory at the path, `not read: not a file`;
  - R68-UNREADABLE-STABLE (Linux): mode 000, `unreadable`;
  - R70-HANDLE-FACTS: `handle is a different file; not read`.
- **Rulings-15 names R65-FACTS as covered by R68.** R69 changed that probe's premise, so it is red at A8 for a
  different reason (the file is now read: `f7161f8f → f7161f8f`). The adapted probe is the R68-STABLE-UNREAD above.
- **Row:** CA-15 clause 4 ("true texts and facts on both sides", rulings-15's table).

**A8-2 (medium): an in-place write to an unreadable machine path is still silent.** R68: "An in-place write to an
unread machine path in a stage is reported as a change, 'not read', with both sets of facts." CA-4f: "never silent".
- `sameId` now compares size and mtime, so the write is seen: the entry is not the stable one.
- But the text is built from placeholders. `after` is `"unreadable"` (`:1139–1140`), and `stageBefore(opened)` returns
  `"unreadable"` for a stage start that failed to read (`:1095`). So `before === after`, and `runtime.ts:1064` drops the
  finding as "no change". No line is written and the loop completes.
- **Measured on Linux** (`36086115526`), with the plant asserted (EACCES on a direct read; the size moved):
  - QA 96's WRITEONLY-LATER: the qa entry is `unreadable → unreadable` while the size went 24 → 59, same inode;
  - my R68-UNREADABLE-LATER: `unreadable → unreadable`, size 23 → 47.
- **This is A7-1's third trigger,** which report A7 listed with ABSENT-BASE-LOOP and TWO-NAME-LATER. Rulings-15's R68
  names only the other two, plus R65-FACTS. I scored it under R68's general sentence (§15, question 1).
- **The cause is shown by a mutant.** M-R71-unreadable removes the `unreadable` line from `stageBefore`, so `before`
  becomes the stage-start facts. Both probes then go **green**: `before: type file dev 66305 ino 326059 nlink 1 size
  23 …`, `after: unreadable` (`36087328580`). The facts are compared; they are just never printed.
- **The trigger is less ordinary than A7-1's:** it needs a config file the runtime cannot read but a role can write.
  Mode 0200 is one way. I found no way to make one on this PC (§7.4).
- **Rows:** CA-4f ("never silent"), CA-11 ("role writes … reported"), and R64 on the machine side.

**Lower** (§9):
- **A8-3 (low, CA-15 clause 4's true texts):**
  - the change text `not read: base <facts>; current <facts>` now prints the **stage start's** facts under the word
    `base`. R71-BASE-LABEL: the loop base's ino was `4503599627481496` and the text labelled `base` shows
    `5629499534324121`, the qa stage start's;
  - the same text has no `type` on either side, and R68 lists type first.
- **A8-4 (low, test coverage):**
  - R71's A6-4 and A6-5 halves have no candidate test of their own. The developer's `mut-record` reverts only A7-4.
    On Linux, M-R71-unreadable reddens no candidate test (only my two probes). M-R71-before reddens the candidate's
    R68 test only incidentally, through its `before` text;
  - no candidate test separates `size` from `mtimeNs`. M-R68-mtime survives every candidate test. M-R68-size reddened
    the candidate's R68 test in one win32 run of two, depending on whether the append fell in the same timestamp tick.
    My R68-SIZE-ONLY and R68-MTIME-ONLY kill each deterministically.
- **Returned, not scored (§11):** under R70, the **base** object gaining a second name inside `open` is now refused
  (QA 96's HANDLE-NLINK-BASE, red at A8 on win32 and Linux, `handle is a different file; not read`). That narrows
  D-042's "a hard link made elsewhere does not stop reads" inside the race window only, in the fail-safe direction.

**The full suite at `9e2dd5d`: exit 1, 1 failed, 1135 passed, 28 skipped (1164).**
- The one failure is `tests/shared/paths.test.ts`, "finds a mixed-case directory through its lowercased canonical path".
  A8 does not touch that code.
- It fails on this PC because `os.tmpdir()` is the 8.3 alias `C:\Users\AARONM~1\…`. PR #156 (v0.44.2) fixed exactly
  this; it is not in A8's history, which starts from A7.
- The same test fails at A7 on this PC, and passes in the QA tree, which carries #156 (§5.1).
- **Attributed to the PC and the candidate's base, not to A8.** CA-12 is recorded as not met as measured (§2).

---

## 0. Rulings and authority in force

| Source | Where |
|---|---|
| Rulings-1 to 14 | master, as cited by the criteria and reports A3 to A7 |
| **Rulings-15 R68–R71** and its table of touched rows | master (`loop-15-slice-3-rulings-15.md`, blob `3733cbe0`) |
| **D-042** (R67), **D-046** (R69 accepted) | `origin/master:.agents/state.json` |
| The dispatch | `loop-15-slice-3-dispatch-qa-a8.md` at `60334bf` |
| **CI on this seat's own branches** | **D-040**, within the dispatch's cap of 8 runs; 6 used (§5.2) |
| **Pushing this seat's own branches** | **D-038**, only through `node docs/loops/qa-99/push-qa.mjs <branch>`; every push read back by the script |
| **The local window** | the dispatch: this PC is dedicated and quiet (D-045). Process lists around the suite are in §5.1 |

### 0.1 Model and effort

- **The session's init line** (`%USERPROFILE%\sia-qa99\run-0.jsonl`, parsed as JSON): `model: "claude-opus-5-5"`,
  session `5ed40a1f-ac34-497f-94b8-36be57906e7f`, `permissionMode: "dontAsk"`, Claude Code `2.1.282`. The init line has
  no effort field; it carries `per_turn_effort_active`.
- **The host transcript** (`~/.claude/projects/C--Users-Aaron-Melven-Worktrees-sia-qa/5ed40a1f-….jsonl`, parsed as JSON):
  every assistant entry carries `model: "claude-opus-5-5"`, `effort: "high"` and `perTurnEffort: "high"`. The count
  and time span, read just before the report was committed: **316 of 316 entries, 02:04:16Z → 04:10:17Z**. That span
  covers every measurement, mutant, CI dispatch and the suite. The few turns after it (commit and push) are not in the
  count.
- **So the transcript agrees with the driver's `--model claude-opus-5-5 --effort high`.**

## 1. Frozen-candidate conditions

| Condition | Observation | Result |
|---|---|---|
| criteria before candidate | `6672e83` is an ancestor of `9e2dd5d` (exit 0). **Control:** `d18a196` exits 1 | held |
| built on A7 | `d223d1d` is an ancestor (exit 0) | held |
| A8's own diff | `d223d1d..9e2dd5d` (`--numstat`): `configwatch.ts` +55/−9, `configwatch-a7-seam.test.ts` +21/−1, `configwatch-links.test.ts` +86, the handoff +37. Nothing else | as the dispatch states |
| **tree moved** | `ls-remote` of the candidate branch = `9e2dd5d…` at 02:27:41Z and again at 04:09:40Z | **not moved** |
| **QA tree** | detached at `60334bf` throughout; 0 porcelain entries at the start (drive.meta) and before the report was written. The candidate was examined in archive copies (`C:/qa99/arch/`), a worktree (`C:/qa99/wt-a8`) and a clone (`C:/qa99/syncclone`). CI commits were built with a temporary index | **clean** |
| build | `npm ci` and `npm run build` exit 0 in each archive (02:07Z) and in the worktree (03:59Z) | current |
| **CA-13**, no version bump | `git diff d223d1d 9e2dd5d -- package.json open-brain/package.json CHANGELOG.md`: 0 lines | **pass** |
| a detail of the diff | the R70 comment is duplicated, `configwatch.ts:1011–1012` | cosmetic |

## 2. Rows

**"Cand. rows"** means the row files run unmutated on win32 in the A8 archive copy with the JSON reporter:
- the six row files, the candidate's `configwatch-a7-seam.test.ts`, and every probe file (QA 94 × 2, QA 96 × 3, and
  this seat's two);
- **253 tests: 202 passed, 43 skipped, 8 failed, 0 unhandled** (the final BASELINE, 03:47–03:49Z);
- **all 8 failures are probes, none a candidate test:** A8-1 × 4 (R68-STABLE-UNREAD, R68-NOT-A-FILE,
  R70-HANDLE-FACTS, and R68-TWO-NAME-LATER-FACTS's `type`), A8-3 (R71-BASE-LABEL), HANDLE-NLINK-BASE (§11), and two
  probes made obsolete by D-042 and R69 (QA 94's NO-SEAM CONTROL and QA 96's R65-FACTS);
- the 43 skips are `skipIf(win32)` and the two real-`claude` rows (§7). Every POSIX row below is read **as passed**
  from CI's per-test output, never from a skip.

**Rulings-15's table, scored as it says:**

| Row | A8 must (rulings-15) | Observed | Verdict |
|---|---|---|---|
| **CA-4f** | ABSENT-BASE-LOOP reported with both hashes (R69), or with facts if R69's conditions fail; never silent | ABSENT-BASE-LOOP both hashes, Linux. R69-GITCONFIG-FIRST both hashes, win32 and Linux. GITCONFIG-LOOP (QA 94) `9f3ef5ba → 8dc399fe → c63c2e26`. When R69's conditions fail, it reports facts: R69-HARDLINK-APPEAR `not read: … current … nlink 2 size 26 …`. **But WRITEONLY-LATER and R68-UNREADABLE-LATER are silent** (A8-2) | **FAIL** (A8-2) |
| **CA-15 clause 4, CA-14** | true texts and facts on both sides | **Met:** changes carry both fact sets on the machine side (TWO-NAME-LATER, R69-HARDLINK-APPEAR, A4-1 H's qa stage `size 29 → 39`) and on the repository side (REPO-FACTS, the candidate's R71). "Before" is the stage start (STAGE-START-UNREAD). A failed read says `unreadable` (UNREAD-BASE, R71-UNREADABLE-*). EXISTBETWEEN, EXISTBETWEEN2 and NEWBETWEEN are `ok` (CA-14). **Not met:** facts on unread records that do not change, and on the handle and type-change texts (A8-1); the unreadable change's two identical placeholders (A8-2); the `base` label and the missing `type` (A8-3) | **FAIL** (A8-1; A8-2, A8-3) |
| **CA-15 clause 3** | reads confined to single-name files at the base place; A4-1 H, J and LOOP unread; TWO-NAME not read | QA 89's H, J and LOOP `✓` on Linux, and neither victim hash is in the record. TRADE-NEW-TWO-NAME and TWO-NAME-LATER: not read. Every R69 edge is not read, and each guard is load-bearing (§3.1, §4). R70 holds (HANDLE-NLINK). The one widening I found (a parent directory replaced by a new REAL directory at the same path) is within R69's letter (§11.2) | **pass** |
| **CA-11** | unqualified | "config outside the repository … role writes hashed and reported" is untrue for the write in A8-2 | **FAIL** (A8-2) |
| **R54, R62, R64** | the machine side as the repository side | `sameId` compares size and mtime: M-dev8-facts reddens the candidate's R68, TWO-NAME-LATER, R68-SIZE-ONLY and R68-MTIME-ONLY. Attribution is against the stage start: M-R71-before reddens STAGE-START-UNREAD (win32) and UNREAD-BASE (Linux); M-R54-7 reddens 3. **Not as the repository side:** the repository side prints the two fact sets it compares; the machine side's unreadable branch compares them and prints neither (A8-2) | **FAIL** (A8-2) |

**Every other row, re-run.** The mutants are from §4.

| Row | Observed | Verdict |
|---|---|---|
| **CA-1** | Cand. rows pass. **M-L2 kills 16**, A7's count; among them process-role's "a role that sleeps, then writes a ref and plants a hook" and its CONTROL | **pass** |
| **CA-2.1–2.6** | Cand. rows pass. **M-2.5-refuse-node** kills 16. The real-`claude` 2.5 control and the CA-9 pin **skip on this PC** (§7) | **pass** on the rows run |
| **CA-3a–d, order** | Cand. rows pass; preflight is untouched by A8. M-2.5-refuse-node kills CA-3a/3b's row | **pass** |
| **CA-4b** | spawn-sites pass. **M-R16 kills 7** | **pass** (R16) |
| **CA-4c, CA-4e, CA-4g** | Cand. rows pass. **M-L0 kills CA-4c's own row and CA-4e.** probe2 H at A8 is identical to A7 (§3.4). M-L2 kills CA-4g's repo-local cell | **pass** |
| **CA-4d** | **M-L2-norestore kills 19**, the CA-4d row among them | **pass** |
| **CA-4h** | Cand. rows pass; M-L2 kills the CA-4h rows | **pass** on the rows |
| **CA-4i** | Cand. rows pass. M-backstop not run (§7) | **pass** on the rows |
| **CA-5** | Cand. rows pass on `2.55.0.windows.5`. CI prints the 2.55.0 row `✓` (`36083648742`). **The two versions are now nearly the same** (§7) | **pass**, with that note |
| **CA-6** | Cand. rows pass. CI `36083648742`: both POSIX rows `✓`. probe2 SINGLE and DFORK identical to A7 apart from R71's added facts | **pass** |
| **CA-7** | Cand. rows pass. **M-2.5-refuse-node** kills 16, A7's count, which report A7 read as including all five CA-7 rows | **pass** |
| **CA-8** | probe2 COMPOSE identical to A7 apart from R71's added facts. **M-L2 kills CA-8** | **pass** |
| **CA-9** | the pin **skips here** (claude is not where the test looks); the real run is candidate A's (**attributed**, as in reports A to A7) | observation only |
| **CA-10** | **M-CAS kills 1** | **pass** on (1) |
| **CA-12** | full suite **exit 1**: one failure, attributed to this PC's 8.3 temp path and fixed on master by PR #156 (§5.1). CI on the head `36083648742`: success. **`/sync --check` after `gitnexus analyze`: UNRUN**, because `gitnexus` is not available here (§6) | **not met as measured**; returned (§15) |
| **CA-13** | 0 lines | **pass** |
| **R35** | QA 89's Linux R35 `✓`. The loop probes `r35base`, `r35edit` and `r35anchorEdit` are identical to A7 in every verdict and victim field | **pass** |
| **R50** | M-dev7-r50 reddens R66 R50. The historical M-R50 survives, as at A7 (equivalent under R64) | **pass** |

## 3. Detail

### 3.1 Dispatch item 3: R69's edges, each against A8 and with a mutant where one protects

Each probe is in `qa99-a8-probe.test.ts`, asserts its plant first, and ran on win32 (archive copy) and Linux
(`36086115526`). "Read" means the planted file's hash is in the record.

| Edge | A8, win32 and Linux | What guards it | Mutant (removes only that guard) | Under the mutant |
|---|---|---|---|---|
| **hard link appears** (`nlink` 2): R69-HARDLINK-APPEAR, R69-CREATED-THEN-LINKED, and the candidate's own | not read; `not read: base unresolved …; current … nlink 2 size 26 …` | `nlink === 1` in `appeared` | **M-R69-nlink** (win32) | **read**: `absent → 08466b40`. Kills 5, including the candidate's R49 and R69 two-name rows |
| **symlink at the name**, target also named `.gitconfig` (SAMENAME) | not read; `absent → symlink target …\sas-other\.gitconfig; not read through` | **two guards:** the early `type change` return (`:989`) and `lexical.kind === "file"` in `appeared` | M-R69-typechange: 0 kills. M-R69-lexical: 0 kills. **M-R69-symlink-both** | **read**: `absent → 81e4734c`, the target's bytes, on win32 and on Linux (`36087309826`, 1 kill) |
| **symlink at the name**, target named otherwise (OTHERNAME) | not read | **three guards:** the two above and `basename(realpath) === basename(path)` | M-R69-symlink-both | **still not read**, on both platforms: the basename guard alone holds it |
| **parent directory replaced** by a link to elsewhere (XDG `git/`; HOME itself) | not read; `absent → symlink target …\plx-elsewhere; not read through` | `parentReal === gate.parentReal` | **M-R69-parent** | **read**: XDG `absent → 0a9f6606`, HOME `absent → 3f414c72`, on win32 (junction) and Linux (symlink, `36087316402`). Also kills the candidate's R45 |
| **renamed appearance:** the name on disk differs (`.GITCONFIG` where `.gitconfig` is watched; the case-insensitive FS resolves it) | not read (win32); `current …\rnc-home\.GITCONFIG … nlink 1`. On Linux it does not resolve at all, so nothing is measured there | `basename(realpath) === basename(path)` | **M-R69-basename** (win32) | **read**: `absent → 3ef98b2a`. 1 kill |
| **a FIFO appears** (POSIX) | not opened, no hang; `not read: … current … size 0` | `kind === "file"`, twice | not run: two guards, no hang observed | — |
| **`git config --global`, no `~/.gitconfig` at base:** R69-GITCONFIG-FIRST, ABSENT-BASE-LOOP | **read, both hashes** (above) | `appeared` as a whole | **M-dev8-appear** (= the developer's mut-appear) | **not read:** kills 7, R69-GITCONFIG-FIRST and the candidate's R69 among them |

**Observations on the same edges, not scored:**
- **Renamed into place** (`.gitconfig.lock` → `.gitconfig`, git's own way): read. That is D-042's trade, as intended.
- **Moved in from outside** when absent at base (OBS-R69-MOVE-IN-ABSENT): read. This is rulings-15's accepted limit
  (report A7 §11.1), now reachable from "absent at base" too.
- **Parent absent at base:** the role creates `xdg/git/config`. It is not read (the base parent has no realpath) and is
  reported with facts. That is fail-safe and within R69's letter.
- **The parent replaced by a new real directory at the same path:** read (§11.2).
- **R37's gap, the named limit** (rulings-15 R70; `qa99-seam.test.ts`, win32 and Linux):
  - GAP-PARENT-SWAP: the parent is swapped inside `open` for a link to a directory holding a different file. It is
    **not read** (`handle is a different file`), because the handle's dev/ino differ.
  - GAP-OBJECT-MOVED: inside `open`, the gated object itself is moved to another directory and that directory is linked
    in. It is **read** (`absent → 9a70087…`). The bytes are those of the object that passed the gate a moment earlier,
    now at another place. **Recorded, not scored.**

### 3.2 On CI's Linux: this seat's branches

**The probe files:** QA 89's, QA 92's v3 (blob `99c495bd`), QA 94's two, QA 96's three (unchanged), and this seat's
`qa99-a8-probe.test.ts` (blob `1a760243` on these branches) and `qa99-seam.test.ts`.

| Branch | Base | Run | Result |
|---|---|---|---|
| `qa/loop-15-slice-3-a8-probe` | A8 | **`36086115526`** | 14 failed, 1220 passed, 6 skipped (1240). **Every candidate test `✓`**; every failure is a probe |
| `qa/loop-15-slice-3-a8-probe-on-a7` | A7 | **`36086117746`** | 29 failed: the known positives red, as expected |
| `…-a8-m-r69-symlink-both` | A8 + mutant | `36087309826` | 15 failed: 1 kill (§3.1) |
| `…-a8-m-r69-parent` | A8 + mutant | `36087316402` | 17 failed: 3 kills |
| `…-a8-m-r71-before` | A8 + mutant | `36087322689` | 17 failed: 5 kills, 2 healed |
| `…-a8-m-r71-unreadable` | A8 + mutant | `36087328580` | 14 failed: 2 kills, 2 healed |

Per test, read from the logs with ANSI stripped (`cilog.sh`); `×` red, `✓` green:

| Test | A7 | **A8** | Printed at A8 |
|---|---|---|---|
| ABSENT-BASE-UNIT, ABSENT-BASE-LOOP, TWO-NAME-LATER (QA 96) | × | **✓** | ABSENT-BASE-LOOP developer `absent → 5a12139e`, qa `5a12139e → 953b9c97` |
| STAGE-START-UNREAD (QA 96), UNREAD-BASE (QA 94) | × | **✓** | `before: type file dev 2049 ino 95434 nlink 2 size 29 …`; `before: unreadable` |
| HANDLE-NLINK (QA 96) | × | **✓** | `handle is a different file; not read` |
| REPO-FACTS (QA 96) | × | **✓** | `… size 12 …; not read` → `… size 22 …; not read` |
| R69-GITCONFIG-FIRST, R69-HARDLINK-APPEAR, R69-APPEARED-THEN-LINKED-LATER (mine) | × | **✓** | both hashes; `nlink 2 size 26`; `not read … nlink 2 size 48` |
| R71-UNREADABLE-START, R71-UNREADABLE-AT-BASE (mine) | × | **✓** | `before: unreadable` |
| R69 symlink, parent, case, FIFO edges (mine) | ✓ | **✓** | at A7 these pass trivially, since A7 never reads an absent-at-base path. Only the mutants in §3.1 show they can fail |
| **WRITEONLY-LATER (QA 96), R68-UNREADABLE-LATER (mine)** | × | **×** | `unreadable → unreadable`, size 24 → 59 (**A8-2**) |
| **R68-STABLE-UNREAD, R68-NOT-A-FILE, R68-UNREADABLE-STABLE, R70-HANDLE-FACTS (mine)** | × | **×** | `not read: different file`, `not read: not a file`, `unreadable`, `handle is a different file; not read` (**A8-1**) |
| **R68-TWO-NAME-LATER-FACTS, R71-BASE-LABEL (mine)** | × | **×** | no `type` in `after`; `base` shows the stage start's ino (**A8-3**) |
| **HANDLE-NLINK-BASE** (QA 96) | ✓ | **×** | `handle is a different file; not read` (§11.1) |
| **R65-FACTS** (QA 96) | × | **×** (obsolete) | R69 now reads the file: `f7161f8f → f7161f8f` |
| QA 89 A4-1 H, J, LOOP; R29 row shape; R35 on Linux | ✓ | **✓** | H's victim hashes `inRecord: false`; the qa stage's in-place write to the outside file is now a change with facts (`size 29 → 39`) |
| QA 89 A4-1 R; QA 94 TRADE-SAME and NO-SEAM; QA 92 STOW-LOOP | × | **×** (obsolete) | the old assertions report A7 §14 item 2 names |
| QA 94 GITCONFIG-LOOP, HARDLINK-SAME, R61-UNIT, R61-LOOP, TRADE-DIFF, REPOINT, REUSE, AT-PATH-SAME | ✓ | **✓** | GITCONFIG-LOOP `9f3ef5ba → 8dc399fe → c63c2e26`, `qaHashInRecord: true` |
| QA 96 TRADE-LOCKRENAME, TRADE-HARDLINK-ELSEWHERE, TRADE-NEW-TWO-NAME, BASE-TWO-NAME, R65-EVERY-LOOP, REFWATCH-REPEAT | ✓ | **✓** | REFWATCH-REPEAT 20 of 20 |
| QA 92 STOW-CTL, STOW-H, XDGDIR-*, XDGFILE-CTL, DOWN-CTL, ABS2, ANCHOR-EDIT, VIADIR-EDIT | ✓ | **✓** | — |

**The candidate's own tests are `✓` in every A8 run** (`36083648742` re-read; `36086115526`).

### 3.3 Dispatch item 4: R70, independently of the developer's mut-nlink

- **M-R70-nlink** is my own edit: ` || Number(st.nlink) !== nlink) {` becomes `) {`, built and asserted from A8's blob.
  It turns out byte-identical to the developer's `mut-nlink` blob (`13dec557`), because there is only one minimal
  edit.
- **Run on my probes, not theirs** (win32): QA 96's HANDLE-NLINK is **read**: `pre 1, post 2, read: true`,
  `951430cc → 5c35b68a`. That is exactly A7-3's observation at A7. R70-APPEARED-NLINK is read as well
  (`absent → 5b6d0129`).
- **3 kills:** the candidate's R70, HANDLE-NLINK and R70-APPEARED-NLINK. **1 healed:** HANDLE-NLINK-BASE (§11.1).

### 3.4 Dispatch item 6: regressions, and the loop probes on win32

QA 92's `probe15-a5.mts` (31 probes) ran against the A8 and A7 archive copies (03:56–03:58Z; each exit 0, stderr
empty). `shapev8.mjs` is QA 96's `shapev.mjs` with this PC's temp path and R68's `size`/`mtimeNs` normalised, and it
compares only the machine findings that are changes.
- **8 of 31 differ, and in each the difference is R68 at work.** In `machineNext`, `machineHard`,
  `machineHardAbsent`, `r35chainJ`, `r35chainH`, `r54Twice`, `r54Revert` and `r35anchor`, the qa stage's in-place
  write to an unread path is now a change with both fact sets. At A7 those writes were silent, which is A7-1 caught in
  the old probes.
- **No victim, token or "in record" field differs** between A8 and A7 in any of the 31. The one field that differs is
  `ca4fBase`'s own per-path counter, which report A7 §9 already names as the probe's fault (A7-5).
- **probe2** (H, R34, SINGLE, DFORK, DMGconfig, DMGhead, DMGindex, COMPOSE), **r57**, **r59** and **r62** are identical
  field by field. The only differences are temp names, PIDs, timings, commit SHAs and R71's added `size … mtimeNs …`
  on repository-side unread texts.
- **A6-2 stays closed:** r62's NEWBETWEEN, EXISTBETWEEN and EXISTBETWEEN2 are `ok: true` at A8, and both controls are
  `ok: false`.

**D-042's trade, both ways:** TRADE-LOCKRENAME, GITCONFIG-LOOP and the candidate's R67 test are read with both hashes.
A hard link made elsewhere does not stop reads (TRADE-HARDLINK-ELSEWHERE, HARDLINK-SAME). A new two-name file is not
read (TRADE-NEW-TWO-NAME, A4-1 H, STOW-H, XDGDIR-H). **M-dev8-r67** (A6's gate, `nlink` counted) reddens 13, among them
both R67 rows, TRADE-LOCKRENAME and TRADE-HARDLINK-ELSEWHERE. **M-R67-nlink** reddens 6, among them R43, R49 and
TRADE-NEW-TWO-NAME.

## 4. Mutants

**Local, win32.** Each mutant is a `git archive 9e2dd5d open-brain` copy with a `node_modules` junction to the A8
archive's (`build8.mjs`).
- Each edit is asserted to occur the expected number of times **against A8's blob before archiving**, then asserted to
  land and read back.
- **Every counted mutant is `tsc --noEmit` exit 0.** The type-check control, a planted TS2322 in `runtime.ts`, exits 2.
- The rows are those of §2, read with the JSON reporter against the unmutated **BASELINE**. A "kill" is a test red
  under the mutant and not red at BASELINE.
- Sequential, 02:20:51Z → 03:47:09Z, with nothing else of mine running locally. **No run printed an unhandled error.**
  CI dispatches and log fetches ran beside the batch; they use the network only.

**Applicability.** `mutants-a8.mjs` carries every earlier spec: 88 in all, 70 applicable to A8 as written.
- A8's edits broke three A7 specs: M-R59-read6, M-dev7-r67 and M-R67-realpath. Each has an A8 equivalent.
- M-handle-narrow and M-dev-handle, which date from A5, match A8's handle text exactly again, because A8 restored the
  `nlink` comparison. They run under their old names.
- **The developer's four, rebuilt locally from their diffs, are byte-identical to their branch blobs** (`016dde08`,
  `55f4e601`, `13dec557`, `f88524d0`). Each differs from A8 in exactly the one edit it claims (dispatch item 7).

**42 were run:** every configwatch mutant that bears on A8, plus one per untouched layer.

| Mutant | Edit | Kills (win32) | CI (Linux) | What it shows |
|---|---|---|---|---|
| **M-dev8-facts** (= dev mut-facts) | size, mtime out of `sameId` | **4**: the candidate's R68, TWO-NAME-LATER, R68-SIZE-ONLY, R68-MTIME-ONLY | `36083230156` re-read: 1 (R68) | R68's comparison |
| **M-R68-size** (mine) | `size` alone out | **3** in the final run: the candidate's R68, TWO-NAME-LATER, R68-SIZE-ONLY. **0** in the first run, before R68-SIZE-ONLY existed | — | the candidate's R68 test sees size alone only when the append falls in the same mtime tick (A8-4) |
| **M-R68-mtime** (mine) | `mtimeNs` alone out | **1**: R68-MTIME-ONLY only | — | no candidate test protects mtime (A8-4) |
| **M-dev8-appear** (= dev mut-appear) | `appeared` out of `same` | **7**: the candidate's R69, R69-GITCONFIG-FIRST, APPEARED-THEN-LINKED-LATER, and 4 seam probes whose plant needs the open | `36083232599` re-read: 1 (R69) | R69 as a whole |
| **M-R69-nlink** (mine) | `nlink === 1` out of `appeared` | **5** (§3.1) | — | the hard-link edge |
| M-R69-lexical / M-R69-typechange (mine) | one symlink guard each | **0 / 0** | — | the symlink edge is guarded twice |
| **M-R69-symlink-both** (mine) | both symlink guards | **1**: SAMENAME | `36087309826`: 1 | together they are load-bearing; OTHERNAME stays guarded by the basename check |
| **M-R69-basename** (mine) | the name condition | **1**: RENAMED-CASE | — (unreachable on Linux) | the rename edge, win32 only |
| **M-R69-parent** (mine) | the parent-realpath condition | **3**: the candidate's R45, PARENT-LINK-XDG, PARENT-LINK-HOME | `36087316402`: 3 | the parent edge |
| **M-R70-nlink** (mine; = dev mut-nlink) | the handle's `nlink` comparison | **3** + 1 healed (§3.3) | `36083234983` re-read: 1 | R70 |
| **M-R71-before** (mine) | "before" from the loop base again (A7's three lines) | **2**: STAGE-START-UNREAD, the candidate's R68 | `36087322689`: 5 (+ UNREAD-BASE, R71-UNREADABLE × 2); **heals** WRITEONLY-LATER and R68-UNREADABLE-LATER | R71 A6-4/A6-5 |
| **M-R71-unreadable** (mine) | `stageBefore`'s `unreadable` line out | **0** (the probes are POSIX) | `36087328580`: 2 (R71-UNREADABLE × 2), **heals** WRITEONLY-LATER and R68-UNREADABLE-LATER | A6-5 has no candidate test (A8-4); A8-2's cause |
| **M-dev8-record** (= dev mut-record) | repository `stateHash` without size/mtime | **2**: the candidate's R71, REPO-FACTS | `36083237474` re-read: 1 (R71) | A7-4 |
| M-R59-read8 | compare's read branch never taken | **5** | — | R59 / R69 reads |
| **M-R67-realpath8** | condition 1 removed | **6**: R44, R45, R49 (directory), PARENT-LINK × 2, RENAMED-CASE | — | condition 1 |
| **M-dev8-r67** | A6's gate (`nlink` in identity) | **13** + 1 healed | — | R67's allowing direction (§3.4) |
| **M-R67-nlink** | `nlink === 1` out of `singleName` | **6** | — | R67's protective direction |
| **M-handle-narrow** | the handle's dev/ino/nlink comparison removed | **6** + 1 healed: the candidate's R66 and R70, HANDLE-SWAP, HANDLE-NLINK, R70-APPEARED-NLINK, GAP-PARENT-SWAP | — | the handle re-check |
| M-dev-handle | every handle rejected | 14 + 1 healed | — | reads stop; not a test of the re-check |
| **M-R29-both** | the at-path type change and the different-file gate | **19** (symlinks work on this PC, so its R69 edges are live) | — | as at A7 |
| M-dev-object | the different-file gate removed | **17** | — | as at A7, plus the R69 edges |
| M-typechange6 | the at-path type change alone | **0** | — | redundant for reads (report A7 §11.4) |
| M-dev-identity7 / M-dev7-drifted / M-dev7-facts / M-dev7-record / M-dev7-r50 | as at A7 | **2 / 1 / 3 / 2 / 1** | — | repository R62/R64/R57, R65 read state, R50 |
| M-R54-7 | read/read attribution against the loop base | **3** | — | R54(2) |
| M-R46-basenotes6 / M-R57 / M-R43-repo / M-R49-repo | as at A7 | **1 / 2 / 2 / 3** | — | M-R57, M-R43-repo and M-R49-repo each also redden the candidate's new R71 repository row |
| **M-R50** (historical) | — | **0** | — | equivalent under R64, as at A7 |
| M-L0 / M-L2 / M-L2-norestore / M-follow-a7 / M-R16 / M-CAS / M-2.5-refuse-node | as at A7 | **2 / 16 / 19 / 6 / 7 / 1 / 16** | — | identical to A7's counts |

**Every carried mutant that was run kills at A8 at least what it killed at A7.** The additions are the candidate's
new rows and this seat's R69 probes.

**One sighting, not counted:** in M-R57's first run, `runtime > refuses a commit even when every path it touched was
inside the allowlist` failed with `expected 'stage-changed-config' to be 'stage-committed'`. It did not reproduce: the
full rows again under M-R57, and that test alone three times each under M-R57 and at BASELINE, all passed. It has the
same shape as report A7 §3.5's refwatch oddity: a repository config change that no act in the test explains (§7.3).

## 5. Full suite and CI (CA-12)

### 5.1 The full suite

**The QA full suite at the candidate: 03:59:50Z → 04:03:08Z, `SUITE_EXIT=1`, captured unpiped
(`npx vitest run > file; SUITE_EXIT=$?`).**
- **Where:** `C:/qa99/wt-a8/open-brain`, a detached `git worktree` of the QA repository at `9e2dd5d`, after `npm ci`
  (exit 0) and `npm run build` (exit 0). The QA tree itself stayed at the dispatch commit, because the driver reads its
  stop file and this seat's push script from it.
- `Test Files  1 failed | 75 passed (76)`, **`Tests  1 failed | 1135 passed | 28 skipped (1164)`**, duration 193.75 s,
  0 matches for `Unhandled|onTaskUpdate`.
- The total, 1164, equals CI's on the head (`36083648742`: 1158 passed, 6 skipped).
- **The failure:** `tests/shared/paths.test.ts > projectDirExists / existsCaseInsensitive > finds a mixed-case
  directory through its lowercased canonical path`, `expected false to be true` at line 117.
  - `os.tmpdir()` here is `C:\Users\AARONM~1\AppData\Local\Temp`. `existsCaseInsensitive` matches each component
    against `readdir`, and `readdir` never lists the 8.3 alias `AARONM~1`.
  - PR #156 (`ac4d19b`, v0.44.2) fixed exactly this: `paths.ts` accepts a segment that resolves but is not listed.
  - `ac4d19b` is **not** an ancestor of `9e2dd5d` (exit 1). A8 sits on A7, which predates it.
  - **Control:** the same file exits 1 in the A7 archive and in the A8 archive, and exits 0 in the QA tree
    (`60334bf`, which carries #156).
- The worktree's HEAD after the suite: `9e2dd5d`; 0 porcelain entries.

**The processes on this PC** (`tasklist /V`, just before and just after; the CSVs are in `C:/qa99/suite/`):
- 167 processes before and 164 after.
- The only claude, node or shell processes, before and after: this session's `claude.exe` (PID 12212), 3 × `sshd`,
  2 × `powershell` (the driver), 4 × `bash` (this seat's shells), 3 × `conhost` and 12 × `msedgewebview2`. There was
  **no other `node.exe`** either time.
- What changed between the two lists: transient `svchost`, `WmiPrvSE`, `SearchProtocolHost`/`SearchFilterHost`, and
  `tasklist` and `bash` themselves.
- **Defender (`MsMpEng.exe`) had 2 h 16 min of CPU time**, the most after Idle. It scans the files the tests create.
  I did not measure what it cost the suite.

### 5.2 CI

- **The candidate's exact head:** `36083648742` on `9e2dd5d`, success, re-read per test by this seat: 1158 passed,
  6 skipped. `36083152202` on `270e601`: the same.
- **The developer's redcheck** `36083149768` (`e644c96`): 4 failed, exactly the four the handoff names: the
  candidate's R68, R69 (single name), R70 and R71. The two-name R69 row was `✓`.
- **The developer's four mutant runs,** each re-read per test: each failed exactly one test, the one it claims (§4).
- **This seat's six runs** are in §3.2. Budget: **6 of 8 used**; none failed to start.

## 6. `/sync --check` and plain `sync` (CA-12)

- **`gitnexus` is not available on this PC.** It is not on `PATH`, there is no `.gitnexus/` in the tree, and
  `npx --no-install gitnexus --version` answers "npx canceled due to missing packages". The dispatch forbids
  installing global tools. **So `/sync --check` after `gitnexus analyze`, as CA-12 asks, is UNRUN.**
- **In a scratch clone** (`plainsync8.sh`): `git clone --no-hardlinks` of the QA repository, detached at `9e2dd5d`,
  `npm ci` exit 0, build exit 0.
  - `sync --check`: **exit 1**, "23 passed, 0 fixed, 2 warnings, 3 issues, 2 skipped".
    - The issues are `prd-version`, `summary-version` and `retirements`, the same three as reports A to A7.
    - Their inputs are byte-identical between `d223d1d` and `9e2dd5d`: `git diff --quiet … -- .agents package.json
      open-brain/package.json CHANGELOG.md README.md` exits 0. **Control:** `open-brain/src/harness` differs, exit 1.
    - The skips: `gitnexus-index` ("no .gitnexus/ in this tree … this is not a pass") and `ci-status` ("gh is not
      authenticated" inside the clone's run).
    - The warnings: `obsidian-vault` (no vault on this PC) and `spec-provenance`.
    - `build-freshness` passed: "build matches HEAD 9e2dd5d".
  - **Plain `sync`: exit 0**, "23 passed, **2 fixed**, 2 warnings, **1 issues**, 2 skipped". It rewrote five tracked
    `.agents` files in the clone.
  - **The QA tree was never written:** its only porcelain entry is this report, untracked.

## 7. What could not be verified, stated so nobody inherits it as settled

1. **`/sync --check` after `gitnexus analyze`**: unrun. `gitnexus` is not here (§6).
2. **The real-`claude` rows skip on this PC:** "2.5 CONTROL: the real claude launcher resolves" and "CA-9: every flag
   … exists in the installed `claude --help`". The test looks where npm installs claude. Here it is at
   `~/.local/bin/claude.exe`. Neither row ran, locally or on CI.
3. **The writer behind §4's one `stage-changed-config` sighting,** and report A7 §3.5's: neither identified.
4. **A8-2 on win32.** I could not make a file unreadable but writable here. A deny-read ACE and a write-only grant
   both still let Node read the file, so this session probably runs with rights that bypass a file's DACL. That is an
   inference. So "unreadable" is measured on Linux only, and so are UNREAD-BASE and R71-UNREADABLE-*.
5. **The renamed-appearance edge is win32-only.** On Linux, a differently named file never resolves at the watched name
   without a symlink, which is a separate guard.
6. **The mutant cut:** the specs not run locally are M-L1, M-L2-order (and +M-L1), M-R18 (and M-L2+M-R18), M-R15,
   M-backstop, M-endstate, M-follow-b/-c, M-R44, M-R45 (and -record, -mkdir), M-R46-root, M-R49-repo+M-R43-repo,
   M-R50+agrees(-v2), M-R51-refuse-cmd, M-2.5-accept-cmd, M-R55-route, M-R59-revert, M-R59-never, M-dev-rest,
   M-dev-unwatched, M-dev-revert and M-dev7-trade. A8 touches none of the code they edit except `configwatch.ts`'s
   machine side, and their rows ran unmutated and pass. Their last kills are A6's and A7's.
7. **CA-5's second git version is barely a second one:** `2.55.0.windows.5` here and 2.55.0 on CI. The old pairing was
   2.54 and 2.55.
8. **The declared unrunnables U1–U6** (criteria §3), **M-R22**, and **CA-9's real run** (candidate A's, attributed).
9. **tcm:** no run in this report used it.

## 8. What the checks I ran cannot see

- **One win32 machine, and CI's Linux** (hosted, git 2.55). The local mutants ran on win32 only, where the POSIX tests
  skip. The Linux mutants are this seat's four and the developer's four.
- **Stub roles and unit windows, one act each.** The edges in §3.1 are the ones the dispatch named and those I found by
  reading `observe()`'s conditions. Shapes neither the reading nor the probes reached may exist.
- **Timestamp granularity.** On NTFS here, a write in the same timer tick as the previous one leaves `mtimeNs`
  unchanged (measured: two writes 15 ms apart share an mtime; 1.5 s apart they do not). R64 names the size-and-mtime
  limit; this is its practical width on this PC.
- **Traceless reads.** The seam catches opens made by this implementation's `openSync`, not by any other API.

## 9. Defects, each with the observation that produced it

| # | Severity | Defect | Observation |
|---|---|---|---|
| **A8-1** | **medium** (CA-15 clause 4; R68 "in its stage record"; R65) | R68's facts are printed only in `not read: base …; current …`, the text of a change. The stable unread entry (`not read: <reason>`, `unreadable`), the handle text, the at-path type change and `absent → symlink` carry none | R68-STABLE-UNREAD (`not read: different file`, both sides), R68-NOT-A-FILE, R68-UNREADABLE-STABLE, R70-HANDLE-FACTS: win32 and Linux `36086115526`. Code `configwatch.ts:1116–1122`, `:1128`, `:1136–1140` |
| **A8-2** | **medium** (CA-4f never silent; CA-11; R64 machine side) | An in-place write to an unreadable machine path is compared (`sameId` differs) but written `unreadable → unreadable`, and `runtime.ts:1064` drops `before === after`. No line; the loop completes | WRITEONLY-LATER (size 24 → 59) and R68-UNREADABLE-LATER (23 → 47), Linux `36086115526`; red at A7 too. **M-R71-unreadable and M-R71-before heal both** (`36087328580`, `36087322689`). Code `:1095`, `:1139–1140` |
| **A8-3** | low (CA-15 clause 4, R71's true texts) | The change text labels the stage start's facts `base`; neither side carries `type` | R71-BASE-LABEL: base ino `4503599627481496`, printed `5629499534324121`. R68-TWO-NAME-LATER-FACTS: no `type` in `after`. Code `:1143` |
| **A8-4** | low (rulings-15 R71 "each gets a test and a mutant"; R66) | R71's A6-4/A6-5 halves have no candidate test (mut-record reverts A7-4 only); no candidate test separates `size` from `mtimeNs` | M-R71-unreadable: 0 candidate kills on Linux. M-R68-mtime: 0 candidate kills. M-R68-size: 1 candidate kill in one run of two (timing) |
| A8-5 | cosmetic | the R70 comment line is duplicated | `configwatch.ts:1011–1012` |
| A7-5 | probe (carried) | QA 92's STOW-LOOP and the probe15 counters count one finding per path | unchanged from A7 |
| D-A2-7, D-A5 | carried | — | — |

## 10. Regressions: previously validated behaviour confirmed still working

- **Unmutated rows:** 202 passed on win32; the 8 failures are this seat's and earlier seats' probes. CI on the head
  (`36083648742`): 1158 passed. The full suite: 1135 passed; its one failure is the PC's (§5.1).
- **A4-1 H, J and LOOP stay unread** (Linux; `inRecord: false`).
- **D-042's trade holds both ways** (§3.4).
- **A6-1** (GITCONFIG-LOOP, HARDLINK-SAME, R61-LOOP) **and A6-2** (EXISTBETWEEN, EXISTBETWEEN2 `ok`) stay closed.
- **A7's closed rows stay closed:** R29 via the seam (the candidate's R66 R29 `✓` on CI; M-R29-both kills 19 locally),
  the handle re-check (M-handle-narrow), R50 (M-dev7-r50), TRADE-DIFF's identities (QA 94's TRADE-DIFF `✓`).
- **The 31 win32 loop probes:** every victim, token and "in record" field is identical to A7. **probe2, r57, r59 and
  r62** are identical apart from R71's added facts.
- **Every carried mutant that was run** kills at A8 at least what it killed at A7 (§4).
- **Regressions:** none found in behaviour A7 had right. HANDLE-NLINK-BASE's refusal is new, and it is in the
  fail-safe direction (§11.1).

## 11. Where the criteria, the rulings and the candidate disagree (returned, not scored)

1. **R70 refuses the BASE object when it gains a second name inside `open`.**
   - R70 re-checks "`nlink` (R67's single-name condition)" on the handle. For the base file, R67 says "`nlink` no
     longer counts".
   - A8 compares the handle's `nlink` with the pre-open `stat`, whatever route admitted the file. So QA 96's
     HANDLE-NLINK-BASE (the base file, `link()`ed inside `open`) is refused, `handle is a different file; not read`,
     on win32 and Linux. Under M-R70-nlink it is read again.
   - It is fail-safe, and it only happens inside the race window. But it narrows D-042's "a hard link made elsewhere
     does not stop reads", and its text says "different file" of the same file.
   - **Returned:** whether R70's `nlink` check is meant for the single-name route only.
2. **R69's parent condition compares a path, not a directory.** OBS-R69-PARENT-NEWDIR: `xdg/git` is renamed away and a
   NEW real directory is made at the same path (a different inode, `…9008 → …9009`); a config created in it is read.
   - That is R69's letter ("its parent directory's `realpath` equals the parent's `realpath` at base").
   - It is also D-042's reasoning: the place is the same, and the file has one name, created by the role.
   - Recorded so the next QA does not re-find it.
3. **R37's gap on the appeared route (GAP-OBJECT-MOVED):** the gated object, moved elsewhere inside `open`, is read at
   its new place. Rulings-15 says to record this and not score it; recorded in §3.1.
4. **R65-FACTS's premise is gone.** R69 reads the file that probe creates, so rulings-15's "that covers … R65-FACTS"
   can no longer be checked with it. I scored R68's record clause with R68-STABLE-UNREAD instead (A8-1).

## 12. This seat's error entries and near-misses this session

**Error entries (escaped):** none known.

**Near-misses (caught in-process, not numbered):**
- **`cilog.sh`'s ANSI strip** printed `pass=0 fail=0` on the first three runs I read. The logs carry the codes as the
  two characters `^[` as well as ESC. A zero there is a comparator answering a different question. It was caught
  because the summary line in the same output said `1154 passed`. Fixed, and every run re-read.
- **`mkbranch8.sh` failed closed** on the first build: this PC has no git identity. I set it per command in the script
  and did not write `~/.gitconfig`. Nothing was pushed from the failed attempt.
- **`qa99-a8-probe.test.ts` changed while the mutant batch ran:** I added R69-FIFO-APPEAR (POSIX, skipped on win32)
  after the first mutant, and R68-SIZE-ONLY and R68-MTIME-ONLY after the tenth.
  - Kills are computed by test name against BASELINE, and the final BASELINE (03:47Z) carries every test with the same
    8 failures as the first. So an earlier mutant simply lacks the new rows; it gains no false kill.
  - M-R68-size and M-R68-mtime, the two the new rows are for, were re-run with them.
- **My first reading of M-R68-size (0 kills)** would have called `size` untested. The re-run with a deterministic probe
  shows the candidate's own R68 test catches it only when the append falls inside one mtime tick (A8-4).
- **The mutant kills under M-dev8-appear include four seam probes** whose plant (`seam.fired === 1`) needs the file to
  be opened. Those reds are plant failures, not protection evidence, and §4 says so.

## 13. Reproduction

The scripts are tracked at **`docs/loops/qa-scripts-a8/`** on this seat's report branch, byte-identical to the copies
that ran, with a README. The earlier seats' sets are reused where the README says.

| Branch (pushed with `push-qa.mjs`, read back) | Head | What |
|---|---|---|
| `qa/loop-15-slice-3-a8-probe` | `dcfa98d` | A8 + QA 89, 92 v3, 94 × 2, 96 × 3, 99 × 2 |
| `qa/loop-15-slice-3-a8-probe-on-a7` | `d549dce` | the same files on A7 |
| `qa/loop-15-slice-3-a8-m-r69-symlink-both` | `b0335bf` | probe set + M-R69-symlink-both |
| `qa/loop-15-slice-3-a8-m-r69-parent` | `f53532d` | probe set + M-R69-parent |
| `qa/loop-15-slice-3-a8-m-r71-before` | `2b9e189` | probe set + M-R71-before |
| `qa/loop-15-slice-3-a8-m-r71-unreadable` | `c016dbc` | probe set + M-R71-unreadable |
| `qa/loop-15-slice-3-a8-report` | this commit | this report and `docs/loops/qa-scripts-a8/` |

**A8-2 in five lines (unit, Linux, not root):**
1. `~/.gitconfig` exists and is read at base.
2. In the developer stage it is `chmod 0200`.
3. In the qa stage the role appends to it.
4. The qa entry is `unreadable → unreadable`, although its size moved.
5. `runLoop` writes no line for it.

**A8-1 in three lines:** make `~/.gitconfig` a file with two names in one stage; touch nothing in the next. The next
stage's record is `not read: different file` on both sides, with no ino, size or mtime.

## 14. Handoff to the next QA session (D-035)

1. **Known positives.**
   - **A8-1:** A8 `9e2dd5d`, and A7 and A6, by R68-STABLE-UNREAD, R68-NOT-A-FILE, R68-UNREADABLE-STABLE and
     R70-HANDLE-FACTS.
   - **A8-2:** A8 and A7 by WRITEONLY-LATER and R68-UNREADABLE-LATER (Linux). **M-R71-unreadable is a known negative
     for A8-2's shape:** it prints facts on one side, and the change is reported.
   - **A8-3:** A8 by R71-BASE-LABEL.
2. **Obsolete probe assertions, now also including QA 96's R65-FACTS** (R69 reads its file), besides report A7 §14
   item 2's list: QA 89's A4-1 R, QA 94's TRADE-SAME and NO-SEAM, and QA 92's STOW-LOOP. QA 96's **HANDLE-NLINK-BASE**
   is red at A8 by R70's reading (§11.1); keep it until the planner rules.
3. **At A7 the R69 edge probes pass trivially.** Only their mutants (§3.1) show they can fail. Rerun the mutants on any
   candidate that touches `observe()`.
4. **This PC can make symlinks and junctions,** so POSIX-looking symlink shapes can run locally. It cannot make an
   unreadable file, and its temp path is an 8.3 alias. Any path test needs PR #156's code.
5. **Keep the seams** (`qa94-handle`, `qa96-seam`, `qa99-seam`, the candidate's own).
6. **Plain `sync` only in a scratch clone.** `gitnexus` is not on this PC.
7. **Nothing is pushed except this seat's own branches, through `push-qa.mjs`; the merge is Aaron's.**

## 15. Open for the planner

Each item is what I would have asked, and what I did instead. None of them blocked the rest of the work.

1. **Does R68 cover an UNREADABLE path (WRITEONLY-LATER)?**
   - Rulings-15 says R68 covers ABSENT-BASE-LOOP, TWO-NAME-LATER and R65-FACTS, and does not name WRITEONLY-LATER.
     Report A7 listed it as A7-1's third trigger.
   - R68's general sentence covers any "unread machine path", and R65 counts `unreadable` as not read.
   - **I scored A8-2 as a CA-4f, CA-11 and R64 failure under that sentence.** If the omission was deliberate, A8-2
     becomes a returned limit, and A8 then fails on A8-1 alone.
2. **Is "in its stage record" meant literally for records that do not change (A8-1)?** I read it literally, as R65
   does ("every watched path, in every stage's record … not read, with the reason and the R64 facts"). If only a
   change must carry facts, A8-1 falls to low.
3. **R70 and the base object (§11.1):** is the handle's `nlink` check meant for the single-name route only?
   HANDLE-NLINK-BASE is red at A8 either way. I did not score it.
4. **"A renamed appearance (a different name in the same place)"** (dispatch item 3). I read it as a file whose name on
   disk differs from the watched name while still resolving there, which on win32 means a case variant (`.GITCONFIG`).
   A file written under another name and renamed onto `.gitconfig` is git's own lock-and-rename, and it is read
   (OBS-R69-RENAMED-INTO-PLACE). If a different shape was meant, it is not measured here.
5. **CA-12 on this PC:**
   - The suite's one failure is PR #156's 8.3-alias case, which A8 lacks because it sits on A7. I recorded CA-12 as
     "not met as measured" and attributed the failure.
   - `/sync --check` after `gitnexus analyze` is unrun, because `gitnexus` is not here and the dispatch forbids
     installing it.
   - **Recommendation:** measure the suite of the next candidate on a base that carries #156, or rebase it; and
     decide whether this PC should carry `gitnexus` (an install for the planner or Forge, not for QA).
6. **The two real-`claude` rows skip here** (§7.2). If CA-9's pin should be re-measured on this PC, the test needs to
   find `~/.local/bin/claude.exe`, or claude needs an npm-global install. Both are outside QA's authority.

**Dispatch items, each done or written up:** 1 set-up (§0, §1); 2 every row re-run (§2); 3 R69's edges (§3.1); 4 R70's
own mutant (§3.3); 5 R68 and R71 on both sides (§2, A8-1 to A8-3); 6 regressions (§3.4, §10); 7 one mutant per
protection, and the developer's four checked (§4); 8 the full suite once, with processes (§5.1); 9 plain `sync` in a
scratch clone, and `/sync --check` unrun because `gitnexus` is absent (§6). CI: 6 of 8 runs. No `/end` (T-163).

QA-99: REPORT COMPLETE
