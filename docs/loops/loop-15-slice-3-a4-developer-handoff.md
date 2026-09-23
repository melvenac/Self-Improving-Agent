# Candidate A4 developer handoff

**Seat:** Forge, record session 88. **Model:** Grok 4.7 256K High Fast (Cursor `cli-config.json`: `grok-4.7`, context 256k, reasoning high, fast, max mode off). **Branch:** `loop/15-slice-3-candidate-a4` from A3 `5010199`. A3 stays frozen at `5010199`.

**Not in A4:** D-A2-7, D-A5, and the R37 race, which stays a named limit.

**LIMIT (not closed):** the resolution compare and the later open are not atomic. That is the same class of race as R37's check-then-act. R49 does not claim to close it.

## Items

| Item | Status | Red | Green |
|---|---|---|---|
| 1 R49 | done | `configwatch-links` `-t R49`: 4 failed, exit 1. Absent machine hard link, both shapes beyond a base link, and a new repository file each put a content hash in the record. | same file, no filter: 22 passed, 3 skipped (POSIX), exit 0. |
| 2 R50 | not started | | |
| 3 R51 | not started | | |
| 4 R52 | not started | | |

Full suite not run. Atlas is asked before that.

## Item 1 — R49

After preflight, a watched path is opened only when its whole resolution still matches the chain recorded then. On any difference the component is named and the file is not opened, read, or hashed. A path absent at the recording is never read after that; the finding is lstat facts (`identity change: dev … ino … nlink …; not read`, or the existing type-change wording when the component is a link).

**Anchor.** Repository paths: from the repository root, exclusive (R30). A linked worktree's git dir uses the deepest floor that contains the file. Machine-config paths: the base directory the path is derived from, and that directory is included. HOME (or USERPROFILE) for `.gitconfig`, `XDG_CONFIG_HOME` (or `HOME/.config`) for the XDG file, and the system config's directory for system config. Each component stores type, `dev`, `ino` (`{ bigint: true }`), and readlink target. `nlink` is compared on the final file only. The walk continues through a link that was there at the recording, and stops at the first component that differs so a changed link is not followed.

**Separate protections.** `repositoryResolutionDiff` is the repository side (`readForCompare` is its only after-preflight caller). `MachineConfigWatch.resolutionMismatch` is the machine side. Reverting one does not revert the other.

**What A3 still did.** `identityChange` fired only when both sides were files, so an absent machine path that became a hard link was hashed with no `nlink` check. `chainOf(path, true)` stopped at the first link, so a base dotfiles link was not compared past the link and `snap` read through it.

Files: `open-brain/src/harness/configwatch.ts`, `open-brain/tests/harness/configwatch-links.test.ts`.
