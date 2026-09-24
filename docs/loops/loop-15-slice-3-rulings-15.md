# Loop 15 slice three: rulings 15, on QA report A7 (candidate A7 REJECTED), and what A8 carries

**By:** Atlas (planner), record session **90** · **Date:** 2026-09-24 · **Model:** `claude-opus-5-5`, effort high.
**On:** `docs/loops/loop-15-slice-3-qa-report-a7.md` by QA 96, merged in PR #154 (head `bd4c28b`).
**Candidate A7 `d223d1d` is REJECTED.**

## The verdict, accepted

- **Closed at A7:**
  - A6-1 (GITCONFIG-LOOP, HARDLINK-SAME, R61-LOOP);
  - A6-2 (EXISTBETWEEN; A6's natural "2 unrestored" is gone);
  - A6-3 and A6-6 to A6-9.
- **D-042's trade holds both ways.**
- **R29 is protected twice:** M-R29-both reddens the R29 seam, and either guard alone keeps it green.
- **M-R67-nlink reads A4-1 H's outside file,** so R67's nlink condition carries its weight.
- **The full suite passed:** exit 0, 1133 passed, with peers idle.
- **A7-1 (high):** an unread MACHINE path carries no R64 facts. So an in-place write to it in a later stage is silent.
  The ordinary trigger is a machine with no `~/.gitconfig` at base, followed by `git config --global` and then an
  edit. Measured on Linux and win32.
- **A7-2 (low):** A6-4 and A6-5 persist.
- **Lower:** A7-3 (the handle does not re-check `nlink`) and A7-4 (an unread repository record prints two identical
  sides).

## This seat's error entry

**The A7 brief pointed R64 at the repository side's code only** (`readForCompare`, `:719–723`, `changed`). R64 itself
says "for a side that is not read", on either side. The developer built exactly where the brief pointed. **A brief's
code pointers act as its scope, whatever its prose says.** Containment: a brief names **every** code site a ruling
reaches. Where it cannot, it says "on both sides" and names the machine-side class (`MachineConfigWatch`) explicitly.

## Rulings

**R68 (A7-1; R64 on the machine side, made explicit).** A machine-config path that is not read carries, in its stage
record and its attribution, the `lstat` facts type, `dev`, `ino`, `nlink`, **`size` and `mtimeNs`**
(`{ bigint: true }`). An in-place write to an unread machine path in a stage is reported as a change, "not read", with
both sets of facts. That covers ABSENT-BASE-LOOP, TWO-NAME-LATER and R65-FACTS.

**R69 (report A7 §11.3; extends D-042's "same place" to a path absent at base).** A machine-config path absent at base
**may be read once it appears**, only if all three hold:
- its parent directory's `realpath` equals the parent's `realpath` at base;
- its name is unchanged;
- it is a regular file with `nlink` 1.

This is **re-checked on the opened handle** (`dev`, `ino`, type and `nlink`) before any byte. It overrides R49's "absent
at base is never read" **for machine-config paths only**. **Why:**
- it is D-042's reasoning applied to the case D-042 could not reach: a single-name file at the config's own place is
  the role's own write;
- it gives CA-4f its "both hashes" for the most common first write, `git config --global` on a fresh machine;
- R68 still reports it if the conditions fail.

**This widens what is read. It is ruled before A8 exists, on D-042's reasoning, and Aaron is told, with a veto.**

**R70 (A7-3, report A7 §11.2; the handle).** The opened handle re-checks `dev`, `ino`, type **and `nlink`** (R67's
single-name condition), before any byte. The `realpath` condition cannot be carried by a Node file handle. It is
checked immediately before `open`, and the gap between the two is R37's named limit, now stated for R67 too.

**R71 (A7-2, A7-4; the record says what happened, R59/R65).**
- A6-4: a stage whose start was not read shows its stage-start facts as "before".
- A6-5: a read that failed says "unreadable", never "absent".
- A7-4: an unread repository record prints the two sets of facts, never two identical placeholder sides.

Each gets a test and a mutant.

**Report A7 §11.1 (an outside file MOVED into the path is read):** accepted as D-042's stated trade. The file is no
longer outside, and its bytes are the role's act. Recorded as a limit, not a defect.
**§11.4 (mut-type needs three edits):** accepted. The at-path check is redundant for reads; it is kept for clause 4's
reporting. QA's three-edit mutant is the evidence.

## Rows touched

| Row | By | A8 must |
|---|---|---|
| CA-4f | R68, R69 | ABSENT-BASE-LOOP reported with both hashes (R69), or with facts if R69's conditions fail; never silent |
| CA-15 clause 4, CA-14 | R68, R71 | true texts and facts on both sides |
| CA-15 clause 3 | R69, R70 | reads confined to single-name files at the base place; A4-1 H, J and LOOP unread; TWO-NAME not read |
| CA-11 | R68 | unqualified |
| R54, R62, R64 | R68 | the machine side as the repository side |

## A8

- A new commit series on A7 `d223d1d`, carrying R68 to R71. A fresh Grok session, record session **98**, with
  `docs/loops/loop-15-slice-3-a8-grok-brief.md`.
- **QA is record session 99, on the QA PC `desktop-o4egb1e`, driven over SSH (D-045),** once the Windows-path fix PR
  lands. That PR is Forge's, and Aaron merges it.
