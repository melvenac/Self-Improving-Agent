# T-217 + T-218: two test guards QA found missing (dispatch to sia-builder)

**By:** Atlas (planner), record session 155, 2026-10-02. **Small. Test-side only. No `src` change.**

## T-217 (QA 236 D1): the plan's loop regex must BE the shared constant

- Mutant M7 (`docs/loops/qa-236/mutants/M7-widen-i-flag-regen.diff` on `origin/qa/t216-report`) gives
  `PlanSchema.loop` its own copy of `LOOP_ID_PATTERN` with the `/i` flag. It survives every test, because zod's JSON
  emission drops flags.
- **Add:** a test asserting that `PlanSchema.shape.loop`'s regex **is** `LOOP_ID_PATTERN`, by identity. Also add
  `T001` and `15-Slice-4` to the plan's refusal rows.
- **Show:** M7 and M6 (`M6-identical-literal-copy-regen.diff`) go red.

## T-218 (QA 239 G1): leading whitespace in a declared block is refused, and a test says so

- QA 239's mutant q5 (`docs/loops/qa-239/mutants/` on `origin/qa/t214-report`) strips leading spaces and tabs before
  matching. It survives `t214-declared-blank.test.ts`.
- **Add:** rows in which ` [unrunnable]` and `  A-1: x` are refused, under both fence kinds.
- **Show:** q5 goes red.

## Rules

- Branch `loop/t217-t218-guards` from `origin/master`. Red first, then green. Run the two touched test files only,
  plus the mutants.
- No CI.
- Handoff: `docs/loops/t217-t218-developer-handoff.md`.
- Push, never forced. Report the SHA to `atlas [f21cf4]`.
