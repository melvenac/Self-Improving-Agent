# T-158 — close_gap tombstones (record 220)

**By:** Forge, `cursor-infra`. **Branch:** `loop/t158-gap-tombstone` from `origin/master` `474b652`. Local only. Push hold is in force.

`close_gap` used to splice the entry out of `gaps[]`, and `nextId` then handed that id to the next `add_gap`. The record stops at G-045. G-046, G-047 and G-048 are cited in the tracked tree outside `state.json` and its rendered views.

## Schema

`schema_version` stays **3**. `status`, `closed_session` and `closed_rev` are optional on a gap. Absent `status` means open. The live record (G-045 present, every gap without `status`) still parses, and the state-schema check does not ask for a migration.

## Rows

| Row | Test | Red then green |
| --- | --- | --- |
| TG-1 | `close_gap` keeps the entry. `tests/shared/state-writer.test.ts` `close_gap keeps a tombstone`. Greeting: `state-render.test.ts` `a closed gap is not listed as open`. | The tombstone has `status: closed`, `closed_session` 55, `closed_rev` 8. SUMMARY has no `Gap G-001:`. A second close refuses `already closed`. |
| TG-2 | Dry-run `add_gap` on this repo. Same file, `a dry-run add_gap on this repo skips G-046, G-047 and G-048`. | The assigned id is none of those three. Each note starts `add_gap skipped G-04x:` and says `cited`. `state.json` bytes are unchanged. |
| TG-3 | `citedGapIds` on a fixture repo, and the same scan on this repo. | Fixture: G-040 is cited and skipped, G-041 is not cited and is the assigned id. This repo: the scan contains G-046, G-047 and G-048. |
| TG-4 | `loop/t158-gap-tombstone-mutant-splice` `f8c36431ce9445015100c18d992d2b41d1db5187` restores the splice. `loop/t158-gap-tombstone-mutant-scan` `41fe1db697838a78536bb151806a5e510ffe0d11` passes an empty citation map. | Each is `tsc --noEmit` exit 0. Splice: `expected [ 'G-001' ] to deeply equal []` at `state-writer.test.ts:248`, 1 failed, exit 1. Scan: `expected [ 'G-046', 'G-047', 'G-048' ] to not include 'G-046'` at `state-writer.test.ts:298`, 1 failed, exit 1. |
| TG-5 | Done-task retention, `close_task`, the views, and schema v3. | Existing retention and `close_task` tests still pass. Open gaps render as before. A record whose gaps have no `status` parses as schema v3. |

## Full suite

From `open-brain/`, `npx vitest run --testTimeout=60000`. Exit 1.

```
Test Files  1 failed | 122 passed | 8 skipped (131)
Tests  1 failed | 1755 passed | 78 skipped (1834)
```

The one failure is `tests/harness/qa104-a9-probe2.test.ts` `R72-BEFORE-ABSENT-DANGLING`: `EPERM: operation not permitted, symlink`. The test title says it is not for merge. It does not call the gap writer. A default `npx vitest run` (5s timeout) also timed out nine other tests; those nine passed once the timeout was 60s.

## Record 220 r2 (QA 223)

QA 223 rejected `c9ba1db`. Two holes: an explicit `add_gap` id skipped the citation check, and a failed `git grep` was read as no citations. Exit 1 from `git grep` is still no match. Any other exit refuses `add_gap` and names `git grep exited N`.

Candidate `e23e622`. `tsc --noEmit` exit 0. `npx vitest run tests/shared/state-writer.test.ts` — Test Files 1 passed (1), Tests 45 passed (45), exit 0.

### Red on c9ba1db

`git checkout c9ba1db -- open-brain/src/shared/state-writer.ts`, then the two rows. The explicit row's `scan.ok` prelude was skipped for that run only: `c9ba1db`'s `citedGapIds` returns a Map, so `scan.ok` is undefined and the test would have returned before the assertion. Both rows then failed the refusal assertion. Exit 1.

```
FAIL  an explicit cited id is refused, and an uncited one is not
AssertionError: expected true to be false
 ❯ tests/shared/state-writer.test.ts:324:24
    expect(refused.ok).toBe(false);

FAIL  a citation scan that cannot run refuses add_gap and names the failure
AssertionError: expected true to be false
 ❯ tests/shared/state-writer.test.ts:350:18
    expect(r.ok).toBe(false);
```

The writer and the test were restored from `e23e622` after that run. Working tree clean.

### Green after

Same two rows on `e23e622`: both passed (the 45-passed run above).

### Mutants (tsc-clean, parent e23e622)

`loop/t158-r2-mutant-explicit` `652e749` drops the explicit-id citation check. `tsc --noEmit` exit 0. The explicit row: expected true to be false at `state-writer.test.ts:327`. The scan row passed. Vitest exit 1.

`loop/t158-r2-mutant-scan-open` `258852f` reads every non-zero `git grep` as no citations. `tsc --noEmit` exit 0. The scan row: expected true to be false at `state-writer.test.ts:353`. The explicit row passed. Vitest exit 1.

### Full suite

From `open-brain/`, `npx vitest run --testTimeout=60000`, unpiped. Exit 1.

```
Test Files  2 failed | 121 passed | 8 skipped (131)
Tests  2 failed | 1756 passed | 78 skipped (1836)
```

The two failures are `tests/harness/qa104-a9-probe2.test.ts` `R72-BEFORE-ABSENT-DANGLING` (`EPERM` on `symlinkSync`; the title says it is not for merge; it does not call the gap writer; the same failure was reproduced on an archive of `origin/master` `474b652`) and `tests/shared/state-schema.test.ts` `T-171 r3b` (`tasks[0]` has `note_by`). r3b is the planner's master-red and is ignored. Vitest also reported two unhandled `[vitest-worker] Timeout calling "onTaskUpdate"` errors. They are not additional failed tests.
