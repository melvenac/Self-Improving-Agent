# QA 222-225: what every one of these four runs does

**By:** Atlas (planner), 2026-09-29, record session 149. **They run headless on the QA PC (DESKTOP-O4EGB1E) through
the Cursor QA driver, with GPT (`gpt-5.6-sol-medium`).** GPT built none of these candidates: Grok built 215 and 217,
and Composer built 219 and 220.
- **Never write a live `state.json` or the real knowledge DB.**
- Commit the report from a separate worktree under `C:\qa-scratch`.
- Keep scratch in `C:\qa-scratch` and temporary files in `C:\qa-tmp` (T-190).

## Rows

- **Score every acceptance row** in the candidate's brief as `met`, `unmet`, `partial` or `not_evaluated`, each with
  the test or command that shows it.
- **Live rows** that need an interactive Cursor or Claude session are `not_evaluated`, and you say so. They are:
  - HB-1, HB-2 and HB-3, and CS-4, in QA 224;
  - PH-8's live half.

  **Do not imitate them.**

## Full suite, candidate against base, on tcm (D-061: QA runs the CI)

- Push the candidate code SHA to `qa/<prefix>-ci-candidate`, and the base SHA to `qa/<prefix>-ci-base`. A push to a
  `qa/*` branch now starts CI by itself (T-178).
- **Quote each run's id, its headSha, the run conclusion and the `test` JOB's conclusion.** A skipped `test` is not a
  green one.
- Say whether any failure is new.
- **Known on Windows desktops, not on tcm:** `tests/harness/qa104-a9-probe2.test.ts` R72-BEFORE-ABSENT-DANGLING fails
  with EPERM where the user cannot create symlinks. It fails at the base too. If you run the suite locally, say
  whether you see it, and **do not count it against the candidate unless it passes at the base on the same machine.**
- **No `windows=true`.** At most 6 runs per QA.

## Mutants

- Re-apply each of the developer's mutants to the **candidate code SHA**, not to the SHA its branch sits on, then
  typecheck it (`tsc --noEmit`) and run it.
- A mutant that does not typecheck is invalid. Say so.
- Add at least one mutant of your own, on `qa/<prefix>-mut-*`.

## Evidence file

Beside the report, write `<report>.E_t.json`:
- follow `EvidenceSchema` (`open-brain/src/harness/schema.ts`), with one `acceptance[]` row per brief row;
- set `order` on every `met` row;
- set `runtime_checks` from your CI runs;
- set `candidate_git.sha` to the full 40-character code SHA.

From `open-brain/`, run `node build/harness/cli.js validate evidence <file>` against the candidate's build, and quote
the exit code. **A report without a valid evidence file is incomplete.**

## The report

- The verdict comes first, then each row, the mutants, the CI, the defects, and your model.
- Push only your own `qa/<prefix>-*` branches, through `node docs/loops/qa-<N>/push-qa.mjs`.
- **The LAST line is exactly `QA-<N>: REPORT COMPLETE`.**
