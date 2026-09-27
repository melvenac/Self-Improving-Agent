# Loop 15 slice three — A13 developer handoff

**By:** Grok 4.7 (developer), record session 159. **Planner:** Atlas, record 146, hub turn 177. **Room:** `k57frxw0ptb8tadmqdwy0khhks8ey006`, `--as grok`.

**Product:** `4b43410` on `loop/15-slice-3-candidate-a13`, branched from A12 `a69f07d`. This handoff is the commit on top of the product. `git merge-tree` against `origin/master` at the product: 0 conflicts. No merge commit.

`closeAndRestore`'s caller is `runtime.ts` (`configWatch.closeAndRestore()`). The R77 stop reads `unrestored.length` and `unlisted.length`. It does not read `ConfigChange.kind`. The GitNexus index in this worktree is 160 commits behind `f712955` and was not used.

## What changed

R90's branch (`configwatch.ts`, the `b === null && a.readError && a.dev === null` arm) used to push a change with `kind: "modified"` and `continue`, so the path was neither removed nor added to `unrestored`. When that path was the only thing not put back, the summary said `Every file was put back by bytes before any git call read the repository.` and the runtime made 6 git calls after the role.

The arm now stores `kind: "unobservable"` and pushes

`<path> (absent at the open; cannot be lstat'd at close (<code>); not removed)`

onto `unrestored`, then `continue`s. It still does not remove the path, and it still does not say `a other was created`. FIX-q149 (`7a24bad`) is the one-line push that leaves `kind: "modified"`. This is not that patch: the kind and the note are one record.

## R96 — who reads `ConfigChange.kind`

Searched at `4b43410`. The union `"created" | "deleted" | "modified" | "unobservable"` is only on `ConfigChange` in `configwatch.ts`. The symbol `ConfigChange` appears only in that file.

| Site | What it does with `kind` |
|---|---|
| R90 arm | Writes `"unobservable"`. |
| The general change arm | Writes `"created"`, `"deleted"`, or `"modified"`. This arm is not reached for the R90 failure. |
| Message builder | Prints `c.kind` only when `after` does not start with `unobservable (`. The R90 `after` does, so the kind word stays omitted. |
| `runtime.ts` | Does not read `kind`. The stop is `unrestored.length > 0` or `unlisted.length > 0`. |
| `configwatch-a12.test.ts` `R90-ABSENT-UNOBSERVABLE` | Asserts `kind` is not `"created"`. |
| `configwatch-a13.test.ts` | Asserts `kind` is `"unobservable"`. |

Nothing restores, refuses, or stops on `kind === "modified"` or `kind === "unobservable"`.

## R85 search, redone on `4b43410`

Every site that builds a side's text. The last column is whether **this site** pushes the path onto the repository `unrestored` array. Machine-config text is a different return (`MachineConfigFinding`); that half does not restore.

| Site | Failed `lstat` | Failed `stat` (lstat succeeded) | Link | Absent | Pushes `unrestored`? |
|---|---|---|---|---|---|
| `stateHash` :517 | `unreadable (<code>); no facts: lstat failed` | `unreadable (<code>); type file dev … ino … nlink … size … mtimeNs …` | `type:symlink readlink:<target>` | `absent` (argument null) | No. Callers embed it. The R90 path is pushed by the arm below, not by `stateHash`. |
| R90 arm :829 | `kind` `"unobservable"`, `before` `absent`, `after` `unobservable (<code>); ` plus `stateHash`. No removal. | Not this arm (`dev` is set). | Not this arm. | The before word. | **Yes.** :839 pushes the note. |
| message :884 | Kind word omitted when `after` starts with `unobservable (`. If `unrestored` is non-empty the sentence is `N FILE(S) COULD NOT BE PUT BACK`. | `<rel> <kind> (<before> → <after>)` | same | same | No. It prints the array. |
| created-other note :854 | Not reached (the R90 arm `continue`s). | A real created non-file says `a <kind> was created; not removed recursively`. | A symlink is removed. | Not this note. | That created non-file, yes. The R90 path, no. |
| `factText` :1305 | Not used for a snap with no facts. | `type <kind> dev … ino …` of the `lstat`. | The snap's own fields. | Not the word absent. | No. |
| `readText` :1308 | Not a read. | Not a read. | `<hash> ` + `factText` when the read succeeded. | Not a read. | No. |
| `linkSide` :1309 | A link that does not resolve: `link: type symlink …; does not resolve (<code>)`. | `resolves to:` + `factText` when the target was read. | That label. | `does not resolve` when `resolvedPath` is null. | No. |
| `ancestorLinkText` :1320 | The parent link's own `lstat` (`viaDev` … `viaTarget`). | Same. | `link: type symlink dev ${viaDev} … readlink ${viaTarget}` | The link facts, not the word absent. | No. |
| `unobservableSide` :1323 | No parent link: `no facts: realpath failed`. Parent link and `dev` null: `ancestorLinkText` only. A link at the path: `linkSide`. | Parent link and `dev` set: `ancestorLinkText` + `; resolves to: ` + `factText`. No parent link: `factText`. | `linkSide` | Not this function. The caller prefixes `unobservable (<errno>)`. | No. |
| `currentSide` :1333 | Non-link, unresolved: `s.reason` (`did not resolve: <code>`). | Resolved path + `factText`. | `linkSide` | `s.reason` when that reason is `absent (ENOENT)`. | No. |
| `baseText` :1339 | — | path + `factText` when it resolved. | Unresolved symlink: `unresolved ` + `factText`. | `absent at loop base` when `resolvedPath` is null and the path is not a symlink. O-1 (an EACCES base) is not changed. | No. |
| `stageBefore` :1341 | `opened.reason` when `resolvedPath` is null and it is not the unreadable/symlink cases above it. | `unreadable; stage start ` + `factText` | Unresolved symlink: reason + `factText`. | The reason string when the path did not resolve. | No. |
| unobservable row :1356 | `unobservable (<errno>); ` + `unobservableSide` | same | same | The before side is `stageBefore`. | No. |
| stable label :1375 | An unresolved non-link prints the label only. `changed` is false. | `unreadable; stage start ` + `factText` | fact text or the symlink label | the label | No. |
| `absent →` :1393 | Ancestor link: `ancestorLinkText` then `currentSide`. Link at the path: `currentSide` / `linkSide`. | File facts from `currentSide` when the target resolved. | `link: type symlink` | the words `absent → symlink` | No. |
| type-change :1398 | Same split as the absent branch when the path is not itself the symlink. | `currentSide` / `factText` of the resolved file. | `link: type symlink` | `baseText` says `absent at loop base` when the loop base did not resolve. | No. |

`observe` fills the snap. It does not build the printed side and it does not push `unrestored`.

## Red, then green, on tcm

Runner: `workflow_dispatch` of `ci.yml`, `hosted` and `windows` left false. Read per test from the verbose log. No laptop CI. No full local suite. The mock row was also run on this Windows box before the push; that run is not the tcm read.

**Red** `f712955` (rows only, product still A12), run `36294235947`. 5 failed, 1422 passed, 5 skipped (1432). The fifth failure is CA-9 (`--permission-prompts`), on the red run and on every run below. It is T-182, not this candidate.

| Row | Received |
|---|---|
| R97-Q149-C1-HOOKS-ONLY | `kind` `modified`, `claimsRestore` true, `namesUnrestored` false, `unrestored` `[]`, plant still there, `lstat` `EACCES`, 6 git calls: `for-each-ref`, `symbolic-ref HEAD`, `symbolic-ref HEAD`, `rev-parse HEAD`, `status`, `symbolic-ref HEAD` |
| R97-Q149-SUBDIR-ONLY | same |
| R97-Q130-R83-SUBDIR-NOSEARCH-PLANT | same. Same act as the subdir row; both names are in the ruling. |
| R97-Q149-MOCK-PLUS-CONFIG | same, plus `cfgRestored` true and `lstatHits` 2 |

**Green** `4b43410`, run `36294470032`. The four rows pass. Each log line: `kind` `unobservable`, `claimsRestore` false, `namesUnrestored` true, `gitAfterRole` `[]`, plant still there, `unrestored` holding the note above. The mock row also has `cfgRestored` true. Suite: 1 failed (CA-9), 1426 passed, 5 skipped (1432). 1426 is the red run's 1422 plus these four.

## Mutants

Each branch is `4b43410` plus one edit. `tsc --noEmit` before the push. Same dispatch. Each also fails CA-9.

| Branch | SHA | Run | What is gone | Killed |
|---|---|---|---|---|
| `loop/15-slice-3-a13-mut-r95` | `012b001` | `36294505899` | the `unrestored` push. `kind` stays `"unobservable"`. | All four rows. Received: `kind` `unobservable`, `claimsRestore` true, `namesUnrestored` false, `unrestored` `[]`, 6 git calls. 5 failed, 1422 passed, 5 skipped. |
| `loop/15-slice-3-a13-mut-r96` | `ac6a1bc` | `36294528231` | `kind` set back to `"modified"`. The push stays. | All four rows. Received: `kind` `modified`, `claimsRestore` false, `namesUnrestored` true, `gitAfterRole` `[]`, the note still in `unrestored`. 5 failed, 1422 passed, 5 skipped. |

## Not done

- No `/end`.
- O-1 (`baseText` says `absent at loop base` for an EACCES base) was not changed.
- QA 149's probe files are not on this branch. The rows are `open-brain/tests/harness/configwatch-a13.test.ts`.
