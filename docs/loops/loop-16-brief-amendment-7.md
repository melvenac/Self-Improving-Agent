# Loop 16 brief — amendment 7: the trigger is memory-side, and says so

**From:** Atlas (planner) · **Date:** 2026-09-20 · **At:** the developer's boundary 4, `405a5e3` (rev 4)
on `loop/16-recall-trigger`. **Amends:** the brief's §3 (*the trigger imports nothing from the harness*
— unchanged) by naming which side of the memory/core boundary the trigger stands on.

## 1. Ruling R21 — the trigger is memory-side; the declaration in `MEMORY_SIDE` is the designed door

`module-boundary` went red on the full suite when `src/trigger/` arrived: the check classifies an
unlisted new file as core, and the trigger imports `db-v2`. The check's own comment says why that
default exists — a new file is core until someone says otherwise, so a database import in a new
protocol file fails the check instead of quietly widening the boundary. **The trigger queries the
knowledge store, so it is memory. The repair is the reviewed one-line declaration the check exists to
force — not a suppression, not an exemption.** Ruled so the declaration is the brief's and not a
convenience: `trigger/` is listed in `MEMORY_SIDE`; mutant M16 (the declaration removed) is red; the
other boundary in §3 — no edge either way with `src/harness/` — is unchanged. QA checks that the
declaration is the only change to the check and that M16 is red.

## 2. Recorded, not ruled

- **The fire record landed as ruled:** `trigger_fires` as a sibling table (R5) with R16's three
  states on every invocation; A2 is one test with the empty derived query as the read-back of *never
  consulted*, asserted apart from R17's *asked, silent*; `hook` in `RECALL_TRIGGERS` and not in
  `ob_recall`'s enum (R6), asserted by name because *not explicit* would pass on `unspecified`;
  `ob_stats` prints the three counts always, zeros included; `ob_recalled` marks `[hook-injected]`.
  R19's provenance is required by the policy's zod contract and asserted to still name a size and a
  date. A CHECK constraint refuses a fourth state at the table, because the TypeScript union is
  erased at run time. Nine mutants, M8–M16, all red, `tsc`-clean each.
- **R12(ii) applied correctly for the first time:** the first full-suite run at rev 4 had a real
  failure in a file the candidate touched (`module-boundary`), so the developer fixed it as a
  candidate failure rather than reporting it as environment. The run after the fix: 69 files,
  1008 tests, zero failed, exit 1 on the worker heartbeat — **the fourth `G-042` sighting**, same
  tree, alone: rev 2 clean (986), rev 3 timeout (997), rev 4 timeout (1008).
- R12's targeted set gains `tests/pipelines/sync/module-boundary.test.ts` (11 files, 130 tests),
  because the candidate now touches `MEMORY_SIDE`.
- **For the registration act, when QA asks for it:** the `PostToolUse` array in Aaron's
  `settings.json` is empty today, and a `PreToolUse` hook from the context-mode plugin already
  intercepts `Bash`. One more reason the trigger is on `PostToolUse`: it cannot take part in that
  event's deny-wins precedence at all.
- A mutation attempt that reported *pattern not unique* instead of mutating the first match is the
  right refusal; a runner that picks the first match says *killed* about a line it did not change.
