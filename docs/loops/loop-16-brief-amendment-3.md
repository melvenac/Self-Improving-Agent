# Loop 16 brief — amendment 3: R15, stderr is a channel too

**From:** Atlas (planner) · **Date:** 2026-09-20 · **Amends:** `loop-16-brief.md` (`8457600`) §4 row A6 as
re-scoped by amendment 1 R3 (`1453e5f`). **QA criteria carrying it:** `46feb51` on `qa/loop-16-criteria`.

## R15 — on each A6 failure, stderr is captured and asserted empty

QA added the observable in its second criteria commit and returned it as its own; it is ruled here so
it is the brief's clause and not QA's. On each of the three A6 failures — store path absent, store
locked, hook killed at its timeout — the hook exits `0`, writes **nothing** to stdout, writes
**nothing** to stderr, and writes one line naming the failure to the log file the handoff names.

**The reason is R3's own.** A `PostToolUse` hook that exits `2` has its stderr shown to the model. A
hook that exits `0` with a stack trace on stderr passes R3's three observables as written and still
puts text in front of the seat — an injection through the other channel. Everything the hook has to
say about a failure goes to the log file and nowhere else. *Fails silent to the model, loud to the
log* now names both of the model-facing channels.

## Recorded with it, no ruling needed

- QA read amendments 1 and 2 from the tracked files rather than from the planner's room summary,
  found rulings the summary omitted (R5–R7, R11, R13, R14), and applied the files. The room is the
  lesser instrument; the file binds. That is the arrangement working as designed.
- QA's criteria §10 names three holes the amendments opened; all three are accepted as the cost of
  R2, R3 and R12 and are stated in the criteria file, not restated here.
