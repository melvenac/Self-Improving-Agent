# QA 289 (s164b): #489 END-FIX (T-246): REJECT

**Verdict: REJECT #489 at pinned head `1dac7b8a528bc2352b3eaf37792d9a2f204a3431`.**
Three gate defects, each reproduced through the real `ob_end` MCP tool, the real SessionEnd hook and the real
SessionStart greeting on temp repos and a temp DB:

1. **E4 misses work after a normal `/end`.** If the record was updated before `ob_end` (by `set_handoff`, or by an uncommitted
   next-session.md edit), then commits made after `/end` leave no marker.
2. **The SessionEnd handoff guard now raises a false `HANDOFF MISSING` for every non-loop session that commits.** It fires even
   after a correct record update, and it is shown again in the next greeting.
3. **Cannot-check paths close silently, or report a pass.** With no transcript, no git, or no repository, `ob_end` closes
   without saying it could not check. The hook's work-after check prints `no commits after ob_end` when git is missing.

Two of my three row-8 mutants also survive every test. Details and exact output lines are below.

- **QA:** QA 289, record session 164, prefix `s164b`. Headless Claude Code (Opus) on the laptop (Windows 10, Node v22.23.2).
- **Dispatch tree:** `git -C C:/qa-scratch/qa289-wt log -1 --format=%H` → `bafb248d7a30d413284cfd294d237c344a444da2`.
- **PR tree:** `C:/qa-scratch/qa289-pr489`, detached at `1dac7b8a528bc2352b3eaf37792d9a2f204a3431`. `gh pr view 489`
  reports `headRefOid 1dac7b8a528bc2352b3eaf37792d9a2f204a3431`, `OPEN`, base `master`.
- **Isolation:** every command ran through a node env wrapper (`docs/loops/qa-289/s164b/run.mjs`, `lib.mjs`). It sets `TEMP`,
  `TMP`, `KNOWLEDGE_V2_DB` (one file per scenario under `C:/qa-tmp/qa289/db/`), `OPEN_BRAIN_ACTIVE_SESSION`,
  `OPEN_BRAIN_SCORE_HISTORY`, `OPEN_BRAIN_SHADOW_LOG`, `OPEN_BRAIN_VAULT_DIR` and `npm_config_cache` to `C:/qa-tmp/qa289/…`.
  Greeting runs also set `HOME`/`USERPROFILE` to `C:/qa-tmp/qa289/home`, and `CLAUDE_CODE_SESSION_ID` is cleared for fixture
  hooks. All repos were under `C:/qa-tmp/qa289/repos/`. I wrote nothing to a live state.json, the real DB, a real vault or a
  settings file. No live Jev call was made, no key was printed, and `gh` was used only to read.
- **How it was driven:** `#489` was built (`npm run build`, `build stamped 1dac7b8`). The MCP server is `node build/server.js`,
  reached over stdio with the SDK client. The session proof is written for the driver's own pid, which is the server's parent.
  The hook is `node build/cli-session-end.js`, with the payload on stdin. The greeting is `node build/cli-bootstrap.js`. The
  scripts are committed under `docs/loops/qa-289/s164b/`.

## Unsandboxed commands

Unsandboxed commands: none.

## Findings

### Blocking

**B1. E4: work after a normal `/end` is not marked (Q6 holds only for the record_ok shape).**
`cli-session-end.ts` re-checks the record with `checkRecordUpdated(dir, since = stamp.ob_end_at, …)`. On the new layout, that
function accepts **any** handoff for the uuid, whenever it was written (`end-record-guard.ts:226-230`). On the old layout it
accepts **any** dirty next-session.md, whenever it was edited (`:258-266`). A record written *before* `ob_end` therefore counts
as the "later record write" that E4 requires.
- New layout (`s-rows.mjs q3`): `ob_state set_handoff`, then `ob_end` closes, then 1 trailered commit, then SessionEnd. The hook
  prints `[session-end] work-after-end check: 1 commit(s) after ob_end and record updated`. No marker is written, and the next
  greeting has no `WORK AFTER`.
- Old layout (`s-rows.mjs q2after`): an uncommitted next-session.md edit, then `ob_end` closes, then 1 trailered commit that
  touches only `src/after.ts`. The output is the same: `work-after-end check: 1 commit(s) after ob_end and record updated`, with
  no marker.
- **This is the normal close path.** worth-it's own `/end` would have taken this path once it was fixed. The PR's Q6 and Q12-Q6
  tests write the stamp directly with `writeObEndStamp` and never update the record, so they cannot see this.

**B2. Regression: `HANDOFF MISSING` now fires for every committing session outside the loop workflow, including correct ones
(row 6).**
`handoff-guard.ts:121-154` now counts work on any branch through `scanSessionWork`. It still accepts only a committed
`docs/loops/*-handoff.md` as a handoff, so `status` is `missing` whenever a master-only session committed anything. E1 said to
keep that rule "as one *kind* of handoff, not the only one". The hook prints the warning, writes `.missing-handoff.jsonl`, and the
next greeting repeats it:
- Q3 after a correct `set_handoff` (`s-rows.mjs q3`): `HANDOFF MISSING: session 28900000-…-0000000000c1 committed 2 commit(s)
  on master since … and committed no docs/loops/*-handoff.md. Its reasoning is not in any file. Write and push the handoff
  before the next /clear (Aaron, record session 109).`
- Q2 after an uncommitted next-session.md update (`q2`), Q2c after a committed next-session.md update (`q2c`), and the Windows
  Q6 (`s-win.mjs q6`): the same line, in SessionEnd and again in greeting #1.
- **Impact:** every worth-it or Makerspace session that does everything right will be told, at its next start, that its
  reasoning "is not in any file" and that it should write a `docs/loops` handoff. That file does not exist in those projects.
- The PR **pins** this behaviour. `tests/shared/handoff-guard.test.ts` now has "T-246 E1: work on a non-loop branch (e.g. master)
  counts as session work when trailered" and expects `'missing'`.

**B3. Cannot-check paths close silently in `ob_end`, and the hook reports a pass (row 5, Q10, and the brief's "must say it could
not check").**
`handleEnd` never looks at `evaluation.work.status === "unknown"` (`server.ts:664-680`). The only cannot-check line is
`RECORD NOT CHECKED`, and it covers only the no-proof case.

| Path | `ob_end` (exact first line) | SessionEnd (exact lines) |
|---|---|---|
| no transcript (proof without `transcript_path`). The repo has a trailered commit, tag `v9.0.0`, and an untouched next-session.md | `OLD LAYOUT: nothing writes the handoff for you; …`, then `Session End:` **closes, silent** | `handoff check NOT RUN: this session's start could not be read …` / `work-after-end check: no commits after ob_end` |
| no git (PATH without git). Same work as above | `OLD LAYOUT: …`, then `Session End:` **closes, silent** | `handoff check NOT RUN: git could not list local branches here` / **`work-after-end check: no commits after ob_end`** (a pass with git missing) |
| not a repository | `OLD LAYOUT: …`, then `Session End:` **closes, silent** | `handoff check NOT RUN: git could not list local branches here` / **`work-after-end check: no commits after ob_end`** |
| unreadable state.json (`{ not json`) | `RECORD NOT UPDATED: 1 commit(s) since … (next-session.md not modified since session start …)`. The new layout is silently treated as the old one, the message never says state.json is unreadable, and it points the agent at `ob_state set_handoff`, which cannot work | `HANDOFF MISSING …` / `WORK AFTER /end NOT RECORDED …`. Nothing says the state.json read failed |
| no proven session (the Cursor shape) | `RECORD NOT CHECKED: this server cannot prove its session (no session proof for this server's parent process …). Session work and record update were not verified …` **(correct)** | `session proof NOT checked: the payload carried no session id` |

The no-transcript case reproduces a real failure. A session whose transcript cannot be read can still ship worth-it's three
commits and two tags and close with no warning. In the hook, `scanSessionWork` returns `status: "unknown", commits: 0`, and
`cli-session-end.ts` reads `commits === 0` as "no commits after ob_end".

**B4. Two of the three row-8 mutants survive every test.** The detail is in row 8. M5 (E4 uses the session start) and M6
(`record_ok: ""` accepted) both stay green across all 12 end-fix files and `handoff-guard.test.ts`. Both change behaviour on the
real path.

### Non-blocking

- **N1. E2, old layout: mtime is never read, and any uncommitted state counts.** In `end-record-guard.ts:274-281`, the mtime
  branch requires `dirty`, but `dirty` has already returned `updated` at `:265`, so that branch is dead code.
  - Consequence 1, a false pass (`s-rows.mjs predirty`): next-session.md was left dirty by an earlier session (mtime 5 days old).
    The current session makes a trailered commit, tags `v2.0.0`, and touches nothing. `ob_end` closes. The brief asks for
    "modified after the session start".
  - Consequence 2, an over-refusal outside the template (`s-rows.mjs ignored`): with `.agents/` gitignored, editing
    next-session.md is never seen. The result is `RECORD NOT UPDATED: 1 commit(s) … (next-session.md not modified since session
    start …)`, and only `record_ok` closes the session. The template tracks next-session.md, so template repos are unaffected.
- **N2. The `OLD LAYOUT` line is missing from the refusal.** E2 says it prints "every time", but the `RECORD NOT UPDATED` return
  drops the preamble.
- **N3. Untrailered-only commits are not reported by `ob_end` (row 6, T-212).** `s-rows.mjs q8` closes with no unattributed
  line. The hook does report them, but as `2 loop/* commit(s) in the window carry no Claude-Session trailer`, and they are on
  master. That `cli-session-end.ts` text predates the any-branch scan. The mixed case is correct:
  `…; 1 commit(s) in the window carry no Claude-Session trailer (UNATTRIBUTED, not counted)`.
- **N4. `record_ok: "   "` (whitespace only) is accepted.** The result is `RECORD OK: closing without a matching record —    `,
  and that blank reason is stored for the greeting. `""` is refused at head, which is correct.
- **N5. The refusal's "since" is the session start.** E3 asked for the last handoff session/rev or the file mtime. The commits
  are named by count, not by SHA.
- **N6. The stamp and marker files land untracked in old-layout repos.** `git status` showed
  `?? .agents/SESSIONS/.ob-end-stamp.json`, so the next `git add -A` commits it. The record-ok and work-after markers behave the
  same way.
- **N7. Test realism.** The Q12 tests have no repo path with a space. The Q12 Q3 and Q6 cases use LF files. Q6 and Q12-Q6 write
  the stamp directly instead of going through `ob_end`. On the head's CI run, the `test-windows` job is `skipped`.

## Rows

### 1. Confined: PASS
`git diff --stat origin/master...1dac7b8a` lists 24 files, 1308 insertions and 61 deletions. All of them are allowed:
- `.claude/commands/end.md`
- `project-template/.claude/commands/end.md`
- `CHANGELOG.md`
- `open-brain/src/`: `cli-bootstrap.ts`, `cli-session-end.ts`, `db-v2.ts`, `server.ts`, `shared/end-record-guard.ts` (new),
  `shared/handoff-guard.ts`
- `open-brain/tests/`: `end-fix-q1` through `end-fix-q12` (`.test.ts`), `end-fix.harness.ts`, `rating-method.test.ts`,
  `shared/handoff-guard.test.ts`

The commits are `87dd842f`, `6fba310a` and `1dac7b8a`. `1dac7b8a` touches no `src` file.

### 2. CI and mutants: PASS
- Head run `37630055218` reads `headSha 1dac7b8a…`, `conclusion: success`. Its jobs are `changed` success, `test` success and
  `test-windows` skipped.
- Each mutant is one commit whose parent is `1dac7b8a`. The diffs are the stated one-liners. The red tests come from
  `gh run view --log-failed` (`ci-reds.mjs`). None of them is unrelated.

| Mutant | Run / sha | Red tests (all are end-fix rows) |
|---|---|---|
| m1, E1 `refs/heads/loop/` only | 37631307220 / `e65b4c76` | 11 tests, 8 files: q1; q11 M1 and M2; q12 Q1, Q3 and Q6; q3; q4; q6; q8; handoff-guard "T-246 E1" |
| m2, E3 warns | 37631314012 / `85bf2908` | 5 tests: q1; q11 M2; q12 Q1 and Q3; q3 |
| m3, E5 counts dedup | 37631319809 / `c0921007` | 2 tests: q11 M3; q9 |

- Local narrow checks on the head (Windows): `npm run typecheck` exit 0 and `npm run typecheck:tests` exit 0. Every end-fix file
  q1–q12, `shared/handoff-guard.test.ts` and `rating-method.test.ts` passed when run singly (1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3,
  17 and 8 tests).

### 3. Q1–Q12, re-derived on the real paths

| Q | Fixture (script) | Result: exact line seen |
|---|---|---|
| Q1 | old layout, 2 trailered commits on master, tag `v1.0.1`, next-session untouched (`s-rows q2`) | `RECORD NOT UPDATED: 2 commit(s), tags v1.0.1 since 2026-10-07T14:25:49.635Z (next-session.md not modified since session start …)` **PASS**. Nothing was written: there was no stamp and no record-ok marker, `git status` was clean, and the vault delta was 0 (`s-worth`) |
| Q2 | Q1, then next-session.md edited | uncommitted edit: `OLD LAYOUT: …` then `Session End:`. Committed edit (`q2c`): closes. **PASS** (see N1 for the mtime gap) |
| Q3 | new layout, commit on master (`s-rows q3`) | `RECORD NOT UPDATED: 1 commit(s) since … (no set_handoff for session …c1 and no sessions[] row …)`. A `set_handoff` for **another** uuid (…ff) still refuses with the same line. After `ob_state set_handoff` (`Revision: 8 → 9`, handoffs `[…ff, …c1]`) the next call returns `Session End:`. **PASS** |
| Q4 | `record_ok` (`s-worth`) | `RECORD OK: closing without a matching record — QA289 deliberately closing without a record update`. Greeting #1: `RECORD OK: session 28900000-…a4 closed without a matching record update — QA289 …`. Greeting #2: none. **PASS (exactly once)** |
| Q5 | reading session, no commits (`q5`, `q5n`) | old layout: `OLD LAYOUT: …` then `Session End:`. New layout: `Session End:`. Hook: `handoff check: no loop/* commits attributed to this session`. No notices in the greeting. **PASS** |
| Q6 | commits after `ob_end`, then SessionEnd | record_ok shape (`s-worth`): `WORK AFTER /end NOT RECORDED: 1 commit(s) since ob_end at 2026-10-07T16:25:09.322Z.` appears once in greeting #1 and not in #2, **PASS**. Old layout with next-session committed (`q2c`): **PASS**. New layout after `set_handoff` (`q3`), and old layout with an uncommitted edit (`q2after`): **FAIL (B1)** |
| Q7 | `loop/qa289-seat` commit plus `docs/loops/qa289-handoff.md`, no set_handoff (`q7`) | `ob_end` gives `Session End:`. Hook: `handoff check: handoff committed (docs/loops/qa289-handoff.md)`. **PASS** |
| Q8 | untrailered commits (`q8`, `q8m`) | mixed: `RECORD NOT UPDATED: 1 commit(s) … ; 1 commit(s) in the window carry no Claude-Session trailer (UNATTRIBUTED, not counted)` **PASS**. Untrailered-only: closes, not refused **PASS**, but `ob_end` does not report them (N3) |
| Q9 | dedup recalls (`s-dedup`, row 7) | **PASS** |
| Q10 | hook: git missing, no transcript, unreadable state.json | every exit was 0. The handoff check says `NOT RUN`. The work-after check says `no commits after ob_end` with git missing or no repository, and nothing about the bad state.json: **FAIL (B3)** |
| Q11 | M1–M3 | **PASS** (row 2) |
| Q12 | Windows | **PASS** (row 9) |

### 4. The worth-it shape, end to end (`s-worth.mjs`): PASS for the shape asked

**Fixture.** An old-layout repo with no state.json. On master there are three trailered commits (`c4722e8e`, `fd82efa3`,
`1091f1d6`). `v0.14.0` and `v0.15.0` are tagged, and `package.json` goes from 0.13.1 to 0.15.0. next-session.md is untouched.

**Steps and output:**
1. `ob_end` refused: `RECORD NOT UPDATED: 3 commit(s), tags v0.14.0, v0.15.0, package.json version changed since
   2026-10-07T14:25:07.186Z (next-session.md not modified since session start …)`. Nothing was written.
2. `ob_end` with `record_ok` closed. The stamp `{"ob_end_at":"2026-10-07T16:25:09.322Z","record_ok":"QA289 …"}` was written.
3. One trailered commit (`13f65b8c`), then SessionEnd. The hook exited 0 with:
   `WORK AFTER /end NOT RECORDED: 1 commit(s) since ob_end at 2026-10-07T16:25:09.322Z. Update the record before the next /clear.`
4. Greeting #1 printed the `RECORD OK` line and the `WORK AFTER` line (and the B2 `HANDOFF MISSING`). Greeting #2 printed none
   of them.

The shape the brief named works. The same shape with a proper record update before `/end` loses the marker (B1).

### 5. Cannot-check paths: FAIL (B3)
The table is in B3. Only the no-proof (Cursor) path says it could not check. No transcript, no git and no repository all close
silently, and the hook's work-after check reports "no commits" on the no-git and no-repo paths.

### 6. Over-refusal: no wrong refusal of a template shape; a wrong warning on every one (B2)
- A reading-only session closes.
- Untrailered-only commits close, and are not reported by `ob_end` (N3).
- The loop seat passes (Q7).
- **Normal shapes that are refused wrongly:**
  - an old-layout repo whose `.agents/` is gitignored is always refused (N1, outside the template);
  - the false `HANDOFF MISSING` warning after every correct non-loop close (B2) is not a refusal, but it is wrong on every
    normal session.

### 7. E5 dedup (`s-dedup.mjs`, real MCP): PASS
1. `ob_store` ids 1 (zebra) and 2 (marmot). `ob_recall purpose:"dedup"` for both.
2. `ob_recalled` returned `No knowledge entries recalled this session.`
3. A real `ob_recall` of zebra, then `ob_recalled` returned `Recalled 1 entries this session (source: recall-log): [1]
   zebra-quokka-flux`. Marmot, recalled only with dedup, is absent.
4. `ob_end` dry_run gave `Recalled ids: 1 from recall-log`. `recall_log` holds `(1,dedup)`, `(2,dedup)` and `(1,null)`.

### 8. My own mutants: two survivors (B4)
Each mutant is on its own branch, in `C:/qa-scratch/qa289-m<N>`, pushed through `push-qa.mjs`. Each test file was run singly.

| Mutant | Branch / sha | Change | Result |
|---|---|---|---|
| (a) E2 old layout ignores an uncommitted edit | `qa/s164b-m4` / `f2dadccf` | `dirty = false && …` in `checkRecordUpdated` | **killed**: `tests/end-fix-q2.test.ts > ob_end closes when next-session.md was updated in the session window` goes red. All other files stay green |
| (b) E4 uses the session start, not ob_end's stored time | `qa/s164b-m5` / `da813082` | `since = sessionStartFromTranscript(…) ?? stamp.ob_end_at` | **survives**: q6, q10, q12, q4, q7 and handoff-guard all green. Real behaviour changes: on `q2c` the built mutant prints `work-after-end check: 3 commit(s) after ob_end and record updated`, and the marker that the head writes is lost |
| (c) `record_ok: ""` accepted | `qa/s164b-m6` / `290fd314` | `!args.record_ok` becomes `=== undefined` | **survives**: q1, q2, q3, q4, q5, q8, q11 and q12 all green. Real behaviour: the head refuses `""` with `RECORD NOT UPDATED…`, while the built mutant closes with `RECORD OK: closing without a matching record — ` and stores the empty reason |

### 9. Windows (`s-win.mjs`, repos in `C:\qa-tmp\qa289\repos\win space\…`, CRLF everywhere, `core.autocrlf=true`, backslash `project_root`, `transcript_path` and `CLAUDE_PROJECT_DIR`): PASS
- **Q1:** `RECORD NOT UPDATED: 2 commit(s), tags v3.1.0 since …`. After a CRLF edit to next-session.md, the next `ob_end`
  closes (`OLD LAYOUT: …`).
- **Q3:** refuses with `RECORD NOT UPDATED: 1 commit(s) … (no set_handoff for session …c12a …)`. After `ob_state set_handoff`
  (`Revision: 7 → 8`) it returns `Session End:`.
- **Q6:** a committed handoff, then `ob_end` closes, then 1 commit, then SessionEnd. The hook printed
  `WORK AFTER /end NOT RECORDED: 1 commit(s) since ob_end at 2026-10-07T16:29:00.924Z.` Greeting #1 shows it and greeting #2
  does not. The B2 `HANDOFF MISSING` also appears.

### 10. `end.md`: PASS
- The two copies are byte-identical (`cmp`).
- Each copy changes 10 lines added and 1 deleted. The deleted line is step 2's recall sentence, which now carries
  `purpose: "dedup"`. Nothing else was removed.
- The new "Record gate" section matches the code: it refuses with `RECORD NOT UPDATED` and writes nothing, `set_handoff` or a
  `sessions[]` write counts on the new layout, a next-session.md edit counts on the old layout, and the `record_ok` reason is
  printed once in the next greeting.
- The section does not mention `RECORD NOT CHECKED`. It also does not say that tags and version bumps count only when they come
  with this session's trailered commits.

### 11. E6 reads (not blocking)
- **(a) Confirmed** (`s-e6.mjs`). The fixture is a `.recalled-entries.json` naming `fc49e982-…` with ids 1 and 2, and no
  recall_log rows for this session.
  - `ob_recalled` returned `No knowledge entries recalled this session. Ignored …\.recalled-entries.json: file describes session
    fc49e982-…, not 28900000-…e6`.
  - `ob_end` returned `Nothing rated: the only candidate file was refused` / `Feedback: 0 entries rated`, and `feedback_log` has
    0 rows.
  - Where the file is written: no writer exists in `open-brain/src`. It is only read, at the project root and at
    `~/.claude/context-mode/.recalled-entries.json` (`cli-session-end.ts:161-162`). The developer names context-mode as the
    writer. I did not verify that, because it is outside this repo.
- **(b) Confirmed by reading.** `server.ts handleEnd`, `pipelines/session-end/*` and `cli-session-end.ts` contain no reference to
  `Session_`/`SESSIONS` apart from the new marker paths. Nothing writes `Session_N.md` at end. `ob_end` writes the vault summary
  only.

## What would turn this to ACCEPT
1. **B1.** Make E4 count only record writes made *after* `ob_end_at`:
   - a handoff or `sessions[]` row whose revision or time is later than the stamp;
   - a next-session.md mtime or commit later than the stamp.

   Add a Q6 test that closes through `handleEnd` after `set_handoff` and then commits.
2. **B2.** Make the SessionEnd handoff guard accept the E2 record (`checkRecordUpdated`) as a handoff, or limit `HANDOFF MISSING`
   to loop seats. Drop the test that pins `'missing'` for master work.
3. **B3.** Make `ob_end` print a cannot-check line whenever `work.status === "unknown"`. Make the hook print `NOT RUN` instead of
   `no commits` in the same case. Name an unreadable state.json as unreadable.
4. **B4.** Add tests that kill M5 (commits before `ob_end` plus a record written in the window) and M6 (`record_ok: ""` refuses).
   Reject a whitespace-only reason (N4).

QA-289: REPORT COMPLETE
