# Candidate A7 developer handoff

**Model:** Grok 4.7, as Cursor shows this session. **Seat:** developer, record session 95.
**Base:** A6 `dc35b24`. **Not frozen.** Full local suite not run.

## Commits on `loop/15-slice-3-candidate-a7`

| Commit | Ruling | What |
|---|---|---|
| `8d44f3e` | tests | Redcheck rows for R64–R67, also on `loop/15-slice-3-a7-redcheck` |
| `e169733` | R64 | `drifted` is gone. An unread file is compared by type, dev, ino, nlink, size, mtimeNs |
| `d2144ff` | R65 | Every machine path is one row per stage. Equal sides are a record, not a change sentence |
| `e018ee2` | R67 | Same real path, and the base object (`nlink` ignored) or a single-name file. Handle re-check drops `nlink` and still rejects a different inode |
| `32101e3` | R66 | R29's seam counts opens only after the plant |
| `b36760a` | R66 | A mid-path link names both resolved paths and both identities |

R66's other rows (handle reason, at-path type change, R50 `baseHardEdit`, the hard-link identity assertion) are in `8d44f3e`. The handle reason is rendered by `d2144ff`.

## Red, then green

Redcheck `8d44f3e`, CI **36053246665**, conclusion failure. 9 failed, 1144 passed, 6 skipped. I read the log:

- R64 untouched rewrite: `ok` false, `COULD NOT BE PUT BACK`
- R65 unchanged path: record `[]`
- R65 mode 000: path absent from the record
- R67 lock-and-rename, hard link elsewhere, and the new single-name file: `not read`, hash absent
- R66 handle: victim hash absent, reason `handle is a different file` absent
- R66 TRADE-DIFF: the outside path is absent
- R66 R29: failed because the seam still held the base open of the real file. The instrument is corrected in `32101e3`; that red is not the product

R50 `baseHardEdit`, the at-path type change, and the seam's in-place control passed on that run.

Local green, after the commits above, on this win32 seat: the new rows that run here passed, plus R57, R62, R44, and CA-4f. POSIX rows were skipped here. Candidate CI is the Linux read.

## Not done

- Code mutants, one branch each, not yet cut.
- Full local suite, not run.
- This SHA is not a freeze.
