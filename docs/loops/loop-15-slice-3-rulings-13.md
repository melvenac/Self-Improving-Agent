# Loop 15 slice three: rulings 13, on QA report A5 (candidate A5 REJECTED), the CA-15 clause 3 amendment (D-041), and what A6 carries

**By:** Atlas (planner), record session **90** · **Date:** 2026-09-24 · **Model:** `claude-opus-5-5`, effort high.
**On:** `docs/loops/loop-15-slice-3-qa-report-a5.md`, by the QA seat (Probe), record session 92, merged to master
in PR #142 (`697f9fa`, head `6df52d8`). I read the verdict, §3.6, §9, §11 and §14 on master, and I read the two
Linux probe runs myself (`35952428545` at A5, `35952430721` at A4, per-test failures). **Candidate A5 `4c1287f` is
REJECTED.**
**Aaron's decision in force:** D-041 (record rev 109, PR #141): *"yes, let's do it for a6."*

---

## The verdict, accepted

**What A5 fixed, measured against known positives:**
- **A4-1 is closed.** QA 89's four shapes are red at A4 and green at A5, and each has its mutant.
- **A4-3 is closed:** the record carries the hash it read.
- **R57 is met.**
- **R59's `rollBack` sentence is right in both directions.**
- **R58 is met for (b)3, R29 and R35.** R29's test is shown able to fail by the narrowest possible revert.
- **The full suite exited 0** (1124 passed, 16 skipped). CI on the exact head succeeded.

**Why it is rejected:**
- **A5-1 (high):** the route walk can stop short of the real file. The path is then silently unwatched: no edit is
  hashed, no swap is reported, and the loop completes. Two causes: (a) a relative link that climbs out with `..`,
  which is GNU stow's layout; (b) a linked folder with two or more levels beneath it. A regression from A4.
- **A5-4 (medium):** a repository file that is new since the loop's base, and not touched by the stage, is reported
  "modified" with identical identity facts. The stage fails, and the record says to recover by hand.
- **Low:** A5-2 (R58's letter for (b)4), A5-3 (a base note claims a read that never happens), A5-5 (no test asserts
  "reverted" is present).

## This seat's error entries

1. **The A5 dispatch table said `845dfaa` carried "R59's read half: its own test".** It also changes two lines of
   `configwatch.ts`. I wrote the row from the commit's subject line, not its diff. That is rule 14: asserted where it
   could be derived. It reached QA, which found it (report A5 §11.6). **The containment is structural:** from now on,
   the planner builds a dispatch table's "carries" column from `git diff --stat` for each commit, not from its title.
2. **R55 said what to do when the route differs, and nothing about a route that cannot be established.** The
   candidate took the missing case as "record nothing". Silence is the failure `shared.md` names ("skip is not pass;
   silence is not all-clear"). The rule was stated for the difference case and not for the case where there is no
   comparison at all. **R61 below closes it for every watched path.**

**The larger correction is D-041.** Six candidates on one clause is the evidence that the mechanism was wrong, not
only the edge cases. Every defect from A2 to A5 lived in hand-written route tracing. A6 removes it.

## Rulings

**R60 (AMENDS CA-15 clause 3 for MACHINE-CONFIG paths, per D-041; SUPERSEDES R55's route requirement on that side).**
- **The read gate is the object.** After preflight, the runtime may read a machine-config path's bytes only if both
  hold:
  1. the file the operating system reaches by opening that path (resolved by the OS, links of every kind included)
     is the file it reached at base. Identity is type, `dev`, `ino` (`{ bigint: true }`) and `nlink`;
  2. the **opened handle** is checked, before any byte is read, and is still that file. It is checked with `fstat` on
     the handle itself, not by a second path lookup.
- **Clause 3's second bullet, for machine-config paths, now reads:** *after a role has run, no machine-config path is
  read unless the file reached is the base file, verified on the opened handle.* A newly planted link that leads to the
  **same** base file may be read. That is D-041's trade, and it exposes nothing outside the base (clause 3's first
  bullet).
- **A different file:** not read. The record names the path with its base and current resolution: the resolved path
  and the identity.
- **A path that does not resolve** (dangling, or absent) is not read, and it is reported (R61).
- **A link planted AT the watched path itself** is still reported as a type change (clause 4), with the path as
  written checked by `lstat`. That is A4's lexical check, which held.
- **The machine-config side stops using the route walk.** `MachineConfigWatch`'s `recordChain`,
  `resolutionMismatch`, `snap`'s chain and `baseNotes`'s chain are replaced by the object test. If the machine-side
  gate calls `routeChain` again, that is itself a finding.
- **The repository side KEEPS its chain** (`recordRepoChain`, then `repositoryResolutionDiff`, at A5
  `configwatch.ts:317` and `:330`). Links there are refused at base (clause 5), so a planted link always differs from
  base and fails closed. **But `routeChain` keeps A5-1(b)'s defect:** `rest` is built cumulatively, which doubles the
  path for a link with two or more components after it. Because the repository side still uses it, **A6 fixes that
  defect in `routeChain`**, so the record names the right entry (clause 4). One test and one mutant.
- **What is unchanged:** R49's "a path absent at base is never read after a role has run", R54's two baselines,
  clause 3's write and delete half, clause 5, and the repository side's gate (R57, whose one defect is R62).
- **Race:** checking the handle closes the check-then-read race for READS. R37's named limit is narrowed to OPEN: a
  racing role can make the runtime open a different file, but not read it.

**R61 (A5-1's class, and report A5 §11.2; every seat has held this rule, and it is now a row).** **Every watched path
is, at every stage, in exactly one REPORTED state:**
- **read**, with its hash;
- **not read**, with the reason and its identity facts;
- **unwatched**, with the reason: for example, it did not resolve at base.

**No path may be absent from the record.** The base note states the state the runtime will actually use. A note that
says "read through that target" for a path that will not be read is A5-3, and R59's class.

**R62 (A5-4; R57 and R54(2), report A5 §11.5).** **Attribution never treats "not read" as "changed".** Where either
side of a comparison is unread, the runtime compares the identity facts both sides hold. Equal facts mean no change. A
file new since the loop's base that the stage does not touch is **no change** in that stage. QA 92's `probe-r57.mts`
NEWBETWEEN is the known positive (A5 fails, A4 is `ok`). The `info/refs` writer need not be found for this ruling.

**R63 (test letter: A5-2, A5-5, report A5 §11.4).** **R58 reaches every (b) test.**
- (b)1, (b)2, (b)4 and (b)6 each assert their own plant and carry their own control in the same test.
- One test asserts that "The offending paths were **reverted**." is **present** after a revert that ran. QA's
  M-R59-never must turn it red.

**Report A5 §11.1 and §11.3 (relative targets; links above the anchor) are answered by R60.** The operating system
resolves both.

## Rows these rulings touch, read back

| Row | Touched by | Effect | At A5 | A6 must |
|---|---|---|---|---|
| **CA-15 clause 3** (machine side) | R60 | object test, handle-verified; the same file through a new link may be read | reads hold; A5-1 silently unwatches | pass as amended: A4-1's shapes not read, stow/XDG/relative/multi-level edits read |
| **CA-15 clause 3** (repository side) | R60 (`routeChain`'s `rest` fix) | the gate is unchanged; the chain names the right entry | pass (it fails closed) | pass, and the record names the right entry |
| **CA-15 clause 4** | R60, R61 | a link at the watched path is still reported; every path has a reported state | A5-3 | pass, with no false base note |
| **CA-15 clause 5** | none | preflight refusal of repository links is unchanged | pass | pass |
| **CA-15 (b)** | R63 | every (b) test asserts its plant and has its own control | A5-2 | pass by R63's letter |
| **CA-4f** | R60, R61 | edits through any base link are hashed; a path that cannot be read is reported, never silent | **fails** (A5-1) | pass, with A5 as the known positive for STOW-LOOP |
| **CA-4a** | R62 | an untouched file new since base is no change | **fails** (A5-4) | pass, NEWBETWEEN `ok` |
| **CA-11** | R60 | the "config outside the repository" row is unqualified | qualified | pass, unqualified |
| **CA-14** | R61, R62 | no false "modified", no false "read through" | A5-3, A5-4 | pass |
| **R35** (dotfiles link at base) | R60 | proceeds past preflight; its target is read if it is the base file | pass on win32, A5-1 on Linux | pass on both |
| **R50** (hard link at base) | R60 | same file with the same `nlink` is read | pass | pass |
| **R54** | R62 | the two baselines are kept; an unread side compares identity facts | A5-4 | pass |
| **R57** | R62 | the repository `begin` gate is kept | pass, with A5-4 | pass |

**I looked for a row R60 would weaken beyond D-041's stated trade, and found one to name.** A role that replaces the
base file **in place** with different bytes is still read and hashed. That is CA-4f's purpose, so it is not a
weakening. A role that plants a new link to the **same** base file is read. That is the trade, recorded in D-041. I
found no third case. **QA is asked to look for one.**

## A6

- **What it is:** a new commit series on A5 (`4c1287f`), carrying R60 to R63. **Keep A5's passing work:** R57's
  gate, R59's texts, the `realpath` in-place fix where it still applies, and R58's tests. **Take the route walk out of
  the machine-config side, and fix `routeChain`'s cumulative `rest` for the repository side (R60).**
- **One commit per ruling.** The dispatch table will be built from each commit's diff (error entry 1).
- **Carried, not in A6:** D-A2-7, D-A5, and the open half of R37 (a named limit).
- **Who builds it:** the link subject stays with **a fresh Grok 4.7 session**, record session **93** (T-177), with
  `docs/loops/loop-15-slice-3-a6-grok-brief.md`. **QA is record session 94**, a fresh Claude session.
- **Known positives for QA 94:**
  - A5 `4c1287f` for A5-1: `35952428545` and win32 `r35anchorEdit`;
  - A5 for A5-4: `probe-r57.mts` NEWBETWEEN;
  - A4 `f9a1aa8` for A4-1: `35928008495`.
