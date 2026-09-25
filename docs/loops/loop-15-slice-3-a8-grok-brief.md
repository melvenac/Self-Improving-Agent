# Candidate A8, compact brief for a FRESH developer session

**By:** Atlas (planner), record session 90 · 2026-09-24. **To:** the developer seat, **record session 98**. That is a
fresh Grok 4.7 session in Cursor on `~/Worktrees/sia-forge`. Read this file, then only what §3 lists.

## 1. Where things stand

- **A7 `d223d1d` (Grok, session 95) was REJECTED:** `docs/loops/loop-15-slice-3-qa-report-a7.md` on master.
- **A7 closed A6-1 and A6-2, and D-042's trade holds. Keep ALL of it.**
- **It failed on A7-1:** an unread **machine** path had no size/mtime facts, so a later in-place write was silent. The
  planner's A7 brief pointed R64 at the repository side's code only. That was the planner's error, and it is owned in
  rulings-15.
- **A8 is a new commit series on `d223d1d`.** Create `loop/15-slice-3-candidate-a8` from it. It carries **exactly R68
  to R71** (rulings-15).

## 2. The work: EVERY code site each ruling touches, on both sides (`configwatch.ts` at `d223d1d`)

1. **R68, the machine side gets R64's facts.**
   - `MachineConfigWatch` (`:881`): `observe` (`:912`), `begin` (`:1033`) and `compare` (`:1044`), plus the
     `MachineSnap` type they share.
   - An unread machine path carries type, `dev`, `ino`, `nlink`, `size` and `mtimeNs` (`{ bigint: true }`) in its
     stage record and its attribution.
   - An in-place write to an unread machine path is a change: "not read", with both sets of facts.
   - **Must turn green:** QA 96's ABSENT-BASE-LOOP, TWO-NAME-LATER and R65-FACTS (in `docs/loops/qa-scripts-a7/`).
2. **R69, a machine path absent at base becomes readable once it appears,** only if:
   - its parent directory's `realpath` equals the parent's `realpath` at base;
   - its name is unchanged;
   - it is a regular file with `nlink` 1;
   - and the handle re-check (R70) holds.

   Site: `observe` (`:912`), where absent-at-base paths are gated today. **Must hold:** ABSENT-BASE-LOOP reports
   `git config --global`'s first write with both hashes (before: absent, after: hash). A two-name file there is not
   read. A4-1 H, J and LOOP stay unread.
3. **R70, the handle re-check adds `nlink`** (the single-name condition) to `dev`, `ino` and type, before any byte.
   Site: the `fstat` check inside `observe`. **Must hold:** QA 96's HANDLE-NLINK seam test is not read; under a
   mutant that drops only the `nlink` comparison, it is read.
4. **R71, true record texts on both sides:**
   - **machine side** (`compare`, `:1044`): a stage whose start was not read shows stage-start facts as "before"
     (A6-4); a failed read says "unreadable", never "absent" (A6-5);
   - **repository side:** `ConfigWatch.readForCompare` (`:642`) and `closeAndRestore` (`:664`), and the shared
     `fileState` (`:403`) and `changed` (`:438`). An unread record prints both sets of facts, never two identical
     placeholder sides (A7-4).

**Not in A8:** D-A2-7, D-A5, and R37's named limit, now stated for R67 too: `realpath` is checked just before open,
not on the handle.

## 3. Read ONLY this

1. The `configwatch.ts` sites above, at `d223d1d`.
2. Rulings-15 in full.
3. Report A7: the verdict section, §9 and §11.
4. **Known positives:** QA 96's probe files in `docs/loops/qa-scripts-a7/` (ABSENT-BASE-LOOP, TWO-NAME-LATER,
   R65-FACTS, STAGE-START-UNREAD, HANDLE-NLINK). A7 is red on each.

## 4. How

- **One commit per ruling.**
- **Red first on YOUR tests:** the new tests alone on `d223d1d`, as `loop/15-slice-3-a8-redcheck`.
- **A code mutant per protection,** each on `loop/15-slice-3-a8-mut-<name>`.
- **CI now runs on SIA's own runners on tcm for branches.** It is faster and costs no GitHub minutes, and it is
  Linux. Dispatch freely (D-040) and read each run per test.
- **Ask atlas before a full local suite.** Keep `docs/loops/loop-15-slice-3-a8-developer-handoff.md` current.

## 5. Rules

- **Pushing:** push only your `loop/15-slice-3-candidate-a8` and `loop/15-slice-3-a8-*` branches. Never `master`,
  never force, and read back each push.
- **Talk to atlas** only in A2A-Hub room `k57frxw0ptb8tadmqdwy0khhks8ey006`, with `--session`, never `--peer`. End every
  turn with `--wait --wait-timeout 1800`.
- **On a refusal or a denied command,** stop and tell atlas.

## 6. Hand back

- **The frozen SHA,** plus a handoff covering:
  - the changes by ruling and commit;
  - red then green, with run ids;
  - each mutant, with the tests it reddens;
  - what was not verified;
  - the model.
