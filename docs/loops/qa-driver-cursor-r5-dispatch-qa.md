# Record 192 r5 (Cursor QA driver: the laptop push route reaches the agent intact): QA dispatch (record 218)

**By:** Atlas (planner), 2026-09-28, record session 149. **Runs headless through the Cursor QA driver, with GPT
(`gpt-5.6-sol-medium`).** Composer built this candidate, so under D-060 a different model scores it.
- **Run it on the LAPTOP (DESKTOP-0GV3HAD),** the machine where r4 failed. A pass on the QA PC would not test the fix.
- Never touch `%USERPROFILE%\Worktrees\sia-qa` beyond reading it.
- **Never write a live `state.json` or the real knowledge DB.**

## The candidate

- `origin/loop/qa-driver-cursor-r2` at **`bbfb724`**: one commit over r4 `0f816bb`, harness and handoff only.
  - Adds `docs/loops/qa-driver-cursor-r2-launch.ps1`.
  - Edits `docs/loops/qa-driver-cursor-r2-harness.ps1`.
  - Updates the handoff `docs/loops/qa-driver-cursor-r2-developer-handoff.md`.
  - The product, `docs/loops/qa-driver-template-cursor/`, is unchanged.
- **Read QA 210's report first** (`qa/qa-driver-r4-report` `f94a79d`). It confirmed r4's fixture repair. It rejected
  because on this laptop the sanctioned `cmd /c` push route gave `denial=False moved=False`, twice.
- **The developer's diagnosis (Composer, `cursor-infra`):**
  - The route is at fault, not the environment. `cursor-agent.ps1` forwards `$args` to `node.exe`, and PowerShell 5.1
    drops embedded quotes, so the agent received `cmd /c cd . && node ...` without its quoting.
  - The fix starts node with `ProcessStartInfo` quoting.
  - A new check fails the 9994 row if the user event lacks the quoted command.

## Score

1. **The diagnosis.** Reproduce the quote drop on this laptop without the fix: the argv that reaches `node` loses the
   embedded quotes. Then show that the fix delivers them intact. Quote both argv.
2. **The r4 row passes here.** The ordinary harness on `bbfb724` exits 0 on this laptop, with `cmd /c`
   `denial=False moved=True prompt_quotes_kept=True`. Plain and PowerShell still pass, and the three deny rows are
   still `denial=True moved=False`. Quote the lines.
3. **The new check bites.** Make a mutant that drops the quotes again (for example, revert the launch to
   `cursor-agent.ps1`). The 9994 row must go red, and the failure line must be quoted.
4. **Does the real driver share the defect? This is the question that matters most.** The fix is harness-only.
   - Read the template `drive.ps1`: how does it launch `cursor-agent` on PowerShell 5.1?
   - Does any prompt a real QA run sends (the first prompt, `stops.txt`, a resume prompt) contain embedded double
     quotes that would be dropped the same way?
   - If yes, real QA seats on this laptop receive mangled instructions. Score it as a defect against the product,
     not the harness.
5. **Preserve.**
   - `git diff d67c5e7 bbfb724 -- docs/loops/qa-driver-template-cursor/` is empty.
   - Completion, resume-at-most-3, refusal and denial handling are unchanged.
6. At least one mutant of your own, on `qa/qa-driver-r5-mut-*`.

## The report

`docs/loops/qa-driver-cursor-r5-qa-report.md` on `qa/qa-driver-r5-report`. **No CI:** this is local PowerShell. Set
`runtime_checks` from your harness runs.

## Evidence file

Beside the report, write `docs/loops/qa-driver-cursor-r5-qa-report.E_t.json`:
- loop id `192-qa-driver-r5`, following `EvidenceSchema` (`open-brain/src/harness/schema.ts`);
- one `acceptance[]` row per item, with `order` on every `met` row;
- `runtime_checks` from your harness runs;
- `candidate_git.sha` as the full SHA of `bbfb724`.

From `open-brain/`, run `node build/harness/cli.js validate evidence <file>` and quote the exit code. **A report
without a valid evidence file is incomplete.**

**The LAST line is exactly `QA-218: REPORT COMPLETE`.** Push only `qa/qa-driver-r5-*`, through
`node docs/loops/qa-218/push-qa.mjs`.
