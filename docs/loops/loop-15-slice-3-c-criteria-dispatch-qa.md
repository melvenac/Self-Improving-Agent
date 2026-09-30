# Candidate C (T-155, the shadow merge gate): dispatch to a FRESH, HEADLESS QA seat to WRITE its criteria (record 191)

**By:** Atlas (planner), record session 147 · 2026-09-27 (UTC). **Where QA 191 runs:** the QA PC, through the Cursor
QA driver (`docs/loops/qa-191/drive.ps1`), with Composer 2.5. **Nobody is watching live, and you cannot reach the
planner.** Questions go in "Open for the planner". **Temp and scratch (T-190):** `C:\qa-tmp` and `C:\qa-scratch`.
**Commit your report from a separate `git worktree` or `git archive` copy under `C:\qa-scratch`, never by checking
branches out in this QA tree.**

## What this is

**Not a scoring run: you WRITE the acceptance criteria** for candidate C, the last of Loop 15 slice three's three
candidates. **A is merged** (`677c1dd`), and **B is merged** (#187; B part 2's `E_t` schema at `8c7769f`, ACCEPTED by
QA 189). QA 132 wrote B's criteria this way before B was built; your criteria get the same treatment.

**C, from T-155's record note (`.agents/state.json`, `tasks[]` id `T-155`):**
- At every point where a merge to master could occur, the runtime writes a **would-merge / would-not-merge verdict
  with its reasons** (deterministic check results, QA's `E_t` status, and the gates' typed answers once they exist)
  into `artifacts/iterations/tNNN/`.
- **Aaron still merges.** The runtime then records his actual decision beside its own, and the **count of
  disagreements** is the instrument that decides when the human gate is removed.
- **The verdict is written BEFORE Aaron decides,** so it cannot be fitted to his answer. Both verdicts carry the
  candidate SHA and a timestamp.
- **A run where the runtime could not form a verdict** (gate unreachable, evidence missing) is recorded as
  **UNDEFINED, never as agreement.**
- Zero disagreements across loops with no real defects in the stream is not evidence of anything. The count only means
  something when the loops contained failures a gate could have caught.

## Carried to you from B (rule on each, or say why you cannot)

1. **Does an attributed `met` count as `met` in C's verdict?** B's criteria rulings (Open 3) sent this question to C's
   criteria, unruled: `order: attributed` means satisfaction was established by attribution, not shown.
2. **R10(c) as implemented:** a verdict row with any `pending` acceptance item is `undefined`, never `would-not-merge`.
   B's schema carries `pending`; C computes the verdict. Your rows must test that.
3. **R10(d):** out-of-scope ids and R3's unrunnable ids are declared in two separate lists
   (`harness/declared.ts`, `parseDeclared`) and **excluded from the verdict**. Test that each list is excluded, and
   that the two are never merged.
4. **R2's obligation now binds:** QA seats write `E_t` from the first QA report after B's acceptance. C reads it. What
   must an `E_t` carry for C to form a verdict, and what makes it UNDEFINED?

## Read ONLY

- T-155's note, as above; `docs/loops/loop-15-slice-3-brief.md` §3 and §5; `loop-15-slice-3-rulings-2.md` (R2, R3,
  R10); `loop-15-slice-3-b-et-criteria-rulings.md` (Opens 1 to 6);
- at **`origin/master`**: `open-brain/src/harness/` (at least `runtime.ts`, `schema.ts`, `declared.ts`, `cli.ts`,
  `artifacts.ts`, and whatever holds the gates, R3's verdict and the merge point, if any), and
  `schemas/evidence.schema.json`;
- `git show origin/qa/b-et-criteria-report:docs/loops/loop-15-slice-3-b-et-criteria.md`, for form only.
- **Say where the "merge point" is in today's runtime, or that it does not exist yet.** T-155's note says C needs it.
  If it is missing, building it is in C's scope, and the criteria must say what it is.

## What the criteria must settle

1. **The verdict:** its inputs, its three outcomes (would-merge, would-not-merge, UNDEFINED), the rule for each, and
   the artifact it is written to: a testable row for each, **red at `origin/master`**, with how.
2. **Before-the-decision:** how a test shows the verdict was written before Aaron's decision was recorded, and cannot
   be rewritten after it (append-only; SHA and timestamp; refused on overwrite).
3. **Aaron's decision:** how it is captured (the merge commit? a record op?), and how a merge that never happens
   (a PR closed, a candidate replaced) is recorded.
4. **The disagreement count:** what counts (would-merge vs not merged, would-not-merge vs merged), what never counts
   (UNDEFINED), and where the count is read from.
5. **Items 1 to 4 carried from B**, each as a row.
6. **What cannot be tested** before C runs against real merges, and how the criteria say so. Declare, in R3's parseable
   block at your criteria SHA, the unrunnable ids and the out-of-scope ids as two separate lists (R10(d)).

**No laptop runs.** tcm at most **3**, only if you need to show a row red.

## Authority

- **Push only `qa/c-criteria-*`, through `node docs/loops/qa-191/push-qa.mjs <branch>`.** Never master, merges, PRs, or
  other seats' branches. **If a push is refused, write the refusal verbatim in the report and continue;** the planner
  reads the report on this machine.

## The report

- **Path:** `docs/loops/loop-15-slice-3-c-criteria.md`. Give the criteria first, numbered CC-1 onward, each with its
  pass condition and how it is red at the base. Then your reasoning per question, the declared lists, what could not
  be verified, your error entries, and "Open for the planner".
- Commit it to `qa/c-criteria-report`. **The LAST line is exactly `QA-191: REPORT COMPLETE`.** No `/end`.
