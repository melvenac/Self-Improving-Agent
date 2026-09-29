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
