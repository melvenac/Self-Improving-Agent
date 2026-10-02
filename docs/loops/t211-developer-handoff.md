# T-211 developer handoff: the standing status cron lives in seat data

**By:** Builder (developer seat, `sia-builder`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t211-standing-cron`, **stacked on `loop/t164-port`** (PR #270). It carries T-164's two commits plus its own; merge T-164 first. **Dispatch:** `docs/loops/t164-t211-dispatch.md` at `bea385b2`. T-164's numbering is untouched.

## Files touched

- `open-brain/src/pipelines/session-start/agent-identity.ts` (the module that already reads `AGENT.local.md` then `AGENT.md`): new `readStandingCron(cwd)`, `cronProblem(cron)` and a small frontmatter reader for the three keys.
- `open-brain/src/server.ts` (the `Seat:` line is built in `handleStart`, `server.ts:~299`): one added line, `lines.push(readStandingCron(projectRoot))`, right after the Seat line. **That is where the line is printed.**
- `.claude/commands/start.md` and its identical copy `project-template/.claude/commands/start.md`: a new `### 5b. Standing cron` step (create the cron with `CronCreate` from the printed line, once, before the briefing; none needs nothing; INVALID creates nothing) and one new line under FLAGS. Only lines were added; no existing line was edited.
- `docs/loops/cursor-start-differences.json`: the three added Claude lines are listed under `claude_only`, because `CronCreate` is a Claude tool and the `cursor-start-parity` check waives a line only when it is in the table. The check passes on the real tree (6 documented differences).
- `project-template/.agents/AGENT.md`: documents the three keys (below the frontmatter, so the frontmatter parse is unchanged).
- Tests: `open-brain/tests/pipelines/session-start/standing-cron.test.ts`. No seat's own `AGENT.local.md` was touched.

## Behaviour

Keys: `status_cron` (5-field cron, local time), `status_to`, `status_rule`. The first of `AGENT.local.md`, `AGENT.md` that carries **any** of the three is the whole answer (its values only; no mixing across files). Lines, exactly:
- present: `Standing cron: <cron> → status to <status_to> (rule: <status_rule>). Create it with CronCreate before the briefing ends.`
- absent: `Standing cron: none in seat data.`
- malformed: `Standing cron: INVALID in .agents/<file>: <why>`, for a cron that is not 5 fields or has a field out of range, or for a key that is missing next to the others (never dropped).
A quoted value (`"*/20 * * * *"`) is read without its quotes; a value starting with `<` (a template placeholder) counts as absent.

## Rows

| Row | Test (`standing-cron.test.ts`) | Red | Green |
| --- | --- | --- | --- |
| SR-1 | the three keys in `AGENT.local.md` print the present line, verbatim | `readStandingCron` is not a function | pass |
| SR-2 | `AGENT.md`'s keys print when the local file lacks them; a local file that has the keys overrides | same | pass |
| SR-3 | neither file: `none in seat data` (also with no agent files) | same | pass |
| SR-4, SR-4b | `"4 * *"` and `"61 * * * *"` print INVALID with the reason (and hour, day, month, weekday ranges, `*/0`, a non-number); a missing `status_to`, `status_rule` or `status_cron` is INVALID | same | pass |
| SR-5 | mutants below: 5a (line dropped) goes red on **SR-6** only (SR-1, SR-2 call `readStandingCron` directly); 5b on SR-1, SR-2, SR-4, SR-4b (QA 249 F5, corrected in round 2) | | red |
| SR-6 | `handleStart` with and without the keys: the line sits right after `Seat:`, and every other greeting line is identical (the `Total returned words` line is excluded by name because it counts the added line's words) | same | pass |

## Mutants (SR-5), `docs/loops/t211/mutants/`

- `sr5a-line-dropped.diff` (the `lines.push` removed): `tsc` 0; red on SR-6.
- `sr5b-reads-only-agent-md.diff` (only `AGENT.md` is read): `tsc` 0; red on SR-1, SR-2, SR-4 and SR-4b.

## Runs

Red: the new file, before the source: all six tests failed. Green: 6 passed. Regression: `server.test.ts` plus all of `tests/pipelines/session-start` (15 files, 193 tests); `command-parity`, `mirror-parity`, `template-seed` (25 tests); `start-parity` (4); `agent-identity` with `template-seed` after the template edit (9). `tsc --noEmit` 0.

**For the planner after the merge:** the planner's own `AGENT.local.md` is untracked and local; its three keys are written by the planner. I edited no seat's local file.
