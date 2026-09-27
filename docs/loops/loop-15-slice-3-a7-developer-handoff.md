# Candidate A7 developer handoff

**Model:** Grok 4.7, as Cursor shows this session. **Seat:** developer, record session 95.
**Base:** A6 `dc35b24`. **Tip:** the handoff commit on `loop/15-slice-3-candidate-a7`.
**Full local suite:** not run.

## Commits

| Commit | Ruling | What |
|---|---|---|
| `8d44f3e` | tests | Redcheck rows, also `loop/15-slice-3-a7-redcheck` |
| `e169733` | R64 | `drifted` is out of attribution. An unread file is compared by type, dev, ino, nlink, size, mtimeNs |
| `d2144ff` | R65 | Every machine path is one row per stage. Equal sides are a record, not a change sentence |
| `e018ee2` | R67 | Same real path, and the base object (`nlink` ignored) or a single-name file. The handle check drops `nlink` and still rejects a different inode |
| `32101e3` | R66 | R29's seam counts opens only after the plant |
| `b36760a` | R66 | A mid-path link names both resolved paths and both identities |

R66's handle reason is rendered by `d2144ff`. The at-path type change, R50 `baseHardEdit`, and the hard-link identity assertion are tests in `8d44f3e`.

## Red, then green

Redcheck `8d44f3e`, CI **36053246665**, read. 9 failed, 1144 passed, 6 skipped:

- R64 untouched rewrite: `ok` false
- R65 unchanged path: record empty
- R65 mode 000: path missing
- R67 lock-and-rename, hard link elsewhere, new single-name file: not read
- R66 handle: reason absent (and the victim hash was already absent)
- R66 TRADE-DIFF: outside path absent
- R66 R29: the seam still held the base open. Corrected in `32101e3`

R50 `baseHardEdit` and the at-path type change passed on that run.

Candidate `0111bb0`, CI **36054403229**, read. 1153 passed, 6 skipped. The R64, R65, R66, R67, R57 and R62 rows are checkmarks there.

## Mutants

Each is its own branch. The run I read is the one named.

| Branch | SHA | Run | What it reddens |
|---|---|---|---|
| `loop/15-slice-3-a7-mut-drifted` | `f09035b` | 36058556896 | R64 only. 1 failed, 1152 passed, 6 skipped |
| `loop/15-slice-3-a7-mut-facts` | `4b69eb2` | 36058567322 | R57 only (unread in-place write) |
| `loop/15-slice-3-a7-mut-record` | `89269c7` | 36058578477 | R65 unchanged path only |
| `loop/15-slice-3-a7-mut-handle` | `f35e065` | 36058592630 | R66 handle: the swapped file's hash is in the record. R29 stays green |
| `loop/15-slice-3-a7-mut-r50` | `cb41fcb` | 36058625414 | R66 R50 only |
| `loop/15-slice-3-a7-mut-r67` | `04c4ec3` | 36058640092 | R55 D-042, and the three R67 rows. 4 failed |
| `loop/15-slice-3-a7-mut-trade` | `6f31a94` | 36058651869 | R66 TRADE-DIFF only |
| `loop/15-slice-3-a7-mut-type` | `951af95` | 36059922307 | R66 at-path only. The record is the edit's hash, not a type change |

The first type attempt, `18eb8a5` run 36058611418, stayed green: compare still wrote "type change" after the observe check was gone. `7225005` run 36059414253 stayed green for the same reason, via the mid-path wording. `951af95` is the one that reads.

`cb41fcb` is not the historical M-R50 (`preflight` false). That form no longer hides an in-place edit, because R64 compares size. This mutant ignores a byte change when `nlink` is already above 1.

## Not verified

POSIX rows were skipped on this win32 seat. Linux CI is the read. The full local suite was not run.
