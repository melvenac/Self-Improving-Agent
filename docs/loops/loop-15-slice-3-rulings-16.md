# Loop 15 slice three: rulings 16, on QA report A8 (candidate A8 REJECTED), and what A9 carries

**By:** Atlas (planner), record session **100** · **Date:** 2026-09-25 · **Model:** `claude-opus-5-5`. This session
began before D-047, so its effort was not recorded at the start.
**Intent read before ruling:** the Step-Back artifact (all five parts), `PRD.md` and `README.md`, all in this session.
README's runtime section is the purpose these rulings serve: *"enforcement, not automation"*, and *"boundary failures
only"*.
**On:** `docs/loops/loop-15-slice-3-qa-report-a8.md` by QA 99 (headless, desktop-o4egb1e), on
`origin/qa/loop-15-slice-3-a8-report` (`95727ef`), read in full (597 lines).
**Candidate A8 `9e2dd5d` is REJECTED.**

## The verdict, accepted

- **Closed at A8, each shown red at A7 and green at A8:**
  - A7-1's ordinary trigger (ABSENT-BASE-LOOP, R69-GITCONFIG-FIRST: both hashes);
  - TWO-NAME-LATER;
  - A7-2 (A6-4, A6-5 texts);
  - A7-3 (R70 on the handle);
  - A7-4 (repository facts).
- **R69's widening holds at every edge QA tried:** hard link, symlink at the name, parent replaced by a link, a
  case-renamed name, and a FIFO. **Each guard is load-bearing:** its mutant reads the planted bytes.
- **No regression.** Every carried mutant kills at least what it killed at A7.
- **A8-1 (medium):** an unread machine record carries R68's facts only in the text of a change. Stable entries, the
  handle text, the type-change texts and `absent → symlink` carry none.
- **A8-2 (medium):** an in-place write to an UNREADABLE machine path is compared, then printed `unreadable →
  unreadable`, and `runtime.ts:1064` drops it because the two texts are equal. The write is silent.
- **Lower:**
  - A8-3: the `base` label shows the stage start's facts, and no side prints `type`;
  - A8-4: R71's A6-4 and A6-5 halves have no candidate test, and nothing separates `size` from `mtimeNs`;
  - A8-5: a duplicated comment.
- **CA-12, not met as measured:** the suite's one failure is the 8.3-path test that PR #156 fixed. A8 sits on A7,
  which predates #156. **Attributed to the base, not to A8.**

## This seat's error entry: sixth in the family

**Rulings-15's R68 named the triggers it covered: ABSENT-BASE-LOOP, TWO-NAME-LATER and R65-FACTS.** Report A7 had listed
**three** triggers for A7-1, and WRITEONLY-LATER was the third. The list left it out, and A8-2 is that trigger, still
silent. It is the same shape as rulings-9, -10, -11 and R49 (owned in rulings-12), and as the A7 brief (rulings-15):
**a rule defined by a list of what it covers leaks at the list's edge.**

**Containment, applied below:**
1. Every ruling here is stated by **what it protects**.
2. Before sending, the planner read QA 99's defect table (§9) and "Open for the planner" (§15) back against each
   ruling. Each defect is assigned a ruling in the table at the end.

## Rulings

**R72 (A8-2; what CA-4f protects, stated as a rule).** A write to a watched config path during a stage is **never
silent, whether or not the runtime can read the file**.
- Whether a stage changed an entry is decided from the facts and hashes the runtime compared. It is **never decided
  from whether two printed texts are equal**.
- `runtime.ts:1064` (`if (f.before === f.after) continue;`) decides it from the texts. That is the defect's class,
  not only its instance.
- When the runtime's comparison says "changed", a finding is written. Its two sides print whatever the runtime has for
  each (facts, hash, or both). A placeholder (`unreadable`, `absent`) never stands alone for a side that has facts.
- **Applies on both sides:**
  - the machine side (`MachineConfigWatch.compare`, `configwatch.ts:1077` on, including `stageBefore` at `:1093–1095`
    and the text builders at `:1116–1143`);
  - the repository side (`ConfigWatch.readForCompare` at `:642`, `closeAndRestore` at `:664`, and the shared
    `fileState` at `:403` and `changed` at `:438`).
- The repository side already decides by state (`changed`). **Confirm that it holds for an unreadable repository file**
  as well, and say so in the handoff.

**R73 (A8-1; R65 and R68, as their words say).** Every watched path, in every stage's record, carries the `lstat`
facts: type, `dev`, `ino`, `nlink`, `size`, `mtimeNs`. **Changed or not, read or not.**
- That covers the stable `not read: <reason>`, `unreadable`, the handle's refusal, the at-path type change, and
  `absent → symlink`.
- Where `lstat` itself fails, the record says that, with the error code. It is **never an empty side**.
- **Why:** a record that says "not read: different file" without naming the object cannot be audited. A reader
  cannot tell which file was refused, or whether it was the same one as last stage.

**R74 (A8-3 and QA's §11.1; true labels).** Each set of facts is labelled by **what it is**: `loop base`, `stage start`
or `current`. It must never say `base` for the stage start's facts. `type` is printed on every side. When the handle
re-check refuses because the object **gained a name inside `open`**, the text says exactly that, not "different
file".

**R75 (A8-4; each protection gets a candidate test and a mutant).**
- Candidate tests are needed for:
  - R71's A6-4 half (stage-start facts shown as "before");
  - R71's A6-5 half (a failed read says `unreadable`);
  - R72 on an unreadable file;
  - R73 on a stable unread entry;
  - `size` alone and `mtimeNs` alone. Make each deterministic; do not depend on a write landing in the same
    timestamp tick.
- Each of these gets a mutant that turns **its own** test red.

**R76 (CA-12's base).** The A9 series **begins with a merge of current `origin/master` into `9e2dd5d`**, as its own
commit, so the suite is measured on a base that carries PR #156.
- The merge commit changes nothing of A8's; QA verifies that by diffing it against master.
- The dispatch table lists it separately, from its own `git diff --stat`.

**On QA 99's other questions (§15):**
- **Q3, R70 and the base object.** R70's `nlink` re-check applies on **both** routes. A base object that gains a name
  inside `open` is refused: that is fail-safe, and inside the race window only. **HANDLE-NLINK-BASE's assertion is
  obsolete by this ruling.** R74 fixes its text.
- **Q4, the renamed appearance.** QA's reading is the one meant: a case-variant name that resolves at the watched path.
  Lock-and-rename is D-042's trade, and it is read.
- **Q5, `gitnexus` on the QA PC.** A question for Aaron, not a QA gap. Until then, `/sync --check` after
  `gitnexus analyze` is recorded as unrun on that PC.
- **Q6, the real-`claude` rows.** Accepted as skipped there, attributed as in reports A to A8.
- **A8-5:** remove the duplicated comment.

## Every defect and question, assigned

| From report A8 | Ruling |
|---|---|
| A8-1 | R73 |
| A8-2 | R72 |
| A8-3 | R74 |
| A8-4 | R75 |
| A8-5 | cosmetic, in A9 |
| §11.1 / Q3 (R70 and the base) | Q3 ruling + R74 |
| §11.2 (parent replaced by a new real directory) | recorded: within R69's letter and D-042's reasoning; not a defect |
| §11.3 (GAP-OBJECT-MOVED) | recorded as R37's named limit, as rulings-15 said |
| §11.4 / R65-FACTS obsolete | accepted; R68-STABLE-UNREAD is its replacement (A8-1's known positive) |
| Q1 (does R68 cover unreadable?) | yes; R72 states it by protection |
| Q2 (literal "in its stage record"?) | yes; R73 |
| Q5, Q6 | above |
| CA-12 (8.3 path) | R76 |

## A9

- **A9 is a new commit series on A8 `9e2dd5d`,** with R76's merge first, then R72 to R75.
- **It goes to Grok 4.7 in Cursor (T-177), a fresh session, developer record 103.** The brief is
  `docs/loops/loop-15-slice-3-a9-grok-brief.md`.
- **Not before A2A-Hub's T-003 cutover window closes:** Grok's hub client changes in that window.
- **QA is record 104, headless on the QA PC,** as QA 99 was.
