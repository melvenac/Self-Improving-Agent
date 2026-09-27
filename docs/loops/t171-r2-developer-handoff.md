# T-171 round 2: developer handoff (Forge, record 155)

**By:** Forge (developer), record session 155, 2026-09-27, in `~/Worktrees/sia-infra`. **To:** Atlas (planner).
**Model:** Grok 4.7. This seat has no Claude effort field. **No `/end`.** The live `.agents/state.json` was not written.

**Brief:** `docs/loops/t171-bootstrap-rulings-qa144-qa145.md` on `origin/docs/session-100-qa99-dispatch`, the QA 144 section and the Briefs. QA 144's Defects, Disagreements and Open are on `origin/qa/t171-report` @ `d5a783a`. The three surviving mutants are `qa/t171-mut-dry-run-hides-replace` `0ba9918`, `qa/t171-mut-removes-by-length` `89c3c77`, and `qa/t171-mut-superset-foreign-unflagged` `0e87991`.

Branched from `origin/loop/t171` @ `3eddf20` (the handoff on candidate `b371176`; `src/` identical to `b371176`).

| Commit | What |
|---|---|
| `1086335` | tests only, red first (`src/` is `b371176`'s) |
| `a78a883` | **the candidate**: the fix |
| this commit | this note |

## What changed

- **T171-D1.** A `replace_note` that removes nothing (`text` still contains the old note) keeps the prior `note_by` and adds the writer, via the same `appendedBy` an append uses. QA's suggested line. An unrecorded (`null`) note stays unrecorded, so the writer is not laundered into sole author. A replace that does remove text still leaves only this write, or `null` when the write has no session. Empty text still clears `note_by`.
- **T171-D2.** The REPLACED line quotes the first old line the new text does not contain, still under `removed text begins:`. A kept first line is no longer named as removed. One expression.
- **T171-D3.** Three rows, no source change of their own: the server dry run of a `replace_note` prints the REPLACED line; a longer replacement that drops the old text still says `removed text begins`; a superset replace of another session's note is refused without the flag. The flagged superset is the D1 row.

`npx tsc --noEmit -p .` exited 0 before the test push and again before the fix push.

## tcm CI (2 runs; `test-windows` skipped on both)

`gh workflow run CI --ref <branch>` with no `windows` input. Each run's `test-windows` job is **skipped**. `onTaskUpdate` / `Unhandled`: 0.

| Run | Branch @ SHA | Runner | Result |
|---|---|---|---|
| **`36292359527`** | `loop/t171-r2-red` @ **`1086335`** | `tcm-1` | **failure, as intended.** Test Files **1 failed \| 86 passed (87)**. Tests **3 failed \| 1328 passed \| 2 skipped (1333)**. |
| **`36292477609`** | `loop/t171-r2-green` @ **`a78a883`** | `tcm-2` | **success.** Test Files **87 passed (87)**. Tests **1331 passed \| 2 skipped (1333)**. |

The 2 skips are the ones the parent names. Against `b371176`'s green run (`36281579531`: 1325 passed, 2 skipped, 1327) this round adds 6 tests.

**Red, the only 3 failures, all in `state-writer-notes.test.ts` (19 tests \| 3 failed):**

| Row | Assertion |
|---|---|
| T171-D1, flagged replace that removes nothing | `note_by` was `['writer-uuid-a']`, expected `['other-uuid-b', 'writer-uuid-a']` |
| T171-D1, flagged superset of an unrecorded note | `note_by` was `['writer-uuid-a']`, expected `null` |
| T171-D2, kept first line must not be quoted as removed | the line contained `removed text begins: "kept line"` |

The two T171-D3 rows in that file passed on this run (longer replacement; unflagged superset refused). Every other file is ✓.

**Green:** `state-writer-notes.test.ts` 19 ✓, `state-writer.test.ts` 41 ✓, `server.test.ts` 30 ✓ (the dry-run REPLACED row is in that 30). No × line. The 3 tests that failed at `1086335` are the ones now passing: 1328 + 3 = 1331.

## Mutants, local, one per protection

Each edit applied to `a78a883`, vitest on the note file (the dry-run mutant on `server.test.ts`), then `git checkout` restored both sources (`git diff` empty after).

| Mutant | Killed by | Red |
|---|---|---|
| QA `removes-by-length` | T171-D3 longer replacement | 1 of 19 |
| QA `superset-foreign-unflagged` | T171-D3 unflagged superset | 1 of 19 |
| QA `dry-run-hides-replace` | the server dry-run REPLACED row | 1 failed, 29 skipped |
| D1: the old sole-author `note_by` line | both T171-D1 rows | 2 of 19 |
| D2: quote the old first line blindly | T171-D2 | 1 of 19 |

## Not in this round

Open 2 and Open 3 are the planner's, as the ruling says. GitNexus has no index in this checkout. `replaceNote` is called from `editNote` only (`update_task`, `close_task`).

Pushed `loop/t171-r2`, `loop/t171-r2-red` (`1086335`), and `loop/t171-r2-green` (`a78a883`).
