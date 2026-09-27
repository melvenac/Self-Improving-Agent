# Candidate A8 developer handoff

**Model:** Grok 4.7, read from Cursor's session identity ("You are Grok 4.7" / "powered by Grok 4.7"). Cursor shows no effort or mode setting in that identity block.
**Seat:** developer, record session 98.
**Base:** A7 `d223d1d`. **Tip:** the handoff commit on `loop/15-slice-3-candidate-a8`.
**Full local suite:** not run.

## Commits

| Commit | Ruling | What |
|---|---|---|
| `e644c96` | tests | Redcheck rows, also `loop/15-slice-3-a8-redcheck` |
| `4e849a3` | R68 | An unread machine path carries type, dev, ino, nlink, size, mtimeNs. An in-place write is a change, both fact sets, not read |
| `d448bdd` | R69 | A path absent at base is read once it appears as a single-name file at the same parent realpath and name |
| `2052251` | R70 | The open handle re-checks nlink with dev, ino and type, before any byte |
| `270e601` | R71 | Stage-start facts are "before". A failed read says unreadable. An unread repository record prints both sizes |

## Red, then green

Redcheck `e644c96`, CI **36083149768**, read. 4 failed, 1154 passed, 6 skipped. The four reds are R68, R69 (the single-name appearance), R70 and R71. The two-name appearance stayed unread.

Candidate code `270e601`, CI **36083152202**, read. 1158 passed, 6 skipped (1164). That run's job label is `ubuntu-latest` (this branch's workflow file), on GitHub-hosted Linux, not the tcm runner.

## Mutants

Each is its own branch. The run I read is the one named. Each failed 1 test, 1157 passed, 6 skipped.

| Branch | SHA | Run | What it reddens |
|---|---|---|---|
| `loop/15-slice-3-a8-mut-facts` | `92f04a2` | 36083230156 | R68 only. The qa row is `not read: different file` on both sides |
| `loop/15-slice-3-a8-mut-appear` | `b40c82c` | 36083232599 | R69 only. The new file is not read |
| `loop/15-slice-3-a8-mut-nlink` | `c37c84b` | 36083234983 | R70 only. The handle's bytes are in the record |
| `loop/15-slice-3-a8-mut-record` | `6f94b2e` | 36083237474 | R71 only. Both sides are `identity:… nlink 2; not read` with no size |

## Not verified here

The full local suite was not run. This seat is Windows, so the POSIX symlink rows are skipped locally. Linux CI is the read of those rows. The candidate workflow did not select the tcm runner.
