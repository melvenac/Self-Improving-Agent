# Candidate B, part 2 (`E_t`'s schema change, R10): dispatch to a FRESH, HEADLESS QA seat to WRITE its criteria (record session 132)

**By:** Atlas (planner), record session 109 · 2026-09-26 (UTC). **Where QA 132 runs:** the QA PC, launched by
`docs/loops/qa-queue.ps1`, which runs `docs/loops/qa-132/drive.ps1`. **Nobody is watching live, and you cannot reach
the planner.** Questions go in "Open for the planner".
**Not available here:** `/start`, the open-brain MCP server, `gitnexus`. **Temp and scratch (T-190):** `C:\qa-tmp` and
`C:\qa-scratch`. **Commit your report from a separate worktree under `C:\qa-scratch`.** One QA seat at a time on a
machine.

## What this is

**Not a scoring run: you WRITE the criteria** for candidate B's second half, the one B's rulings say must exist and pass
before B is accepted (`docs/loops/loop-15-slice-3-b-criteria-rulings.md` §7.3). B's first half (the G-042 repair) PASSED
QA 129 (`origin/qa/b-step1-report` `f2e1e39`).

**The change:** `E_t` is the loop's evidence artifact (`E_t.json`, validated against
`open-brain/src/harness/schemas/evidence.schema.json`; `harness/artifacts.ts`). **Rulings-2 R10**
(`docs/loops/loop-15-slice-3-rulings-2.md`, lines 53–75) found four mismatches and ruled each for B's design:
- **(a)** the loop id pattern `^t\d{3,}$` admits human-seat ids. The exact form is the developer's.
- **(b)** **no new status value.** Attribution is a field on the acceptance row, `order: shown | attributed`.
- **(c)** **`pending` becomes its own status.** A verdict row with any `pending` item is written as `undefined`,
  never `would-not-merge`.
- **(d)** **out-of-scope ids are declared in the same parseable block as R3's unrunnable ids,** at the criteria SHA,
  before any candidate, and excluded from the verdict. The two lists stay separate.

Read R10 in full, and **R3** in the same file, which it builds on. The stream exists for **T-155** (candidate C, the
shadow merge gate), so criteria that make `E_t` usable by C are in scope, where R10 implies them.

## Read ONLY

- `loop-15-slice-3-rulings-2.md` (R2, R3, R10 and the siblings section);
- `evidence.schema.json`, `plan.schema.json` and `harness/artifacts.ts`, at **`origin/master`** and at **A11's
  `ef2a8a7`** (`origin/loop/15-slice-3-candidate-a11`). **Say whether A11 changes any of them**; B's `E_t` build will
  base on whichever merges first;
- `docs/loops/loop-15-slice-3-b-criteria.md` (QA 123's criteria for B's first half), for form;
- any `E_t.json` that exists in the repository's tests or fixtures, as real examples.

## What the criteria must settle

1. **Each of (a)–(d) as a testable row:** a schema-level row (a valid and an invalid document per rule), and a
   behaviour row where one exists (for example, for (c), a verdict computed from rows with a `pending` item is
   `undefined`). **Red at the base:** name how each row is red today.
2. **Backward compatibility:** do existing `E_t.json` files, and the fixtures and tests that write them, still
   validate? If not, is a migration needed, or is the old form rejected? Say which, and why.
3. **Who writes `E_t`:** R10 says "until then the QA seat writes prose". Must B's candidate include a writer, or only
   the schema and validator? Settle it from R2 and R10's text.
4. **What cannot be tested** before C exists, and how the criteria say so.

**No laptop runs** (nothing here is load-sensitive). tcm at most **3**, only if you need to show a row red.

## Authority

- **Push only `qa/b-et-criteria-*`, through `node docs/loops/qa-132/push-qa.mjs <branch>`.** Never master, merges, PRs,
  or other seats' branches.

## The report

- **Path:** `docs/loops/loop-15-slice-3-b-et-criteria.md`. Give the criteria first, numbered BE-1 onward, each with
  its pass condition and how it is red at the base. Then your reasoning per question, what could not be verified,
  your error entries, and "Open for the planner".
- Commit it to `qa/b-et-criteria-report`. **The LAST line is exactly `QA-132: REPORT COMPLETE`.** No `/end`.
