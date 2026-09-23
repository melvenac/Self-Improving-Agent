# Forge, record session 80 — final handoff to the fresh developer session

**By:** Forge (developer), record session 80 · model `claude-opus-5-5` · effort high (the transcript's run from
01:04:10Z) · 2026-09-23. **This seat stops here without `/end`** (T-163).

**Read first, in this order:**
1. this file;
2. `loop-15-slice-3-candidate-a-developer-handoff.md` (candidate A in full);
3. `loop-15-slice-3-developer-design-b-repair.md` (B's G-042 design);
4. `loop-15-slice-3-forge-session-80-notes.md` (platform facts and instruments). Its "split not ruled" line
   is **stale**; §3 below supersedes it.

---

## 1. FIRST ITEM: candidate A's layer-2 restore follows links out of the repository

**The finding is Probe's, relayed to this seat by the planner as an early heads-up.** Probe said it decides
the verdict unless overturned. The formal QA report is Probe's to write and was not in the record when this
file was written: read it, and do not rely on this summary.

- **Probe's probe:** a role renames `.git/hooks` and creates a **directory junction** `.git/hooks` → a victim
  directory outside the repository. No admin rights are needed on win32.
- **At `3b19287`:** the loop ends `stage-changed-config`, and then `closeAndRestore`:
  - **deletes the victim's files** (it reads them as "created" and calls `rmSync`);
  - **writes the 14 `*.sample` hooks into the victim directory**;
  - leaves the junction in place;
  - records "every file was put back by bytes".
- **Control:** an ordinary planted hook leaves the victim untouched.
- **Attribution:** a mutant with the restore removed and detection kept leaves the canaries intact. **The
  runtime is the actor.**
- **Predicted, unmeasured:** the POSIX file-symlink variant (`.git/config` → any user file, with `writeBack`
  opening `r+` through the link).
- **The class:** every watched root and path is resolved **through** links (`statSync`, `readdirSync`,
  `openSync`, `readFileSync`, `rmSync`, `chmodSync`).

**Developer error entry, accepted by the planner as the loop's most serious.** I tested the file at a
watched path, never the type of the path, and fixed an instance of a class I had already met once: the
hidden-`.git` `EPERM` in the same restore. The planner's classification.

**The direction, ruled by the planner as direction and not as specification.** The fix is a **new candidate
SHA**, and the criteria gain a row on the watched roots' **type** before it is built.
1. **Snapshot by `lstat`, never `stat`.** Record each watched root's and entry's **type** (file, dir, symlink
   or junction), mode and bytes. Never descend into a link. A link is recorded as a link, with `readlink` for
   its target, not followed.
2. **Preflight refusal:** any watched root that is already a link at base is refused, failing closed.
3. **Compare type first:** a type change at a watched path is a change, whatever the bytes.
4. **Restore never through a link:** remove the link itself (`unlink` for a symlink, a **non-recursive**
   `rmdir` for a junction), then recreate the snapshot's dir and files fresh. `lstat` immediately before
   **every** write, delete and `chmod`, refusing if it is a link. `rmSync` is never recursive here.
5. **"Put back" only after an `lstat` re-read** confirms the snapshot's types and bytes.
6. **Siblings checked, not assumed:**
   - `MachineConfigWatch` hashing through links;
   - deletion of a "created" file inside a junctioned directory;
   - `chmod` through links;
   - the POSIX `.git/config` symlink variant.
- **Planner's addition, to VERIFY not assume:** a non-recursive `rmdir` on a win32 junction removes the
  junction and never touches the target, shown by canaries in the target surviving.

**Where the code is:** `open-brain/src/harness/configwatch.ts`:
- `listTree` (`statSync`, `readdirSync` — both follow links);
- `readState` (`existsSync`/`statSync`/`readFileSync`);
- `writeBack` (`openSync r+`);
- the delete branch (`rmSync(path, { force: true })`);
- `chmodSync`;
- `MachineConfigWatch.hashNow` (`statSync`/`readFileSync`).

Tests to extend: `open-brain/tests/harness/config-channel.test.ts` (CA-4a/4d/4h). Use a victim directory with
canaries, and read the canaries by the same expression before and after.

---

## 2. State of everything, at this file's commit

| Item | State |
|---|---|
| Candidate A | frozen `3b19287`, report `918a1c9`, pushed as `loop/15-slice-3-candidate-a`. PR #112 was opened by the planner, labelled NOT YET QA'd. The verdict is expected to REJECT on §1 (early report); everything else Probe measured passed, including 125 of the developer's rows. Probe's full suite on `3b19287`: exit 0. |
| Criteria A | final at `c9947c5`, an ancestor of `3b19287`. A fix candidate is scored against the same criteria plus the new TYPE row. |
| B design | `e1173b1` (G-042) plus notes `dcd29ee`, pushed as `loop/15-slice-3-forge-design-b`. This file is the next commit on that branch. |
| Step 0 (G-042) | ruled yes: after A's **accepted** SHA; Forge builds the load generator and eld instrument as tooling; QA reproduces the red independently before B's criteria. It runs in a fresh session. |

---

## 3. Rulings that arrived after the notes file (A2A has no memory)

- **Fresh sessions at each candidate boundary** (Aaron: "yes for both", via the planner). After QA's
  verdict, the developer writes a tracked handoff and stops, without `/end`, because of T-163. A fresh session
  takes the next candidate from tracked files.
- **The split, D-036, amending D-033:**
  - **candidate B** = the G-042 repair **plus** `E_t`'s schema change (rulings-2 **R10**);
  - **candidate C** = `T-155`'s verdict function, policy, CLI, derived decision, ledger and `/sync` check.
  - Slice three closes at A, B and C. **No `T-155` work until C.**
- **B's R10 half: pointers, not a design.** Designing it is the fresh session's work.
  - `loop-15-slice-3-rulings-2.md` R10 (a)–(d):
    - (a) the loop id admits human-seat ids;
    - (b) attribution is a field on the acceptance row (`order: shown | attributed`), not a status;
    - (c) `pending` becomes its own status, and a verdict row with any `pending` item is `undefined`;
    - (d) out-of-scope ids are declared in the same parseable block as R3's unrunnable ids, as a separate
      list.
  - The fit table that produced R10 is in `loop-15-slice-3-qa-criteria-a.md` §6.
  - The schema to change is `open-brain/src/harness/schema.ts` `EvidenceSchema` (its JSON is derived and
    drift-checked by `tests/harness/schema.test.ts`).
- **Sequencing, as I understand the record, which the planner should confirm:** the §1 fix is a new A
  candidate. B, both halves, is built only on A's **accepted** SHA.

---

## 4. Authority, and how this seat ended

- **Pushes this session**, each on Aaron's word in this seat's own session, read back with `ls-remote`:
  - `ae87fc6`;
  - `19563a2`, `5a1309e`;
  - `918a1c9`;
  - `dcd29ee`;
  - and this file's commit, if Aaron authorises it.
- **The CA-9 real run** was on Aaron's word ("Yes, run it once").
- **No PR, merge or tag** was made by this seat.
- **Stopped without `/end`**, per T-163. The record was not written by this seat. Session numbers, handoff
  and state go through the planner.
