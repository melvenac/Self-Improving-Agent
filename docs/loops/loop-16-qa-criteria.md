# Loop 16 — QA acceptance criteria, written before a candidate exists

**By:** Probe (QA seat, fresh session, this loop; session uuid `6eab2c5c`) · **Date:** 2026-09-20 ·
**Derived from:** `docs/loops/loop-16-brief.md` §2–§5 read at `8457600` (branch
`docs/loop-16-brief`, not on `origin/master`; readable here because linked worktrees share one
object store), with `docs/loops/g-039-ruling.md` binding where the brief defers to it, and
`.agents/roles/qa.md` (`876029d`) and `.agents/roles/shared.md` (`8b200f7`) as loaded into this
session's greeting.
**Base:** `origin/master` at `4550ee5` — record rev 59, `v0.43.0`. This tree was detached to it with
`node open-brain/build/cli.js detach` (`verified: detached at 4550ee5, no branch`), built
(`build stamped 4550ee5`) and indexed (`analyze --repair-fts` then `analyze`, both exit 0) before
any of the measurements in §7.
**Handoffs cited by close-out SHA, not by the rendered view:** this seat's last is
`git show 94d3e4e:.agents/state.json` (rev 58, session 72); the developer's is `3f9295a` (rev 57,
session 71); the planner's Loop 14 close-out is `8b200f7` (rev 59, session 73).
**Candidate:** none yet. This file is committed before the developer's first commit exists so the
criteria cannot be fitted to what arrives. **They are not widened after a verdict.**

> **Rule of this file.** Every criterion names what will be observed, in which tree, with which
> command, and what result means **pass**, **fail** or **untested**. A criterion I cannot state that
> way is in §6 as unverifiable now, not silently dropped. **Missing evidence is a gap, not a pass.**
> Where the brief is ambiguous I state the reading I will apply and return the question to the
> planner in §9 — I do not resolve it, because a QA seat resolving the planner's ambiguities is
> setting scope. Clauses marked **[mine]** go beyond the brief's words and are listed again in §9;
> per Loop 14's A7-style ruling, a candidate that meets the brief and not one of my clauses is
> reported **both ways** and the clause returned, never dropped after the verdict.

**Two constraints from §4's header sentence apply to every row below and are not themselves rows:**

1. **A1 is first and is seen red before anything else exists.** The developer's first commit is that
   test failing. I check this from the branch's history, not from a claim.
2. **Every row that asserts an absence also asserts the matching presence in the same test**
   (`T-156`). A negative-only assertion is a finding against the row it appears in, even when the
   row otherwise passes.

---

## 1. Fixed conditions for the evaluation

| | |
| --- | --- |
| **Candidate identity** | One SHA on `loop/16-recall-trigger`, handed over by the developer in writing, cited by rev not tip. Every observation carries it. `git cat-file -t <SHA>` must print `commit`; if it is not in this checkout's object store, `git fetch origin` first and record that it was fetched. Linked worktrees here share one object store, so a developer commit is usually readable without a push — that is a convenience, not a substitute for the SHA being named in writing. |
| **Evaluation tree** | `~/Worktrees/sia-qa`, moved with `git checkout --detach <SHA>`; then `git status --porcelain` empty and `git rev-parse HEAD` equal to the SHA, **checked before the first observation and again after the last.** If either changes between them, every observation is void, recorded as void, and the evaluation restarts on the new SHA. |
| **Made to resemble the main tree** | In order: `npm ci` (only if `package-lock.json` changed at the candidate) and `npm run build` in `open-brain/`, exit codes captured into variables and read back from a file, `build/build-info.json` carrying the candidate SHA; `node .gitnexus/run.cjs analyze` from the root — on the FTS `file_fts` inconsistency (`T-055`) run `analyze --repair-fts` then `analyze` again, and **never `clean` without `--force`** (`G-043`); then `node open-brain/build/cli.js sync --check` from the root, which must report **0 skipped**. The analyzer's exit code and indexed commit are recorded beside the build's. |
| **The main checkout** | `~/Projects/Self-Improving-Agent` is not moved, not built and not checked out by me. **The main tree is not a QA fixture** (`shared.md`, ruled 2026-09-20). Its one unique condition — Aaron's untracked `.agents/SYSTEM/PRD.md` — is reported as **unrun**, never implied green. |
| **The hook registration for A7 and A10** | `~/.claude/settings.json` is Aaron's file. Registering the trigger against the QA tree's build is an act that needs **his word for that act** (brief §6, §8). I ask the planner by SHA at the moment, the planner asks Aaron, and the report records: the exact JSON added, when it was added, when it was removed, and the file's content read back after removal and compared to a copy taken before. **If the word does not come, A7 and A10 are reported `untested` and no row is inferred from the others.** |
| **The store under test** | Trigger queries are measured against a **fixture store** built in the scratchpad (`KNOWLEDGE_V2_DB` pointed at it), never the live `~/.claude/open-brain/knowledge-v2.db`, for every row except A7 and A8 — those two are live by construction because they need a real session. What A7/A8 write to the live store is disclosed in the report. |
| **Fixture store shape (A1–A4)** | One SQLite store built by the candidate's own schema code (not hand-written DDL, which would measure my DDL), holding entry 299's text **as it exists at base** — captured to a file in §7 so the fixture cannot drift — plus **at least ten decoys sharing the common tokens `exit`, `code`, `tail`, `run`** (brief A1). Decoys are drawn from the live store's real entries where they qualify and are otherwise synthesised; the report lists every decoy id and its provenance. The store's maturity column matters (`recallRankExpr` boosts Mature 1.5× / Proven 1.2×), so the fixture records each row's maturity and the report says what entry 299's was. |
| **Read-only** | No edit to any tracked file at the candidate. Nothing is repaired. Where a check must be *seen red* on a mutation, the mutation is made on a scratch copy, never in the candidate tree. |
| **Instrument discipline** | **"Exit 0" everywhere below** means the status captured from the process under test — `cmd > file 2>&1; rc=$?` with `rc` written to a file and read back, or `execFileSync` — never a pipeline's last stage and never a line of output (`G-042`, and the entry this whole loop is about). **Every instrument that returns a zero or an empty result is validated against a planted positive through the same channel first** (`G-044`: `GIT_TRACE=1` to stderr saw nothing because the callee ignored stderr; the zero was "I did not look"). Hook payloads are built with `JSON.stringify`, never by hand — a Windows backslash makes them invalid JSON and the hook then reads the shell's own cwd while looking right. The suite runs **alone**; no fixture construction beside it. |
| **Not shown** | Probe shapes beyond the brief's own cases are not listed here and are not shown to the developer before the report; they go into the report after the verdict. |

## 2. Acceptance criteria, one per row in the brief's §4

Each row: **required** (the brief's words), **procedure** (what I run, where), **pass / fail /
untested**, and **blind spot** (what the procedure cannot see).

### A1 — the trigger's query returns entry 299 first, and the test was seen red first

- **Required (§4 A1):** *"Against a fixture store holding entry 299's text and at least ten decoys
  sharing common tokens (`exit`, `code`, `tail`, `run`), the trigger's query for the literal command
  `npx vitest run 2>&1 | tail -8; echo $?` returns entry 299 **first**. The developer's first commit
  is this test failing."*
- **Procedure, white-box:** run the candidate's own A1 test against the fixture store and read its
  exit code from the process. Then, independently of the developer's test, call the trigger's query
  function directly with that literal command string and assert entry 299 is rank 1 — the
  developer's test and my call must agree; if only the developer's passes, the test is measuring
  itself. **Seen-red check:** `git log --reverse --format='%h %s' <base>..<candidate>` — the first
  commit on the branch must contain the A1 test and must not contain the implementation. I verify
  the red by checking that first commit out into a scratch worktree of the shared object store,
  running the test there, and recording a **non-zero** exit and the failure text. A first commit
  whose test passes, or that contains implementation, is a fail.
- **Pass:** entry 299 is rank 1 from both callers; the first commit exists, contains the test alone,
  and is red when run. **Fail:** any other rank; disagreement between the two callers; the first
  commit green, absent, or carrying implementation. **Untested:** cannot arise — every input is
  under my control.
- **Blind spot:** rank 1 against *these* decoys is not rank 1 against the live store's 599 entries.
  A1 measures the query's shape, not its field performance; §5.1 is where I report the live-store
  rank separately, and it is not a pass/fail clause.

### A2 — three negative commands return nothing, and each fire is still recorded

- **Required (§4 A2):** *"Against the same fixture, the trigger's query for each of
  `git status --porcelain`, `ls -la`, and a command built from tokens that appear in no entry
  returns **nothing** — and the fire is recorded for each, with zero ids. Three negatives, three
  positives-of-the-record, one test."*
- **Procedure:** the three commands through the trigger's query path against the fixture store.
  After each, read the fire record directly from the store with SQL (not through a helper the
  candidate also wrote): a row exists, it carries the new trigger value, and it carries zero
  knowledge ids. Before believing any empty result, plant a positive: the A1 command through the
  same path in the same run must produce a non-empty result and a fire row with one id — that is
  the "three positives-of-the-record" half, and it is what makes the zeros mean something.
  For the third command I build tokens from a random string not present in any fixture row, and I
  assert that absence by querying the fixture store for each token first.
- **Pass:** three empty results; three fire rows with zero ids; the planted positive non-empty in
  the same test run. **Fail:** any injection on a negative; a missing fire row; a fire row whose
  trigger value is not the new one — in particular `unspecified`, which is what
  `recordRecallEvent` writes for a value absent from `RECALL_TRIGGERS` (`db-v2.ts:749`, measured at
  base in §7.3): a census that silently absorbs the trigger into `unspecified` is a fail, not a
  naming quibble. **Untested:** cannot arise.
- **Blind spot:** "returns nothing" is measured at the query, not at the hook's stdout. A5 covers
  the emitted JSON; a query that returns nothing while the hook emits an empty `additionalContext`
  field would pass here and fail there, which is the correct division.

### A3 — the trigger does not use `ob_recall`'s broadening path

- **Required (§4 A3):** *"A fixture where the precise query underfills and an `OR` broadening
  *would* return a decoy: the trigger returns nothing. A mutant that routes the trigger through
  `ob_recall`'s broadening path turns this red."*
- **Procedure:** build the underfill case from a measurement rather than a guess — at base, the
  query *piping to tail masks the real exit code* against the live store **already underfills and
  broadens**, and said so in its own output (`_(some results matched only part of the query)_`,
  §7.1). The fixture reproduces that shape: a query whose conjunctive FTS match returns fewer rows
  than the limit, with at least one decoy reachable only by `OR`. Assert the trigger returns
  nothing. Then **write the mutant**: re-point the trigger's query at the `ob_recall` handler's
  path (`server.ts` `buildSql` + `broadenFtsQuery`, the `rows.length < limit` branch at base) on a
  scratch copy, and record that A3 goes red. `tsc --noEmit` must be clean on the mutant before it
  counts — a mutant that breaks syntax proves nothing (Loop 14, and it caught me first).
- **Pass:** trigger silent on the underfill fixture; mutant type-clean and red. **Fail:** any decoy
  surfaced; a mutant that cannot be made type-clean because the trigger and `ob_recall` share no
  seam — that is itself the finding, and I report it as a fail of A3 with the reason, because a
  trigger that *cannot* be routed through the broadening path may also be one that has no
  identifiable query path to test. **Untested:** if the candidate's query is not separable enough
  to mutate without rewriting it, recorded as untested with the code read that shows why.
- **Blind spot:** one underfill shape. A query that broadens only for some token distributions is
  not covered; named in §10.

### A4 — the relevance floor is data, and changing it changes behaviour with no source change

- **Required (§4 A4):** *"The relevance floor is read from data, not a literal; changing it changes
  A2's third case from silent to injected with **no source change**, and a floor hand-edited into
  the query code is caught by a drift check (`D-021`'s pattern, as slice two's policies)."*
- **Procedure:** locate the floor's source of truth, its derived file and its drift check, from the
  developer's handoff and from the tree. Then, with **no edit to any `.ts`**, change the floor in
  the data file so A2's third command crosses it, re-run, and observe injection; restore, re-run,
  observe silence. Both directions in the same session, with the file's bytes hashed before,
  between and after. Separately: hand-edit a floor literal into the query source on a scratch copy
  and assert the drift check goes **red**; then assert it is **green** on the unmodified candidate
  — the presence half that `T-156` requires.
- **Pass:** both directions observed from a data change alone; drift check red on the planted
  literal and green on the candidate. **Fail:** behaviour that only changes when source changes;
  a drift check that is green on the planted literal (an instrument that cannot tell "no drift"
  from "I did not look"); a floor with no derived-file/drift-check trio when the brief's §5.5 says
  *"that it is not a literal is not"* the developer's choice.
- **Blind spot:** I test that the floor is *reachable* as data, not that its **value** is right.
  Calibration is §5.2 — reported as a number with the developer's stated method, not scored.

### A5 — the hook's emitted JSON, both directions, and never a blocking field

- **Required (§4 A5):** *"The hook, invoked as Claude Code invokes it (JSON on stdin built with
  `JSON.stringify`, never by hand — QA's Loop 14 lesson), on the A1 command emits
  `hookSpecificOutput.additionalContext` containing entry 299's id and `ACTION`; on each A2 command
  emits **no** `additionalContext` field and no stdout; in **no** case emits `permissionDecision`,
  `updatedInput`, or exits non-zero. Both directions asserted on the emitted JSON."*
- **Procedure:** invoke the hook as a process, stdin built with `JSON.stringify`, `KNOWLEDGE_V2_DB`
  and `HOME`/`USERPROFILE` pointed at the scratchpad **before the first invocation** (Loop 14: six
  baseline runs wrote scratch keys into the real `active-session.json` before HOME was redirected).
  Capture stdout, stderr and exit code separately; parse stdout as JSON with a parser, never a
  pattern match (`shared.md`: *the instrument for structured data is a parser*). Assert on the A1
  payload: `hookSpecificOutput.additionalContext` present, containing the string `299` as the
  entry's id in whatever field the candidate uses **and** the `ACTION:` text from entry 299.
  Assert on each A2 payload: the `additionalContext` key is **absent** (not present-and-empty, not
  `null` — I record which, and present-and-empty is a fail against the brief's *"not an empty
  reminder"* in §2), stdout is empty or a JSON object with no such key, exit 0. Across all four:
  `permissionDecision`, `permissionDecisionReason`, `updatedInput`, `decision` and `continue: false`
  are absent, and exit is 0.
- **Pass:** all of the above, with the A1 positive and the A2 negatives in the same test run.
  **Fail:** any blocking field on any payload; a non-zero exit; an empty-but-present
  `additionalContext`; an id or `ACTION` text that does not match entry 299 at the candidate.
  **Untested:** if the developer chooses `PreToolUse` and `PostToolUse` both, each event is measured
  separately and a row is untested only if one event cannot be invoked.
- **Blind spot:** I invoke the hook the way the documentation says Claude Code does. **That is a
  relay** (the brief says so of its own reading, §7.7). A7 is the only row that observes the real
  host, and it is the reason A5 is not sufficient.

### A6 — three failure shapes leave the tool call byte-identical, and each is logged

- **Required (§4 A6):** *"With the store path pointed at a file that does not exist, a store that is
  locked, and a hook killed at its timeout: the tool call's own result is byte-identical to a run
  with no hook registered, and each failure appears in the named log file. Three cases."*
- **Procedure:** the three shapes — `KNOWLEDGE_V2_DB` at a non-existent path; the store held under
  an exclusive SQLite lock by a second process for longer than the hook's timeout; the hook process
  killed at its configured timeout. "The tool call's own result is byte-identical" is measured as:
  the hook's stdout carries nothing the host would merge (no `additionalContext`, no blocking
  field), exit is 0, and the emitted bytes equal those of a control run with the hook's logic
  disabled. **Baseline first:** the control bytes are captured before the three shapes, and their
  equality is asserted against a planted *inequality* (a deliberately different payload) so that
  "byte-identical" is not an instrument that always says yes.
  Then read the named log file: one entry per shape, naming the shape. **Presence half (`T-156`):**
  the log file must be **empty or absent** on a clean successful fire in the same test, so a log
  that is written unconditionally cannot pass the three absence checks by accident.
- **Pass:** three shapes, three byte-identical results, three log entries, clean run silent in the
  log, inequality control fails as designed. **Fail:** any shape that changes the tool result, exits
  non-zero, or leaves no log entry; a log file the handoff does not name. **Untested:** if the
  locked-store shape cannot be produced on Windows with the candidate's driver, recorded as
  untested with the attempt, never inferred from the other two.
- **Blind spot:** a crash inside the host's own merge of `additionalContext` is not reachable from
  here. Named in §10.

### A7 — the real session, read from the transcript

- **Required (§4 A7):** *"In a real Claude Code session in the QA tree with the hook registered, run
  the A1 command against a harmless target, then `git status --porcelain`. The session transcript
  (`~/.claude/projects/<slug>/<uuid>.jsonl`) contains the hook's system reminder with entry 299's id
  next to the first tool result and **none** next to the second. **Read from the transcript, never
  from the seat's own account of what it saw.**"*
- **Procedure:** after Aaron's word for the registration (§1), in a real session in this tree: run
  the A1-shaped command against a harmless target, then `git status --porcelain`. Close the
  measurement, then read the `.jsonl` with a JSON-lines parser, locate the two tool results by their
  command text, and assert the reminder's presence next to the first and its absence next to the
  second. **The absence is validated by the presence in the same file** — one transcript, one
  parser, both directions. My own narration of what I saw is not evidence and does not enter the
  report as such.
- **Pass:** reminder with entry 299's id next to the first result, none next to the second, both
  read from the transcript. **Fail:** either direction wrong; a reminder that names an id other
  than 299; a transcript in which the parser cannot locate the tool results — which I report as a
  fail of the *measurement*, and re-run once with the shape recorded. **Untested:** no registration
  word from Aaron; or the host does not write the reminder to the transcript at all, in which case
  the row is untested and the finding is about the instrument, not the candidate.
- **Blind spot:** one session, one machine, one host version. A7 cannot show the trigger fires for
  the developer's seat, for another project, or after a host upgrade.

### A8 — the census, the rated set, and what must *not* be rateable

- **Required (§4 A8):** *"After A7, `ob_stats` shows the new trigger value in the census with a count
  of at least two fires; `ob_recalled` in that session lists entry 299 as hook-injected and lists
  nothing for the silent fire; the rated set at `/end` contains 299 and not the decoys the trigger
  looked at."*
- **Procedure:** immediately after A7, in the same session: `ob_stats` and `ob_recalled`, both
  recorded verbatim, compared against the same two calls taken **before** A7 in the same session
  (§7.2 holds the pre-loop live baseline; the immediate before/after pair is what the delta is
  computed from, because the live store moves). The census must show the new value with a delta of
  **at least two**. `ob_recalled` must name entry 299 as hook-injected and must not name any entry
  from the silent fire. For the third clause — *the rated set at `/end`* — I read what `/end` would
  rate **without running my own `/end` as the instrument**: the rated set is resolved by
  `open-brain/src/pipelines/session-end/recalled-ids.ts`, and I call that resolution directly
  against the live session uuid and record its output. A seat's own `/end` reporting on the
  correctness of its own `/end` is the derived-value defect the developer named in Loop 14, and I
  will not use it as the measurement. **[mine — §9.1]**
- **Pass:** census delta ≥ 2 on the new value; `ob_recalled` distinguishes hook-injected from
  explicit; the resolved rated set contains 299 and no looked-at-only entry. **Fail:** the census
  showing the fires under `unspecified` or under `explicit` (the brief: *"a hook-fired recall is
  never counted as an `explicit` one"*); any looked-at-only id in the rated set — that writes
  `success_rate` for entries nobody read, the column that gates apoptosis and boosts ranking.
  **Untested:** whatever A7 leaves untested, propagated, not inferred.
- **Blind spot:** the live store is shared with every other session on this machine. A concurrent
  session's recalls land in the same census, so the delta is a lower bound, and I say so rather
  than treating the number as exact.

### A9 — the existing recall tests pass unchanged, and no existing assertion was touched

- **Required (§4 A9):** *"The existing `ob_recall` tests pass unchanged at the candidate;
  `git diff base..candidate -- open-brain/tests/` touches no existing recall assertion."*
- **Procedure:** `git diff <base>..<candidate> -- open-brain/tests/` read in full, with the recall
  tests identified at base rather than at the candidate: `recall-broadening.test.ts`,
  `ranking.test.ts`, and the recall assertions inside `db-v2.test.ts`,
  `index-upsert.test.ts` and `pipelines/session-end/recalled-ids.test.ts` (enumerated at base in
  §7.4 so the candidate cannot rename its way out of the row). Additions are allowed; a modified or
  deleted assertion in those files is the finding. Then run those files alone and read the exit
  code from the process.
- **Pass:** no modified or deleted assertion in the enumerated set; those files green with exit 0.
  **Fail:** any changed existing assertion — the brief says *"a test that had to change is a
  finding"* (§3), and I report it as a fail of A9 with the diff, leaving the planner to rule whether
  it sinks the candidate. **Untested:** cannot arise.
- **Blind spot:** an unchanged assertion can still be measuring something different if its fixture
  moved. I check the fixtures those files read as part of the same diff.

### A10 — the cost, as a number

- **Required (§4 A10):** *"p95 wall time added per `Bash` call over ≥50 consecutive calls in the QA
  tree, measured with and without the hook registered, reported with the method and the hook's
  configured `timeout`. A number, not a verdict."*
- **Procedure:** ≥50 consecutive `Bash` calls of a fixed trivial shape in a real session in this
  tree, timed from the transcript's own timestamps where they exist and otherwise from a wrapper
  that writes start/end to a file; the same 50 with the hook unregistered; p50, p95 and max for
  both, the delta, the method, and the hook's configured `timeout` value read from the registration
  JSON. Both arms in the same session where possible, and if not, the arms' conditions are stated.
  **Nothing else runs during the measurement** — the suite-runs-alone rule applies to timing at
  least as much as to vitest.
- **Pass:** the numbers exist, with the method. **There is no threshold** — the brief says a number,
  not a verdict, and I do not invent one. **Fail:** the measurement not taken, or taken with the
  method unstated. **Untested:** no registration word from Aaron.
- **Blind spot:** one machine, one store size (599 entries at base, §7.2). Cost is a function of the
  store, and a p95 here says nothing about a store ten times larger.

### A11 — the suite, the gate, the boundary, and no network

- **Required (§4 A11):** *"Suite exit code read from the process (`G-042`); `sync --check` clean with
  zero skipped in the QA tree; `module-boundary` green; a test that fails on any network attempt
  covers the trigger's module."*
- **Procedure:** `npx vitest run` **alone**, stdout+stderr to a file, `rc=$?` written to a file and
  read back; the printed pass count recorded beside the exit code, because the two disagreeing *is*
  `G-042` and is itself a finding. `node open-brain/build/cli.js sync --check` from the root, full
  output, **0 skipped** asserted explicitly (a skip is not a pass), with `gitnexus-index` reporting
  the candidate's SHA. `module-boundary` green in that run. For the network clause: locate the test
  the developer added, then **validate it against a planted positive** — introduce a network call
  into a scratch copy of the trigger's module and assert the test goes red — before believing its
  green.
- **Pass:** suite exit 0 with the count and the code agreeing; `sync --check` clean, 0 skipped;
  `module-boundary` green; the network test red on the planted call and green on the candidate.
  **Fail:** any of these; in particular a suite that prints a green count and exits non-zero, which
  is recorded with the full worker output. **Untested:** cannot arise.
- **Blind spot:** a green suite is not evidence the trigger works; it is evidence nothing else
  broke. And `G-042` is load-dependent and has only ever been seen on this machine — a clean run
  here does not close it.

## 3. Preservation — what must still be true (brief §3)

Checked at the candidate, each with its own observation, none inferred from a green suite:

1. **`ob_recall` for an explicit caller behaves exactly as at base** — same SQL, same broadening,
   same output. Measured as: the base output captured in §7.1 reproduced byte-for-byte at the
   candidate for the same query and limit against the same store snapshot, plus A9's diff.
2. **Suite green with the exit code from the process; `sync --check` clean, zero skipped;
   `module-boundary` green.** A11. **The trigger imports nothing from the harness and the harness
   imports nothing from it** — read from the import graph, not asserted.
3. **`ob_state` remains the only writer of `.agents/state.json`.** Measured: hash `state.json`
   before and after every A5/A6/A7 fire; unchanged. The trigger writes to the store's tables, never
   the record.
4. **No network in the test suite and none in the trigger's path.** A11's planted-positive check.
5. **`SessionStart` and `SessionEnd` hooks unchanged, and the greeting unchanged.** Diff those two
   entrypoints at base..candidate; run `/start` in a scratch fixture and compare the greeting text
   to a base capture.
6. **The store is opened read-only by the query and written only for the fire record.** Read the
   open mode in the code, and observe it: with the store file marked read-only at the OS level, a
   query-only fire must still succeed (or fail into A6's logged path) and must not error as a write.
7. **Nothing pushes, merges, or tags.** From my seat, structurally: I report SHAs.

## 4. Scope fences — things the candidate must NOT do (brief §2, out of scope)

A candidate that does any of these is reported as out of scope regardless of its rows:
reinstating session-start injection (Loop 10 C2 stands); changing `ob_recall`'s behaviour for
explicit callers, including applying the new floor to it (`G-026`, not this loop); adding a second
always-loaded curated set; `T-014` beyond the one constraint in A8; `T-154`/`G-030`; any change to
`.claude/commands/`, to `open-brain/src/harness/`, or to the record schema; Jev, a network call or
an API key anywhere in the trigger's path; `G-045` or slice three's list.

## 5. What I will report as a finding even though no row fails

1. **Entry 299's rank against the live store, not the fixture.** A1 is a fixture measurement. The
   live-store rank at base is in §7.1 (rank 1, *with broadening having fired*); I take the same
   measurement at the candidate through the trigger's precision-only path, and if entry 299 does not
   come back at all — because the precise query underfills below the floor — that is the most
   important number in the report and it is not a row.
2. **What the floor was calibrated against.** A4 tests that it is data. If the developer's stated
   calibration is one query, the report says so.
3. **Which hook event was chosen and why** (`PreToolUse`, `PostToolUse`, or both), and whether the
   choice makes the reminder arrive before or after the seat has already acted.
4. **The inherited defects, named:** the trigger runs the main tree's build, so a stale main tree
   serves a stale trigger (`G-034`), and the registration route is `G-030`'s. The brief requires the
   handoff to say so; I check that it does.
5. **Anything in the `G-040` family** — a scan or assertion that matches the sentence forbidding a
   thing as though it were the thing, in either direction.

## 6. What cannot be verified now, stated so nobody inherits it as settled

- **That a seat *applies* what the trigger surfaces.** The brief says this outright and so does the
  ruling. Nothing in §2 measures it and nothing in the report will imply it.
- **That the trigger fires for the developer's or planner's seat**, in another project, or under a
  different host version. A7 is one session in one tree.
- **That `G-026` (recall precision at large) is unaffected.** The floor is the trigger's only.
- **That the census's meaning survives concurrency.** A8's delta is a lower bound.
- **The main-tree-only condition** (Aaron's untracked `PRD.md`) — unrun, as always.

## 7. Baseline, measured in this tree before any candidate exists

All at `4550ee5`, 2026-09-20, in `~/Worktrees/sia-qa`, after detach + build + analyze.

1. **`ob_recall` at base for the entry-299 query.** `ob_recall(queries: ["piping to tail masks the
   real exit code"], trigger: "explicit", limit: 5)` against the **live** store returns entry 299
   (`pipe-to-tail-masks-exit-code`) at **rank 1**, and the output carries
   `_(some results matched only part of the query)_` — **the broadening fired**, so four of the five
   results are `OR` matches. This is the base fact A3's fixture is built from, and it is the reason
   §5.1 exists: the precision-only path may return *fewer* than five, and possibly only 299.
2. **Live store at base:** 599 entries, 278 rated; maturity 559 progenitor / 26 proven / 14 mature;
   trigger census `(pre-column) 637, explicit 412, start 275, checkpoint 116, unspecified 11`;
   schema code v5, database v5. **A moving baseline** — recorded so A8's delta is computed from an
   immediate before/after pair, not from this.
3. **`RECALL_TRIGGERS` at base is exactly four values** — `db-v2.ts:722`:
   `new Set(['start', 'checkpoint', 'explicit', 'unspecified'])`, and `db-v2.ts:749` writes
   `safeTrigger = RECALL_TRIGGERS.has(trigger) ? trigger : 'unspecified'`. A new trigger value that
   is not added to that set is silently recorded as `unspecified`. `ob_recall`'s MCP schema
   (`server.ts:762`) carries the same four as a `z.enum`. **There is no relevance floor at base:**
   `buildSql` ends `ORDER BY weighted_rank LIMIT ?` with no threshold clause.
4. **Existing recall tests at base**, enumerated so A9 cannot be renamed around:
   `open-brain/tests/recall-broadening.test.ts`, `ranking.test.ts`, and the recall assertions in
   `db-v2.test.ts`, `index-upsert.test.ts`, `active-session.test.ts` and
   `pipelines/session-end/recalled-ids.test.ts`.
5. **Tree conditions:** `detach` verified at `4550ee5`; `npm run build` exit 0, `build stamped
   4550ee5`; `analyze --repair-fts` exit 0 then `analyze` exit 0 — `changed=0, added=6, deleted=0`,
   2,751 nodes / 5,581 edges / 191 clusters / 161 flows.
6. **Still to take before the candidate arrives, and reported as taken or not:** a full `npx vitest
   run` alone with the exit code read from the process, and `sync --check` with the skipped count —
   the base numbers A11 is compared against.

## 8. Procedure order on hand-over

1. Record the SHA as given, in writing, with the time. `git cat-file -t`.
2. `git checkout --detach <SHA>`; `git status --porcelain` empty; `git rev-parse HEAD` equal.
3. Build, analyze, `sync --check` (§1). Exit codes into variables, read back from files.
4. **A1's seen-red check first** — the branch's first commit, in a scratch worktree.
5. A9's diff, before running anything, so I know what moved.
6. A1–A4 against the fixture store; A5, A6 against the hook as a process.
7. A11's suite, **alone**.
8. Ask for the registration word (§1); on it, A7, then A8 immediately, then A10; then restore the
   registration and read `settings.json` back.
9. Re-check `git rev-parse HEAD` and `git status --porcelain`. If either moved, the evaluation is
   void and says so.
10. Write the report. Verdict, then every row with its observation, then §6's list, then the probe
    shapes, then what the checks cannot see.

## 9. Returned to the planner — clauses that are mine, not the brief's

Per Loop 14's A7-style ruling, these are marked here before any candidate exists, and a candidate
that meets the brief and not one of these is reported **both ways**, with the clause returned rather
than dropped. I do not narrow them after a verdict; I may narrow one **before** a candidate exists,
saying why, in this file.

1. **[mine] A8's third clause measured without running my own `/end`.** The brief says *"the rated
   set at `/end` contains 299"*. Running `/end` would make my own session-end the instrument that
   reports on session-end's correctness — the derived-value defect from Loop 14. I intend to call
   `recalled-ids.ts`'s resolution directly instead. **If you want the literal `/end` run, say so and
   I will do both.**
2. **[mine] A5's reading that a present-but-empty `additionalContext` is a fail.** The brief's row
   says *"emits **no** `additionalContext` field"*; its §2 says *"not a *no relevant entries* line,
   not an empty reminder"*. I read those together as: the key must be absent. If present-and-empty
   is acceptable to you, the row changes.
3. **[mine] A6's control-inequality check.** The brief asks for byte-identical results. I add a
   planted *unequal* payload so that "identical" is not an instrument that always says yes. This
   adds no requirement on the candidate.
4. **[mine] A1's independent second caller.** The brief scores the developer's test. I additionally
   call the query directly and require the two to agree, because a test that measures itself is the
   thing this repo keeps finding. This can only fail if the two genuinely disagree.
5. **[mine] A2's "not `unspecified`" clause.** The brief says the census *"gains a value for the
   trigger, distinct from all four"*. `db-v2.ts:749`'s fallback means an unregistered value lands in
   `unspecified` silently, so I score that specific outcome as a fail rather than as a naming
   detail. I believe this is the brief's plain meaning; flagged because it is an inference.
6. **A question, not a clause: what makes A1 "seen red first" checkable?** The brief says the
   developer's first commit is the failing test. I intend to verify by checking that commit out and
   running it. If the developer squashes or reorders the branch before hand-over, that evidence is
   destroyed and the row becomes untested. **Ruling wanted:** does the branch's first commit have to
   survive to hand-over intact?
7. **A question: is A10's "≥50 consecutive `Bash` calls" mine to generate, or must they be real work?**
   I plan a fixed trivial command repeated, which measures the hook's floor, not a realistic mix.

## 10. What these criteria, as a set, cannot see

A green sweep of §2 means: the query ranks one entry first against a small fixture; it is silent on
three commands; it does not broaden; its floor is data; the hook's JSON is shaped right and never
blocks; three failure shapes are inert and logged; one real session shows one injection and one
silence; the census and the rated set agree with that session; nothing existing changed; and there
is a latency number. **It does not mean the store gets used.** It does not mean the entry surfaced
was the useful one, that the floor is set anywhere near right, that the trigger fires for commands
nobody thought to test, or that a seat reads what appears next to its tool result. The loop's own
brief says the last of these outright. The rest are named here so that a pass is read for what it
is.
