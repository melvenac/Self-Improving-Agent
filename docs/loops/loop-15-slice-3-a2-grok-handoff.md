# Loop 15 slice three: developer handoff for candidate A2

**By:** the developer seat, record session **84** · **Date:** 2026-09-23
**Branch:** `loop/15-slice-3-candidate-a2`
**Model:** Grok 4.7 via Cursor. Read from `C:\Users\melve\.cursor\cli-config.json`:
`modelId` `grok-4.7`, `displayName` "Grok 4.7 256K High Fast", `selectedModel` parameters
`context` 256k, `reasoning_effort` high, `fast` true, `maxMode` false. `approvalMode` is
`unrestricted`. `display.mode` is `zen`. That file has no separate agent/plan field.

Design accepted in `docs/loops/loop-15-slice-3-rulings-8.md` at `a010557` (R36–R41).

## What changed

- `open-brain/src/harness/configwatch.ts` — layer 2 restore and `MachineConfigWatch`.
- `open-brain/src/harness/runtime.ts` — preflight refusal, no git after an ancestor link (including rollback), `role-timeout` text.
- `open-brain/tests/harness/configwatch-links.test.ts` — the probes.
- `open-brain/tests/harness/process-role.test.ts` — the timeout text.

Nothing else. No version bump. `.agents/state.json` was not edited.

## Route (a) — link at a watched path, root, or tree entry

`lstat` only. A symlink or junction is not walked and not opened. Restore removes the link
with a non-recursive `rmdir` (file symlinks fall through to `unlink`) and recreates the
snapshot entry as a new file. No `rm` recursive, no `open(r+)`, no `chmod` until `lstat`
says the path is a regular file.

**Red before the fix** (`npx vitest run tests/harness/configwatch-links.test.ts` on `4f752ca`,
7 failed / 1 passed): the hooks and entry probes failed because the restore followed the
junction. **Green after:** those probes pass, the victim canaries are unchanged, and the
watched path is a real directory again. "put back" is in the message only after the re-read
agrees.

## Route (b) — ancestor link

`linkAboveWatched` lstats every component from the repo root (exclusive) and from each git
dir, immediately before each write, delete, rename, mkdir and chmod. A link at `.git` sets
`ancestorLink`, writes nothing beneath it, and does not say "put back". The runtime then
spawns no git, including rollback, and the reason says rollback was not performed and names
the ancestor.

**Red before:** the loop probe returned `runtime-git-failed`, not `stage-changed-config`.
**Green after:** `stage-changed-config`, the reason contains "Rollback was not performed",
the victim canary is unchanged, and `FAILED.md` does not contain the canary token.

## Route (c) — hard link

Every restored file is written as a new file in the same directory and renamed over the
entry. `nlink` and inode (bigint) are recorded and compared so a hard link is a change even
when the bytes match. They do not choose an in-place write. There is no `r+` path.

**Red before:** the victim's bytes became the repository config (the `r+` write). The failure
diff started `- HARD-CANARY` / `+ [core]`. **Green after:** the victim stays `HARD-CANARY`,
`nlink` is 1, and the message says "put back".

The three guards are separate functions (`linkAboveWatched`, the symlink branch in the
restore, `restoreNewFile`). Reverting one does not require reverting the others.

## D-A3 — `role-timeout` text

The record no longer says "killed with its process tree" or "Every window was still closed
and restored". Both runs below are on this machine (win32), `taskkill /T /F` exited 0.

Single child (no grandchild), bound 3000ms:

> developer exceeded its bound after 3108ms. The kill that ran: taskkill /PID 16848 /T /F exited 0. That is the kill's own result, not a census of descendants. A double-forked process can survive it (named limit; the double-fork is not closed).

Double-fork (grandchild plus a planted hook), bound 4000ms:

> developer exceeded its bound after 4160ms. The kill that ran: taskkill /PID 10116 /T /F exited 0. That is the kill's own result, not a census of descendants. A double-forked process can survive it (named limit; the double-fork is not closed).

The double-fork is named. It is not closed.

## R41 — junction `rmdir`, measured before use

Scratch directory, junction to a victim holding `CANARY-BYTES`, `rmdirSync` with no
`recursive` flag. The junction was gone by `lstat` (`ENOENT`). The canary bytes were
unchanged and the victim was still a directory. The same observation is the first test in
`configwatch-links.test.ts`. `unlink` on a junction also removed only the junction; the
restore uses `rmdir` first, as R24 required.

## Also in this commit

- A link at a repository watched path at base is `LoopRefused` `link-at-base` before any tag.
  A machine-config junction at base is not refused. One planted after base is a finding
  whose text says "type change" and whose path is not read through.
- Preflight walks `.git` with `lstat` before `resolveGitDirs`, so a junctioned `.git` never
  reaches a git call.

## Named limit (R37)

The ancestor check and the path's own `lstat` run immediately before each write, delete,
rename, mkdir and chmod. That narrows the window. It does not close it: the check and the
operation are still two steps. A descendant that outlives the role can still win that race.
This handoff does not claim the race is closed.

## Not verified here

- POSIX. The symlink probes are in the suite behind `skipIf(win32)`. This machine skipped
  them (2 skipped). They were not run.
- Probe (a)4, a junction at `<git-dir>/info` in a linked worktree. Not a separate test.
- Probe (b)3, `chmod` through a symlink, and (b)4's file-symlink form of `MachineConfigWatch`.
  The win32 form (a junction at `$XDG_CONFIG_HOME/git` planted after base) did run.
- The full suite. Not run. The planner is asked before that.
- GitNexus `impact` was not run: that MCP is not available in this session. Callers of
  `ConfigWatch` are `runtime.ts` and `config-channel.test.ts`.

## Tests that did run

- Before the fix: `configwatch-links` 7 failed, 1 passed (the `rmdir` measurement).
- After: `configwatch-links` 10 passed, 2 skipped. `config-channel.test.ts` 32 passed.
  `tsc --noEmit` clean. The two CA-6 timeout rows above passed.
