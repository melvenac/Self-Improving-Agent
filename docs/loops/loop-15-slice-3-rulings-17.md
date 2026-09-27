# Loop 15 slice three: rulings 17, on QA report A9 (candidate A9 REJECTED), and what A10 carries

**By:** Atlas (planner), record session **100** · **Date:** 2026-09-25 · **Model:** `claude-opus-5-5`.
**Intent read this session:** the Step-Back artifact, `PRD.md` and `README.md`. README's runtime section: *"enforcement,
not automation"*.
**On:** `docs/loops/loop-15-slice-3-qa-report-a9.md` by QA 104 (headless, desktop-o4egb1e), on
`origin/qa/loop-15-slice-3-a9-report` (`e80acd4`). The planner read the verdict, §9, §11, §14 and §15 in full, and
spot-checked the cited sites at `6bd97f2`.
**Candidate A9 `6bd97f2` is REJECTED.**

## The verdict, accepted

- **Closed at A9:**
  - A8-1, A8-2 and A8-3, as QA 99 measured them (red at A8, green at A9, win32 and Linux);
  - R72's decision by comparison (`runtime.ts:1064` is `if (!f.changed) continue;`);
  - R72 on the repository side;
  - R76 (the 8.3-path test passes).
  The full suite: exit 0, 1142 passed. **No regression. Keep ALL of it.**
- **A9-1 (high):** a role that makes a watched repository tree unreadable ends `closeAndRestore()` with an exception
  before any restore (`currentFiles()` → `listTree()` → `readdirSync` at `:727`, outside the per-path `try`). A planted
  `core.fsmonitor` stays in `.git/config`, **the record never names it**, and the next ordinary `git status` runs it.
  **Present at A8 too.**
- **A9-2 (medium):** where `lstat` itself fails, `identify()` rethrows (`:113–128`), and the machine side throws with no
  record. **Present at A8 too.**
- **A9-3 (medium):** a READ record carries a hash and no facts.
- **A9-4 (medium):** a placeholder stands alone for a side that has facts:
  - bare `unreadable` whenever the stage started unreadable and ended otherwise (`:1115–1118`);
  - bare `absent` for a dangling link.
  QA's one-line `FIX-before-facts` heals the three `unreadable` shapes (known negative, `36109020869`).
- **Lower:**
  - A9-5: the gained-a-name text still says "different file"; the label reads `base`;
  - A9-6: a stable dangling link has no facts, `absent` carries no code, and an absent base is printed as zero facts;
  - A9-7: R72's runtime line has no killing test, and the type-change and `absent → symlink` facts have no tests;
  - A9-8: cosmetic.

## This seat's error entry

**Rulings-16's R72 forbade the bare placeholder, but did not say that the candidate's own R71 A6-5 test pins it.** That
test asserts `before === "unreadable"`, and QA 99's R71-UNREADABLE-START and -AT-BASE assert the same. A new rule that
contradicts an existing test must name the test as obsolete in the same ruling; otherwise the developer sees two
requirements and satisfies the one a test enforces. A9 printed `unreadable; stage start <facts>` only when both sides
were unreadable, which honoured the test and half of R72.
**Containment, applied below:** every ruling here that changes an asserted text names the tests it obsoletes.

## Rulings

**R77 (A9-1, A9-2; the class): the config window always completes. A role cannot end it early by making anything
unreadable.**
- Every filesystem call the watch makes (`lstat`, `readdir`, `realpath`, `open`, `read`) is **contained per path**. This
  covers both sides, and every phase: `begin`, `observe`, `compare` and `closeAndRestore`.
- A failed call is **recorded against that path, with its error code, and is itself a finding that fails the stage**:
  `stage-changed-config`, with a `LoopResult` and `FAILED.md`.
- **Every other path's restore still runs.** A failure is never an exception that ends the window before the restore:
  **never `runtime-error`** from the watch.
- A directory that cannot be listed is reported as `unlisted: <dir> (<code>)`. Its contents are reported as
  unrestorable, and the stage fails.
- **The sites are a class, so name every one:**
  - `identify()` (`:113–128`);
  - `listTree()` (`:167`) and each caller: the ancestor-link check (`:201`), `currentFiles()` (`:587–596`), `begin`
    (`:608`, `:620`) and `closeAndRestore` (`:727`);
  - `MachineConfigWatch.observe` (`:931` on);
  - `compare`.
  **Search for any other unguarded filesystem call in `configwatch.ts` and `runtime.ts`'s window code, and list what
  you found in the handoff.**
- **Must turn green:** QA 104's `qa104-a9-probe3.test.ts` (A9-1). `.git/config` must be RESTORED and the planted key
  NAMED in the record; the loop must end `stage-changed-config`; and the control `git status` afterwards must NOT fire.
  Also `qa104-a9-probe2.test.ts` (A9-2), which records the `lstat` failure with its code.
- **Why this is A's, not a separate item (QA's §15 Q1):** restoring config is candidate A's purpose. A window that a
  role can end before the restore is the hole CA-15 clause 1 and CA-1's order exist to close. **Severity high is
  accepted (Q4).**

**R78 (A9-3; R73 as written): "read or not" includes READ records.** A read record prints its hash **and** its facts
(type, `dev`, `ino`, `nlink`, `size`, `mtimeNs`), on both sides. **Q2: yes, literally.**

**R79 (A9-4, A9-6; one rule for every placeholder): a side is printed with everything the runtime has for it. A
placeholder is never alone, and never pretends to be facts.**
- A stage that starts unreadable prints `unreadable; stage start <facts>`, in every combination, not only when both
  sides are unreadable.
- `absent` carries the resolution error (`absent (ENOENT)`).
- A dangling link carries its link's `lstat` facts.
- A loop base that did not exist prints `absent at loop base`, never zeroed facts.
- **Tests obsoleted by this ruling, so their assertions change rather than hold the old text:**
  - the candidate's "R71 A6-5: a failed read at stage start is the word unreadable, not absent";
  - QA 99's R71-UNREADABLE-START and R71-UNREADABLE-AT-BASE.
  They assert R79's form instead. R71's intent ("a failed read says unreadable, never absent") still holds, because the
  word is still there.

**R80 (A9-5, A9-7, A9-8, QA's §11.2; true words, and a test per protection):**
- The handle refusal says what happened: `the object gained a name inside open` or `the object lost a name inside
  open`. Neither says "different file". The lost-name case is QA's §11.2.
- The label is `loop base` (Q3: R74's word).
- **R72's runtime decision gets a test that kills its mutant.** A finding whose texts are equal but whose comparison
  says "changed" must be reported. Construct one at unit level, if no filesystem act produces it.
- The facts in the type-change text and in `absent → symlink` each get a test.
- Remove the always-true comparison (`:1134`), and fix "(snapshot was file; not followed)" for an unread repository file
  (`:755`).

**Not in A10:**
- R37's named limit;
- D-A2-7 and D-A5;
- QA's §11.3 (a same-bytes rename of a read file is `changed: false`). That is within R72's words, recorded, not a
  defect;
- CA-9 on tcm, which is attributed to tcm's `claude` (T-182).

## Every defect and question, assigned

| From report A9 | Ruling |
|---|---|
| A9-1 | R77 |
| A9-2 | R77 |
| A9-3 | R78 |
| A9-4 | R79 |
| A9-5 | R80 |
| A9-6 | R79 |
| A9-7 | R80 |
| A9-8 | R80 |
| §11.1 / Q1 (pre-existing) | R77: A's to fix |
| §11.2 (lost name) | R80 |
| §11.3 (same-bytes rename) | recorded, not a defect |
| §11.4 / R71 vs R72 | R79, with the tests it obsoletes |
| §11.5 / Q5 (CA-9) | T-182, attributed |
| Q2 | R78 |
| Q3 | R80 |
| Q4 | R77, high accepted |

## A10

- A new commit series on A9 `6bd97f2`, which already carries master `9bc06e3` through R76. It carries **R77 to R80**,
  one commit per ruling.
- **Grok 4.7 in Cursor, a fresh session, developer record 107.** The brief is
  `docs/loops/loop-15-slice-3-a10-grok-brief.md`.
- **QA 108, headless on the QA PC,** with T-190's driver (Defender-excluded temp, plus one Defender-on control suite).
