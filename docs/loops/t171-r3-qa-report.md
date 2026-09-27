# T-171 round 3 (character quote + r3b `note_by` load), candidate `2dcc68a`: QA report (QA seat, record session 177)

**By:** the QA seat, record session **177**, headless, dispatched by `docs/loops/t171-r3-dispatch-qa.md`.
2026-09-27 (UTC). **Machine:** `DESKTOP-0GV3HAD` (`$COMPUTERNAME`). **Model:** Composer 2.5 (Cursor).
**Dispatch:** `docs/loops/t171-r3-dispatch-qa.md` (read from tree at `b463ff2`). **Candidate:** `2dcc68a` on
`origin/loop/t171-r3` (handoff tip `dad58bc`), stacked on T-171 r2 `a78a883` (QA 158 accepted).
**Scored:** only what round 3 adds (`993ed08` character quote + `2dcc68a` r3b `note_by` load). `git diff
a78a883 2dcc68a -- open-brain/` touches `state-writer.ts`, `state-schema.ts`, `state-writer-notes.test.ts`,
`state-schema.test.ts`, and fixture `t169-note.txt`.

## Verdict

**ACCEPT `2dcc68a`.** T171-D2 is fixed on SIA's real note shape. r3b holds on today's `origin/master` merged in.
Nothing QA 158 accepted regressed in the note paths this round touches.

- **T171-D2 holds** on C4b (the real 3,256-character T-169 note), QA 158's fallback shapes, the one-word
  single-line edit, and five additional character-boundary rows (first char, last char, append-only,
  whitespace-only, multi-byte UTF-8).
- **r3b holds** on the merge with `origin/master` (`7243fd5`): the live record parses, missing `note_by`
  loads as `null`, `readState` does not write the file, and a write adds `note_by` only on a task an op
  touched.
- **QA 158 preserve holds:** D1 authorship, the refusals, the three D3 rows, and dry-run/write reporting
  are unchanged and pass locally (`state-writer-notes.test.ts` 23/23, `server.test.ts` 30/30).
- **Mutants:** two of this seat's mutants are killed on tcm; a third is killed locally only (budget).

No merge-blocking defects.

## The dispatch's items

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | **T171-D2, done properly** | **Holds.** The REPLACED line quotes from the **first differing character** (120 chars). **C4b:** the real T-169 note (3,256 chars, one line); a replace keeping the first 200 chars quotes `old.slice(200, 320)`, beginning `.ai/artifact/…`, not `Session 78, planner…`; that substring is absent from the new note. **QA 158 fallback:** `retry\nok\nretry` → `retry\nok` quotes `"\nretry"`; `one\nt\nthree` → `one\nthree` quotes `"\nthree"`; neither quotes kept first lines. **One-word:** a single-line note with the changed word past char 120 quotes from that word. **Extra rows** (`probe-d2.mjs`): first-char (`Alpha` vs `alpha`), last-char (suffix `a`→`b` at index 150), append-only (`no text removed`), whitespace (`xx yy`→`xxyy` quotes `" yy"`), multi-byte (`café`→`cafe` quotes from `é`). | `state-writer-notes.test.ts`; `docs/loops/qa-177/probe-d2.mjs` |
| 2 | **r3b** | **Holds on merge with `origin/master`.** `origin/master`'s `.agents/state.json` (rev 135) has no `note_by` keys; `parseState` succeeds with every task's `note_by === null`. `readState` leaves bytes unchanged. `set_objective` writes without adding `note_by` to untouched tasks; `update_task` on one task sets `note_by: null` on that task only. Merged tree `qa/t171-r3-merge` @ `55e389c`: full suite **1450 passed, 2 skipped** on tcm (`36307380691`). | `state-schema.test.ts` r3b row; `state-writer-notes.test.ts` r3b row; tcm merge run |
| 3 | **Preserve QA 158** | **Holds.** All 23 note-file rows pass, including T171-D1 (C2h shape), T171-D3 (three mutant-killing rows), refusals, append/replace reporting, and dry-run parity. `server.test.ts` dry-run REPLACED line row passes. | local vitest on `2dcc68a` |
| 4 | **My mutants** | **3 run; 3 killed** (2 on tcm). See Mutants. | local `mutants.mjs`; tcm |

## Check detail

**Scratch.** Probes and mutants used `TEMP=TMP=C:\qa-tmp`. The merge branch `qa/t171-r3-merge` is
`2dcc68a` merged with `origin/master` (`7243fd5`), commit `55e389c`, pushed and read back. No live
`state.json` was written.

**C4b quote (verified).** Old note begins `Session 78, planner, on Aaron's word…`. Replace keeps
`T169.slice(0, 200)` and appends the ADDITION fixture. First differing index is 200. Quoted text
begins `.ai/artifact/3Kv8BuKYrj5vaKQgD8NKC7` — not the kept prefix.

**r3b on master.** Master's first task (and all 70 tasks) lack `note_by` on disk. After load,
`note_by` is `null` in memory, not `[]`. A non-note op does not materialize the key on disk for
untouched tasks.

**Local full suite (control, not scored as pass/fail).** On `2dcc68a`, 87 files collected, **1335
passed, 3 failed, 2 unhandled errors**. The three failures are environment-specific on this Windows
host (`paths.test.ts` 8.3 short-name segment; `tree-currency.test.ts` BEHIND count) and are outside
T-171 scope. All note and schema rows pass.

## Mutants

| Mutant | What it breaks | Branch / head | Local (notes+schema) | tcm | Result |
|---|---|---|---|---|---|
| `char-to-line` | Restores line-based quote (`oldLines.filter`) | `qa/t171-r3-mut-char-to-line` `e7a4a0b` | **7 failed** of 43 | `36307378222`: **7 failed** of 1338 (`state-writer-notes.test.ts`) | **KILLED** |
| `note-by-default-empty` | `note_by` default `[]` instead of `null` | `qa/t171-r3-mut-note-by-default-empty` `9a81961` | **2 failed** of 43 | `36307379372`: **2 failed** of 1338 (r3b rows in `state-schema.test.ts` and `state-writer-notes.test.ts`) | **KILLED** |
| `diff-from-end` | Quotes 120 chars ending at last differing index | (local only) | **7 failed** of 43 | not run (budget) | **KILLED** locally |

Every tcm red is an `AssertionError` in the named files. `test-windows` was **skipped** on all runs.

## CI

**Developer runs** (read via `gh run view`, matches handoff):

| Run | Ref / SHA | Result | Tests |
|---|---|---|---|
| `36301870766` | red `98c40af` | failure | **3 failed**, 1331 passed, 2 skipped (1336) — C4b, fallback, one-word |
| `36301939922` | green `993ed08` | success | **1334 passed**, 2 skipped (1336) |
| `36301993669` | mutant `e2cb991` (`loop/t171-r3-mut-d2`) | failure | **7 failed**, 1327 passed, 2 skipped |
| `36304454993` | merge with master `46cc922` | success | **1450 passed**, 2 skipped (1452) |

**This seat's runs** (3 of 6 budget; no `windows=true`):

| Run | Ref / SHA | Result | Tests |
|---|---|---|---|
| `36307378222` | `qa/t171-r3-mut-char-to-line` `e7a4a0b` | failure | **7 failed**, 1334 passed, 2 skipped — mutant killed |
| `36307379372` | `qa/t171-r3-mut-note-by-default-empty` `9a81961` | failure | **2 failed**, 1334 passed, 2 skipped — mutant killed |
| `36307380691` | `qa/t171-r3-merge` `55e389c` | success | **1450 passed**, 2 skipped — merge control |

## What could not be verified

- **GitNexus `impact` / `detect_changes`:** not run; this worktree has no `.gitnexus/` index.
- **`diff-from-end` mutant on tcm:** killed locally (7/43); not pushed to CI (budget reserved for the two protection mutants and merge control).
- **QA 158's five surviving mutants from r2:** not re-run on tcm this round; out of dispatch scope (handoff lists them under "Not this round").
- **Defender exclusions:** not confirmed from this headless seat.

## Defects

None merge-blocking.

**Low (observed, not scored):** when a whitespace-only collapse leaves a suffix that still appears in
the new note (e.g. `word one  word two` → `word one word two`), the character quote at the first
difference can name text that is also a substring of the new note. The dispatch's interior-space row
(`xx yy` → `xxyy`) does not hit this; SIA's one-line append shape does not either.

## Open for the planner

None blocking acceptance.

## Model

Composer 2.5 (Cursor), headless QA driver record 177.

QA-177: REPORT COMPLETE
