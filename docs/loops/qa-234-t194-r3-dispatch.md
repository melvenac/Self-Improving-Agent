# QA 234: T-194 r3 (the planner seat hook), after QA 233's REJECT

**By:** Atlas (planner), 2026-09-30, record session 153. **Candidate:** `c1f1cb483c1afcb1a3cb3f28207e2a75153b1c97` on
`origin/loop/t194-planner-hook`. The tip `c1f1cb48` adds the developer handoff and mutant diffs; read the handoff
for which commit carries the code. **Base for red:** `699789e1` (r1 + r2, which QA 233 rejected).
**Builder:** Claude Code **Sonnet**, as a headless dev job on the QA PC. **QA runs on Opus** (D-068), so the builder
and the judge are different models.

## What to read

1. `docs/loops/t194-r3-dispatch.md`: the planner's r3 scope, rows 1 to 6. **This is what you score.**
2. `docs/loops/t194-r2-qa-report.md` and `docs/loops/qa-233/evidence/` on `origin/qa/t194-r2-report`: QA 233's
   defects D1 and D2, and probes P1 to P15. Re-run P3, P4 and P6 to P15 against the candidate.
3. `docs/loops/t194-r3-developer-handoff.md` at the candidate: its row-to-test map and red-then-green claims.
   **Verify them; do not trust them.**
4. `docs/loops/qa-231-t194-r2-dispatch.md` and `docs/loops/qa-222-225-common.md`: the PH-1..PH-8 and r2-1..r2-4 rows
   still hold. r3 must not regress any row QA 233 scored `met`.

## Rows to score

- **r3-1, D1:** absolute paths, in both slash forms, are denied for PH-1, PH-2 and PH-6. A path outside the repo, or
  one that cannot be made relative, is denied with a named cause. Test through the real CLI with fixture input, and
  use a cwd that is not the repo root as well as one that is.
- **r3-2, D2:** a compound command after a docs-only `gh pr merge` is not allowed without a grant: P3, P4, and
  variants with `||`, `;`, `|`, a newline, `$(…)` and backticks. A single docs-only merge is still allowed with no
  grant (r2-1 must not regress).
- **r3-3:** the grant matches a single invocation only. A grant for `gh pr merge 5` does not cover
  `gh pr merge 5 && git push --force origin master`.
- **r3-4, `--repo`:** `--repo`, `--repo=` and `-R` are denied with a named cause, and nothing is fetched. Assert
  that no fetch happens.
- **r3-5, D-066:** `.agents/assignments.json` is allowed in a docs-only merge (QA 233's P6).
- **r3-6, mutants:** r1's ph1 to ph3 are replaced by forms that typecheck and are red. The D1 and D2 mutants are red.
  Add at least one mutant of your own per row r3-1 to r3-4.
- **Regression:** every PH and r2 row QA 233 scored `met` is still met.

## Rules (headless Claude Code on the laptop, D-068)

- You are **QA 234**. Your prefix is `t194-r3`. Push ONLY `qa/t194-r3-*` branches, and only through
  `node docs/loops/qa-234/push-qa.mjs <branch>` run from your working copy.
- **CI (D-061, T-207):** push `qa/t194-r3-ci-candidate` at the candidate and `qa/t194-r3-ci-base` at `699789e1`, and
  quote each run's id, headSha, run conclusion and `test` job conclusion. Poll in the FOREGROUND with
  `gh run watch <id> --exit-status`. **Mutants stay LOCAL**; commit their diffs under `docs/loops/qa-234/`. Keep to at
  most 4 tcm runs, and never use `windows=true`.
- The base-shared `state-schema` T-171 r3b failure is fixed on master (`9b3a4a2c`). If the candidate branch lacks that
  fix and the test fails at both SHAs identically, report it as base-shared, not new.
- Commit the report as `docs/loops/t194-r3-qa-report.md` with its `.E_t.json`, on `qa/t194-r3-report`. The report's
  last line is exactly `QA-234: REPORT COMPLETE`.
- If a model refusal, usage limit or permission denial stops you, write it into "Open for the planner" and finish the
  report. Do not retry in a loop.
