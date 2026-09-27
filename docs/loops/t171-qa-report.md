# T-171 (a note is never replaced silently), candidate `b371176`: QA report (QA seat, record session 144)

**By:** the QA seat, record session **144**, headless, launched by `docs/loops/qa-144/drive.ps1` (Claude session
`5833d79c-c073-4a45-8d21-0b05ff97d832`). 2026-09-27 (UTC). **Machine:** `DESKTOP-O4EGB1E` (`$env:COMPUTERNAME`).
**Defender exclusions** (`drive.meta`): `C:\qa-scratch`, `C:\qa-tmp`. Probes and mutants ran with
`TEMP=TMP=C:\qa-tmp`; the one full-suite control ran with the default `TEMP` (`QA_DEFAULT_TEMP`,
`C:\Users\AARONM~1\AppData\Local\Temp`, not excluded). **Model and effort:** `claude-opus-5-5` on every model field of this run's
stream (150 fields over 149 assistant entries, counted just before the commit; no other model) (`%USERPROFILE%\sia-qa144\run-0.jsonl`); effort **`high`**, read
from this process's command line (`claude.exe -p … --model claude-opus-5-5 --effort high`, pid 1948).
**Dispatch:** `docs/loops/t171-dispatch-qa.md` (tree at `46efa7e`). **Candidate:** `b371176` on `origin/loop/t171`
(handoff tip `3eddf20`, `docs/loops/` only after `b371176`), stacked on T-179 round 2 `d0335d7`. Scored: only what
T-171 adds (`git diff d0335d7 b371176`: 5 source files, 7 test files, CHANGELOG, the developer's scripts).
**Rulings used:** R171-1 and R171-2 as written in the dispatch.

## Verdict

**ACCEPT `b371176`. Nothing the dispatch named is broken: no op replaces a note without a `NOTE CHANGE` line, the bare
`note` is refused by name on both ops, `append_note` never removes a character, and the dry run and the write report
identically at the writer and at the `ob_state` door. Two Low defects in the per-session rule and the report wording,
and three real test gaps found by my mutants, should be fixed before or with the merge; none of them loses text
without a report.**

- **Holds:**
  - item 1: every path that can change a task's note is one of `open_task` (SET), `update_task` / `close_task`
    (`append_note` / `replace_note`), `reopen_task` (APPENDED). Six other op kinds, the importer (refuses once
    `state.json` exists), the migration and the render-only callers change no note. Bare `note` is refused by name,
    dry run and write, before the schema, and nothing is written;
  - item 2: sizes on every change, identical in the dry run and the write, on six note shapes and both ops;
  - `note_by`: no op and no `ob_state` argument can set it; an append adds the registered writer's uuid; the
    migration's `null` counts as another session's (replace refused without `replace_other_sessions: true`, and the
    report says `unrecorded` with it); the schema rule refuses six hand-edited shapes at load and holds after every op;
  - R171-1: both stale `/end` shapes (`close_task {id, note}`, `update_task {id, status, note}`) are refused through
    `ob_state` with a message naming `append_note` and `replace_note`, and "Nothing written";
  - the T-169 shape on SIA's real T-169 (3,256 characters, migrated from master rev 133): the bare `note` and the
    unflagged replace are refused, `append_note` keeps it, and the session's own replace is reported with sizes;
  - the full suite, **1327/1327** with Defender on; the developer's red and green runs and two of their mutant runs,
    read per test, match the handoff.
- **Defects (all Low):**
  - **T171-D1:** a flagged `replace_note` that removes nothing (a superset) resets `note_by` to the writer alone.
    The previous authors' text is still in the note, so the schema's own definition of `note_by` is false, and the
    same session's next replace removes that text **with no flag** and no "text by other session(s)" clause. Fix:
    one line in `replaceNote`;
  - **T171-D2:** the REPLACED line's `removed text begins: "…"` quotes the old note's first line even when the new
    text keeps that line (a prefix-keeping edit), so it names text that was not removed;
  - **T171-D3 (test gaps):** three of my six mutants survive the full suite on tcm and are **not equivalent**:
    `dry-run-hides-replace` (the door's dry run drops only the REPLACED line), `removes-by-length` and
    `superset-foreign-unflagged`. The last one is D1 made flagless: a one-token regression that lets any session take
    over and then erase another session's note would pass CI.
- **Known limit, not T-171's:** `note_by` is only as good as the registration. A second session in the same checkout
  that registers the first one's uuid replaces its note with no flag (C2i). That is R179-2's stated limit (T-003),
  not a new defect; it is written down so nobody reads `note_by` as more than it is.

## The dispatch's checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | **Nothing replaces a note silently** | **Holds.** The only writes of `t.note` in `src/` are in `state-writer.ts` (`appendNote`, `replaceNote`, `open_task`); the importer and the migration build notes, and the importer refuses when `state.json` exists (`state-import/index.ts:797, 856`). Bare `note` refused by name on both ops, dry run and write, and before the schema when given with `append_note`; six near-miss field names are refused as unrecognized, not ignored. `append_note` keeps every character on six shapes × two ops. Dry run and write: identical `note_changes`, and the dry run leaves the bytes alone. | C1a-C1i in `c-attack.out` |
| 2 | **`note_by`, attacked** | **Holds on all four questions,** with D1. (a) No op can set it (`Unrecognized key: "note_by"` on all four task ops), and `ob_state` ignores `note_by`/`session_uuid` arguments. (b) An append adds the writer's registered uuid (`[A]` + B → `[A, B]`), and null stays null. (c) The migration's null is foreign. (d) The rule (`[]` exactly when the note is empty) is refused at load in five broken shapes plus a missing key, and holds after `open_task ""`, an unregistered `open_task`, and a replace to `""`. **But** a flagged superset replace drops the old authors (**D1**). | C2a-C2i |
| 3 | **Every caller** | **Each updated or unaffected, re-derived.** `git grep` for `update_task\|close_task` outside `docs/loops`/CHANGELOG: the writer, the server's description, and tests only. The repository's `.claude/commands/end.md` on this base is T-179's rewrite, and it names no op; `project-template`'s two `end.md` copies name none; `project-template/.agents/state.json` is v3 with 0 tasks and parses. The importer run on a scratch clone gives 67 tasks, all `note_by: null`. The migration of master rev 133 gives 70 of 70 notes `null`, and its change list says so. `~/.claude/commands/end.md` does **not exist on this machine**, so its lines could not be read here; its two stale shapes were tested as ops (R171-1, check 3a below). **Stale in the record, not in code:** the live handoff's watch-out ("update_task, update_gap, set_objective and set_handoff REPLACE their field") and T-171's own note's workaround (pass the note back whole with the edit inside it). See "Open for the planner" 2. | `import-draft.out`; C0 |
| 3a | **R171-1: the stale `/end` lines fail closed and name the fix** | **Holds.** Through `handleState`, dry run and write: `ob_state refused: ops[0] (close_task): \`note\` is retired on close_task (T-171): … Use append_note … or replace_note …`, `Revision: 134 (unchanged)`, `Nothing written.`, and the file's bytes are unchanged. Same for `update_task` with `status` + `note`. T-179's handoff checklist step 3 installs the new `end.md` into `~/.claude/commands/`. | C3a |
| 4 | **The T-169 shape** | **Holds: no path loses the text without being told.** On SIA's real T-169 (3,256 chars, `null` after migration): bare `note` refused; `replace_note` without the flag refused (unrecorded author); `append_note` keeps it (`+59 chars (3256 -> 3315)` in both runs). The session's own note replaced: allowed, and reported with both sizes and the first line, dry run included. Two ways the report says less than it should: D1 (the second replace does not say whose text went) and D2 (a prefix-keeping edit quotes kept text as removed). | C4, C4b, C2h |
| 5 | **My mutants** | **3 of 6 killed**, locally and on tcm, all on assertions; **3 survive both** the 8 local files and the full suite on tcm, and each is shown not equivalent (D3). | Mutants |

## Check detail

All probes run the candidate's build (`b371176`, `open-brain/build`) on a scratch clone whose record is
`origin/master`'s `state.json` (`36a33bc`, v2, rev 133, 70 tasks, sha256 `10fa61ea…`), migrated to v3 by the
candidate's own `state migrate`. Door-level rows call `handleSetSession` and `handleState`, with every store
(`KNOWLEDGE_V2_DB`, the active-session file, vault, logs) in scratch. Nothing touched a live `state.json`.

**C0, the migration of SIA's record:** `schema_version 2 → 3`, `revision 133 → 134`, and the new change line
`task notes: 70 non-empty note(s) get note_by null — …`. All 70 notes `null`, no `[]` (the record has no empty note).
The handoff reported 69 of 69 at rev 131; rev 133 has one task more, which is the record's growth, not the build's.

**C1d:** one batch of `update_task` (title, priority, status), `add_verified`, `add_gap`, `add_decision` (its own
`note` is a decision's, not a task's), `set_objective` and `set_handoff`: every task's `note` and `note_by` are
byte-identical after, and `note_changes` is empty.

**C1i:** a batch whose first op appends and whose second is refused writes nothing and returns no note change (the
refusal path returns `note_changes: []`).

**C2h, D1 in full.** A writes `"A wrote this."` (`note_by [A]`). B sends `replace_note: "A wrote this. B added this."`
with `replace_other_sessions: true`: reported `REPLACED: 13 chars -> 27 chars; no text removed`, and `note_by`
becomes `[B]`. B then sends `replace_note: "only B now."` **without** the flag: accepted,
`REPLACED: 27 chars -> 11 chars; removed text begins: "A wrote this. B added this."`, with no
`text by other session(s) removed` clause. The same on the migrated 776-character T-003 (null → `[B]`, then an
unflagged replace to 4 chars). The contrast row holds: after `append_note` instead, the unflagged replace **is**
refused, naming A. The code: `replaceNote` sets `t.note_by = text === "" ? [] : ctx.uuid === null ? null : [ctx.uuid]`
whether or not anything was removed. Superset replace is the realistic shape: it is T-171's own documented workaround
("read the current note and pass it back whole with the edit inside it").

**C2i, the registration limit.** In the scratch checkout, after A writes, `handleSetSession({session_id: A,
project_dir: <same checkout>})` is **accepted** and `replace_note` on A's note goes through unflagged
(`REPLACED: 38 chars -> 3 chars; removed text begins: …`). R179-2 refuses only a uuid recorded under a different
checkout, and says so in its comment. Not scored against T-171.

**C4b, D2.** The session's own 3,256-character T-169 note replaced by its first 200 characters plus the correction:
`REPLACED: 3256 chars -> 257 chars; removed text begins: "Session 78, planner, on Aaron's word ('the agent started
work and asked …"`. That quoted text is still at the start of the new note.

## Mutants

Driver `mutants-qa144.cjs` (the developer's machinery: each anchor must match exactly once and land, `tsc --noEmit`
exits 0 or the mutant is VOID, the 8 note-related test files run through vitest's JSON reporter, and the sources are
restored and hash-checked after each: `restored: true`). Then one commit per mutant on `qa/t171-mut-<id>` from
`b371176`, pushed with `push-qa.mjs` and read back, and one `workflow_dispatch` each on tcm (6, the budget), read
per test with QA 134's `ci-read.mjs` (sha256 `1a735e5e…`). The dispatch's three are the first three rows.

| Mutant | What it breaks | Branch head | Local (of 148) | tcm run | tcm red (of 1327) |
|---|---|---|---|---|---|
| **`append-as-replace`** (dispatch) | `append_note` replaces the note; the APPENDED line still carries an append's sizes | `d436ee3` | 3 | `36286216812` tcm-2 | **3**: notes "append_note adds …", notes "close_task follows the same rules …", state-writer "reopen_task … appends the note" |
| **`dry-run-hides-replace`** (dispatch, "the dry run silent") | `ob_state`'s dry run prints APPENDED/SET lines but drops every REPLACED line | `0ba9918` | **0** | `36286217950` tcm-1 | **0: SURVIVES** (1325 passed, 2 skipped). Not equivalent (below). **D3** |
| **`note-by-ignored`** (dispatch) | the refusal never reads `note_by`: any registered writer owns every note | `f0b7fb4` | 6 | `36286219442` tcm-1 | **6**: notes ×5 (the foreign, flagged, unrecorded, unregistered and close_task rows), state-import-v3 "an imported note has no recorded author" |
| `removes-by-length` | a replace "removes text" only when the new note is shorter | `89c3c77` | **0** | `36286220756` tcm-2 | **0: SURVIVES** (1325 passed, 2 skipped). Not equivalent. **D3** |
| `append-legacy-owned` | appending to an unattributed (`null`) note keys it to the appender alone | `114e6b9` | 1 | `36286222154` tcm-1 | **1**: notes "a note with no recorded author … counts as another session's" |
| `superset-foreign-unflagged` | a superset replace of another session's note needs no flag | `0e87991` | **0** | `36286223642` tcm-2 | **0: SURVIVES** (1325 passed, 2 skipped). Not equivalent. **D3** |

Every red on tcm is an `AssertionError` (each printed twice in the log, plus the step's exit line); no `TypeError`,
no timeout, no infrastructure failure; every run collected 87 files and 1327 tests (`ci-qa144.out`). The full suite
kills nothing the 8 local files missed: the local and tcm counts agree on all six.

**The three survivors are not equivalent** (`survivors.out`: the same three behaviours on the candidate's build and
on each mutant's build):

| Mutant | Candidate `b371176` | Mutant build |
|---|---|---|
| `dry-run-hides-replace` | the dry run of a replace through `ob_state` prints `NOTE CHANGE: T-009 note REPLACED: 39 chars -> 5 chars; removed text begins: …` | the dry run prints **no NOTE CHANGE line**: the T-169 finding again ("the dry run gave no sign"), at the door the agent reads. The server test checks only an APPENDED line in the dry run. |
| `removes-by-length` | own 16-char note rewritten to 44 chars without it: `…; removed text begins: "decision: ship A"` | `…; no text removed`, while the text was removed. No row replaces with a longer text that drops the old one. |
| `superset-foreign-unflagged` | B's superset replace of A's note without the flag is refused | accepted, `note_by` becomes `[B]`, and B's next unflagged replace erases A's text. No row replaces another session's note with a superset. |

## The full suite and CI

- **The one full local suite** (the Defender-on control): the candidate `b371176` built in
  `C:\qa-scratch\qa144\cand`, a full clone (`--is-shallow-repository` false), `TEMP=TMP=C:\Users\AARONM~1\AppData\Local\Temp`
  (the default, from `QA_DEFAULT_TEMP`; not excluded), 01:33:59Z-01:36:58Z: **87 of 87 files, 1327 of 1327 tests passed,
  0 skipped**, exit 0 (`fullsuite-b371176.summary`). The two rows that skip on tcm ran here. **My `c-attack.mjs`
  probe ran during it** (scratch directories only, its own stores); the suite was not otherwise shared.
- **The developer's CI, read per test by me** (`ci-dev.out`, `ci-dev-mutants.out`):
  - `36281579531`, `loop/t171` @ `b371176`, tcm-2, success: **87/87 files, 1325 passed, 2 skipped (1327)**, no error
    lines. Matches the handoff.
  - `36280808413`, `loop/t171-redcheck` @ `bc34347`, tcm-1, failure: **14 failed, 1308 passed, 2 skipped (1324)**,
    2 of 87 files; 28 `AssertionError` lines and the step's exit line, nothing else. The 14 are the 13 rows of
    `state-writer-notes.test.ts` and the server's NOTE CHANGE row. The T-169 row fails with
    `expected 'Correction: README.md is rewritten to…' to be 'T-169 ORIGINAL: at Loop 15 close, rew…'`, i.e. by
    losing the text.
  - `36281651066` `migrate-owned` (tcm-1): 2 failed, 1285 passed, 8 skipped (1295), 3 failed files; `36281654627`
    `import-owned` (tcm-2): 46 failed of 1327. Both as the handoff describes. The other 15 mutant runs were not read.
- **My CI:** six runs on tcm (budget 6), all `workflow_dispatch` on `qa/t171-mut-*` with `hosted=false`,
  `windows=false`; no laptop or hosted job. No run for the candidate itself: the developer's green run is its record,
  and my local full suite agrees.

## What could not be verified

- **`~/.claude/commands/end.md`** (Aaron's global copy) does not exist on this QA PC, so I could not read its lines
  121-123. I tested the two shapes the handoff quotes as ops through `ob_state` instead (C3a).
- **GitNexus `impact` / `detect_changes`** and the MCP server: not available to this seat (dispatch). Callers were
  re-derived by `git grep` and a search of `src/` for writes of a task's note (check 3).
- **A real MCP reconnect** with the new schema: not run. The door was exercised by calling the exported handlers.
- The developer's other 15 mutant runs, and their local mutant evidence, were not re-read.

## Defects

| Id | Severity | Defect | Where | Fix |
|---|---|---|---|---|
| **T171-D1** | Low | A flagged `replace_note` that removes nothing resets `note_by` to `[writer]`, so the previous authors' text is in the note but not in `note_by` (the schema's docstring: "the sessions whose text is in `note` now"). The same session's next replace then removes that text **without** `replace_other_sessions` and without the "text by other session(s)" clause (C2h). Null (unrecorded) authors are laundered the same way. Every step is still reported with sizes; the flag was named once. | `state-writer.ts` `replaceNote`, the `t.note_by = …` line | When `!removes && old !== ""`, keep the old authors and add the writer, as `appendedBy` does: `t.note_by = text === "" ? [] : removes ? (ctx.uuid === null ? null : [ctx.uuid]) : appendedBy(t.note_by, old, ctx.uuid)`. Pin it with the C2h row. |
| **T171-D2** | Low | `removed text begins: "<old first line>"` is printed whenever anything is removed, even when the first line is kept, so the report can name text that is still there (C4b). | `replaceNote`, `firstLine` | Quote the first line of the old note that the new text does not contain (or the first differing position), or reword to `old text began: …`. |
| **T171-D3** | Low (test gap) | Three mutants survive the full suite on tcm (`36286217950`, `36286220756`, `36286223642`) and are not equivalent: `dry-run-hides-replace` (the door's dry run of a **replace** is never checked), `removes-by-length` (no longer-but-different replacement row), `superset-foreign-unflagged` (no superset replace of another session's note; this one is D1 without the flag). | `server.test.ts`, `state-writer-notes.test.ts` | Three rows: the server's dry run of a `replace_note` prints the REPLACED line; a longer replacement without the old text reports `removed text begins`; a superset replace of another session's note is refused without the flag and, with it, keeps the old author in `note_by` (D1). |

## Disagreements

- **With the handoff's section 1 on a superset replace.** The design treats a replace that removes nothing exactly
  like one that removes everything for ownership (the writer becomes the sole author). The handoff's own definition of
  `note_by` ("the uuids of the sessions whose text is in the note") says otherwise. D1.
- **Minor, with the handoff's section 1 wording** "Unknown counts as foreign, so an unregistered write owns nothing":
  true for replacing, but an unregistered write's `open_task` and `replace_note` to text produce `null`, which is
  "unknown", not "nobody". That is consistent with the schema rule; it is noted only so the phrase is not read as
  "unregistered writes cannot write notes" (they can: C2g).
- None with R171-1 or R171-2.

## Error entries

- **My git identity.** The first attempt to commit the six mutant branches failed ("Author identity unknown": the
  scratch clone had no `user.name`). The loop kept going, so each `--apply` landed on the previous mutant's dirty
  tree and all six edits stacked in the working copy. Nothing was committed or pushed in that state. I reset hard to
  `b371176`, set the identity QA 134 used (`QA N (Claude)`), and re-created each branch from a clean `b371176`; each
  branch's diff against `b371176` is one file, one edit (checked with `git diff --shortstat`).
- **`state show <dir>`** read the enclosing repository's v2 record instead of `project-template`'s, and refused
  with `expected 3`. I checked the template with `parseState` directly instead. Not the candidate's concern; noted
  so the refusal is not read as a template defect.
- **A `sed` replacement** turned `\U…\L…` in a Windows path into case conversions in one evidence header; rewritten
  with node before commit.
- **The full-suite control overlapped my probe run** (see above); the control stands, but it was not run alone.

## Open for the planner

1. **D1, D2 and D3 before or with the merge?** None loses text without a report, so none blocks in my verdict. My
   recommendation: fix D1 (one line) and add D3's three rows in the same round, because `superset-foreign-unflagged`
   shows a one-token change would make D1 flagless and CI would stay green. D2 can ride with it or be dropped.
2. **The record's own text goes stale at merge.** The live handoff's watch-out (`next-session.md` line 31: "update_task,
   update_gap, set_objective and set_handoff REPLACE their field …") and T-171's note's workaround ("pass it back whole
   with the edit inside it") describe the retired behaviour. The workaround now needs `replace_other_sessions: true`
   on every migrated note, and it triggers D1. Worth replacing in the close-out.
3. **After merge, every one of SIA's 70 notes is `null`** (C0), so any replace needs the flag. That is the handoff's
   stated intent; noted because an agent that meets the refusal on its first `/end` will reach for the flag, and the
   flag is the only thing standing between it and a wholesale replace.
4. **The registration limit (C2i)** makes `note_by` exactly as strong as R179-2. If T-003 is fixed, this inherits the
   fix; nothing to do in T-171.

## Reproduce

Scripts in `docs/loops/qa-scripts-t171/`, outputs in `…/evidence/`. Scratch root `C:/qa-scratch/qa144`: `cand/` (the
candidate, full clone, built), `mut/` (mutant branches), `live-master.json` (`origin/master:.agents/state.json` at
`36a33bc`, sha256 `10fa61eafbe8ae0f8a75f4692091591a248056fe8c61c65abd92867a2d2f6234`).

```
node c-attack.mjs      C:/qa-scratch/qa144/cand C:/qa-scratch/qa144 C:/qa-scratch/qa144/live-master.json
node survivors.mjs     <open-brain root of a build> <scratch dir>        # candidate, then each surviving mutant, built
cd <clone>/open-brain && node mutants-qa144.cjs <outdir> [id ...]        # local; --apply <id> for a branch
node ci-read.mjs       <run-id> ...
```

## Branches pushed

Through `push-qa.mjs` only, each read back: `qa/t171-mut-append-as-replace` `d436ee3`,
`qa/t171-mut-dry-run-hides-replace` `0ba9918`, `qa/t171-mut-note-by-ignored` `f0b7fb4`,
`qa/t171-mut-removes-by-length` `89c3c77`, `qa/t171-mut-append-legacy-owned` `114e6b9`,
`qa/t171-mut-superset-foreign-unflagged` `0e87991`, and `qa/t171-report` (this report). No PR, no `/end`, no live
`state.json` written.

QA-144: REPORT COMPLETE
