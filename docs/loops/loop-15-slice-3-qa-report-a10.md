# Loop 15 slice three — QA report A10: candidate A10 `4b7a5ae`: REJECTED

**By:** the QA seat, record session **108** (the dispatch assigned it) · **Date:** 2026-09-25 (UTC).
**Where:** the QA PC `desktop-o4egb1e` (D-045), in `C:\Users\Aaron Melven\Worktrees\sia-qa`, launched headless by
`docs/loops/qa-108/drive.ps1`. Nobody watched the run and the planner could not be reached. Every question I would have
asked is in **§15, Open for the planner**, with what I did instead.
**Model and effort:** the driver launched `--model claude-opus-5-5 --effort high`, and the transcript agrees (§0.1).

**Dispatch:** `docs/loops/loop-15-slice-3-dispatch-qa-a10.md` at `f4b1723`, the QA tree's HEAD (`drive.meta`
`head=f4b17237…`). `origin/docs/session-100-qa99-dispatch` moved to `7f0ea7b` during the run; I did not score against it.
**Rulings:** **rulings-17** (R77–R80; blob `b90bd0c8`) and **rulings-18** (R77 in eight readings, R81, R82 and its two
precisions; blob `ce7c3c3c`). Each blob in the QA tree equals `origin/master`'s. Criteria
`docs/loops/loop-15-slice-3-qa-criteria-a.md`: blob `1551f364`, the same at `6672e83`, A9 and A10.
**Predecessor:** QA 104's report on `origin/qa/loop-15-slice-3-a9-report` (`e80acd4`): verdict, §9, §11, §13 read in
full, and the whole report as this report's structure.

**Candidate (frozen):** **`4b7a5aebd9a17b0ce8e6ee99545f4f8f5784c90f`** on `origin/loop/15-slice-3-candidate-a10`
(`4b7a5ae…` in the driver's `refs-before.txt`, 23:01Z, and by `ls-remote` at 00:31:41Z). Product tree `ecf1f62`; `4b7a5ae` adds only the handoff.
Built by Grok 4.7 in Cursor, developer record 107. I read the handoff at `4b7a5ae` in full.

**Known positives:** A9 `6bd97f2` (archive copy, win32); the intermediate commits `d14a874` and `3771d53` (archive
copies, win32) for the chmod of the old path; the developer's redcheck and `mut-*` branches, each re-read on CI and
rebuilt locally on A10 (§4, §5.2). **Known negative:** QA 104's `FIX-before-facts` (§3.3), and this seat's own FIX
builds (§4).
**Scored on:** win32 (Windows 10 Pro 19045), git `2.55.0.windows.5`, Node v22.23.3. Symlinks (file and directory),
junctions and hard links can be made here without a prompt; a file or directory cannot be made unreadable to this
session. **Temps (T-190):** probes and mutants ran with `TEMP`=`TMP`=`C:\qa-tmp`; the one full suite ran with the
driver's default temp (§5.1). `drive.meta` lists **`C:\qa-scratch` and `C:\qa-tmp` as Defender exclusions**.
**Linux:** CI on this seat's own `qa/loop-15-slice-3-a10-*` branches, **all on tcm** (`Machine name: 'tcm'`, runners
`tcm-1` and `tcm-2`, git 2.43.0). **8 of the 10 allowed runs used** (§5.2).

---

## Verdict: REJECTED. A10 builds R77's containment, the stop before git, R78, R80's words and R82's ENOENT precision, and every earlier fix holds. But identify's contained failure is read as ABSENT by the code that consumes it, so a hook planted in a hooks directory that lists but cannot be searched passes a COMPLETED loop, and a user's existing hook is DELETED by the restore. R82's stop covers only a stage start that was read, and three placeholders still stand alone

**What A10 fixed, measured against the named known positives:**

| Item | At A9 | At A10 | Evidence |
|---|---|---|---|
| **A9-1** (an unreadable tree ends the window before any restore) | `runtime-error`; `.git/config` not restored | **closed** | QA 104's probe3, byte-identical in the tree: `✓` on tcm (`36200429242`). `.git/config` restored, `stage-changed-config`, no exception, the planted program never ran in the runtime. Mine: LISTTREE-SUBDIR, LISTTREE-EXECONLY (Linux), 0 git calls after the role |
| **A9-2** (an `lstat` failure throws) | throws | **closed** | QA 104's probe2 `✓` (`36200429242`); the developer's R77-IDENTIFY, OBSERVE-BEGIN, OBSERVE-COMPARE `✓` |
| **A9-3** (read records carry no facts) | hash alone | **closed** | R73-READ-STABLE-FACTS, -CHANGE-FACTS `✓` win32 and Linux; the side is `<hash> type file dev … ino … nlink … size … mtimeNs …`; `dev-r78-hash` kills both candidate R78 rows on win32 too |
| **A9-4** (the bare placeholder, four shapes) | bare `unreadable` / `absent` | **closed as QA 104 measured it** | R72-BEFORE-BARE-READ/-TWONAME/-LINK, R72-BEFORE-ABSENT-DANGLING `✓` (Linux). The developer's three BARE rows also pass on QA 104's independent `FIX-before-facts` (`36201543890`), so they test the rule, not A10's wording. **But the same class is open in three other shapes**: A10-3 and A10-4 (new in A10's code) and A10-5 (older) |
| **A9-5** (R74's words) | "different file"; `base` | **closed** | R74-GAINED-BASE/-NEW, R74-LOST-NAME, R74-LABELS `✓` win32 and Linux (QA 104's seam and the candidate's R80 rows) |
| **A9-6** (a dangling link's facts; `absent` without a code; zeroed base) | missing | **closed as QA 104 measured it** | R73-DANGLING-STABLE, R73-ABSENT-BEFORE-CODE `✓`; `absent at loop base`. Zeroed facts remain on the CURRENT side of an ancestor-link text (A10-5, present at A9 too) |
| **A9-7** (R72's runtime line; the link-text facts) | no killing test | **partly** | the candidate's R80 fact rows kill both link mutants. **R72's runtime call site still has no killing test** (A10-7) |
| **A9-8** (cosmetic) | present | **closed** | the always-true comparison is gone; the unread note reads `snapshot was file; unread, not restored` (Linux, QA 104's R72-REPO-UNREADABLE-AT-START) |
| **R77.4, the stop before git** | none | **built and holds** | a spawnSync spy counts git subprocesses after the role returns: **0** in every stop shape (Q108-STOP-*, LISTTREE-*, IDENTIFY-NOSEARCH-KEEP, BOTH), win32 and Linux; mutant `dev-d-stop` kills my two win32 stop rows (the candidate's stop rows are POSIX-only) |
| **The OLD path** (rulings-18's "hardest to see") | — | **holds** | 7 hard-link and symlink shapes of mine: the outside file untouched on win32 and Linux. The known positives see them: HARDLINK-CONFIG-RO is **red at `d14a874` and at `3771d53`** (win32: the outside file's mode `444 → 666` through a hard link, past the `kind === "file"` guard), and my `q108-oldpath-chmod-any` on tcm (`36201159506`) reddens 5 of the 7 plus the candidate's R58 (b)3 and R77-MODE000-HARDLINK and QA 89's B3 |
| **R82 on win32** | — | **holds for ENOENT** | the developer's R35 junction row and R82-ENOENT-IS-ABSENT `✓` here; my four win32 shapes (junction to an empty dir, dangling junction, HOME renamed, a file where the XDG dir was) are never `machine-config-unobservable` |

**Why it is rejected.**

**A10-1 (high): R77 reading 5 is built in `identify()` and undone by its callers. A contained `lstat` failure is
turned into `null`, which the window reads as ABSENT. Three measured consequences, all on tcm.**
- `identify()` returns `kind: "other"` with the code (`configwatch.ts:137`). Then:
  - `readState()` returns `null` for any kind that is not `file` (`:463`);
  - `readForCompare()`'s resolution-diff branch does the same (`:703`); the resolution chain itself differs, because
    `resolutionComp()` records kind `other` and drops the code;
  - `begin()` stores `null` for such a path (`:683`, and through `readState`).
- **(a) A planted hook passes a completed loop** (Q108-IDENTIFY-NOSEARCH-PLANT, `36200429242`, tcm-1). Hooks empty at
  base; the developer writes `.git/hooks/post-checkout` (mode 755) and makes `.git/hooks` mode **0600** (it lists; its
  entries cannot be `lstat`ed: `EACCES`).
  - **`status: completed`, `failure: null`.** Every stage's verdict is `ok: true`, "no repository config or hook changed
    (examined 4 file(s) …)". The plant is counted and read as absent at both ends.
  - **29 git calls ran after the role returned.** The planted file is still in `.git/hooks` after the loop.
  - The runtime's own git calls carry `core.hooksPath=/dev/null`, and git cannot run a hook it cannot reach, so the
    hook is dormant; it runs once someone gives the directory its search bit back. **Control** (same plant, hooks left
    searchable): caught, `stage-changed-config`, removed (win32 and Linux).
- **(b) A user's own hook is DELETED by the restore** (Q108-BEGIN-NOSEARCH-THEN-EDIT, `36201808930`, tcm-1). `.git/hooks`
  holds the user's `pre-commit` and git's 14 samples, and is **already mode 0600 when the loop starts** (the role did not
  cause it). The developer only restores the mode (`chmod 755`) and appends one line to `pre-commit`.
  - `begin` recorded every hook as absent. At close the record says **15 files `created (absent → identity:…; not read)`**,
    and the restore of a created file is `unlinkSync` (`:801`).
  - **After the loop `pre-commit` does not exist** (measured). The 14 samples take the same branch (the record and the
    code; not measured file by file). The loop fails `stage-changed-config` with no `unrestored` entry: the record says
    the restore succeeded.
  - This is the restore acting on a path from a false record: the user's hook, which existed at the loop base, is gone,
    and its bytes were never snapshotted.
- **(c) Existing hooks are recorded `deleted → absent` while they are there** (Q108-IDENTIFY-NOSEARCH-KEEP,
  `36200429242`). The role plants `core.fsmonitor` and makes hooks 0600. `q108-keep` and 14 samples: `kind: deleted`,
  `after: absent`; `keepStill: true`. Here the stage does stop before git (0 git calls), because the restore's write into
  the directory fails and the path goes to `unrestored`, and `.git/config` is put back.
- **Known negative:** `FIX-q108-all2` adds, at `:463` and `:703`, "kind `other` with a code is `unreadable (<code>)`, not
  `null`" (with three other edits for A10-2 to A10-4). On tcm it **heals (a), (b) and (c)** (`36201522977`,
  `36201813973`) and **reddens nothing**: 0 kills against `36200429242`. So the probes see exactly this conversion, and the
  fix is local.
- **Rows:** R77 ("a failed call is recorded against that path, with its error code, and is itself a finding that fails
  the stage"; reading 5, "a contained failure never reads as absent"); CA-15 clause 1 (a hook change fails the stage);
  CA-15 clause 4 (the record says what happened); rulings-18 R77.4 ("a remove is a new write").

**A10-2 (medium): R82's machine-side stop fires only when the stage start was READ. A path OBSERVED at the stage start
(absent, a directory, a two-name file) that cannot be observed at close is reported as an ordinary change, and the loop
continues.**
- `compare()` stops the stage only `if (opened.state === "read" && end.errno !== null)` (`:1246`); the runtime's reason
  says "readable at the stage start". Rulings-18 R82: "a path that was **observable** at the stage start and cannot be
  observed at close fails the stage"; turn 94: "a deliberate not-read … **is an observation** … never unobservable";
  turn 107: "ENOENT and ENOTDIR are absence … The runtime observed that nothing is there."
- **Measured on tcm** (`36200429242`):
  - Q108-R82-ABSENT-THEN-EACCES-LOOP: no XDG config at base (`absent (ENOENT)`, observed); the developer writes
    `$XDG_CONFIG_HOME/git/config` with a `core.fsmonitor` line and makes `$XDG_CONFIG_HOME` mode 000. The row is
    `absent (ENOENT) → unwatched: did not resolve: EACCES; not read`, `changed: true`, **no `unobservableCode`**; **the
    loop completes** (`status: completed`).
  - the same at unit level, and for a directory at `~/.gitconfig` (`not read: not a file`) and a two-name file (not read)
    each followed by HOME mode 000: no `unobservableCode` (Q108-R82-ABSENT-THEN-EACCES, -NOTAFILE-, -TWONAME-).
  - Control: a path already unreadable at the stage start stays `changed: false` with no code, as R82 says
    (Q108-R82-UNREADABLE-AT-START-CONTROL `✓`).
- The change is **reported**, not silent, so R72 holds; what fails is R82's "fails the stage".
- **Known negative:** widening the condition to "the stage start was observed" (`opened.errno === null` and not already
  unreadable) heals all four (`36201157136`), 0 kills.
- **Row:** rulings-18 R82 (machine side). If "observable" was meant as "read", this is not a defect (§15, question 2).

**A10-3 (medium): a stage start whose `lstat` failed prints the bare `before: "absent"`.** R77 reading 5 ("a contained
failure never reads as absent"); R79 ("absent carries the resolution error", "a placeholder … never pretends").
- `stageBefore()` ends `opened.reason.startsWith("absent (") ? opened.reason : "absent"` (`:1236`), so a stage start
  whose reason is `did not resolve: EACCES` becomes `absent`.
- **Measured** by QA 104's own R73-PARENT-EACCES (carried, `36200429242`): HOME mode 000 across the stage boundary. The
  developer stage's record for that moment says `unobservable (EACCES)`; the **qa stage's `before` for the same moment is
  `"absent"`**. At A9 the same probe was red because `compare()` threw (A9-2); A10's containment reaches this line.
- Known negative: naming the failure there heals it (`36201157136`), 0 kills.

**A10-4 (medium): R82's text `unobservable (<code>)` stands alone for a side that has facts.** R79: "A side is printed
with everything the runtime has for it. A placeholder is never alone."
- `after: \`unobservable (${end.errno})\`` (`:1249`) drops the facts `observe()` already has: `lstat` of the path
  succeeded in both measured shapes.
- **Measured:** a read `~/.gitconfig` made mode 000 → `after: "unobservable (EACCES)"` (Q108-R79-FILE000-ALONE, tcm; and in
  QA 89's R29 control, where lstat facts exist); a read `~/.gitconfig` replaced by a symlink loop → `after: "unobservable
  (ELOOP)"` although `lstat` saw the link (Q108-R79-ELOOP-ALONE, **win32 and tcm**).
- Known negative: appending the facts (or `linkSide` for a link) heals both (`36201157136`), 0 kills.
- I score it medium because A9-4, the same class, was medium. The stage does fail in both shapes, so nothing is
  accepted on the missing facts.

**Lower** (§9):
- **A10-5 (low, R79; present at A9 too):** an ANCESTOR-link text prints zeroed facts for its current side. `absent →
  symlink target …; not read through; type absent dev null ino null nlink 0 size 0 mtimeNs 0` and `… current unresolved
  type absent dev null ino null nlink 0 size 0 mtimeNs 0` (`:1281–1282`; Q108-R79-ANCESTOR-ZEROED and
  -TYPECHANGE-ZEROED, win32 and tcm; the same text at A9). The ENOENT is not named. R79 fixed the loop-base side
  (`baseText`) only.
- **A10-6 (low, dispatch item 4; R80's link facts):** when the link is an ANCESTOR (a junction or symlink replacing the
  XDG `git` directory), the type-change text carries the resolved file's facts but **not the link's `lstat` facts**
  (Q108-R80-ANCESTOR-JUNCTION-TEXT: the junction's ino absent from the text). The handoff says so ("a watched file inside
  a junctioned directory … keeps the previous wording"). For a link AT the path, both are present and labelled (R80 rows
  and mine, win32 and tcm). §15, question 3.
- **A10-7 (low, R80's R72 clause):** R72's runtime decision, at its call site, still has no killing test. The
  candidate extracted `machineChangeReported(f)` (`runtime.ts:1632`) and R72-EQUAL-TEXT calls that helper directly.
  QA 104's M-R72-runtime re-cut on A10 (`q108-r72-callsite`: `if (f.before === f.after) continue;` in place of the
  helper call at `:1079`) **kills nothing** in 381 rows (win32; the decision is platform-independent). The developer's
  `mut-r80-equal` edits the helper's body, and R72-EQUAL-TEXT kills that (win32 and tcm). The call-site mutant is
  equivalent at A10 (no changed finding has equal texts), so only a `runLoop`-level test with a constructed
  equal-text finding would see it; R80 asked for that at unit level "if no filesystem act produces it".
- **A10-8 (cosmetic):**
  - a FIFO put where `.git/config` was is recorded `deleted → absent` (it is restored; Q108-FIFO-CONFIG, tcm);
  - a stage failed only by an unlisted directory reads "0 repository config/hook file(s) changed during the developer
    stage: ." (LISTTREE-SUBDIR, -EXECONLY);
  - when a machine path is unobservable AND a repository directory is unlisted, the failure is
    `machine-config-unobservable` and its reason names only the machine path; the unlisted directory is in
    `configVerdicts` only (Q108-BOTH). No git call ran;
  - no test pins R80's new `unread, not restored` wording;
  - an absent loop base in the `not read` text reads "not read: loop base absent at loop base; current …"
    (`machineHardAbsent`, win32).

**Rulings the probes had to be read against (not scored as defects, §11):** R78–R82 changed texts that six carried QA
probes assert, and rulings-17/18 name none of them as obsolete (rulings-17's own containment rule). Each protection
still holds when re-read in the new form (§3.6).

**The full suite at `4b7a5ae`, with the default temp (the Defender-on control): `SUITE_EXIT=0`, 82 files passed and 2
skipped, 1153 passed, 57 skipped (1210), 0 unhandled** (§5.1). The total equals CI's (1210). **CA-12 is still not met as
measured** only because `/sync --check` after `gitnexus analyze` cannot run here (§6).

---

## 0. Rulings and authority in force

| Source | Where |
|---|---|
| Rulings-1 to 16 | master, as cited by the criteria and reports A3 to A9 |
| **Rulings-17 R77–R80** and its assignment table | `origin/master:docs/loops/loop-15-slice-3-rulings-17.md` (blob `b90bd0c8`) |
| **Rulings-18** (R77 readings 1–8, R81, R82 with turn 94's and turn 107's precisions) | `origin/master` (blob `ce7c3c3c`, last change `08e547d`). Made in the hub during the build; binds |
| The dispatch | `loop-15-slice-3-dispatch-qa-a10.md` at `f4b1723` |
| **CI on this seat's own branches** | D-040, within the dispatch's cap of 10 runs, on tcm; 8 used (§5.2) |
| **Pushing** | only `qa/loop-15-slice-3-a10-*`, only through `node docs/loops/qa-108/push-qa.mjs <branch>`; every push read back by the script |
| **Temps** | T-190: `C:\qa-tmp` for probes and mutants; the default temp for the one suite (§5.1) |

### 0.1 Model and effort

- **The session's init line** (`%USERPROFILE%/sia-qa108/run-0.jsonl`, parsed as JSON by `effort10.mjs`):
  `model: "claude-opus-5-5"`, session `b3175f89-7101-44c3-bbd0-74c0957e1b11`, `permissionMode: "dontAsk"`, Claude Code
  `2.1.282`. The init line has no effort field; it carries `per_turn_effort_active`.
- **The host transcript** (`~/.claude/projects/C--Users-Aaron-Melven-Worktrees-sia-qa/b3175f89-….jsonl`, parsed as
  JSON): every assistant entry carries `model: "claude-opus-5-5"`, `effort: "high"` and `perTurnEffort: "high"`. The
  count and time span, read after the last measurement and before the report was committed: **467 of 467 entries,
  23:01:06Z → 00:35:00Z**. That span covers every measurement, mutant, CI dispatch, the suite and the sync clone. The
  turns after it (writing the report, the commit and the push) are not in the count.
- **So the transcript agrees with the driver's `--model claude-opus-5-5 --effort high`.**

## 1. Frozen-candidate conditions

| Condition | Observation | Result |
|---|---|---|
| built on A9 | `6bd97f2` is an ancestor of `4b7a5ae` (exit 0); so is master's `9bc06e3` | held |
| **no merge of master needed** | `git diff --name-only 9bc06e3 origin/master`: 37 paths, **0 outside `docs/` and `.agents/`** (the planner's check, repeated) | as the dispatch says |
| linear | every commit in `6bd97f2..4b7a5ae` has one parent | held |
| **the commit table** | I ran `git diff --stat` on each of the 28 commits. **The dispatch's table matches every one**, including `d14a874` adding and `c923550` removing the old-path chmod, and `e6a3fd4` touching `configwatch-a7-seam.test.ts` | matches |
| A10's whole diff | `6bd97f2..4b7a5ae` (`--numstat`): `configwatch.ts` +178 −50, `runtime.ts` +48 −1, `configwatch-a7-seam.test.ts` +2 −2, `configwatch-links.test.ts` +6 −4, six new test files (r77-contain, r77-hardlink, r78-read-facts, r79-sides, r80-report, r80-texts), QA 104's probe2 and probe3 (added), the handoff (+220). Nothing else | as the table says |
| **QA 104's probes in the tree** | `qa104-a9-probe2.test.ts` blob `14b8fa47`, `qa104-a9-probe3.test.ts` blob `6f11b34b` in `4b7a5ae`; `git hash-object` of QA 104's tracked copies (`e80acd4:docs/loops/qa-scripts-a9/`) gives the same two blobs | **byte-identical** |
| **tree moved** | the candidate branch is `4b7a5ae…` in `refs-before.txt` (23:01Z) and by `ls-remote` at 00:31:41Z | **not moved** |
| **QA tree** | detached at `f4b1723` throughout. At the start its only porcelain entries were QA 99's and QA 104's reports and QA 99's scripts, untracked copies the driver's copier placed (`drive.meta` `porcelain_lines=3`; both reports are byte-identical to their branch blobs, `34bd5084` and `10fef9b3`). The candidate was examined in archive copies (`C:/qa-scratch/qa108/arch/`), a worktree (`C:/qa-scratch/qa108/wt-a10`) and a clone (`C:/qa-scratch/qa108/syncclone`). CI commits were built with a temporary index | **clean** |
| build | `npm ci`, `npm run build` and `npx tsc --noEmit -p .` exit 0 in the worktree (23:02Z); 0 porcelain entries after | current |
| **CA-13**, no version bump | `git diff 9bc06e3 4b7a5ae -- package.json open-brain/package.json CHANGELOG.md`: **empty** (exit 0) | **pass** |
| the candidate's own CI | `36198950992` on `4b7a5ae` itself (tcm-2): 1 failed (CA-9) \| 1204 passed \| 5 skipped (1210) | as the handoff says |

### 1.1 The dispatch's flag: `e6a3fd4` and `configwatch-a7-seam.test.ts`

- **The edit** (R70's row, "a second name gained inside open is not read"): `toContain("handle is a different file")` and
  `toContain("gained a name inside open")` became `toContain("the object gained a name inside open")` and
  `not.toContain("different file")`. The row's other assertions are unchanged: the seam fired once, `nlink` 2 on the
  handle, **the body's hash is not in the text** (so the file was not read), and the inode is in the text.
- **It is on the handoff's list.** The handoff's "Existing assertions that changed" table has the row "R70,
  `configwatch-a7-seam.test.ts`", with the old and new assertions and R80 as the ruling. The dispatch reads that list as
  not naming the file; it names it as R70.
- **Does it narrow a protection? No.** The protection is "not read" (the hash assertion, unchanged). The text assertion
  is stricter than before: the full R80 phrase, and "different file" forbidden. **Measured:** `mut-r80-gained` (the old
  words back) kills it on tcm (`36197666218`, re-read) and locally (§4); the row passes at A10 on win32 and tcm.

## 2. Rows

**"Cand. rows"** means the row files run unmutated on win32 in the A10 archive copy with the JSON reporter (BASELINE,
23:24:59–23:27:12Z):
- the candidate's config row files (`config-channel`, `configwatch-links`, `-a7-seam`, `-r77-contain`, `-r77-hardlink`,
  `-r78-read-facts`, `-r79-sides`, `-r80-report`, `-r80-texts`), `process-role`, `spawn-sites`, `refwatch-stage`,
  `runtime`, QA 104's probe2 and probe3, every carried QA 89–104 probe, and this seat's `qa108-a10-probe.test.ts` and
  `qa108-r61-copy.test.ts`;
- **381 tests: 255 passed, 116 skipped, 10 failed, 0 unhandled**;
- **all 10 failures are probes, none a candidate test:** this seat's R79-ANCESTOR-ZEROED, -TYPECHANGE-ZEROED and
  R79-ELOOP-ALONE (A10-4, A10-5); four carried assertions R78–R80 made obsolete in form (QA 99's R69-GITCONFIG-FIRST,
  R70-HANDLE-FACTS and R71-BASE-LABEL, QA 96's TRADE-LOCKRENAME; §3.6); and three obsolete since A8/A9 (QA 94's NO-SEAM
  CONTROL, QA 96's R65-FACTS and HANDLE-NLINK-BASE);
- the skips are `skipIf(win32)` rows (read from tcm, never from a skip) and the real-`claude` rows.

**Rulings-17 and rulings-18, scored:**

| Ruling | A10 must | Observed | Verdict |
|---|---|---|---|
| **R77** (the class; readings 1–8) | the window always completes; every failed call recorded against its path with its code, failing the stage; never `runtime-error`; unlisted directories named; any unrestored path stops before git | completes in every shape I made (no exception, no `runtime-error`, win32 and tcm). Unlisted named, contents unrestorable, begin refuses, close `ok` false, stop before git with 0 git calls (§3.1). **But a contained `lstat` failure is read as absent by `readState`, `readForCompare` and `begin`** (A10-1): a plant passes a completed loop; a user's hook is deleted | **FAIL** (A10-1) |
| R77 reading 2 (`readState` contains every code) | every code contained | `EIO` (the developer's) and **`ERR_FS_FILE_TOO_LARGE`** (mine, a 3 GiB sparse `.git/config`): recorded `unreadable (<code>)`, restored, `stage-changed-config` (win32 and tcm) | **pass** |
| R77 reading 4 (stop before git; no `rmdir` where a file was) | any unrestored path or unlisted directory ends the stage before git | 0 git calls after the role in 7 stop shapes (STOP-DOTGIT-RO, -CONFIG-NONEMPTY-DIR, -HOOK-DIR, LISTTREE-SUBDIR, -EXECONLY, IDENTIFY-NOSEARCH-KEEP, BOTH); a non-empty directory where `.git/config` was is left in place | **pass** |
| R77 reading 5 (never absent) | `identify` returns `other` with its code; never "absent" | `identify` does (`:137`); its callers do not (A10-1); the machine side's `before` does not (A10-3) | **FAIL** (A10-1, A10-3) |
| **The OLD path** | a restore never acts on the old path | 7 shapes of mine, win32 and tcm: untouched. HARDLINK-CONFIG-RO red at `d14a874` and `3771d53`; 5 of the 7 red under d14a874's chmod put back on A10 (tcm) (§3.1) | **pass** |
| **R78** | a read side prints hash and facts, both sides | `<hash> type file dev … mtimeNs …` on every read side I printed; `dev-r78-hash` kills 5 on win32, both candidate R78 rows among them | **pass** |
| **R79** | a side prints everything the runtime has; a placeholder never alone, never pretends | the ruling's four named forms met (`unreadable; stage start …` in every combination; `absent (ENOENT)`; a dangling link's facts; `absent at loop base`). **Not met:** bare `absent` for an EACCES stage start (A10-3); bare `unobservable (<code>)` (A10-4); zeroed facts in ancestor-link texts (A10-5) | **FAIL** (A10-3, A10-4; A10-5 low) |
| **R80** | true handle words; `loop base`; R72's runtime test; link-text facts; the cosmetic two | met, except: R72's runtime call site has no killing test (A10-7), and ancestor-link texts carry no link facts (A10-6) | **pass**, with A10-6, A10-7 |
| **R82** | repository side: every contained failure fails the stage; machine side: observable at start and not at close fails, with a structured code; ENOENT/ENOTDIR absence; not-read is an observation | repository side: met where the failure reaches the record (A10-1 is where it does not). Code structured (`errno` from the catch; no scraping). ENOENT/ENOTDIR absence: met (win32 and tcm). **Machine stop limited to a READ stage start** (A10-2) | **FAIL** (A10-2) |
| R81 | B's Step 0 | not A10's; not scored | — |

**The rows rulings-17/18 touch, and the rest:**

| Row | Observed | Verdict |
|---|---|---|
| **CA-15 clause 1** (a hook or config change fails the stage) | **a hook planted in a hooks directory made 0600 passes a completed loop** (A10-1a). Every other shape I made fails `stage-changed-config` | **FAIL** (A10-1) |
| **CA-15 clause 3** (restore does not follow links) | the old-path shapes and every carried link row pass (§3.1, §3.6) | **pass** |
| **CA-15 clause 4, CA-14** (the record says what happened) | met for R78, R79's named forms, R80. **Not met:** `deleted → absent` and `created` for present files (A10-1), `before: absent` (A10-3), `unobservable` alone (A10-4), zeroed facts (A10-5) | **FAIL** (A10-1, A10-3, A10-4) |
| **CA-4a / CA-1's order** | the restore finishes before any git call in every shape; 0 git calls after the role where the stop fires. (What the restore sees is A10-1; the order holds) | **pass** |
| **CA-4f, CA-11** | machine changes reported in every shape, including A10-2's (the change is reported; only R82's stop is missing) | **pass** on the report; R82 in A10-2 |
| CA-1, CA-2.x, CA-3, CA-4b/c/d/e/g/h/i, CA-6, CA-7, CA-8, CA-10 | Cand. rows pass on win32; on tcm every candidate test `✓` except CA-9 in the runs on A10 code that carry no mutant (runs 1 and 7, and the three FIX runs, which redden nothing). A10 touches none of their code except `runtime.ts`'s window (the two new stops) and `configwatch.ts` | **pass** on the rows; the layer mutants were not re-run (§4's cut) |
| **CA-5** | tcm's CA-5 row prints "on this git (git version 2.43.0)" `✓`; win32 `2.55.0.windows.5` `✓` | **pass** |
| **CA-9** | red on every tcm run, including the candidate's own `36198950992` (T-182, attributed by the dispatch). **On this PC it passes** against Claude Code 2.1.282, put first on `PATH` for the one test (`ca9-10.sh`, exit 0) | attributed; passes here |
| **CA-12** | **full suite exit 0** (1153 passed, 57 skipped, 1210, the total CI reports; §5.1). Plain `sync` exit 0 in a scratch clone; `sync --check` exit 1 on one issue whose inputs are master's (§6). **`/sync --check` after `gitnexus analyze`: UNRUN** (no `gitnexus` here) | **not met as measured**, only for the `gitnexus` half |
| **CA-13** | empty against `9bc06e3` | **pass** |
| **R35** | the developer's R35 junction row `✓` on win32 (4.7 s); QA 89's R35 on Linux `✓`; mine (§3.2) | **pass** |

## 3. Detail

### 3.1 Dispatch item 2: R77 by class, a shape of my own per helper, and the old path

Every shape below is `qa108-a10-probe.test.ts` or `-probe2.test.ts`, run through `runLoop` unless it says "unit".
`gitAfterRole` is the number of git subprocesses a `spawnSync` spy saw start after the developer role returned; git.ts
starts every git call through `spawnSync`, and the spy's control (a normal restore) sees 6 or more.

| Helper | Shape (mine) | win32 | tcm (`36200429242`) |
|---|---|---|---|
| `identify` (`lstat`) | IDENTIFY-NOSEARCH-KEEP: plant `core.fsmonitor`, hooks 0600 | skip | `stage-changed-config`, 0 git calls, `.git/config` restored; **hooks recorded `deleted → absent` while present** (A10-1c) |
| `identify` | IDENTIFY-NOSEARCH-PLANT: empty hooks; plant `post-checkout`; hooks 0600 | skip | **completed loop; `ok: true` everywhere; 29 git calls** (A10-1a) |
| `identify` | …-PLANT-CONTROL: the same plant, hooks searchable | `stage-changed-config`, removed | same |
| `identify` via `begin` | BEGIN-NOSEARCH-THEN-EDIT (probe 2): hooks 0600 before the loop; the role restores the mode and edits `pre-commit` | skip | **15 files `created`; `pre-commit` deleted by the restore** (`36201808930`; A10-1b) |
| `listTree` (`readdir`) | LISTTREE-SUBDIR: a hooks subdirectory written into, then 0000 | skip | `unlisted: …/q108-sub (EACCES)`, the inner file `unrestorable: under unlisted`, no restore write, 0 git calls |
| `listTree` | LISTTREE-EXECONLY: `pre-commit` rewritten, hooks 0100 (a known name still `lstat`s, and git could exec it) | skip | `unlisted: …/hooks (EACCES)`, `pre-commit` unrestorable, the role's bytes left, 0 git calls |
| `readState` (read) | READSTATE-TOOLARGE: `.git/config` appended, then extended to 3 GiB | `unreadable (ERR_FS_FILE_TOO_LARGE); type file … size 3221225472 …`, restored by bytes, `stage-changed-config` | same |
| `readState` | READSTATE-TOOLARGE-AT-BEGIN (unit, observation): 3 GiB at the window's open, untouched | begin and close do not throw; `ok: true`, message ends "Read failures: unreadable (ERR_FS_FILE_TOO_LARGE)" | same |
| the stop before git | STOP-DOTGIT-RO: plant, then `.git` 0555, so nothing can be written back | skip | `stage-changed-config`, "Rollback was not performed", the reason names `.git/config` and the `EACCES` of the temp write; **0 git calls**; the plant stays (the tree is left for a human, R77.4) |
| the stop | STOP-CONFIG-NONEMPTY-DIR: `.git/config` replaced by a directory holding a file | `stage-changed-config`, 0 git calls, the directory left in place | same |
| the stop | STOP-HOOK-DIR: the developer's R77-UNRESTORED-HOOK shape, on every platform | `stage-changed-config`, 0 git calls | same |
| both sides | BOTH (observation): plant, hooks 000, HOME 000 | skip | `machine-config-unobservable`, `.git/config` restored, 0 git calls; the reason names only the machine path (A10-8) |

**The OLD path.** A restore writes a temporary file beside the entry and renames it over (`restoreNewFile`); the only
remaining acts on the entry itself are `removeLink` (a link), `unlinkSync` (a created file, or a failed rename's retry)
and the post-restore reads of the new file. `c923550` removed the last `chmodSync` of the old path. Mine:

| Shape | What the role leaves | A10, win32 | A10, tcm | Known positives |
|---|---|---|---|---|
| HARDLINK-CONFIG-RO | `.git/config` a hard link to an outside file, then read-only (on win32 the read-only bit is the outside file's) | outside mode, bytes and ino as the role left them; `.git/config` a new file with the original bytes | same | **red at `d14a874` and `3771d53`** (win32): outside mode `444 → 666` (the `kind === "file"` guard does not stop a hard link) |
| HARDLINK-CONFIG-000 | the same, mode 000 | skip | outside mode still 000; bytes unchanged | red under `q108-oldpath-chmod-any` (tcm) |
| HARDLINK-NEWHOOK | a NEW hook that is a hard link to an outside file | the link removed; outside file untouched | same | — (a created path is unlinked, never chmodded) |
| SYMLINK-CONFIG | `.git/config` a file symlink to a read-only outside file | outside untouched; a regular file with the original bytes | same | **red under `q108-oldpath-chmod-any` on tcm**; green at `d14a874` on win32, because win32 `chmod` does not follow a symlink (measured) |
| SYMLINK-CONFIG-DANGLING | `.git/config` a dangling symlink to an outside name | the outside name never created | same | — |
| SYMLINK-HOOK-DANGLING | a hook the same | never created; hook restored | same | — |
| DIRLINK-HOOK | a hook replaced by a directory link (a junction on win32) to an outside directory | the outside directory and its file untouched | same | red under `q108-oldpath-chmod-any` (tcm: the chmod reached the directory) |

On tcm, `q108-oldpath-chmod-any` (d14a874's chmod put back on A10, `36201159506`) also kills the candidate's **R58 (b)3**
and **R77-MODE000-HARDLINK** and QA 89's **B3 row shape**, and my STOP-CONFIG-NONEMPTY-DIR (the chmod reached the planted
directory). Locally (win32) `q108-oldpath-chmod-any` and `q108-oldpath-chmod-file` (3771d53's `kind === "file"` guard) each kill my HARDLINK-CONFIG-RO, and nothing symlink-shaped, as win32 `chmod` predicts.

### 3.2 Dispatch item 3: R82 on win32 (and on tcm)

| Shape | win32 | tcm | R82 |
|---|---|---|---|
| the developer's R35: a junction on the XDG config at base, and one planted later | `✓` (not refused; a type change) | skip (tcm cannot) | ENOENT is absence |
| the developer's R82-ENOENT-IS-ABSENT | `✓` | `✓` | — |
| Q108-R82-XDG-JUNCTION-EMPTY: the XDG `git` dir (read) replaced by a junction to an empty dir | no failure; a reported type change | same (a dir symlink) | met |
| Q108-R82-XDG-DANGLING-JUNCTION: a junction to a directory that does not exist | no failure | same | met |
| Q108-R82-HOME-RENAMED: HOME renamed away under a read `~/.gitconfig` | `absent (ENOENT)`, no failure | same | met |
| Q108-R82-PARENT-IS-FILE: a regular file where the XDG `git` dir was | `absent (ENOENT)` (win32's code) | `absent (ENOTDIR)` | met |
| Q108-R82-ELOOP (unit): a read `~/.gitconfig` replaced by a symlink loop | `unobservable (ELOOP)`, code set | same | met (R82 lists ELOOP); the text: A10-4 |
| the developer's R82-MACHINE-UNOBSERVABLE (HOME 000 under a read path) | skip | `✓` | met |
| **absent / not a file / two names at the stage start, then EACCES** | skip | **no code; the loop continues** | **A10-2** |
| already unreadable at the stage start (control) | skip | `changed: false`, no code | met |

**Win32's codes, measured in scratch** (`w32codes10.mjs`, not a row): a junction to a missing drive, a file symlink to
a missing drive, and a file symlink to `CON` resolve `ENOENT` (absence, as R82 says). **A file symlink to an unreachable
UNC host resolved `ENOENT` once and `UNKNOWN` three times**, and **a file-type symlink to a directory resolves `EPERM`**:
in both, R82 fails the stage on win32, where on POSIX the second is an observed `not a file`. Fail-closed; §11.4 and
§11.6.

### 3.3 Dispatch item 4: R78–R80, the texts, labels and facts

- **R78 (read records):** every read side printed in this session is `<16 hex> type file dev … ino … nlink … size …
  mtimeNs …`: R73-READ-STABLE-FACTS and -CHANGE-FACTS (the candidate's and QA 104's, win32 and tcm), and my
  R80-TYPECHANGE-FACTS asserts the read `before` by pattern.
- **R79:** the four forms the ruling names are met (the developer's R79 rows and QA 104's probes, tcm; my R71 re-scores,
  §3.6). QA 104's `FIX-before-facts` (A9 + one line) as a **known negative**: the candidate's R72-BEFORE-BARE-READ,
  -TWONAME and -LINK **pass on it** (`36201543890`, tcm-1), and R73-DANGLING-STABLE and R73-ABSENT-BEFORE-CODE fail on it
  (that fix does not touch them). So the candidate's BARE rows accept an independent correct fix. **Open:** A10-3, A10-4,
  A10-5.
- **R80 texts:** gained `the object gained a name inside open`, lost `the object lost a name inside open`, a swapped file
  `handle is a different file` (QA 104's seam, the candidate's rows; win32 and tcm). `loop base` in both change texts.
- **R80 link facts (item 4's check: the LINK's lstat facts AND the labelled resolved facts):** for a link AT the path,
  both are present and labelled, on **win32 too** (the candidate's two rows skip here; my copies of them run):
  `current link: type symlink dev … ino <link ino> … readlink <target>; resolves to: type file dev … ino <target ino> …`;
  and for a dangling one `link: …; does not resolve (ENOENT)` (Q108-R80-TYPECHANGE-DANGLING). For an ANCESTOR link: A10-6.

### 3.4 Dispatch item 5: every existing assertion that changed

| Row (handoff) | Change | Ruling | Narrows a protection? |
|---|---|---|---|
| R45, machine `compare` | `before` `absent` → `absent (ENOENT)` | R79 | no (stricter). `dev-r79-b` kills it (tcm `36195745609`, re-read) and on win32 (§4) |
| **R61** | "no 16-hex run anywhere" → "no side OPENS with 16 hex", plus "the blob contains `ino`" | R79 | **narrower, and correctly so.** The old detector matched decimal facts: on win32 its hits are `19140298416392648` (ino) and `1790378033839847700` (mtimeNs), all decimal (Q108-R61-WIN). **My mutant, re-validating it:** `q108-r61-headclaim` (a dangling link's stable side claimed as read, in the code's own form, hash first) **kills R61 on tcm** (`36201161523`) and locally (my verbatim no-skip copy, and Q108-R61-WIN). **Its boundary:** `q108-r61-tailclaim` (the same claim with the hash written AFTER the facts) kills only Q108-R61-WIN, **not the candidate's R61**. The code's own read form is hash-first (R78's `readText`), so the narrowed detector matches the format; recorded, not scored |
| R70, `configwatch-a7-seam.test.ts` | §1.1 | R80 | no |
| R71 A6-5 | `toBe("unreadable")` → contains `unreadable; stage start`, not `absent` | R79 | no: "never absent" kept. It does not check the facts are the stage start's; QA 104's R72-BEFORE-BARE-READ does (ino) |
| links R74 | regex `not read: base` → `not read: loop base` | R80 | no |
| R77-MODE000-HARDLINK | bytes taken before chmod 000; mode from `lstat` | R77 | no (the test could not read its own victim); killed by the old-path chmod (`d29c168`, `36130769900`; mine `36201159506`) |
| R80-TYPECHANGE-FACTS, -ABSENT-SYMLINK-FACTS | `e8fce2a` weakened them to the target; `ecf1f62` restored the link facts and added `resolves to:` | R80 | **no at the frozen SHA**: stricter than at `e6a3fd4`. The weakening was rejected by the planner and reverted |

### 3.5 On CI's Linux: this seat's branches (all tcm)

Every run: `Machine name: 'tcm'`, git 2.43.0, dispatched with `gh workflow run CI --ref <branch>` (a hosted run was
never asked for). In runs 1, 2, 5, 7 and 8 the only non-probe red is **CA-9**; runs 3 and 4 add their mutants' kills;
run 6 is on A9 code.

| # | Branch (`qa/loop-15-slice-3-a10-…`) | Head | Run | Runner | Tests | What it shows |
|---|---|---|---|---|---|---|
| 1 | `probe` | `201948a` = A10 + QA 89–104's 13 probe files + mine | **`36200429242`** | tcm-1 | 26 failed \| 1321 passed \| 5 skipped (1352) | **the base for every diff.** Every candidate test `✓` except CA-9. My reds: A10-1a/c, A10-2 (4), A10-4 (2), A10-5 (2). Carried reds: §3.6 |
| 2 | `fix-q108` | `7849db8` = 1 + FIX-q108-all (+ R61 copy) | `36201157136` | tcm-1 | 19 failed \| 1329 \| 5 (1353) | heals 7 (A10-2 × 4, A10-3, A10-4 × 2); **0 kills**. The NOSEARCH rows stay red: their null comes from `:703` too |
| 3 | `m-oldpath-chmod-any` | `e5dc369` = 1 + d14a874's chmod on A10 | `36201159506` | tcm-2 | 34 failed \| 1314 \| 5 (1353) | **8 kills:** the candidate's R58 (b)3 and R77-MODE000-HARDLINK, QA 89's B3, mine ×5 (HARDLINK-CONFIG-RO, -000, SYMLINK-CONFIG, DIRLINK-HOOK, STOP-CONFIG-NONEMPTY-DIR) |
| 4 | `m-r61-headclaim` | `5e8abfd` = 1 + my R61 mutant | `36201161523` | tcm-1 | 29 failed \| 1319 \| 5 (1353) | **3 kills:** the candidate's R61, my verbatim copy of it, Q108-R61-WIN |
| 5 | `fix-q108-2` | `a47e053` = 2 + the `:703` edit | `36201522977` | tcm-2 | 17 failed \| 1331 \| 5 (1353) | heals 9 (adds A10-1a, A10-1c); **0 kills** |
| 6 | `r79-on-fix-before-facts` | `ce178b9` = QA 104's `FIX-before-facts` (`2c355f1`) + A10's `configwatch-r79-sides.test.ts` | `36201543890` | tcm-1 | 24 failed \| 1255 \| 5 (1284) | the known negative: the candidate's three R72-BEFORE-BARE rows **`✓`** on it; R73-DANGLING-STABLE and -ABSENT-BEFORE-CODE `×` (not in that fix) |
| 7 | `probe2` | `2e029d7` = 1 + probe 2 (+ R61 copy) | **`36201808930`** | tcm-1 | 27 failed \| 1322 \| 5 (1354) | + Q108-BEGIN-NOSEARCH-THEN-EDIT red (A10-1b); nothing else differs from run 1 |
| 8 | `fix-q108-3` | `783947d` = 5 + probe 2 | `36201813973` | tcm-2 | 17 failed \| 1332 \| 5 (1354) | BEGIN-NOSEARCH-THEN-EDIT **`✓`**; otherwise identical to run 5 |

### 3.6 Dispatch item 6: regressions, QA 99's R71 rows in R79's form, and the loop probes

**Everything QA 104 found closed stays closed** (tcm run 1; win32 BASELINE):
- A9-1: QA 104's probe3 `✓`. A9-2: probe2's R73-LSTAT-EACCES-UNIT and -LOOP `✓`. A9-3: R73-READ-* `✓`. A9-4: the three
  R72-BEFORE-BARE probes and R72-BEFORE-ABSENT-DANGLING `✓`. A9-5: R74-GAINED-BASE/-NEW, R74-LABELS `✓`. A9-6:
  R73-DANGLING-STABLE, R73-ABSENT-BEFORE-CODE, R73-LSTAT-FAIL-STABLE `✓`.
- A8-1..A8-3 and earlier: R68-STABLE-UNREAD, R68-NOT-A-FILE, R70-HANDLE-FACTS' facts, WRITEONLY-LATER,
  R68-UNREADABLE-LATER, R71-BASE-LABEL's facts, D-042's trade rows, A4-1 H/J/LOOP, the R69 edges, A6-1 and A6-2's rows:
  `✓`, or (for the six below) their protection holds in the new form.
- **QA 99's R71-UNREADABLE-START and R71-UNREADABLE-AT-BASE, re-scored in R79's form** (the dispatch; rulings-17 R79
  obsoletes their `toBe("unreadable")`). QA 99's two rows are the same in its probe branch's blob (`1a760243`) and in
  QA 99's tracked copy (`25aa8693`, which QA 104 and I carried); the blobs differ only by two added R68 rows. My
  Q108-R71-UNREADABLE-START-R79 and -AT-BASE-R79 keep each shape exactly and assert `before` matches
  `^unreadable; stage start type file dev \d+ ino <the stage start's ino> nlink 1 size <its size> …$` and contains no
  `absent`. **Both `✓` on tcm** (`36200429242`): e.g. `unreadable; stage start type file dev 66306 ino 4457396 nlink 1
  size 24 mtimeNs …`. The original two are red, as rulings-17 says they must be.

**Carried assertions red at A10 because R78–R82 changed the text they pin** (each read in its printed line; none is a
defect; rulings-17/18 named only the three R71 rows):

| Probe | Red because | The protection, at A10 |
|---|---|---|
| QA 99 R69-GITCONFIG-FIRST | `before` `absent (ENOENT)`, not `absent` (R79); read sides now carry facts (R78) | holds: developer `absent (ENOENT) → 5c5060e1… type file …`; qa both hashes, same ino |
| QA 96 TRADE-LOCKRENAME | compares `before === <hash>` (R78) | holds: `a73dffdf… type file … ino 4457410 …` → `c35076c7… type file … ino 4457412 …`, both read |
| QA 104 R72-UNREADABLE-LOOP | the developer's `chmod 0200` of a read `~/.gitconfig` now fails the developer stage `machine-config-unobservable` (R82), so the qa stage's append never happens | superseded by R82: the change fails the stage instead of being reported later |
| QA 89 R29 row shape | its control expects `unreadable`; R82 prints `unobservable (EACCES)` | holds: the planted link's record has no read attempt (`not read: loop base …; current link: …; resolves to: …`) |
| QA 99 R70-HANDLE-FACTS | expects "handle is a different file" (R80 forbids it for a gained name) | holds: `the object gained a name inside open; not read; … nlink 2 …` |
| QA 99 R71-BASE-LABEL | regex `not read: base` (R80's label is `loop base`) | holds: the candidate's links R74 asserts the same facts under `loop base` |
| QA 104 R73-PARENT-EACCES | **not obsolete: A10-3** | — |

Still obsolete from report A9 §14: QA 89's A4-1 R, QA 94's TRADE-SAME and NO-SEAM CONTROL, QA 92's STOW-LOOP, QA 96's
R65-FACTS and HANDLE-NLINK-BASE (all red at A9 too).

**QA 92's `probe15-a5.mts` (31 probes), probe2, r57, r59 and r62** ran against the A10 and A9 archive copies
(00:24:07–00:26:38Z, alone; each exit 0, stderr empty). `shapev10.mjs` is QA 104's comparator with `C:\qa-tmp`
normalised.
- **With the machine findings dropped (`NOMF=1`): 1 of 31 differs**, `baseHardEdit`, and only in its reason: a hook
  hard-linked at base and edited by the role is restored by bytes with `nlink 1` where the snapshot had `nlink 2`, so it
  is `unrestored` ("read back … nlink:1, expected … nlink:2"). At A10 that ends the stage before git ("Rollback was not
  performed … The tree is left for a human"); at A9 the same stage went on to its ordinary rollback. Status, code,
  stage and verdict are the same. That is R77.4 as ruled (any unrestored path stops before git).
- **With them: 13 of 31 differ.** Twelve are the same after normalising R78 (a read side's facts), R79 (`absent (ENOENT)`)
  and R80 (`loop base`). The thirteenth, `machineHardAbsent`, is R79's `absent at loop base` replacing A9's zeroed
  `unresolved dev null ino null nlink 0 …` (A9-6, fixed); it reads "not read: loop base absent at loop base" (A10-8).
- **probe2** (56 leaves), **r57** (11), **r59** (13), **r62** (24): identical but for the tree path, timestamps,
  durations and a PID. **A6-2 stays closed:** NEWBETWEEN, EXISTBETWEEN, EXISTBETWEEN2 `ok: true`; both controls `ok:
  false`.

## 4. Mutants

**Local, win32.** Each mutant is a `git archive 4b7a5ae open-brain` copy with a `node_modules` junction to the worktree's
(`build10.mjs`).
- Each edit is asserted to occur the expected number of times **against A10's blob before archiving**, then asserted to
  land and read back. **Every build is `tsc --noEmit` exit 0** (two block mutants were rebuilt after a first form failed
  `tsc`; §12).
- The rows are §2's (381 tests), read with the JSON reporter against the unmutated **BASELINE**. A "kill" is a test red
  under the mutant and not red at BASELINE.
- Sequential, 23:27:19Z → 00:23:55Z, 28 builds; **no run printed an unhandled error.** CI dispatches, log fetches and
  git plumbing ran beside the batch (network and git only); one probe-file edit is §12's near-miss.
- The developer's mutants are **rebuilt on A10** from their branch diffs (their branches sit on earlier SHAs; §5.2 has
  each branch's own tcm run). A removed block is neutralised with a trailing `&& process.pid < 0`, the same program.

| Mutant | Edit | Kills (win32) | tcm | What it shows |
|---|---|---|---|---|
| dev (a) identify rethrows | `identify` throws again | 0 (POSIX rows) | dev `36128093969`: 5 | R77 identify; its rows are POSIX |
| dev (b) listTree uncaught | `readdir` throws again | 0 (POSIX) | dev `36128135931`: 6 (probe3 among them) | R77 listTree |
| **dev (c) readState** | EACCES/EPERM only | **3**: R77-READ-EIO, **my READSTATE-TOOLARGE and -AT-BEGIN** | dev `36128168740`: 1 | R77 reading 2; mine is an ordinary-act shape of the same |
| **dev (d) stop removed** | R77's stop before git neutralised | **2: my STOP-CONFIG-NONEMPTY-DIR and STOP-HOOK-DIR** | dev `36128210358`: 3 | R77.4 on win32 has only my rows |
| dev (e) close ok ignores unlisted | `ok` without `unlisted` | 0 (POSIX) | dev `36129234932`: 1 (the empty-tree unit row) | R77 reading 7 |
| dev (f) begin does not refuse | refusal neutralised | 0 (POSIX) | dev `36128283292`: 1 | R77 reading 6 |
| dev (i) contents of an unlisted dir | the `covered` branch neutralised | 0 (POSIX) | dev `36131048854`: 1 | R77 reading 8 |
| dev (ii) machine stage does not stop | R82's stop neutralised | 0 (POSIX) | dev `36131090156`: 1 | R82 |
| **dev ENOENT exclusion dropped** | `resolutionUnobservable` returns every code | **11**: the candidate's **R35 junction row**, R45, R82-ENOENT-IS-ABSENT, R73-ABSENT-BEFORE-CODE ×2, **my four win32 R82 shapes**, R80-ABSENT-SYMLINK-FACTS, TYPECHANGE-DANGLING | dev `36192647557`: 1 | R82's turn-107 precision, measured where it matters (win32) |
| dev R61 hash | a hash in front of a dangling link's side | 2: my R61 copy, Q108-R61-WIN | dev `36195704206`: R61 | R61's detector |
| **dev R78 hash** | a read side is the hash alone | **5**: both candidate R78 rows, QA 104's two R73-READ, my R80-TYPECHANGE-FACTS; heals QA 96's TRADE-LOCKRENAME (its hash-only equality) | dev `36192708146`: 2 | R78 |
| dev R79 (a) unreadable alone | `stageBefore`'s bare `unreadable` | 0 (POSIX) | dev `36195723043`: 5 | R79 |
| dev R79 (b) absent without code | bare `absent` | **4**: R45, R73-ABSENT-BEFORE-CODE ×2, my R80-ABSENT-SYMLINK-FACTS | dev `36195745609`: 2 | R79 |
| dev R79 (c) zeroed loop base | `baseText` zeroed | 2: R73-ABSENT-BEFORE-CODE ×2 | dev `36195768996`: 1 | R79 |
| dev R79 (d) dangling drops lstat | link facts out | 2: QA 104's R73-DANGLING-STABLE, R72-BEFORE-ABSENT-DANGLING | dev `36195795635`: 2 | R79 |
| dev R80 equal | helper returns `before !== after` | 1: R72-EQUAL-TEXT | dev `36197760017`: 1 | the helper only (A10-7) |
| dev R80 gained / lost | old words | 5 (R70 a7-seam, R74-GAINED ×2, QA 104's seam ×2; heals QA 99's R70-HANDLE-FACTS) / 1 (R74-LOST-NAME) | dev: 3 / 1 | R80 |
| dev R80 label | `base` again | 3: links R74, R74-LABELS ×2; heals QA 99's R71-BASE-LABEL | dev `36197730757`: 2 | R80 |
| dev R80 link / resolved | link facts / resolved facts out | **3 / 2: my win32 copies** (the candidate's two rows skip here) | dev: 2 / 2 | R80's link facts, on win32 only by mine |
| **q108-r72-callsite** (QA 104's M-R72-runtime, re-cut) | `if (f.before === f.after) continue;` at `runtime.ts:1079` | **0** | — | **A10-7** |
| **q108-r61-headclaim** | a dangling link's stable side claimed as read, hash first | 2: the R61 copy, Q108-R61-WIN | **`36201161523`: 3**, the candidate's R61 among them | R61 re-validated (item 5) |
| q108-r61-tailclaim | the same claim, hash after the facts | 1: Q108-R61-WIN only | — | R61's boundary (§3.4) |
| **q108-oldpath-chmod-any** (d14a874's chmod on A10) | chmod the old path before restoring | 1: HARDLINK-CONFIG-RO | **`36201159506`: 8** (R58 (b)3, R77-MODE000-HARDLINK, QA 89's B3, mine ×5) | the old path; win32 chmod does not follow symlinks |
| q108-oldpath-chmod-file (3771d53's) | the same, `kind === "file"` only | 1: HARDLINK-CONFIG-RO | — | the guard does not stop a hard link |
| FIX-q108-r82-observed (known negative) | R82's condition widened to an observed start | 0 kills | in `36201157136` | breaks nothing on win32 |
| FIX-q108-readstate-other (known negative) | `readState`: `other`+code → `unreadable (<code>)` | 0 kills | in `36201522977` | breaks nothing on win32 |
| **FIX-q108-all / -all2** (known negatives, CI only) | the four (then five) edits of A10-1 to A10-4 | — | `36201157136`: heals 7; `36201522977`: heals 9; `36201813973`: + BEGIN; **0 kills in each** | each defect's probe sees exactly its line |

**The mutant cut:** the layer and earlier mutants (M-L0, M-L1, M-L2, M-L2-norestore, M-2.5-refuse-node, M-R16, M-CAS,
M-backstop, M-follow-*, the R43–R70 set) were not re-run. A10 touches none of their code except `configwatch.ts`'s window
and `runtime.ts`'s two new stops; their rows ran unmutated and pass (win32 BASELINE, tcm run 1); their last kill counts
are report A9 §4's. QA 104's 60 were run against A9; A10's R77–R80 changes are measured by the 28 above.

## 5. Full suite and CI (CA-12)

### 5.1 The full suite

**The QA full suite at the candidate: 00:27:15Z → 00:30:31Z, `SUITE_EXIT=0`, captured unpiped
(`npx vitest run > file; SUITE_EXIT=$?`; `suite10.sh`).**
- **Where:** `C:/qa-scratch/qa108/wt-a10/open-brain`, a detached `git worktree` of the QA repository at `4b7a5ae`, after
  `npm ci`, `npm run build` and `tsc --noEmit` (each exit 0); 0 porcelain entries before and after; HEAD `4b7a5ae`
  after. The QA tree itself stayed at the dispatch commit, because the driver reads its stop file and this seat's push
  script from it.
- **The Defender-on control (T-190):** the suite ran with `TEMP`=`TMP`=`C:\Users\AARONM~1\AppData\Local\Temp` (the
  driver's `QA_DEFAULT_TEMP`; `os.tmpdir()` under that environment returns it), so the tests' repositories were created
  outside the exclusions. The worktree itself is under `C:\qa-scratch`, which `drive.meta` lists as excluded.
- `Test Files  82 passed | 2 skipped (84)`, **`Tests  1153 passed | 57 skipped (1210)`**, duration 192.54 s, 0 matches for
  `Unhandled|onTaskUpdate`.
- **The total, 1210, equals CI's** on the candidate's head (`36198950992`: 1 failed, 1204 passed, 5 skipped).
- **The 57 skips** are the win32 skips of POSIX-only tests (A10 added many: every EACCES and file-symlink row) and the two
  real-`claude` rows (the adapter does not find `claude` on the role's `PATH` here; CA-9 passes when it does, §2).

**The processes on this PC** (`tasklist /V`, CSV, just before and just after; in `C:/qa-scratch/qa108/suite/`):
- 217 processes before and 214 after.
- claude, node and shells, before and after alike: this session's `claude.exe` (PID 12820), **no `node.exe`**, 4 ×
  `bash` (this seat's shells), 2 × `powershell` (the driver), 1 × `sshd`, 3 × `conhost`, 31 × `msedgewebview2`. No
  `git.exe`, no `Cursor.exe`.
- **Defender (`MsMpEng.exe`, PID 3352) used 4 min 19 s of CPU during the 3 min 16 s suite** (6:31:59 → 6:36:18): it was
  scanning, as the control intends. I did not measure what that cost the suite; the duration (192.5 s) is close to QA
  104's 188.9 s at A9, with 36 more tests.

### 5.2 CI

- **The candidate's own head:** `36198950992` on `4b7a5ae` (tcm-2): 1 failed (CA-9) | 1204 passed | 5 skipped (1210).
- **The developer's runs, every one the handoff cites, re-read per test** (`cidev10.sh`; head, runner, totals, reds):
  R77's red and mutant runs (`36128093969` … `36131048854`, `36129234932`, `36130028474`), the greens (`36126685699`,
  `36129231903`, `36130766787`), the hard-link runs (`36130489186`, `36130492138`, `36130769900`), R78's
  (`36192722723`, `36131825963`, `36192708146`), R79's (`36195158562`, `36195135060`, `36195704206`, `36195386155`,
  `36195723043`–`36195795635`), R80's (`36196648961`, `36196622955`, `36196931266`, `36197418005`, `36197403513`,
  `36197666218`–`36197931021`) and R82's (`36192597210`, `36131090156`, `36192647557`). **Each run's head is the SHA the
  handoff names, and each run's reds are exactly the rows the handoff lists** (plus CA-9, and R72-BEFORE-ABSENT-DANGLING
  on every head before R79, as the handoff says). All on tcm.
- **The tcm column of §4's table** counts each developer run's reds other than CA-9 and R72-BEFORE-ABSENT-DANGLING (red
  on every head before R79), against that run's own base.
- **The developer's `mut-*` branches:** each is one commit on the SHA the handoff names (`763611a`, `819679d`,
  `e7fbe78`, `f45c4c9`, `afee764`, `ecf1f62`; mutant (e)'s killing branch `b8cef69` sits on `0c5e7e4`), changing one
  source file (mutant (e)'s branch changes only the test). I
  read each diff: each is the one edit the handoff describes.
- **This seat's runs:** §3.5. **Budget: 8 of 10 used**, all on tcm, dispatched only when `gh run list` showed no
  run of mine in progress or queued ahead of them.

## 6. `/sync --check` and plain `sync` (CA-12)

- **`gitnexus` is not on this PC** (the dispatch rules it unavailable). **So `/sync --check` after `gitnexus analyze`, as
  CA-12 asks, is UNRUN.**
- **In a scratch clone** (`plainsync10.sh`): `git clone --no-hardlinks` of the QA repository, detached at `4b7a5ae`,
  `npm ci` exit 0, build exit 0.
  - `sync --check`: **exit 1**, "25 passed, 0 fixed, 2 warnings, **1 issues**, 2 skipped".
    - **The one issue is `retirements`**: `.agents/SYSTEM/ENTITIES.md` still names `dream` and `reflection queue`,
      retired 2026-09-15; the same issue as at A9.
    - **Its inputs are master's, byte for byte:** `git diff --quiet 9bc06e3 4b7a5ae -- .agents package.json
      open-brain/package.json CHANGELOG.md README.md` exits 0. **Control:** `open-brain/src/harness` differs, exit 1.
    - Skips: `gitnexus-index` ("no .gitnexus/ in this tree … this is not a pass") and `ci-status` ("gh is not
      authenticated" inside the clone's run). Warnings: `obsidian-vault`, `spec-provenance`. `build-freshness` passed:
      "build matches HEAD 4b7a5ae".
  - **Plain `sync`: exit 0**, "25 passed, **0 fixed**, 2 warnings, 1 issues, 2 skipped". The clone has 0 porcelain
    entries afterwards.
  - **The QA tree was never written:** its only porcelain entries are the driver's three copies, until this report.

## 7. What could not be verified, stated so nobody inherits it as settled

1. **`/sync --check` after `gitnexus analyze`:** unrun. `gitnexus` is not on this PC (by ruling in the dispatch).
2. **CA-9 on tcm** is red on every run for tcm's `claude` (T-182, attributed by the dispatch). On this PC the pin passes against Claude Code 2.1.282 (`ca9-10.sh`). On tcm "2.5 CONTROL: the real claude launcher resolves" ran and passed (`36200429242`); here it skips, as at A9.
3. **Every EACCES shape is Linux-only.** This session cannot make a file or directory unreadable to itself on win32, so
   A10-1, A10-2 and A10-3 are measured on tcm only. A10-4 (ELOOP), A10-5 and A10-6 are measured on both.
4. **A10-1b's 14 sample hooks:** the record lists 15 files as `created`; I measured the user's `pre-commit` deleted. That
   the samples were deleted too is read from the record and from `:801`, not measured file by file.
5. **How old A10-1 is.** At A9 the same shapes threw out of `identify()` (A9-1, A9-2) before any record, so A10-1 is the
   form A9-1 takes once `identify` is contained. Not bisected across A10's 28 commits.
6. **The layer mutants** (M-L0, M-L2, M-2.5-refuse-node, M-R16, M-CAS, …) were not re-run: A10 does not touch their code
   (§4's cut).
7. **The declared unrunnables U1–U6** (criteria §3), **M-R22**, and **CA-9's real run** (candidate A's, attributed).

## 8. What the checks I ran cannot see

- **One win32 machine, and tcm's Linux** (self-hosted, git 2.43). The local mutants ran on win32 only, where the POSIX
  rows skip; for POSIX-only rows the kill evidence is the developer's tcm runs (re-read) and this seat's four mutant/FIX
  runs.
- **Stub roles and unit windows.** The shapes are the ones the dispatch named, those I found by reading `identify`'s
  callers, `stageBefore` and the R82 condition, and those the first CI run surfaced. Shapes none of these reached may
  exist.
- **Permissions.** A directory that lists but cannot be searched (mode 0600) is the shape behind A10-1; I did not try
  ACL-based or `chattr` shapes, which need privileges this seat does not have on either platform.
- **The spy counts git subprocesses started through `spawnSync`.** `git.ts` starts every git call that way; a git call
  started some other way would not be counted.

## 9. Defects, each with the observation that produced it

| # | Severity | Defect | Observation |
|---|---|---|---|
| **A10-1** | **high** (R77, reading 5; CA-15 clauses 1 and 4; R77.4's "a remove is a new write") | `identify()` contains an `lstat` failure as `other`+code, and `readState` (`:463`), `readForCompare` (`:703`) and `begin` (`:683`) turn it into `null` = absent. A plant in a hooks dir made 0600 passes a **completed** loop; a user's hook in a dir already 0600 is recorded `created` and **deleted** by the restore; present hooks are recorded `deleted → absent` | Q108-IDENTIFY-NOSEARCH-PLANT, -KEEP (`36200429242`), Q108-BEGIN-NOSEARCH-THEN-EDIT (`36201808930`), all tcm. FIX at `:463`/`:703` heals all three, 0 kills (`36201522977`, `36201813973`) |
| **A10-2** | **medium** (rulings-18 R82, machine side) | the machine stop fires only when the stage start was READ (`:1246`); absent/not-read/two-name at the start, then EACCES at close: reported, loop continues | Q108-R82-ABSENT-THEN-EACCES(-LOOP), -NOTAFILE-, -TWONAME- (tcm `36200429242`); FIX heals 4, 0 kills (`36201157136`) |
| **A10-3** | **medium** (R77 reading 5; R79) | a stage start whose `lstat` failed prints `before: "absent"` (`:1236`) | QA 104's R73-PARENT-EACCES (tcm `36200429242`); FIX heals (`36201157136`) |
| **A10-4** | **medium** (R79, "a placeholder is never alone"; A9-4's class) | `unobservable (<code>)` with no facts although `lstat` succeeded (`:1249`) | Q108-R79-FILE000-ALONE (tcm), Q108-R79-ELOOP-ALONE (win32 and tcm), QA 89's R29 control output; FIX heals, 0 kills |
| A10-5 | low (R79; present at A9) | an ancestor-link text prints zeroed facts for its current side and drops ENOENT (`:1281–1282`) | Q108-R79-ANCESTOR-ZEROED, -TYPECHANGE-ZEROED (win32, tcm; A9 the same) |
| A10-6 | low (R80 link facts; dispatch item 4) | an ANCESTOR link's type-change text has no `lstat` facts of the link | Q108-R80-ANCESTOR-JUNCTION-TEXT (win32, tcm); declared by the handoff |
| A10-7 | low (R80's R72 clause) | R72's runtime decision at its call site (`runtime.ts:1079`) has no killing test; R72-EQUAL-TEXT tests the extracted helper | `q108-r72-callsite`: 0 kills of 381 (win32). `dev-r80-equal` (the helper's body) kills R72-EQUAL-TEXT |
| A10-8 | cosmetic | FIFO `deleted → absent`; "0 … changed: ."; BOTH's reason; no test on the unread note | Q108-FIFO-CONFIG, LISTTREE-*, Q108-BOTH (tcm) |
| A7-5 | probe (carried) | QA 92's STOW-LOOP and the probe15 counters count one finding per path | unchanged |
| D-A2-7, D-A5, R37's named limit | carried | — | not in A10 (rulings-17) |

## 10. Regressions: previously validated behaviour confirmed still working

- **Unmutated rows:** 255 passed on win32, the 10 failures are probes (§2). On tcm every candidate test `✓` except
  CA-9 in runs 1 and 7 (A10 unmutated) and in the three FIX runs. The full suite: exit 0, 1153 passed, 57 skipped (1210).
- **Everything QA 104 found closed stays closed** (§3.6): A9-1 to A9-6 as QA 104 measured them, with A10-1, A10-3, A10-4
  and A10-5 as new or remaining shapes of A9-1/A9-4/A9-6's classes.
- **QA 99's R71 rows in R79's form:** `✓` on tcm.
- **QA 92's 31 win32 loop probes:** identical to A9 in every status, failure code, stage, config verdict, victim, token
  and "in record" field, except `baseHardEdit`'s reason, which is R77.4's stop (§3.6). probe2, r57, r59 and r62 are
  identical; A6-2's r62 rows are `ok: true` and both controls `ok: false`.
- **Every carried protection** red only in text is intact when read in R78–R82's form (§3.6).
- **Regressions:** none found in behaviour A9 had right. The six carried reds are R78–R82's intended text changes.

## 11. Where the criteria, the rulings and the candidate disagree (returned, not scored)

1. **R82's "observable" versus A10's "read".** The runtime's reason says "readable at the stage start"; rulings-18 says
   "observable" and makes absence and a deliberate not-read observations. I scored the ruling's word (A10-2).
2. **Rulings-17's containment rule and R78/R80/R82.** Rulings-17 says a ruling that changes an asserted text names the
   tests it obsoletes. Rulings-17 named three (R79). R78 (read sides), R80 (words, label) and rulings-18's R82 (a stage
   that now stops) changed six more carried QA assertions without naming them (§3.6). None is a candidate test, and each
   protection holds; recorded so the next ruling can name them.
3. **A read failure at the window's OPEN, unchanged, is `ok: true`** (Q108-READSTATE-TOOLARGE-AT-BEGIN). R82 says "every
   contained failure fails the stage" on the repository side; R77 reading 6 refuses only an unlisted directory at begin.
   A10 records it only as "Read failures: …" in the message, and omits plain EACCES/EPERM from that note. A path the
   window cannot snapshot cannot be restored if the role changes it (A10 then stops, correctly, as `unrestored`). Whether
   begin should refuse it (R77.6's form) is the planner's.
4. **Win32's `EPERM` for a file-type symlink to a directory** fails the stage `machine-config-unobservable` on win32 and
   is an observed "not a file" on POSIX (§3.2). Fail-closed; platform-divergent.
5. **CA-9 and tcm**, as report A9 §11.5 (T-182).
6. **A link to an unreachable UNC host resolves `UNKNOWN` on win32** (three runs of `w32codes10.mjs`; `ENOENT` in the
   first, inline run of the same code). R82 treats `UNKNOWN` as "could not see", so such a stage fails; had it been
   `ENOENT` it would be absence. Fail-closed, but the same act can land either way.
7. **The repository side's READ record is `<hash>/<mode>/nlink:<n>`**, without `dev`, `ino`, `size`, `mtimeNs`. R73 and
   R78 were written about the machine side's per-stage records (A8-1, A9-3), and "both sides" there meant before and
   after, as QA 104's R73-READ-CHANGE-FACTS used it. If R73's "every watched path" was meant to include the repository's,
   this is short of it; I did not score it.

## 12. This seat's error entries and near-misses this session

**Error entries (escaped):** none known.

**Near-misses (caught in-process, not numbered):**
- **My first PLANT-CONTROL assertion looked for the absolute path in the record;** the record writes `<common>/hooks/…`.
  Red on win32 in my first run; corrected to the hook's name before any CI commit.
- **My first TOOLARGE-AT-BEGIN resolved the git dirs after zero-filling `.git/config`,** so `git rev-parse` failed in my
  own setup. Corrected before any CI commit; the row is an observation.
- **An escaped-regex edit to the comparators did nothing, then broke them.** Adding `C:\qa-tmp` to `shapev10.mjs` and
  `cmpj10.mjs` by script lost the escapes; `node --check` and a table test (`retest.mjs`) caught it, and I made the edit
  by hand. The same test showed that `cmpj9.mjs`'s `(\\|\|\/)` does not match a forward slash (its `\|` is a literal
  pipe); my added line uses `shapev`'s form.
- **I edited the shared probe file while the mutant batch was running.** `runmut10.sh` copies it into each mutant. I
  restored it from its committed blob (`1ef4dab`) and moved the new row to `qa108-a10-probe2.test.ts`. From the
  transcript: the edit at 23:37:14.5Z, the restore at 23:37:25.5Z. `dev-e-unlisted` copied the file at 23:36:00 and
  `dev-f-begin` at 23:38:01, so no mutant ran with the edited file.
- **Two of my block mutants did not type-check** (`false && configVerdict …` breaks narrowing). Rebuilt with a trailing
  `&& process.pid < 0`; every build in the table is `tsc --noEmit` exit 0.
- **My first FIX did not heal A10-1's rows.** That was a finding, not a failed fix: the null also comes from
  `readForCompare`'s resolution-diff branch (`:703`). FIX-q108-all2 adds it.
- **Driver copies in the QA tree** (QA 99's and QA 104's reports, QA 99's scripts): byte-identical to their branch blobs;
  not touched.

## 13. Reproduction

The scripts are tracked at **`docs/loops/qa-scripts-a10/`** on this seat's report branch, byte-identical to the copies
that ran, with a README.

| Branch (pushed with `push-qa.mjs`, read back) | Head | What |
|---|---|---|
| `qa/loop-15-slice-3-a10-probe` | `201948a` | A10 + QA 89, 92 v3, 94 × 2, 96 × 3, 99 × 2, 104 × 2 + `qa108-a10-probe.test.ts` |
| `qa/loop-15-slice-3-a10-fix-q108` | `7849db8` | + FIX-q108-all, + the R61 copy |
| `qa/loop-15-slice-3-a10-m-oldpath-chmod-any` | `e5dc369` | + d14a874's chmod, on A10 |
| `qa/loop-15-slice-3-a10-m-r61-headclaim` | `5e8abfd` | + my R61 mutant |
| `qa/loop-15-slice-3-a10-fix-q108-2` | `a47e053` | + FIX-q108-all2 |
| `qa/loop-15-slice-3-a10-r79-on-fix-before-facts` | `ce178b9` | QA 104's FIX-before-facts + A10's r79 file |
| `qa/loop-15-slice-3-a10-probe2` | `2e029d7` | probe set + `qa108-a10-probe2.test.ts` |
| `qa/loop-15-slice-3-a10-fix-q108-3` | `783947d` | FIX-q108-all2 + probe 2 |
| `qa/loop-15-slice-3-a10-report` | this commit | this report and `docs/loops/qa-scripts-a10/` |

**A10-1a in five lines (Linux, not root):**
1. A repository whose `.git/hooks` is empty.
2. The developer role writes `.git/hooks/post-checkout` (mode 755).
3. It runs `chmod 600 .git/hooks` and exits.
4. `runLoop` completes; every config verdict is "no repository config or hook changed".
5. After the loop, `.git/hooks/post-checkout` is still there with its planted bytes (measured). Once the directory's
   search bit is back it is an ordinary executable hook; I did not run a checkout to fire it.

**A10-1b in four lines:** `.git/hooks` holds your `pre-commit` and is mode 0600 when the loop starts; the developer runs
`chmod 755 .git/hooks` and appends a line to `pre-commit`; the stage fails `stage-changed-config` recording `pre-commit
created (absent → …)`; `pre-commit` no longer exists.

## 14. Handoff to the next QA session (D-035)

1. **Known positives.**
   - **A10-1:** A10 `4b7a5ae` by Q108-IDENTIFY-NOSEARCH-PLANT/-KEEP and Q108-BEGIN-NOSEARCH-THEN-EDIT (Linux, non-root).
     **Known negative:** `FIX-q108-all2` (`:463` and `:703`), `36201522977` / `36201813973`.
   - **A10-2, A10-3, A10-4:** A10 by Q108-R82-*-THEN-EACCES, QA 104's R73-PARENT-EACCES, Q108-R79-FILE000-ALONE /
     -ELOOP-ALONE. Known negative: `FIX-q108-all` (`36201157136`).
   - **A10-5, A10-6:** A10 and A9 by Q108-R79-ANCESTOR-* and Q108-R80-ANCESTOR-JUNCTION-TEXT (win32 and Linux).
   - **The old path:** `d14a874`, `3771d53` (win32, HARDLINK-CONFIG-RO) and `q108-oldpath-chmod-any` (tcm, 8 kills).
2. **Obsolete probe assertions, now including** QA 99's R69-GITCONFIG-FIRST, R70-HANDLE-FACTS and R71-BASE-LABEL, QA 96's
   TRADE-LOCKRENAME, QA 104's R72-UNREADABLE-LOOP and QA 89's R29 control (text only; §3.6), and QA 99's two R71 rows
   (replaced by Q108-R71-*-R79). Still obsolete: QA 89's A4-1 R, QA 94's TRADE-SAME and NO-SEAM, QA 92's STOW-LOOP, QA 96's
   R65-FACTS and HANDLE-NLINK-BASE.
3. **This PC can make file symlinks, junctions and hard links, not unreadable files.** The candidate's link-fact rows
   skip on win32 and my copies of them run here. Every EACCES shape needs CI.
4. **`C:\qa-scratch` and `C:\qa-tmp` are Defender exclusions** (`drive.meta`); the one suite ran with the default temp.
5. **Keep the seams** (`qa94-handle`, `qa96-seam`, `qa99-seam`, `qa104-seam`, the candidate's own).
6. **The spy** in `qa108-a10-probe.test.ts` (`gitAfterRole`) is the direct measure of "no git call before the stop".
7. **Nothing is pushed except this seat's own branches, through `push-qa.mjs`; the merge is Aaron's.**

## 15. Open for the planner

Each item is what I would have asked, and what I did instead. None of them blocked the rest of the work.

1. **The severity of A10-1.** I called it high: a planted hook passes a completed loop with "no hook changed" in every
   record (a), and the restore deletes a user's existing hook on a false `created` (b). The plant is dormant until the
   directory's search bit returns, and (b) needs the directory already unsearchable at the loop's start.
2. **R82's "observable"** (A10-2): I read it as the ruling's turn-94 and turn-107 text does (absence and a deliberate
   not-read are observations). If "observable" meant "read", A10-2 is not a defect.
3. **R80's link facts for an ANCESTOR link** (A10-6): the dispatch's item 4 asks for the link's `lstat` facts in the
   type-change text; the handoff limits them to a link AT the path. I scored it low and asked.
4. **A read failure at begin, unchanged** (§11.3): whether R82's "every contained failure fails the stage" or R77.6's
   begin refusal covers it.
5. **Naming obsoleted QA assertions** (§11.2): six carried probes changed meaning under R78, R80 and R82 without being
   named. I re-read each in the new form.
6. **The repository side's read records** (§11.7) print `<hash>/<mode>/nlink:<n>` without `dev`, `ino`, `size`,
   `mtimeNs`. I read R73/R78 as machine-side, as QA 104 measured them, and did not score it.
7. **2 of the 10 CI runs are unused**, left for a re-run if the planner wants one of these shapes measured again.

**Dispatch items, each done or written up:** 1 every row re-run (§2; win32 locally, POSIX on tcm, 8 of 10 runs);
2 R77 by class, a shape of mine per helper, the old path with hard-link and symlink shapes (§3.1); 3 R82 on win32 (§3.2);
4 R78–R80 texts, labels and facts (§3.3); 5 every changed existing assertion, and R61 re-validated by my own mutant
(§1.1, §3.4); 6 regressions, and QA 99's R71 rows in R79's form (§3.6, §10); 7 the full suite once at the frozen SHA,
with processes (§5.1); 8 plain `sync` in a scratch clone, and `/sync --check` after `gitnexus analyze` unrun (§6). No
`/end` (T-163).

QA-108: REPORT COMPLETE
