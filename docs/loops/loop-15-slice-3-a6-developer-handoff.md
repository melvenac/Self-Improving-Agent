# Candidate A6 developer handoff

**By:** Forge (developer), record session 93. **Model:** Grok 4.7, as Cursor shows this session.
**Branch:** `loop/15-slice-3-candidate-a6`. Code that CI greened is `8ad8728`. This file is the commit after it.

## Changes, by ruling and commit

| Commit | What |
|---|---|
| `023fcd0` | R63: the revert sentence is asserted present after a revert that ran |
| `f77fd4f` | R60, R61 and R62 in one commit. Atlas accepted that (no rewrite). Object check on the open handle, base notes that do not claim a read for an unresolved link, equal unread identity is not a change. Also the (b) plant and in-test control on the symlink-at-config test, CA-15 (b)2, R52 (b)4, and the symlink-at-`.git` test |
| `daac160` | R60 stow links point at the real relative target; `routeEnd` checks the repository rest fix |
| `8ad8728` | R60 hard-link record is inode and nlink. `realpath` of a hard link does not name the other path |

## Red, then green

Redcheck `loop/15-slice-3-a6-redcheck` `619bdb9`, CI `35961731930`, failure. Read per test. 6 failed, 1135 passed, 6 skipped:

- R60 stow in-place edit
- R60 linked config directory in-place edit
- R60 different file through a stow link
- R60 repository link with two components after it
- R61 dangling link
- R62 file new since base, untouched

R63 passed on that run. The sentence was already present.

Green: CI `35963022148` on `8ad8728`, success. 1141 passed, 6 skipped. The six R60–R62 tests above and R63 are checkmarks in that log. The earlier candidate runs `35962363500` (`f77fd4f`, three R60 failures) and `35962749945` (`daac160`, the hard-link path assertion) were read and fixed before this one.

## Mutants

Each is red on CI. The first four code mutants also carry the `8ad8728` test fix (merge, not force).

| Branch | Run | Test it reddens |
|---|---|---|
| `loop/15-slice-3-a6-mut-object` `8dbb6c3` | `35963349906` | R60 different file through a stow link (also R43, R44, R45, R49, R55) |
| `loop/15-slice-3-a6-mut-handle` `3c12e2f` | `35963360666` | R60 stow in-place edit, and the linked-directory in-place edit (also R55 CONTROL, R59) |
| `loop/15-slice-3-a6-mut-rest` `62b16ef` | `35963368623` | R60 repository link names the real file, not a doubled path |
| `loop/15-slice-3-a6-mut-unwatched` `f2e3498` | `35963376352` | R61 dangling link |
| `loop/15-slice-3-a6-mut-identity` `beddeac` | `35963384988` | R62 file new since base |
| `loop/15-slice-3-a6-mut-revert` `3902557` | `35963392393` | R63 revert sentence present |

## Not verified

Full local suite was not run (G-042: ask first). POSIX symlink tests are skipped on this Windows seat; the green run above is the Linux read. GitNexus impact was not run: the index in this worktree is behind HEAD and there is no GitNexus MCP here.
