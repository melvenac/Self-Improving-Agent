# Loop 15 slice three: rulings 6, on QA report A (candidate A REJECTED) and what candidate A2 carries

**By:** Atlas (planner), record session **78** · **Date:** 2026-09-23 · **Model:** Opus 5.5 ·
**Effort:** high (from the transcript's per-entry field).
**On:** `docs/loops/loop-15-slice-3-qa-report-a.md` at `10eb4d0` (`origin/qa/loop-15-slice-3-report-a`),
verified on origin by the planner. **Candidate A `3b19287` is REJECTED on one blocker.** PR #112
was closed with a pointer to the report; its branch is kept.
**The next seats are FRESH sessions (D-035).** Their inputs are this file, the QA report (§13 and
§15), and the developer's final handoff
(`docs/loops/loop-15-slice-3-forge-session-80-final-handoff.md` at `216cec6` on
`origin/loop/15-slice-3-forge-design-b`).

---

## The verdict, accepted

**Blocker D-A1: layer 2's restore follows a planted directory junction OUT of the repository.** A
role renames `.git/hooks` and creates a junction to an outside directory. The runtime's restore then
**deletes** the outside files, **writes** 14 hook samples into that directory, leaves the junction in
place, and records "every file was put back by bytes". The control shows an ordinary hook leaves the
outside directory untouched. The attribution mutant (restore removed, detection kept) leaves it
intact, **so the runtime is the actor.** The POSIX symlink variant is predicted from the code and
unmeasured. **This is the most serious class the project has: a protection that acts outside its
boundary and records success.** The developer entered it as an error before the verdict, and the QA
seat owned the criteria gap that let it through CA-4a.

**Everything else passed** and does not need re-proving except where A2 touches it. That covers the
QA suite, CI run 35810513171 (the POSIX rows passed rather than skipped, and git 2.55.0), 125 of the
candidate's rows, 13 valid mutants, the independent probes, and `/sync` with only pre-existing issues.

## Rulings

**R24. Candidate A2 repairs D-A1 and D-A3, and nothing else.** It is a new frozen SHA on A's base,
scored against criteria A plus the rows below.
- **D-A1**, in the direction the developer's final handoff §1 sets out: lstat snapshots with the
  TYPE recorded; links at base refused at preflight; type compared first; restore never through a
  link (the link itself removed, then recreated from the snapshot, with lstat checked immediately
  before every write, delete and chmod, and rm never recursive); "put back" written only after an
  lstat re-read. The siblings are checked, not assumed: `MachineConfigWatch` hashing through links,
  chmod through links, created-file deletion through a junctioned directory, and the POSIX
  `.git/config` symlink variant. **Verify, don't assume, that a non-recursive rmdir on a win32
  junction removes the junction and never touches its target**, shown by canaries in the target
  surviving.
- **D-A3**, the record's truthfulness: the role-timeout text says "killed with its process tree",
  but a double-forked descendant survived the win32 timeout kill (measured). **The text must say only
  what the kill did.** R22's named limit already says the normal-exit path; the timeout path gains the
  same honesty. A2 does not try to close the double-fork. It names it.
- **No widening.** A2 carries no new capability. B's repair (G-042) and C (T-155) wait for A2's
  acceptance.

**R25. CA-15 (the watched paths' TYPE) is ACCEPTED in the shape QA §13 proposes,** with three probes:
(a) a win32 directory junction, (b) a POSIX symlink run on CI's Linux, where no Developer Mode is
needed, and (c) the attribution mutant. **The fresh QA session finalises its text and commits it
before A2 is built,** citing this ruling. Nothing outside the repository may be read or written by a
restore, and a row proves it with canaries in both directions.

**R26. CA-4h's "M-R18 turns this row red" is reworded to the pair, the same shape as layer 1's
ruling.** M-R18 alone survives because layer 2 restores the pointer first, so R18 is defence in depth
behind layer 2. Its job is shown by the pair M-L2 ± M-R18, which QA report A demonstrated. The clause
is **met by the pair**, and A2's report cites it that way.

**R27. The criteria-side defects are the fresh QA session's to fix before A2 is scored:**
- **D-A2:** the CA-2.5 control passes vacuously on CI; make it discriminate there.
- **D-A4:** CA-4c's global row cannot fail on layer 0, because `GIT_CONFIG_GLOBAL` is stripped; use
  QA's probe H via `HOME` to separate the cases.
- **D-A5**, the detach reflog message, is low. The developer fixes it only if it touches nothing A2
  already changes.

## Why A is rejected and not accepted with a follow-up

The criteria were written to ask whether a real role can make the runtime act outside the
repository, and the answer measured today was **yes, through the runtime's own restore.** Accepting
with a follow-up would ship that. **The honest no is the result** (Aaron's standing ruling), and
everything else in candidate A that passed is carried forward rather than lost.
