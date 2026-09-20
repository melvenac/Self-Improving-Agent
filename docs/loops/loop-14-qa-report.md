# Loop 14 — QA report: candidate `7e1c041`

**By:** Probe (QA seat, fresh session, uuid `53ca3ad9`) · **Date:** 2026-09-20, observations
19:30–19:48Z · **Criteria:** `docs/loops/loop-14-qa-criteria.md` at `92b22f3` (five docs-only
commits on `7c7e04b`, all before the candidate existed; the planner cites `92b22f3`) ·
**Candidate:** `7e1c0418b3aa5bde71d09e195398cb645fa860d0` on `loop/14-three-seat-record`, six commits
on `7c7e04b`, frozen by the planner's message and handed over in writing · **Evaluated in:**
`~/Worktrees/sia-qa`, detached at the candidate, porcelain empty at 19:30:29Z and again at 19:47:44Z,
build stamped `7e1c041` (19:31:04Z). The main checkout was not touched.

## Verdict

**Eight of nine rows pass. One row fails: C2d, the enumeration.** Every row the planner set for the
code — C1, C2a, C2b, C2c, C3's verifiable half, staleness, C4's QA version — passes on the printed
text of the candidate's own build in this tree, with the negative fixtures present at base and
absent at the candidate. **C2d fails on one item:** the near-miss register, which the re-brief
names as the first thing the planner loses at every roll, is sorted nowhere in the candidate — not
into `loop_state`, not into a runtime artifact, and not said in words as "carried by nothing,
still". Four of the five items on the re-brief's list are in `loop_state`; the standing rulings and
the detach procedure are carried by C1 and C3 respectively. The row's pass clause was *all items
sorted, a "still nothing" being a pass*; one is unsorted, so the row is a fail and I do not widen
it. **This is a one-sentence or one-field repair, and whether it is the planner's to rule out of
C2's list or the developer's to add is the planner's call, not mine.** The candidate is otherwise
what the re-brief and its amendment asked for.

| Row | Result | Where the evidence is |
| --- | --- | --- |
| C1 role files by commit; missing / stale reported | **pass** | §3.1 |
| C2a `set_handoff` / `end_session` refuse without a seat, unknown seat, `none` | **pass** | §3.2 |
| C2b own handoff rendered, others by SHA; negative fixture; migration | **pass** | §3.3 |
| C2c second `end_session` for a uuid keeps the number | **pass** (limit documented and observed) | §3.4 |
| C2d the enumeration as the test of the shape | **FAIL** — near-miss register unsorted | §3.5 |
| C3 command text, schema refusal, detach command | **pass** on the verifiable half; live roll not mine | §3.6 |
| S staleness line first, four shapes, no network | **pass** | §3.7 |
| C4 (QA) eleven greetings from the candidate's build, scored on printed text | **pass** | §3.8 |
| Preservation | pass, with the one deliberate `sync` issue the planner pre-announced and two rows untestable at base too | §4 |
| Scope fences | pass | §5 |

## 1. Fixed conditions, as run

| | |
| --- | --- |
| Candidate | `git cat-file -t 7e1c041…` → `commit` after `git fetch origin` (fetched; the branch is not on origin, the commits are in the shared object store). Commits on `7c7e04b`: `a80d894` staleness, `0f276b7` C1, `de4674d` C2 + C3 rows + G-047 + T-157 + `role: none`, `ff0c482` provenance fix, `1e40e23` detach command, `7e1c041` record write 53 → 54. |
| Build | `npm ci` exit 0; `npm run build` exit 0; `build/build-info.json` commit `7e1c0418…`, builtAt 2026-09-20T19:31:04Z. |
| Suite | `npx vitest run > file; echo VITEST_RC=$?` in `open-brain/`, run alone, 19:32–19:34Z: **`VITEST_RC=0`, 65 files / 960 tests passed**, 124s, **0** lines matching `unhandled|vitest-worker|timed out`. Reproduces the developer's 960. Base was 896 / 60. |
| GitNexus | `node .gitnexus/run.cjs analyze` exit 0 first time — T-055's FTS failure did **not** fire (0 of 1 today in this tree; the previous QA seat saw 5 of 5 yesterday). Indexed at the candidate. |
| `sync --check` | exit 1, **25 passed, 4 warnings, 1 issue, 0 skipped.** The issue is exactly the one the planner and the developer announced: `mirror-parity: live↔template (.claude): end.md differs`. Measured by hand: `~/.claude/commands/end.md` is identical to `7c7e04b`'s template (0 differing lines) and 42 lines from the candidate's, and the candidate's live `.claude/commands/end.md` is identical to its `project-template` copy. **No other issue.** The global file was not touched. Warnings: `prd-version`, `vault-index-parity`, `spec-provenance` (all pre-existing) and `command-parity` (the same `end.md`, user scope). |
| Fixtures | **Linked worktrees** of scratch repositories, per the amended criteria: repo `rc` (`origin/master` pinned to the candidate by `update-ref`) with `cur-{atlas,forge,probe}` at the candidate, `behind-{atlas,forge,probe}` at `d1b096b` (record rev 50, **12 commits behind**, 0 ahead), `auditor` (`role: auditor`), `noneseat` (`role: none`), `nolocal` (no `AGENT.local.md`), `write` (for record writes); repo `rnr` with no `origin/master` ref; repo `rahead` (`origin/master` = `7c7e04b`, tree at the candidate, 6 ahead); repo `rd` for `detach`. Every fixture's `git rev-parse --git-path FETCH_HEAD` is the absolute `…/.git/worktrees/<name>/FETCH_HEAD` form. |
| Greeting under test | `handleStart({ project_root })` imported from **this tree's** `open-brain/build/server.js`, and the hook `cli-bootstrap.js` spawned with a well-formed SessionStart payload, both with `HOME`/`USERPROFILE` and `KNOWLEDGE_V2_DB` pointed at the scratchpad so nothing on the machine was written (§9 records the one place this was not true, before the redirect). Eleven transcripts under the session scratchpad, each headed with build commit, fixture HEAD, `origin/master`, behind/ahead counts, porcelain count and the identity file. |
| Record writes | `handleState` from the candidate's build against `rc/write`'s `state.json` only; `sha256` and `revision` read before and after every call. |
| The main checkout | Not moved, built or checked out. Its **build** (`7c7e04b`, 18:13Z) was **imported read-only** once for §3.3 (iii). `PRD.md` unrun, as always. |

**Every "exit 0" and every count below is from a variable or a file, never a pipeline's last stage.
Every detector that returned zero was first shown a planted positive** (the `roles/` grep, the
staleness word count, the `GIT_TRACE` file — see §8 for the one that answered a different question
first).

## 2. What the pipeline printed — the shape, before the rows

The first line of every greeting and every hook output is now the tree-currency line, **above**
`Session Start`, `Project:` and `Drift:`. Then `Seat:`, `Role knowledge loaded (n of m):` with one
line per file `@ <7-char sha> <date>` and flags, `ROLE KNOWLEDGE PROBLEMS (n):` when any, the
`## Sizes` and `## State` blocks, and at the end the loaded role files' content under
`## .agents/roles/<file> @ <sha>`. Probe's current-tree greeting is 63,063 chars against 45,208 at
base (+39%; the developer measured +34% in words). The three current-tree greetings are **no longer
identical across seats**: they differ in the seat line, the role file, the handoff block and the
appended content.

## 3. Rows

### 3.1 C1 — role file and `shared.md` by commit; missing / stale / untracked reported — **pass**

- **Observed, `F-cur`, all three seats:** `Role knowledge loaded (2 of 2):` then
  `.agents/roles/qa.md @ 876029d 2026-09-19` / `planner.md @ 876029d` / `developer.md @ 876029d`,
  and `.agents/roles/shared.md @ 1e40e23 2026-09-20`. **By hand at the candidate:**
  `git log -1 --format=%h 7e1c041 -- .agents/roles/{planner,developer,qa}.md` → `876029d`;
  `shared.md` → `1e40e23` (the candidate's detach commit changed it). All four match.
- **Missing:** the `auditor` fixture prints `.agents/roles/auditor.md — ABSENT (auditor)` and two
  problems: `SEAT ROLE "auditor" IS OUTSIDE THE CLOSED SET (planner / developer / qa) …` and
  `ROLE FILE MISSING: .agents/roles/auditor.md does not exist — … This is absence, not an empty
  ruleset.` Same two lines in the hook output.
- **Stale, reading (a) — RULED required:** with one line appended to `qa.md` in `cur-probe`
  (porcelain ` M .agents/roles/qa.md`), the greeting prints `qa.md @ 876029d 2026-09-19 [STALE vs
  HEAD]` and `ROLE FILE STALE: … differs from HEAD's blob — the rules being read here are NOT the
  rules the repository holds.` The hook prints the same two lines when given a well-formed payload
  (§8 for the run where it did not).
- **Untracked (the developer's fourth condition, not in my criteria):** after `git rm --cached
  qa.md` with the file left on disk: `qa.md @ no commit resolved — not tracked by git [UNTRACKED]`
  and `ROLE FILE UNTRACKED: … on this disk only, invisible to a fresh clone …`.
- **Reading (b) — RULED recorded, not required:** every `F-behind` and the `rahead` fixture print
  `shared.md @ e177ea2 2026-09-19 [behind origin/master]` (or `@ 1e40e23 … [behind origin/master]`
  for `rahead`, whose `origin/master` is `7c7e04b`), flagged and never called stale.
- **Content reached the greeting:** `## .agents/roles/qa.md @ 876029d` and `## .agents/roles/shared.md
  @ 1e40e23` headers with the file text follow the State block in every seat's transcript. The
  hook names the files and does not print the content, which the developer's comment says is
  deliberate; the greeting prints both.
- **Seen red:** mutant M3 (`const stale = false;`) makes `role-files.test.ts` fail 1 of 13; reverted,
  13 pass.
- **The `role: none` line (C2a's fourth case, read side):** the `noneseat` fixture prints, before
  the State block, `Seat: Scratch (none)`, `This checkout is NOT A SEAT (Scratch, role: none) — no
  seat-specific role file is expected here.` and `Seat-taking writes (set_handoff, end_session) are
  refused from a checkout with no seat.`, and loads `shared.md` only (`1 of 1`).

### 3.2 C2a — `set_handoff` and `end_session` refuse without a seat, an unknown seat, `none` — **pass**

On `rc/write` at rev 54, `sha256` `11a5c3238e726788` before every call:

| Call | Result | `state.json` after |
| --- | --- | --- |
| `set_handoff` with no `seat`, dry and real | refused: `ops[0] invalid at seat: Invalid option: expected one of "planner"\|"developer"\|"qa"` | byte-identical, rev 54 |
| `end_session` with no `seat`, real | refused, same message | byte-identical, rev 54 |
| `set_handoff seat: "auditor"`, real | refused, same message | byte-identical, rev 54 |
| `set_handoff seat: "none"`, real (the fourth case) | refused, same message | byte-identical, rev 54 |
| planner `set_handoff` **without** `loop_state`, real | refused: `a planner handoff must carry loop_state - open_prs, frozen_sha, questions_for_aaron and rulings may be EMPTY but not absent (C3)` | byte-identical, rev 54 |
| planner `set_handoff` with all four rows empty (`[]`, `null`, `[]`, `[]`), dry then real | applied, `Applied (1): set_handoff planner` | rev 55 |
| `qa` `set_handoff`, real | applied | rev 56 |

The seat is keyed by **role** (`planner` / `developer` / `qa`), the same value `agent-identity.ts`
resolves from the identity file and `role-files.ts` checks against its closed set; `state-schema.ts`
declares `SeatName` as that enum and the test asserts it equal to the harness's `RoleName`.
**Finding, not a fail (§6 F2):** every one of these refusals — including a plain invalid op against
a schema-valid record — appends *"If the state schema changed this session, this server may be
holding the old one: ask Aaron to run `/mcp reconnect open-brain`"*, which is wrong advice for an op
that was simply invalid.

### 3.3 C2b — own handoff rendered, others named by SHA; the negative fixture; the migration — **pass**

- **`F-cur`, Probe:** `Your handoff — qa, session 70:` followed by the pick-up beginning *"THIS IS THE
  QA SEAT'S HANDOFF for Loop 15 slice two"*; then `Other seats' handoffs (named, not rendered — read
  one by its commit):` `developer (session 71): close-out 7e1c041 2026-09-20` with its first line.
- **`F-cur`, Forge:** `Your handoff — developer, session 71:` (the developer's own close-out, written
  at `7e1c041`; the corrected criterion's alternative — naming `5b5bd30` with none recorded — did
  not arise because the developer's `/end` on the branch gave the seat an entry); other:
  `qa (session 70): close-out c0d69d5 2026-09-20`.
- **`F-cur`, Atlas:** `Handoffs (2) — no handoff recorded for this seat (planner):` in words, then
  both others named: `qa … close-out c0d69d5`, `developer … close-out 7e1c041`.
- **By hand, per RULED (i):** `git log --format='%h %s' -- .agents/state.json` at the candidate reads
  `7e1c041, de4674d, 33a1bf0, c0d69d5, 5b5bd30, 830af70, …`. Hashing each revision's QA entry
  **words** (`pick_up`, `watch_out`, `open_questions`): unchanged from `c0d69d5` through `33a1bf0`
  (v1), `de4674d` (v2) and `7e1c041`; different at `5b5bd30`. So the QA close-out is **`c0d69d5`**,
  as the greeting names and as the developer's §2 predicts; the developer's entry exists only at
  `7e1c041`, so **`7e1c041`**. **The negative case across the migration boundary:** no greeting
  names `de4674d` for any seat. **Seen red:** mutant M4 (comparing `seat` and `loop_state` too, the
  §5.2 defect) fails 2 of 6 in `handoff-provenance.test.ts` — the migration-boundary test exists
  (lines 94–103) and catches it; reverted, 6 pass.
- **`F-behind` (record rev 50, v1), all three seats:** the first line is `THIS TREE IS STALE: 12
  commits behind origin/master — record here rev 50, at origin/master rev 54. …`; after `## Sizes`
  the candidate prints `state.json invalid at schema_version: Invalid input: expected 2 — falling
  back to files` and then the four prose files. **Nothing is rendered as `Your handoff`** — the old
  shape is refused in words, which is the criterion's second acceptable outcome. Observation (§6
  F10): the prose fallback still prints `next-session.md` with `## Pick up here _(written session
  69)_` — the developer's handoff, unattributed — below the banner.
- **Migration, RULED (§9.5):** `state.json` at the candidate is `schema_version: 2`, `revision: 54`.
  The record's commits between `7c7e04b` and the candidate are exactly `de4674d` (52 → 53, the
  migration as its own op, seat `qa`) and `7e1c041` (53 → 54, the developer's close-out) — the
  migration and at most the developer's close-out, as ruled; no other writer. The QA entry's
  `pick_up`, `watch_out` and `open_questions` are **equal** to the slot at
  `git show c0d69d5:.agents/state.json` (three `true`s from a field-by-field compare); `handoffs[]`
  carries `qa` (session 70) and `developer` (session 71); `last_session` is `{71, 2026-09-20,
  48743f25…, seat: developer}`.
- **RULED (ii), the migration program**, on a copy of `git show 7c7e04b:.agents/state.json` (rev 52,
  sha `b4ccf41c…`): `state migrate --seat qa --dry-run` exit 0, file unchanged, five listed
  changes; real run exit 0 → rev 53, schema 2, `handoffs = [qa:70]`, `last_session.seat = null`;
  **second real run** exit 0, `already at schema v2 (revision 53) — nothing to do`, **bytes equal**
  to the first run's output. Refusals, all exit 1 with the file unchanged: `--seat auditor` →
  `seat must be one of planner / developer / qa`; no `--seat` → `--seat … is REQUIRED. A v1 handoff
  does not say whose it is, and guessing would attribute one seat's words to another`; a v1 file
  with `objective` removed → `migrated result does not validate at objective …`; a v2 file with
  `schema_version: 3` → refused as neither v1 nor v2.
- **RULED (iii), the old build on the migrated record — observed, and it is two different
  behaviours:** `handleState` from the main checkout's `7c7e04b` build against a v2 record:
  `ob_state refused: .agents/state.json invalid at schema_version: Invalid input: expected 1 —
  refusing to write over a file that does not validate. Nothing written.` — a refusal that names the
  version, as the planner said. `handleStart` from the same build: **one line**, `state.json invalid
  at schema_version: Invalid input: expected 1 — falling back to files`, followed by the four prose
  files in full (59,084 chars). Not silent; not a refusal either. The candidate cannot change the
  old build; this is a choreography finding (§6 F3), not a row.

### 3.4 C2c — a second `end_session` for the same uuid keeps the number — **pass**

On `rc/write`: `end_session {n: 72, uuid: U1, seat: qa}` → rev 57, `last_session.n = 72`. Then
`end_session {n: 73, uuid: U1}` → applied at rev 58 with **`NOTE: end_session: uuid u1-probe is already
recorded as session 72; kept 72 rather than taking 73 (G-047 …)`** (the note was cut off by my own
`head` on the first run and re-observed in full on a later same-uuid write: *"already recorded as
session 74; kept 74 rather than taking 75"*). Then `end_session {n: 73, uuid: U2, seat: developer}` →
`n = 73`. Then **the documented limit:** `end_session {n: 74, uuid: U1}` after U2 took a number →
`n = 74`, a new number for the returning uuid, exactly as the code comment and the developer's §3
state (`last_session` only is kept). The greeting's `Last session` line agreed with the file at every
step. **Seen red:** mutant M1 (`if (false && …)`) fails 1 of 35 in `state-writer.test.ts`; control
run unmutated 35 pass. The rev-53 → 54 close-out is not a same-uuid case, so the real record does
not yet show the rule working; the scratch record does.

### 3.5 C2d — the enumeration as the test of the shape — **FAIL, one item**

The re-brief's C2 list: *the near-miss register, open PRs and which were QA'd, the SHA frozen for a
QA in progress, questions pending for Aaron, rulings made mid-loop*; its C3 table adds *Aaron's
standing rulings* and *the detach procedure*. Sorted against the candidate:

| Item | Where it lives at the candidate | Sorted by the candidate? |
| --- | --- | --- |
| open PRs and QA status | `loop_state.open_prs[{ref, qa_status, note}]` (`state-schema.ts`) | yes |
| SHA frozen for a QA | `loop_state.frozen_sha` | yes |
| questions pending for Aaron | `loop_state.questions_for_aaron` | yes |
| rulings made mid-loop | `loop_state.rulings` | yes |
| Aaron's standing rulings | `.agents/roles/shared.md`, now loaded and printed by C1 | yes, by C1 |
| the detach procedure | `open-brain detach` | yes, by C3 |
| **the near-miss register** | **nowhere.** `git diff 7c7e04b..7e1c041 \| grep -i 'near-miss'` → nothing; the developer handoff has no such word; it is not a `loop_state` row and not a runtime artifact | **no** |

The pass clause was *all items sorted, "still nothing" said in words being a pass*. One item is
neither sorted nor named. **This is the planner's row to rule** — the register may belong to the
close-out document rather than the record, and the C3 kickoff row named only the four `loop_state`
fields — but it is not mine to decide, and the criterion as written and as it stood before the
candidate is not met.

### 3.6 C3 — the planner's `/end` writes the rows through the command — **pass on the verifiable half**

- **(1) The command text.** `.claude/commands/end.md` at the candidate: `set_handoff {seat, pick_up,
  watch_out[], open_questions[], loop_state?}` with *"`seat` is required and is one of planner /
  developer / qa"*; *"THE PLANNER SEAT MUST PASS `loop_state`, AND THE WRITE IS REFUSED WITHOUT
  IT"*; the four fields with *"Every field may be EMPTY and none may be ABSENT"*; `end_session {n,
  date, uuid, seat}` with the G-047 note. Identical to `project-template`'s copy. `command-names` and
  `command-tool-names` passed in this tree's `sync`.
- **(2) The refusal, RULED either shape.** The planner batch without `loop_state` is **refused** by
  the op (`applyOne`) with the message quoted in §3.2, and the schema carries the same rule as a
  `refine` on `HandoffSchema`; the all-empty batch applies and the greeting renders `loop state:`
  with `open PRs: none`, `SHA frozen for QA: none`, `questions pending for Aaron: none`, `rulings
  made mid-loop: none` — empty rendered in words, absent refused. Not silence.
- **(3) The detach step is a command.** `open-brain detach` on scratch worktrees of `rd`: dirty tree
  → `REFUSED: the working tree is not clean … ?? dirty.txt`, HEAD and branch unchanged; `--dry-run
  --no-fetch` → `would run: git checkout --detach origin/master (from branch tmp1 …)`, unchanged;
  clean → `git checkout --detach origin/master` then **`verified: detached at 7e1c041, no branch`**,
  `symbolic-ref` empty afterwards; a branch with one commit not on `origin/master` → `REFUSED: HEAD
  carries 1 commit(s) that origin/master does not have: 1d7aafd probe: commit not on origin/master
  …`, also under `--dry-run`; `--force --no-fetch` → proceeds, verified, and the branch `tmp2` still
  holds its commit. Target is `origin/master` by name. **Seen red:** mutant M6 (`verifyDetached`
  always ok) fails 3 of 14 in `detach.test.ts`.
- **Not verified and not reported as verified:** the planner's live roll on this loop's close.

### 3.7 S — staleness before the rest of the greeting; four shapes; no network — **pass**

- **Placement:** the currency line is the **first** line of both `handleStart`'s text and the hook's
  output, above `Session Start — project mode`, `Project:` and `Drift: none`; the `Drift:` line is
  three lines below it on `F-cur` and five below on `F-behind`.
- **Behind (`F-behind`, ×3):** `THIS TREE IS STALE: 12 commits behind origin/master — record here rev
  50, at origin/master rev 54. Anything read from the record here describes an older state of the
  project than the one master carries.` then `This compares THIS CHECKOUT to origin/master. It is
  not the drift line: …` and `Compared against the last fetch (fetch time unknown), not the network
  — run \`git fetch origin\` to refresh the comparison.` My count: `git rev-list --count
  HEAD..origin/master` = 12; revisions 50 and 54 read from disk and from `git show
  origin/master:.agents/state.json`.
- **Current (`F-cur`, ×3):** `Tree currency: level with origin/master (record here rev 54, at
  origin/master rev 54) — compared against the last fetch (fetch time unknown), not the network. Not
  the drift line: …` — explicit, names the ref and both revisions. In **this checkout**, where a
  fetch has run, the hook prints `Compared against the last fetch (2026-09-20T19:30:28.890Z)` — the
  time of my own `git fetch origin` at hand-over, so the FETCH_HEAD resolution works in a linked
  worktree.
- **No remote (`rnr`):** `Tree currency: NOT CHECKED — origin/master does not exist in this checkout —
  nothing to compare against. This is not a pass.`
- **Ahead (`rahead`, 6 ahead / 0 behind):** `This tree is 6 commits ahead of origin/master and behind
  by none — record here rev 54, at origin/master rev 52. Not stale; local work is not yet on
  master.` This checkout itself printed the same shape at 6 ahead.
- **No network, RULED:** `GIT_TRACE` set to a **file** (the modules discard child stderr, see §8)
  during a full greeting on `F-behind`: 25 git invocations — `rev-parse` 13, `rev-list` 3,
  `ls-files` 2, `log` 2, `diff` 2, `symbolic-ref` 1, `status` 1, `show` 1 — and **zero** `fetch`,
  `ls-remote`, `push` or `pull`. The same file instrument shows 1 `git fetch` line on a planted real
  fetch.
- **Seen red:** mutant M2 (`behind` classified as `current`) fails 1 of 13 in
  `tree-currency.test.ts`.

### 3.8 C4, QA's version — rendered from the candidate's build in this tree, scored on printed text — **pass**

Eleven transcripts (three seats × `F-cur`, three × `F-behind`, `auditor`, `noneseat`, `nolocal`,
`rnr`, `rahead`), each from `handleStart` of this tree's `7e1c041` build with the hook beside it.
Scored as present in the printed text or absent, no inference and no hand counts:

| Planner's C4 item | `F-cur` greetings |
| --- | --- |
| which seat it is | present: `Seat: Probe (qa) — partner: Forge` etc., from `AGENT.local.md`; `nolocal` prints `Seat: Forge (developer) — partner: Atlas` from the tracked file |
| which loop is live, from the record | present: `Objective: Loop 14 — the three-seat record …` in `## State (state.json rev 54)` |
| which PRs are open and which it has QA'd | **absent** — every `loop_state` is `null` (migration sets it so; the planner has no entry). C2d's "carried by nothing" measured, not a fail of this row |
| the rules in force with their counts | rules present as `## .agents/roles/shared.md @ 1e40e23` content; **counts absent** (they live in close-out documents) |
| Aaron's standing rulings | present, inside the appended `shared.md` |
| which role file it loaded, by commit | present, `Role knowledge loaded (2 of 2)` with commits |
| which seat's handoff it rendered (amendment §3) | present: `Your handoff — <seat>, session N` / `no handoff recorded for this seat (planner)` / `READER'S SEAT UNRESOLVED` |

The pipeline's own counts: `Tasks (35 active; done: 1)` at rev 54 on `F-cur`; `Gaps (42)`;
`Verified (48)`; `Decisions: 55`. I did not count anything by hand for this row.

## 4. Preservation

| Behaviour | Observed | Result |
| --- | --- | --- |
| Full suite | 960 / 960, exit 0, 0 unhandled lines (§1) | pass |
| `sync` 0 failed / 0 skipped | 1 issue, `mirror-parity end.md`, the deliberate one; **0 skipped** | pass on the announced exception; the global file untouched |
| Strict schema refuses unknown keys | `state-schema.test.ts` and `state-writer.test.ts` pass in the suite; `schema_version: 1` refused by the candidate, `schema_version: 3` refused by the migrator | pass by the suite; I planted no extra key myself |
| State block replaces prose (V-025) | every `F-cur` transcript has one `## Sizes`, one `## State`, no `## SUMMARY.md` | pass |
| `ob_start` reuses a registered session's log | **untested** — `Session ID: discovery failed` in every scratch fixture, so the reuse branch never ran there | untested |
| `AGENT.local.md` wins over `AGENT.md` | `cur-probe` greets as Probe while the tracked file says `developer` | pass |
| T-157 retention keeps a cited id | closed `T-003` (cited in 6 tracked files) and `T-031` (uncited; 16 of 35 open ids are uncited, measured) at session 75, then a write at session 80: `Dropped done tasks (retention 3 sessions): T-031`, `KEPT despite retention (id cited in the tracked tree): T-003, T-157`, with the citing files in a `NOTE:` | pass; **seen red** by mutant M5, 1 of 35 |
| Drift detection unchanged | `Drift: none` everywhere; **my plant did not fire and could not**: the detector compares a `**Version:**` line in `SUMMARY.md`, and the rendered SUMMARY has no such line (0 at base and at the candidate) — the version branch is dead against the current SUMMARY shape, before and after | untestable at base too; not a regression |
| Hook prints `SESSION_UUID:` and `Agent: … — partner: …` | present in every hook run, now below the currency line | pass |
| Memory-free door writes nothing | `state show` on `cur-probe`: sha `11a5c3238e72` before and after | pass |

## 5. Scope fences

`git diff --stat 7c7e04b..7e1c041`: 39 files, none under `open-brain/src/harness/`, `lifecycle.ts`,
`db-v2.ts` or `pipelines/session-end/`; no change to recall or its trigger; no change to the
`/start` memory-free route or to merge gating. The migrated handoff is word-equal to its source
(§3.3). No role ran through the runtime. The main checkout was not touched. `.agents/roles/shared.md`
changed (the detach section, 20 lines) and `.agents/AGENT.md` changed `builder` → `developer`, both
inside the loop's subject.

## 6. Findings — not rows, each with the observation that produced it

- **F1 — a modified, uncommitted other-seat handoff is rendered with the SHA of the words it no
  longer has.** On `rc/write`, after `set_handoff seat: developer` with new words and no commit, Probe's
  greeting prints `developer (session 80): close-out 7e1c041 2026-09-20` followed by the **new**
  first line `PROBE: developer words rewritten in the working tree, not committed`. The SHA is
  derived from HEAD's committed entry and the line from the working copy, and nothing says they
  disagree. A **new** uncommitted entry is handled honestly — `planner (session 72): no commit: no
  committed handoff for "planner" at HEAD — nothing to trace` — so the two uncommitted cases read
  differently. The window is every `/end`, which writes the record before its commit. Class: derive
  from HEAD, render from disk, without comparing the two. Sibling of §5.2 in the developer's handoff.
- **F2 — the reconnect advice is appended to every `ob_state` refusal, including a plain invalid op.**
  Seven refusals in §3.2, all against a schema-valid rev-54 record, all ending *"ask Aaron to run
  `/mcp reconnect open-brain`"*. The planner's finding (2) from the developer's tree, confirmed from
  this side, and wider: the advice is wrong for the ordinary case as well as the stale-server case.
- **F3 — the old build's `ob_start` does not refuse a v2 record; it prints one line and falls back to
  59k chars of prose.** §3.3 (iii). `ob_state` refuses; `ob_start` does not. A session started from
  a stale main build against a merged v2 record gets a greeting that looks like the pre-state.json
  regime with a single notice line at the top of the State section. The line is there; the
  "loud failure" the choreography counts on is the write side only.
- **F4 — the SessionStart hook, given a malformed payload, exits 0 and greets the shell's cwd with a
  generated uuid.** Reproduced from this seat with the mechanism: a payload whose `cwd` carried
  Windows backslashes (invalid JSON escapes) was swallowed by the hook's `try/catch`; it then read
  `process.cwd()` — my checkout, not the fixture — printed a plausible greeting for the wrong
  directory (`Project detected: C:\Users\melve\Worktrees\sia-qa`, `SESSION_UUID: 838cc1b1…`,
  generated) and wrote that generated uuid into the checkout's session slot. Because my `HOME` was
  redirected the slot landed in the scratchpad (`source: "generated"`) and my real slot still reads
  `53ca3ad9…`; the developer, running it against the real home, had its identity overwritten (their
  §6). G-044's family: an instrument that changes what it measures, and answers about a different
  directory while looking right.
- **F5 — the prose fallback under a STALE banner still shows an unattributed handoff.** §3.3,
  `F-behind`: `next-session.md` with `## Pick up here _(written session 69)_`. Correct given a v1
  record, and the banner is above it; noted so nobody reads the fallback's handoff as seat-aware.
- **F6 — `nolocal` resolves to `Forge (developer)` and renders the developer's handoff as `Your
  handoff`.** With the tracked `AGENT.md` now saying `developer`, any checkout without a local file
  — the main tree after the merge — greets as the developer seat. The planner's `role: none` file
  for the main tree is what prevents it; it is a choreography item, not code.
- **F7 — regex alternations in the new tests (T-156 family), listed, none found permitting a defect:**
  `role-files.test.ts:83 /missing|not found|absent/i`, `:93 /planner.*developer.*qa|closed set/i`,
  `:105 /differs|uncommitted|stale/i`, `:129 /untracked|not tracked/i`, `:143 /not .*git|no commit/i`,
  `:149 /identity|seat/i`; `tree-currency.test.ts:139 /rev 1 .*rev 3|rev 1.*origin\/master.*rev 3/s`.
  These alternate over wording, not over outcomes; `:149` is the broadest. No source-text scans in
  the new tests (G-040 does not apply).
- **F8 — a fetching `detach` against a local-path origin resets `origin/master` to the source
  repository's local `master`.** In `rd/wt3`, `git fetch origin` (origin = this checkout's path)
  set `origin/master` to `e65f251` — the shared repository's local `master`, **105 commits behind**
  — and `detach` then correctly refused (`HEAD carries 105 commit(s) that origin/master does not
  have`). Not a candidate defect (real seats' origin is GitHub); it is a measurement that the local
  `master` branch in the shared repo is at `e65f251`, which is why `shared.md` says `origin/master`.
- **F9 — the greeting grew by 39% in characters** (Probe, `F-cur`: 63,063 vs 45,208 at base), the
  role content being the difference. The developer measured +34% in words and says so.
- **F10 — `build-freshness` goes red on docs-only commits** (carried already by the planner to the
  close-out); it fired twice more on this seat's branch today.

## 7. What could not be verified, so nobody inherits it as settled

- **C3's live half** — the planner's first roll — is after the merge.
- **C4's real half** — a killed and restarted planner session in `~/Worktrees/sia-planner`, then the
  same in `~/Worktrees/sia-qa` — is Aaron's and the planner's. My eleven transcripts are the handler
  in this tree through a programmatic caller.
- **The MCP transport** (G-033): `handleStart` is the function `ob_start` serves; the process was not
  the server. In this session the open-brain server was reconnected once, before the first `/start`,
  and never rebuilt or reconnected since — every `ob_start` I received today came from the main
  checkout's `7c7e04b` build, and after the merge every seat's greeting will come from the main
  tree's build until it is rebuilt (F3 is what a stale one prints).
- **`ob_start`'s log reuse** on a registered session — untested in fixtures (§4).
- **G-047 beyond one interleaving** — I tested U1, U1, U2, U1; other orders are not observed.
- **The hook against the real home** — every hook run here had `HOME` redirected; F4's overwrite
  of a real slot is the developer's observation, reproduced only into the scratchpad.
- **`PRD.md`** in the main tree — unrun.
- **Whether the seat's knowledge reached the session** — a greeting can prove the file's content was
  printed (it was), not that it was read.
- **A stranger's clone** (G-030, T-154) — reached only as far as `rnr` (no `origin/master`) and
  `nolocal` (no identity file) go.

## 8. What my instruments could not see, and the one that answered a different question first

- **`GIT_TRACE=1` to stderr saw nothing** — 0 trace lines — because every git call in the new modules
  runs with `stdio: ["ignore", "pipe", "ignore"]`. That zero was "did not look". `GIT_TRACE=<file>`
  saw 50 lines; the planted fetch validated the file instrument, not the stderr one.
- **The hook payload with backslashes** (§6 F4): my first stale and untracked hook checks reported
  nothing because the hook was greeting my own checkout. Caught because the greeting-side check
  found `[STALE vs HEAD]` while the hook did not, and a third run captured the hook's full output
  with its `Project detected:` line. Redone with a payload built by `JSON.stringify`.
- **`head -8` on my own `state-ops` output** hid the G-047 `NOTE:` line on its first appearance.
  Re-observed in full.
- **Word counts over transcripts** match record content (G-032's own text mentions `roles/`,
  fixture names contain `behind`). Every count in this report was resolved by reading the region.
- **Mutation testing** shows a test can go red for the mutant I chose; it does not show the test
  would catch a different defect in the same line.

## 9. Side effects this seat caused on the machine, stated because nobody else will

- **Six scratch-fixture slots were written into Aaron's real
  `~/.claude/open-brain/active-session.json`** by the six **baseline** hook runs on 2026-09-20
  ~18:32Z, before I redirected `HOME` — keys ending `scratchpad/fixtures/base/{cur,behind}-{atlas,
  forge,probe}::claude`, uuid `00000000-0000-4000-8000-00000000f1x7`, `project_dir` under the
  scratchpad. They are harmless (a slot is consulted only for its own project dir and refused after
  12h) and I did **not** edit the file: it is Aaron's, and the auto-mode classifier treats it as
  self-modification. Two further scratch keys there, `…/sia-forge/…/scratchpad/c4::claude` in two
  path spellings, are the developer's C4 runs (G-015's shape, one dir under two keys). This seat's
  own slot is intact (`53ca3ad9…`, verified after the last run).
- **Every candidate run** — eleven greetings, hook runs, record writes, migrations, detaches, six
  mutants — used a scratch `HOME` and a scratch `KNOWLEDGE_V2_DB`, verified by re-reading the real
  file for new scratch keys (none) and the scratch file for the expected ones (13 keys).
- **A linked worktree of the shared repository** was added for the mutants at
  `scratchpad/fixtures/mut/wt` with a node_modules **junction** into this tree; the junction was
  deleted as a link (target entries 171 before and after) and the worktree removed with
  `git worktree remove --force`; `git worktree list` is back to 4.
- **This tree's untracked `.agents/SESSIONS/`** gained no log from fixture runs (`project_root` was
  always a fixture).

## 10. Probes, withheld until now

1. The uncommitted other-seat handoff (F1) — shape: `set_handoff` for a seat other than the reader,
   no commit, then the reader's greeting; read the SHA against the first line.
2. `role: none` on write, not only on read — the schema refuses `none` as a seat value (§3.2) and
   the greeting says so (§3.1).
3. The migration boundary by hand (§3.3) and by mutant M4.
4. The returning uuid after another seat's number (§3.4) — the documented limit, observed.
5. Retention with one cited and one uncited close in the same batch (§4).
6. The hook with a malformed payload (F4) — found by accident, then reproduced on purpose.
7. `detach` with a fetch against a local-path origin (F8).
8. `GIT_TRACE` to a file after the stderr form saw nothing (§8).

## 11. For the planner

The candidate does what C1, C2 (a, b, c), C3's command half and the staleness note asked, seen red
first and observed green on the frozen SHA, with the negative fixtures present at base and gone at
the candidate. **The honest no is C2d, on the near-miss register**, and it is the planner's to rule
whether that register belongs to the record or to the close-out document; if the latter, one
sentence in the developer's handoff sorts it and the row passes without a code change. F1 is the
finding I would want repaired before the greeting is trusted mid-`/end`; F2, F3 and F6 are merge
choreography — the main tree's rebuild and its `role: none` file — rather than candidate defects.
Report committed on `qa/loop-14-report` cut from `7c7e04b`; nothing pushed from this seat.
