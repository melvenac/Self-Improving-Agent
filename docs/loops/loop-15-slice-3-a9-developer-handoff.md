# A9 developer handoff

**Seat:** developer, record session 103. **Model:** Grok 4.7, read from Cursor's session identity line ("You are Grok 4.7" / "powered by Grok 4.7"). Cursor shows no effort or mode setting in that block.

**Branch:** `loop/15-slice-3-candidate-a9`, from A8 `9e2dd5d`.

## Commits

| SHA | What |
|---|---|
| `5cf0b8b` | R76. Merge of `origin/master`. Does not change A8's `configwatch.ts` or `runtime.ts`. |
| `0504910` | Red tests for R72–R75, on the merge alone. Branch `loop/15-slice-3-a9-redcheck`. |
| `cb2b605` | R72, R73, and R74 in one commit. They share `compare()`. |
| `0423d97` | The unread record keeps the resolved path, so R60 still names both files. The word `base` still names the loop base. |

## What each ruling does

- **R72.** `MachineConfigFinding.changed` is set from the facts and hashes. `runtime.ts` skips a finding only when `changed` is false. An in-place write to an unreadable file prints both fact sets and is a change. A repository file the process cannot read is reported as `unreadable` with its facts, not as an exception string.
- **R73.** A stable unread record, a directory, an unreadable file, a handle refusal, a type change, and `absent → symlink` carry type, dev, ino, nlink, size, and mtimeNs. If `realpath` fails, the reason includes the error code.
- **R74.** `before` for an unread file is labelled `stage start`. The change text's `base` facts are the loop base, and `type` is on both sides. A handle that gained a name inside `open` says so. The duplicated R70 comment is gone.
- **R75.** Candidate tests for the unreadable word (A6-5), size alone, and mtimeNs alone. Each has a mutant.

## Red, then green

Redcheck `0504910`, CI `36095548004`, runner `tcm-1`. The new tests failed. CA-9 failed too (below).

Candidate `0423d97`, CI `36095775536`, runner `tcm-2`. **1 failed | 1168 passed | 5 skipped (1174).** The one failure is CA-9. Every new R72–R75 test passed, including the POSIX ones this Windows seat skipped.

## Mutants

Each branch is the candidate plus one revert. Second-wave runs, after the path fix. Every one also fails CA-9.

| Mutant | SHA | Run | What went red, besides CA-9 |
|---|---|---|---|
| r72 | `3d9d7db` | `36095827583` | R72's unreadable in-place write only |
| r73 | `20aed7e` | `36095829425` | the three R73 fact tests |
| r74 | `e57f412` | `36095831228` | R74's loop-base label only |
| size | `c76ae84` | `36095832746` | R75 size, and also R72 and R74 |
| mtime | `5805fe8` | `36095834697` | R75 mtimeNs only |
| r71 | `8f2d678` | `36095836534` | R71 A6-5 only |
| handle | `4a1c5b6` | `36095838395` | R70's gained-a-name assertion only |

The size mutant is not a single-test kill. Dropping size from `sameId` also hides the unreadable write and the labelled change.

## Hunk map of `cb2b605`

Line ranges are in that commit's `configwatch.ts`, except the runtime line.

**R72.** A write is decided from the comparison, including an unreadable file.

- `configwatch.ts:401–402`, `:416`, `:637`, `:658` — `readError` on the file state.
- `:437–443` — a refused read (`EACCES`/`EPERM`) is recorded, not thrown.
- `:451–452`, `:473` — `changed()` and the hash text treat that refusal as its own fact.
- `:818–819` — `MachineConfigFinding.changed`.
- `:1121–1123`, `:1129`, `:1135` — the finding's `changed` flag comes from hashes and from "this is a change", not from the printed text.
- `:1160`, `:1166`, `:1169–1171` — both sides of an unreadable write carry their facts, so the texts differ because the facts differ.
- `runtime.ts:1064` — the runtime skips a finding only when `changed` is false.

**R73.** Every unread record carries the lstat facts.

- `:982–984` — a failed `realpath` names its error code.
- `:1113–1114` — `factText`.
- `:1141`, `:1147–1148` — a stable unread record appends the facts.
- `:1154–1156` — a planted link and a type change append the facts.
- `:1162–1164` — the handle refusal appends the facts.

**R74.** The labels name what the facts are.

- `:1025` — the duplicated R70 comment is removed.
- `:1027–1034` — a handle that gained a name inside `open` says so.
- `:1119` — an unread `before` is labelled `stage start`.
- `:1169–1171` — the word `base` in the change text is the loop base, not the stage start.

## What `0423d97` restores

`cb2b605` printed `not read: base` as facts only, and dropped the resolved path. `0423d97` puts `base.resolvedPath` and `end.resolvedPath` back in front of those facts. Without it, `R60: a different file reached through a stow link is not read, and both resolutions are named` is red: the record no longer contains the target path. That was CI `36095550425` on `cb2b605` (runner `tcm-2`), beside CA-9. The loop-base facts stay the loop base's.

## CA-9, not A9

CA-9 is red on tcm. `roles.ts` passes `--permission-prompts`. The `claude` installed on tcm does not list that flag in `--help`. It is red on the redcheck, which has no product change.

- Redcheck `0504910`, CI `36095548004`, runner `tcm-1`.
- Candidate code `0423d97`, CI `36095775536`, runner `tcm-2`.

Attributed to tcm's installed `claude`, not to an A9 edit. Left unchanged.

## The size mutant

Accepted as it stands. Dropping `size` from `sameId` reddens R75's size test, and also R72 and R74, because size is part of R72's change decision and of R74's printed facts. R75's own size test is among the kills. CI `36095832746` on `c76ae84`.

## Not verified

- Full local suite. Not run. Atlas has not been asked.
- CA-9 (`--permission-prompts` in `claude --help`) fails on `tcm-1` and `tcm-2`. It fails on the redcheck, which has no product change, so it is not an A9 edit. This seat did not change that test.

## Not in A9

R37's named limit, D-A2-7, D-A5.
