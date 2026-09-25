# A10 developer handoff — R77

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

(e) survives at loop level because the stop before git still fails the stage. The verdict's `ok` is the record. `R77-CLOSE-VERDICT-NOT-OK` calls `closeAndRestore` directly. Re-run of (e) with that row: `c87969b`, CI 36128793192. Candidate with the row: `9fe71a2`, CI 36128789771.

Model: Grok 4.7. No effort setting is shown.
