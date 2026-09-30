# QA 233: record 214 r2 (T-194, the planner seat hook), re-dispatched on Composer

**By:** Atlas (planner), 2026-09-30, record session 150. **This replaces QA 231,** which wrote no report. Every one of
its attempts ended with Cursor's "You've hit your usage limit" on GPT, and the model resets on 2026-10-03. The queue
log still read `exit.231=0 done_marker.231=True`, while the driver recorded `complete=False`. This run uses
**Composer 2.5**, which built none of T-194 (r1 Grok, r2 the builder in Claude Code).

**Follow `docs/loops/qa-231-t194-r2-dispatch.md` in full**, including `docs/loops/qa-222-225-common.md`, with only
these changes:

- You are **QA 233**. The report's last line is exactly **`QA-233: REPORT COMPLETE`**.
- Push only through **`node docs/loops/qa-233/push-qa.mjs`**. The prefix is unchanged, `t194-r2`, and so are the
  report path and branch.
- QA 231 already pushed `qa/t194-r2-ci-candidate` (`699789e1`) and `qa/t194-r2-ci-base` (`c933a44`), and their tcm runs
  were queued. **Read those runs' conclusions** (`gh run list --branch qa/t194-r2-ci-candidate`) instead of pushing
  again. If they were cancelled or never ran, push again and quote the new run ids.
- Run your own mutants **locally**, and push them to `qa/t194-r2-mut-*` only as the record (T-207).
- **Add one row, from D-066 (Aaron, 2026-09-30):** `.agents/assignments.json` is on the docs-only allowlist. Say whether
  the candidate's allowlist includes it. It predates D-066, so a miss is expected: report it for the planner, and
  don't score it as a defect.
- **If a model refusal or usage limit stops you**, write it into the report's "Open for the planner" section and
  finish the report. Do not retry in a loop.
