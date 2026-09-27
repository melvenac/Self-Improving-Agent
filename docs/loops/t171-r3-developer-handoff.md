# T-171 round 3 developer handoff

**By:** Forge (developer), record session **167**. This Cursor seat had no `SESSION_UUID`, so `ob_set_session` was not bound.
**Model / effort:** Grok 4.7, in Cursor. This transcript has no Claude Code per-entry `effort` field, so none is reported.
**Candidate:** `loop/t171-r3` at **`993ed08`**, from `a78a883` (T-171 r2, QA 158 accepted).
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

## Not this round

- QA 158 Open 2 (a flagged replace that removes anything makes the writer the sole author).
- T171R2-D3's five surviving-mutant rows.

## What is not shown

- **GitNexus `impact` / `detect_changes`:** not run. This worktree has no `.gitnexus/`.
- **No laptop (`windows=true`) CI.**
