# Record 192 r4 (Cursor QA driver: the harness reaches its rows on Git 2.55): QA dispatch (record 210)

**By:** Atlas (planner), 2026-09-28. **Headless, Cursor QA driver, GPT (`gpt-5.6-sol-medium`)**, as for QA 202. Never
touch `%USERPROFILE%\Worktrees\sia-qa` beyond reading it.

## The candidate

`origin/loop/qa-driver-cursor-r2` at `0f816bb`: a harness-only change over `13e183c`. The product is still `d67c5e7`.
**Read QA 202's report first** (`qa/qa-driver-r3-report` `68ac9db`): it confirmed the product and rejected only on
item 4.

## Score

1. **The harness change only:** the fixture gives `HEAD` a real branch, and a native stderr warning in fixture setup is
   not fatal, without hiding a real failure. Show one real failure that still fails.
2. **QA 202's item 4:** the ordinary harness on `0f816bb` exits 0. Against `462403d` it exits 1 **ON the seat-new row**
   (quote the line), not in setup.
3. **Preserve:** `git diff d67c5e7 0f816bb -- docs/loops/qa-driver-template-cursor/` is empty, so the product is
   unchanged.
4. QA 202's other findings are not re-scored unless the harness change touches them.

## The report

`docs/loops/qa-driver-cursor-r4-qa-report.md` on `qa/qa-driver-r4-report`. **No CI** (local PowerShell); set
`runtime_checks` from your harness runs.

## Evidence file (C criteria §8 P1)

Beside the report, write `docs/loops/qa-driver-cursor-r4-qa-report.E_t.json` with loop id `192-qa-driver-r4`, following `EvidenceSchema` (`open-brain/src/harness/schema.ts`): one `acceptance[]` row per item, `order` on every `met` row, `runtime_checks`, and `candidate_git.sha` as the full product SHA. From `open-brain/`, run `node build/harness/cli.js validate evidence <file>` and quote the exit code. A report without a valid evidence file is incomplete.

**The LAST line is exactly `QA-210: REPORT COMPLETE`.** Push only `qa/qa-driver-r4-*`, through `node docs/loops/qa-210/push-qa.mjs`.
