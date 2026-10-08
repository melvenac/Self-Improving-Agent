# QA 292 (s164e): #489 END-FIX r3

## Verdict

| PR | Pinned head | Verdict | Blocking | Other findings |
|---|---|---|---|---|
| #489 END-FIX r3 | `854c6ced526e1e63f998bcafd8c1384068fb0c70` | **REJECT** | **S1 (Medium-High)**: on the **new layout**, E4's "record changed" hash covers `state.json`'s `revision`. So **any** revision bump after `ob_end` clears the `WORK AFTER /end` marker. That includes re-saving an identical handoff (row 3 requires that this does NOT clear it), an unrelated `ob_state` op, and **a merge that brings in another session's record write**. Reproduced on POSIX and Windows paths | **S2 (Medium)**: row 7's two mutants (line endings ignored in one direction only; the file path hashed instead of the bytes) **survive every END-FIX test**. On the real path, each one brings back a wrong result: M1 loses the marker on the sweep shape in a CRLF repo, and M2 never clears it after a real record update. **S3 (Low)**: on an old-layout repo, the no-proof `RECORD NOT CHECKED` (the Cursor shape) has no `OLD LAYOUT` line |

The sweep shape that QA 291 rejected (R1) is fixed on both layouts and on Windows. R2–R8 pass. The regression rows pass,
and so does #498's `/bootstrap` L1 path on the merged head. The REJECT rests on row 3's second half: on the new layout,
re-saving identical content clears the marker. #489 changes `open-brain/src`, so its merge is Aaron's word. It gates
the Makerspace import, so the import stays gated.

## Method and environment

- **QA:** QA 292, record session 164, prefix `s164e`. Headless Claude Code (Opus) on the laptop: Windows 10 Pro
  10.0.19045, Node v22.23.2.
- **Dispatch tree:** `git -C C:/qa-scratch/qa292-wt log -1 --format=%H` → `c8c128696f31975ec1489f448944270694e0d32c`.
- **Pin:**
  - `gh pr view 489` gives `854c6ced526e1e63f998bcafd8c1384068fb0c70` (`loop/end-fix`, OPEN, MERGEABLE). That equals the pin.
  - I checked again just before writing this report, and it was unchanged.
- **Trees:**
  - `C:/qa-scratch/qa292-pr489`: detached at the head, built (`build stamped 854c6ce`).
  - `qa292-q291`: QA 291's report commit `6561ae33`, read-only, for its scripts.
  - `qa292-m1` and `qa292-m2`: the row 7 mutants.
  - The QA clone was not checked out, reset, cleaned or edited.
- **Isolation:** every command went through `docs/loops/qa-292/s164e/run.mjs` or `lib.mjs`. They are QA 291's scripts,
  re-rooted to `C:/qa-tmp/qa292`. They set:
  - `TEMP` and `TMP` to `C:\qa-tmp\qa292\tmp`;
  - `HOME` and `USERPROFILE` to `C:/qa-tmp/qa292/home`;
  - `KNOWLEDGE_V2_DB`, one directory per scenario under `C:/qa-tmp/qa292/db/`, so each scenario has its own END-FIX store;
  - `OPEN_BRAIN_ACTIVE_SESSION`, `_SCORE_HISTORY`, `_SHADOW_LOG` and `_VAULT_DIR`, all under `C:/qa-tmp/qa292`;
  - `npm_config_cache` under `C:/qa-tmp/qa292`.

  `CLAUDE_CODE_SESSION_ID` is cleared. All fixture repos are under `C:/qa-tmp/qa292/repos/`.
- **What I did not touch:**
  - No live `state.json`, the real knowledge DB, the real open-brain data dir, a real vault or a settings file was written.
  - No Jev call was made, and no key was printed.
  - `gh` was used only to read.
  - No hub room or developer report was read.
- **How it was driven** (as QA 291 did):
  - `ob_end`, `ob_state` and `ob_start` run on the real MCP server (`node build/server.js`, SDK stdio client), with a
    session proof for the driver's pid.
  - SessionEnd is `node build/cli-session-end.js`. The greeting is `node build/cli-bootstrap.js`, run twice.
  - `--win` re-runs a scenario under these conditions:
    - a spaced path (`…\repos\win space\…`);
    - `core.autocrlf=true`;
    - CRLF prose and a CRLF transcript;
    - backslash `project_root`, `transcript_path` and `CLAUDE_PROJECT_DIR`.
- **Narrow:**
  - `tsc --noEmit` exit 0, and `npm run typecheck:tests` exit 0.
  - One test file per vitest run, on Windows, all green on the head:
    - `end-fix-r3-pins` 4/4;
    - `end-fix-q6` 4/4;
    - `end-fix-r2-pins` 4/4;
    - `shared/handoff-guard` 17/17.

  CI's `test-windows` job was skipped on every run, so these are the only Windows test results.
- **Scripts:** `docs/loops/qa-292/s164e/` on this branch. Each file's header says what changed from QA 291's. Run
  `node multi.mjs [--win] [QA_OB=<tree>] <script> <scenario…>`. The scripts expect to live in `C:/qa-tmp/qa292/s164e/`.

## Unsandboxed commands

Unsandboxed commands: none.

## Row 1: confined and current. PASS

- The head `854c6ced` has two parents: `ffe65478` (r3) and `1bbf2a5d` (master).
- `git merge-tree --write-tree ffe65478 1bbf2a5d` gives tree `c46c2884`. Its only conflict is `CHANGELOG.md`, and
  `db-v2.ts` and `server.ts` auto-merge.
- `git diff --stat c46c2884 854c6ced` lists **`CHANGELOG.md` only** (+1/−3). That diff removes the conflict markers and
  keeps both entries: END-FIX r3 and r2 first, then IMPORT-CMDS. It is a union.
- So, apart from master's changes, the head equals `ffe65478` plus the CHANGELOG union. **No other change.**
- For information, the r3 delta (`f59d03bc..ffe65478`, two commits `80d8e6ee` and `ffe65478`) touches:
  - `CHANGELOG.md`;
  - `cli-session-end.ts`, `server.ts` (+2), `end-record-guard.ts`, `end-record-store.ts` (+7 comment) and
    `handoff-guard.ts`;
  - the q6, r2-pins, r3-pins (new) and handoff-guard tests.

  All of it is END-FIX.

## Row 2: mutant runs. PASS

These rows come from `mut-topo.mjs` and `ci-reds.mjs`, both read-only.

| Run | Branch / sha | Parent | Mutant (src diff, verified) | Red tests, and nothing else |
|---|---|---|---|---|
| 37690327062 | `loop/end-fix` `854c6ced` | n/a | the head | `test` **success** (`test-windows` skipped) |
| 37679380638 | `loop/end-fix` `ffe65478` | n/a | r3 | `test` **success** (`test-windows` skipped) |
| 37679939754 | `end-fix-mut-r3-hash` `2c4d2ea6` | `ffe65478` | `recordContentChangedSinceStamp` returns `true` if `git log --since=<ob_end_at>` touches state.json or next-session.md, which is r2's commit-touch logic | q6 "old layout: git add -A … (R1 sweep)", q6 "new layout: set_handoff, ob_end with dirty views, git add -A … (R1 sweep)", r2-pins "M5: E4 uses content hash …". 3 failed, 2 files |
| 37680036716 | `end-fix-mut-r3-ids` `1f59af73` | `ffe65478` | the stamp branch drops `sessionWorkScanBlockedReason` and falls back to `[session uuid]` when the transcript has no ids | r3-pins "R2: work-after NOT RUN when transcript has no bridge session id". 1 failed |
| 37680163655 | `end-fix-mut-r3-state` `b9831af9` | `ffe65478` | the unreadable-state.json guard is removed from both hook blocks and from `checkSessionHandoff` | r3-pins "R2: unreadable state.json — hook NOT RUN for handoff and work-after". 1 failed |

- Each mutant is one commit on `ffe65478`.
- For each one, `merge-tree(parent, 1bbf2a5d):open-brain/src` = `2daa7533e2f3` = `854c6ced:open-brain/src`. So the
  parent's `open-brain/src` equals the head's, apart from master's changes.

## Row 3 (R1): the sweep shape is FIXED. **Re-saving identical content clears the marker on the new layout: FAIL (S1)**

Each scenario runs in this order:
1. commit work;
2. update the record;
3. `ob_end` (it closes);
4. one trailered commit;
5. SessionEnd;
6. two greetings.

| Scenario | After `ob_end` | SessionEnd (exact) | Greeting #1 / #2 | POSIX | `--win` |
|---|---|---|---|---|---|
| `b1n-all` (new): `set_handoff` rev 7→8; `git add -A` commits state.json, four views and `src/after.ts` | nothing | `WORK AFTER /end NOT RECORDED: 1 commit(s) since ob_end at …` | the line / none | **PASS** | **PASS** |
| `b1o-all` (old): next-session.md edited; `git add -A` commits it and `src/after.ts` | nothing | `WORK AFTER /end NOT RECORDED: …` | the line / none | **PASS** | **PASS** (next-session.md CRLF) |
| `b1n-src` / `b1o-src` (split shape, control) | nothing | `WORK AFTER /end NOT RECORDED: …` | the line / none | PASS | n/a |
| `b1n-later`: a real update | `set_handoff` with new `pick_up` (rev 8→9) | `work-after-end check: 1 commit(s) after ob_end and record updated` | none / none | **PASS** | **PASS** |
| `b1o-later`: a real update | a line appended to next-session.md | `… after ob_end and record updated` | none / none | **PASS** | **PASS** |
| `b1o-same`: identical re-save | the same bytes rewritten, mtime now | `WORK AFTER /end NOT RECORDED: …` | the line / none | **PASS** | **PASS** |
| `b1o-eol`: the same text, other line endings | LF→CRLF (POSIX) / CRLF→LF (`--win`) | `WORK AFTER /end NOT RECORDED: …` | the line / none | **PASS** | **PASS** |
| **`b1n-same`: identical re-save** | **`set_handoff` with the identical `pick_up` ("B1 new"), rev 8→9** | **`work-after-end check: 1 commit(s) after ob_end and record updated`** | **none / none** | **FAIL** | **FAIL** |
| **`b1n-other`** | `add_decision` (this session's handoff unchanged), rev 8→9 | **`… after ob_end and record updated`** | **none / none** | **FAIL** | n/a |
| **`b1n-pull`** | merge of a branch where **another session** (`cse_01QA292otherSession…`) wrote state.json rev 9. This session wrote nothing after `/end` | **`… after ob_end and record updated`** | **none / none** | **FAIL** | **FAIL** |

In every row, the marker that was written was shown exactly once. The hook prints it on stdout and stderr, and greeting
#1 shows it, as in QA 291. After every scenario, `git status --untracked-files=all` lists no END-FIX file.

**S1 (Medium-High, blocking).**
- **Cause:** for the new layout, `computeRecordContentHash` (`end-record-guard.ts:60`) hashes
  `JSON.stringify({ revision: s.revision, handoff })`.
- `ob_state` bumps `revision` on every applied batch, whether or not anything changed.
- So "content changed" on the new layout means "any `ob_state` write happened after `ob_end`".
- The row's own test fails: a re-save with identical content clears the marker.
- It also clears in two other cases:
  - **an unrelated op** (`add_decision`);
  - **a merge carrying another session's record write**, which this project does all the time on `state.json`.

  In both, the post-`/end` work is recorded nowhere, and the next greeting says nothing. That is the B1 class again,
  on the layout every SIA repo is moving to.
- The old layout is correct because its hash is the file's text with line endings normalized.
- **Fix direction:**
  - Hash only what belongs to this session's record: its `handoffs[]` entry (`pick_up`, `watch_out`, `open_questions`,
    …) and its `sessions[]` row. Leave out `revision`.
  - Or, if a different session's write must never count, compare those fields against the stamp.
  - Add a Q6 test for an identical `set_handoff` after `ob_end`, and one for a merged foreign revision.

## Row 4 (R2): PASS (`s-cannot.mjs`)

| Path | `ob_end` (first lines) | SessionEnd (exact) | POSIX | `--win` |
|---|---|---|---|---|
| `notranscript` (old layout): proof with no `transcript_path`; one trailered commit (`…session_01QA292cannotCheck…`) after `ob_end` | `OLD LAYOUT: …` / `RECORD NOT CHECKED: this session's start could not be read from its transcript, …` | `handoff check NOT RUN: this session's start could not be read …` / **`work-after-end check NOT RUN: this session's start could not be read from its transcript, so its commits cannot be told from anyone else's`** | PASS | PASS |
| `notranscript-new` | `RECORD NOT CHECKED: …transcript…` | both `NOT RUN: …transcript…` | PASS | PASS |
| `badstate`: state.json `{ not json`; one commit, then one after `ob_end` | `RECORD NOT UPDATED: … (.agents/state.json unreadable (… not valid JSON …))`, then `record_ok` closes | **`handoff check NOT RUN: state.json unreadable: .agents/state.json invalid at $: not valid JSON — …`** / **`work-after-end check NOT RUN: state.json unreadable: …`** | PASS | PASS |
| `badstate-nowork` | closes | the same two `NOT RUN … state.json unreadable` lines | PASS | n/a |

- With an unreadable state.json, neither the hook nor either greeting shows `HANDOFF MISSING` or `WORK AFTER`.
- Greeting #1 shows the `Drift: not checked (.agents/state.json is unreadable …)` line and the `RECORD OK …` that the
  explicit `record_ok` asked for. Greeting #2 shows only the Drift line.
- No transcript gives no notice in either greeting.

## Row 5: R3–R8

- **R3, wording: PASS.**
  - Master, untrailered only (`n3`, POSIX and `--win`): `handoff check: no handoff or record update for this session; 2
    commit(s) in the window carry no Claude-Session trailer: UNATTRIBUTED, not counted for any seat`.
  - `n3m` gives `handoff committed (…); 1 commit(s) … UNATTRIBUTED, not counted for any seat`.
  - No `loop/*` wording appears in either.
- **R4, the missing-handoff marker: PASS.** HANDOFF MISSING fired in these scenarios:
  - `loop-none`, `n2` and `cap`, POSIX and `--win`;
  - after each, `git status --short --untracked-files=all` is `(clean)`;
  - the marker and its `.shown` file are in the store (`<db dir>/end-record/<key>/.missing-handoff.shown.jsonl`).

  **An old in-repo notice** (`legacy`, POSIX and `--win`):
  - I planted `.agents/SESSIONS/.missing-handoff.jsonl`, and the status showed `?? …`.
  - Greeting #1: `HANDOFF MISSING: session legacy-1 … (QA292 legacy in-repo marker)`. Greeting #2: none.
  - The in-repo file is gone, the status is `(clean)`, and the line moved to the store's `.shown`.
- **R5, `OLD LAYOUT` with `RECORD NOT CHECKED`: PASS on the paths QA 291 listed.**
  - `nogit`, `norepo` and `notranscript` all print `OLD LAYOUT: …` and then `RECORD NOT CHECKED: …`, POSIX and `--win`.
  - The new-layout `notranscript-new` correctly has no `OLD LAYOUT` line.
  - **S3 (Low):** the no-proof path (`noproof`, old layout, POSIX and `--win`) prints `RECORD NOT CHECKED: this server
    cannot prove its session (…)` with **no** `OLD LAYOUT` line. `server.ts:665–670` pushes that line before the
    `isOldLayoutProject` check, which r3 added only in the work-unknown branch (`server.ts:679`).
- **R7, payload with no session id: PASS.** `noproof` and `noproof-new` (POSIX and `--win`) give these lines, and
  neither greeting shows a notice:
  - `session proof NOT checked: the payload carried no session id`;
  - **`handoff check NOT RUN: the payload carried no session id`**;
  - `work-after-end check: no ob_end stamp for this session`.
- **R8, the cap: PASS** (`cap`, POSIX and `--win`).
  - I pre-seeded the store's `.record-ok.shown.jsonl`, `.work-after-end.shown.jsonl` and `.missing-handoff.shown.jsonl`
    with 250 lines each.
  - One real firing then ran: `record_ok` close, a commit after `/end`, a loop commit with no handoff, SessionEnd, and the
    greeting.
  - After it, each file has **200** lines. The first line is seed 51 and the last is the real entry, so the oldest lines
    were dropped.
- **R6, documented: PASS.** `end-record-store.ts:6–13` says the following:
  - the store key uses `canonicalizeProjectDir`, which lowercases drive-letter paths;
  - two projects that differ only by case on case-sensitive NTFS would share one store;
  - default NTFS cannot host both;
  - Linux is not lowercased.

## Row 6: regression. PASS

| Row | Scenario | Result | POSIX | `--win` |
|---|---|---|---|---|
| B2 | `b2n`, `b2n-c` (new) | `handoff check: handoff committed (set_handoff for session …c1)` / `work-after-end check: no commits after ob_end`; greetings none / none | PASS | PASS (`b2n`) |
| B2 | `b2o`, `b2o-c` (old) | `handoff committed (next-session.md modified/committed after …)`; greetings none / none | PASS | PASS (`b2o`) |
| B4/N4 | `n2` | `record_ok: "   "` → `[isError] ob_end refused: record_ok must not be whitespace only`; `""` → `[isError] ob_end refused: record_ok must be a non-empty reason`; afterwards status `(clean)` and `(no end-record dir)` | PASS | PASS |
| N1 | `predirty` | next-session.md dirty from an earlier session (mtime 5 days ago). Gives `[isError] OLD LAYOUT: …` / `RECORD NOT UPDATED: 1 commit(s), tags v2.0.0 since … (next-session.md not modified after …)`. After an in-session edit, `ob_end` closes | PASS | PASS |
| N2 | `n2` | the refusal carries `OLD LAYOUT: …` and then `RECORD NOT UPDATED: 1 commit(s), tags v1.0.1 …` | PASS | PASS |
| N6 (stamp files) | every scenario above | `git status --untracked-files=all` never lists `.ob-end-stamp.json`, `.record-ok*.jsonl` or `.work-after-end*.jsonl`. They are all in `<db dir>/end-record/<64-hex>/` | PASS | PASS |

**#498's `/bootstrap` L1 path, on the merged head** (`s-import.mjs l1`, `QA_OB` = the #489 head tree): **PASS**
1. **Step 1, `check`:**
   - `PRE-STATE — TASKS/ with no state.json (the import path)`;
   - `commands:  start.md OLD; end.md OLD; task.md absent; sync.md absent`;
   - `Next:` names `state import --draft` and `bootstrap install-commands`.
2. **Install before the import:** exit 1, `refused: .agents/TASKS/ exists with no state.json — run \`state import --commit\`
   first. Nothing written`.
3. **Draft:** `Validates: yes`, `Tasks: 4`. Then `--commit` exits 0.
4. **Before the install:** `ob_start` (real MCP, this head's `server.ts` and briefing) prints `OLD /start in this project:
   run bootstrap install-commands`.
5. **Step 7b, with no commit in between:**
   - exit 0, `Archive: .agents/archive/pre-bootstrap-commands-2026-10-08/`;
   - `start.md: OLD -> SIA`, `end.md: OLD -> SIA`, `task.md: absent -> SIA`, `sync.md: absent -> SIA`;
   - all four are byte-identical to the template;
   - the snapshot diff names only those four and the archive;
   - `check` now reads `BOOTSTRAPPED`, with all four `SIA`.
6. **Step 8:** the status lists exactly the text's nine paths (extra `[]`, missing `[]`). `git add -A; git commit` gives one
   `Bootstrap SIA` commit and a clean tree.
7. **A fresh `ob_start`:** no `OLD /start` line (I7: 1 before, 0 after).

## Row 7: my own mutants. **Both survive: finding S2 (Medium)**

Each mutant is one commit on the head, pushed through `push-qa.mjs`. Each tree was built, and every END-FIX test file that
touches E4 was run once on it.

| Mutant | Branch / sha | Change (`end-record-guard.ts`) | `end-fix-q6` | `r2-pins` | `r3-pins` | `q10` | `q12` |
|---|---|---|---|---|---|---|---|
| **M1**: line endings ignored in one direction only | `qa/s164e-m1` / `d41060a8` | The stamp hash normalizes next-session.md's line endings. `recordContentChangedSinceStamp` hashes the raw text. So a CRLF→LF change is ignored, but a LF→CRLF change, and an unchanged CRLF file, count as "changed" | 4/4 green | 4/4 green | 4/4 green | 1/1 green | 3/3 green |
| **M2**: the path is hashed instead of the bytes | `qa/s164e-m2` / `e41e90d5` | `computeRecordContentHash` hashes `statePath` / `nextPath` (the strings) on both layouts | 4/4 green | 4/4 green | 4/4 green | 1/1 green | 3/3 green |

**No test goes red.** On the real path, each mutant brings back a wrong result:
- **M1, `--win`** (CRLF next-session.md, `core.autocrlf=true`):
  - `b1o-all` gives **`work-after-end check: 1 commit(s) after ob_end and record updated`**, with no marker. That is R1,
    QA 291's High, back on every Windows CRLF repo.
  - `b1o-same` gives the same lost marker.
  - (`b1o-eol`, CRLF→LF, keeps the marker, which is the direction M1 still ignores.)
- **M2:** `b1o-later` and `b1n-later` give **`WORK AFTER /end NOT RECORDED`** in the hook and greeting #1, although the
  record really was updated after `ob_end`. So the marker can never be cleared.

**S2 (Medium).**
- The only test of the hash is r2-pins "M5". It asserts `false` for unchanged content on LF files, through the same
  function on both sides.
- **Nothing pins `changed === true`.** No test runs a real record update after `ob_end`, and there is no `… and record
  updated` assertion anywhere in `tests/`.
- **Nothing pins line-ending insensitivity.** All the fixtures are LF, and CI's `test-windows` job is skipped.
- **Fix:**
  - Add a Q6 test where a record update after `ob_end` leaves no marker, on both layouts.
  - Add one where next-session.md is CRLF at `ob_end`, on both sides, and also flipped after `ob_end`, and the sweep
    still gets the marker.

## #489 findings

| ID | Severity | Finding |
|---|---|---|
| **S1** | **Medium-High (blocking)** | New layout: E4's content hash includes `state.json` `revision`. Any `ob_state` write after `ob_end` (an identical `set_handoff` re-save, an unrelated `add_decision`) or a merge of another session's record write counts as "record updated", so the `WORK AFTER /end` marker is lost. Row 3's "re-saving identical content does not [clear it]" fails, on POSIX and Windows |
| S2 | Medium | Row 7: both mutants (one-direction line endings; path hashed instead of bytes) survive all END-FIX tests, and each one breaks the real path (R1 back on Windows CRLF; the marker never cleared). No test asserts a real post-`/end` record update clears the marker, and no test uses a CRLF record |
| S3 | Low | Old layout, no session proof (Cursor shape): `RECORD NOT CHECKED: this server cannot prove its session …` without the `OLD LAYOUT` line |

QA 291's R1–R8 are closed, apart from the S1 hole that the r3 hash opened.

**What would turn #489 to ACCEPT:**
1. **S1:** take `revision` out of the new-layout hash, and hash only this session's handoff entry and its sessions row.
   Pin it with an identical-re-save test and a merged-foreign-revision test.
2. **S2:** pin "a real update clears the marker" and the CRLF stamp/check on both layouts.

## Pushed branches

| Branch | Sha | What |
|---|---|---|
| `qa/s164e-m1` | `d41060a8` | Row 7 M1 (survived) |
| `qa/s164e-m2` | `e41e90d5` | Row 7 M2 (survived) |
| `qa/s164e-report` | this commit | this report and `docs/loops/qa-292/s164e/` |

QA-292: REPORT COMPLETE
