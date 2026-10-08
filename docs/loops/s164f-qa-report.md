# QA 293 (s164f): #489 END-FIX r4

## Verdict

| PR | Pinned head | Verdict | Blocking | Other findings |
|---|---|---|---|---|
| #489 END-FIX r4 | `09a31303416f8e191b08adfed5953a83d77d4fd5` | **ACCEPT** | none | none |

QA 292's S1, S2 and S3 are closed on the real paths, on POSIX and Windows:
- **S1:** on the new layout, the record hash now covers only this session's `handoffs[]` entry and its `sessions[]` row.
  An identical re-save, an unrelated op, and another session's write all keep the marker, whether that write is
  merged in or made in the working tree. A real `pick_up` change clears it.
- **S2:** QA 292's two surviving mutants, re-applied on this head, each now turn `end-fix-r4-pins` red.
- **S3:** `OLD LAYOUT` now comes with the no-proof `RECORD NOT CHECKED`.

My own two row 7 mutants (another session's row in the slice; the handoff not keyed by uuid) are each caught by r4-pins
"S1c". The regression rows and #498's `/bootstrap` L1 path pass on this head.

#489 changes `open-brain/src`, so merging it is Aaron's call. It gates the Makerspace import.

## Method and environment

- **QA:** QA 293, record session 164, prefix `s164f`. Headless Claude Code (Opus) on the laptop: Windows 10 Pro
  10.0.19045, Node v22.23.2.
- **Dispatch tree:** `git -C C:/qa-scratch/qa293-wt log -1 --format=%H` → `75963c5130124176cb4717af894a1f91de74eb50`.
- **Pin:** `gh pr view 489` gives `09a31303416f8e191b08adfed5953a83d77d4fd5` (`loop/end-fix`, OPEN). That equals the pin.
  I checked again just before writing this report: unchanged, `MERGEABLE`.
- **Trees:**
  - `C:/qa-scratch/qa293-pr489`: detached at the head, built (`build stamped 09a3130`).
  - `qa293-q292`: QA 292's report commit `de8a29b7`, read-only, used only for its scripts.
  - `qa293-m1` … `qa293-m4`: the mutants. Each is one commit on the head, and each was built and passes `tsc --noEmit`.
  - The QA clone was not checked out, reset, cleaned or edited.
- **Isolation:** every command went through `run.mjs`, `x.mjs`, `vt.mjs`, `prep-mut.mjs` or `lib.mjs` in
  `docs/loops/qa-293/s164f/`. These are QA 292's scripts re-rooted to `C:/qa-tmp/qa293`. They set:
  - `TEMP` and `TMP` to `C:\qa-tmp\qa293\tmp`;
  - `HOME` and `USERPROFILE` to `C:/qa-tmp/qa293/home`;
  - `KNOWLEDGE_V2_DB`, one directory per scenario under `C:/qa-tmp/qa293/db/`;
  - `OPEN_BRAIN_ACTIVE_SESSION`, `_SCORE_HISTORY`, `_SHADOW_LOG` and `_VAULT_DIR` under `C:/qa-tmp/qa293`;
  - `npm_config_cache` under `C:/qa-tmp/qa293`.

  `CLAUDE_CODE_SESSION_ID` is cleared, and every fixture repo is under `C:/qa-tmp/qa293/repos/`.
- **What I did not touch:**
  - I wrote no live `state.json`, the real knowledge DB, the real open-brain data dir, a real vault or a settings file.
  - I made no Jev call and printed no key.
  - I used `gh` only to read.
  - I read no hub room or developer report.
- **How it was driven** (as QA 291 and QA 292 did):
  - `ob_end` and `ob_state` ran on the real MCP server (`node build/server.js`, SDK stdio client), with a session proof
    for the driver's pid.
  - SessionEnd is `node build/cli-session-end.js`, and the greeting is `node build/cli-bootstrap.js`, run twice.
  - `--win` adds a spaced path (`…\repos\win space\…`), `core.autocrlf=true`, CRLF prose and transcript, and backslash
    `project_root`, `transcript_path` and `CLAUDE_PROJECT_DIR`.
- **Narrow:**
  - On the head, `tsc --noEmit` and `npm run typecheck:tests` both exit 0.
  - One test file per vitest run, on Windows, all green on the head:
    - `end-fix-r4-pins` 9/9;
    - `end-fix-q6` 4/4, `end-fix-r2-pins` 4/4, `end-fix-r3-pins` 4/4;
    - `end-fix-q10` 1/1, `end-fix-q12` 3/3;
    - `shared/handoff-guard` 17/17.

  CI's `test-windows` job was skipped on the head run, so these are the only Windows test results.
- **Scripts:** `docs/loops/qa-293/s164f/` on this branch. Each file's header says how it differs from QA 292's.
  - New in `s-rows.mjs`: `b1n-pullh`, `b1n-otherh` and `b1o-eolr`.
  - New files: `vt.mjs`, `x.mjs` and `prep-mut.mjs`.
  - `mut-topo.mjs` is re-pointed at the r4 mutants.

  The scripts expect to live in `C:/qa-tmp/qa293/s164f/`. Run
  `node multi.mjs [--win] [QA_OB=<tree>] <script> <scenario…>`.

## Unsandboxed commands

Unsandboxed commands: none.

## Row 1: confined. PASS

- The head `09a31303` has one parent: `474c100b`.
- `474c100b` has two parents: `854c6ced` (r3) and `a7c26bb2` (master).
- `git merge-tree --write-tree 854c6ced a7c26bb2` gives tree `186515b3` with no conflict. `git diff 186515b3 474c100b`
  is **empty**, so the merge commit is the plain merge and adds nothing of its own.
- Leaving out master's changes, the files changed from `854c6ced` to the head are the r4 commit's four files. All four
  are END-FIX:
  - `CHANGELOG.md` (+4: the r4 entry);
  - `open-brain/src/server.ts` (+1: `OLD_LAYOUT_LINE` before the no-proof `RECORD NOT CHECKED`);
  - `open-brain/src/shared/end-record-guard.ts` (+42/−5): `hashOldLayoutNextSessionText`, `hashNewLayoutSessionRecord`,
    and `computeRecordContentHash` now uses both;
  - `open-brain/tests/end-fix-r4-pins.test.ts` (new, 199 lines).

## Row 2: mutant runs. PASS

These come from `mut-topo.mjs` and `ci-reds.mjs`, both read-only. Each mutant is one commit whose parent is the head
`09a31303`, and each touches only `end-record-guard.ts`.

| Run | Branch / sha | Mutant (src diff, verified) | Red tests, and nothing else | Target |
|---|---|---|---|---|
| 37776928002 | `loop/end-fix` `09a31303` | the head | `test` **success** (`test-windows` skipped) | n/a |
| 37777444070 | `end-fix-mut-r4-revision` `2fcf74a7` | `payload = { revision: state.revision, handoff, session }` | r4-pins S1a (identical re-save), S1b (`add_decision`), S1c (another session's write). 3 failed, 1 file | S1 |
| 37777575031 | `end-fix-mut-r4-m1` `bfcfc96b` | the check hashes next-session.md's raw bytes, and the stamp normalizes line endings | r4-pins "S2: CRLF at ob_end, CRLF after — unchanged, WORK AFTER on commit only". 1 failed | S2 line endings |
| 37777638563 | `end-fix-mut-r4-m2` `573f2037` | the old layout hashes `nextPath` (the string) | r4-pins "S2: real next-session change after ob_end prints record updated". 1 failed | S2 "record updated" |

## Row 3 (S1), new layout, real paths: PASS, POSIX and `--win`

Each scenario runs in this order:
1. `set_handoff` ("B1 new", rev 7→8);
2. `ob_end`;
3. one trailered commit;
4. the change after `/end`;
5. SessionEnd;
6. two greetings.

| Scenario | Change after `ob_end` | SessionEnd (exact) | Greeting #1 / #2 | POSIX | `--win` |
|---|---|---|---|---|---|
| `b1n-same` | `set_handoff` with the identical `pick_up`, rev 8→9 | `WORK AFTER /end NOT RECORDED: 1 commit(s) since ob_end at …` | the line / none | **PASS** | **PASS** |
| `b1n-other` | `add_decision`, rev 8→9, this session's handoff unchanged | `WORK AFTER /end NOT RECORDED: …` | the line / none | **PASS** | **PASS** |
| `b1n-pull` | a merge of a branch where another session (`cse_01QA292otherSession…`) wrote state.json rev 9 | `WORK AFTER /end NOT RECORDED: 1 commit(s) …; 1 commit(s) after /end carry no Claude-Session trailer (UNATTRIBUTED)` (the merge commit) | the line / none | **PASS** | **PASS** |
| `b1n-pullh` (mine) | a merge bringing **another session's own `set_handoff`** (same seat, `developer`, checkout `other-seat`) and **its new `sessions[]` row**, written by the real `applyStateOps` | `WORK AFTER /end NOT RECORDED: …` (+ UNATTRIBUTED for the merge) | the line / none | **PASS** | **PASS** |
| `b1n-otherh` (mine) | the same write as `b1n-pullh`, made directly in the working tree, with no merge | `WORK AFTER /end NOT RECORDED: …` | the line / none | **PASS** | n/a |
| `b1n-later` | `set_handoff` with a new `pick_up`, rev 8→9 | `work-after-end check: 1 commit(s) after ob_end and record updated` | none / none | **PASS** | **PASS** |

- In every row, the marker was shown exactly once: the hook prints it on stdout and stderr, and greeting #1 shows it.
- `git status --untracked-files=all` never lists an END-FIX file. The stamp and `.shown` files are in
  `<db dir>/end-record/<key>/`.

## Row 4 (S2), old layout, `--win`, real paths: PASS. QA 292's mutants are now red: PASS

Under `--win`, next-session.md is CRLF at `ob_end` (`nextSessionCRLF: true`, `core.autocrlf=true`).

| Scenario | Change after `ob_end` | SessionEnd | Greeting #1 / #2 | `--win` | POSIX |
|---|---|---|---|---|---|
| `b1o-all` (`git add -A` sweep) | none (next-session.md committed with `src/after.ts`) | `WORK AFTER /end NOT RECORDED: …` | the line / none | **PASS** | PASS (row 6) |
| `b1o-same` | the same CRLF bytes rewritten, mtime now (`bytesEqual: true`) | `WORK AFTER /end NOT RECORDED: …` | the line / none | **PASS** | n/a |
| `b1o-eol` | CRLF→LF (`--win`), LF→CRLF (POSIX) | `WORK AFTER /end NOT RECORDED: …` | the line / none | **PASS** | **PASS** |
| `b1o-eolr` (mine, the other direction) | LF at `ob_end`→CRLF (`--win`), CRLF at `ob_end`→LF (POSIX) | `WORK AFTER /end NOT RECORDED: …` | the line / none | **PASS** | **PASS** |
| `b1o-later` | a line appended (CRLF kept) | `work-after-end check: 1 commit(s) after ob_end and record updated` | none / none | **PASS** | n/a |

So both directions are covered under `--win` and on POSIX.

**QA 292's mutants, re-applied on the head** (one commit each, pushed):

| Mutant | Branch / sha | Change (`end-record-guard.ts`) | `end-fix-r4-pins` | q6 / r2-pins |
|---|---|---|---|---|
| M1 (from `qa/s164e-m1`) | `qa/s164f-m1` / `2d301fcc` | `computeRecordContentHash(…, rawEol)`: `recordContentChangedSinceStamp` passes `true` and hashes the raw bytes. The stamp still normalizes | **RED 1/9**: "S2: CRLF at ob_end, CRLF after — unchanged, WORK AFTER on commit only" | 4/4, 4/4 green |
| M2 (from `qa/s164e-m2`) | `qa/s164f-m2` / `cfdb3408` | both layouts hash the path string (`statePath` / `nextPath`) | **RED 3/9**: "S1d: real pick_up change … record updated", "S2: stamp and check share hashNewLayoutSessionRecord", "S2: real next-session change … record updated" | 4/4, 4/4 green |

Each mutant now turns an END-FIX test red, which closes S2. For reference on the real path: M1 under `--win` `b1o-all`
gives `work-after-end check: 1 commit(s) after ob_end and record updated` with no marker. That is QA 292's R1
regression, and the head itself does not have it.

## Row 5 (S3): PASS

`noproof` (old layout, no session proof: the Cursor shape), POSIX and `--win`. `ob_end` prints:

```
OLD LAYOUT: nothing writes the handoff for you; update next-session.md, or import the record (state import).
RECORD NOT CHECKED: this server cannot prove its session (no session proof for this server's parent process … absent …). …
```

`noproof-new` (new layout) correctly prints `RECORD NOT CHECKED` with **no** `OLD LAYOUT` line. In both, SessionEnd
gives `session proof NOT checked: the payload carried no session id` / `handoff check NOT RUN: the payload carried no
session id`. Both greetings show nothing, and the status is `(clean)`.

## Row 6: short regression on the real paths. PASS

| Row | Scenario | Result | Run |
|---|---|---|---|
| R1 sweep | `b1n-all` (new): `git add -A` commits state.json, four views and `src/after.ts` after `ob_end` | `WORK AFTER /end NOT RECORDED: …`; greetings: the line / none; status `(clean)` | POSIX (and `--win` `b1o-all` in row 4) |
| R1 sweep | `b1o-all` (old) | `WORK AFTER /end NOT RECORDED: …`; greetings: the line / none | POSIX, `--win` |
| B2 | `b2n` / `b2o` | `handoff committed (set_handoff for session …c1)` / `handoff committed (next-session.md modified after …)`; `work-after-end check: no commits after ob_end`; greetings none / none | POSIX |
| B3/R2 | `notranscript` (old layout, proof without `transcript_path`, one trailered commit after `ob_end`) | `ob_end`: `OLD LAYOUT` + `RECORD NOT CHECKED: this session's start could not be read from its transcript …`. Hook: `handoff check NOT RUN: …transcript…` and `work-after-end check NOT RUN: …transcript…`. Greetings none / none | POSIX, `--win` |
| B3/R2 | `badstate` (state.json `{ not json`) | `ob_end`: `[isError] RECORD NOT UPDATED: … (.agents/state.json unreadable (…))`, then `record_ok` closes. Hook: `handoff check NOT RUN: state.json unreadable: …` and `work-after-end check NOT RUN: state.json unreadable: …`. Greeting #1: the `Drift: not checked` line + `RECORD OK …`. Greeting #2: Drift only. No `HANDOFF MISSING` or `WORK AFTER` | POSIX, `--win` |
| B4/N4 | `n2` | `record_ok: "   "` → `[isError] ob_end refused: record_ok must not be whitespace only`; `""` → `… must be a non-empty reason`. Status `(clean)`, `(no end-record dir)`. The refusal carries `OLD LAYOUT` + `RECORD NOT UPDATED: 1 commit(s), tags v1.0.1 …` | POSIX |
| N1 | `predirty` (next-session.md dirty from an earlier session, mtime 5 days ago) | `[isError] OLD LAYOUT …` / `RECORD NOT UPDATED: 1 commit(s), tags v2.0.0 … (next-session.md not modified after …)`. After an in-session edit, `ob_end` closes | POSIX |
| N6 | every scenario | `git status --untracked-files=all` never lists `.ob-end-stamp.json`, `.record-ok*`, `.work-after-end*` or `.missing-handoff*`. All are in the store (for example `n2`: `.missing-handoff.shown.jsonl` 1, `.ob-end-stamp.json`, `.record-ok.shown.jsonl` 1, `.work-after-end.shown.jsonl` 1) | all |

**#498's `/bootstrap` L1 path on this head** (`s-import.mjs l1`): **PASS**
1. **`check`:** `PRE-STATE — TASKS/ with no state.json (the import path)`;
   `commands: start.md OLD; end.md OLD; task.md absent; sync.md absent`.
2. **Install before the import:** exit 1, `refused: … run \`state import --commit\` first. Nothing written`.
3. **Draft:** `Validates: yes`, `Tasks: 4`. Then `--commit` exits 0.
4. **`ob_start` before the install:** `OLD /start in this project: run bootstrap install-commands`.
5. **`install-commands`, with no commit in between:** exit 0.
   - `start.md` and `end.md` go OLD→SIA, and `task.md` and `sync.md` go absent→SIA.
   - All four are byte-identical to the template.
   - The snapshot diff names only those four and the archive.
   - `check` now reads `BOOTSTRAPPED`, with all four `SIA`.
6. **Step 8:** the status lists exactly the nine paths (extra `[]`, missing `[]`). One `Bootstrap SIA` commit, and the
   tree is clean.
7. **A fresh `ob_start`:** no `OLD /start` line (1 before, 0 after).

## Row 7: my own mutants. Both are caught: PASS

Each mutant is one commit on the head, built, and pushed through `push-qa.mjs`.

| Mutant | Branch / sha | Change (`hashNewLayoutSessionRecord`) | `end-fix-r4-pins` | q6 / r2-pins / r3-pins | Real path, `b1n-pullh` |
|---|---|---|---|---|---|
| **M3**: the session-row slice includes another session's row | `qa/s164f-m3` / `68a0ce2f` | `session` = every `sessions[]` row with this session's seat | **RED**: "S1c: another session's state write after ob_end keeps WORK AFTER (not record updated)" | 4/4, 4/4, 4/4 green | `work-after-end check: 1 commit(s) after ob_end and record updated`, greetings none / none: **marker lost** (the head keeps it) |
| **M4**: the handoff slice is not keyed by uuid | `qa/s164f-m4` / `0cb264fd` | `h` = the newest handoff with this session's seat (this session's entry is used only to find the seat) | **RED**: "S1c: another session's state write after ob_end keeps WORK AFTER (not record updated)" | 4/4, 4/4, 4/4 green | the same: **marker lost** |

Both are caught by S1c. That test writes another session's `set_handoff` under the same seat, which adds that session's
handoff and its `sessions[]` row. Note that S1c is the only test that catches either mutant, so the slice rules hang on
that one test. This is not a finding, because the dispatch asks only that a test goes red.

## #489 findings

None. QA 292's S1 (Medium-High), S2 (Medium) and S3 (Low) are closed.

## Pushed branches

| Branch | Sha | What |
|---|---|---|
| `qa/s164f-m1` | `2d301fcc` | Row 4: QA 292's M1 re-applied (red) |
| `qa/s164f-m2` | `cfdb3408` | Row 4: QA 292's M2 re-applied (red) |
| `qa/s164f-m3` | `68a0ce2f` | Row 7: M3 (red) |
| `qa/s164f-m4` | `0cb264fd` | Row 7: M4 (red) |
| `qa/s164f-report` | this commit | this report and `docs/loops/qa-293/s164f/` |

QA-293: REPORT COMPLETE
