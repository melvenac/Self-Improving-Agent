# Loop 15 slice three: rulings 12, on QA report A4 (candidate A4 REJECTED) and what A5 carries

**By:** Atlas (planner), record session **90** · **Date:** 2026-09-23 · **Model:** `claude-opus-5-5`, effort
high (this session's transcript, 155 of 155 assistant entries at the time of writing).
**On:** `docs/loops/loop-15-slice-3-qa-report-a4.md`, by the QA seat (Probe), record session 89, merged to master
in PR #137 (`3ecfa70`, head `58890bc`). I read the verdict, §2's rows, §3.2 to §3.4, and §7, §9, §11 and §14 on
master. I read the CI log of QA's probe run `35928008495` myself: `4 failed | 1129 passed | 6 skipped (1139)`, and
all four failures are A4-1's tests in `qa89-a4-probe.test.ts`. **Candidate A4 `f9a1aa8` is REJECTED.**
**Intent read first**, as the planner's role requires: the SIA Step-Back artifact (Parts 1 to 5, read on the
artifact itself), `.agents/SYSTEM/PRD.md` and `README.md`, record session 90.

---

## The verdict, accepted

**What A4 fixed, each measured against a known positive (report A4 §3, §4):**
- **A3-1, A3-2 and A3-3 are closed.** A3 fails each by the same expressions and A4 passes.
- **QA's three new siblings are closed.** `newHook` fails at A3, A2 and A. `r35anchor` fails at A3. `baseHardCfg`
  fails at A3.
- **R50, R51 and R54 are met.**
- **34 mutants, each type-clean.** Every A4 protection is killed by its own mutant.
- **The full suite exited 0:** 1121 passed and 10 skipped, with the peers idle and no heartbeat error.

**Why it is rejected: A4-1 (medium, CA-15 clause 3).** Take a machine-config path whose **last** entry is a link at
base: the dotfiles `~/.gitconfig → dot/gitconfig`, which R35 allows. A role repoints what that link leads to. A4
then reads the outside file and records its hash. QA showed four ways of repointing it, all through on Linux: a
hard link, a directory link, a rename-over, and the whole loop run. The in-test control shows the instrument can
hit. **A2-1/A2-5 and A3-1/A3-2 were the same class.**

## This seat's error entry

**R49 stated a principle and then defined it lexically.** It said "every component from its anchor down to the
file, and through any link that was there at base". It then listed what to record for each component, including
the **`readlink` target**: the link's text, not the object it leads to. A4 built exactly that list. So a link
whose text is unchanged, but whose target object has been swapped, compares equal. **The fault is in R49's
definition, not only in A4's reading of it.** QA's §11.1 is right to return it.

**This is the fifth round of one failure on one clause** (rulings-9, -10 and -11 are the earlier ones). R49 was
meant to end the family by stating a principle. It did state one, but the definition beneath it described a
mechanism, a list of what to record, and the next sibling lived in the gap between the two. **The containment
this time is to define the rule by what it protects, not by what to record.** Below, R55 states **what the read
would actually open**, and leaves the mechanism to the developer.

**T-165 note:** every rejection of a Grok-built candidate (A2, A3, A4) traces at least partly to a planner ruling.
The comparison T-165 asks for should read that way, not as a score for the developer seat.

## Rulings

**R55 (serves CA-15 clause 3; SHARPENS R49's definition of "whole resolution"; R49's rule, its absent-at-base
sentence and R54's two baselines are unchanged).**
- **The object test.** After preflight, the runtime may open, read or hash a watched path only if **the object that
  opening the path would reach** is the object that opening it reached at base. It must also reach that object
  **by the same route**.
- **"The object"** is what the operating system opens when it follows the path, every link included, as far as
  it goes. Its identity is its type, `dev`, `ino` (`{ bigint: true }`) and `nlink`.
- **"The route"** is every directory entry the operating system passes through to reach it. That covers every
  component of the path as written, every link, and **every component of every link target, from the target's
  own anchor down**, recursively. Each is compared by type, `dev`, `ino`, and for a link its `readlink` text.
- **A link at the last position is part of the route**, and so is everything it leads to. So is a link at the
  anchor (R35's `$XDG_CONFIG_HOME`).
- **On any difference in the object or the route:** report it, naming the first entry that differs, and **do not
  open, read or hash the file** (R49's letter, unchanged).
- **What stays allowed.** Clause 3's "a link target recorded at base" means that same object, reached by that same
  route. Editing it **in place** keeps both, so it is still read and hashed. That is QA's A4-1 control, and it
  must stay green. A **rename-over** of the base target (many editors save that way) makes a new object, so it is
  reported from `lstat` facts and not read. That was already R49's final-`ino` letter.
- **How the developer builds it is the developer's call.** This ruling says what must hold, not how to walk.
  **One protection, one mutant:** the mutant that reverts R55 must turn A4-1's four shapes red. The R49 mutant
  must still turn the A3 shapes red.

**R56 (QA §11.2, CA-4f's "both hashes" for a path absent at base).** **QA's reading stands.** CA-4f is read with
R49: a path **absent at base** is never read after a role has run. Its finding therefore names the path, the stage
and its `lstat` facts, **not two hashes**. For a path present at base whose object and route are unchanged
(R55), CA-4f's "the path and both hashes" holds as written. QA's `ca4fBase` probe is the model. **The criteria
file will say this in its next amendment.** Until then this ruling is the reading, and no candidate is failed on
the difference.

**R57 (QA §11.3, the repository side's baseline).** **A per-stage baseline for the READ is not within the rule.**
R54(1) already says it: the read gate compares against the **loop's base at preflight**. At A4,
`ConfigWatch.begin` reads every watched repository file at each stage's start without gating against the loop's
base. **A5 gates that read against the loop's base**, the same as the machine side. Attribution keeps its per-stage
baseline (R54(2)). It is reachable only through U3, so it is **not a probe row**. It is a **unit test plus its own
mutant**, run on both platforms.

**R58 (QA §11.4 and A4-2, test quality).** **A4 is not failed on A4-2.** Each of R52's rows passes on a behaviour,
and QA measured the behaviour on Linux. That verdict stands. **But from A5 on, a candidate test that cannot fail
does not count as the evidence for its row.** For every R52 item, and for R55 and R57:
- the test plants **the row's shape**: for (b)3 a symlink **as an entry inside `.git/hooks`** where the snapshot
  holds a hook, and for R29 **a link** to a mode-000 victim;
- the test **prints and asserts the value that lets it fail**: for (b)3, the snapshot's mode against the victim's,
  and they must differ;
- the test asserts **its own plant** (`isSymbolicLink`, or `nlink`);
- the R35 Linux test asserts **the record** (the link's type and target), not only that the loop proceeds;
- each (b) test carries **its own** control, in the same test;
- the developer names, for each such test, **the mutant or the earlier SHA that turns it red**, and QA checks that.
  **A test green at A4 (for R55) or at A3 (for R57) is not evidence for that ruling.**

**R59 (QA §11.5 and A4-3; the record says what happened).** **A record's words are derived from what the runtime
did. They are never written independently of it.** Two instances, one class:
- **A4-3:** a machine-config finding says "not read" in a stage where the file **was** read (report A4 §3.4,
  `r54Revert`). The words come from attribution, not from the gate. "Not read" may only be written by the path
  that did not read.
- **`rollBack`'s "The offending paths were reverted."** (`runtime.ts:1019–1021`, since `3b19287`) is printed
  whatever its list holds. It is written only when that list is non-empty **and** the revert ran.
- **One protection, one mutant each.** This is CA-15 clause 4 ("the record says what happened") and CA-14's
  standard. "Pre-existing" says when a defect started, not whether it matters.

## Rows these rulings touch, read back

The watch-out from rulings-9 to -11 is honoured here: before sending, list every row each ruling changes and say
whether it still passes.

| Row | Touched by | Effect | At A4 | A5 must |
|---|---|---|---|---|
| **CA-15 clause 3** | R55, R57 | a swapped target at any position is not read; the begin read is gated | **fails** (A4-1) | pass, with A4 as the known positive for A4-1 |
| **CA-15 clause 4** | R59 | "not read" only when not read; "reverted" only when reverted | passes as scored; A4-3 was read from the code | pass, and show each text's mutant |
| **CA-15 (b) and R29** | R58 | the tests must be able to fail | pass on behaviour | pass, with discriminating tests |
| **CA-15 clause 5** | none | preflight refusal of repository links is unchanged | pass | pass |
| **CA-4f** | R55, R56 | a base target edited in place is still hashed; absent-at-base paths are reported by `lstat` facts | pass as read with R49 | pass, as R56 reads it |
| **CA-4a** | R57 | detection and restore are unchanged; only the begin read is gated | pass | pass |
| **CA-11** | R55 | the qualification by A4-1 is lifted | pass, qualified | pass, unqualified |
| **CA-14** | R59 | no record carries a claim the runtime did not perform | pass | pass |
| **R35** (dotfiles link at base) | R55 | still proceeds past preflight; its target is now on the route | pass | pass, and still proceeds |
| **R50** (hard link at base) | R55 | the base object and its `nlink` are unchanged, so it is still read | pass | pass |
| **R54** (two baselines) | R55, R57 | unchanged: the gate at the loop's base, attribution at the stage's start | pass | pass |

**I looked for a row R55 would break, and found one risk.** Editors that save by rename-over make the base target a
new object, so a real user's normal edit is reported and not hashed. **That is already R49's letter**, not a new
narrowing, and CA-4f is still met by the `lstat` facts. It is named here so nobody reads it as a regression.

## A5

- **What it is:** a new commit series on A4 (`f9a1aa8`) carrying exactly R55 and R57 to R59. **A4's passing
  protections are kept and re-scored.**
- **Carried, not in A5:** D-A2-7, D-A5, and the R37 race (a named limit). R56 changes no code.
- **Who builds it:** the same link-handling subject, so **a fresh Grok 4.7 session** in Cursor, record session
  **91**, through A2A-Hub (T-177), with `docs/loops/loop-15-slice-3-a5-grok-brief.md`. **QA is record session 92**,
  a fresh Claude session.
- **Every run from A5 on:** CI may be dispatched on the seat's own branch without asking (D-040). QA's probe file
  `qa89-a4-probe.test.ts` on `qa/loop-15-slice-3-a4-probe` (`9f58fbc`) is the known positive for A4-1 and should
  be run against A5 on Linux.
