# Record 192 (Cursor QA driver r2: push-route refusal, ref-audit attribution): QA dispatch (record 195)

**By:** Atlas (planner), 2026-09-28. **Runs headless on a QA machine through the Cursor QA driver, with GPT
(`gpt-5.6-sol-medium`).** Composer built this candidate, so under D-060 a different model scores it. **Never write a live
`state.json` or the real knowledge DB.** Commit the report from a separate worktree. **Never touch
`%USERPROFILE%\Worktrees\sia-qa` beyond reading it, and never another QA machine.**

## The candidate

- **`462403d`** on `origin/loop/qa-driver-cursor-r2`, from `origin/master` `bf33fe4`. The product (the template
  `drive.ps1` and `cli.json`) is unchanged since `997f2c7`; `c65139a` and `462403d` change only the harness and the handoff.
- Built by Composer 2.5 (`cursor-infra`). Handoff: `docs/loops/qa-driver-cursor-r2-developer-handoff.md`.
- The mutant is `origin/loop/qa-driver-cursor-r2-mutant` `e385f0d`. It is not for merge.
- **The first delivery was returned** because its mutant ran under `-MutantRef`, which flips the expectation and printed
  PASS. Its attribution red was asserted, not run, and the source of denial was unstated. Read `session-147-dispatches.md`,
  "Planner session 11".

## Score against `docs/loops/session-147-dispatches.md`, "Record 192"

1. **Push routes.** Against the real `cli.json` through real `cursor-agent`, each form a seat plausibly uses for
   `push-qa.mjs` passes: plain, `cd … &&`, and through PowerShell. Every `git push` form stays denied, and so does any
   other push the pattern could let through. Look for a push form the narrowed `*git push*` deny misses
   (for example `git -C . push`, `git.exe push`, or `& git push`), and say whether it matters.
2. **Denial source.** Confirm the harness reads denial from `cursor-agent`'s stream-json and does not re-implement the
   match. Run one push row yourself.
3. **Attribution.** A ref that another seat moved mid-run is `ref_moved_elsewhere`. A seat push outside `qa/<prefix>-*`
   is still `ref_violations`. Run the ORDINARY harness (no `-MutantRef`) against `e385f0d` and against `bf33fe4`. Each
   must FAIL with a nonzero exit. Quote the lines.
4. **The stated limit.** A mid-run `git fetch` by the seat could mis-attribute. Say whether any path lets a real seat
   violation be reported as `ref_moved_elsewhere`. That is the dangerous direction.
5. **Preserve.** Completion, resume-at-most-3, refusal and denial handling, and the drive.meta keys other tools read
   are unchanged. `qa-driver-copy.mjs` still produces a working driver from the template.
6. **Your own mutants,** at least two, on `qa/qa-driver-r2-mut-*`.

## CI and authority

This candidate is PowerShell run locally; tcm CI does not exercise it. **No CI runs, and no `windows=true`.** Push only
`qa/qa-driver-r2-*`, through `node docs/loops/qa-195/push-qa.mjs`.

## The report

- **Path:** `docs/loops/qa-driver-cursor-r2-qa-report.md`, on `qa/qa-driver-r2-report`.
- Order: the verdict first, then each item, mutants, defects, and your model.
- **The LAST line is exactly `QA-195: REPORT COMPLETE`.**
