# Candidate A4 developer handoff

**Seat:** Forge, record session 88. **Model:** Grok 4.7 256K High Fast (Cursor `cli-config.json`: `grok-4.7`, context 256k, reasoning high, fast, max mode off). **Branch:** `loop/15-slice-3-candidate-a4` from A3 `5010199`. A3 stays frozen at `5010199`.

**Not in A4:** D-A2-7, D-A5, and the R37 race, which stays a named limit.

**LIMIT (not closed):** the resolution compare and the later open are not atomic. That is the same class of race as R37's check-then-act. R49 does not claim to close it.

## Items

| Item | Status | Red | Green |
|---|---|---|---|
| 1 R49 | done | `configwatch-links` `-t R49`: 4 failed, exit 1. Absent machine hard link, both shapes beyond a base link, and a new repository file each put a content hash in the record. | same file, no filter: 22 passed, 3 skipped (POSIX), exit 0. Commit `9788d32`. |
| 2 R50 | done | `-t R50`: 1 failed, exit 1. Record was `modified (identity:… not read → <hash>)` and `Cannot read properties of null (reading 'equals')`. | same file, no filter: 23 passed, 3 skipped, exit 0. |
| 3 R51 | done | The 2.5 win32 control planted `planted-launcher.js`. The row names the `.cmd` JS-entry shim (the 2.4 plant). No product assertion was red: `resolveLauncher` already maps that shim to `node-entry`. | `-t "2.5 CONTROL: a planted"`: 1 passed, 23 skipped, exit 0. |
| 4 R52 | tests written, not executed here | This seat is win32. All five are `skipIf(isWin)`. | `configwatch-links` with no filter: 23 passed, 8 skipped, exit 0. The five R52 tests are among the skips. Not run on POSIX. |

Full suite not run. Atlas is asked before that.

## Item 1 — R49

After preflight, a watched path is opened only when its whole resolution still matches the chain recorded then. On any difference the component is named and the file is not opened, read, or hashed. A path absent at the recording is never read after that; the finding is lstat facts (`identity change: dev … ino … nlink …; not read`, or the existing type-change wording when the component is a link).

**Anchor.** Repository paths: from the repository root, exclusive (R30). A linked worktree's git dir uses the deepest floor that contains the file. Machine-config paths: the base directory the path is derived from, and that directory is included. HOME (or USERPROFILE) for `.gitconfig`, `XDG_CONFIG_HOME` (or `HOME/.config`) for the XDG file, and the system config's directory for system config. Each component stores type, `dev`, `ino` (`{ bigint: true }`), and readlink target. `nlink` is compared on the final file only. The walk continues through a link that was there at the recording, and stops at the first component that differs so a changed link is not followed.

**Separate protections.** `repositoryResolutionDiff` is the repository side (`readForCompare` is its only after-preflight caller). `MachineConfigWatch.resolutionMismatch` is the machine side. Reverting one does not revert the other.

**What A3 still did.** `identityChange` fired only when both sides were files, so an absent machine path that became a hard link was hashed with no `nlink` check. `chainOf(path, true)` stopped at the first link, so a base dotfiles link was not compared past the link and `snap` read through it.

Files: `open-brain/src/harness/configwatch.ts`, `open-brain/tests/harness/configwatch-links.test.ts`.

## Item 2 — R50

A hard link already on a repository watched file when the window opens is the base. `readState` records its bytes at that open (`preflight`). An unchanged link compares equal: no change, and the link is left in place. A hard link that appears only after the open is still not read (R43, R49). `agrees` does not call `.equals` on null bytes, so a missing snapshot cannot put `Cannot read properties of null (reading 'equals')` into the record.

Files: `open-brain/src/harness/configwatch.ts`, `open-brain/tests/harness/configwatch-links.test.ts`.

## Item 3 — R51

CA-2.5's win32 accepted control now plants `planted-launcher.cmd`, the same npm JS-entry shim 2.4 plants, aimed at `planted-launcher.js`. `resolveLauncher` returns `node-entry`, this process's node, and `preArgs` of the `.js` entry. The refusal twin is still a `.cmd` with no shim target. The POSIX branch is unchanged.

Files: `open-brain/tests/harness/process-role.test.ts`.

## Item 4 — R52

Candidate tests, each `it.skipIf(isWin)`. Not executed in this seat.

- **(b)3.** A chmod through a symlink changes the victim (the instrument), then `ConfigWatch.closeAndRestore` on `.git/config` replaced by that symlink leaves the victim at mode `644`.
- **(b)4.** `HOME/.gitconfig` replaced by a symlink to a victim file is reported and the victim hash is not in the finding.
- **R29 mode 000.** Its own `.gitconfig`, not shared with a write probe. A direct read must throw `EACCES` or the test throws (it does not skip). The watch's compare record does not contain the bytes or their hash.
- **Controls.** A write through the symlink changes the victim. Planting the symlink, with no `runLoop`, leaves the victim's listing and bytes as they were.
- **R35 on Linux.** A symlink at `$XDG_CONFIG_HOME/git` at base, placed next to the win32 test. The loop's failure is null.

Files: `open-brain/tests/harness/configwatch-links.test.ts`.

## Not verified

The full suite was not run. Atlas is asked before that. R52 was not run on POSIX; this seat is win32, and those tests skip. `/sync` on this tree still reports the pre-existing `prd-version`, stale rendered views, `retirements`, and `build-freshness` issues. None of them come from A4's commits. GitNexus impact was not run: the MCP tools are not in this session, and the index is behind HEAD.
