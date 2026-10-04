# T-238, developer handoff: the KEY_ORDER guard

Seat: sia-builder. Branch `loop/t238-keyorder-guard`, from #401's frozen head `c3ee949b` (it edits KEY_ORDER). Retarget onto master after #401 merges.
Atlas said do NOT open the PR until told (QA 269 running).

## The bug
`serializeState` writes only the keys `KEY_ORDER` lists for a slot. A schema field missing from `KEY_ORDER` validated, applied, printed "applied" and vanished
from disk (`tasks[].assignee`, #401).

## What it does
- `schemaObjectSlots()` (new, `state-schema.ts`) DERIVES the slots by walking `StateSchema`: a slot is the property name an object schema sits under, the
  same name `canonicalize` looks up (`$` for the root). It sees through array, optional, nullable, default and union, and THROWS on a zod type it cannot see
  through, so a blind walker cannot read as "no gaps".
- `keyOrderGaps(order = KEY_ORDER)` compares per slot: every schema field listed, every listed key a schema field, no key twice, no slot without an entry
  (except `watch_out` and `open_questions`, the object variants of a string-or-object union: `canonicalize` sorts their keys and drops none), no entry for a
  slot the schema lacks, no slot reached by two different shapes.
- **Both a test and a runtime refusal, my call.** `serializeState` calls `assertKeyOrder()` on EVERY write and throws `serializeState refused: KEY_ORDER and
  StateSchema disagree, and writing would lose data. <gaps>` BEFORE any key is dropped. Why both: the test is derived from the schemas, so it catches a
  field that no current record uses (an optional field no data has yet), which a check on the data cannot see; the refusal catches the same drift at the
  moment of a write if the test were skipped or the guard bypassed, turning silent loss into a loud, harmless failure. Not memoised: a check that remembers
  its answer cannot see a later drift, and the walk is about a dozen objects. `KEY_ORDER` is now exported (read-only type) so the test derives its rows from it.
- Cost to know: a schema change that forgets `KEY_ORDER` now fails EVERY ob_state write until fixed, instead of losing the field. That is the intent.

## Rows (`tests/shared/state-keyorder.test.ts`, 23)
Row 1 (derived, one per slot): `KEY_ORDER[slot]` and the schema's shape keys are equal sets; the walker saw at least the 13 known slots and the root; every
slot has an entry except the two union variants; `KEY_ORDER` names no slot the schema lacks; `keyOrderGaps()` is empty. Known positives: a doctored order
(lost key, extra key, duplicate, missing slot, unknown slot) is reported with its exact sentence; the walker finds nested slots behind wrappers; the walker
refuses a `z.record`. Row 3: nothing vanishes (serialize then parse equals the fixture); a task `assignee` survives; a doctored `KEY_ORDER` (restored in a
`finally`) makes `serializeState` refuse, naming the field.

## Red first (base `c3ee949b`, tests `commit 1`, src reverted)
The file fails to collect: `schemaObjectSlots is not a function`, "no tests". The API is absent at base, so no row can be counted red individually; the
behaviour is pinned by the mutants below.

## Mutants (product edits, restored, each `tsc --noEmit` 0, edit-landed asserted, run sequentially against the one file)
```
a1 delete "assignee" from KEY_ORDER.tasks: tsc 0; vitest rc=1; 6 failed | 17 passed (23)
a2 delete "first_rev" from KEY_ORDER.sessions: tsc 0; vitest rc=1; 7 failed | 16 passed (23)
b1 add a schema field with no KEY_ORDER entry (TaskSchema.extra): tsc 0; vitest rc=1; 7 failed | 16 passed (23)
b2 add a new nested object slot with no entry (ProjectSchema.meta): tsc 0; vitest rc=1; 8 failed | 15 passed (23)
c  a1 AND the write refusal removed (silent loss, the original bug): tsc 0; vitest rc=1; 5 failed | 18 passed (23)
c2 the write refusal removed alone: tsc 0; vitest rc=1; 1 failed | 22 passed (23)
d  walker does not enter arrays: tsc 0; vitest rc=1; 10 failed | 4 passed (14)
e  assertKeyOrder never throws: tsc 0; vitest rc=1; 2 failed | 21 passed (23)
f  walker silent on a type it cannot see: tsc 0; vitest rc=1; 1 failed | 22 passed (23)
g  keyOrderGaps ignores listed keys the schema lacks: tsc 0; vitest rc=1; 1 failed | 22 passed (23)
restored: src has the committed-tree diff only: M src/shared/state-schema.ts
```
(a) is a1/a2, (b) is b1/b2, as dispatched. c is the original bug (a1 plus no refusal): the round-trip row dies. c2 survived the first version, because the
check was memoised and no row could provoke drift; the memo was removed and a row that doctors `KEY_ORDER` was added, after which c2 is killed.

## Verification
state-keyorder 23/23, state-schema 20/20, state-writer 48/48, state-views 18/18, server 35/35, each file alone. `tsc --noEmit` 0 and `typecheck:tests` 0.
Full suite NOT run (QA PC RAM rule).

## Not verified / limits
- The walker handles the zod types StateSchema uses today (object, array, optional, nullable, default, union, string, number, boolean, enum, literal). A new
  type (record, tuple, lazy, intersection) makes it THROW at the first write and in the test, by design; it must be taught before it is trusted.
- `watch_out` and `open_questions` are an explicit allowlist. A new string-or-object union slot needs a deliberate decision (entry or allowlist).
- This guards KEY_ORDER against the schemas. It does not guard the other writers of state.json (there are none that bypass `serializeState`, as far as I read).
