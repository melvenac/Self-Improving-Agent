# T-164 + T-211 round 2: developer handoff

**By:** Forge (developer seat, `sia-forge`, Claude Sonnet 5.5), 2026-10-02. **Dispatch:** `docs/loops/t164-t211-r2-dispatch.md` at `f7ac983d`. **Ruling:** D-095 (`docs/loops/qa-249-rulings.md`). **Job class:** LIGHT. Merged nothing; no issue, PR or comment opened.

## New SHAs (rebased onto `origin/master` `f7ac983d`)

| Branch | Round 1 | Round 2 tip |
| --- | --- | --- |
| `loop/t164-port` (PR #270) | `fbf94ae6` | `892f7644` |
| `loop/t211-standing-cron` (PR #272) | `9f6fcea4` | the head of this branch (this handoff's commit sits on `df430553`) |

Stack order is kept: T-211 sits on T-164's new tip. Pushed with `--force-with-lease`, only these two branches.

## F1 (T-164): the refusal names max(n)+1

- `state-schema.ts`: `nextFreeSessionNumber` (lowest unused n) is **deleted**; `nextSessionNumber(sessions)` is max(n)+1, 1 for an empty record.
- Callers of the deleted function (grep over `open-brain/src` and `tests`): one, `shared/state-writer.ts` (the SC-2 refusal), now `nextSessionNumber`. Only handoff prose mentions the old name.
- `pipelines/session-start/session-log.ts` `nextGreetingSessionNumber` now calls the same `nextSessionNumber`, so the greeting and the refusal share one function.
- Test: `record-session-number.test.ts`, "on a sparse record (76, 147..155) the refusal names max(n)+1, the number the greeting names" (the same record shape as QA's SC-2 case; it asserts the greeting is 156 and the refusal says `next free number is 156`).
  - **Red** on the round-1 code: `expected 'session number 155 is already recorded for uuid cccccccc-0000-4000-8000-000000000155; next free number is 1' to contain 'next free number is 156'`.
  - **Green** after the fix: 7 passed. `tsc --noEmit` 0.

## F2, F3, F4, F5 (T-211)

- **F2:** `standing-cron.test.ts` SR-2b: `AGENT.local.md` with only `status_to`, `AGENT.md` with all three keys; expects `Standing cron: INVALID in .agents/AGENT.local.md: status_cron is missing`.
- **F3:** SR-4 now asserts `60 * * * *` is INVALID (`minute field "60" is out of range 0-59`) and `59 * * * *` is accepted.
- **QA mutants on the new rows** (`docs/loops/qa-249/mutants/` on `origin/qa/t164-t211-report`; each applies, `tsc --noEmit` 0, then reverted):
  - `qa249-a-status-to-only-no-shadow.diff`: **red**, SR-2b (1 failed, 7 passed).
  - `qa249-b-minute-accepts-60.diff`: **red**, SR-4 (1 failed, 7 passed).
- **F4:** the template's example had trailing `# comments` that the reader does not strip. I took the first option: the comments left the code block and now sit in a sentence beneath it, which says the reader does not strip a trailing comment. SR-7 reads `project-template/.agents/AGENT.md` itself, takes the fenced block, fills only the two placeholders (`<agent-name>`, `<role>`) and expects the present-shape line `Standing cron: */20 * * * * → status to clark (rule: .agents/roles/planner.md). ...`.
  - **Red** on the round-1 template: `Standing cron: INVALID in .agents/AGENT.local.md: status_cron has 11 fields, expected 5`.
  - **Green** after the edit.
- **F5:** the `t211-developer-handoff.md` SR-5 row now says 5a goes red on SR-6 only. (The dispatch's own row text is the planner's and is untouched.)

## Runs (LIGHT: touched files only, no full suite)

`standing-cron.test.ts` 8 passed; `record-session-number.test.ts` 7 passed; also `start-parity`, `agent-identity` (10 passed together), `template-seed` (3 passed). `tsc --noEmit` 0 on both branches' source. Not run: the full suite (CI), `/sync` (this checkout's build is stale; run it before any merge).

## T-221

Not merged at `f7ac983d`; the push run and PR run on each branch may cancel each other. Reported to atlas-sia for a re-run.
