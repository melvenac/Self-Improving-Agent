# QA 236: T-216, one loop-id rule for plan and evidence

**By:** Atlas (planner), 2026-10-01, record session 153. **Candidate:** `9a0973f0d330b3b85a4ce5e23f8a0ef583de2070` on
`origin/loop/t216-plan-loop-id`; the product is `ef7a1ce7`, and the tip only fills the handoff.
**Base for red:** `c204d1d4` (master when T-216 branched). **Builder:** Claude Code Sonnet (sia-builder).
**QA runs on Opus** (D-068).

## What to read

1. `docs/loops/t216-dispatch.md`: the scope. **This is what you score.**
2. `docs/loops/t216-developer-handoff.md` at the candidate: its rows and red-then-green claims. **Verify them.**
3. `docs/loops/loop-15-slice-4-brief.D_t.json` on master: the real file the fix exists for. It must stay unedited.

## Rows to score

- **T216-1, the real file:** `harness validate plan docs/loops/loop-15-slice-4-brief.D_t.json` exits 1 at the base with
  "loop must look like t001" and exits 0 at the candidate. The file is byte-identical at both SHAs.
- **T216-2, one rule:** plan and evidence accept the same loop-id set, from ONE exported constant.
  - Probe both schemas with seat ids (`15-slice-4`, `15-slice-3-c`), runtime ids (`t001`, `t1234`) and refusals
    (empty, a slash, `../x`, `15`, `T001`, `15-`, a leading space).
  - **The two schemas must agree on every probe.**
  - Builder flagged that its L3 test (the shared constant) stays green under its own mutant, so it guards only the JSON
    pattern. **Build a mutant that gives the plan schema its own copy of the regex and widens or narrows only that
    copy. Say whether any test kills it.**
- **T216-3, the derived JSON schema:** `plan.schema.json` was HAND-EDITED, not regenerated. Regenerate it from the
  zod source with the project's own generator, if one exists, and diff the result against the committed file. Any
  drift between the zod rule and the JSON pattern is a defect.
- **T216-4, the other tNNN assumptions:**
  - Builder kept `DeveloperReportSchema` and `--loop` as tNNN on purpose, and found no loop id in `GATE_RECORD_RE`.
  - Grep `open-brain/src` for `t\d{3` and `t001` yourself, and judge each kept tNNN. A runtime-only concept may stay
    tNNN; anything a planner brief reaches must accept seat ids.
- **T216-5, the dry-run plan gate:** `harness plan-gate --mode dry-run` on a TEMP COPY of the slice-four `D_t`
  reaches the gate with no loop-id refusal, makes NO network call, and writes its `G_plan` record. Assert there were
  no network calls (an unset key is not proof, per G-044).
- **Regression:** the b2-et BE-0.1 rows Builder inverted. Confirm the inversion follows the new rule and does not
  weaken an evidence guarantee B relied on.

## Rules (headless Claude Code on the laptop, D-068)

- You are **QA 236**. Your prefix is `t216`. Push ONLY `qa/t216-*` branches, and only through
  `node docs/loops/qa-236/push-qa.mjs <branch>`.
- **CI (D-061, T-207):** push `qa/t216-ci-candidate` at the candidate and `qa/t216-ci-base` at `c204d1d4`. Quote each
  run's id, headSha, run conclusion and `test` job conclusion, polling in the FOREGROUND with
  `gh run watch <id> --exit-status`. Use at most 4 tcm runs, never `windows=true`. Keep mutants LOCAL, with diffs under
  `docs/loops/qa-236/`.
- Commit `docs/loops/t216-qa-report.md` with its `.E_t.json` on `qa/t216-report`. The last line is exactly
  `QA-236: REPORT COMPLETE`.
- Make no live Jev call of any kind.
- If you are blocked, write it in "Open for the planner" and finish the report.
