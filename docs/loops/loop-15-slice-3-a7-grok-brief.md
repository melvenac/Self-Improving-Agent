# Candidate A7, compact brief for a FRESH developer session

**By:** Atlas (planner), record session 90 · 2026-09-24. **To:** the developer seat, **record session 95**. That is
a fresh Grok 4.7 session in Cursor on `~/Worktrees/sia-forge`. The brief also works for a Claude seat. **Budget:**
256k context. Read this file, then only what §3 lists.

## 1. Where things stand

- **A6 `dc35b24` (Grok, session 93) was REJECTED:** `docs/loops/loop-15-slice-3-qa-report-a6.md` on master.
- **A6's approach worked.** The OS resolves links, and the runtime checks the file it reached on the opened handle.
  That closed A5-1, A4-1 and A5-4, and no outside bytes are read anywhere. **Keep all of it.**
- **It failed on two things:**
  - **A6-1:** only "unwatched" paths are ever reported, so an ordinary `git config --global` (which writes a new file)
    followed by an in-place edit leaves no record;
  - **A6-2:** `drifted` makes an untouched file look "modified".
- **Two of the causes were the planner's rules, now fixed:** R62's facts could not see an in-place write, and "same
  file" was too strict for how config is saved.
- **A7 is a new commit series on `dc35b24`.** Create `loop/15-slice-3-candidate-a7` from it.
- **A7 carries exactly R64 to R67**, in `docs/loops/loop-15-slice-3-rulings-14.md` on master. R67 is approved by
  Aaron (D-042).

## 2. The work (`configwatch.ts` line numbers at `dc35b24`)

1. **R67: the read gate becomes "same place, not shared" (machine-config side).**
   - Read a machine-config path only if **(1)** its `realpath` equals the base `realpath`, **and (2)** the file there
     is **either** the base file (same `dev`, `ino` and type, with **`nlink` ignored**), **or** a regular file with
     **`nlink === 1`**.
   - **Re-check both on the opened handle** (`fstat`) before reading any byte, as A6 already does for the object.
   - Anything else is not read and is reported, with both resolved paths and both identities (A6-8).
   - **Must hold:**
     - `git config --global` in one stage and an in-place append in the next are **both hashed**, with both hashes
       (QA 94's GITCONFIG-LOOP);
     - a hard link made elsewhere to the base file does **not** stop reads;
     - QA 89's A4-1 **H**, **J** and **LOOP** stay unread;
     - A4-1 **R** (the base target replaced by a new file) is now **read**. That is intended; it is D-042's trade.
   - Today the identity checks include `nlink` (for example `:424`, `:431–438`). Take it out of the "same file" test
     only; keep it as a reported fact.
2. **R64: attribution compares at the stage's start, and `drifted` is out of attribution.**
   - Today `drifted` (`:719–723`) makes a stage report a change when a file only differs from the loop base. It may
     inform the read gate; it must never make a stage report a change.
   - **For a side that is not read, compare `lstat` facts:** type, `dev`, `ino`, `nlink`, **`size` and `mtimeNs`**
     (`{ bigint: true }`). Equal facts mean no change.
   - **Must hold:** QA's EXISTBETWEEN and NEWBETWEEN are `ok`, and the candidate's R57 test still passes, because an
     in-place write to an unread file changes size or mtime.
3. **R65: every watched path appears in every stage's record, in exactly one state.**
   - The states are **read** (with its hash), **not read** (with the reason and R64's facts), or **unwatched** (with
     the reason). Paths unreadable at base (mode 000, a directory) are included.
   - **"Unreadable" is written when a read failed**, never "absent" (A6-5).
   - **A stage whose start was not read** shows its stage-start facts as "before", not the loop base's hash (A6-4).
4. **R66: tests that can fail, each with a CODE mutant shown red on CI:**
   - **R29 via the `openSync` seam:** fail if the runtime ever opens the victim's path (report A6 §3.3). This replaces
     the old instrument, which could be blind;
   - **the handle re-check:** the seam renames a different file over the path inside `open`. It must not be read,
     and under the narrow mutant (keep the read, drop only the handle comparison) it is;
   - **the at-path type change** (clause 4);
   - **R50 at row level:** the `baseHardEdit` shape;
   - **TRADE-DIFF's record** carries both resolved paths and both identities;
   - **`8ad8728`'s hard-link assertion** keeps its identity form and adds that the base side differs.

**Not in A7:** D-A2-7, D-A5, and R37's remaining limit (a race can make the runtime OPEN a different file; the handle
check stops the READ).

## 3. Read ONLY this

1. `configwatch.ts` at `dc35b24`: `MachineConfigWatch` (`:878` onwards: `observe` `:909`, `baseNotes` `:999`,
   `begin` `:1030`, `compare` `:1041`), the repository side's `readForCompare` (`:633`) and its compare loop
   (`:719–723`), and `changed` (`:431`).
2. Rulings-14 in full.
3. Report A6 on master: the verdict section, §3.3 (the seam), §9 and §11.
4. **Known positives on origin:**
   - QA 94's probe files and `qa-scripts-a6/` on master: GITCONFIG-LOOP, EXISTBETWEEN, NEWBETWEEN, TRADE-DIFF;
   - QA 92's `qa/loop-15-slice-3-a5-probe` (`dfbac1b`), which must stay green;
   - QA 89's `qa/loop-15-slice-3-a4-probe` (`9f58fbc`): H, J and LOOP unread; R is now read, by D-042.
5. The existing test files, only where your new tests go.

## 4. How

- **One commit per ruling** (R64, R65, R66, R67), plus separate handoff commits. If two rulings truly share a
  function, say so in the commit message. The dispatch table will be built from each commit's diff.
- **Red before green, on YOUR tests:** put the new tests alone on `dc35b24` as `loop/15-slice-3-a7-redcheck`, dispatch
  CI there (D-040), and report each failing test by name.
- **A CODE mutant per protection,** each on its own `loop/15-slice-3-a7-mut-<name>` branch, dispatched on CI and read
  per test.
- **Read every CI run per test before you report it.** A dispatched run is not a result.
- Keep `docs/loops/loop-15-slice-3-a7-developer-handoff.md` current.
- **Ask atlas before a full local suite** (G-042).
- At about 70% context, stop at a clean commit and push.

## 5. Rules (D-038, D-040)

- **Pushing:** only `loop/15-slice-3-candidate-a7` and your own `loop/15-slice-3-a7-*` branches. Never `master`, and
  never force. Read back each push with `git ls-remote`.
- **CI:** dispatch or re-run CI on your own branches without asking (D-040). Name every run id.
- **Talking to atlas:** only in A2A-Hub room `k57frxw0ptb8tadmqdwy0khhks8ey006`, always with `--session`, and never
  with `--peer`. **End every turn with `--wait --wait-timeout 1800`.**
- **When something stops you:** on a refusal or a denied command, stop and tell atlas.
- **The record:** `.agents/state.json` belongs to the planner.

## 6. Hand back

- **The frozen SHA,** pushed. Do not push to the candidate branch after reporting it.
- **The handoff file**, covering:
  - the changes, by ruling and commit;
  - red then green for each item, with CI run ids and per-test results;
  - each mutant, with its branch, run id and the tests it turns red;
  - what was not verified, and why;
  - the model, as Cursor shows it.
- **Any findings that fail no row.**
