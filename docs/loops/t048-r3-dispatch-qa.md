# T-048 round 3 (`server.ts`: SILENT 4, SILENT 9, T048-D1's two score renderers): QA dispatch (record 182)

**By:** Atlas (planner), record session 147 · 2026-09-27. **Runs headless on a QA machine through the Cursor QA
driver**, with Composer 2.5. **Never write a live `state.json` or the real knowledge DB:** point `KNOWLEDGE_V2_DB`,
`HOME` and `USERPROFILE` at scratch. Commit the report from a separate worktree.

## The candidate

- **`b048df8`** on `origin/loop/t048-r3`. The handoff is at `40881b6` (`docs/loops/` only after it).
- Branched from r2b `822f398` (QA 178 is scoring it separately), then merged `origin/master` `e201baa` at `e48c5e7`
  before any edit. **Score only what round 3 adds:** `git diff e48c5e7 b048df8 -- open-brain/src` is `server.ts`
  and one other file. Name the other file and say whether it belongs to the round.
- Built by Grok 4.7, record 180.
- **CI on tcm:** red `36305739687` (`cc56fa4`); green `36305953718`. Mutants:
  - empty catch `36306235793`;
  - dropped `formatRecalledResolution` `36306237680`;
  - dropped server score state `36306239438`.

## Score against `docs/loops/session-147-dispatches.md`, "Record 180"

1. **SILENT 4:** in `ob_recall`, a `recordRecallEvent` that throws while a session is live prints its own
   `NOT LOGGED` line naming the error, and the hits are still returned. The no-session line is unchanged.
2. **SILENT 9:** MCP `ob_end` prints `formatRecalledResolution`'s line, the same text the session-end hook prints.
   "No session id" and "no recall_log rows" print different lines. The rejected-file line is kept.
3. **T048-D1, the `server.ts` half:** `ob_sync --score` and `ob_score` print the invocation-log state in r2b's
   wording, and print nothing extra when the state is `ran`. Check a missing, a corrupt and an unreadable log.
4. **Preserve:** a recall never fails because logging failed, `ob_end` still finishes, r2b's `cli.ts` output is
   unchanged, and the audit's INTENDED and SAFE rows are untouched.
5. **Your own mutants,** at least two, including one the developer did not run.

## CI and authority

tcm, at most 6 runs. **No `windows=true` CI.** Push only `qa/t048-r3-*`, through `node docs/loops/qa-182/push-qa.mjs`.

## The report

- **Path:** `docs/loops/t048-r3-qa-report.md`, on `qa/t048-r3-report`.
- Order: the verdict first, then each item, mutants, CI, defects, and your model.
- **The LAST line is exactly `QA-182: REPORT COMPLETE`.**
