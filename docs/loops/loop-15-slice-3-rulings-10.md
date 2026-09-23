# Loop 15 slice three: rulings 10, on QA report A3 (candidate A3 REJECTED) and what A4 carries

**By:** Atlas (planner), record session **81** · **Date:** 2026-09-23 · **Model:** `claude-opus-5-5`,
effort high (transcript per-entry field).
**On:** `docs/loops/loop-15-slice-3-qa-report-a3.md` at `9c8176f` (`origin/qa/loop-15-slice-3-report-a3`), by the
QA seat, record session 87. I read it on origin: the verdict, §3's causes, and §7, §9, §11 and §14. **Candidate
A3 `5010199` is REJECTED.** Draft PR #127 is closed with a pointer, and its branch is kept.

---

## The verdict, accepted

**What A3 fixed, measured, with A2 and `3b19287` as the known positives:** A2-1 to A2-5 as scoped, D-A2,
D-A4, R34, R48 and the D-A2-6 correction. A2's write and delete guards still hold: every victim listing was
unchanged in every probe.

**Everything else passed:**
- 26 type-clean mutants, one per A3 protection, each red on its own test and its own probe;
- the full suite: exit 0, 1116 passed and 5 skipped, with the peers idle and no heartbeat error;
- CI, with each test printed.

**Why it is rejected: CA-15 clause 3's read half still fails, on three shapes QA added.**

| Defect | Severity | What happens |
|---|---|---|
| **A3-1** | medium | a machine-config path absent at base, then made a hard link, is read |
| **A3-2** | medium | a junction or hard link planted **beyond** a dotfiles link that was there at base is read through |
| **A3-3** | medium, a false record | a hard link at a repository watched file **at base** fails every loop, with a false "modified" and a TypeError text |

## This seat's error entry

**R43 and R44 were rulings about instances when the finding was a class.**
- R43 covered a hard link where a file existed at base.
- R44 covered the re-snapshot at each stage.
- A3-1 and A3-2 are the siblings neither named.

This is the planner's known failure shape, "reports a line when it has found a class" (`planner.md`), and the
third round of it on this one clause. **The containment is R49: a rule stated once, as a principle, which the
next sibling cannot slip past.**

## Rulings

**R49 (serves CA-15 clause 3's read half; SUPERSEDES the instance rules R43 and R44 for READS).**
- **The rule.** After preflight, the runtime reads the bytes of a watched repository path or a machine-config
  path **only if its whole resolution is unchanged since base**.
- **"Whole resolution"** means every component from its anchor down to the file, and through any link that
  was there at base. For each component that is its type, `dev`, `ino` (`{ bigint: true }`) and `readlink`
  target, and for the final file its `nlink`, all as recorded at preflight.
- **A path absent at base is never read after a role has run.** Its appearance is reported from `lstat`
  facts alone.
- **On any difference:** report it, naming the component, and **do not open, read or hash the file**.
- **QA reads this by the code path as well as the record** (QA report A3 §14.2). A candidate that stops
  recording the hash but still reads the file fails.
- **One protection, one mutant.**

**R50 (serves clauses 1 and 4 and CA-14's standard; A3-3).** **A hard link already at a repository watched file
at base is part of the base.**
- It is recorded at preflight and compared by identity.
- Unchanged means **no change**, and the loop proceeds.
- It is **not** refused at preflight. Clause 5 refuses symlinks and junctions at base, and widening it to
  hard links is not ruled here.
- R36's rename-over keeps any restore safe.
- **No record may carry an exception text as though it were a finding.** An internal error is named as an
  internal error.

**R51 (serves CA-2.5's win32 form; QA §11.1).** A3's bare `.js` was scored a pass with a note. **A4 plants the
`.cmd` JS-entry shim the row names**, so the row is met as written.

**R52 (serves CA-15 (b) and R29; QA §11.2 and §7.1–7.2).** **Assigned to A4 explicitly, as candidate tests.** The
omission family from rulings-9 is not repeated. They are:
- (b)3, `chmod` through a link;
- (b)4's file-symlink form;
- the **mode-000 read run** (R29), as its own run and never sharing a victim with a write probe;
- the **in-test controls** (b) names: the test writes through the link itself, and the role acts without the
  runtime;
- **R35's control on Linux**, a symlink at `$XDG_CONFIG_HOME/git` at base proceeding past preflight, alongside
  the win32 form.

**R53 (the standing question, QA §11.3).** **Clause-3 failures found by shapes QA added bind.**
- The probe list says what must **at least** be run.
- The clause says what must not happen.
- Reading the clause as limited to the listed shapes would narrow a criterion after a verdict, which the
  criteria forbid.
- Aaron's standing ruling: report the honest no, and never bend the criteria until a candidate passes.

## A4

- **What it is:** a new commit on A3 (`5010199`) carrying exactly R49–R52. A3's passing protections are kept
  and re-scored.
- **Carried, not in A4:** D-A2-7, D-A5, and the R37 race (a named limit).
- **Who builds it:** it is the same link-handling subject, so **a fresh Grok 4.7 session**, record session
  **88**, with `loop-15-slice-3-a4-grok-brief.md`. **QA is record session 89.** B and C remain with the Claude
  developer seat.
