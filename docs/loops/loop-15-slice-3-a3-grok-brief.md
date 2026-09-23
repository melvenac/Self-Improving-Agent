# Candidate A3, compact brief for a FRESH developer session

**By:** Atlas (planner), record session 81 · 2026-09-23. **To:** the developer seat, **record session 86**. That
is a fresh Grok 4.7 session in Cursor on `~/Worktrees/sia-forge`, if Aaron confirms it; the brief works for
either seat. **Budget:** 256k context. Read this file, then only what §3 lists.

## 1. Where things stand

- **Candidate A2 `2add792` (Grok, session 84) was REJECTED** by QA: `docs/loops/loop-15-slice-3-qa-report-a2.md`
  at `8cddfc7`.
- **A2 did close the original flaw.** Nothing is written or deleted outside the repository in 13 win32
  probe shapes. Rename-over, no-git-under-an-ancestor-link, the junction `rmdir` and the D-A3 text all
  passed. **Keep all of it.**
- **A3 is a new commit on `2add792`** (branch `loop/15-slice-3-candidate-a2`; continue it, or branch
  `loop/15-slice-3-candidate-a3` from it). It carries **exactly** the items below: rulings-9 R43–R48 on master.

## 2. The work, with where QA found each defect (`configwatch.ts` line numbers at `2add792`)

1. **R44, A2-1 (blocker).** "Base" is the **loop's** base, taken once at preflight. `MachineConfigWatch.begin`
   (`:678–681`) re-snapshots at every stage with read-through, so the QA stage read the victim through a
   junction the developer stage planted. **Snapshot once, never re-base, and never read through a link that
   was not there at base.**
2. **R45, A2-2 (blocker).** A watched path or tree root **absent at base** is still watched. In a fresh
   linked worktree (`<git-dir>/info` absent), a planted junction was replaced by an **empty directory**, and
   the loop **completed with nothing recorded**. The tree-root loop is in `closeAndRestore` (`:445–458`).
   **Absent → link is a change.** The restore removes the link and restores the **absence**. It never
   creates a directory, and the record names the change.
3. **R46, A2-3 and A2-4.** The record names **every link-typed path with its type and `readlink` target**:
   tree roots (today only the files under them are listed as "deleted"), entries, and base links at a
   **parent component** of a machine-config path. `baseNotes()` (`:625–636`) checks only the final
   component; walk each component with `lstat`, as the ancestor walk does.
4. **R43, A2-5.** Nothing is **read** through a hard link that was not there at base. `readState`
   (`:252–259`) reads bytes before `nlink` is compared. **Compare `dev`, `ino` (with `{ bigint: true }`) and
   `nlink` first.** On a mismatch, report an identity change **without reading**. Apply the same rule to
   machine-config paths.
5. **R47, D-A2 (CA-2.5).** In `open-brain/tests/harness/process-role.test.ts:245–251`, the "2.5 CONTROL" test
   returns early and passes when `claude` is absent. Replace it with:
   - a **planted launcher control**, accepted and resolved, plus its **refusal twin**, both running on every
     platform (on POSIX, an executable script; on win32, a JS-entry shim);
   - the real-`claude` control kept as its own test, `it.skipIf` with a reason when `claude` is absent.
6. **R47, D-A4 and R34 (CA-4c).** In `open-brain/tests/harness/config-channel.test.ts`:
   - `:211`: simulate global config through a scratch `HOME/.gitconfig`, with `XDG_CONFIG_HOME` set to an
     empty scratch directory and `GIT_CONFIG_GLOBAL` **unset**, so that removing layer 0 (M-L0) turns the
     row red;
   - `:256`: assert the planted **value** `core.autocrlf = input`, with a control that the system value is
     not `input`.
7. **R48 (optional, minimal).** Add a per-test reporter to CI for the harness tests (verbose, or a JSON
   artifact), so QA can read the POSIX rows as printed. Change nothing else in the workflow.
8. **D-A2-6.** In your handoff, correct A2's claim that "a junctioned `.git` never reaches a git call":
   `runtime.ts:361` runs `rev-parse` before the check at `:366`.

**Not in A3:** D-A2-7 and D-A5. Record them as carried.

## 3. Read ONLY this

1. `open-brain/src/harness/configwatch.ts` at `2add792`: the line ranges above, plus whatever they call.
2. In the QA report at `8cddfc7`, grep for `Why A2-` and read those four short paragraphs, plus the §3 table
   rows (a)4, (a)6 and (b)4. **Nothing else in that report.**
3. The two test files at the lines named in §2.5 and §2.6.
4. Only if needed: in `docs/loops/loop-15-slice-3-qa-criteria-a.md` at `6672e83`, the `### CA-15` section.

## 4. How

- **Show each item red before green.** Items 1–4 go red at `2add792`'s behaviour. Items 5–6 go red under
  their mutants (M-L0 for item 6).
- **One commit per item**, so QA can revert each one alone.
- **Keep `docs/loops/loop-15-slice-3-a3-developer-handoff.md` current as you go:** done, next, and red or
  green per item.
- **Test output goes to a file.** Read only the exit code and the summary line.
- **Ask atlas before a full-suite run.**
- **At about 70% context:** stop at a clean commit, push, and tell atlas.

## 5. Rules (D-038)

- Push your own branch only. Never `master`, never a force push. Read each push back with `git ls-remote`.
- Everything for Aaron goes to atlas in hub room `k579hndqdr1mxnahy0px1dy8ks8eyef3`, **always with
  `--session`**. After each report, run `--wait --wait-timeout 1800` on that session, so a reply reaches you
  (until the hub can wake idle seats, T-160).
- On a refusal or a denied command: stop and tell atlas.
- The record (`.agents/state.json`) is the planner's.

## 6. Hand back

- The frozen SHA, pushed.
- The handoff file, covering:
  - the changes, by file and item;
  - red then green for each item;
  - what was not verified, and why;
  - the model, as Cursor shows it.
- Findings that fail no row.
