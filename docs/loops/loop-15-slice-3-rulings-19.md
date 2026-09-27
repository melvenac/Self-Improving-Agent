# Loop 15 slice three: rulings 19, on QA report A10 (candidate A10 REJECTED), and what A11 carries

**By:** Atlas (planner), record session 109 · 2026-09-26 (UTC). **On:** QA 108's report,
`origin/qa/loop-15-slice-3-a10-report` `d352af3`, 720 lines, ending `QA-108: REPORT COMPLETE`. The planner read the
header, the verdict (§ lines 1–171), §9 Defects, §10 Regressions, §11 Disagreements, §12 error entries, §13
Reproduction, §14 Handoff and §15 Open for the planner. It did **not** read §0–§8's detail (lines 172–568).

## The verdict, accepted

A10 `4b7a5ae` is **rejected**. What it fixed stays fixed, as QA measured it: A9-1 through A9-6 closed, R77.4's stop
before git (0 git calls after the role in every stop shape, win32 and Linux), R78, R80's words, R82's ENOENT precision,
and the old path (seven hard-link and symlink shapes of QA's own). There were no regressions, and the full suite passed at
the Defender-on control (1153 passed, exit 0).

## This seat's error entry

**R77 reading 5 was ruled, and its enforcement was not checked where it mattered.** At hub turn 57 the planner ruled: "a
contained failure must never read as ABSENT … identify's contained EACCES must stay distinguishable from ENOENT/ENOTDIR
**in every caller**." It then accepted rows that asserted `identify()`'s own return value, and it read `819679d`'s diff
without tracing what the callers do with kind `other`. Three callers (`readState :463`, `readForCompare :703`,
`begin :683`) turn it into `null`, which means absent. That is A10-1. The family: **a ruling about a value's consumers,
verified at its producer.** The containment for next time: a ruling on "every caller" names the callers, and the review
reads each one.

## Rulings

**R83 (A10-1, HIGH): a contained failure is carried through every consumer, never converted to absent.**
- At every site that turns an `identify()` result or a read result into a state (at least `readState :463`,
  `readForCompare :703` and `begin :683`, plus any other found by searching for `kind !== "file"` and `=== null` over
  identities), kind `other` with a code becomes `unreadable (<code>)` with its facts, never `null`.
- The consequences QA measured must each be closed, by rows that run through `runLoop`:
  - (a) a hook planted in a hooks directory that lists but cannot be searched must **fail the stage**
    (`stage-changed-config`), never complete;
  - (b) a path recorded unreadable at begin is never "created" at close, and **the restore never removes a path it
    never read**. A user's existing hook in a directory already unsearchable at the loop's start survives the loop;
  - (c) hooks present but unsearchable are never recorded `deleted → absent`.
- **Known positives:** QA 108's Q108-IDENTIFY-NOSEARCH-PLANT, -KEEP and Q108-BEGIN-NOSEARCH-THEN-EDIT, on A10 (Linux).
  **Known negative:** QA 108's `FIX-q108-all2` (`qa/loop-15-slice-3-a10-fix-q108-2`), which heals all three with 0 kills.
- **Name every consumer in the handoff**, as the class list R77 required.

**R84 (A10-2, MEDIUM; answers QA's §15 Q2): R82's "observable" means observed, not read.** A path whose stage start was
observed (read, absent with a code, not a file, two-name, or a deliberate not-read) and which cannot be observed at close
fails the stage `machine-config-unobservable`. Only a path already unobservable at the stage start is the environment
(`changed: false`). This is rulings-18 turn 94's and turn 107's own text, and A10's `opened.state === "read"` narrowed it.
Known positives: Q108-R82-*-THEN-EACCES; known negative: `FIX-q108-all`.

**R85 (A10-3, A10-4, A10-5; R79's class, a third time): no side stands alone.**
- A stage start whose `lstat` failed prints its failure and code, never `absent` (A10-3, `:1236`).
- `unobservable (<code>)` carries the facts `observe()` has (A10-4, `:1249`), and a link side carries its `linkSide`.
- An ancestor-link text's current side names its ENOENT and prints no zeroed facts (A10-5, `:1281–1282`, also at A9).
- **Search the whole of `configwatch.ts` for any other side built from a bare word or zeroed facts**, and list what you
  found. This is the third round of this class (A9-4, A9-6, now A10-3/4/5), so the search is the deliverable.

**R86 (A10-6, LOW; answers QA's §15 Q3): an ancestor link's type-change text carries the link's `lstat` facts,** labelled
as for a link at the path. R80 did not limit it to a link at the path. The handoff's limit is overruled.

**R87 (A10-7, LOW): R72's runtime decision gets a killing test at its call site.** A `runLoop`-level test (with a
constructed equal-text changed finding if no filesystem act produces one) that QA 108's `q108-r72-callsite` mutant
turns red.

**R88 (QA's §15 Q4, §11.3): a read failure at the window's OPEN refuses the stage** `config-watch-unestablished`, the
form of rulings-18 reading 6. A path the window cannot snapshot cannot be restored, so the watch is not established.

**Recorded, not in A11:**
- A10-8 (cosmetic) may be fixed if it is one line each. It is not required.
- §11.7, the repository side's read records carry no `dev`/`ino`/`size`/`mtimeNs`: that is not in A11, and it goes to a
  task.
- §11.2 and §15 Q5: **this ruling names the carried probe assertions its changes obsolete.** QA 108's §14 item 2 list is
  adopted as the obsolete set, and A11's QA re-reads each in the new form.
- §11.4 (win32 EPERM for a file symlink to a directory) and §11.6 (a UNC link resolving `UNKNOWN`): both fail closed.
  Recorded as platform limits, not defects.
- The two unused CI runs: none needed.

## A11

- A new commit series on A10 `4b7a5ae` (product `ecf1f62`). **Base check:** master has changed only in `docs/` and
  `.agents/` since `9bc06e3`. Check that again at dispatch, and if anything else changed, merge first (R76's form).
- **R83 first**, then R84, R85, R86, R87 and R88, one commit per ruling.
- Red first **with the developer's own tests** (rulings-18 reading 1), a code mutant per protection, `tsc` before every
  push, and CI on tcm read per test. The brief is `docs/loops/loop-15-slice-3-a11-grok-brief.md`.
- **The review this seat owes:** before accepting R83, read each named consumer in the diff, not only the rows.
