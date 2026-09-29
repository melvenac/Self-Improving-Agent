# QA 228: record 219 r2 (T-196, the hub procedure as tracked knowledge; T-197, Cursor `/start` parity)

**Read `docs/loops/qa-222-225-common.md` first.** Prefix `t196-r2`. Report `docs/loops/t196-t197-r2-qa-report.md` on `qa/t196-r2-report`.

## The candidate

- **Combined code at `3059ca9cc5b0cb668216561b7b77c8b0119abad3`** on `origin/loop/t197-cursor-start-parity`. The tip `c8165f5` adds only the handoff. The base is `334fee5`.
- Built by Composer (`cursor-infra`). **This is r2.** QA 224 REJECTED `929673b` (`qa/t196-report` `cadc6d4`). **Read that report first.** Every row it scored `met` must still be met.
- **The developer's r2 mutant:** `loop/t197-r2-mutant-substring` `acca819` puts back the substring waiver. **Re-apply it to the candidate.**
- **The planner.md change:** `origin/loop/t196-planner-md` `e21e71a` is a **role-file PR for Aaron**. Read it and say whether it matches T-196 scope item 2. Do not score it as code.
- The brief is `docs/loops/t196-t197-dispatch.md`, with rows HB-1 to HB-4 and CS-1 to CS-4. **HB-1, HB-2, HB-3 and CS-4 are live checks:** score them `not_evaluated`.

## Close QA 224's CS-2 finding

1. **A difference-table entry waives only the line it equals exactly, and is used at most once.** A line that merely *contains* the table's phrase is an issue. So is a leftover, unused entry.
2. **Plant three differences in a scratch copy**, and show each one fails:
   - a new Cursor-only line that contains a table phrase;
   - a duplicated waived line;
   - a table entry whose line has been deleted.

## Specifically

- **The seat file.** `.agents/SYSTEM/hub-partner-seats.json` now carries `talk_tokens`, a `<A2A-Hub>` checkout placeholder.
  - Confirm that T-198's parser (`origin/loop/t198-presence` `231f501`, `hub-presence.ts`) still reads this file. QA 225 found it ignores extra keys; show that this is still true.
  - Say whether a planner following the file gets a runnable `hub-talk` command.
- **Master is green again from `3592f11`.** The base `334fee5` predates that fix, so judge any `state-schema` r3b failure by whether the base shows it too.
