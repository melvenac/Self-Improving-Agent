# A10 developer handoff

Continuing record 107, with tonight's context. Not a new session. Model: Grok 4.7. No effort setting is shown. GitNexus impact is not available on this seat.

## R78 and the R82 ENOENT precision

Accepted at `f45c4c922e0665ed6d5e44f17982c2091f32ace1`.

R78: a read side prints `<hash> type <kind> dev <dev> ino <ino> nlink <nlink> size <size> mtimeNs <mtimeNs>`. Candidate CI 36131825963, then the ENOENT commit's CI 36192597210, standing pair only. Redcheck `c065652` on `e7fbe78`, CI 36192722723, reddens `R73-READ-STABLE-FACTS` and `R73-READ-CHANGE-FACTS`. Hash-alone mutant `ec24c67`, CI 36192708146, reddens the same two rows.

ENOENT and ENOTDIR are absence. `resolutionUnobservable` returns null for those two codes and the record is `absent (CODE)`. There is no separate red-at-base run. Mutant `14655c3` (CI 36192647557) drops the exclusion, so every code is unobservable again, and that restores the pre-fix behaviour. The mutant stands as the red: `R82-ENOENT-IS-ABSENT` fails as `machine-config-unobservable` with ENOENT.

The win32 R35 junction is local-only. tcm cannot run it. Command, from `open-brain`:

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

## R79

A side prints what the runtime has. An unreadable stage start is `unreadable; stage start <facts>` on every combination. A missing path is `absent (ENOENT)`, and a loop base that did not exist is `absent at loop base` with no zeroed facts. A dangling link keeps its lstat facts. `R71 A6-5` now asserts that form. QA 99's `R71-UNREADABLE-START` and `R71-UNREADABLE-AT-BASE` are not in this tree.

## R77

Candidate `loop/15-slice-3-candidate-a10`. R77 tree before the verdict-unit row: `763611a4ff927fc59806ac85156a774b5dd6cf0c`. The unit row is `9fe71a2d64ca25f6aef1e41aefde6721812e481f`.

## Class list at `6bd97f2`

Unguarded filesystem calls in the config window:

- `identify` rethrew every `lstat` / `readlink` code other than ENOENT and ENOTDIR. Callers: link ancestor, resolution, `readState`, `currentFiles`, begin, close, observe, base notes.
- `listTree` rethrew `readdir`. Callers: `repositoryLinksAtBase`, `currentFiles`, begin, close.
- `readState` contained only EACCES and EPERM.

Already contained, and left there: `opensSame`; observe's parent `realpath`; observe's `realpath` and `stat`; observe's `open` / `fstat` / `read`.

## Placement

Containment stays in `identify`, `listTree`, and `readState`. An unlisted directory is not pushed into the link list. `repositoryLinksAtBase` does not report it; begin's `currentFiles` refuses the same trees (`config-watch-unestablished`). At close, an unlisted directory makes the verdict not ok, names the directory and its code, and counts in `examined`. Any unrestored path or unlisted directory stops the stage before git. A directory that replaced a file is not removed.

## Mutants

Each is one source change on `763611a`, tsc clean, tcm. Every run also failed CA-9 and `R72-BEFORE-ABSENT-DANGLING`.

| Mutant | SHA | Run | Rows it reddened |
|---|---|---|---|
| (a) identify rethrows | `7f64964` | 36128093969 | R77-IDENTIFY, OBSERVE-BEGIN, OBSERVE-COMPARE, R73-LSTAT-EACCES-UNIT, R73-LSTAT-EACCES-LOOP |
| (b) listTree readdir uncaught | `bd83cce` | 36128135931 | R77-LISTTREE, BEGIN-TREE, CLOSE-TREE, BEGIN-UNLISTED, CLOSE-UNLISTED, R72-REPO-TREE-EACCES-LOOP |
| (c) readState EACCES/EPERM only | `e1c7051` | 36128168740 | R77-READ-EIO |
| (d) stop before git removed | `a514fc1` | 36128210358 | R77-CLOSE-UNLISTED, GIT-AFTER-BREAK, UNRESTORED-HOOK |
| (e) close `ok` ignores unlisted | `895d8a5` | 36128242271 | none at loop level |
| (f) begin does not refuse | `18db97b` | 36128283292 | R77-BEGIN-UNLISTED |

(e) survives at loop level on `895d8a5` because the stop before git still fails the stage. The isolated row empties hooks before begin and asserts `changes.length === 0` and `ok === false`. On `b8cef69`, run 36129234932, that row is the extra failure: (e) is killed. The candidate `a00d2fe`, run 36129231903, failed only CA-9 and `R72-BEFORE-ABSENT-DANGLING`.

Rulings for this section are R77 readings 1–8 and R82 in `docs/loops/loop-15-slice-3-rulings-18.md` at `68518ef` on `origin/docs/session-100-qa99-dispatch`.

Model: Grok 4.7. No effort setting is shown.
