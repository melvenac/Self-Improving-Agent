# T-171 round 3 developer handoff

**By:** Forge (developer), record session **167**. This Cursor seat had no `SESSION_UUID`, so `ob_set_session` was not bound.
**Model / effort:** Grok 4.7, in Cursor. This transcript has no Claude Code per-entry `effort` field, so none is reported.
**Candidate (r3b, the load fix):** `loop/t171-r3` at **`2dcc68a`**, after `993ed08` (the character-quote fix, from `a78a883`, T-171 r2, QA 158 accepted). QA 177 scores this tip.
**Brief:** `docs/loops/followups-r165-r167-briefs.md` on `origin/docs/session-100-qa99-dispatch`, section Record 167. Read only what that section names.
**No `/end`.** The live `state.json` was not written. The C4b fixture is a copy of T-169's note, read out of it.

**"It works" is not a claim this seat can make.** What follows is what ran, and what it printed.

## What this round changed

`replaceNote` quotes from the first differing character, 120 characters, not from the first differing line. SIA's notes are one line (`" — "` joins appends), so the line quote named the kept start.

| Row | What it pins |
|---|---|
| **C4b** | The real T-169 note (3,256 characters, one line). A replace that keeps the first 200 characters quotes `old.slice(200, 320)`, which begins `.ai/artifact/…`, not `Session 78, planner…`. That quote is not in the new note. |
| **QA 158's fallback** | `retry\nok\nretry` → `retry\nok` quotes a leading newline then `retry`. `one\nt\nthree` → `one\nthree` quotes a leading newline then `three`. Neither quote is the kept first line. |
| **One word** | A single-line note, the changed word past character 120. The quote starts at that word. |

A replace that shares no prefix still quotes 120 characters from the start. Where the old note's first line is shorter than 120, that quote now continues onto the next line. Four existing assertions in `state-writer-notes.test.ts` name that quote. D1 (authors kept when nothing is removed) and the refusals are unchanged.

## Runs

`workflow_dispatch` of `ci.yml`. `hosted` and `windows` left unset. No full local suite: the notes file only (22 passed after the fix).

| | SHA | tcm run | Result |
|---|---|---|---|
| Red | `98c40af` | 36301870766 | **failure.** 3 failed (C4b, the fallback, the one-word edit), 1331 passed, 2 skipped (1336). |
| Green | `993ed08` | 36301939922 | **success.** 87 files, **1334 passed, 2 skipped** (1336). `test-windows` skipped. |
| Mutant: the line quote restored | `loop/t171-r3-mut-d2` `e2cb991` | 36301993669 | **failure.** 7 failed: the three new rows, plus the four assertions that now name the character quote. 1327 passed, 2 skipped. |

## r3b — a v3 record with no `note_by` loads

PR #174 failed CI run 36303618279: master's `.agents/state.json` is schema v3 (T-179's migrator, which writes no `note_by`) and T-171's schema required the key. `tasks.0.note_by: expected array, received undefined`.

A missing `note_by` now loads as `null` (unknown author). `readState` does not write the file. A later write puts the key back only on a task that op touched; the others stay without it. Master's record has 70 tasks, every note non-empty, every `note_by` absent, so each loads as `null`. An empty note with the key absent still fails the existing refine (`note_by` must be `[]` when the note is empty). That shape is not in master's file.

| | SHA | tcm run | Result |
|---|---|---|---|
| Red | `16d9181` | 36304305394 | **failure.** 2 failed (origin/master's real `state.json` does not parse; a missing `note_by` is not loaded). 1334 passed, 2 skipped (1338). `test-windows` skipped. |
| Green | `2dcc68a` | 36304366630 | **success.** 87 files, **1336 passed, 2 skipped** (1338). `test-windows` skipped. |
| Mutant: `note_by` required again | `loop/t171-r3-mut-noteby` `4fb6414` | 36304398674 | **failure.** The master-parse row and the write row. 2 failed, 1334 passed, 2 skipped. `test-windows` skipped. |
| Merge with `origin/master` | `loop/t171-r3-with-master` `46cc922` | 36304454993 | **success.** 1450 passed, 2 skipped (1452). `greeting-size.test.ts` (8) and `state-render.test.ts` (32) passed against the merged record. `test-windows` skipped. |

`workflow_dispatch` of `ci.yml`. `hosted` and `windows` left unset. Four runs. No full local suite on the seat: the schema file, the notes file, then `greeting-size` and `state-render` on the merge checkout.

## Not this round

- QA 158 Open 2 (a flagged replace that removes anything makes the writer the sole author).
- T171R2-D3's five surviving-mutant rows.

## What is not shown

- **GitNexus `impact` / `detect_changes`:** not run. This worktree has no `.gitnexus/`.
- **No laptop (`windows=true`) CI.**
