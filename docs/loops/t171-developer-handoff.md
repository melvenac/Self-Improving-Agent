# T-171 developer handoff: a note is never replaced silently (Forge, record 140)

**By:** Forge (developer), record session **140**, 2026-09-26, a fresh session after `/clear` (D-035),
in `~/Worktrees/sia-infra`. **To:** Atlas (planner, record 109) and QA. **Brief:**
`docs/loops/t171-note-replace-brief.md` on `origin/docs/session-100-qa99-dispatch`, plus T-171's note in
`.agents/state.json` and QA 125's D4 (`origin/qa/t179-report`, `docs/loops/t179-qa-report.md` line 338).
**Model and effort, from this session's transcript:** `claude-opus-5-5`, effort **`medium`** on every
assistant entry that carries the field: **246 of 246 (of 246 assistant entries; models: claude-opus-5-5)**, counted from
`~/.claude/projects/C--Users-melve-Worktrees-sia-infra/9167e785-….jsonl` immediately before the handoff
commit. (The harness's task directory for this process is keyed `78725e06-…`. That is the pre-`/clear`
process's earlier transcript, 06:20Z-07:45Z, and it is not this session's.)

**Candidate for QA:** `loop/t171` @ **`b371176`**. The handoff commit on top changes only `docs/loops/`.
Stacked on `origin/loop/t179-r2` `d0335d7`. No rebase, no force. `/end` was not run.

## 1. The design, and why

| Brief item | What was built | Why this and not the alternative |
|---|---|---|
| 1. append and replace are distinct and named at the call | `update_task` and `close_task` take **`append_note`** or **`replace_note`**. **`note` on either op is refused by name** (`RETIRED_FIELDS`, checked before the schema), and the message names both replacements. Giving both fields is refused. | **Fields, not separate ops.** The note edit usually rides with a status change or a close in the same op. Separate `append_note`/`replace_note` ops would split one intent across two ops, and a close would need a second op to carry its note. The destructive one is still named at the call site, which is what T-171's option (b) asked for. It is structural, not a report. A required `mode` field was rejected: `mode: "replace"` is one token away from `mode: "append"` and reads the same in a diff. **`note` was retired, not re-meant.** Making `note` mean "append" would silently change what every existing caller's op does. A refusal cannot be misread. |
| 2. dry run and write report every note change, with sizes | `WriteResult.note_changes`, filled inside the op, so the **dry run and the write produce identical lines**. `ob_state` prints each as `NOTE CHANGE: …`. Shapes: `T-n note SET: 0 -> N chars` (open_task), `T-n note APPENDED: +N chars (A -> B)`, `T-n note REPLACED: A chars -> B chars; removed text begins: "<first line, ≤120 chars>"`, or `…; no text removed` when the new text contains the old. | A field of its own rather than `notes[]`, because `notes[]` means "the writer did something other than what was asked", and a note change is exactly what was asked. |
| 3. `close_task` follows the same rule | Same two fields and the same checks. `reopen_task` keeps its `note` (it always appended) and now reports the append. | — |
| 4. another session's note cannot be replaced unnamed | **Tasks carry `note_by`**: the uuids of the sessions whose text is in the note, `[]` for an empty note, **`null` when any of it has no recorded author**. Replacing text by any session other than the writer's, or text with no recorded author, is **refused unless the op sets `replace_other_sessions: true`**. With the flag it proceeds, and the report ends `; text by other session(s) removed: <uuids or "unrecorded">`. The schema holds `note_by` to `[]` **exactly** when the note is empty. | **Refuse by default, with a named override.** That satisfies both halves of the brief's "refusing outright is also acceptable". A refusal alone would leave no way to correct a wrong note except a new task. **Why a new field:** schema v3 had no per-note key, so "written by another session" was not answerable from the record. v3 is not on master (master is v2), so the field goes into v3 with **no new schema version**, and the v2→v3 migration and the importer set it. **Unknown counts as foreign**, so an unregistered write owns nothing. |

**Consequence for SIA's own record at merge:** migrating a **scratch copy** of `origin/master`'s
`state.json` (7640b93, rev 131) with this build gives **69 tasks, all 69 notes `note_by: null`**. It parses
at v3 (`dev-scripts-t171/evidence/migrate-live-copy-origin-master-7640b93.txt`). So after the merge **no
existing note can be replaced without `replace_other_sessions: true`**, and `append_note` works on all of
them. That is the intended behaviour, stated here so it is not a surprise. The live `state.json` was never
written.

## 2. Every caller (item 5), found by search

Searched: `git grep -E "update_task|close_task"` over the tracked tree, plus a filesystem grep of the
untracked `.claude/`, `project-template/`, `.agents/SYSTEM`, `.agents/roles`, `.agents/skills`, `docs/`
(outside `docs/loops/`), `~/.claude/commands`, `~/.claude/skills` and `~/docs`.
Validated as able to hit: it found the writer's own definitions and CHANGELOG's v0.30 entry.

| Caller | Status |
|---|---|
| `open-brain/src/shared/state-writer.ts` (op schema, `applyOne`) | **Changed** (the fix). |
| `open-brain/src/server.ts` `ob_state` description and output | **Changed**: the description names `append_note`/`replace_note`/`replace_other_sessions`, and the output prints `NOTE CHANGE:` lines. |
| `open-brain/src/pipelines/state-import/index.ts` (builds tasks directly) | **Changed**: sets `note_by` (`null` for a written note). Imports no ops. |
| `open-brain/src/pipelines/state-migrate/index.ts` (v2→v3) | **Changed**: sets `note_by`, and the change list says how many notes got an unknown author. |
| `open-brain/src/pipelines/sync/checks-state.ts`, `state-import` `runCommit` | **Unaffected**: both call `applyStateOps` with `ops: []` (render only). The only change they see is the new `note_changes` field in the result, and they ignore it. |
| Tests: `state-writer.test.ts` (5 rows), `server.test.ts` (1), `state-views.test.ts` (2 inline tasks), fixture `tests/fixtures-state/state.json` (27 tasks) | **Changed** to the new fields. Each old `note` row keeps its original assertion: `T-008` (empty note) uses `replace_note`, the two refusal rows use `append_note`, and the two `close_task` rows that replaced a legacy note use `replace_note` + `replace_other_sessions: true`. |
| `session-order.test.ts` | Unaffected: `close_task` with no note. |
| `docs/loops/dev-scripts-t179-r2/mutants-r2.cjs` | Unaffected: it mutates the writer and passes no note ops. |
| `CHANGELOG.md` v0.30 entry (line ~1413) describing the old ops | **Historical, left as written.** The new entry is under 0.44.3-unreleased. |
| `.agents/SYSTEM/SUMMARY.md` line 14 ("reopen_task … the note appended") | Unaffected, and still true. |
| **`~/.claude/commands/end.md` lines 121-123** (`close_task {id, note?}`, `update_task {…, note?}`) | **NOT CHANGED: it is outside this repository.** After the merge these two lines describe a refused field. An agent following them gets a refusal naming the fix, which fails closed. T-179 is replacing `/end`. **The planner's call** whether that file is edited or left for T-179. |
| `project-template/.claude/commands/end.md`, `project-template/.cursor/commands/end.md` | Checked: neither names `update_task`/`close_task`. |
| `docs/loops/*` (8 files) | Historical briefs and reports; not callers. |
| `add_decision.note`, `open_task.note` | Not a replacement path: both create a new record. Unchanged. |

## 3. Red first, on tcm (the T-169 shape)

`bc34347` = the new tests only, against the unchanged writer. Pushed as `loop/t171-redcheck`.

| Where | Result |
|---|---|
| local, `state-writer-notes.test.ts` | 13 failed, 1 passed (14). **The T-169 row fails by losing the text:** `AssertionError: expected 'Correction: README.md is rewritten to…' to be 'T-169 ORIGINAL: at Loop 15 close, rew…'`. The row that passes is "an op that does not touch the note reports no note change", which was true before. |
| **tcm, run `36280808413`**, runner `tcm-1` | **RED as intended: 14 failed, 1308 passed, 2 skipped (1324); 2 of 87 files.** The 14 are exactly the new rows (13 in `state-writer-notes.test.ts`, plus the `server.test.ts` NOTE CHANGE row). The T-169 row fails on tcm with the same lost-text assertion. Error lines: 28 `AssertionError` (each printed twice), **0 `TypeError`, 0 timeouts**. Evidence: `dev-scripts-t171/evidence/ci-red-36280808413.txt`. |

## 4. Green

| Where | Result |
|---|---|
| local, `tsc --noEmit -p .` on `b371176` | exit 0 |
| local, state families only (`tests/shared`, `state-views`, `state-migrate`, `state-import*`, `server`, `session-start`, `sync`) | **46 files, 700 passed.** Not the full suite (the brief says no full local suite). |
| **tcm, run `36281579531`** on `loop/t171` @ `b371176` | **GREEN: 1325 passed, 2 skipped (1327); 87 of 87 files**, runner tcm-2, 0 errors. Run `36281579531`, head `b371176`. The 2 skips are the same two as on the redcheck. |

## 5. A mutant per protection

Driver: `docs/loops/dev-scripts-t171/mutants-t171.cjs`, the same machinery as round 2's. Each edit must
match its anchor exactly once and land; `tsc --noEmit` must exit 0 or the mutant is VOID; files are
restored and hash-checked after each mutant. Local runs cover the 8 test files that touch the record.

**Local: 17 of 17 KILLED** (`evidence/mutants-local-summary.json`; `foreign-allowed` rerun in
`evidence/mutants-local-foreign-allowed.json`, see below). **tcm: every mutant pushed as
`loop/t171-m-<id>` from `b371176` and run on the full suite:**

| Mutant | Head | tcm run | Runner | Red / total | AssertionError / TypeError+timeout lines | Note |
|---|---|---|---|---|---|---|
| `bare-note-update` | `018ebdf` | `36281592035` | tcm-1 | **1** / 1327 | 2 / 0 |  |
| `bare-note-close` | `20165a3` | `36281595338` | tcm-2 | **1** / 1327 | 2 / 0 |  |
| `append-unreported` | `99903ab` | `36281598398` | tcm-1 | **4** / 1327 | 8 / 0 |  |
| `replace-no-first-line` | `676677d` | `36281601736` | tcm-1 | **2** / 1327 | 4 / 0 |  |
| `replace-sizes-wrong` | `592b7ef` | `36281605662` | tcm-1 | **4** / 1327 | 8 / 0 |  |
| `dry-run-silent` | `31b6116` | `36281609856` | tcm-2 | **3** / 1327 | 6 / 0 |  |
| `server-silent` | `a1659fb` | `36281614558` | tcm-2 | **1** / 1327 | 2 / 0 |  |
| `foreign-allowed` | `372197a` | `36281619067` | tcm-1 | **4** / 1327 | 8 / 0 |  |
| `legacy-is-mine` | `2402131` | `36281623806` | tcm-1 | **2** / 1327 | 4 / 0 |  |
| `unregistered-is-mine` | `8eec8b0` | `36281628445` | tcm-2 | **1** / 1327 | 2 / 0 |  |
| `note-by-invariant-off` | `518351c` | `36281633094` | tcm-2 | **1** / 1327 | 2 / 0 |  |
| `replace-keeps-authors` | `6fa57e9` | `36281637239` | tcm-2 | **3** / 1327 | 6 / 0 |  |
| `append-unkeyed` | `c6b6f17` | `36281640809` | tcm-1 | **1** / 1327 | 2 / 0 |  |
| `open-unkeyed` | `a4e0dda` | `36281644086` | tcm-2 | **2** / 1327 | 4 / 0 |  |
| `both-fields` | `373b667` | `36281647526` | tcm-1 | **1** / 1327 | 2 / 0 |  |
| `migrate-owned` | `b06b335` | `36281651066` | tcm-1 | **2** / 1295 | 2 / 0 | plus 2 FAILED SUITES that migrate the repository's own record and refuse at load: `migrated result does not validate at tasks.0.note_by` (hence 1295 collected) |
| `import-owned` | `3078773` | `36281654627` | tcm-2 | **46** / 1327 | 62 / 0 | the new schema rule refuses every import whose notes the mutant keys to nobody |

**17 of 17 RED on tcm**; none survived, and **0 `TypeError`, 0 timeouts in any run.** Fifteen are red on `AssertionError` alone. The two exceptions are the new schema rule refusing loudly, as designed. **`import-owned`**: the failure bodies are 27 `AssertionError` and 11 `Error: .agents/state.draft.json does not validate at tasks.0.note_by: note_by must be [] exactly when note is empty — nothing written`; vitest groups identical errors, so the 46 tests share 38 bodies. **`migrate-owned`**: 2 failed tests. The migrate row fails on an `AssertionError`. A `greeting-size` row (T183-3) fails with the refusal below. There are also 2 failed suites (`state-render.test.ts`, and `greeting-size`'s T183-4 block): each migrates the repository's own `state.json` and refuses at load with `migrated result does not validate at tasks.0.note_by: note_by must be [] exactly when note is empty`. That is why 1295 tests were collected, not 1327. The same two suites are green on `b371176`, which is a second, independent reading that SIA's real record migrates under the fix. Evidence: `dev-scripts-t171/evidence/ci-runs.tsv` (per-run counts; the AssertionError column counts log lines, and each is printed twice).

**What the mutants found, which is the part worth reading:**

- **`unregistered-is-mine` SURVIVED at first.** It removed `ctx.uuid === null ||` from the foreign test, and no
  row noticed, because **the clause was dead code**. With a `null` uuid, `note_by.filter(u => u !== uuid)`
  keeps every author, so a non-empty note was already foreign. The one state where it mattered, a
  non-empty note with `note_by: []`, is unreachable through the ops but writable by hand. **Fix: the schema
  now refuses that state** (`note_by` is `[]` exactly when the note is empty; new `state-schema.test.ts`
  row), the dead clause is gone, and the mutant was re-aimed at the filter, where it is killed. A new
  `note-by-invariant-off` mutant covers the schema rule.
- **Two mutants were VOID on `tsc`** (TS2339: a narrowed type became `never`), and `foreign-allowed` was
  VOID twice. They were rewritten as type-valid edits before counting. None was counted while VOID.

## 6. `/sync`, impact, and what was not run

- **`/sync` (`sync --check`) on this tree: 21 passed, 4 warnings, 3 issues, 4 skipped, before and after
  the change, with the same three issues:** `retirements` (ENTITIES.md names dream and reflection queue),
  `mirror-parity` (the `end.md`/`sync.md` mirrors), and `state-schema` (this tree's record is v2 and this
  build is v3, as on the base). **None of the three was introduced here, and none was fixed here.**
  They are named so a reader can check that rather than take it on trust.
- **GitNexus `impact` was HIGH** for both `applyOne` and `applyStateOps` (6 upstream symbols, 3
  processes). **The index is in the main checkout and was 113 commits behind**, so the call sites were
  re-derived by `git grep`. They match the table in section 2. `detect_changes` was not run: this tree
  has no `.gitnexus/`, and the stale main-tree index would have compared the wrong tree.
- **Not run:** the full suite locally (brief); the Windows runner.

## 7. Limits and siblings, stated

- **`replace_other_sessions` is all-or-nothing.** It does not name *which* sessions the caller expects
  to overwrite. A compare-and-swap form (`replacing: [uuid…]`, refused when the record's authors differ)
  would catch a third session writing between a read and a replace. It was considered and not built.
- **Authors are uuids only.** An append by an unregistered write makes the note's authors unknown
  (`null`) until a registered session replaces it with the flag.
- **The class is wider than tasks — sibling findings, not fixed here:** **`update_gap` replaces
  `what`/`evidence`/`recommended_update` wholesale, and nothing reports it.** That is the same defect on
  gaps (G-010's family; `ADR-021` made gaps amendable). `set_objective` replaces the objective, but that is
  its whole purpose, and the old text is one line in the rendered view. **Planner's ruling needed on
  whether `update_gap` gets T-171's treatment.**
- **Near-misses this session, by family, not numbered:** `git show ref:path` mangled by MSYS in the Bash
  tool. It is a listed watch-out and I hit it anyway on the live-copy migration; it failed loud, and I
  redid it in PowerShell. Two type-invalid mutants caught by the `tsc` gate.

## 8. Branches pushed (all read back with `ls-remote`: 19 refs)

`loop/t171` (`b371176`, then the handoff commit), `loop/t171-redcheck` (`bc34347`), and 17 ×
`loop/t171-m-<id>`. Nothing else was pushed. No PR was opened. Merging is Aaron's (D-019).
