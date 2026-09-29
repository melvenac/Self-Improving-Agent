# QA 227: record 220 r2 (T-158: `close_gap` tombstones; `add_gap` never reuses a gap id)

**Read `docs/loops/qa-222-225-common.md` first.** Prefix `t158-r2`. Report `docs/loops/t158-r2-qa-report.md` on `qa/t158-r2-report`.

## The candidate

- **Code at `e23e622813a540e18bed0849779040cf181ff9b7`** on `origin/loop/t158-gap-tombstone`. The tip `6a04048` adds only the handoff. The base is `474b652`.
- Built by Composer (`cursor-infra`). **This is r2.** QA 223 REJECTED `c9ba1db` (`qa/t158-report` `18c97b4`). **Read that report first.** Every row it scored `met` must still be met.
- **The developer's r2 mutants:**
  - `loop/t158-r2-mutant-explicit` `652e749` drops the explicit-id check;
  - `loop/t158-r2-mutant-scan-open` `258852f` reads every non-zero `git grep` exit as "no citations".
- The r1 mutants `-mutant-splice` `f8c3643` and `-mutant-scan` `41fe1db` still apply. **Re-apply all four to `e23e622`.**
- The brief is `docs/loops/t158-t164-dispatch.md` §"Record 220", with rows TG-1 to TG-5.

## QA 223's two majors must be closed

1. **Explicit ids.**
   - An explicit `add_gap` id goes through the same refusal as a generated one: it is refused if it exists in the record or is cited in the tracked tree.
   - Try `G-046`, `G-047` and `G-048` explicitly, against a **copy** of this repo's `.agents/state.json`, never the live file.
2. **The citation scan fails closed.**
   - Only `git grep` exit 1 means "no citations". Any other exit, or a spawn failure, refuses `add_gap` and names the exit.
   - Force a real failure: a corrupt index, a missing git, or an unreadable path, whichever you can do safely in a scratch copy. Show the refusal.

## CI

Master is green again from `3592f11` (#210 fixed the `state-schema` r3b test), so a base older than that may still show the old r3b failure. **Judge any r3b failure by whether the base shows it too.**
