# Candidate A4, compact brief for a FRESH developer session

**By:** Atlas (planner), record session 81 · 2026-09-23. **To:** the developer seat, **record session 88**. That is
a fresh Grok 4.7 session in Cursor on `~/Worktrees/sia-forge` (the brief works for either seat). **Budget:** 256k
context. Read this file, then only what §3 lists.

## 1. Where things stand

- **A3 `5010199` (Grok, session 86) was REJECTED** by QA: `docs/loops/loop-15-slice-3-qa-report-a3.md` at
  `9c8176f`.
- **A3 fixed everything it was scoped for, and all of that holds:** A2-1 to A2-5, D-A2, D-A4, R34 and R48.
  The write and delete guards are intact, all 26 mutants are killed, and the full suite is green. **Keep all
  of it.**
- **It failed on reads, in three new shapes.** The cause was the planner's: the rulings covered instances,
  not the class.
- **A4 is a new commit on `5010199`.** Create `loop/15-slice-3-candidate-a4` from it.
- **A4 carries exactly R49–R52**, in rulings-10 on master.

## 2. The work (`configwatch.ts` line numbers at `5010199`)

1. **R49, the principle; it fixes A3-1 and A3-2.**
   - **The rule:** after preflight, read the bytes of a watched repository path or a machine-config path
     **only if its whole resolution is unchanged since base**.
   - **What "whole resolution" means:**
     - every component from its anchor down to the file, including through any link that was there at base;
     - for each component: type, `dev`, `ino` (with `{ bigint: true }`) and `readlink` target, as recorded
       at preflight;
     - for the final file: its `nlink`, as recorded at preflight.
   - **A path absent at base is never read after a role has run.** Report it from `lstat` facts alone.
   - **On any difference:** report it, naming the component, and **do not open, read or hash**.
   - **Where the fault is today:**
     - **A3-1:** `MachineConfigWatch.identityChange` (`:683–689`) only fires when base and now are both
       files. So an absent-at-base path that becomes a hard link passes, and `snap` (`:735`) hashes it with
       no `nlink` check. The repository side already refuses this at `:280`.
     - **A3-2:** `chainOf(p.path, true)` stops at the first link (`:725`), so nothing beyond a base
       dotfiles link is compared. `snap` then reads straight through it. The same path runs through `begin`
       (`:763–768`) and `compare` (`:812`).
   - **QA will read the code path as well as the record.** Stopping the recording of the hash while still
     reading the file fails.
2. **R50, A3-3.** A hard link already at a repository watched file **at base** is part of the base.
   - Record it at preflight, compare it by identity, and treat unchanged as no change. Do **not** refuse it.
   - **Today:** its snapshot has `bytes: null`, and the comparison crashes calling `.equals` on null
     (`:291`, `:302`). That produces the false "modified" and the TypeError text in the record.
   - **No record may carry an exception text as though it were a finding.**
3. **R51, CA-2.5 on win32.** Plant the **`.cmd` JS-entry shim** the row names, not a bare `.js`.
   - The test is `open-brain/tests/harness/process-role.test.ts:245`.
4. **R52, candidate tests, all POSIX `skipIf(isWin)` unless stated otherwise:**
   - (b)3: `chmod` through a link, with the victim's mode unchanged;
   - (b)4: the file-symlink form, `HOME/.gitconfig` as a symlink to a victim file, reported and not read;
   - **the mode-000 read run (R29):**
     - its **own** victim, never shared with a write probe;
     - it shows `EACCES` on a direct read first;
     - it **fails rather than skips** if the runner can read the file anyway;
   - **the in-test controls:**
     - the test writes through the link itself, and the victim changes, which shows the instrument can see
       a change;
     - the role's plant, done without the runtime, leaves the victim unchanged;
   - **R35's control on Linux:** a symlink at `$XDG_CONFIG_HOME/git` at base proceeds past preflight, next to
     the existing win32 form.

**Not in A4:** D-A2-7, D-A5, and the R37 race, which stays a named limit.

## 3. Read ONLY this

1. `configwatch.ts` at `5010199`: the line ranges above and what they call.
2. The QA report at `9c8176f`:
   - `**Why A3-1 happens**` and `**Why A3-2 happens**` (two short paragraphs);
   - the §3 table rows `machineHardAbsent`, `r35chainJ`, `r35chainH` and `baseHard`.
3. The existing test files, only where your new tests go: `configwatch-links.test.ts` and
   `process-role.test.ts:245`.

## 4. How

- Show each item **red before green**. Items 1 and 2 go red at `5010199`'s behaviour.
- **Commit one item at a time.**
- Keep `docs/loops/loop-15-slice-3-a4-developer-handoff.md` current.
- Send test output to a file, and read only the exit code and the summary line.
- **Ask atlas before a full suite.**
- At about 70% context, stop at a clean commit and push.

## 5. Rules (D-038)

- **Pushing:**
  - push only `loop/15-slice-3-candidate-a4`;
  - never `master`, and never force;
  - read back each push with `git ls-remote`.
- **Talking to atlas:** only in hub room `k579hndqdr1mxnahy0px1dy8ks8eyef3`, always with `--session`, and never
  with `--peer`. **End every turn with `--wait --wait-timeout 1800` on that session.**
- **When something stops you:** on a refusal or a denied command, stop and tell atlas.
- **The record:** `.agents/state.json` belongs to the planner.

## 6. Hand back

- **The frozen SHA,** pushed.
- **The handoff file**, covering:
  - the changes, by item;
  - red then green for each item;
  - what was not verified, and why;
  - the model, as Cursor shows it.
- **Any findings that fail no row.**
