# Loop 14 — QA report 2: candidate `c7fbdd9`

**By:** Probe (QA seat, same session as report 1, uuid `53ca3ad9`) · **Date:** 2026-09-20,
observations 20:11–20:27Z · **Criteria:** `docs/loops/loop-14-qa-criteria.md` at `a68c358` (§10
added after the planner's ruling on report 1, before this candidate existed) · **Candidate:**
`c7fbdd9345fca02b5c78b846ea0cd2d809aa51e2` on `loop/14-three-seat-record`, eight commits on
`7c7e04b` — the six of report 1 plus `0708df4` (F1–F4 and C2d's sentence) and `c7fbdd9` (whole-batch
session stamping) · **Evaluated in:** `~/Worktrees/sia-qa`, detached at the candidate, porcelain
empty at 20:11:34Z and 20:27:25Z, build stamped `c7fbdd9` (20:12:11Z). The main checkout was not
touched. Report 1 (`docs/loops/loop-14-qa-report.md` at `867790b`) covers `7e1c041`; this report
repeats every row on the new SHA and adds R1–R4.

## Verdict

**All rows pass. Nine from the first table, C2d now met by the ruled sentence, and R1–R4 each seen
red on `7e1c041` and green here.** The suite reproduces the developer's 974 with exit 0 when run
alone; the sync gate shows exactly the one announced issue; fourteen greetings render as the rows
require from the candidate's own build in this tree; every SHA the greeting names matches a by-hand
walk of the record's history across the migration boundary; twelve mutants — the six of report 1
plus one per repaired finding, one for the new batch-stamp fix, and two re-done type-clean — all go
red. **Nothing was widened.** One observation about the suite is recorded first because it is the
kind that gets read wrong later: a run of this suite that overlapped my own fixture building exited
1 with `974 passed` and a `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled error — G-042's
exact signature — and the same suite run alone exited 0. That is the load condition, on this
machine, reproduced on purpose by accident; it is not the candidate's.

| Row | Result | § |
| --- | --- | --- |
| C1 role files by commit; missing / stale / untracked | **pass** | 3.1 |
| C2a seat refusals, `none`, planner `loop_state` | **pass** | 3.2 |
| C2b own handoff, others by SHA (by hand), migration, F-behind | **pass** | 3.3 |
| C2c same-uuid number kept; **whole batch stamped** (new at `c7fbdd9`) | **pass** | 3.4 |
| C2d enumeration incl. the near-miss register — RULED | **pass** | 3.5 |
| C3 command text, refusal shape, `detach` | **pass** on the verifiable half | 3.6 |
| S staleness first, four shapes, no network | **pass** | 3.7 |
| C4 (QA) fourteen greetings scored on printed text | **pass** | 3.8 |
| R1 uncommitted modified other-seat entry → no SHA | **pass** [ruled] | 3.9 |
| R2 reconnect advice only on schema mismatch, says rebuild | **pass** [ruled] | 3.10 |
| R3 `ob_start` refuses unknown `schema_version`, no prose; absent keeps prose | **pass** [ruled] | 3.11 |
| R4 malformed hook payload refuses; no-id payload writes nothing | **pass** [ruled] | 3.12 |
| Preservation | pass, one announced `sync` issue, two rows untestable at base too | 4 |
| Scope fences | pass | 5 |

## 1. Fixed conditions, as run

| | |
| --- | --- |
| Candidate | `git cat-file -t` → `commit` after `git fetch origin`; commits `a80d894 0f276b7 de4674d ff0c482 1e40e23 7e1c041 0708df4 c7fbdd9`. `db9fffb` (the amended commit the planner mentioned) is a dangling object in no branch. |
| Build | `npm ci` exit 0; `npm run build` exit 0; `build-info.json` commit `c7fbdd9…`, 20:12:11Z. |
| Suite, **alone** | `npx vitest run > file; echo VITEST_RC=$?`, 20:17–20:19Z with nothing else running: **`VITEST_RC=0`, 65 files / 974 tests passed**, 117s, **0** lines matching `unhandled\|vitest-worker\|timed out`. Reproduces the developer's 974 (the handoff's §7 still says 960 — a stale sentence from the first candidate, not a wrong count). |
| Suite, **overlapped** (recorded, not the measurement) | The first run, 20:12–20:15Z, overlapped thirteen `git worktree add` operations for the fixtures (20:13:15–20:13:49Z): `974 passed`, **`VITEST_RC=1`**, five lines: `Vitest caught 1 unhandled error … Error: [vitest-worker]: Timeout calling "onTaskUpdate"`, raised during `harness runtime > gates`. G-042 / G-037's signature, load-dependent, on this machine. The clean run above is the row's evidence. |
| GitNexus | first `analyze` exit 1 with the T-055 `file_fts` inconsistency (2 lines); `analyze --repair-fts` exit 0; `analyze` exit 0. One of two analyzes today in this tree fired it (the first, at `7e1c041`, did not). |
| `sync --check` | exit 1, **25 passed, 4 warnings, 1 issue, 0 skipped**; the issue is `mirror-parity: live↔template (.claude): end.md differs`, as announced and unsuppressed. By hand: `~/.claude/commands/end.md` is 42 lines from the candidate's template and 0 from `7c7e04b`'s; the candidate's live and template `end.md` are identical. Global file untouched. |
| Fixtures | Linked worktrees of scratch repositories: `rc` (`origin/master` = candidate) with `cur-{atlas,forge,probe}`, `behind-{atlas,forge,probe}` at `d1b096b` (rev 50, **14 behind**), `auditor`, `noneseat`, `nolocal`, `write`, `v3` (`schema_version` planted 3), `absent` (`state.json` deleted), `malformed` (`objective: 42`, version 2); `rnr` (no `origin/master`); `rahead` (`origin/master` = `7c7e04b`, 8 ahead); `rd` for `detach`; `mut2` for mutants (removed afterwards). |
| Greeting under test | `handleStart` from **this tree's** `build/server.js`; the hook `cli-bootstrap.js` with a `JSON.stringify`-built payload; `HOME`/`USERPROFILE`, `KNOWLEDGE_V2_DB` and (for R4) `OPEN_BRAIN_ACTIVE_SESSION` all in the scratchpad. The real `active-session.json` still holds exactly the 8 scratch keys report 1 §9 disclosed — none added. |

## 2. Shape

Unchanged from report 1 §2 except for the two refusal shapes R3 introduces (§3.11). Probe's
current-tree greeting is 63,648 chars (63,063 at `7e1c041`, 45,208 at base). The stale-tree greeting
is now **1,998 chars** — the refusal — against 68,868 at `7e1c041`.

## 3. Rows

### 3.1 C1 — **pass**

`F-cur`, three seats: `Role knowledge loaded (2 of 2):` with `qa.md / planner.md / developer.md @
876029d 2026-09-19` and `shared.md @ 1e40e23 2026-09-20`; by hand at `c7fbdd9`,
`git log -1 --format=%h -- <file>` → `876029d` ×3, `1e40e23` (the two new commits touch no role
file). `auditor`: `ABSENT (auditor)` + the two problems. Stale (a): `[STALE vs HEAD]` + `ROLE FILE
STALE` on an uncommitted edit to `qa.md`, through `handleStart`. Untracked was observed at `7e1c041`
and the module is unchanged (`git diff 7e1c041..c7fbdd9 -- role-files.ts` empty). `[behind
origin/master]` on every `F-behind` and on `rahead`. Content appended under `## .agents/roles/…`.
`noneseat`: `This checkout is NOT A SEAT (Scratch, role: none)` before the State block. Mutant M3
red (1 of 13).

### 3.2 C2a — **pass**

`rc/write` at rev 56, sha `21fbea2fe227dedc` before each: no `seat` / `seat: auditor` /
`seat: none` → `ops[0] invalid at seat: Invalid option: expected one of "planner"|"developer"|"qa"`;
planner without `loop_state` → the C3 message; **each byte-identical, rev 56, and — new here — with
no reconnect sentence appended** (R2). Planner all-empty `loop_state` → applied, rev 57.

### 3.3 C2b — **pass**

- `F-cur` Probe: `Your handoff — qa, session 70:`; `developer (session 71): close-out c7fbdd9
  2026-09-20`. Forge: `Your handoff — developer, session 71:`; `qa (session 70): close-out c0d69d5`.
  Atlas: `Handoffs (2) — no handoff recorded for this seat (planner):` then both named.
- **By hand:** `git log -- .agents/state.json` at the candidate: `c7fbdd9 7e1c041 de4674d 33a1bf0
  c0d69d5 5b5bd30 …`. Word hashes per revision: **qa** unchanged from `c0d69d5` through `c7fbdd9`,
  different at `5b5bd30` → close-out `c0d69d5`; **developer** changed at `c7fbdd9` (the developer
  amended its own handoff in the fix commit) → close-out `c7fbdd9`. Both match the greeting. No seat
  names `de4674d`. Mutant M4 (bytes not words) red, 3 of 9 — the migration-boundary test is among
  them.
- **`F-behind` (v1 record):** now R3's refusal (§3.11): the STALE banner, then `STATE RECORD
  REFUSED: schema_version: Invalid input: expected 2.` and nothing rendered as anyone's handoff.
- **Migration:** record at the candidate is schema 2, **rev 56**, `handoffs = [qa:70, developer:71]`,
  `last_session {71, …, seat: developer}`; the record's writers on the branch are `de4674d` (52→53),
  `7e1c041` (53→54) and `c7fbdd9` (→56, the batch-stamp fix commit re-wrote the record and the
  developer's handoff). The QA entry is still word-equal to `c0d69d5`'s slot (the hash above).
  Program on a copy of the rev-52 file: dry run unchanged; real → rev 53; second run bytes-equal,
  `already at schema v2 … nothing to do`; `--seat auditor` and no `--seat` refused (exit 1). Module
  unchanged since `7e1c041`.

### 3.4 C2c — **pass**, and the new batch-stamp fix observed

`end_session {72, U1, qa}` → rev 58, `n = 72`. Then **one batch** `[set_handoff qa "…at session
73", end_session {73, U1, qa}]` submitted as session 73: applied at rev 59 with `NOTE: … kept 72
rather than taking 73, and EVERY op in this batch was stamped 72 for the same reason`, and
`handoffs[qa].session` reads **72**, `last_session.n` 72 — the defect the developer found by reading
its own record (`c7fbdd9`'s subject) is closed: no handoff claims a session number that does not
exist. Then `{73, U2, developer}` → 73. Mutants M1b (idempotency, type-clean) red 2 of 36; M12
(`effectiveSession = options.session`) red 1 of 36.

### 3.5 C2d — **pass, RULED**

The developer handoff's §3 table now has the seventh row: *"the near-miss register —
`docs/loops/*-closeout.md`, by family and never numbered — the close-out document"*, followed by the
planner's ruling in words and *"QA was right that the criterion was not met by the candidate it
evaluated, because nothing said so anywhere."* The other six rows sort as in report 1. The sentence is
in a tracked file at the SHA.

### 3.6 C3 — **pass on the verifiable half**

Command text unchanged since `7e1c041` (`end.md` identical to the template; `command-names`,
`command-tool-names` pass). Refusal shape: op refusal without `loop_state`, empty rendered as
`none` in words. `detach` module unchanged (0 diff lines); spot-checked on `rd`: dirty → `REFUSED …
?? dirty.txt`; clean → `verified: detached at c7fbdd9, no branch`. Mutant M6 red 3 of 14. The
planner's live roll is still after the merge.

### 3.7 S — **pass**

First line of every greeting and hook output. `F-behind`: `THIS TREE IS STALE: 14 commits behind
origin/master — record here rev 50, at origin/master rev 56 …` (my count 14). `F-cur`: `Tree
currency: level with origin/master (record here rev 56, at origin/master rev 56) …`. `rnr`: `NOT
CHECKED — origin/master does not exist … This is not a pass.` `rahead`: `8 commits ahead … Not
stale`. `absent`: `record here no record, at origin/master rev 56`. **No network:** `GIT_TRACE` to a
file over a full current-tree greeting: 29 git calls, 0 `fetch|ls-remote|push|pull`. Mutant M2 red.

### 3.8 C4 (QA) — **pass**

Fourteen transcripts, scored on printed text: seat, live loop (`Objective: Loop 14 …` at rev 56), role
files by commit, `Your handoff — <seat>` / `no handoff recorded for this seat (planner)` / `READER'S
SEAT UNRESOLVED`, standing rulings inside the appended `shared.md`. Still absent from any greeting:
open PRs / QA status (every `loop_state` is `null`) and rule counts — C2d's document layer, not a
fail. Pipeline counts at rev 56: `Tasks (35 active; done: 1)`, `Gaps (42)`, `Verified (48)`; I
counted nothing by hand.

### 3.9 R1 — **pass** [ruled]

Seen red at `7e1c041` (report 1 §6 F1). Here, `rc/write` after `set_handoff seat: developer` with
new words and no commit, greeted as Probe:
`developer (session 80): no commit: uncommitted — the working copy of this seat's handoff differs
from HEAD, so no commit contains these words. Commit the record, or read HEAD's version for the
committed one.` followed by the new first line — **no SHA**. The NEW-entry case still reads
`planner (session 72): no commit: no committed handoff for "planner" at HEAD — nothing to trace`.
After `git commit` in the worktree (`bba6266`): `developer … close-out bba6266`, `planner …
close-out bba6266`. Mutant M7b (comparison disabled, type-clean) red 1 of 9.

### 3.10 R2 — **pass** [ruled]

Five plain refusals (no seat, `auditor`, `none`, planner without `loop_state`, and `open_task` with
`priority: "P9"` → `ops[0] invalid at priority`) end at `Nothing written.` with **no reconnect
sentence**. The candidate's `handleState` against a **v1** file: `ob_state refused: .agents/state.json
invalid at schema_version: Invalid input: expected 2 — refusing to write over a file that does not
validate. Nothing written. This process's schema does not match the file's. A RECONNECT ALONE MAY NOT
FIX IT: … Rebuild the checkout this server runs from, then reconnect it, then confirm with
ob_sync's state-schema check …`. The branch is on `error_path === "schema_version"`, data not
wording. Mutant M11 (advice on every refusal) red 1 of 25.

### 3.11 R3 — **pass** [ruled]

Seen red at `7e1c041` (report 1 §3.3). Here, `F-behind` (schema 1) and `v3` (planted 3):
`[isError=true]`, the currency line, seat and role lines, `## Sizes`, then `STATE RECORD REFUSED:
schema_version: Invalid input: expected 2. This build cannot read this record's schema version. NOT
falling back to the prose files: … Rebuild the checkout this process runs from against a commit
carrying the record's schema, then start again.` and **no** `## SUMMARY.md` / `## INBOX.md` /
`## task.md` / `## next-session.md` sections (1,998 / 1,662 chars). `absent`: the prose sections
print as before (`## SUMMARY.md` … `## next-session.md`), per ruling 7. `malformed` (version 2,
`objective: 42`): `state.json invalid at objective: Invalid input: expected object, received number —
falling back to files` and the prose — the developer's stated narrowness, also as ruled. Mutant M10
red 1 of 25. **Limit, as the criteria say:** the main checkout's `7c7e04b` build is unchanged by
this and still falls back to prose against a v2 record until it is rebuilt after the merge.

### 3.12 R4 — **pass** [ruled], including the `{}` case

`OPEN_BRAIN_ACTIVE_SESSION` at a scratch file (`{}`, sha `ca3d163b…`), `HOME` scratch, run from
`/tmp`:
- (a) the backslash payload: **exit 1**, stdout empty, stderr `SessionStart hook REFUSED: the
  payload on stdin is not valid JSON — Bad escaped character in JSON at position 63 … Nothing was
  written: no session was registered and no identity was resolved …`, slot **byte-identical**.
- (b) empty stdin: exit 0, `SESSION_UUID: dc27ca26…` (generated, printed), `Session slot NOT written:
  the payload carried no session id, so nothing was stamped over this checkout's identity. The id
  above is generated for this greeting; register it with ob_set_session.`, slot **byte-identical**.
- (d) `{}`: exit 0, the same two lines with a different generated id, slot **byte-identical** —
  greet-and-write-nothing, one of the two shapes ruled to pass.
- (c) well-formed with id and cwd: exit 0, `Project detected: …/rc/cur-probe`, `SESSION_UUID:
  00000000-…-f1x7`, `Agent: Probe (qa) — partner: Forge`, slot now holds one key for that fixture
  with that uuid — the guard is not a ban.
Mutants M8 (refusal swallowed) red 2 of 13; M9 (slot guard removed) red 1 of 13.

## 4. Preservation

| Behaviour | Observed | Result |
| --- | --- | --- |
| Full suite | 974 / 974, exit 0, 0 unhandled, run alone | pass |
| `sync` 0 failed / 0 skipped | 1 issue, the announced `mirror-parity end.md`; 0 skipped | pass on the announced exception |
| Strict schema | suite; `schema_version` 1 and 3 refused by `ob_start` and `ob_state`, `schema_version: 3` refused by the migrator | pass |
| State block replaces prose (V-025) | every `F-cur` transcript: one `## Sizes`, one `## State`, no `## SUMMARY.md` | pass |
| `ob_start` log reuse | untested (`discovery failed` in fixtures) | untested |
| `AGENT.local.md` wins | `cur-probe` greets as Probe over tracked `developer` | pass |
| T-157 | close `T-003` (cited) + `T-031` (uncited) at 81, write at 90: `Dropped … T-031`, `KEPT … T-003, T-157` with citing files | pass; M5 red |
| Drift detection | untestable at base too (no `**Version:**` line in the rendered SUMMARY) | not a regression |
| Hook prints `SESSION_UUID:` / `Agent:` | yes, below the currency line | pass |
| `state show` writes nothing | sha `21fbea2fe227` before and after | pass |

## 5. Scope fences

`git diff --name-only 7e1c041..c7fbdd9` touches only `open-brain/src/{cli-bootstrap.ts,
server.ts, shared/state-schema.ts, shared/state-writer.ts, pipelines/session-start/*}`, tests, the
developer handoff and the record's files. Nothing under `harness/`, `lifecycle.ts`, `db-v2.ts`,
`pipelines/session-end/`; nothing in recall, the memory-free route or merge gating; no role file
changed. The main checkout untouched.

## 6. Findings — not rows

- **F-A — G-042 reproduced under concurrent load, on this machine, at this candidate.** The
  overlapped run (§1) is the only run today, of nine full-suite runs across three candidates in
  two trees, to show the `onTaskUpdate` timeout, and it is the only one that overlapped heavy git
  I/O. The record's open question — *is the condition present when nothing else is running* — has
  another *no* from the clean run, and its first *yes* under load from this seat. Not the
  candidate's: no harness file changed.
- **F-B — two of my twelve mutants did not type-check** (`if (false && …)` made TypeScript narrow
  the op union and lose `uuid`/`n`; `tsc` exit 2). Vitest runs through esbuild and does not type
  check, so both still went red — for the right behavioural reason — but by the developer's own rule
  in its §9 (*"tsc clean is now part of calling a mutant valid"*) they were invalid as written. Both
  re-done type-clean (`&& prev.n < 0`; `.length < 0`), `tsc` exit 0, both red. Twelve of twelve
  stand on valid mutants.
- **F-C — the handoff's §7 still says 960 tests** where the candidate has 974; the planner's message
  and the clean run agree on 974. A stale sentence, not a wrong measurement; noted so the next
  reader does not "correct" the count downward.
- **F-D — the hook, given `{}` from `/tmp`, printed `Project detected: C:\Users\melve\AppData\Local
  \Temp (.agents/ found)`.** There is a `.agents/` directory in the machine's temp root (not mine;
  not examined). With no `cwd` in the payload the hook reads `process.cwd()` — by design for the
  absent case, and it wrote nothing — but a stray `.agents/` in a temp directory makes an absent-cwd
  hook greet it as a project. Observation only.
- **F-E — T-055 fired 1 of 2 today in this tree** (the second analyze, after eight new commits); the
  repair recovered it. Report 1's 0 of 1 and the previous seat's 5 of 5 bracket it.
- Carried from report 1 and still true: F6 (`nolocal` greets as Forge/developer and renders the
  developer's handoff as its own until the main tree's `role: none` file exists), F8 (the shared
  repo's local `master` is 105 behind), F9 (greeting size), F10 (`build-freshness` on docs commits).

## 7. What could not be verified

Unchanged from report 1 §7: C3's live roll; C4's real fresh-session test; the MCP transport (the
open-brain server serving `ob_start` to this session is still the main checkout's `7c7e04b` build,
never rebuilt or reconnected today); `ob_start` log reuse; G-047 beyond the interleavings tested
(U1, U1-in-batch, U2); the hook against the real home; `PRD.md`; whether printed role content was
read; the stranger's clone beyond `rnr` and `nolocal`.

## 8. Instruments

- `GIT_TRACE` to a file (the modules discard child stderr) — validated on a planted fetch in report 1.
- Hook payloads built by `JSON.stringify` (report 1 §8's lesson).
- The overlapped suite run is named as overlapped and not used as the measurement (§1).
- Mutants: `tsc --noEmit` before each `vitest` run, per the developer's rule; the two that failed it
  were replaced, not counted.

## 9. Side effects

None new. The real `active-session.json` still holds the 8 scratch keys disclosed in report 1 §9
and no others (checked after the last hook run). The `mut2` worktree's junction was deleted as a link
(target entries 171 before and after) and the worktree removed; `git worktree list` is 4.

## 10. Probes

All eight of report 1 §10 re-run where the module changed; new: the whole-batch stamping (§3.4),
the `priority: "P9"` refusal for R2, the planted `schema_version: 3`, the malformed-known-version
record, the empty-stdin and `{}` hook payloads against a pinned slot file, and the committed-then-
greeted R1 case.

## 11. For the planner

Accept on every row I hold. R1–R4 are closed in the code with their seen-red kept in report 1. The
things that remain are choreography, unchanged from report 1 §11: the main tree's rebuild before any
session trusts `ob_start` against the merged record (the old build there still falls back to prose —
R3 protects the next bump, not this one), the main tree's `role: none` file, and the global
`end.md` mirror. Report committed on `qa/loop-14-report` beside report 1; nothing pushed from this
seat.
