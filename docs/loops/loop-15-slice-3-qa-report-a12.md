# Loop 15 slice three — QA report A12: candidate A12 `a69f07d` (product `7200e1c`): REJECTED, on R90's own branch

**By:** the QA seat, record session **149** (the dispatch assigned it) · **Date:** 2026-09-27 (UTC).
**Where:** the QA PC **`DESKTOP-O4EGB1E`**, in `C:\Users\Aaron Melven\Worktrees\sia-qa`, launched headless by
`docs/loops/qa-149/drive.ps1` from `docs/loops/qa-queue.ps1` (`drive.meta`: `start=2026-09-27T03:32:12Z`,
`head=f2781956…`). Nobody watched the run, and the planner could not be reached. Every question is in **§12, Open for
the planner**.
**Model and effort:** the process command line is `--model claude-opus-5-5 --effort high`, and the transcript agrees
(§0.1).
**Elevation (QA 138's O-a):** **this process runs elevated.** `whoami /groups` shows `Mandatory Label\High Mandatory
Level` and `BUILTIN\Administrators` enabled; .NET `IsInRole(Administrator)` is `True`. **`SeBackupPrivilege` is
Enabled** in `whoami /priv`, as are `SeRestorePrivilege`, `SeTakeOwnershipPrivilege` and `SeSecurityPrivilege`. So an ACL
cannot make `lstat` fail for this process. Every real EACCES shape therefore ran on tcm, and win32 used a wrapped
`lstat`/`realpath` (§2, check 1).

**Dispatch:** `docs/loops/loop-15-slice-3-dispatch-qa-a12.md` at the QA tree's HEAD `f278195`. **Rulings:**
`docs/loops/loop-15-slice-3-rulings-20.md` (R90–R94, the re-done R85 search). **Predecessor:** QA 130's report
(`origin/qa/loop-15-slice-3-a11-report` `cc4b185`), whose Verdict, §3.1, §3.3, §4, §5 and §9–§15 I read.

**Candidate (frozen):** **`a69f07d1716d7854f7e5a4d3bbe6cdb443fb5017`** on `origin/loop/15-slice-3-candidate-a12`. It is
the same in the driver's `refs-before.txt` and by `ls-remote` during the run. Product **`7200e1c`**; after it come only
`f9e8f5b` and `a69f07d`, the handoff (one file under `docs/loops/`). Built by Grok 4.7 in Cursor (record 143) from A11
`bbf9d07` merged with `origin/master` `ebda33d` (merge `afe1c3b`). I read the handoff and the whole product diff
(`configwatch.ts` +22 −3; `tests/harness/configwatch-a12.test.ts`).

**Scored on:** win32 (Windows 10 Pro 19045), Node v22.23.3, and Linux on tcm (`Machine name: 'tcm'`, runners `tcm-1` and
`tcm-2`, git 2.43.0): **8** of the 8 allowed runs (§4.2). **Temps (T-190):** probes and mutants ran with
`TEMP`=`TMP`=`C:\qa-tmp`, and the one full suite ran with the driver's default temp (§4.1). `drive.meta` lists
`C:\qa-scratch` and `C:\qa-tmp` as Defender exclusions.

---

## Verdict: REJECTED. R90's new branch claims a restore that did not happen, and it removes R77's stop before git for that path. QA 130's own Q130-R83-SUBDIR-NOSEARCH-PLANT goes red on tcm. Every other ruling holds: R90's two texts, R91, R92, R93 and R94 pass, all three of QA 130's A11 defect rows heal, and there are no other regressions.

**The planner's suspected defect holds, and it goes further than the planner's reading (A12-1, medium).**
- **What the code does.** At `7200e1c`, `closeAndRestore`'s R90 branch (`configwatch.ts:826–:837`) pushes
  `absent → unobservable (<code>)` and `continue`s. Nothing is removed, and nothing is added to `unrestored`.
  - The summary sentence (`:880–:887`) is chosen by `unrestored.length === 0 && changes.length > 0`.
  - The runtime's R77 stop (`runtime.ts:1128–:1141`) fires only when `unrestored` or `unlisted` is non-empty.
- **So when this record is the only change, or the only change not put back:**
  1. **the message claims a restore that did not happen.** It says `Every file was put back by bytes before any git call
     read the repository.`, and the planted file is still in the tree;
  2. **the stage no longer stops before git.** The runtime goes on to the ref window, the allowlist and rollback: **6
     git calls after the role**. On A11 the same shape made 0;
  3. **no "Recover by hand" appears**, and the loop's reason ends `A boundary breach is not retried.`
- **Measured on tcm, real chmod (probe run `36292117395`).** Q130-R85-REPO-UNREADABLE-ZEROED's shape is Q149-C1-HOOKS-ONLY:
  the hooks dir is emptied, `post-checkout` is planted, and hooks is made 0600. The message reads, exactly:

  > `1 repository config/hook file(s) changed during the developer stage: <common>/hooks/post-checkout (absent →
  > unobservable (EACCES); unreadable (EACCES); no facts: lstat failed). A role may not change what git executes: a hook
  > or a program-valued config key runs inside the runtime's own git calls. Every file was put back by bytes before any
  > git call read the repository. examined 4 file(s) around the developer stage. LIMIT: …`

  `unrestored: []`, `plantStill: true`. The git calls after the role are `for-each-ref`, `symbolic-ref HEAD` ×3,
  `rev-parse HEAD` and `status`.
- **The created-then-unlstatable shape, two ways.**
  - **Alone:** QA 130's Q130-R83-SUBDIR-NOSEARCH-PLANT is a plant in a hooks subdirectory that is then made 0600. It
    prints the same claim, with `plantStill: true` and `gitAfterRoleCount: 6`. **QA 130's own row asserts
    `gitAfterRole == []` and is now red** (it was `✓` with 0 calls on A11, `36279688475`).
  - **With other failures:** Q130-R83-DOTGIT-NOSEARCH's `config.worktree` (`.git` made 0600). Here the other paths fail
    their restores, so the message says `16 FILE(S) COULD NOT BE PUT BACK … Recover by hand`, and the stop holds with 0
    git calls. The defect needs the R90 record to be the only thing not put back.
- **On win32 too** (wrapped `lstat`; `qa149-a12-mock.test.ts`): the same claim and 6 git calls. Q149-MOCK-PLUS-CONFIG shows
  the claim also covers a plant beside a config edit that WAS restored. The control, Q149-MOCK-PRESENT-CONTROL (a path
  present at the open whose `lstat` fails at close), says `1 FILE(S) COULD NOT BE PUT BACK` and makes 0 git calls.
- **Why it is A12's.** On A11 the same path was `created` and reached `:850`'s `a other was created; not removed
  recursively`, which went into `unrestored` and stopped the stage (QA 130 §3.1: "fails closed; the wording is A11-4").
  R90 removed the wrong words and, with them, the only thing that stopped the stage. The developer's own
  `mut-r90-created` (the branch deleted) is A11's behaviour.
- **Known negative:** `FIX-q149` adds one line in the branch, `unrestored.push(\`${path} (absent at the open; cannot be
  lstat'd at close (${code}); not removed)\`)`. On tcm (`36292163102`) it heals 5 rows, QA 130's SUBDIR row among them, and
  kills 0. On win32 it heals both MOCK rows and kills 0 (§3).
- **Severity: medium. I weighed high.**
  - **What argues for high:** it breaks R90's own words ("never prints invented facts"), R77's "any unrestored path stops
    before git", and CA-15 clause 4 (the record says what happened). A human reading it is told the tree was put back,
    with no "Recover by hand".
  - **What holds it at medium:**
    - the stage still fails `stage-changed-config`;
    - layers 0 and 1 (`core.hooksPath=/dev/null`, `core.fsmonitor=false`, `git.ts:80–:109`) cover the runtime's own 6
      calls;
    - the plant sits in a directory git cannot search, and, by reading, the next loop's open would refuse that directory (R88). That
      is what Q130-R88-NOSEARCH-AT-OPEN measures for a hook already in a 0600 hooks dir.
  - A10-1 was high because a plant passed a completed loop, which this does not do.
  - **It rejects anyway:** it is a regression on QA 130's row set, which the dispatch scores, and it breaks the ruling it
    implements.

**What A12 fixed, against QA 130's named known positives** (tcm probe run `36292117395` against QA 130's
`36279688475`, by test name: **3 healed**, 1 regression, and this seat's new rows):

| QA 130 item | At A11 | At A12 | Evidence |
|---|---|---|---|
| **A11-1** (repository side: zeroed facts and an invented type for a failed `lstat`; `created` for a path it cannot see) | `created (absent → unreadable (EACCES); type file dev null … size 0 mtimeNs 0)` | **text closed**: `(absent → unobservable (EACCES); unreadable (EACCES); no facts: lstat failed)`, and no `created` | Q130-R85-REPO-UNREADABLE-ZEROED `✓`; Q130-R83-DOTGIT-NOSEARCH's `config.worktree` is `kind: "modified"`, `absent → unobservable (EACCES)`, not `created`; developer's R90-STATEHASH and R90-ABSENT-UNOBSERVABLE `✓`. **The same branch is A12-1** |
| **A11-2** (the file's facts dropped under a directory link at base) | link's `lstat` only | **closed**: `…; resolves to: type file dev … ino <file ino> …` | Q130-R85-VIA-FILE000 `✓` (tcm); developer's R91-VIA-FACTS `✓` |
| **A11-3** (`absent →` an ancestor link: no link facts) | resolved facts only | **closed**: `link: type symlink dev … ino <link ino> …` | Q130-R86-ABSENT-ANCESTOR-LINK `✓` (win32 and tcm); developer's R92-ABSENT-ANCESTOR `✓` |
| **A11-T1..T3** (test gaps) | QA probes only | **closed**: QA 130's three mutants, re-applied to `7200e1c`, are each killed by a developer row | §2 check 4 |
| **A11-4** (cosmetic) | `a other was created`; directory → `absent` | the note is gone (R90's branch). The directory half is unchanged, as the handoff says | the note's removal is how A12-1 arises |

**Full suite at `a69f07d`, Defender-on control:** `SUITE_EXIT=0`, `Test Files 93 passed | 8 skipped (101)`, **`Tests 1351 passed | 77 skipped (1428)`**, 0 unhandled. The total equals CI's on the candidate (`36283457438`: 1 failed (CA-9) | 1422 | 5 (1428)) (§4.1). **Merge with today's `origin/master` (`36a33bc`):
clean** (`git merge-tree --write-tree` exit 0, tree `e25e0d4`; §2 check 5).

---

## 0. Rulings and authority in force

| Source | Where |
|---|---|
| **Rulings-20** R90–R94, the re-done R85 search, A11-4 | `docs/loops/loop-15-slice-3-rulings-20.md` at `f278195` |
| The dispatch | `docs/loops/loop-15-slice-3-dispatch-qa-a12.md` at `f278195` |
| QA 130's report, probes and mutants | `cc4b185`; probes `origin/qa/loop-15-slice-3-a11-probe` `5564ef6`; mutants `e2cd6cc`, `5761f3a`, `5bbc4c0` |
| **CI on this seat's own branches** | tcm, at most 8 runs; **8 used**, no laptop (`windows=true`) run |
| **Pushing** | only `qa/loop-15-slice-3-a12-*`, only through `node docs/loops/qa-149/push-qa.mjs <branch>`; every push read back by the script |

### 0.1 Model and effort

- **The session's init line** (`%USERPROFILE%/sia-qa149/run-0.jsonl`, parsed as JSON by `effort12.mjs`): `model:
  "claude-opus-5-5"`, session `5f5e1023-759b-4eb8-8766-c93adf5bebef`, `permissionMode: "dontAsk"`, Claude Code
  `2.1.282`. The init line has no effort field; it carries `per_turn_effort_active`.
- **The process command line** (`Get-CimInstance Win32_Process`, at the start): `claude.exe -p "…" --model
  claude-opus-5-5 --effort high --permission-mode dontAsk --allowedTools Bash Read Write Edit Glob Grep
  --disallowedTools "Bash(git push:*)" … --append-system-prompt-file …\qa-149\stops.txt --output-format stream-json`.
- **The host transcript** (`~/.claude/projects/C--Users-Aaron-Melven-Worktrees-sia-qa/5f5e1023-….jsonl`, parsed as
  JSON): **342 of 342 assistant entries** carry `model: "claude-opus-5-5"`, `effort: "high"` and
  `perTurnEffort: "high"`, **03:32:19Z → 04:11:43Z**. That span covers every measurement, mutant, CI dispatch and the
  suite. The turns after it (the last edits, the commit and the push) are not in the count.

## 1. Frozen-candidate conditions

- `origin/loop/15-slice-3-candidate-a12` is `a69f07d` in `refs-before.txt` and by `ls-remote` during the run.
  `git diff --stat 7200e1c a69f07d`: one file, `docs/loops/loop-15-slice-3-a12-developer-handoff.md`.
- The product diff against `afe1c3b` is `open-brain/src/harness/configwatch.ts` (+22 −3) and
  `open-brain/tests/harness/configwatch-a12.test.ts` (+261), as the dispatch says. I read every line of it.
- The worktree `C:/qa-scratch/qa149/wt-a12` (detached at `a69f07d`): `npm ci` exit 0, `tsc --noEmit` exit 0.

## 2. The dispatch's checks, one by one

### Check 1 — the planner's suspected defect: **FAIL. It holds, and it is worse (A12-1)**

The planner's reading is right, and the measurement adds a second consequence: R77's stop before git no longer fires for
this path. The Verdict carries the message verbatim; this is the evidence table.

| Row (file) | Shape | Platform | `unrestored` | Summary sentence | Plant after | Git calls after the role | Result |
|---|---|---|---|---|---|---|---|
| Q149-C1-HOOKS-ONLY (`qa149-a12-probe`) | Q130-R85-REPO-UNREADABLE-ZEROED's act, byte for byte | tcm | `[]` | `Every file was put back by bytes …` | present | **6** | `×` |
| Q149-C1-SUBDIR-ONLY (`qa149-a12-probe`) | Q130-R83-SUBDIR-NOSEARCH-PLANT's act | tcm | `[]` | same | present | **6** | `×` |
| **Q130-R83-SUBDIR-NOSEARCH-PLANT** (QA 130's, byte-exact) | QA 130's own | tcm | `[]` | same | `plantStill: true` | **6** (0 on A11) | **`×` (was `✓`)** |
| Q130-R85-REPO-UNREADABLE-ZEROED (QA 130's) | QA 130's own | tcm | `[]` | (not printed by the row) | — | (not measured by the row) | `✓` (its assertions are text only) |
| Q149-C1-DOTGIT-CONTRAST (`qa149-a12-probe`) | Q130-R83-DOTGIT-NOSEARCH's act | tcm | 16 entries | `16 FILE(S) COULD NOT BE PUT BACK … Recover by hand` | — | 0 | `✓` |
| Q149-MOCK-HOOKS-ONLY (`qa149-a12-mock`) | hooks emptied, `post-checkout` planted, its `lstat` wrapped to throw EACCES | win32 and tcm | `[]` | `Every file was put back …` | present, bytes intact | **6** | `×` |
| Q149-MOCK-PLUS-CONFIG | the same, plus `.git/config` edited (restored) | win32 and tcm | `[]` | same | present | **6** | `×` |
| Q149-MOCK-PRESENT-CONTROL | a hook present at the open, its `lstat` wrapped at close | win32 and tcm | 1 | `1 FILE(S) COULD NOT BE PUT BACK …` | — | 0 | `✓` |

- **The exact message** (tcm; the path differs per run) is quoted in the Verdict. The loop's `failure.reason` is that
  message wrapped: `developer was refused, not warned. <message> A boundary breach is not retried.` It has no
  `Rollback was not performed` and no `Recover by hand`.
- **The git calls** are the runtime's steps after the R77 check (`runtime.ts:1143` on): `closeRefWindow()`,
  `enforceAllowlist` and the `configBad` branch's `rollBack`. I did not map each call to its step. The spy is QA 130's
  `gitAfterRole`, unchanged.
- **Known negative `FIX-q149`** (one line; §3): on tcm (`36292163102`) it **heals 5 rows and kills 0**: QA 130's
  SUBDIR row, and my four C1/MOCK rows. The message becomes `1 FILE(S) COULD NOT BE PUT BACK: …/post-checkout (absent at
  the open; cannot be lstat'd at close (EACCES); not removed). Recover by hand before rerunning.`, with 0 git calls. It
  kills nothing on win32 either.
- **The developer's rows do not see it.** R90-ABSENT-UNOBSERVABLE uses `.git` 0600, where other paths are unrestored and
  the stop holds. No developer row asserts the summary sentence or the git calls for an R90-only record.

### Check 2 — R90's stored `kind: "modified"`: **reported; the planner rules**

**Every consumer of `ConfigChange.kind`,** by `grep` over the tree at `a69f07d` (`open-brain/src`, `open-brain/tests`,
`scripts`, `.claude`; `node_modules` and `docs/loops` excluded):

| Where | What it does with `kind` | Acts on it? |
|---|---|---|
| `configwatch.ts:789` (tree root), `:831` (R90), `:840` (the general record) | build it | — |
| `configwatch.ts:894–:896`, the message | prints `${rel(path)} ${kind} (before → after)`. For R90 it omits the word, keyed on **`after.startsWith("unobservable (")`**, not on `kind` | **message only** |
| `runtime.ts:648` `renderFindings` | serialises `changes` whole into `config_verdicts`. On a failed loop that is `FAILED.md`'s "Findings" JSON; on a completed loop, `findings.json` | **stored verbatim** |
| counts | `changes.length` ("1 repository config/hook file(s) changed") counts records, not kinds; `examined` is `names.size` | no |
| gates | `ok`, and the runtime's stops, read `changes.length`, `unrestored`, `unlisted` and `ancestorLink` | no |
| restore | keyed on `b === null` / `b.kind` (the FileState's kind), never on `ConfigChange.kind` | no |
| tests | `configwatch-a12:102`, `-r77-contain:368`, `-r83:91/:111/:135/:156` assert `not created` / `not deleted` | assertions only |

**Measured:** the stored record for Q149-C1-HOOKS-ONLY, read back out of `FAILED.md`, is
`{"stage":"developer","path":"…/hooks/post-checkout","kind":"modified","before":"absent","after":"unobservable (EACCES);
unreadable (EACCES); no facts: lstat failed"}` (tcm and win32).

**My reading.** Nothing counts, gates or restores on `kind`. But the durable record says `modified` with `before:
"absent"`, which claims a file existed and changed. The message avoids that only because it matches a text prefix. **A
distinct kind (for example `"unobservable"`) would be truer**, and would let the message key on the kind instead of on
the text. The cost is widening the union at `:379`; the message map is the only reader to change. I recommend it and do
not score it.

### Check 3 — R90–R92 on their known positives: **PASS**

The rows were taken from `qa/loop-15-slice-3-a11-probe` `5564ef6` byte-exact (every blob compared with `git rev-parse
5564ef6:<path>` against `git hash-object`; `qa130-a11-probe.test.ts` is `0628e59c`).

| Ruling | Known positive | tcm (`36292117395`) | win32 | Printed |
|---|---|---|---|---|
| R90 bullet 1 | Q130-R85-REPO-UNREADABLE-ZEROED | `✓` (red on A11) | skips (POSIX) | `after: "unobservable (EACCES); unreadable (EACCES); no facts: lstat failed"`; no `type file`, no zeroes |
| R90 bullet 2 | Q130-R83-DOTGIT-NOSEARCH (`config.worktree created`) | `✓` | skips | `<common>/config.worktree (absent → unobservable (EACCES); unreadable (EACCES); no facts: lstat failed)`, `kind: "modified"`; the word `created` is not in the message, and there is no `a other was created` |
| R91 | Q130-R85-VIA-FILE000 | `✓` (red on A11) | skips | the link's `ino` and the file's `ino` both present |
| R92 | Q130-R86-ABSENT-ANCESTOR-LINK | `✓` (red on A11) | **`✓`** (red on A11: QA 130's BASELINE → mine, `cmpbase.mjs`) | `link: type symlink dev … ino <link ino>` |

R90's positives pass as the ruling's text is written. What R90's second bullet leaves out (the restore claim and the stop)
is check 1.

### Check 4 — R93, against QA 130's own mutants re-applied to `7200e1c`: **PASS**

| QA 130 mutant | Re-applied | Run | Kills (against the probe run `36292117395`) |
|---|---|---|---|
| `q130-r85-factsdrop` (`e2cd6cc`) | byte-identical edit | `36292138310` | **R93-STAT-FACTS** (developer), Q108-R79-FILE000-ALONE |
| `q130-r88-lstat` (`5761f3a`) | byte-identical edit | `36292144008` | **R93-LSTAT-AT-OPEN** (developer), Q130-R88-NOSEARCH-AT-OPEN, Q130-R83-227 |
| `q130-r85b-via` (`5bbc4c0`) | **adapted**: its line `if (s.viaLink !== null) return ancestorLinkText(s);` no longer exists. R91 made it a 4-line block, and the re-application deletes that block, the whole parent-link branch, as QA 130's did | `36292149195` | **R93-PARENT-LINK** and R91-VIA-FACTS (developer), Q130-R85-VIA-FILE000, Q130-R85-VIA-TARGET000 |

- Each of the three re-applied edits is **byte-identical to the developer's `mut-r93-*`** (`7d7c290`, `3e3e420`,
  `6546937`: same `-`/`+` lines against `7200e1c`). So the kills are also in the developer's runs. Mine carry QA 130's
  probe rows beside them.

### Check 5 — R94: **PASS; the merge with today's master is clean**

- **`afe1c3b`'s parents are `bbf9d07` (A11) and `ebda33d` (master).**
- **Against master:** `git diff ebda33d afe1c3b -- .github/workflows/ci.yml` is **one line**, `run: npm test` →
  `run: npm test -- --reporter=verbose`. So master's `test-windows` job and its six dispatch inputs (`windows`, `step0`,
  `workers`, `cpu`, `disk`, `spawn`) are whole, byte for byte.
- **Against A11:** `git diff bbf9d07 afe1c3b -- .github/workflows/ci.yml` adds only master's inputs and the
  `test-windows` job. A9's `npm test -- --reporter=verbose` is kept in the `test` job.
- **The conflict, recomputed:** `git merge-tree --write-tree bbf9d07 ebda33d` exits 1, with one conflict in `ci.yml`.
  The conflicted tree differs from `afe1c3b` only in that file, by the 4 marker/`npm test` lines. Master's side of the
  conflict ran from its `run: npm test` line to the end of the file. The resolution kept A11's line and master's whole
  block, which is the handoff's "named both edits". **No other path differs** from the automatic merge.
- **Today's master** is `36a33bc`. `git merge-tree --write-tree origin/master a69f07d` **exits 0** (tree `e25e0d4`, no
  conflict). `git diff --stat ebda33d origin/master -- open-brain .github` is empty, so master has not touched the
  product or CI since the R94 merge.

### Check 6 — the re-done R85 search: **checked, not accepted. The table misses sites, and one cell differs from what the code prints**

I searched `configwatch.ts` at `7200e1c` for every template or string that builds a side (a record's before/after, a
note naming a path's state, or the summary that describes the restore). The handoff's 16 rows are accurate for what they
list, with two exceptions (items 1 and 3 below). Missed or wrong:

1. **`closeAndRestore`'s summary sentence `:880–:887` is not in the table.** For the R90 record (the table's "close
   record :824" row: "No removal, no `a other was created`"), the code also prints `Every file was put back by bytes
   before any git call read the repository.` when nothing else is unrestored. That is A12-1 (check 1). The row is
   accurate about what it lists and silent about the sentence that goes wrong.
2. **The machine side's final `after` block, `:1394–:1404`, is not in the table.** It builds six texts:
   - a path-level type change, `type change: <p> is a <kind>; ${linkSide(end)}`;
   - a gained or lost name, or a different handle: `${reason}; not read; ${factText}`;
   - `unreadable; current ${factText}`;
   - a bare `absent (<code>)` reason;
   - `unwatched: ${reason}; not read`;
   - `not read: loop base ${baseText(base)}; current ${resolvedPath} ${factText}`.

   By reading, its output is:
   - **failed `lstat`/`realpath`** (a stage start that was not observed, so the unobservable row does not take it):
     `unwatched: did not resolve: <code>; not read`, no zeroes; a link at the path prints `type change: … ; link: …;
     does not resolve (<code>)`;
   - **failed `stat`/read**: `unreadable; current type file dev … ino …` (the real facts);
   - **link**: `type change: <p> is a symlink; ${linkSide}`;
   - **absent**: `absent (ENOENT)`.

   It contains `baseText`, which is item 3.
3. **`baseText :1335`, the "Failed `lstat`" cell is "—", but the code prints `absent at loop base` for a loop base whose
   `realpath` failed.**
   - `observe()` (`:1141–:1145`) sets `resolvedPath: null` both for an absence (`absent (ENOENT)`) and for a failure
     (`did not resolve: EACCES`, `errno` set). `baseText` checks only `resolvedPath === null && lexicalKind !==
     "symlink"`.
   - The runtime does not refuse such a base: `runtime.ts:628–:629` records `baseNotes()`, which says `unwatched: did not
     resolve: EACCES`.
   - **Shape** (`qa149-a12-probe2.test.ts`): the XDG `git` dir is 000 at the loop base and 755 at the stage start, which
     R69's "appeared" rule reads. The role then gives `config` a second name, so the close is not read.
   - **Measured:** on tcm, real chmod (run 8, `36293057531`), Q149-S6-BASE-EACCES prints `before: "c58c9189f417310c type file dev 66306 ino 5121125 nlink 1 size 20 …"`, **`after: "not read: loop base absent at loop base; current …/real-xdg/git/config type file dev 66306 ino 5121125 nlink 2 size 20 …"`**, with the base note `machine config xdg …/real-xdg/git/config unwatched: did not resolve: EACCES.` The wrapped-`realpath` twin, Q149-S6-BASE-EACCES-MOCK, prints the same on tcm and on win32. The loop base was not absent. It could not be resolved, and the record says `absent`: the A10-3 class, on the base side
   - **Not caused by A12:** `baseText` is R79's (A10). It is in scope here only because the re-done search is the
     deliverable. I report it as an observation (§7, O-1) and do not rate it as a defect of A12.
4. **Listed as present, not in the table, output correct by reading** (so not scored):
   - `closeAndRestore`'s tree-root record `:785–:790` (`before: baseKind`, which prints a bare `other` for a code-less
     non-file tree root; a failed `lstat` there refuses the open, per QA 130 §3.1);
   - the `unrestored` family beyond `:850`: `:814` (`unrestorable: under unlisted … begin ${stateHash(b)}`), `:856`,
     `:858`, `:862` (`read back ${stateHash(now)}, expected ${stateHash(b)}`), `:865` and `:869`;
   - `readFailuresAtOpen :665` (`unreadable: <p> (<code>)`), the message's `Read failures:` (`:902–:905`) and
     `Unlisted:`;
   - the machine side's `baseNotes :1234` (`unwatched: ${reason}`).

   Each one embeds `stateHash` or the code, so for a failed `lstat` it prints R90's text or the code.

The line numbers in the handoff's table are within a few lines of the code (the close record is `:826–:837`; the table
says `:824`).

### Check 7 — regressions: **FAIL, one: Q130-R83-SUBDIR-NOSEARCH-PLANT (A12-1). No other regression**

- **tcm, by test name, QA 130's run 1 (`36279688475`, A11 + 15 probe files) against mine (`36292117395`, A12 + the same
  15 byte-exact + my two files):**
  - **healed:** Q130-R85-REPO-UNREADABLE-ZEROED, -VIA-FILE000, -ABSENT-ANCESTOR-LINK;
  - **new red among QA 130's rows:** Q130-R83-SUBDIR-NOSEARCH-PLANT;
  - every other test has the same status. My four new reds are check 1's rows.
  - The reds are CA-9 (T-182, not A12's) and **the same 14 carried reds QA 130 listed** (QA 99's R69-GITCONFIG-FIRST,
    R70-HANDLE-FACTS, R71-UNREADABLE-START, -AT-BASE, -BASE-LABEL; QA 96's TRADE-LOCKRENAME, R65-FACTS,
    HANDLE-NLINK-BASE; QA 94's TRADE-SAME, NO-SEAM CONTROL; QA 92's STOW-LOOP; QA 89's A4-1 R and R29 row shape; QA
    104's R72-UNREADABLE-LOOP).
- **QA 108's positives, byte-exact** (`qa108-a10-probe` `1ef4dab4`, `-probe2` `1df369d9`, `qa108-r61-copy`
  `2e52ff8f`): **43 of 43 `✓` on tcm**, as on A11. On win32 every one has the same status as QA 130's baseline.
- **win32, QA 130's baseline against mine** (`cmpbase.mjs`; QA 130's 36-file list, plus A12's row file and my probe and mock
  files: 39 files and 425 tests): **411 tests with the same status, 1 changed** (Q130-R86-ABSENT-ANCESTOR-LINK, failed → passed). The 7 win32
  carried reds have **byte-identical first failure lines** (`cmpmsg.mjs`, after normalising inodes, hashes and temp
  paths).
- **The candidate's own rows on tcm:** all 7 of `configwatch-a12` `✓`.
- **Full suite:** §4.1.

### Check 8 — my own mutants, at least one per ruling: **done; each killed**

See §3. R90 has two mutants (bullet 1's text and bullet 2's code), R91 one and R92 one, and every one is killed. There is
also a known negative for A12-1 (`FIX-q149`), which kills nothing.
Two of my mutants were not run on tcm, because the budget went to QA 130's three and the known negative. `q149-r90-code` is killed on win32 by Q149-MOCK-R90-TEXT. `q149-r92-factlabel` is killed on win32 by R92's known positive, which runs there.

## 3. Mutants

Each is one edit to `configwatch.ts` at `7200e1c`, specified in `mutants-a12.mjs` as `{find, replace, count}`. The count
is asserted against `7200e1c`'s blob before archiving, the edit is read back, and `tsc --noEmit` exits 0 for every one
(`build12.mjs`, QA 130's `build11.mjs` repointed). Each CI branch is the probe commit `c35fb40` plus that one file
(`git diff --stat c35fb40 <head>`: one file, one hunk each). Win32 kills are against my BASELINE (`arch/A12`), and tcm kills are
against the probe run `36292117395` (`cidiff12.sh`).

| Mutant | Ruling | Edit at `7200e1c` | win32 kills (local) | tcm run | tcm kills |
|---|---|---|---|---|---|
| `q130-r85-factsdrop` (QA 130's, re-applied) | R93 (A10-4's shape) | the no-link `return factText(s)` becomes `return "no facts: realpath failed"` | 0 (its killing rows are POSIX) | `36292138310` | **R93-STAT-FACTS**, Q108-R79-FILE000-ALONE |
| `q130-r88-lstat` (QA 130's, re-applied) | R93 (R88, an `lstat` failure at the open) | `if (!state?.readError \|\| state.dev === null) continue;` | 0 (POSIX) | `36292144008` | **R93-LSTAT-AT-OPEN**, Q130-R88-NOSEARCH-AT-OPEN, Q130-R83-227 |
| `q130-r85b-via` (QA 130's, adapted) | R93 (R85b's parent-link branch) | R91's `if (s.viaLink !== null) { … }` block deleted | 0 (POSIX) | `36292149195` | **R93-PARENT-LINK**, R91-VIA-FACTS, Q130-R85-VIA-FILE000, -VIA-TARGET000 |
| `q149-r90-typeword` | R90 bullet 1 | `; no facts: lstat failed` → `; type file; no facts: lstat failed` | Q149-MOCK-PRESENT-CONTROL; Q149-MOCK-R90-TEXT (probe 2) | `36292154203` | **R90-STATEHASH**, Q149-MOCK-PRESENT-CONTROL. Q130-R85-REPO-UNREADABLE-ZEROED **survives**: it checks only for zeroes |
| `q149-r90-code` | R90 bullet 2 | `const code = a.readErrno ?? "UNKNOWN"` → `const code = "UNKNOWN"` | **Q149-MOCK-R90-TEXT** (probe 2). The 39-file batch: 0, because the rows that see the code are red on A12 at a later assertion | not run | — (by reading, the developer's R90-ABSENT-UNOBSERVABLE asserts `absent → unobservable (EACCES)`) |
| `q149-r91-linkdrop` | R91 | `${ancestorLinkText(s)}; resolves to: …` → `resolves to: …` | 0 (POSIX) | `36292158435` | **R91-VIA-FACTS**, Q130-R85-VIA-FILE000 |
| `q149-r92-factlabel` | R92 | the `absent →` branch prints `linkSide(end)` (for a non-link, the resolved file's facts) where `ancestorLinkText(end)` was | **Q130-R86-ABSENT-ANCESTOR-LINK**, Q108-R79-ANCESTOR-ZEROED | not run | — |
| `FIX-q149` (known negative) | A12-1 | the R90 branch also does `unrestored.push(\`${path} (absent at the open; cannot be lstat'd at close (${code}); not removed)\`)` | **0 kills**; heals Q149-MOCK-HOOKS-ONLY and -PLUS-CONFIG; probe 2 unchanged | `36292163102` | **0 kills**; heals 5: Q130-R83-SUBDIR-NOSEARCH-PLANT, Q149-C1-HOOKS-ONLY, -SUBDIR-ONLY, Q149-MOCK-HOOKS-ONLY, -PLUS-CONFIG. 15 failed = CA-9 and the 14 carried reds |

- **The win32 batch** (`runmut12.sh`, 39 files, 425 tests: 267 passed, 9 failed and 149 skipped at BASELINE) ran
  03:40–04:00Z, one tree at a time, with nothing beside it. Probe 2 (`runp2.sh`) ran after it, on BASELINE,
  `q149-r90-code`, `-typeword` and `FIX-q149`. On BASELINE: 1 failed (S6-MOCK, O-1), 1 passed (R90-TEXT), 1 skipped.
- **Every ruling R90–R92 has at least one of my mutants killed.** R93's three are QA 130's own, each killed by the developer's adopted row.

## 4. Full suite and CI

### 4.1 The full suite

**04:00:53Z → 04:04:29Z, `SUITE_EXIT=0`, captured unpiped (`suite12.sh`).**
- **Where:** `C:/qa-scratch/qa149/wt-a12/open-brain`, a detached worktree at `a69f07d`, after `npm ci`, `tsc --noEmit`
  and `npm run build` (each exit 0). 0 porcelain entries before and after, and HEAD is `a69f07d` after.
- **The Defender-on control (T-190):** `TEMP`=`TMP`=`C:\Users\AARONM~1\AppData\Local\Temp` (the driver's
  `QA_DEFAULT_TEMP`).
- **Result:** `Test Files 93 passed | 8 skipped (101)`, **`Tests 1351 passed | 77 skipped (1428)`**, duration 213.41 s,
  0 matches for `Unhandled|onTaskUpdate`. **The total, 1428, equals CI's on the candidate** (`36283457438`).
- **The 77 skips** are win32 skips of POSIX-only rows and the real-`claude` rows. That is QA 130's 70, plus A12's 7
  `configwatch-a12` rows, which are all `skipIf(isWin)`.
- **Processes** (`tasklist /V`, CSV, before and after): 215 and 212. Of claude, node, git and Cursor, only this
  session's `claude.exe` (PID 884) was present, before and after. The mutant batch had ended at 04:00:06, and probe 2's
  local runs had ended before the build.
- **Defender** (`MsMpEng.exe`, PID 3352) went from 9:05:10 to 9:09:39 of CPU: **4 min 29 s during the 3 min 36 s
  suite**. So it was scanning, as the control intends.

### 4.2 CI

- **The candidate's own runs, every one the handoff cites, re-read per test** (`cilog12.sh`):
  - red `36283323236` is head `974eade`: 5 failed (CA-9, R90-STATEHASH, R90-ABSENT-UNOBSERVABLE, R91-VIA-FACTS,
    R92-ABSENT-ANCESTOR) | 1418 | 5 (1428);
  - green `36283457438` is head `7200e1c`: 1 failed (CA-9) | 1422 | 5 (1428);
  - the seven mutant runs: `36283683383` `mut-r90-hash` → R90-STATEHASH; `36283685105` `-r90-created` →
    R90-ABSENT-UNOBSERVABLE; `36283686948` `-r91` → R91-VIA-FACTS; `36283688998` `-r92` → R92-ABSENT-ANCESTOR;
    `36283690952` `-r93-factsdrop` → R93-STAT-FACTS; `36283693006` `-r93-lstat` → R93-LSTAT-AT-OPEN; `36283694906`
    `-r93-via` → R93-PARENT-LINK and R91-VIA-FACTS.
  - **Each run's head is the branch the handoff names, and its reds are exactly the rows the handoff lists, plus CA-9.**
  - Each `mut-*` branch is one commit on `7200e1c` and changes one file (`git diff 7200e1c <branch>`).
- **This seat's runs**, each dispatched with `gh workflow run CI --ref <branch>`, all on tcm with git 2.43.0, `hosted`
  and `windows` left false:

| # | Branch (`qa/loop-15-slice-3-a12-…`) | Head | Run | Runner | Tests (failed \| passed \| skipped) | What it shows |
|---|---|---|---|---|---|---|
| 1 | `probe` | `c35fb40` = `7200e1c` + QA 130's 15 probe files byte-exact + `qa149-a12-probe`, `-mock` | **`36292117395`** | tcm-2 | 20 \| 1568 \| 5 (1593) | the base. Against QA 130's `36279688475`: 3 healed (R90–R92's positives), **Q130-R83-SUBDIR-NOSEARCH-PLANT red**, my 4 check-1 rows red, CA-9 and the 14 carried reds |
| 2 | `m-r85-factsdrop` | `76242f8` | `36292138310` | tcm-2 | 22 \| 1566 \| 5 | 2 kills |
| 3 | `m-r88-lstat` | `066e20d` | `36292144008` | tcm-1 | 23 \| 1565 \| 5 | 3 kills |
| 4 | `m-r85b-via` | `25db284` | `36292149195` | tcm-1 | 24 \| 1564 \| 5 | 4 kills |
| 5 | `m-r90-typeword` | `1526950` | `36292154203` | tcm-2 | 22 \| 1566 \| 5 | 2 kills |
| 6 | `m-r91-linkdrop` | `33ad1e0` | `36292158435` | tcm-2 | 22 \| 1566 \| 5 | 2 kills |
| 7 | `fix-q149` | `7a24bad` | `36292163102` | tcm-1 | 15 \| 1573 \| 5 | known negative: 5 healed, **0 kills** |
| 8 | `probe2` | `b462496` = 1 + `qa149-a12-probe2` | `36293057531` | tcm-1 | 22 \| 1569 \| 5 (1596) | O-1 on Linux (real chmod and wrapped); Q149-MOCK-R90-TEXT `✓` |

**Budget: 8 of 8 used.** Each mutant or FIX branch differs from run 1 in its one source file (`git diff --stat c35fb40`:
one file each), and run 8 differs in its one test file. Every run fails CA-9 (T-182), as the dispatch says.

## 5. What could not be verified, stated so nobody inherits it as settled

- **A real EACCES shape on win32.** This process is elevated and holds `SeBackupPrivilege`, so an ACL cannot deny it
  `lstat`. The win32 rows for check 1 wrap `lstatSync` for one path (`qa149-a12-mock.test.ts`). They reach the same
  branch and print the same message as tcm's real chmod rows, but they are a wrapper, not the OS.
- **Execution of the left plant.** I did not test whether a later human `chmod` followed by a checkout runs the plant.
  That is the ordinary behaviour of git hooks, and it is outside the harness.
- **`q149-r90-code` and `q149-r92-factlabel` on tcm.** There was no run left for them. Both are killed on win32 (§3).
- **The carried reds' messages on tcm.** They are compared by name only, against QA 130's run. On win32 the first
  lines are compared, and they are byte-identical.

## 6. What the checks I ran cannot see

- The spy counts `spawnSync` calls whose argv names git. A git call made another way (`execFileSync`, `spawn`) would not
  be counted. QA 130's spy is unchanged, and the runtime's git helper calls `spawnSync("git", …)`
  (`git.ts:222`).
- My search (check 6) is by reading one file. A side built outside `configwatch.ts` (for example in `runtime.ts`'s
  wrapping of the message) is not in R85's scope and was not searched.

## 7. Defects and observations

| Id | Severity | What | Evidence |
|---|---|---|---|
| **A12-1** | **medium** (R90 "never prints invented facts"; R77 "any unrestored path stops before git"; CA-15 clause 4) | R90's branch (`configwatch.ts:826–:837`) records `absent → unobservable (<code>)` and `continue`s without adding to `unrestored`. When it is the only change not put back: (a) the message claims `Every file was put back by bytes before any git call read the repository.` while the planted file stays in the tree; (b) the runtime's R77 stop does not fire, and 6 git calls follow the role (0 on A11). QA 130's Q130-R83-SUBDIR-NOSEARCH-PLANT goes red | tcm `36292117395`: Q149-C1-HOOKS-ONLY, -SUBDIR-ONLY, Q130-R83-SUBDIR-NOSEARCH-PLANT; win32 and tcm: Q149-MOCK-HOOKS-ONLY, -PLUS-CONFIG. Known negative `FIX-q149` heals all 5, 0 kills (`36292163102`) |
| O-1 | observation (not caused by A12; R79's site) | `baseText` prints `absent at loop base` for a loop base whose `realpath` failed with EACCES, and the handoff's table gives that cell "—" | tcm `36293057531` (real chmod and wrapped) and win32 (wrapped): Q149-S6-BASE-EACCES, -MOCK. The base note records the truth (`unwatched: did not resolve: EACCES`) |
| O-2 | observation (check 2) | R90's record is stored as `kind: "modified"` with `before: "absent"` in `FAILED.md`'s findings JSON | check 2 |
| (T) | test gap | No developer row asserts the summary sentence or the git calls for an R90-only record; R90-ABSENT-UNOBSERVABLE's `.git` 0600 shape has other unrestored paths, which hide it | check 1 |

## 8. Where the criteria, the rulings and the candidate disagree (returned, not scored)

1. **"Nothing is removed" is the handoff's phrase. The ruling says the path is "never `created`" and that "the
   unrestored note never says 'a other was created'".** The ruling asked for the note's wording to go. The candidate
   removed the note itself, so the path no longer reaches `unrestored` at all. I read R77 ("any unrestored path stops before
   git") as still binding on a path that was neither removed nor restored. If the planner reads R90 as licensing "not
   unrestored" for this path, the stop's loss is by design and only the summary sentence remains (a text defect, still
   R90's "never prints invented facts").
2. **"absent → unobservable" is on the repository side, where nothing is "observed" in the machine side's sense.** The
   repository side reuses the machine side's word. I accept it as R90's text and do not score the vocabulary.

## 9. This seat's error entries and near-misses this session

**Error entries (escaped):** none known.

**Near-misses (caught in-process, not numbered):**
- **My first `cmpmsg.mjs` compared three lines of each failure**, so every carried red showed `DIFF`: the stack line holds
  the scratch directory (`qa130` against `qa149`). I compared the assertion line alone. The first version was written
  through a shell heredoc that mangled a backslash; I rewrote it with the file tool.
- **`q149-r90-code` had 0 kills on win32 at first**, because the only rows that saw the code were already red at
  baseline, on their later assertion. I added a text-only row, Q149-MOCK-R90-TEXT, in `qa149-a12-probe2.test.ts` (a
  new file), which is green on A12. It also went to tcm in run 8 (`✓`). The 39-file batch and runs 1–7 do not carry probe 2; §3 names which result comes from which.
- **I ran nothing beside the mutant batch or the suite.** The one exception is CI, which is remote.

**Denied or blocked calls, stated because the dispatch stops a line of work at a denial:**
- **`Monitor` was denied** (`dontAsk` mode; it is not in the driver's `--allowedTools`). I had wanted it only to wait
  for my own local batch log to show `DONE`. I did not retry it. I waited with a plain Bash `until grep -q DONE …; do
  sleep 5; done`, which is the harness's own suggested form. No other line of work was touched.
- **A foreground `sleep 100` was blocked by the harness** (not a permission denial), for the same wait. I used a
  background Bash wait instead.
- **Nothing else was denied.** No `git push` was attempted outside `push-qa.mjs`, and no `gh pr`, `gh api`, `gh release`
  or `gh repo` call was made.

## 10. Reproduction

The scripts are tracked at **`docs/loops/qa-scripts-a12/`** on this seat's report branch, byte-identical to the copies
that ran, with a README.

| Branch (pushed with `push-qa.mjs`, read back) | Head | What |
|---|---|---|
| `qa/loop-15-slice-3-a12-probe` | `c35fb40` | A12 `7200e1c` + QA 130's 15 probe files (byte-exact from `5564ef6`) + `qa149-a12-probe.test.ts`, `qa149-a12-mock.test.ts` |
| `qa/loop-15-slice-3-a12-probe2` | `b462496` | + `qa149-a12-probe2.test.ts` |
| `qa/loop-15-slice-3-a12-m-r85-factsdrop`, `-m-r88-lstat`, `-m-r85b-via` | `76242f8`, `066e20d`, `25db284` | QA 130's three R93 mutants, re-applied |
| `qa/loop-15-slice-3-a12-m-r90-typeword`, `-m-r91-linkdrop` | `1526950`, `33ad1e0` | + my mutants |
| `qa/loop-15-slice-3-a12-fix-q149` | `7a24bad` | + FIX-q149 (A12-1's known negative) |
| `qa/loop-15-slice-3-a12-report` | this commit | this report and `docs/loops/qa-scripts-a12/` |

Local only (not pushed; no CI run): `qa/loop-15-slice-3-a12-m-r92-factlabel` `a8824af` and `-m-r90-code` `9c7c47b`.

**A12-1 in four steps (Linux, not root):**
1. Start with a repository whose `.git/hooks` is empty.
2. The developer role writes `.git/hooks/post-checkout` and runs `chmod 600 .git/hooks`.
3. The stage fails `stage-changed-config`, with the record `<common>/hooks/post-checkout (absent → unobservable (EACCES);
   …)` and the sentence `Every file was put back by bytes before any git call read the repository.`
4. `post-checkout` is still there. The runtime ran `for-each-ref`, `symbolic-ref`, `rev-parse` and `status` after the
   role.

## 11. Handoff to the next QA session

1. **Known positives on A12 `a69f07d`:**
   - A12-1: Q149-C1-HOOKS-ONLY, -SUBDIR-ONLY and Q130-R83-SUBDIR-NOSEARCH-PLANT (Linux);
   - A12-1: Q149-MOCK-HOOKS-ONLY and -PLUS-CONFIG (every platform);
   - O-1: Q149-S6-BASE-EACCES (Linux) and -MOCK (every platform), in `qa149-a12-probe2.test.ts`.
   - **Known negative:** `FIX-q149` (`36292163102`: 5 healed, 0 kills).
2. **The carried reds** are QA 130's 14, unchanged on tcm. On win32, 7 of them have byte-identical first lines.
3. **This PC runs the seat elevated with `SeBackupPrivilege`.** An ACL cannot make a path unreadable to it, so an EACCES
   shape needs tcm, or a wrapped `node:fs` call (the pattern in `qa149-a12-mock.test.ts`).
4. **`gitAfterRole` in a row is the check that caught A12-1.** A text-only row (such as QA 130's REPO-UNREADABLE-ZEROED)
   passes on A12.

## 12. Open for the planner

None of these blocked the rest of the work; each says what I did instead.

1. **A12-1's severity, and whether R90 licenses "not unrestored".** I rated it medium and rejecting (§7, §8 item 1). The
   fix is one line (`FIX-q149`: the R90 record also goes to `unrestored`), and it heals every row and kills nothing on tcm
   and win32. **If the planner rules that R90's path is allowed to skip `unrestored`**, the stop's loss is by design, the
   summary sentence is the only defect left, and the verdict would still be REJECTED on R90's "never prints invented
   facts".
2. **A distinct `ConfigChange.kind` for R90's record** (check 2). I recommend `"unobservable"`; nothing gates on `kind`.
3. **O-1 (`baseText`'s `absent at loop base` for a base that failed EACCES).** It is not A12's, and it predates A11.
   Should it join A10-8's family, or be a ruling for the next round? I did not score it.
4. **Should the next round's rows include a `gitAfterRole` assertion for each R77 shape?** The developer's R90 row
   measures text only, which is why A12-1 was not seen.
5. **All 8 CI runs are used.** `q149-r90-code` and `q149-r92-factlabel` are killed on win32 only (§3).

**Dispatch items, each done or written up:**
- Check 1, the planner's suspected defect: reproduced on tcm and win32, with the exact message (Verdict, §2).
- Check 2, every consumer of `ConfigChange.kind` (§2).
- Check 3, R90–R92's positives from `5564ef6` byte-exact (§2).
- Check 4, R93 against QA 130's own three mutants re-applied (§2, §3).
- Check 5, R94's `ci.yml` against both parents, and `merge-tree` against today's master (§2).
- Check 6, the re-done R85 search, checked by my own search (§2).
- Check 7, QA 130's full row set and QA 108's positives byte-exact, and the full suite once on the default temp (§2, §4.1).
- Check 8, my own mutants, one or more per ruling (§3).
- CI on tcm, **8** of 8, no laptop run. Model and effort (§0.1). Elevation and `SeBackupPrivilege` (header).
  Machine: `DESKTOP-O4EGB1E`. No `/end`.

QA-149: REPORT COMPLETE
