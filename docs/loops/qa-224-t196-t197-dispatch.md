# QA 224: record 219 (T-196, the hub procedure as tracked knowledge; T-197, Cursor `/start` parity)

**Read `docs/loops/qa-222-225-common.md` first.** Prefix `t196`. Report `docs/loops/t196-t197-qa-report.md` on `qa/t196-report`.

## The candidate

- **One combined candidate: code at `929673b1babe26db5a22d683c0e642245117c722`** on `origin/loop/t197-cursor-start-parity`. The tip `d98438b` adds only a handoff line.
- **That branch holds all of T-196 plus T-197.** `origin/loop/t196-hub-knowledge` (`d75f152`) differs from it only in T-197's files. Confirm that with a diff, and score both tasks against `929673b`. The base is `334fee5`.
- The planner.md change, `origin/loop/t196-planner-md` `fcea0ad`, is a **role-file PR for Aaron**. Read it and say whether it matches T-196 scope item 2. Do not score it as code.
- Built by Composer (`cursor-infra`).
- **The brief:** `docs/loops/t196-t197-dispatch.md`, with rows HB-1 to HB-4 and CS-1 to CS-4.
- **HB-1, HB-2, HB-3 and CS-4 are live:** `not_evaluated`.
- **Mutants:** `origin/loop/t196-hub-knowledge-mutant` `b8fd067`.

## Specifically

1. **The live Cursor `/start` was overwritten during the build.** Infra copied its candidate into `%USERPROFILE%\.cursor\commands\start.md` on the planner's desktop, then restored it. That is not this machine. On THIS machine, read `%USERPROFILE%\.cursor\commands\start.md` and say whether it matches master's `project-template/.cursor/commands/start.md`, ignoring CR. **Change nothing there.**
2. **CS-2.** `/sync` must fail on an undocumented difference between the Cursor and Claude `/start`. Plant one undocumented difference in a scratch copy and show the failure.
3. **CS-3.** The candidate's Cursor `/start` must not instruct a hand edit to any rendered view or to `state.json`. Grep it, and read the steps.
4. **The seat-file collision with T-198.**
   - This candidate and T-198's (`origin/loop/t198-presence` `231f501`) both ADD `.agents/SYSTEM/hub-partner-seats.json`, with different contents: blob `344bd46` here, `8a616f4` there.
   - **Say whether T-198's parser (`open-brain/src/pipelines/session-start/hub-presence.ts` at `231f501`) reads this candidate's file correctly.** Run it against this file, or show it by reading the code.
   - Name the merge-order consequence.
