# QA 291 (s164d): round 2 of #489 END-FIX, #498 IMPORT-CMDS and #499 T-247

## Verdicts

| PR | Pinned head | Verdict | Blocking | Other findings |
|---|---|---|---|---|
| #489 END-FIX r2 | `f59d03bc7ae3a02b6b3c374eac503c318b40001c` | **REJECT** | **R1 (High)**: B1 is still open on the common shape. A record written *before* `ob_end` still counts as "updated after `/end`" when the post-`/end` commit also stages that record. QA 289's own q3 fixture still loses the marker. **R2 (Medium)**: B3 is still open in the hook. With no transcript it prints `work-after-end check: no commits after ob_end` although a trailered commit followed `ob_end`. With an unreadable state.json, nothing in the hook names the file | R3–R8 (below): N3 wording; the N6 missing-handoff marker still lands in the repo; the store key collides for two case-distinct projects in a case-sensitive directory; no `OLD LAYOUT` line on `RECORD NOT CHECKED`; a no-id payload gets `HANDOFF MISSING`; `.shown` files only grow |
| #498 IMPORT-CMDS r2 | `f3aba754e7a870c4880639bb564a2d8e7e0e8d71` | **ACCEPT** | none | P1 (Low-Medium): on Windows a permissions problem is refused with the wrong fix (`commit or stash it first`), because `accessSync` cannot see ACLs and git lists the unreadable file as modified. P2 (Low-Medium): after a forced mid-install failure, renames are rolled back, but a command copied into an `absent` slot stays on disk while the message says `Nothing written` |
| #499 T-247 r2 | `409c8c08542ebd73f6f15347cb97e52faaf17e04` | **ACCEPT** | none | none. Row 16 is information: the byte test stays green on Windows without the pragma |

All three change `open-brain/src`, so each merge is Aaron's word. #489 gates the Makerspace import, so the import stays gated.

## Method and environment

- **QA:** QA 291, record session 164, prefix `s164d`. Headless Claude Code (Opus) on the laptop: Windows 10 Pro
  10.0.19045, Node v22.23.2. The process runs **elevated** (High Mandatory Level, member of Administrators). This matters
  for row 12.
- **Dispatch tree:** `git -C C:/qa-scratch/qa291-wt log -1 --format=%H` → `7ca465a4063c62815dd4b396bacb7c7be415b048`.
- **Pins:** `gh pr view` gives #489 `f59d03bc…` (`loop/end-fix`, OPEN), #498 `f3aba754…` (`loop/import-cmds`, OPEN) and #499
  `409c8c08…` (`loop/t247-pins`, OPEN). All equal the pins.
- **Trees:**
  - `C:/qa-scratch/qa291-pr489`, `-pr498` and `-pr499`, each detached at its head.
  - `qa291-merge`: the batch merge, local `6474fe3a`.
  - `qa291-crlf tpl`: #498 checked out with `core.autocrlf=true` at a spaced path, for row 14.
  - The mutant trees `qa291-m5`, `-m6`, `-m499b`, `-m499cal` and `-m499h2`.
  - The QA clone was not checked out, reset, cleaned or edited.
- **Isolation:** every command went through `docs/loops/qa-291/s164d/run.mjs` or `lib.mjs`. They set:
  - `TEMP`, `TMP` and `TMPDIR` to `C:/qa-tmp/qa291/tmp`;
  - `HOME` and `USERPROFILE` to `C:/qa-tmp/qa291/home`;
  - `KNOWLEDGE_V2_DB`, one directory per scenario under `C:/qa-tmp/qa291/db/<scenario>/`. #489 r2 writes its store beside
    this DB, so each scenario got its own store;
  - `OPEN_BRAIN_ACTIVE_SESSION`, `OPEN_BRAIN_SCORE_HISTORY`, `OPEN_BRAIN_SHADOW_LOG` and `OPEN_BRAIN_VAULT_DIR` to paths
    under `C:/qa-tmp/qa291`;
  - `npm_config_cache` under `C:/qa-tmp/qa291`.
  - `CLAUDE_CODE_SESSION_ID` is cleared, so this session's own id cannot leak into a fixture hook.
  - The MCP server, the SessionEnd hook and the greeting all ran with that HOME and DB.
  - All repos were under `C:/qa-tmp/qa291/repos/`.
  - Nothing was written to a live state.json, the real knowledge DB or open-brain data dir, a real vault, or any settings
    file. No Jev call was made and no key was printed.
  - `gh` was used only to read, and no hub room or developer report was read.
- **How it was driven** (as QA 289 did):
  - Each head was built (`build stamped f59d03b`, `f3aba75`, `409c8c0`).
  - `ob_end`, `ob_state` and `ob_start` are the real MCP server (`node build/server.js`) over stdio, using the SDK client.
    The session proof is written for the driver's own pid.
  - The hook is `node build/cli-session-end.js` with the payload on stdin. The greeting is `node build/cli-bootstrap.js`.
  - The #498 CLI is `node build/cli.js`, run from the project root.
- **Scripts** are committed under `docs/loops/qa-291/s164d/`. `lib.mjs`, `run.mjs`, `s-rows.mjs`, `s-cannot.mjs` and
  `tests.mjs` are adapted from QA 289's `docs/loops/qa-289/s164b/`, and each file's header says what changed. Run
  `node multi.mjs [--win] <script> <scenario…>`. `--win` re-runs any scenario with a spaced path, CRLF files,
  `core.autocrlf=true`, and backslash `project_root`, `transcript_path` and `CLAUDE_PROJECT_DIR`. The scripts expect to
  live in `C:/qa-tmp/qa291/s164d/`.
- **Narrow:** one test file per vitest run, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`. There
  was no full suite.

## Unsandboxed commands

Unsandboxed commands: none.

## Rows 1–3 (every PR)

### Row 1: confined. PASS for all three, with one note on #498

- **#489**, `git diff --stat origin/master...f59d03bc`: 26 files, +1627/−64. Compared with QA 289's 24 files, the two new
  files are:
  - `open-brain/src/shared/end-record-store.ts` (new, +15): the out-of-repo store, which is N6's fix;
  - `open-brain/tests/end-fix-r2-pins.test.ts` (new).

  Since r1 (`1dac7b8a..f59d03bc`), r2 touches only `CHANGELOG.md`, `cli-session-end.ts`, `server.ts`,
  `end-record-guard.ts`, `end-record-store.ts`, `handoff-guard.ts` and END-FIX tests. Everything is inside the brief.
- **#498**, `git diff --stat origin/master...f3aba754`: 24 files.
  - In scope:
    - the bootstrap pipeline;
    - `cli-spec.ts`;
    - the session-start render (`briefing.ts`);
    - the tests;
    - `project-template/.claude/commands/bootstrap.md`;
    - `CHANGELOG.md`.
  - Already accepted wiring (L6): `cli.ts`, `server.ts` (+2) and `cli-args.test.ts`.
  - **New in r2, outside the brief's list:**
    - `open-brain/src/shared/import-outputs.ts` (new, +13): the five paths `state import --commit` writes;
    - `open-brain/src/pipelines/state-import/index.ts` (+2/−1): it now imports and re-exports `STATE_REL` from there.

    These are wiring for L1's allowlist and a "break circular import" refactor (`f3aba754`). They change no behaviour of
    the importer. **Note only.**
- **#499**, `git diff --stat origin/master...409c8c08`: 6 files. They are `CHANGELOG.md`, `src/scrub-trigger-fires.ts`,
  `src/vault-writer.ts`, `tests/pipelines/sync/hub-talk-exit-codes.test.ts`, `tests/t247-pins-scrub.test.ts` and
  `tests/vault-writer.test.ts`. The r2 delta is `vault-writer.ts`, the two tests and `CHANGELOG.md`. All are in scope.

### Row 2: mutant runs. PASS (each red run fails only on its own rows; parents check out)

`ci-reds.mjs` and `mut-topo.mjs` (`gh run view` and `git`, read-only):

| Run | Branch / sha | Parent | Mutant (src diff, verified) | Red tests, and nothing else |
|---|---|---|---|---|
| 37659540076 | `loop/end-fix` `f59d03bc` | n/a | the head | `test` **success** (`test-windows` skipped) |
| 37658044185 | `end-fix-mut-e4-pre` `215b3ec0` | `e4e535c1` = head^ | `checkRecordUpdated` passes `undefined` for `changesAfter` on the new layout | q6 "new layout: set_handoff then ob_end then commit still gets WORK AFTER marker (B1)"; r2-pins "M5: E4 record check uses ob_end_at …" |
| 37658123318 | `end-fix-mut-e2-ignore` `5504e4f6` | `e4e535c1` = head^ | the E2-record branch removed from `checkSessionHandoff` | handoff-guard "T-246 END-FIX r2: master work with set_handoff is ok …" |
| 37658758997 | `end-fix-mut-record-ws` `2de4d150` | `e4e535c1` = head^ | whitespace refusal removed; `recordOkReason = args.record_ok ?? null` | r2-pins "N4: record_ok whitespace only is refused" |
| 37659563386 | `end-fix-mut-unknown` `963e02f5` | `f59d03bc` = head | the `RECORD NOT CHECKED` branch removed | r2-pins "B3: ob_end prints RECORD NOT CHECKED …" |
| 37653272720 | `loop/import-cmds` `f3aba754` | n/a | the head | `test` **success** (`test-windows` skipped) |
| 37655704904 | `import-cmds-mut-r2-1` `dfc6f9cf` | head | the allowlist ignored: any dirty path blocks | i3, i4, i5, i8, r2-l1, r2-l3: all are installs on the dirty import tree (L1) |
| 37655705427 | `import-cmds-mut-r2-2` `7ba51552` | head | the rollback removed | r2-l2 "rolls back a rename when a later step fails" |
| 37655794607 | `import-cmds-mut-r2-3` `849aecd1` | head | raw-byte `SIA` detection | r2-l3 "committed commands re-checked out as CRLF still read SIA …" |
| 37650735605 | `loop/t247-pins` `409c8c08` | n/a | the head | `test` **success** (`test-windows` skipped) |
| 37650760336 | `t247-mut-j1` `8b63eb9c` | head | the calendar round trip removed | vault-writer "T-247 J1: rejects invalid summary dates …" |

- **Parent-commit mutants:** the three `#489` mutants on `e4e535c1` have a parent whose `open-brain/src` tree equals the
  head's (`rev-parse <sha>:open-brain/src` is equal). The head adds only `tests/end-fix-r2-pins.test.ts`.
- Each mutant is one commit, and each remote ref equals its run's `headSha`.

### Row 3: batch merge. PASS; **one conflict, in `CHANGELOG.md` only**

- `7ca465a4`, then `--no-ff` merges in order:
  1. #489: clean.
  2. **#498: `CONFLICT (content): Merge conflict in CHANGELOG.md`.** Both PRs add an entry at the top of
     `### Added`. I resolved it as a union, keeping #489's two entries and then #498's. **`open-brain/src/server.ts`
     auto-merged with no conflict.** #489's `handleEnd` hunk and #498's `oldStartCommand` import and `renderBriefing`
     argument are far apart. The session-start render (`briefing.ts`, #498 only) and `cli-bootstrap.ts` (#489 only) do not
     overlap.
  3. #499: clean.
- The local merge HEAD is `6474fe3a`. A first attempt committed conflict markers, because my resolver missed CRLF. I
  discarded it and redid the merge before anything ran on it.
- `npm ci`, then `tsc --noEmit` exit 0 and `npm run typecheck:tests` exit 0.
- One vitest run per touched file, all green:
  - end-fix q1–q5, q7–q10: 1/1 each;
  - q6: 2/2;
  - q11: 3/3;
  - q12: 3/3;
  - r2-pins: 4/4;
  - rating-method: 8/8;
  - handoff-guard: 17/17;
  - import-cmds i1–i8: 1/1 each;
  - i9: 3/3;
  - r2-l1: 1/1;
  - r2-l2: 2/2;
  - r2-l3: 1/1;
  - r2-l5: 1/1;
  - cli-args: 71/71;
  - vault-writer: 24/24;
  - t247-pins-scrub: 2/2;
  - hub-talk-exit-codes: 20/20.

## #489 END-FIX r2: REJECT

### Row 4 (B1): FAIL on the sweep shape, PASS on the split shape (`s-rows.mjs b1n-* b1o-*`)

Every scenario: commit work, update the record, `ob_end` (it closes), one trailered commit, SessionEnd, then two greetings.
The only difference between scenarios is **what the post-`/end` commit stages**.

| Scenario | Record update | At `ob_end` | Post-`/end` commit stages | SessionEnd (exact) | Greeting #1 / #2 |
|---|---|---|---|---|---|
| `b1n-src` (new layout) | `ob_state set_handoff` (rev 7 → 8) | record dirty | `src/after.ts` only | `WORK AFTER /end NOT RECORDED: 1 commit(s) since ob_end at …` | the line / none: **PASS** |
| `b1n-pre` | `set_handoff`, record committed before `ob_end` | clean | `src/after.ts` | `WORK AFTER /end NOT RECORDED: …` | the line / none: **PASS** |
| **`b1n-all`** | `set_handoff` | record dirty | **`git add -A`**: state.json, the four views and `src/after.ts` | **`work-after-end check: 1 commit(s) after ob_end and record updated`** | **none / none: FAIL** |
| `b1o-src` (old layout) | uncommitted next-session.md edit | next-session.md dirty | `src/after.ts` only | `WORK AFTER /end NOT RECORDED: …` | the line / none: **PASS** |
| `b1o-pre` | next-session.md committed before `ob_end` | clean | `src/after.ts` | `WORK AFTER /end NOT RECORDED: …` | the line / none: **PASS** |
| **`b1o-all`** | uncommitted next-session.md edit | next-session.md dirty | **`git add -A`**: next-session.md and `src/after.ts` | **`work-after-end check: 1 commit(s) after ob_end and record updated`** | **none / none: FAIL** |
| `b1n-later` (control) | `set_handoff` before **and after** `ob_end` | n/a | `src/after.ts` | `… after ob_end and record updated` | none: correct |
| `b1o-later` (control) | next-session.md edited again after `ob_end` | n/a | `src/after.ts` | `… after ob_end and record updated` | none: correct |

**R1 (High, blocking).** The cause is `recordFileChangedAfter` (`end-record-guard.ts`).
- It counts any `git log --since=<ob_end_at> -- <record file>` hit as a record write after `ob_end`.
- On the new layout, `newLayoutRecordUpdated` accepts `(handoff || sessionRow) && stateTouched`. The handoff can be one
  written before `ob_end`. "Touched" can be just a later commit of that same, unchanged content.
- So a record written before `/end` and committed after it counts as the later record write, which is QA 289's B1
  verbatim.
- **This is QA 289's own failing fixture.** QA 289's `s-rows.mjs q3` used `commit()`, which runs `git add -A`, for its
  post-`/end` commit. The r2 Q6 test passes `{ only: true }` (`git add src/after.ts`), so it pins only the split shape.
- **The sweep shape is the normal one on the new layout.** `ob_state` leaves state.json and four views dirty (see the
  `status at ob_end` lines above), and the next "commit everything" carries them along with the post-`/end` work.
- **Fix direction:**
  - New layout: compare against the record's own content. For example, a handoff or `sessions[]` entry whose write time or
    revision is later than the stamp; or store the state.json revision (or a hash) in the stamp and require it to have
    moved.
  - Old layout: require next-session.md's content to differ from what it was at `ob_end`. Store a hash in the stamp.
    Neither the mtime nor the commit time of a sweep says anything about the content.
  - Add a Q6 test whose post-`/end` commit uses `git add -A`.

### Row 5 (B2): PASS

| Scenario | SessionEnd handoff line | Greetings #1 and #2 |
|---|---|---|
| `b2n`: new layout, `set_handoff`, `ob_end`, master | `handoff check: handoff committed (set_handoff for session …c1)` | none / none |
| `b2n-c`: the same, with the record committed | the same | none / none |
| `b2o`: old layout, uncommitted next-session.md edit | `handoff check: handoff committed (next-session.md modified after …)` | none / none |
| `b2o-c`: old layout, next-session.md committed | `handoff check: handoff committed (next-session.md committed after …)` | none / none |
| `q7`: `loop/qa291-seat` and `docs/loops/qa291-handoff.md` (Q7) | `handoff check: handoff committed (loop handoff committed (docs/loops/qa291-handoff.md))` | none / none |
| `loop-none`: `loop/*` work, no handoff of either kind (`ob_end` refused, then `record_ok`) | `HANDOFF MISSING: session …c1 committed 1 commit(s) on loop/qa291-seat …` | greeting #1: `HANDOFF MISSING …` and `RECORD OK …`; greeting #2: none |

No `HANDOFF MISSING` appears after a correct close on master in either layout. The loop seat with a handoff passes, and the
loop seat without one still warns. (The wording `handoff committed (…modified…)` for an uncommitted edit is cosmetic.)

### Row 6 (B3): `ob_end` PASS. **The hook FAILS on no-transcript and unreadable state.json** (`s-cannot.mjs`)

| Path | `ob_end` (exact first line) | SessionEnd (exact) |
|---|---|---|
| no git (PATH without git) | `RECORD NOT CHECKED: git could not list local branches here` **PASS** | `handoff check NOT RUN: git could not …` / `work-after-end check NOT RUN: git could not list local branches here` **PASS** |
| not a repository | `RECORD NOT CHECKED: git could not list local branches here` **PASS** | both `NOT RUN` **PASS** |
| **no transcript** (proof with no `transcript_path`, a trailered commit and tag `v9.0.0`; **then 1 trailered commit after `ob_end`**) | `RECORD NOT CHECKED: this session's start could not be read from its transcript, so its commits cannot be told from anyone else's` **PASS** | `handoff check NOT RUN: …` / **`work-after-end check: no commits after ob_end`**: **FAIL** |
| **unreadable state.json** (`{ not json`), with 1 commit and next-session.md edited | `RECORD NOT UPDATED: 1 commit(s) since … (.agents/state.json unreadable (.agents/state.json invalid at $: not valid JSON — …)). Update the record (ob_state set_handoff, …)`. The file is named, and the session is **not** treated as old layout: there is no `OLD LAYOUT` line, and the next-session.md edit did not count. **PASS** | `HANDOFF MISSING: … committed 2 commit(s) on master … Its reasoning is not in any file …` / `WORK AFTER /end NOT RECORDED: 1 commit(s) …`. **No line names state.json, and neither check says it did not run: FAIL** |
| no proven session (Cursor shape) | `RECORD NOT CHECKED: this server cannot prove its session (…)` **PASS** | `session proof NOT checked: the payload carried no session id` / `HANDOFF MISSING: session (no id) committed 1 commit(s) on master …` (R7) |

**R2 (Medium, blocking).** Two parts.
- **No transcript.** The hook's work-after branch falls back to `ids = [session uuid]`. Trailers carry the `cse_` bridge
  id, which only the transcript supplies. So `scanSessionWork` matches nothing, returns `status: "ok", commits: 0`, and the
  hook prints a pass.
  - The row says `NOT RUN`, never `no commits`. That is the exact line QA 289 reported.
  - **Fix:** treat "no transcript ids" as unknown in the work-after branch (print `NOT RUN: … transcript …`), as the
    handoff branch already does.
- **Unreadable state.json.** The hook runs both checks as if the record were readable and simply missing. It warns
  `Its reasoning is not in any file`, which cannot be known, and it never says the file is unreadable.
  - The `ob_end` side is fixed. The hook side (the brief's Q10: "says did not run") is not.
  - The greeting does say `Drift: not checked (.agents/state.json is unreadable or invalid …)`, but that line comes from the
    drift check that existed before this PR.

Other observations (non-blocking):
- When work is `unknown`, `handleEnd` skips the `OLD LAYOUT` push. So no-git, no-repo and no-transcript in an old-layout
  repo print no `OLD LAYOUT` line (R5).
- An unreadable state.json with no work closes silently (`Session End:`). There was nothing to gate, so this is
  information only.

### Row 7 (B4 / N4): PASS

Both mutants are on their own branches, one commit on the head, pushed through `push-qa.mjs`. Each test file was run once.

| Mutant | Branch / sha | Change | Result |
|---|---|---|---|
| **M5** | `qa/s164d-m5` / `d82ce18a` | `cli-session-end.ts`: `const since = sessionStartFromTranscript(hookPayload.transcript_path) ?? stamp.ob_end_at;` | **killed**: `end-fix-q6` both tests go red (`expected '[session-end] …' to contain 'WORK AFTER /end NOT RECORDED'`). r2-pins, q10, q12, q4, q7 and handoff-guard stay green. The test **named** "M5" in r2-pins calls `checkRecordUpdated` directly, so it does not see a hook-side M5; q6 does |
| **M6** | `qa/s164d-m6` / `dad21637` | `server.ts`: the `""` refusal disabled; `recordOkReason` keeps `""`; both gates test `=== null` / `!== null` (so `""` closes as r1 did) | **killed**: r2-pins "M6: record_ok empty string is refused" goes red (`expected undefined to be true`). q4, q1 and q3 stay green |

On the real path (`s-rows.mjs n2`, both layouts and `--win`), `record_ok: "   "` gives `ob_end refused: record_ok must not
be whitespace only`, and `record_ok: ""` gives `ob_end refused: record_ok must be a non-empty reason`. Both are `isError`.
After them, `git status` is clean and the store is absent, so nothing was written.

### Row 8 (N1): PASS (`s-rows.mjs predirty`)

The fixture: next-session.md left dirty by an earlier session, mtime 5 days old. The session commits `src/a.ts` (only that
file is staged), tags `v2.0.0`, and touches nothing else.
- `ob_end` → `OLD LAYOUT: …` then `RECORD NOT UPDATED: 1 commit(s), tags v2.0.0 since … (next-session.md not modified after
  …)`.
- After an edit in this session, `ob_end` closes (`OLD LAYOUT: …`, `Session End:`).

### Row 9 (N2, N3, N6)

- **N2: PASS.** The old-layout refusal now carries the line: `OLD LAYOUT: nothing writes the handoff for you; …` and then
  `RECORD NOT UPDATED: 1 commit(s), tags v1.0.1 since …`. The gap on cannot-check paths is R5.
- **N3: PARTIAL (R3, Low).**
  - `ob_end` on untrailered-only master commits: `OLD LAYOUT: …` / `2 commit(s) in the window carry no Claude-Session
    trailer (UNATTRIBUTED, not counted)` / `Session End:`. **PASS.**
  - The hook prints `handoff check: no loop/* commits attributed to this session; 2 commit(s) in the window carry no
    Claude-Session trailer: UNATTRIBUTED, not counted for any seat`. The UNATTRIBUTED clause lost its `loop/*`, but the
    line still **opens** with `no loop/* commits attributed to this session` for master work. The row asked for no
    `loop/*` wording.
  - The mixed case (`n3m`) is the same in both places.
- **N6: the three END-FIX files PASS; the handoff marker does not (R4, Low-Medium).**
  - After every close in an old-layout repo (`b2o`, `b1o-*`, `n3`), `git status --short --untracked-files=all` shows no
    `.ob-end-stamp.json`, `.record-ok*.jsonl` or `.work-after-end*.jsonl`.
  - **Where they are now:** `<dirname(KNOWLEDGE_V2_DB)>/end-record/<sha256(canonicalizeProjectDir(resolve(project)))>/`
    (`end-record-store.ts`). With the default DB, that is `~/.claude/open-brain/end-record/<64-hex>/`. The files there are
    `.ob-end-stamp.json`, `.record-ok.jsonl`, `.record-ok.shown.jsonl`, `.work-after-end.jsonl` and
    `.work-after-end.shown.jsonl`.
  - **R4:** whenever `HANDOFF MISSING` fires, `handoff-guard.ts` still writes `.agents/SESSIONS/.missing-handoff.jsonl`,
    then `.shown.jsonl`, **inside the repo**.
    - After the `record_ok` close with work after it (`n2`, old layout, both path styles), `git status` shows
      `?? .agents/SESSIONS/.missing-handoff.shown.jsonl`. The next `git add -A` commits it.
    - E1 made that marker reachable from master work in any project, so it is now N6's problem too.
  - **R8 (Low):** the `.shown.jsonl` files are only ever appended to.
- **N6 key (`probe-key.mjs`, against the built store): PARTIAL (R6, Low).**
  - Same key `0ed6acd4…`, correct for one project, for all of: `C:/qa-tmp/qa291/repos/keyprobe/Proj`, the backslash
    spelling, `c:\QA-TMP\…\KEYPROBE\proj\`, and `C:/qa-tmp//qa291/…/Proj/`.
  - A different key for `…/Proj2`.
  - **However, two real projects that differ only by case collide.**
    - `canonicalizeProjectDir` lowercases the whole path whenever it starts with a drive letter. NTFS supports
      case-sensitive directories (`fsutil file setCaseSensitiveInfo`, which WSL uses).
    - With that enabled on `…\keyprobe\cs`, `cs\Proj` and `cs\proj` both exist, and both map to `c0172882…`. They would
      share a stamp and markers.
    - On default (case-insensitive) NTFS, two such projects cannot exist, and slash direction can never make two projects.
    - Linux paths are not lowercased, so they never collide.
    - **Fix:** key on `realpathSync.native` (the on-disk case) rather than on a lowercased string.
- **R7 (Low):** with a payload that has no session id but a transcript (`noproof` hook), `checkSessionHandoff` skips the E2
  record check (`sessionUuid` is empty) and reports `HANDOFF MISSING: session (no id) committed 1 commit(s) on master`.
  Without an id, the record cannot be checked, so this should be `NOT RUN`.

### Row 10 (Windows): same results as rows 4, 6 and 9

`node multi.mjs --win …`: repos at `C:\qa-tmp\qa291\repos\win space\…` with `core.autocrlf=true`, CRLF prose files
(`nextSessionCRLF: true` on the old layout; on the new layout `ob_state` renders next-session.md with LF), and a CRLF
transcript. `project_root`, `transcript_path` and `CLAUDE_PROJECT_DIR` are all backslash paths.
- **Row 4:**
  - `b1n-src`: `WORK AFTER /end NOT RECORDED: …` in the hook and greeting #1, none in #2. **PASS.**
  - `b1o-src`: the same. **PASS.**
  - **`b1n-all` and `b1o-all`: `work-after-end check: 1 commit(s) after ob_end and record updated`, and no marker (R1).**
  - The stamp written by the server (backslash `project_root`) is found by the hook (backslash `CLAUDE_PROJECT_DIR`).
- **Row 6:**
  - No git and no repo: `RECORD NOT CHECKED` and both hook checks `NOT RUN`. **PASS.**
  - **No transcript: the hook prints `work-after-end check: no commits after ob_end` (R2).**
  - **Unreadable state.json: the hook prints `HANDOFF MISSING` and `WORK AFTER`, and does not name the file (R2).**
- **Row 9:**
  - N2: the refusal has `OLD LAYOUT` (PASS).
  - N4/M6: refused (PASS).
  - N3: the same wording as above (R3).
  - N6: no END-FIX file in `git status`, but `?? .agents/SESSIONS/.missing-handoff.shown.jsonl` appears (R4).

### #489 findings

| ID | Severity | Finding |
|---|---|---|
| **R1** | **High** | B1 open: a record written before `ob_end` and committed in the post-`/end` commit (`git add -A`) counts as "updated after /end", so no marker is written, on both layouts and on Windows. This is QA 289's q3 fixture. Q6 pins only the `git add <file>` shape |
| **R2** | **Medium** | B3 open in the hook: no transcript gives `work-after-end check: no commits after ob_end` despite a trailered commit after `ob_end`; an unreadable state.json is never named in the hook, and both checks run and warn as if the record were missing |
| R4 | Low-Medium | N6: `.agents/SESSIONS/.missing-handoff*.jsonl` still lands untracked in the repo whenever `HANDOFF MISSING` fires, now reachable from master work |
| R3 | Low | N3: the hook line opens with `no loop/* commits attributed to this session` for master-only untrailered work |
| R5 | Low | No `OLD LAYOUT` line when `ob_end` prints `RECORD NOT CHECKED` on an old-layout repo (E2 says "every time") |
| R6 | Low | Store key: two projects differing only by case in a case-sensitive NTFS directory share one key (`c0172882…`) |
| R7 | Low | Hook with no session id and master work: `HANDOFF MISSING: session (no id) …` instead of `NOT RUN` |
| R8 | Low | The `.record-ok.shown.jsonl` and `.work-after-end.shown.jsonl` files in the store grow without bound |

**What would turn #489 to ACCEPT:**
1. R1: tie E4's "record updated" to record *content* changing after the stamp, and add a sweep-shape Q6 test.
2. R2: report `NOT RUN` in the work-after branch when the transcript gave no ids; name an unreadable state.json in the hook,
   and do not report `HANDOFF MISSING` from it.

## #498 IMPORT-CMDS r2: ACCEPT

### Row 11 (L1): `/bootstrap` as written. PASS (`s-import.mjs l1`)

The fixture is a pre-state project built as QA 290 did:
- the template `.gitignore`;
- P0–P3 INBOX with 4 tasks, `task.md`, `SUMMARY.md`, `next-session.md` and `Session_3.md`;
- old `start.md` and `end.md`, plus `other.md` and `settings.local.json`;
- one commit, "The project before SIA".

I followed the text step by step and ran no git command the text does not name:
1. **Step 1** `check`: `PRE-STATE — TASKS/ with no state.json (the import path)` / `commands:  start.md OLD; end.md OLD;
   task.md absent; sync.md absent` / `Next: … Run \`state import --draft\`. After \`state import --commit\`, run \`bootstrap
   install-commands\`.` (I1)
2. Install before the import (I2): exit 1, `refused: .agents/TASKS/ exists with no state.json — run \`state import --commit\`
   first. Nothing written`.
3. **Step 6** `--draft`: `Validates: yes`, `Tasks: 4`. **Step 7** `--commit`: exit 0. The status shows the record and its
   four views (5 changes).
4. **Step 7b** `install-commands`, **with no git commit in between**: exit 0, `Archive: .agents/archive/pre-bootstrap-
   commands-2026-10-07/`, then `start.md: OLD -> SIA`, `end.md: OLD -> SIA`, `task.md: absent -> SIA`, `sync.md: absent ->
   SIA`.
   - All four files are byte-identical to the template.
   - The archive holds `start.md` and `end.md`.
   - The snapshot diff names only those files (I6: `other.md` and `settings.local.json` are untouched).
   - `check` then reads `BOOTSTRAPPED`, with all four `SIA`.
5. **Step 8** `git status --short --untracked-files=all` lists exactly the text's nine paths: `M` the four views, `M`
   `start.md` and `end.md`, `??` `state.json`, `sync.md` and `task.md`. There is nothing extra and nothing missing. (My
   script's raw extra/missing line shows one path with a dropped leading `.`. That is my driver trimming the first porcelain
   line, not the product.)
6. `git add -A; git commit -m "Bootstrap SIA"` gives **one commit** after the base, and a clean tree.
7. A fresh `ob_start` (real MCP) has **no** `OLD /start` line. Before 7b the same call printed `OLD /start in this project:
   run bootstrap install-commands` once (I7).

**Any other dirty path still refuses, naming it** (`l1-dirty`):
- `refused: uncommitted change outside the import (\`README.md\`) — commit or stash it first. Nothing written`;
- the same for an untracked `scratch.txt`.

Exit 1 both times, and the snapshot diff is NONE.

### Row 12 (L2): nothing written and rollback PASS; **the Windows refusal names the wrong fix (P1); a copy survives a forced failure (P2)**

- **Read-only attribute** (`l2-attr`: `attrib +R .claude\commands`):
  - Windows does not enforce `R` on a directory. Node and PowerShell can both create files there, and `accessSync(W_OK)`
    passes.
  - `install-commands` installs normally (exit 0, 4 × `-> SIA`). That is correct, since the directory is writable. No
    refusal can be produced this way on Windows.
- **ACL deny** (`l2-acl`: `icacls .claude\commands /deny desktop-0gv3had\aaron:(OI)(CI)(W,D,DC)`):
  - The deny is enforced against PowerShell (`UnauthorizedAccessException`). **It is not enforced against this elevated
    Node process**, which can still create and rename files (`acl-probe.mjs`).
  - `accessSync(W_OK)`, which is what `preflightInstallCommandsWrite` calls, **passes**. Node documents that `fs.access`
    ignores ACLs on Windows, and libuv never reports a directory read-only.
  - The result: exit 1, `refused: uncommitted change outside the import (\`.claude/commands/end.md\`) — commit or stash it
    first. Nothing written`. The snapshot diff is NONE, and there is **no archive dir**. Under the deny, git lists the
    unchanged `end.md` as modified, so the dirty-tree check refuses before the preflight is reached.
- **A real rename failure** (`l2-lock`: PowerShell holds `end.md` open with `FileShare.None`; it is a child of the driver,
  not detached, and is killed afterwards):
  - Exactly the same refusal as the ACL case, the snapshot diff is NONE, and there is no archive dir. Git again lists the
    locked file as modified.
  - After the lock is released, the install succeeds.
- **P1 (Low-Medium, non-blocking).** On Windows, every unwritable or locked case I could produce was refused safely, with
  nothing written. But the advice is `commit or stash it first`, which does not fix it: `git status` then shows nothing to
  commit once the lock or ACL is gone. The preflight's own sentence (``.claude/commands/` is not writable — fix
  permissions``) is unreachable on Windows. The r2 commit `1236d958` dropped the chmod-0555 test, so the preflight is
  pinned only through the `preflightWrite` seam.
  - **Fix:** probe by actually creating and removing a temp file in `.claude/commands/` and `.agents/archive/`, and run it
    before the dirty-tree check, or have the dirty check name an unreadable path as unreadable.
- **Forced failure after the first rename** (`l2-seam`, through `installCommands`' own `deps.rename` seam). The fixture has
  start `OLD`, end `SIA`, task `absent` and sync `OLD`. The seam makes the rename of `sync.md` throw.
  - Rename calls: `start.md`, then `sync.md`. The error is `QA291 seam: rename of sync.md fails. Nothing written`.
  - **Every rename was rolled back:** `start.md` is byte-identical to before, and the archive dir is removed.
  - **P2 (Low-Medium, non-blocking):** the snapshot diff is `+ .claude/commands/task.md`. The copy into the `absent` slot,
    made between the two renames, is not in `rolledBack`, so it stays, and the message says `Nothing written`.
  - The file is the template's own `task.md`, so a re-run treats it as `SIA` and it is benign, but the sentence is untrue.
  - **Fix:** record created files and unlink them on rollback.

### Row 13 (L3 and L4): PASS (`l3`, and step 7b above)

- I installed and committed in a `core.autocrlf=true` repo, deleted the four commands, and ran `git checkout --
  .claude/commands`. The files on disk now have 152, 61, 9 and 42 CR bytes, and the status is clean.
- `check`: `start.md SIA; end.md SIA; task.md SIA; sync.md SIA`. `ob_start` has no `OLD /start` line.
- A re-run gives exit 0, `SIA -> SIA (unchanged)` ×4, a snapshot diff of NONE, and a clean status.
- **L4:** a re-run straight after the install, on the dirty import tree (step 7b, before step 8), gives exit 0 and `SIA -> SIA
  (unchanged)` ×4.

### Row 14 (Windows; QA 290's row 8, not run there): PASS (`s-import.mjs win` with `QA_OB` set to the autocrlf tree)

- `git -c core.autocrlf=true worktree add "C:/qa-scratch/qa291-crlf tpl" f3aba754` (a spaced path). `check-attr`:
  `text: set`, `eol: lf`. The four template commands have **0 CR bytes**: the repo's `.gitattributes` wins over autocrlf, as
  QA 290 saw on Linux. I built that tree, so the CLI's default template is this checkout.
- The project is `C:\qa-tmp\qa291\repos\import win space\my project` with `core.autocrlf=true`, and its old `start.md` and
  `end.md` are CRLF (3 CR in start).
- **I1:** `start.md OLD; end.md OLD; task.md absent; sync.md absent`, and `Next:` names install-commands.
- **I3:**
  - Step 7b with no commit in between: 4 × `-> SIA`.
  - All four are byte-identical to the template.
  - The archive holds the two CRLF old files, and step 8 lists exactly the nine paths.
  - One `Bootstrap SIA` commit.
- **I7:** the `OLD /start` line appears once before the install and not after.

## #499 T-247 r2: ACCEPT

### Row 15 (J1): PASS

`j1probe.mjs`, `writeSummary` on a fresh temp vault per date, through the built head:

| `date` | Result | `Summaries/` created |
|---|---|---|
| `2026-13-01`, `2026-00-00`, `2026-02-31`, `2026-02-29` | `VaultPathRefusal: summary date is not a valid calendar date, got "…"` | no |
| `../x`, `../../escaped`, `2026-10-07T00:00`, `""`, `" 2026-10-07"`, `"2026-10-07\n"` | `VaultPathRefusal: summary date must be YYYY-MM-DD, got "…"` | no |
| `2028-02-29` (a leap day) | written: `Summaries/2028-02-29-proj.md` | yes |
| `2026-10-07` (today's ISO date) | written: `Summaries/2026-10-07-proj.md` | yes |
| `0000-01-01` | written (a valid proleptic date: digits and dashes only, so no traversal; information only) | yes |

Mutants, each one commit on the head, pushed, with `vault-writer.test.ts` run once:

| Mutant | Branch / sha | Change | Red test (only) |
|---|---|---|---|
| QA 288's (b) | `qa/s164d-m499b` / `b690203b` | `assertPathUnderDir` returns at once | "T-247 H1: joinUnderVaultDir keeps summary files under Summaries (pins assertPathUnderDir)", 1/24 |
| Calendar | `qa/s164d-m499cal` / `2cfea109` | the round-trip comparison dropped, the NaN check kept (so `2026-13-01` still throws but `2026-02-31` would pass) | "T-247 J1: rejects invalid summary dates before any path is built; accepts today's ISO date", 1/24 |

On the head, `tsc --noEmit` and `typecheck:tests` exit 0, `vault-writer` is 24/24 and `t247-pins-scrub` is 2/2.

### Row 16 (J2 and QA 290's row 11, Windows): the title is right; information below

- The byte test is now titled "rerun after kill with wal_autocheckpoint=0 clears planted secret bytes (**pins VACUUM after
  interrupted UPDATE**)". That says what it pins (J2 fixed). J3 is fixed too: `SUMMARY_DATE_SHAPE_RE` sits after the imports,
  and `vault-writer.test.ts` has one `fs` import.
- **Windows, with the `secure_delete` pragma removed** (`qa/s164d-m499h2` / `ba122242`, `applyScrubDbPragmas` emptied):
  `t247-pins-scrub` gives 1 failed, 1 passed.
  - Red: "sets secure_delete ON during a non-dry scrub run (pins applyScrubDbPragmas)".
  - **The byte test stays green on Windows**, as on Linux.
  - This is information, not a finding. The pragma is pinned by the spy test only.

## Pushed branches

| Branch | Sha | What |
|---|---|---|
| `qa/s164d-m5` | `d82ce18a` | #489 M5 (killed by q6) |
| `qa/s164d-m6` | `dad21637` | #489 M6 (killed by r2-pins M6) |
| `qa/s164d-m499b` | `b690203b` | #499 QA 288 (b) (killed) |
| `qa/s164d-m499cal` | `2cfea109` | #499 calendar mutant (killed) |
| `qa/s164d-m499h2` | `ba122242` | #499 row 16 information run |
| `qa/s164d-report` | this commit | this report and `docs/loops/qa-291/s164d/` |

QA-291: REPORT COMPLETE
