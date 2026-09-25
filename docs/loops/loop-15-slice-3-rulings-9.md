# Loop 15 slice three: rulings 9, on QA report A2 (candidate A2 REJECTED) and what A3 carries

**By:** Atlas (planner), record session **81** · **Date:** 2026-09-23 · **Model:** `claude-opus-5-5`,
effort high (transcript per-entry field).
**On:** `docs/loops/loop-15-slice-3-qa-report-a2.md` at `8cddfc7` (`origin/qa/loop-15-slice-3-report-a2`, PR #124),
by Probe, record session 85. I read it on origin: §9, §11 and §14 in full, and the verdict. **Candidate A2
`2add792` is REJECTED.** Draft PR #121 was closed with a pointer, and its branch is kept.

---

## The verdict, accepted

**What A2 fixed, measured by QA:**
- **D-A1's write and delete route is closed.** QA planted 13 shapes on win32. None wrote or deleted outside
  the repository. The same shapes run against `3b19287` deleted canaries, wrote samples and config into the
  victim, and overwrote hard-linked victims.
- **Also measured passing:** R36 (rename-over), R38 (no git beneath an ancestor link, rollback included),
  R41 (measured by QA itself) and D-A3.
- **The rest passes:** the full suite (exit 0, 1107 passed, 5 skipped, peers idle), CI, 15 type-clean
  mutants, and R32's one-mutant-per-protection.

**Why it is rejected: CA-15 fails on the read half, the record and one silent pass.**

| Defect | Severity | What happens |
|---|---|---|
| A2-1 | blocker | `MachineConfigWatch` re-bases at every stage, so the next stage reads through a link a role planted |
| A2-2 | blocker | a link at a watched tree root that was **absent** at base passes silently. The runtime creates a directory that never existed, and the loop completes with nothing recorded |
| A2-3 | high | a tree-root link is never named in the record |
| A2-4 | medium | a machine-config link at a parent component at base is not recorded |
| A2-5 | medium | a hard-linked file is read before `nlink` is compared |
| D-A2, D-A4 | rows not met | these rows are not met, and the cause is this seat's dispatch (below) |

## This seat's error entries (all escaped to the developer and QA)

1. **The dispatch omitted D-A2 and D-A4.** Amendment 4 made both rows on the candidate's own tests, and the
   Grok dispatch listed D-A1, D-A3 and D-A5, followed by "nothing else".
2. **R36 was silent on the read.** It made the write safe by construction and said nothing about reading the
   bytes before the check. Clause 3's read half, per R31 and R35, forbids that read (QA §11.2).
3. **R39's "base" was unqualified.** R35 and clause 3 mean the loop's base, and A2 read it as each stage's
   start (QA §11.3).

**One family:** each is a ruling written from the case in front of it (the write, the stage) without being read
back against the criteria row it serves. It is a cousin of "a ruling with no acceptance row fires nowhere"
(`shared.md`). **The containment:** every ruling in this file names the clause it serves.

## Rulings

**R42. Candidate A3 is a new commit on A2 (`2add792`), and carries exactly R43–R48.** A2's passing guards are
kept and re-scored. A3 re-runs every row, and each CA-15 probe runs against `3b19287` **and** `2add792`.
**Carried, not in A3:** D-A2-7 (a `.git` junctioned at base to a non-repository is recorded `not-a-repo`, with
no harm measured) and D-A5.

**R43 (amends R36; serves clause 3's read half and A2-5).** **Nothing is read through a hard link that was not
there at base.**
- Compare identity (`dev`, `ino` with `{ bigint: true }`, and `nlink`) **before** reading any bytes.
- On a mismatch, report an identity change naming the path, **without reading**.
- This covers repository watched files **and** machine-config paths.

**R44 (amends R39; serves clause 3, R35 and A2-1).** **"Base" is the loop's base, taken once at preflight.**
- `MachineConfigWatch` snapshots at preflight and never re-bases at a stage start.
- A link planted in any stage is a change for the rest of the loop, and no later stage reads through it.

**R45 (serves clause 1, CA-14's standard and A2-2).** **A watched path or tree root that was ABSENT at base is
still watched.**
- A link appearing there is a change (absent → link).
- The restore removes the link and restores the **absence**. It never creates a directory that did not exist.
- The record names it.
- A loop that ends with such a change unrecorded fails.

**R46 (serves clause 4 and clause 5's control; A2-3, A2-4).** **The record names every link-typed path with its
type and target** (`readlink`): roots and entries, and base links at a **parent component** of a
machine-config path. That last case needs `lstat` on each component, the same walk as R30's.

**R47 (serves CA-2.5 and CA-4c).** **D-A2 and D-A4 are assigned to A3, explicitly, as the criteria rows state:**
- CA-2.5: a planted launcher control and its refusal twin, which run on every platform, with the
  real-`claude` control `skipIf` given a reason;
- CA-4c: the global row simulated through a scratch `HOME/.gitconfig` with `GIT_CONFIG_GLOBAL` unset, and
  turned red by M-L0;
- R34: assert the planted value `input`, with a control showing the system value is not `input`.

**R48 (serves the "read from the CI run's per-test output" clauses in CA-2.5 and CA-15 (b)).** A3 **may add a
per-test reporter to CI for the harness tests** (verbose, or a JSON artifact), so those rows can be read as
printed rather than derived from counts. The change must be minimal, with nothing else in the workflow.

**D-A2-6 (low):** A3's handoff corrects A2's claim that "a junctioned `.git` never reaches a git call".
`runtime.ts:361` runs `rev-parse` before `:366`.

## Who builds A3

**Candidate A is link handling: the same subject that had the Claude developer's responses refused twice**
(T-177). This seat **recommends** that A3 goes to **a fresh Grok 4.7 session in Cursor**, record session **86**, with a
compact brief (`loop-15-slice-3-a3-grok-brief.md`), and that B and C return to the Claude developer seat.
Aaron asked the question in the planner session, and the recommendation was given as conditional on this
verdict. **The builder is Aaron's to confirm.** The brief is written so that either seat can use it.
