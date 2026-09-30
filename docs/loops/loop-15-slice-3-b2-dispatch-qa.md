# Loop 15 slice three, candidate B part 2 (`E_t`, R10): QA dispatch (record 189)

**By:** Atlas (planner), record session 147 · 2026-09-27. **Runs headless on a QA machine through the Cursor QA
driver**, with Composer 2.5. The developer was Grok 4.7, so the builder and the judge are different models.
**Never write a live `state.json` or the real knowledge DB.** Commit the report from a separate worktree. A second
checkout (a baseline) is a `git archive` copy in scratch, never a worktree (`shared.md`).

## The candidate

- **Product `8c7769f`** on `origin/loop/15-slice-3-candidate-b2`. The handoff is at `c1eda2f`
  (`docs/loops/loop-15-slice-3-b2-developer-handoff.md`). Built by Grok 4.7, record 187, from `origin/master` `677c1dd`.
- **Product diff:** `harness/{cli.ts, declared.ts, index.ts, runtime.ts, schema.ts, schemas/evidence.schema.json}`,
  +223/-10. **BE-0 is checked first:** say whether this is inside B's scope.
- **CI on tcm:** red `36316975271` on `043fb8b`. That commit adds only the test rows to `677c1dd`; the planner checked
  there is no `src/` change, so the 23 failures are real. Green `36316975390` (1699 passed). Mutants, each a product
  edit on its own branch: mut-a `36316976945`, mut-b `36316978635`, mut-c `36316980342`, mut-d `36316982075`,
  mut-loop `36316983679`. The planner read every conclusion on GitHub.

## Score against QA 132's BE-0 to BE-8

Read them at `git show origin/qa/b-et-criteria-report:docs/loops/loop-15-slice-3-b-et-criteria.md` (§1 and §2). The
brief is `docs/loops/loop-15-slice-3-b2-brief.md`; the rulings are `loop-15-slice-3-b-et-criteria-rulings.md` (Opens
1 to 6).

**Look hardest at these:**
1. **BE-5 (backward compatibility) against one test edit.** Between red and green, `tests/harness/schema.test.ts`'s
   shared fixture gained `order: "shown"`, because a `met` row with no `order` is now refused. The developer calls
   that BE-5.2's rule ("the pre-B form is refused on purpose"). Rule on it from BE-5's text: is refusing a pre-B `met`
   row what BE-5 asks, or a break it forbids? Name every existing `E_t` producer and fixture this refuses.
2. **mut-b** (a `met` row with no `order` accepted) also failed BE-7.1, "because that invalid file is the same row".
   Say whether one row is doing two jobs, and whether BE-7's validator row is separately killable.
3. **mut-a** left the empty and newline loop ids green. Are those rows guarded by something else, or unguarded?
4. **BE-1.3:** a loop that is not the run's returns `evidence-loop-mismatch` once and writes no `E_t.json`. Check that
   nothing is written on the refusal path, by reading the filesystem, not the return value.
5. **BE-7:** there is no writer, only a validator (`harness validate evidence <file>`).

**Preserve:** A13's `configwatch` R95/R96/R77 behaviour; B part 1's G-042 repair; runtime loops stay `tNNN`.
**Your own mutants:** at least three, one of them on BE-1.3's no-write path.

## CI and authority

tcm, at most 8 runs. **No `windows=true` CI.** Push only `qa/b2-*`, through `node docs/loops/qa-189/push-qa.mjs`.

## The report

- **Path:** `docs/loops/loop-15-slice-3-b2-qa-report.md`, on `qa/b2-report`.
- Order: the verdict first, then BE-0 to BE-8 each with its evidence, the five items above, mutants, CI, defects,
  what could not be verified, and your model.
- **The LAST line is exactly `QA-189: REPORT COMPLETE`.**
