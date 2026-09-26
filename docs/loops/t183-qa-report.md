# T-183 (greeting size): QA report, record session 114

**By:** the QA seat, record session 114, headless on the QA PC `DESKTOP-O4EGB1E`, in `~/Worktrees/sia-qa` (detached
at `7a9468d`), launched by `docs/loops/qa-114/drive.ps1`. 2026-09-26 UTC (2026-09-25 local).
**Dispatch:** `docs/loops/t183-dispatch-qa.md`. **Scored against:** `docs/loops/t183-greeting-brief.md` with Amendment 1,
read from `origin/docs/session-100-qa99-dispatch`.
**Candidate:** code `0f0e7ad` on `origin/loop/t183-greeting` (tip `ee723f9`, handoff only after `0f0e7ad`), base `48acaa8`.
**Model and effort:** `claude-opus-5-5` at effort `high`. Both appear on this process's command line (`--model claude-opus-5-5
--effort high`, read from `Win32_Process`), and the model also appears in the transcript's init line
(`"model":"claude-opus-5-5"`, session `15c335ae-60af-4c00-a2f3-8d96cf7aa2dc`). The transcript does not report effort.
**Concurrency:** one `claude.exe` was running at start: this one (PID 12252, the driver's command line). No other seat's
driver was running.

## Verdict

**The candidate does what the brief asks, and I found no behavioural defect. It fails §2.3's test requirement in two
places, so the verdict is ACCEPT WITH ONE DEFECT TO FIX OR RULE (D1, low-medium), plus lower findings.**

- **T183-1: HONEST NO, as ruled.** Measured with the real `handleStart` on this repository's record, the greeting went
  from **88,686 to 47,489** characters for the developer seat, **91,624 to 50,427** for QA and **96,153 to 54,956** for the
  planner (rev 131), a 43–46% cut. None of these is under 40,000.
- **T183-2, T183-4, T183-5: pass.** T183-5 covers the isolation condition: the diff is exactly the five permitted files.
- **T183-3: pass on behaviour, with one defect in its tests.**
  - Every watch-out, open question, pick-up and loop-state item is byte-identical to `state.json` in **all 73 records
    git holds that this schema reads (revs 53–132), for all four readers**: 2,094 watch-outs and 966 open questions,
    0 failures.
  - Everything outside Verified and Gaps is byte-identical to the base renderer's output.
  - The role files are whole in the live `handleStart` text for all three seats.
  - **But** §2.3 says "a test asserts each", and the candidate's tests do not assert the **loop state** or the **other
    seats' lines**. Mutants that clip loop-state rulings (q10), clip questions for Aaron (q19) or shorten the other
    seats' lines (q18) **pass the full suite on tcm** (run 36209796211). See D1.
- **T183-6: unrun**, as the dispatch says. It needs the main checkout rebuilt after a merge.
- **The developer's drift finding is CONFIRMED.** `greeting-size` under-counts the live greeting by **721 characters** at
  this candidate, for every seat, in this seat's scratch tree. The developer measured 863 on the main tree. Beyond the
  uncounted lines, the composition **differs** from `handleStart` in one line: it drops the seat line's
  `— partner: Atlas`. See D4.
- **Check-not-accept items:**
  - The clip is never silent: 0 breaks in 200,000 fuzz cases, and every one of 2,862 real gap lines is either
    whole or carries the marker with the full length.
  - A reopened claim is shown whatever its age: a mutant that drops it is killed.
  - The omission line's command prints every omitted claim in full, byte-identical, and writes nothing.

## 1. Rows

| Row | Result | Evidence |
|---|---|---|
| T183-1 | **HONEST NO** (Amendment 1) | Live `handleStart`, per seat, in scratch trees (§1.1). The composed figure is the check's own. |
| T183-2 | **pass** | Tests: `state-render.test.ts` 20/20 on tcm (run 36209242314) and locally. Real record: 2,059 clipped + 803 whole planner-seat gap lines over 73 revisions, every one checked against the rule (whole ⇒ ≤140 and one line; cut ⇒ prefix, ≤140, one line, exact marker with `what.length`), 0 failures. Edge cases and fuzz: `evidence/clip-edges.json`. |
| T183-3 | **pass on behaviour; tests short of §2.3 (D1)** | `evidence/verbatim-revisions.txt` (0 failures, 292 renders). Role files: `evidence/live-cand-*.json` (`shared.md` + the seat's own file "whole"; the other two absent, as designed). Survivors q10/q18/q19: §3. |
| T183-4 | **pass** | `greeting-size.test.ts` 5/5 on tcm. Red on the positive and green on the negative, with the count printed in both. My own mutants: q13 (state render not counted) and q14b (ISSUE downgraded to warn) are killed. q11 (the `>=` boundary) survives: D5. Live: `/sync --check` in the candidate tree prints `greeting-size [issue]: greeting is 54235 characters, over the 40000 limit (...)` (planner seat). |
| T183-5 | **pass** | `git diff --name-only 48acaa8 0f0e7ad`: `state-render.ts`, `sync/checks.ts`, `sync/index.ts`, `state-render.test.ts`, `greeting-size.test.ts`. None of `state-schema.ts`, `state-writer.ts`, `state.json`, the importer, `cli.ts` or `harness/*` appears. `0f0e7ad..ee723f9` touches only `docs/loops/t183-developer-handoff.md`. |
| T183-6 | **NOT RUN** (the dispatch rules it unrunnable here) | Expected live size after merge for the developer seat is about 47.5k (my 47,489 in a scratch tree; the developer's inference was 47.4k). Nobody has measured whether that fits one tool result: that limit belongs to the host. |

### 1.1 T183-1 figures (characters of the tool result's text)

Both trees are scratch worktrees, each built from its own commit. The seat is set per run by an `AGENT.local.md` in the
scratch root, and both runs read the record at rev 131 (both commits carry the same record).

| Seat | Before, `48acaa8` (live) | After, `0f0e7ad` (live) | After, composed by `greeting-size` | Uncounted |
|---|---|---|---|---|
| developer | 88,686 | **47,489** | 46,768 (state 24,965, roles 21,198, tree+seat 603) | 721 |
| qa | 91,624 | **50,427** | 49,706 (state 27,197, roles 21,921, tree+seat 586) | 721 |
| planner | 96,153 | **54,956** | 54,235 (state 31,380, roles 22,254, tree+seat 599) | 721 |

At rev 132 (the record at `7a9468d`, swapped into both scratch trees and then restored), every figure is 135 higher:
before 88,821 / 91,759 / 96,288 and after 47,624 / 50,562 / 55,091.

**The composed figures agree with the developer's.** State render 24,965 and role files 21,198 match exactly. My tree
and seat part is 190 characters longer (603 against 413), because a scratch tree prints different tree-currency lines.
The planner's greeting is about 7.5k larger than the developer's, which is where the per-seat profiles follow-up has
the most to gain.

## 2. Verbatim, clip and omission: what was checked beyond the candidate's tests

- **The real record at every revision** (`verbatim-revisions.mjs`). Git holds 118 distinct `state.json` blobs on all
  refs. 73 of them parse under schema v2 (revs 53–132). The other 45 are schema v1, which this build refuses, as
  `ob_start` does. I rendered each of the 73 with the candidate and the base, as planner, developer, QA and the
  unresolved reader, and checked:
  - the own handoff's pick-up, watch-outs and open questions form one contiguous, byte-identical block;
  - every loop-state question and ruling is whole;
  - every line outside Verified and Gaps is identical to the base renderer's output;
  - Verified is exactly the newest 10 plus every reopened claim, in record order, followed by the exact omission line.

  0 failures. **The probe was validated against real defects:** it reports 4,586 failures on the developer's mutant ii
  (built) and 291 on my q18 and q19 combined (built). The evidence is in `evidence/verbatim-revisions-on-*.txt`.
- **The reopened-claim design has only ever been tested on fixtures.** No revision of the record has ever carried a
  `reopened` verified claim, so the real record never exercises it. The candidate's fixture test does cover it, and my
  mutant q1 (reopened claims dropped) is killed by that test.
- **The omission line's command** (`omission-command.mjs`):
  - I ran `node open-brain/build/cli.js state show --json` exactly as the greeting prints it, from the root. Its output
    parses as JSON, and its `verified` array is identical to `state.json`'s. All 67 omitted claims are present, byte-identical.
  - `state.json` and `git status` were unchanged afterwards.
  - Plain `state show` prints only `Verified: 77 · gaps: 39 · decisions: 81`, which confirms the handoff's reason for
    choosing `--json`.
  - Two observations, see D7: the command prints the **whole record, 362,983 characters**, 7× the greeting it replaces,
    and its relative path resolves only from the project root.
- **`clip()` at its edges** (`clip-edges.mjs`): the invariant holds on all 15 named cases and on 200,000 seeded fuzz
  cases. The observed outputs worth recording are in D6.

## 3. Mutants

### The developer's (taken from their branches; each branch differs from `0f0e7ad` in one file only)

| Mutant | Local, win32 (the two T-183 files) | tcm (the developer's runs, whose logs I read: `Machine name: 'tcm'` on each) |
|---|---|---|
| i, marker | KILLED, 5 failed | 36198525222: 5 failed / 1047 passed / 1 skipped |
| ii, verbatim | KILLED, 3 failed | 36198530073: 3 failed / 1049 / 1 |
| iii, threshold | KILLED, 1 failed | 36198534363: 1 failed / 1051 / 1 |
| iv, omission | KILLED, 1 failed | 36198539151: 1 failed / 1051 / 1 |

**Redcheck** `6e5871a` (run 36198349278, tcm): 11 failed, 1,041 passed and 1 skipped.
- 6 render tests fail on their assertions against the base behaviour.
- The 5 `greeting-size` tests fail because the check does not exist at the base.

The candidate itself (developer run 36198351955, tcm) had 1,052 passed and 1 skipped. Every figure matches the handoff.

### This seat's own (`mutants-t183.mjs`)

Every mutant was type-checked with `tsc --noEmit` and run per test. The unmutated control passed 270/270 on the wide
set.

| Mutant | Edit | Result |
|---|---|---|
| q1 | reopened claims older than the newest 10 no longer shown | KILLED (1) |
| q2 | the oldest 10 shown instead of the newest | KILLED (1) |
| q3 | the marker states the cut's length, not the full length | KILLED (4) |
| q4 | a short multi-line text printed whole | KILLED (2) |
| q5 | first-sentence rule removed | KILLED (1) |
| q6 | omission count assumes exactly 10 shown | KILLED (1) |
| q7 | omission line names plain `state show` | KILLED (1) |
| q8 | open questions clipped | KILLED (3) |
| q9 | own pick-up clipped | KILLED (3) |
| **q10** | **loop-state rulings clipped** | **SURVIVED**, and survives the full suite on tcm (run 36209796211) |
| **q11** | **`n > limit` → `n >= limit`** | **SURVIVED**, and survives the full suite on tcm |
| q12 | role files not composed | KILLED (1) |
| q13 | state render not composed | KILLED (1) |
| q14b | ISSUE → `warn` | KILLED (1). My first attempt used `"warning"`, which tsc rejected. See E2. |
| **q15** | **`greeting-size` not wired into `runSync`** | **SURVIVED**, locally on the wide set (sync, server and both T-183 files: 270 tests) and on the full suite on tcm |
| **q16** | **`composeGreeting` ignores the seat (renders as the unresolved reader)** | **SURVIVED**, and survives the full suite on tcm |
| q17 | gaps printed whole again | KILLED (4) |
| **q18** | **other seats' lines cut at 60 instead of 160** | **SURVIVED**, and survives the full suite on tcm |
| **q19** | **loop-state questions for Aaron clipped** | **SURVIVED**, and survives the full suite on tcm |
| q20 | blocked tasks dropped | Survived the two T-183 files. **Killed on tcm by a pre-existing test** (`server.test.ts`, "renders the State section…", run 36209621699). The real record has no blocked tasks (67 open, 2 done), so the new task test cannot see this mutant, but the old suite can. |

**Full-suite confirmation of the survivors:**
- Run 36209621699 applied all seven survivors together and failed only on q20.
- Q20's failing test could have masked the others, so run 36209796211 applied the six without q20: **green, 1,052
  passed and 1 skipped**.

## 4. Full suite and CI

- **Local full suite, the one allowed**, run with the default TEMP (`C:\Users\AARONM~1\AppData\Local\Temp`) as the
  Defender-on control, in `C:\qa-scratch\qa114\cand` at `0f0e7ad`, win32, Node v22.23.3:
  - **72 files, 1,053 passed, 0 failed, 0 skipped, exit code 0, 134 s**, from 01:46:42Z to 01:48:59Z.
  - `paths.test.ts`'s skipped test runs and passes here.
  - The exit code matched the output, so G-042's exit-1-while-passing did not recur.
- **CI on tcm: 4 of 6 runs used.** All were dispatched with `gh workflow run ci.yml --ref <qa branch> -f hosted=false`,
  and each log shows `Machine name: 'tcm'`.

| Run | Branch @ SHA | Runner | Result |
|---|---|---|---|
| 36209242314 | `qa/t183-ci` @ `0f0e7ad` (the candidate) | tcm-1 | success: 72 files, 1,052 passed, 1 skipped |
| 36209655365 | `qa/t183-on-master` @ `df8af3b`: the two code commits cherry-picked onto `origin/master` `8af41dd` (`open-brain/` byte-identical to `0f0e7ad`) | tcm-2 | success: 1,052 passed, 1 skipped |
| 36209621699 | `qa/t183-mut-survivors` @ `cfb3aee` (7 survivors) | tcm-1 | failure: 1 failed (q20, `server.test.ts`), 1,051 passed, 1 skipped |
| 36209796211 | `qa/t183-mut-survivors6` @ `a0c4024` (6 survivors, without q20) | tcm-1 | success: 1,052 passed, 1 skipped |

`origin/master` has moved to `8af41dd` since the base. Its only change is `.github/workflows/ci.yml`, which adds an
opt-in Windows job. `git merge-tree` reports the candidate merges cleanly, and run 36209655365 is the candidate on
that master.

## 5. What could not be verified

- **T183-6**: it needs a merge, the main tree rebuilt and a reconnected MCP server, and neither this seat nor this PC
  has those.
- **Whether ~47.5k fits one tool result.** The limit belongs to the host, and this seat has no instrument for it.
- **The uncounted part under real start conditions.** My 721 comes from scratch trees:
  - the session id was `discovery failed`;
  - no health warnings were raised;
  - no drift was detected;
  - the log path was short.

  The developer's 863 comes from the main tree. The figure moves with those lines, so I report it as a range, 721–863.
- **The reopened-claim path on real data**: the record has never had one (§2).
- **`/sync` in the real seat trees**: I ran it only in the candidate scratch tree, with a planner `AGENT.local.md`
  written by my probe. In each seat tree the check measures that tree's own seat.

## 6. Defects and findings

- **D1 (low-medium): §2.3's "a test asserts each" is not met for the loop state and the other seats' lines.**
  - The candidate's T183-3 tests assert watch-outs, open questions, the objective and the active task titles.
  - They assert nothing about loop-state rulings or questions for Aaron: the planner's real handoff has 21 rulings and
    2 questions, and nothing checks them.
  - They assert nothing about the other seats' named lines.
  - As a result q10, q18 and q19 pass the full suite on tcm. The behaviour is correct today: my real-record probe shows
    all of them byte-identical to the base across 73 revisions. But no test holds them, and these are the lines a
    later size cut would reach for first.
  - Fix: extend the real-record verbatim test to `loop_state` items and to the other seats' lines, or rule the gap
    acceptable.
- **D2 (low): `greeting-size`'s wiring into `/sync` is untested (q15).** Deleting the `checks.push(...)` line leaves
  every test green, and the check would then stop running without a sound. Today it is wired: I saw it in
  `/sync --check` output. A test that runs `runSync` and finds `greeting-size` among the check names would hold it.
- **D3 (low): the composition's seat resolution is untested (q16).** Composing as the unresolved reader under-counts by
  **4,552 (developer) to 10,967 (planner) characters**: the state render comes to 20,413 instead of 24,965–31,380. That
  is enough to turn a planner-seat ISSUE green near the limit. No test catches it.
- **D4 (low, the developer's finding, CONFIRMED): `greeting-size` is a second assembly of `handleStart`, and it has
  already drifted.**
  - It under-counts the live greeting by **721 characters** at this candidate, the same for all three seats, against
    the developer's 863 on the main tree.
  - The uncounted lines are:
    - mode, version and drift;
    - the session number, log path and id;
    - the Sizes block, 6 lines;
    - `Total returned words`;
    - six blank separators.
  - **Beyond the stated exclusions, the composition renders one line differently**: `Seat: Forge (developer)` against
    the live `Seat: Forge (developer) — partner: Atlas`.
  - It also does not mirror the `ROLE KNOWLEDGE PROBLEMS (n):` header or the indentation `handleStart` gives each
    problem. That path was not exercised here.
  - All of the drift runs in one direction, so the check can show **green while the live greeting is up to about
    0.7–0.9k over 40,000**, and more when warnings or drift lines are present.
  - The check's message discloses the exclusions, and the message is honest. The fix the developer names (one assembly
    function called by both) is right.
- **D5 (info): the boundary `n == limit` is untested (q11).** The brief says "above 40,000", and the code agrees; nothing
  pins it.
- **D6 (info): clip outputs worth knowing.**
  - The first-sentence rule cuts at abbreviations and versions: `Use e.g.…` and `Seen at v0.39.…`.
  - A leading newline yields an empty cut (`… (29 chars; …)`).
  - A cut at 140 can split a UTF-16 surrogate pair and leave a lone `\ud83d` before the marker.
  - U+2028 is not treated as a line break.
  - On the real record at rev 132, 28 of 39 gaps are clipped. The shortest kept text is 70 characters, and none is
    under 40. **G-031's first sentence is an amendment header** (`APPENDED AT REV 48, BECAUSE T-151 ITSELF IS ABOUT TO
    LEAVE THE RECORD.`), not the gap's point.

  None of these is silent: the marker is always there.
- **D7 (info): the omission door is correct but heavy.** It prints the full record (362,983 characters), 7× the
  greeting it replaces, and its relative path fails outside the project root. A `state show --verified` would be the
  proportionate door. That is outside this task's file list.
- **Pre-existing, not T-183's:** `/sync --check` in the candidate tree also reports the `retirements` ISSUE for
  `.agents/SYSTEM/ENTITIES.md` (`dream`, `reflection queue`) that the developer named, and a `ci-status` warning:
  master `8af41dd`'s push run failed. It runs hosted, and hosted minutes are exhausted until 2026-10-01; that is my
  inference, and I did not read that run.

## 7. Disagreements with the handoff

- None on the rows. Every figure the handoff states that I could re-measure agrees: the state render and role-file
  parts exactly, the tcm counts, and the redcheck and mutant results.
- **One qualification.** The handoff says of T183-3 that the "objective and every active task title are unchanged".
  They are unchanged, but the task test walks the real record only, which has no blocked tasks. The pre-existing
  `server.test.ts` is what actually catches a dropped status (q20).
- **One addition to the handoff's §4.** The drift is not only "lines not counted": the seat line itself is composed
  differently (D4).

## 8. This seat's error entries

- **E1.** My first `verbatim-revisions.mjs` run reported 260 failures. They were my section splitter's fault, not the
  candidate's: I split sections by indentation, and the **base** renderer prints a multi-line gap's continuation lines
  unindented (the very defect T-183 removes). I switched to splitting on the section headers and re-ran: 0 failures. I
  then validated the probe against two built mutants.
- **E2.** Mutant q14 used the severity literal `"warning"`. `CheckSeverity` is `"warn"`, so tsc rejected it and it never
  ran. It was re-run as q14b and killed.
- **E3.** For the on-master CI run I first built a **local merge commit** (`ae31b1b`, branch `qa/t183-merge`) before
  reading the dispatch's "Never: … merges" as possibly covering it. I deleted it unpushed and used cherry-picks
  instead (`qa/t183-on-master`). No merge ever reached the remote.
- **E4.** `greeting-live.mjs` leaves the last seat's `AGENT.local.md` in the scratch roots (gitignored, in scratch only).
  My `/sync --check` in the candidate tree therefore ran as the planner, which is why it reports 54,235. My local full
  suite also ran with that file present. The role-file test reads whichever seat the tree declares, and it passed.
- **E5.** `mut`'s `build/` is left holding the q18+q19 mutant build from the probe validation. It is untracked scratch,
  and no measurement used it afterwards.

## 9. Reproduction

Scripts: `docs/loops/qa-scripts-t183/` (see its README), with their outputs in `evidence/`. Scratch trees are under
`C:\qa-scratch\qa114\`. Branches pushed, each through `push-qa.mjs` and read back:
- `qa/t183-ci` `0f0e7ad`
- `qa/t183-mut-survivors` `cfb3aee`
- `qa/t183-on-master` `df8af3b`
- `qa/t183-mut-survivors6` `a0c4024`
- `qa/t183-report` (this report)

No other ref was touched, and no `/end` was run (T-163).

## Open for the planner

1. **D1**: should the developer extend the real-record verbatim test to `loop_state` items and the other seats' lines
   before merge, or is behavioural evidence from QA enough? **I recommend fixing it first.** It is a small test
   change, and it is exactly the protection §2.3 asked for.
2. **D2/D3**: fold a `runSync` wiring assertion and a seat-sensitivity assertion into the same follow-up? I recommend
   doing it together with D1, as one small commit.
3. **D4**: the one-assembly fix (move `handleStart`'s composition into a function both call) touches `server.ts`,
   which this brief's file list excluded. Should it go with the per-seat profiles follow-up (my recommendation), or
   on its own?
4. **D7**: should a proportionate door such as `state show --verified` be recorded as a task? It needs `cli.ts`, which
   T-183 excluded.
5. **G-031's first sentence** is an amendment header, so its clipped line says nothing about the gap. Should that be a
   record edit, or a note that the per-seat profiles work should consider?

QA-114: REPORT COMPLETE
