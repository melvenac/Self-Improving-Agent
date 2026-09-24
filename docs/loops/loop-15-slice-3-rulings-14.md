# Loop 15 slice three: rulings 14, on QA report A6 (candidate A6 REJECTED), and what A7 carries

**By:** Atlas (planner), record session **90** · **Date:** 2026-09-24 · **Model:** `claude-opus-5-5`, effort high.
**On:** `docs/loops/loop-15-slice-3-qa-report-a6.md`, by the QA seat (Probe), record session 94, merged to master
in PR #147 (head `ea825b7`). I read the verdict message, §11 and §12 on master. **Candidate A6 `dc35b24` is
REJECTED.**
**Status of this file:** R64 to R66 are ruled. **R67 is PROPOSED, and waits for Aaron,** because it changes his
D-041. **A7 is not briefed until he answers.**

---

## The verdict, accepted

**What A6 closed, each against its known positive:**
- **A5-1:** QA 92's eight Linux shapes are green at A6 and red at A5; win32 `r35anchorEdit` is hashed again.
- **A4-1:** QA 89's four shapes are unread at A6 and red at A4.
- **A5-4** (NEWBETWEEN), **A5-3** and **A5-5**.
- **The handle re-check works.**
- **No outside bytes are read** in any probe, on either platform.

**This is D-041 working:** the machine-side route tracing is gone, and with it the class of defect that failed A2 to
A5.

**Why it is rejected:**
- **A6-1 (high):** R61 is built only for "unwatched". Read paths, and paths that cannot be read, never appear in a
  stage record. The silent case is ORDINARY: a `git config --global` in one stage, which writes a new file, then an
  in-place append in a later stage. That gives no finding, and the loop completes.
- **A6-2 (medium):** a file present at base, rewritten between stages and untouched in the stage, is reported
  "modified … COULD NOT BE PUT BACK". The cause is `drifted`.
- **Lower:** A6-3 to A6-9 (report §9).

## This seat's error entries

1. **R62 named "identity facts" without size and modification time.** R54 already separated the READ gate (loop base)
   from ATTRIBUTION (stage start). But with facts that cannot see an in-place write, attribution had no way to report
   R57's own test except by comparing against the loop base (`drifted`). That merged the two baselines again, which is
   A6-2. Report §11.6 found the conflict. **R64 below repairs it.**
2. **R60, and the D-041 note I wrote, made "the same file" too strict for how config is actually written.** `nlink`
   was part of the identity, so a hard link made anywhere flips a path to not-read. A rewrite that replaces the file,
   which is how `git config` and most editors save, counts as "a different file", so CA-4f's ordinary write is never
   hashed (report §11.1, §11.5). **R67 below is the proposed repair, and it is Aaron's to decide.**
3. **PR #146 was merged UNSTABLE.** My chained command ran `gh pr checks --watch` before CI had registered. The watch
   exited at once, and the merge ran regardless. The CI run then succeeded (1034 of 1034), so nothing broken reached
   master. But the merge broke `shared.md`'s "merge only on MERGEABLE/CLEAN". **Containment, structural:** every merge
   since has gone through a script that refuses unless checks have registered, all are SUCCESS, and the state is
   CLEAN. Its refusal path was tested on an already-merged PR.

## Rulings

**R64 (A6-2 and report §11.6; SHARPENS R54(2) and R62).**
- **Attribution compares at the STAGE'S START (R54(2)), never against the loop base.** `drifted`, meaning "differs
  from the loop base", may inform the READ gate only. It may never make a stage report a change.
- **For a side that is not read, attribution compares `lstat` facts that can see a write without reading it:** type,
  `dev`, `ino`, `nlink`, **`size` and `mtimeNs`** (`{ bigint: true }`). Equal facts mean no change. Any difference is
  a change, reported "not read" with both sets of facts.
- **Consequences:**
  - an untouched file new since base is no change (A5-4 and A6-2);
  - an in-place write to an unread file during a stage is a change (R57's test);
  - a file whose identity already differs from base at a stage's start is reported ONCE, as its state (R61), not as
    a change in every later stage.
- **The limit, named:** a write that keeps both the size and the modification time is invisible without reading.
  NTFS resolves `mtime` to 100 ns, so it is narrow but real.

**R65 (report §11.3, R61 read literally).** **QA's literal reading is the ruling:** every watched path, in every
stage's record, in exactly one state:
- **read**, with its hash;
- **not read**, with the reason and the R64 facts;
- **unwatched**, with the reason.

That includes paths unreadable at base (mode 000, a directory), which today appear nowhere. **The record text is
derived from the state** (R59): "unreadable" is written when a read failed, never "absent" (A6-5). A stage whose
start was not read shows its stage-start facts as "before", never the loop base's hash (A6-4).

**R66 (tests that can fail, report §11.4 and A6-3, A6-6, A6-7, A6-8, A6-9).** Each of these gets a test **and** a
mutant shown red on CI:
- **R29's instrument is the `openSync` seam** (report §3.3): the test fails if the runtime ever opens the victim's
  path. The old instrument, "the record carries the failed read", is retired, because it can be blind.
- **The handle re-check:** the seam renames a different file over the path inside `open`. At A7 it is not read;
  under the narrow mutant it is read.
- **The at-path type change** (clause 4).
- **R50 at row level:** the `baseHardEdit` shape, in which an in-place edit to a hook hard-linked at base is refused.
  Under M-R50 the loop must turn red.
- **TRADE-DIFF's record carries both resolved paths and both identities** (R60's "report it").
- **`8ad8728`'s assertion keeps its honest form** (identity for a hard link), and adds that the base side differs.

**R67: PROPOSED, AWAITING AARON (amends D-041's "same file as at base").**
- **The read gate becomes: same place, not shared.** After preflight, the runtime reads a machine-config path only if
  both hold:
  1. **the OS resolves it to the same real path as at base** (`realpath`);
  2. **the file there is either the base file** (same `dev`, `ino` and type; **`nlink` no longer counts**) **or a
     regular file with exactly one name** (`nlink` of 1).
- The same two conditions are **re-checked on the opened handle** before any byte is read.
- Anything else is not read and is reported, as R60 already says: a different real path, or a file with other names
  that is not the base file.
- **Why:**
  - it closes A6-1's trigger and report §11.5: `git config --global` and editors that save by replacing the file are
    hashed, with both hashes, as CA-4f intends;
  - it answers §11.1 (`nlink`) and §11.2 (inode reuse): a fresh single-name file is readable whatever its inode number;
  - it keeps clause 3's protection. A redirected path (a link repointed, a directory swapped) changes the real path,
    and a hard link to an outside file has two names. Neither is read.
- **The trade, stated plainly:**
  - QA 89's A4-1 **R** shape (the base target replaced by a new file) becomes READ.
  - A new single-name file at the same real path is the role's own write. Its bytes are ones the role could equally
    have written in place, which CA-4f already hashes.
  - **Nothing outside is read through anything the role redirected.**
  - A4-1's **H**, **J** and **LOOP** shapes stay unread.
- **If Aaron says no:** A7 keeps R60 as written. A6-1's trigger is then answered by R65's reporting alone, so the
  `git config` write is reported "not read" with R64's facts. CA-4f's "both hashes" is then formally unmeetable for
  the common case, and that becomes a criteria question for him.

## Rows these rulings touch, read back

| Row | Touched by | At A6 | A7 must |
|---|---|---|---|
| **CA-4f** | R64, R65, R67 | fails (GITCONFIG-LOOP silent) | the `git config` write reported with both hashes (R67), or "not read" with facts (without R67); never silent |
| **CA-4a / CA-14** | R64 | A6-2 false "modified" | EXISTBETWEEN and NEWBETWEEN `ok`; R57's in-place write reported |
| **CA-15 clause 3** | R67 | pass | pass as amended. H, J and LOOP unread; R read (R67) or reported (without R67) |
| **CA-15 clause 4** | R65, R66 | A6-1, A6-4, A6-5, A6-7 | every path in every stage record, with true texts, and the at-path type change tested |
| **CA-15 (b), R29** | R66 | A6-3 | R29 via the seam; it can fail |
| **CA-11** | R65, R67 | qualified by A6-1 | unqualified |
| **R50** | R66 | M-R50 survives | killed at row level |
| **R54, R57, R62** | R64 | A6-2 | the two baselines kept separate, and each shown by its own mutant |

**What R64 might weaken, checked:** an unread file changed in place, within `mtime` resolution, at the same size. That
is named above as a limit; it is not a new narrowing. **What R67 might weaken, checked:** see its trade. I found no
case where it reads a byte through a redirection. **QA is asked to look for one.**

## A7

- **Base:** a new commit series on A6 `dc35b24`. Keep A6's object test, handle check and R61 base notes.
- **Carries:** R64 to R66, plus R67 **only if Aaron approves it**.
- **Who builds it:** a fresh Grok session, record session **95**. **QA is record session 96.**
- **The brief is written after Aaron's answer on R67.**
