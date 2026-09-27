# A10 developer handoff

Record 107, continuing through a network-error restart. Model: Grok 4.7. No effort setting is shown. GitNexus impact is unavailable on this seat. `/sync` reports the index 27 commits behind HEAD, indexed at `6bd97f2`.

Candidate `loop/15-slice-3-candidate-a10`. The product tree Atlas accepted is `ecf1f627e167ccded5b823d8b8f9f651a1427d45`. This file is the commit after it. CA-9 (T-182, `claude` lacks `--permission-prompts`) fails every tcm run and is not this seat's.

## No merge of master

Master since `9bc06e3` (which A10 carries) has changed only `docs/` and `.agents/`. `git diff --name-only 9bc06e3 origin/master` lists no other path. No merge of master is needed.

## Commit table

`git diff --stat` for each commit in `6bd97f2..ecf1f62`, oldest first. The ruling is assigned from the hunk's file and class, not from the subject.

| SHA | diff --stat | Hunk |
|---|---|---|
| `819679d` | 5 files, +490 −13. `configwatch.ts`, `runtime.ts`, `configwatch-r77-contain.test.ts`, `qa104-a9-probe2.test.ts`, `qa104-a9-probe3.test.ts` | R77. First containment. The mutant set cut on this SHA is superseded (below). |
| `21acfc3` | 3 files, +91 −22. `configwatch.ts`, `runtime.ts`, contain test | R77. An unlisted directory fails the stage before git. |
| `2b7df2f` | 3 files, +45. `configwatch.ts`, `runtime.ts`, contain test | R77. Begin refuses an unlisted directory (`config-watch-unestablished`). |
| `a88fa10` | 1 file, +1 −1. `configwatch.ts` | R77. The unlisted list is declared before the examined count. |
| `4ba3297` | 2 files, +7 −2. `configwatch.ts`, contain test | R77. An unlisted directory is not pushed into the link list. |
| `763611a` | 1 file, +1. `configwatch.ts` | R77. The comment that begin refuses the tree. |
| `9fe71a2` | 1 file, +21. contain test | R77. An unlisted close is not an ok verdict. |
| `340f77e` | 1 file, +34. this handoff | R77 record. |
| `b9e742d` | 1 file, +2 −1. contain test | R77. The unlisted close is not a lost-file change. |
| `a00d2fe` | 1 file, +1. contain test | R77. An unlisted empty tree is not a file change. |
| `d14a874` | 3 files, +130 −2. `configwatch.ts`, `runtime.ts`, contain test | `ConfigWatch` hunks: R77. `MachineConfigFinding`, `MachineConfigWatch`, `FailureCode`, and `runLoopInner`: R82. The test file carries both. |
| `1c26983` | 1 file, +3 −1. this handoff | R77 record. |
| `27b24cb` | 1 file, +3 −2. `configwatch.ts` `MachineConfigWatch` | R82. Only a failed observation stops the machine stage. |
| `9290676` | 1 file, +26 −21. `configwatch.ts` | R82. The unobservable code is the catch's own code. |
| `3771d53` | 1 file, +4 −2. `configwatch.ts` | R77. Restore does not chmod through a symlink. |
| `c923550` | 1 file, −4. `configwatch.ts` | R77. Restore does not chmod the old path. |
| `258dfbf` | 1 file, +78. `configwatch-r77-hardlink.test.ts` | R77. The mode-000 hard-link row. |
| `e7fbe78` | 1 file, +2 −1. hard-link test | R77. The row reads the victim before chmod 000, and the mode from lstat. |
| `fb2fbe9` | 2 files, +74 −5. `configwatch.ts` `MachineConfigWatch`, `configwatch-r78-read-facts.test.ts` | R78. A read side prints the hash and the facts. |
| `f45c4c9` | 2 files, +50 −3. `configwatch.ts` (`resolutionUnobservable`, `MachineConfigWatch`), contain test | R82. ENOENT and ENOTDIR are absence. |
| `7563484` | 1 file, +33 −1. this handoff | R78 record. |
| `9f55563` | 3 files, +154 −16. `configwatch.ts` `MachineConfigWatch`, `configwatch-links.test.ts`, `configwatch-r79-sides.test.ts` | R79. A side prints the facts the runtime has. The links hunks are R45's machine before and R71 A6-5. |
| `afee764` | 1 file, +2 −1. `configwatch-links.test.ts` R61 | R79. A dangling link's mtime is not a read hash. |
| `0a01d4a` | 1 file, +1 −1. this handoff | R79 record. |
| `e6a3fd4` | 6 files, +186 −20. `configwatch.ts` (ConfigWatch unread-file note and `MachineConfigWatch` texts), `runtime.ts` (`machineChangeReported`), `configwatch-a7-seam.test.ts`, `configwatch-links.test.ts`, `configwatch-r80-report.test.ts`, `configwatch-r80-texts.test.ts` | R80. |
| `e8fce2a` | 1 file, +8 −7. `configwatch-r80-texts.test.ts` | R80. Rejected. The fact rows were weakened to the target's stat. |
| `ecf1f62` | 2 files, +46 −11. `configwatch.ts` `MachineSnap` / `MachineConfigWatch`, `configwatch-r80-texts.test.ts` | R80. The link's lstat facts and the resolved object's facts, labelled. |

## Class list at `6bd97f2`

Unguarded filesystem calls in the config window:

- `identify` rethrew every `lstat` / `readlink` code other than ENOENT and ENOTDIR. Callers: link ancestor, resolution, `readState`, `currentFiles`, begin, close, observe, base notes.
- `listTree` rethrew `readdir`. Callers: `repositoryLinksAtBase`, `currentFiles`, begin, close.
- `readState` contained only EACCES and EPERM.

Already contained, and left there: `opensSame`; observe's parent `realpath`; observe's `realpath` and `stat`; observe's `open` / `fstat` / `read`.

## R77

Containment stays in `identify`, `listTree`, and `readState`. An unlisted directory is not pushed into the link list. Begin refuses the same trees (`config-watch-unestablished`). At close, an unlisted directory makes the verdict not ok, names the directory and its code, and counts in `examined`. Any unrestored path or unlisted directory stops the stage before git. A directory that replaced a file is not removed. Restore does not chmod the old path. `chmodSync` follows symlinks and hard links, so the kind-file guard was not enough; the chmod of the old path is gone.

Rows live in `configwatch-r77-contain.test.ts` and `configwatch-r77-hardlink.test.ts`: R77-IDENTIFY, OBSERVE-BEGIN, OBSERVE-COMPARE, LISTTREE, BEGIN-TREE, CLOSE-TREE, BEGIN-UNLISTED, CLOSE-UNLISTED, READ-EIO, GIT-AFTER-BREAK, UNRESTORED-HOOK, UNLISTED-CONTENTS, and R77-MODE000-HARDLINK.

Red of the close-verdict hole: `b8cef69`, CI 36129234932. The row that empties hooks before begin and asserts `changes.length === 0` and `ok === false` is the extra failure.

Green after that row, `a00d2fe`, CI 36129231903: only CA-9 and `R72-BEFORE-ABSENT-DANGLING`. Green of the hard-link row, `e7fbe78`, CI 36130766787: the standing pair only.

Mutants, each one source change on `763611a`, tsc clean, tcm. Every run also failed CA-9 and `R72-BEFORE-ABSENT-DANGLING`.

| Mutant | SHA | Run | Rows it reddened |
|---|---|---|---|
| (a) identify rethrows | `7f64964` | 36128093969 | R77-IDENTIFY, OBSERVE-BEGIN, OBSERVE-COMPARE, R73-LSTAT-EACCES-UNIT, R73-LSTAT-EACCES-LOOP |
| (b) listTree readdir uncaught | `bd83cce` | 36128135931 | R77-LISTTREE, BEGIN-TREE, CLOSE-TREE, BEGIN-UNLISTED, CLOSE-UNLISTED, R72-REPO-TREE-EACCES-LOOP |
| (c) readState EACCES/EPERM only | `e1c7051` | 36128168740 | R77-READ-EIO |
| (d) stop before git removed | `a514fc1` | 36128210358 | R77-CLOSE-UNLISTED, GIT-AFTER-BREAK, UNRESTORED-HOOK |
| (e) close `ok` ignores unlisted | `895d8a5` | 36128242271 | none at loop level |
| (e) killed | `b8cef69` | 36129234932 | the isolated close-verdict row |
| (f) begin does not refuse | `18db97b` | 36128283292 | R77-BEGIN-UNLISTED |
| (i) contents of an unlisted directory | `9e0dfb1` | 36131048854 | R77-UNLISTED-CONTENTS |
| (iii) chmod of the old path | `9290676` | 36130028474 | R58 (b)3, victim mode 493 vs 420. Historical. Not recut. |

(e) on `895d8a5` survives at loop level because the stop before git still fails the stage.

Hard-link runs that are not the green: `258dfbf` CI 36130489186 failed because the test read the mode-000 victim (EACCES). `a03fcaa` CI 36130492138 failed on the mode, not on EACCES. The corrected red of chmod-the-old-path is `d29c168`, CI 36130769900, `expected 420 to be +0`.

## R78

A read side prints `<hash> type <kind> dev <dev> ino <ino> nlink <nlink> size <size> mtimeNs <mtimeNs>`.

Rows: `R73-READ-STABLE-FACTS`, `R73-READ-CHANGE-FACTS`.

Red, tests on `e7fbe78`: `c065652`, CI 36192722723. 4 failed | 1188 passed | 5 skipped (1197). Extra: both R73-READ rows. Plus CA-9 and `R72-BEFORE-ABSENT-DANGLING`.

Green: `fb2fbe9`, CI 36131825963. 2 failed | 1190 passed | 5 skipped (1197). Only CA-9 and `R72-BEFORE-ABSENT-DANGLING`.

Mutant, a read side prints the hash alone: `ec24c67`, CI 36192708146. Extra: the same two rows.

## R79

An unreadable stage start is `unreadable; stage start <facts>` on every combination. A missing path is `absent (ENOENT)`. A loop base that did not exist is `absent at loop base`, never zeroed facts. A dangling link keeps its lstat facts.

Rows in `configwatch-r79-sides.test.ts`: R72-BEFORE-BARE-READ, R72-BEFORE-BARE-TWONAME, R72-BEFORE-BARE-LINK, R73-DANGLING-STABLE, R73-ABSENT-BEFORE-CODE. `R72-BEFORE-ABSENT-DANGLING` in `qa104-a9-probe2.test.ts` goes green here.

Red, tests on `f45c4c9`: `b44cb1d`, CI 36195158562. 7 failed. Extra: the three BARE rows, R73-DANGLING-STABLE, R73-ABSENT-BEFORE-CODE, `R72-BEFORE-ABSENT-DANGLING`. Plus CA-9.

`9f55563`, CI 36195135060, is not the green. R61 went red because `/[0-9a-f]{16}/` matched mtime digits. `afee764` narrows the detector. Mutant `8421503`, CI 36195704206, puts a hash back in front of a side and R61 goes red on `not claimed as read`.

Green: `afee764`, CI 36195386155. 1 failed | 1197 passed | 5 skipped (1203). Only CA-9.

| Mutant | SHA | Run | Rows it reddened |
|---|---|---|---|
| (a) unreadable without facts | `646000f` | 36195723043 | R72 in-place unreadable, R71 A6-5, the three BARE rows |
| (b) absent without the code | `f07268f` | 36195745609 | R45, R73-ABSENT-BEFORE-CODE |
| (c) zeroed loop base | `b57b331` | 36195768996 | R73-ABSENT-BEFORE-CODE (`dev null`) |
| (d) dangling drops lstat | `820965e` | 36195795635 | R73-DANGLING-STABLE, R72-BEFORE-ABSENT-DANGLING |

## R80

At `ecf1f62`. A gained name is `the object gained a name inside open` (`configwatch.ts:1127`). A lost name is `the object lost a name inside open` (`:1129`). A different inode stays `handle is a different file`. The label is `loop base`, at the type-change string (`:1282`) and the last branch (`:1297`). `machineChangeReported` returns `f.changed` (`runtime.ts:1633`), so equal texts are still reported. An unread repository file is `snapshot was file; unread, not restored` (`configwatch.ts:809`; that note was `not followed` at `:755` on `6bd97f2`). The always-true comparison at `:1134` on `6bd97f2` is gone.

When `lexicalKind` is `symlink`, the text carries the link's lstat facts and, when the link resolves, the resolved object's facts, each labelled: `link: type symlink dev … ino … nlink … size … mtimeNs … readlink …; resolves to: type file …`. When it does not resolve: the link's facts plus `does not resolve (<code>)` (`:1227`). A watched file inside a junctioned directory stays lexical kind file and keeps the previous wording.

Rows: R74-GAINED-BASE, R74-GAINED-NEW, R74-LOST-NAME, R74-LABELS, R80-TYPECHANGE-FACTS, R80-ABSENT-SYMLINK-FACTS, R72-EQUAL-TEXT. R70 in `configwatch-a7-seam.test.ts` and links R74 follow the same words.

Red of the texts, tests on `0a01d4a`: `e10971c`, CI 36196648961. 7 failed | 1197 passed | 5 skipped (1209). Extra: R74-GAINED-BASE, R74-GAINED-NEW, R74-LOST-NAME, R74-LABELS, and the two fact rows. Plus CA-9. On that run the fact rows failed because the text carried the target, and the tests still asked for the link.

`e6a3fd4`, CI 36196622955, fails the two fact rows for that same reason, plus CA-9. `e8fce2a`, CI 36196931266, is 1 failed | 1204 passed | 5 skipped (1210), only CA-9, and it is rejected: the tests were changed to expect the target.

Red of the link facts on `e8fce2a`'s code: `016d3d8`, CI 36197418005. 3 failed | 1202 passed | 5 skipped (1210). Extra: R80-TYPECHANGE-FACTS and R80-ABSENT-SYMLINK-FACTS, each missing `link: type symlink`. Plus CA-9.

Green: `ecf1f62`, CI 36197403513. 1 failed | 1204 passed | 5 skipped (1210). Only CA-9.

| Mutant | SHA | Run | Rows it reddened |
|---|---|---|---|
| gained name says different file | `a44c797` | 36197666218 | R74-GAINED-BASE, R74-GAINED-NEW, R70. Each `not to contain 'different file'` |
| lost name says different file | `aef0244` | 36197704680 | R74-LOST-NAME, missing `the object lost a name inside open` |
| label says `base` | `c01634b` | 36197730757 | R74-LABELS (`loop base` missing) and links R74 (the capture is empty) |
| equal texts are not reported | `721b2ac` | 36197760017 | R72-EQUAL-TEXT, `expected false to be true` |
| link facts dropped (`linkSide` returns `factText`) | `31e1d4d` | 36197900577 | both fact rows, missing `link: type symlink` |
| resolved facts dropped | `42b5445` | 36197931021 | both fact rows, missing `resolves to:` |

The link kill and the resolved kill are different assertions. An early return inside the old `linkSide` failed tsc (the remaining `lexicalKind` comparison has no overlap); the shipped link mutant replaces the function with `factText`.

## R82

Fail closed on what the runtime cannot see. Code `machine-config-unobservable`. It fires only when `MachineSnap.errno` is set by the catch that saw lstat, realpath, stat, open, fstat, or read throw, and the code is not ENOENT or ENOTDIR. `resolutionUnobservable` (`configwatch.ts:119`) returns null for ENOENT and ENOTDIR and returns every other code. A path already unobservable at stage start stays a finding with `changed: false`. A visible machine change stays reported and the loop continues.

Rows: R82-MACHINE-UNOBSERVABLE, R82-ENOENT-IS-ABSENT.

Green of the ENOENT exclusion: `f45c4c9`, CI 36192597210. 2 failed | 1191 passed | 5 skipped (1198). Only CA-9 and `R72-BEFORE-ABSENT-DANGLING`. There is no separate red-at-base run. The mutant stands as the red.

| Mutant | SHA | Run | Rows it reddened |
|---|---|---|---|
| (ii) the machine stage does not stop | `ad8bc1c` | 36131090156 | R82-MACHINE-UNOBSERVABLE (`undefined` vs `machine-config-unobservable`) |
| ENOENT exclusion dropped | `14655c3` | 36192647557 | R82-ENOENT-IS-ABSENT, reported `machine-config-unobservable` with ENOENT |

## Superseded mutant set (`819679d`)

Cut on `819679d` before unlisted-at-begin and the any-unrestored stop. The branch names `mut-identify`, `mut-listtree`, `mut-readstate`, and `mut-stop` were left in place. These four runs are superseded. They are not the kill set. The kill set is (a)–(f) on `763611a`.

| Mutant | SHA | Run |
|---|---|---|
| identify rethrows | `aeffe6d` | 36126928970 |
| listTree lets readdir throw | `ed5e535` | 36126932759 |
| readState EACCES/EPERM only | `67e813a` | 36126935967 |
| stop before git removed | `a28c1c8` | 36126939707 |

`819679d` itself, CI 36126685699: 2 failed | 1180 passed | 5 skipped (1187). CA-9 and `R72-BEFORE-ABSENT-DANGLING`. No R77 row failed. The three holes (unlisted at close, kind other recorded as unlisted, any unrestored path) were fixed after it.

## Withdrawn runs

These failed at Typecheck. They are not test results.

| Run | Head | Why it is withdrawn |
|---|---|---|
| 36127125372 | `21acfc3` | `unlisted` was used before it was declared |
| 36127401305 | `2b7df2f` | the same declaration order |

`a88fa10` declares the list first. Its run 36127524043 failed at the Test step, after typecheck succeeded.

## Existing assertions that changed

| Row | Change | Reason | Ruling |
|---|---|---|---|
| R45, machine `compare` in `configwatch-links.test.ts` | `before` is `absent (ENOENT)`. The repository-side R45 stays `absent`. | A missing path names the code. | R79 |
| R61 | A side is a read only when `before` or `after` opens with 16 hex. The blob must contain `ino`. Was any 16 hex digits. | The old scan matched mtime digits in the facts. A read is a side that opens with the hash. Mutant `8421503` still goes red. | R79 |
| R70, `configwatch-a7-seam.test.ts` | contains `the object gained a name inside open` and does not contain `different file`. Was `handle is a different file` plus `gained a name inside open`. | A gained name is not a different file. The swap test still expects `handle is a different file`. | R80 |
| R71 A6-5 | `unreadable; stage start`, and not `absent`. Was `toBe("unreadable")`. | An unreadable stage start carries its facts. | R79 |
| links R74 | the regex is `not read: loop base`. Was `not read: base`. | The word base names the loop base. | R80 |
| R77-MODE000-HARDLINK | bytes are taken before chmod 000; the mode comes from lstat; bytes are read again after chmod back. | The owner cannot open a mode-000 file. The first form threw EACCES in the test (CI 36130489186). | R77 |
| R80-TYPECHANGE-FACTS and R80-ABSENT-SYMLINK-FACTS | `e8fce2a` expected the target's stat. `ecf1f62` restores `link: type symlink`, the link ino, and `readlink`, and adds `resolves to:` plus the target ino. | The test was right and the code was short. The two texts carry the link's lstat facts and, when it resolves, the resolved object's facts, each labelled. | R80, the link-fact ruling |

## Local-only evidence

The win32 R35 junction. tcm cannot run it. Command, from `open-brain`, after the ENOENT exclusion:

```
npx vitest run tests/harness/configwatch-r77-contain.test.ts tests/harness/configwatch-links.test.ts -t "R82-ENOENT-IS-ABSENT|R35: a machine-config junction" --reporter=verbose
```

```
 ✓ tests/harness/configwatch-r77-contain.test.ts > R77 containment at A9 > R82-ENOENT-IS-ABSENT: a machine path removed during the stage is absent (ENOENT) and the stage continues 3024ms
 ✓ tests/harness/configwatch-links.test.ts > CA-15 — restore does not follow links > R35: a machine-config junction at base is not refused, and one planted later is a type change 5662ms

 Test Files  2 passed (2)
      Tests  2 passed | 82 skipped (84)
   Start at  16:37:34
   Duration  8.02s (transform 546ms, setup 106ms, collect 2.08s, tests 8.76s, environment 1ms, prepare 1.47s)
```

R35 was already red on `e7fbe78` on this seat (`machine-config-unobservable`, errno ENOENT). It is green after `f45c4c9`. The log file `.r82-r35-local.txt` is untracked and is not part of the tree.

R78's first red, this Windows seat, before `fb2fbe9`. Both rows failed because the side was the hash alone. `R73-READ-STABLE-FACTS` expected the inode inside `df4af4363ba89046`. `R73-READ-CHANGE-FACTS` expected `size 19` inside `ab402cb9d8e3522a`.

## Not verified

No full local suite was run. The EACCES rows and the file-symlink rows skip on win32; this seat cannot `symlinkSync` a file (EPERM). Junctions work, and that is the R35 log above. QA 99's `R71-UNREADABLE-START` and `R71-UNREADABLE-AT-BASE` are not in this tree. They live on QA 99's probe branch. QA 108 re-scores them in R79's form.

## Rulings

`docs/loops/loop-15-slice-3-rulings-17.md` at `7f83fc0` on `origin/docs/session-100-qa99-dispatch`. A9 is rejected. The A10 brief is there.

`docs/loops/loop-15-slice-3-rulings-18.md` on the same branch. `68518ef` is R77 readings 1–8, R81, and R82. `7a81033` makes R82 precise after `d14a874`. `08e547d` is the current file: ENOENT and ENOTDIR are absence, not unobservable.
