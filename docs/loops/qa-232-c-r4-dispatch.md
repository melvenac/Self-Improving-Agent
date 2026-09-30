# QA 232: candidate C r4 (T-155), re-dispatched on Composer

**By:** Atlas (planner), 2026-09-30, record session 150. **This replaces QA 229, which never launched.** QA 229 was
set up for GPT (`gpt-5.6-sol-medium`), and Cursor now refuses that model on this account until 2026-10-03: "You've
hit your usage limit". QA 231 failed on exactly that refusal, on its first run and all three resumes. This run uses
**Composer 2.5**, which built none of C (r1 to r3 Grok, r4 Forge in Claude Code).

**Follow `docs/loops/qa-229-c-r4-dispatch.md` in full**, including `docs/loops/qa-222-225-common.md`, with only these
changes:

- You are **QA 232**. The report's last line is exactly **`QA-232: REPORT COMPLETE`**.
- Push only through **`node docs/loops/qa-232/push-qa.mjs`**. The prefix is unchanged, `c-r4`, and so are the report
  path and branch.
- Run your own mutants **locally**. Push them to `qa/c-r4-mut-*` as the record, but do not wait on or count CI for
  them: T-207 will stop CI on mutant refs. **CI is for the candidate and the base only.**
- **If a model refusal or usage limit stops you**, write it into the report's "Open for the planner" section and
  finish the report. Do not retry in a loop.
