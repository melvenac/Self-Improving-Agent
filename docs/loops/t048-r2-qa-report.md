# T-048 round 2 (session end tells a missing thing from an unreadable thing), candidate `5b9a403`: QA report (QA seat, record session 157)

**By:** the QA seat, record session **157**, headless, launched by `docs/loops/qa-157/drive.ps1` (Claude session
`9635a62e-b0c1-4d83-8aa8-5daa367bff8d`). 2026-09-27 (UTC). **Machine:** `DESKTOP-O4EGB1E` (`$env:COMPUTERNAME`).
**Elevated: yes.** `net session` succeeds, and `WindowsPrincipal.IsInRole(Administrator)` is `True` for this process
tree. This matters for one probe: see "What could not be verified". **Defender exclusions** (`drive.meta`):
`C:\qa-scratch`, `C:\qa-tmp`. Probes and mutants ran with `TEMP=TMP=C:\qa-tmp`. The one full-suite control ran with
the default `TEMP` (`QA_DEFAULT_TEMP`, `C:\Users\AARONM~1\AppData\Local\Temp`, not excluded). **Model and effort:**
`claude-opus-5-5` on every assistant message in `%USERPROFILE%\sia-qa157\run-0.jsonl`. Effort is **`high`**, read
from this process's command line (`claude.exe -p … --model claude-opus-5-5 --effort high`, pid 10004).
**Dispatch:** `docs/loops/t048-r2-dispatch-qa.md`. **Candidate:** `5b9a403` on `origin/loop/t048-r2` (handoff
`df78b37`, `docs/loops/` only after it). **Base:** `1646567`. **Brief:** `docs/loops/t048-r2-brief.md`. **Audit:**
`docs/loops/research/t048-silent-drops.md` on `origin/master`, rows SILENT 5, 6, 14, 15 and 16.
**Scripts and outputs:** `docs/loops/qa-scripts-t048-r2/` (each script's first lines give its usage; outputs in `evidence/`). **Nothing live was written.** Every run pointed `HOME`, `USERPROFILE`, `KNOWLEDGE_V2_DB` and `OPEN_BRAIN_VAULT_DIR` at
`C:\qa-scratch\qa157\…`. This PC has no `~\.claude\context-mode` and no `~\.claude\open-brain`, and I created neither.

## Verdict

**ACCEPT `5b9a403`.** Every distinction the brief names is a distinct value, and all but one reach a printed line.
That exception is SILENT 6 (**T048-D1, Medium**; not blocking in my verdict). Nothing new crashes. One real crash is
gone: a garbage session db used to throw `SQLITE_NOTADB` out of session end at `1646567`, and it is now a named skip.
The `helpful`/`neutral` rule and the "an omitted judgment is never a neutral" rule hold. `server.ts` is untouched. The
scorer and types changes change no score for 256 inputs.

- **T048-D1 (Medium): SILENT 6's name reaches no printed line.** `readLastInvocationTs` now returns `null`, `corrupt`
  and `unreadable: <reason>` for the three log states, and `scorePipelineHealth` puts that word in
  `details.invocationLog`. But every human-readable score route prints the same text for all three:
  `Pipeline Health: 0/10`. That covers `open-brain sync --score`, MCP `ob_score`, and `ob_sync --score`, which the
  source calls "the route actually used in practice". Only `sync --score --json` carries the word. So the brief's
  "the health score says which" is true of the returned object, and a person reading the score still cannot tell a
  corrupt log from a missing one. The fix is one line per renderer. `cli.ts` could take it now. The two `server.ts`
  renderers belong in the SILENT 4/9 round, which owns `server.ts` ("Open for the planner" 1).
- **Low:**
  - **T048-D2:** a readable SQLite file with no `session_meta` (a zero-byte `.db`, or a foreign db) is reported as
    `unreadable while finding session db: no such table: session_meta`. It is readable. It just holds no session.
  - **T048-D3:** three of my six mutants survive the named files locally and the full suite on tcm. The hook's own
    printed lines are untested (`hook-old-lines`). No test says a named log state scores like a missing one
    (`s6-corrupt-earns-recency`). No test puts an unreadable db beside the db that holds the session
    (`s14-skip-over-match`). Built, each one changes real output.
  - **T048-D4:** comments. `readLastInvocationTs`'s JSDoc now sits on the new `unusableLog` helper and still says
    "or null if the log is missing or unreadable". `unusableLog` is typed `string | null`, never returns `null`, and
    its comment refers to a mutant.
  - **T048-D5:** labels. A zero-byte invocation log reads `corrupt`. A db whose only events are not summary types
    reads `no events`. `no db holds this session` is also printed when the sessions directory does not exist.
- **Found on real inputs, and not this candidate's (pre-existing, out of scope, for the planner):**
  - **R-1: session matching reads `session_meta LIMIT 1`.** context-mode 1.0.169 (npm, unmodified) keeps one db per
    project and every session of the last 7 days (`cleanupOldSessions(7)`). So a session that is not the db's first
    row is never found. The candidate now prints that case as `no db holds this session`, which is a confident false
    statement.
  - **R-2: a second session end on the same day in the same project loses its summary with no reason.**
    `writeSummary` names the file `<date>-<project>.md` and returns `null` if it exists (`vault-writer.ts:225`). This
    is not in the audit. It is the same class as the audit's rows, and both trees print a bare `Summary: skipped`.
  - **R-3: `logInvocations` leaves a handle open on a garbage db** (SILENT 7's area). The candidate newly reaches it
    in one path, because session end no longer throws first. In the hook the process exits, so there is no effect.

## The dispatch's checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1a | SILENT 5: a vanished `knowledge_index` row against an omitted judgment; omitted never stored as neutral | **Holds.** Real file db. The row is removed with `ob_forget`'s own statement (`server.ts:1140`), and the ids come from `recall_log`. The hook prints `Feedback vanished: 1 (no knowledge_index row)` and `Feedback omitted: 2 (no judgment)`. `1646567` printed neither. The omitted id's counters stay `0/0/0` and it gets no `feedback_log` row. | `probe-*.out` s5, hook |
| 1b | SILENT 16: `Feedback: N` counts only writes that landed | **Holds** for three real throws: a dropped table, a trigger `RAISE(ABORT)`, and **another process holding the write lock** (`database is locked` after better-sqlite3's 5 s timeout). Base counted 2, the candidate counts 0 or 1 and prints `Feedback NOT WRITTEN: <id> (<reason>)`. **Under the lock, base's session end THREW (`SQLITE_BUSY`); the candidate finishes.** Behaviour change: a failed event write now also skips the counter update. I agree with it, since the counter and the log now agree. | `probe-*.out` s16; `probe2-*.out` s16lock |
| 1c | SILENT 6: missing, corrupt, unreadable log; what the score reports | **The values are distinct:** `null` / `corrupt` / `unreadable: EBUSY: resource busy or locked …`. The unreadable case is a real file held open with share mode None by another process. **The printed score is identical for all three (T048-D1)**, and only `--json` names the state. | `probe3-s6-*.out`, `score-*.out` |
| 1d | SILENT 14: unreadable session db against no db holding the session | **Holds** on context-mode's own db files: `unreadable while finding session db: file is not a database` against `no db holds this session`. A garbage db beside the real one, in either mtime order, still finds the real one. Mislabels: T048-D2, and R-1 (pre-existing). | `probe2-cand.out` s14, `survivors-cand-s14.out` |
| 1e | SILENT 15: all four skip causes; `SQLITE_NOTADB` at `1646567` | **Holds.** `summary db unreadable: file is not a database` / `no session_events` / `no session_meta` / `no events`. The last two come from real context-mode dbs: constructed with no session, and a session with zero events. **Confirmed at `1646567`:** `sessionEndV2 THREW: SQLITE_NOTADB file is not a database`, and the built hook printed `[session-end] Error: file is not a database`. The developer's red run shows the same throw from `extractSessionSummary`'s first `prepare`. | `probe-base.out` s15/hook, `dev-ci.out` |
| 2 | Nothing becomes a crash; the hook's exit | **Holds.** The built `cli-session-end.js`, run as a process in a scratch home in four states (real db, garbage db only, no sessions dir, garbage db with no session id), exits **0** in every state on both trees. The candidate never prints `Error:`. Base printed it once, in the garbage/no-id state. | `probe-*.out` hook |
| 3 | Preserve: `helpful`/`neutral`; SAFE and INTENDED rows; `server.ts` | **Holds.** Supplied `helpful` on an untagged entry and supplied `neutral` on a tagged one are each stored as given, `method=supplied`, identical on both trees. `git diff 1646567 5b9a403` touches no file with a SAFE or INTENDED site except `index-v2.ts`: its `:15` type is unchanged and its INTENDED `:126` gate still skips. **`server.ts` and `recalled-ids.ts`: no diff.** My `s5-omitted-fabricated` is killed by 4 existing R-010 rows. | `probe-*.out` s5 |
| 4 | Scorer and types: nothing beyond naming | **Holds.** 256 inputs (16 `lastHookRun` values × 4 trends × 4 shadow counts) give the same `score`, `max` and every old `details` key on both trees. The only difference is the added `invocationLog`. The new `Number.isNaN` guard changes nothing, since `NaN <= x` was already false. `details`' widened type has no consumer in `src` (`history.ts` stores `c.score` only). Nit: an unparseable string would be labelled `ran`, but `readLastInvocationTs` cannot return one. | `scorer-sweep.out` |
| 5 | My mutants, at least one per row | **Six, one or more per row.** **3 killed and 3 survive, locally and on tcm** (full suite, 1314 each). The survivors are not equivalent: built, each changes real output (T048-D3). | Mutants |

## Check 1 in detail: what was run

**Real inputs.** The knowledge db is a file made by each tree's own `openV2Database`. Recalls go through
`recordRecallEvent`, and a removal uses `ob_forget`'s exact statement. Session dbs are made by **context-mode 1.0.169's
own `SessionDB`** (`npm pack context-mode`, unmodified, `build/session/db.js`): `ensureSession` plus `insertEvent`, which
leaves the real schema and the `-wal`/`-shm` sidecars (`mkcm.mjs`). A hand-built table is used only where context-mode
cannot produce the state (no `session_events`, a foreign db) or where the state is "not a database" (garbage bytes, a
zero-byte file). Both trees read the sessions directory through the **production default**
(`~\.claude\context-mode\sessions`), made a junction to each variant's directory. The candidate's new `sessionsDir`
parameter is not used, so base and candidate see the same files by the same route. Hook runs are the built
`cli-session-end.js` as a child process, with a stdin payload.

**What each tree printed** (hook lines abridged to the part that differs):

| Input | `1646567` | `5b9a403` |
|---|---|---|
| recalled: one row forgotten, one unjudged (hook) | `Feedback: 0 entries` | `Feedback: 0 entries` / `Feedback vanished: 1 (no knowledge_index row)` / `Feedback omitted: 2 (no judgment)` |
| two rated, `feedback_log` dropped | `Feedback: 2 entries` (counters +1 each, no log rows) | `Feedback: 0 entries` / `Feedback NOT WRITTEN: 1 (no such table: feedback_log), 2 (…)`; counters unchanged |
| two rated, a trigger refuses one | `Feedback: 2 entries` (1 log row) | `Feedback: 1 entries` / `Feedback NOT WRITTEN: 1 (qa157 trigger refuses id 1)` |
| one rated, another process holds the write lock | **THREW `SQLITE_BUSY`** | `Feedback: 0 entries` / `Feedback NOT WRITTEN: 1 (database is locked)`, 5.6 s |
| two rated, no session id | `Feedback: 2 entries` (no log rows) | same. Nothing threw: `recordFeedbackEvent` returns early with no session, as before. |
| invocation log: missing / garbage lines / only a bad `ts` / zero bytes | `null` ×4 | `null` / `corrupt` / `corrupt` / `corrupt` |
| invocation log: a directory / a file another process holds with share mode None | `null` / `null` | `unreadable: EISDIR …` / `unreadable: EBUSY: resource busy or locked …` |
| session db (with target id): garbage | `Summary: skipped` | `Summary: skipped — unreadable while finding session db: file is not a database` |
| … another session's real db only | `Summary: skipped` | `Summary: skipped — no db holds this session` |
| … garbage + the real db for the target (either mtime order) | `written (self-generated)` | `written (self-generated)` |
| … zero-byte `.db`, or a sqlite db with no `session_meta` | `Summary: skipped` | `… unreadable while finding session db: no such table: session_meta` (T048-D2) |
| … the target is the 2nd session in a real db | `Summary: skipped` | `… no db holds this session` (**false**; R-1, pre-existing) |
| newest session db (no id): garbage | **THREW `SQLITE_NOTADB`** | `Summary: skipped — summary db unreadable: file is not a database` |
| … no `session_events` / real db, no session / real db, zero events / only non-summary events | `Summary: skipped` ×4 | `— no session_events` / `— no session_meta` / `— no events` / `— no events` |
| no sessions dir: no id / with id | `Summary: skipped` | `— no session db` / `— no db holds this session` |

**SILENT 6 on the printed score** (`score-*.out`). This is a scratch git project with a scratch knowledge db, and
only the invocation log changes. `open-brain sync --check --score` and `ob_score` print the same text on both trees:
`Health Score: 48/100 … Pipeline Health: 0/10` for missing, corrupt and unreadable. `sync --check --score --json` on
the candidate gives `"invocationLog":"missing"`, `"corrupt"` or `"unreadable"`. That is the only place the word
appears.

**MCP `ob_end` (`server.ts`, not edited)** (`ob-end.out`). The input is one forgotten row, one refused write, one good
write and one unjudged id. Base printed `Feedback: 2 entries rated`. The candidate prints `Feedback: 1 entries rated`,
because the counter is shared, and names nothing. That naming is SILENT 9's round.

## Mutants

Driver `mutants-qa157.mjs`. Each mutant is an anchored substitution set. Every anchor matched **exactly once**, the diff
was non-empty, `tsc --noEmit -p .` exited 0, and the sources were restored and hash-checked after each local run
(`restored: true`). The local run covered seven named files: `t048-r2`, `session-end/index-v2`, `pipeline-health`,
`scorer`, `rating-method`, `server` and `shared/handoff-guard` (84 tests). Then each mutant got one commit on
`qa/t048-r2-mut-<name>` from `5b9a403`, pushed with `push-qa.mjs` and read back, and one `workflow_dispatch` on tcm
(`hosted=false`, `windows=false`), read per test with `ci-read.mjs`.

| Row | Mutant | What it breaks | Head | Local (of 84) | tcm run | tcm red (of 1314) |
|---|---|---|---|---|---|---|
| hook print path (5/14/15/16) | `hook-old-lines` | the hook prints the pre-T-048 three lines again | `d0972fa` | **0** | `36294539144` tcm-2 | **0: SURVIVES** (1312 passed, 2 skipped). Not equivalent (below). T048-D3 |
| SILENT 5 / INTENDED | `s5-omitted-fabricated` | an omitted id is named AND rated from the tag match | `a1f2419` | 4 (rating-method ×2, index-v2 R-010 ×2) | `36294540565` tcm-1 | **4**: rating-method ×2, index-v2 R-010 ×2, all `AssertionError` |
| SILENT 16 | `s16-counter-before-event` | the counter moves before the event write, as at `1646567` | `8fd1a5c` | 1 (t048-r2 SILENT 16) | `36294542139` tcm-1 | **1**: t048-r2 SILENT 16 (`AssertionError`) |
| SILENT 6 | `s6-corrupt-earns-recency` | a corrupt or unreadable log scores as a run within 24 h | `33428ed` | **0** | `36294543682` tcm-1 | **0: SURVIVES** (1312 passed, 2 skipped). Not equivalent. T048-D3 |
| SILENT 14 | `s14-skip-over-match` | any unreadable db hides the db that holds the session | `f931c2d` | **0** | `36294545133` tcm-2 | **0: SURVIVES** (1312 passed, 2 skipped). Not equivalent. T048-D3 |
| SILENT 15 | `s15-notadb-escapes` | the new catch is removed; a garbage db throws out of session end again | `0e98ab7` | 1 (t048-r2 SILENT 15) | `36294546663` tcm-2 | **1**: t048-r2 SILENT 15, killed by the crash itself (`SqliteError: file is not a database`) |

**The survivors are not equivalent** (built from their branches, `survivors-mut.out`):

- `hook-old-lines`: the built hook prints `Summary: skipped` with no reason, and no vanished or omitted line, in
  every state.
- `s6-corrupt-earns-recency`: `Pipeline Health: 4/10` for a corrupt log and for an unreadable one, where the
  candidate gives 0/10.
- `s14-skip-over-match`: a real db for the session beside a garbage db gives
  `Summary: skipped — unreadable while finding session db`, in both mtime orders, where the candidate writes the
  summary.

## The full suite and CI

- **The one full local suite (the Defender-on control):** `5b9a403` in `C:\qa-scratch\qa157\cand`, a full worktree
  (not shallow), with the default `TEMP`. Started 2026-09-27T04:31:37Z: **87 of 87 files, 1314 of 1314 passed,
  0 skipped**, 195 s, exit 0 (`fullsuite-5b9a403.summary`). Nothing else ran locally during it.
- **The developer's CI, read per test by me** (`dev-ci.out`):
  - `36291877179`, red `38b3211`, tcm-2: **5 failed, 1307 passed, 2 skipped (1314)**. These are exactly the five
    t048-r2 rows. The SILENT 15 row fails on `SqliteError: file is not a database` from `extractSessionSummary`, and
    the other four fail on `AssertionError`.
  - `36292013590`, green `5b9a403`, tcm-2: **87/87 files, 1312 passed, 2 skipped**. Matches the handoff.
  - **Five mutants:** `36292064156` (s5), `36292091960` (s16), `36292109835` (s6), `36292133183` (s14) and
    `36292154461` (s15). Each fails **only its own row**, on assertions. s6 also fails the `pipeline-health` row that
    now expects `corrupt`.
  - I read the five mutant diffs. Each is one edit on `5b9a403` that restores what the brief names: the bare
    `continue`, the empty `catch`, the shared `null`, `catch { continue; }`, and skip → `null`.
  - The red commit carries the new test file byte-identical to `5b9a403`'s. The candidate also changes one existing
    assertion (`pipeline-health`: `toBeNull()` → `toBe("corrupt")`), which is SILENT 6's intended change.
- **My CI:** six runs on tcm (budget 6), all `workflow_dispatch` on `qa/t048-r2-mut-*`. Read per test in `qa-ci.out`: 3 red, each on its own row(s); 3 green at 1312 passed, 2 skipped. Every run collected 87 files and 1314 tests. No Windows job and no hosted
  job. No run for the candidate itself: the developer's green run is its record.

## What could not be verified

- **An ACL-denied invocation log.** `icacls <file> /deny "Aaron Melven:(R)"` applied (it is listed in the file's ACL),
  but this **elevated** process read the file anyway on both trees. So "unreadable" was shown with a sharing lock and
  a directory instead. Whether a non-elevated hook sees `unreadable: EPERM` for a denied file was not observed.
- **Aaron's real sessions directory and knowledge db.** Neither exists on this PC. The real-input claims rest on
  context-mode 1.0.169's own writer, which may not be the version Aaron runs. R-1 depends on that version keeping
  several sessions per project db. 1.0.169 does (`cleanupOldSessions(7)`, per-project `<hash>.db`).
- **GitNexus impact** was not run: this headless seat has no GitNexus MCP. The blast radius was read from source with
  `grep`. The changed functions are called only from `cli-session-end.ts`, `index-v2.ts`, `score.ts` and `server.ts`
  (`handleEnd` calls `sessionEndV2`). `server.ts` imports `readLastInvocationTs` and never calls it.

- **`/sync` before this commit:** there is no `/sync` skill in a headless seat. I ran the candidate's `cli.js sync --check .` on the report tree, in a scratch home, as the closest read-only equivalent. Its issues are master's own, not this commit's: a schema-v2 record read by a v3 CLI, no `settings.json`, no local build, and master CI `36a33bc` failure. It wrote nothing: `git status` showed only this report and its scripts directory.

## Defects

| ID | Severity | Defect | Where |
|---|---|---|---|
| **T048-D1** | **Medium** | SILENT 6's name is in `details.invocationLog` only. `sync --score`, `ob_score` and `ob_sync --score` print `Pipeline Health: 0/10` for missing, corrupt and unreadable alike, and only `--json` says which. The brief's "the health score says which" is met by the object, not by anything a reader sees. | `cli.ts:172-176`; `server.ts:168-171`, `:578-581` (not in this round's scope) |
| T048-D2 | Low | `findSessionDb` calls any throw "unreadable", including `no such table: session_meta` from a readable zero-byte or foreign SQLite file. That holds no session; it is not unreadable. | `session-summary.ts` `findSessionDb` catch |
| T048-D3 | Low (test gap) | No test pins the hook's printed lines (`hook-old-lines`), a named log state scoring as missing (`s6-corrupt-earns-recency`), or an unreadable db beside the matching one (`s14-skip-over-match`). All three survive the full suite on tcm (`36294539144`, `36294543682`, `36294545133`). | `tests/t048-r2.test.ts` |
| T048-D4 | Low (doc) | `readLastInvocationTs`'s JSDoc now documents `unusableLog`, and says `null` for unreadable. `unusableLog: string \| null` never returns `null`, and its comment names a mutant. | `invocation-logger.ts:51-65` |
| T048-D5 | Low (labels) | A zero-byte log reads `corrupt`. Only non-summary events reads `no events`. A missing sessions dir with a session id reads `no db holds this session`. | `invocation-logger.ts:87`; `session-summary.ts` |

## Disagreements

- **None with the developer's claims.** The handoff's table, CI numbers and mutant kills all check out.
- **With the brief, mildly:** "the health score says which" was satisfied at the object level, and I score that as
  T048-D1 rather than as met. The brief's own "Done means" asks that each distinction "reaches the printed
  session-end line". SILENT 6's distinction lives in the score, not the session-end line, so the nearest printed
  equivalent is the score line.

## Error entries (my own)

- `probe.mjs` first version: the SILENT 14 case wrote into a sessions directory it had not created (ENOENT), and the
  SILENT 15 case reused one directory across variants, which a leaked handle then pinned (EBUSY). I fixed both: a
  directory per variant, joined by junction to the default path. Then I re-ran s14/s15/s16lock/s6 (`probe2-*.out`).
  `probe-*.out` is the first version; its s5, s16 and hook sections are valid.
- The first lock probe on base printed `SQLITE_IOERR_TRUNCATE` on my own re-read, because I killed the lock holder
  mid-transaction. The holder now releases on its own.
- The first share-lock attempt opened the file with `Read` access and did not block Node's read. `ReadWrite` +
  `None` does (`probe3-s6-*.out`).
- The mutant driver's first `--commit` pass ran `git` through `shell: true`, and Windows split the multi-line commit
  message. Six empty branches were created locally (all at `5b9a403`, never pushed), and the staged mutations
  accumulated in my scratch `mut` tree. I deleted those branches only after checking each pointed at `5b9a403`,
  force-reset the scratch tree, and re-ran. Only `npx` goes through a shell now.
- Heredoc-written scripts lost `\\` escapes in this shell. I edited them with the file tools instead.

## Open for the planner

None of these blocks the merge in my verdict. Each is a recommendation.

1. **T048-D1: where does SILENT 6's word get printed?** My recommendation: when `details.invocationLog` is not
   `ran`, append it to the Pipeline Health line (`Pipeline Health: 0/10 (invocation log: corrupt)`) in all three
   renderers. `cli.ts` can take it in a round 3 of this task. The two `server.ts` renderers go with SILENT 4/9, since
   every in-flight branch touches `server.ts`. Until then, the handoff should not claim the score "says which" beyond
   `--json`.
2. **T048-D3:** three test rows would kill my survivors:
   - run the built hook and assert a named skip on its stdout;
   - assert `scorePipelineHealth({lastHookRun: "corrupt"}).score` equals the `null` score;
   - put a garbage db beside the target's real db and assert the summary is written.
3. **R-1 (pre-existing, a new task):** `findSessionDb` and `extractSessionSummary` match on `session_meta LIMIT 1`,
   and the extractor reads every session's events in the db. With context-mode 1.0.169's per-project db, any session
   after the db's first is "not found", and the no-id path summarises several sessions as one. The candidate's new
   label turns this into a confident `no db holds this session`. Recommendation: match with
   `WHERE session_id = ?`, and filter `session_events` by `session_id`. First confirm which context-mode version
   Aaron runs.
4. **R-2 (a new SILENT row for the audit):** `vault-writer.ts:225` returns `null` when `<date>-<project>.md` exists.
   So a second session end on the same day in the same project writes no summary, and both trees print
   `Summary: skipped` (the candidate adds `(self-generated)`) with no reason (`second-session.out`). It is the audit's
   class, a write that did not happen reading like "nothing to write", and it drops the day's second summary.
5. **R-3 (SILENT 7's area):** `logInvocations` opens each session db and never closes it when a statement throws.
   It is harmless in the hook. In the long-running MCP server it pins a garbage file until GC. It fits the SILENT 7
   round.
6. **`ob_end`** now reports the right count but names nothing (SILENT 9). When `server.ts` opens, have `handleEnd`
   print `formatSessionEndLines(result)` as the hook does. That gives the MCP path SILENT 5/14/15/16 at no extra cost.

QA-157: REPORT COMPLETE
