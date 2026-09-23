# A2, compact brief for a FRESH developer session (Grok 4.7 in Cursor, 256k context)

**By:** Atlas (planner), record session 81 · 2026-09-23. **To:** the developer seat, **record session 84**
continuing in a new Cursor session. The first Grok session reached **50.7% of its context** (Aaron's
reading) on reading and design alone, with **no code written**. This file carries everything that
session settled, so the new one starts small. **Read this file, then only what §3 lists.**

## 1. Settled: the design, accepted in rulings-8 (master `9c98c09`)

The goal is candidate A2 on branch `loop/15-slice-3-candidate-a2` in `~/Worktrees/sia-forge`, currently
at `4f752ca` and clean. Layer 2's restore in `open-brain/src/harness/configwatch.ts` must never write,
delete, rename, `mkdir` or `chmod` outside the repository. The design has **separate guards**, each
revertible alone (QA reverts each one, and its probe must go red):

- **(a) A link at a watched path, root or tree entry.** Snapshot and compare with `lstat`, never
  `stat`, `exists` or a following `readdir`. A symlink or junction is a **type change** whatever the
  bytes. The restore removes the link itself (`unlink`; a **non-recursive** `rmdir` for a junction),
  then recreates the snapshot entry as a real file or directory.
- **(b) An ancestor link** (for example `.git` replaced by a junction). Walk every component from the
  repository root (exclusive) to the target, and down each pinned git directory, with `lstat`. On a
  link: fail `stage-changed-config`, name the ancestor, and write nothing beneath it, including
  `FAILED.md`. **Spawn no git beneath it, rollback included (R38).** The record says rollback was not
  performed and why.
- **(c) A hard link.** **R36:** restore **never writes in place**. Every restored file is a new file in
  the same directory, renamed over the entry. No restore path opens an existing watched file for
  writing. `nlink` and inode go into the record only, read with `{ bigint: true }` (win32 inodes here
  exceed 2^53).
- **R37:** the ancestor walk plus the target's own `lstat` run **immediately before each** write,
  delete, rename, `mkdir` (including `writeBack`'s recursive `mkdirSync`) and `chmod`. The
  check-then-act race remains. **Name it as a limit** in the handoff; do not claim it is closed.
- **Preflight:** a link at a **repository** watched path at base is refused, naming the path. A
  **machine-config** path that is a link at base is recorded with its type and target, **not** refused
  (R35).
- **R39, `MachineConfigWatch`** (`hashNow`): after the role runs, a type or link-target change at a
  machine-config path is reported as a type change and **not read through**. Nothing is restored
  there. A link present at base is read the way it was at base.
- **R40, D-A3:** the `role-timeout` text says only what the kill measurably did. Show the text for a
  plain single-child timeout and for the double-fork case.
- **R41:** before relying on the junction `rmdir`, measure it once in scratch: junction → victim with
  canaries, `rmdirSync` without `recursive`, the junction gone by `lstat`, and the canaries intact by
  bytes.
- **"Put back"** is written only after a post-restore `lstat` re-read agrees with the snapshot.

## 2. Rules (D-038, unchanged)

- Push only `loop/15-slice-3-candidate-a2`. Never `master`, never a force push. Read each push back
  with `git ls-remote`.
- Questions for Aaron go to atlas in hub room `k579hndqdr1mxnahy0px1dy8ks8eyef3`, **always with
  `--session`** and never `--peer`.
- On a refusal or a denied command: stop and tell atlas.
- Ask atlas before a full-suite run.
- The record (`.agents/state.json`) is the planner's.

## 3. Read ONLY this (about 15k tokens)

1. `open-brain/src/harness/configwatch.ts` in full (~4.8k tokens): the code you change.
2. `open-brain/src/harness/runtime.ts`: **grep, don't read.** Find the call sites of the configwatch
   exports, `rollBack` (defined at about line 976 at `3b19287`), and the `role-timeout` text (about lines
   1058–1062). Read about
   40 lines around each.
3. `open-brain/tests/harness/config-channel.test.ts`: grep for the CA-4a and CA-4d tests and read those
   blocks only, to copy the fixture shape.
4. **Only if a question needs it:** in `docs/loops/loop-15-slice-3-qa-criteria-a.md` at `6672e83`,
   grep for `### CA-15` and read that section alone.

Do **not** re-read the rulings, the QA report or the old handoffs. Their content is §1.

## 4. Working budget

- **Test runs:** redirect output to a file, then read the exit code and the summary line only.
- **Commit after each guard.** Keep `docs/loops/loop-15-slice-3-a2-developer-handoff.md` current as you
  go: done, next, red and green per route.
- **At about 70% context, or when Cursor warns:** stop at a clean commit, push, and tell atlas. Another
  fresh session continues from the files.
- **Order:** R41's measurement, then (a), (b), (c) with R36, then R37, preflight, R39, R40.
- **Each route is shown red** against `3b19287`'s behaviour **before** it is shown green.

## 5. Hand back

The frozen SHA, pushed; the handoff file (changes by file, red then green per route, R41's
observation, the named race limit, what was not verified and why, and the model as Cursor shows it);
and findings that fail no row. Send the SHA to atlas in the hub room.
