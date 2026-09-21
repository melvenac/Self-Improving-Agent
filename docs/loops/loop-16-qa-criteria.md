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

> **AMENDED ONCE, BEFORE ANY CANDIDATE EXISTS — the only window in which this file may change.**
> The base commit `154d1b3` is **not** amended; this is the second commit on the same branch.
> It applies `docs/loops/loop-16-brief-amendment-1.md` at **`1453e5f`** (rulings `R1`–`R11`,
> answering the developer's six questions and my seven §9 items, and recording **Planner 51** —
> A4 was unbuildable as written — and **Planner 52** — A6 could not fail); `loop-16-brief-amendment-2.md`
> at **`c43a31f`** (`R12` on A11, `R13`, `R14`), read from the tracked file and not only from the
> hub room; and §7.6's base suite measurement, which was outstanding when `154d1b3` was written.
>
> **AMENDED A SECOND TIME, still before any candidate is evaluated** — third commit on the same
> branch; `154d1b3` and `46feb51` are cited and **not** amended. It applies
> `loop-16-brief-amendment-3.md` at **`1051cae`** (**`R15`** — the stderr observable I added in the
> second commit is now the brief's clause, not mine, and is **stricter**: stderr asserted *empty*,
> not merely free of a stack trace) and `loop-16-brief-amendment-4.md` at **`5ab0ac4`**
> (**`R16`–`R18`**, and the design fact that makes them necessary). **These arrive at the
> developer's boundary 2 (`ee74fd1`, rev 2); no candidate has been frozen and nothing here is
> written in response to a verdict.** **Every former `[mine]`
> clause now carries its ruling inline.** Nothing here is narrowed in response to a candidate,
> because no candidate exists.

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
| **The hook event** | **`PostToolUse` only (`R1`).** The brief's *"the developer chooses"* is now chosen, on the developer's own reason: on `PostToolUse` the host **cannot** honour a block, so *the trigger never blocks* is structural rather than behavioural. Every row below is measured on that event; a candidate that also registers `PreToolUse` is out of scope (§4), not a bonus. |
| **The derivation under test (`5ab0ac4` §1)** | **The query is narrow by construction, not filtered down from a broad one.** The derivation recognises risky *elements* of a command and ANDs the terms each contributes — a pipeline whose last stage trims (`tail`/`head`/`grep`) → `tail`; a read of `$?` or `${PIPESTATUS` → `exit`, `code` — from a fixed table in code, no model, no network. **A command with no recognised element derives nothing and the store is never asked.** This is ruled, not a candidate's choice, and it is why A2 now has three states rather than two: ANDing a command's *words* matches nothing in FTS5 (the G-039 command would ask for `npx` AND `vitest` AND `tail` AND `echo`, which matches no entry including 299), and the only repair for that is the `OR` fallback `R1`/§5.4 forbid. |
| **Three invocation states (`R16`)** | Every hook invocation records exactly one of **not asked** (no element recognised, store not consulted), **asked, silent** (consulted, nothing at or above the floor), **asked, injected** (ids), in the fires table, keyed to the live session uuid. **The distinction is load-bearing:** *not asked* and *asked, silent* both emit nothing, and conflating them is `G-039`'s own defect one layer down — an instrument that cannot tell "nothing there" from "I did not look", rebuilt inside the fix for it. Every row below that asserts silence asserts **which** silence. |
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
  itself. **[mine]** — the only clause in this file still so marked: `R11` kept it explicitly, on
  the grounds that it *"can fail only on a genuine disagreement, which is a finding either way."*
  **Seen-red check:** `git log --reverse --format='%h %s' <base>..<candidate>` — the first
  commit on the branch must contain the A1 test and must not contain the implementation. I verify
  the red by checking that first commit out into a scratch worktree of the shared object store,
  running the test there, and recording a **non-zero** exit and the failure text. A first commit
  whose test passes, or that contains implementation, is a fail.
  **RULED (`R9`, was my §9.6):** *"The first commit survives to hand-over. The developer's first
  commit is A1's test failing, and the branch is **not squashed, rebased or reordered** before
  hand-over. The hand-off cites the branch by rev **and** names that first commit's SHA. QA checks
  it out in a scratch worktree and runs it red."* So a hand-over that does not name the first
  commit's SHA, or a branch whose history has been rewritten, is a **fail** of this row rather than
  an untested one. No longer mine.
  **The first commit is already named:** `90e314f` on `loop/16-recall-trigger`, rev 1, A1 red
  (`loop-16-brief-amendment-2.md` at `c43a31f`, header). **That is a relay from the planner's file,
  not an observation** — I check it out and run it red myself, and if the hand-over names a
  different first commit, the hand-over wins and the discrepancy is a finding.
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
- **`R16` — the three commands are `not asked`, and that is asserted apart from `asked, silent`.**
  None of `git status --porcelain`, `ls -la` or the no-token command contains a recognised element,
  so the derivation yields nothing and **the store is never consulted**. Each fire row must carry
  the **`not asked`** state, not `asked, silent`. I assert the two states are distinguishable in the
  record, not merely that both are quiet — a candidate whose fires table has one "nothing happened"
  value passes the old A2 and fails this one, and it should, because that is `G-039`'s defect
  rebuilt one layer down. Where the store being consulted is observable (a query counter, a log
  line, or an instrumented store handle), I assert **zero consultations** for these three and a
  **non-zero** consultation for the planted positive in the same run — the absence validated by the
  presence, per `T-156`.
- **`R17` — a recognised command against a store with no answer is `asked, silent`. A required
  test, and the one that shows the channel fails closed.** Against a fixture store holding **one
  unrelated entry**: the G-039 command derives its terms, the store **is** asked, nothing clears the
  floor, **nothing is emitted**, and the state recorded is `asked, silent`. Without this case a
  channel that is quiet only because it did not understand the question has not been shown to fail
  closed — silence from *not asked* proves nothing about the floor.
- **`R18` — `tail -f file` is not the act, asserted in both directions.** Single-stage
  `tail -f build.log` derives **nothing** (state `not asked`); the G-039 pipeline derives **all
  three terms** (`tail`, `exit`, `code`), asserted by reading the derived terms, not by reading the
  result. The developer's mutant **M4** — the pipeline requirement dropped — survived eleven green
  rows until this assertion existed, so I also run M4 myself on a scratch copy, `tsc --noEmit`
  clean, and require it red here.
- **Pass:** three empty results, each recorded as **`not asked`**; `R17`'s recognised-but-unanswered
  case recorded as **`asked, silent`** with nothing emitted; `R18` both directions; M4 red; three
  fire rows with zero ids; the planted positive non-empty and recorded as `asked, injected` in the
  same test run. **Fail:** any injection on a negative; the two silent states indistinguishable in
  the record; `R17`'s case recorded as `not asked` (the store was asked) or emitting anything;
  `tail -f build.log` deriving terms; M4 surviving; a missing fire row; a fire row whose
  trigger value is not the new one — in particular `unspecified`, which is what
  `recordRecallEvent` writes for a value absent from `RECALL_TRIGGERS` (`db-v2.ts:749`, measured at
  base in §7.3): a census that silently absorbs the trigger into `unspecified` is a fail, not a
  naming quibble. **RULED (`R6`, was my §9.3):** confirmed as the brief's plain meaning — *"a fire
  that lands in the census as `unspecified` is a fail … that is precisely the failure A8 exists to
  see."* No longer mine. `R6` also settles where the value goes: into `RECALL_TRIGGERS`, the DB
  set, and **not** into `ob_recall`'s zod enum — an agent cannot label an explicit recall as
  hook-injected, so a candidate that widens the enum is a fail of this row.
  **Where the fire rows live (`R5`):** injected entries are written to `recall_log` with the new
  trigger value **and** to a sibling fires table; looked-at entries to the fires table **only**, so
  a silent fire never enters the rated set **by construction, not by a filter**. This row's SQL
  therefore reads the fires table for the three negatives and asserts `recall_log` has **no** row
  for them — the absence and its matching presence (the planted positive's `recall_log` row) in one
  test. **Untested:** cannot arise.
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

- **Required (§4 A4, as corrected by `R4`):** the brief's row said *"changing it changes A2's third
  case from silent to injected"*. **That was unbuildable and is recorded as Planner 51:** A2's
  third case is a command whose tokens match **no** entry, and no floor can promote a row FTS never
  returns. `R4` replaces the case: *"A command whose tokens **weakly match one decoy below the
  floor**: at the shipped floor the trigger is silent; with the floor lowered in the policy file and
  **no source change** it injects that decoy; restored, silent again. A2 keeps its three true
  negatives unchanged. A4's drift-check clause stands."* The rest of the row is unchanged: the floor
  is read from data, not a literal, and a floor hand-edited into the query code is caught by a drift
  check (`D-021`'s pattern, as slice two's policies).
- **Procedure:** locate the floor's source of truth, its derived file and its drift check, from the
  developer's handoff and from the tree. Build A4's **own** fixture command — tokens that match
  exactly one decoy, weakly, scoring below the shipped floor; I verify "weakly matches" by querying
  the fixture store directly and recording the decoy's rank and score with the floor removed, so
  "below the floor" is a measured distance and not an assumption. Then, with **no edit to any
  `.ts`**, lower the floor in the data file, re-run, observe that decoy injected; restore, re-run,
  observe silence. Both directions in the same session, with the file's bytes hashed before,
  between and after, and with the `.ts` files' hashes unchanged across all three. Separately:
  hand-edit a floor literal into the query source on a scratch copy
  — and note **`R14`**: the policy pattern (zod contract, JSON values read at run time, derived
  schema, byte-for-byte drift test) is **rebuilt in a directory the trigger owns**, with **no edge
  to `src/harness/`**; ruling 5 named `harness/policies/` as the *shape* and §3 forbids the import,
  so I check both — the pattern present, and the import graph clean of a harness edge. Reusing the
  literal harness module is a fail of this row and of §3.2.
  **`M5` IS DECLARED LIVE AT REV 2 AND THIS ROW IS WHAT KILLS IT** (`5ab0ac4` §3): the developer
  reports that every assertion at boundary 2 runs at `floor: 0`, so the floor filter is
  **unreachable as tested** and a mutant removing it survives a green suite. A4's weak-match fixture
  is the row that covers it. **I do not take "M5 is dead at rev 3" on the handoff's word** — I run
  M5 myself on a scratch copy, `tsc --noEmit` clean, and require it red. A candidate whose A4 tests
  still run at `floor: 0` passes its own suite and fails this row. *Declaring a live mutant beats a
  green suite that does not cover the code, and checking the declaration is mine.*
  and assert the drift check goes **red**; then assert it is **green** on the unmodified candidate
  — the presence half that `T-156` requires.
- **Pass:** both directions observed from a data change alone, on A4's own fixture command; A2's
  three true negatives unchanged and still silent at both floor settings; drift check red on the
  planted literal and green on the candidate. **Fail:** behaviour that only changes when source
  changes;
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
  `null` — I record which, and present-and-empty is a fail. **RULED (`R2`, was my §9.2):** *"the
  key absent — present-and-empty is a fail (QA's reading is the brief's plain meaning: not an empty
  reminder)."* No longer mine), stdout is empty or a JSON object with no such key, exit 0. Across
  all four: `permissionDecision`, `permissionDecisionReason`, `updatedInput`, `decision` and
  `continue: false` are absent, and exit is 0.
  **The non-blocking property is CITED, not tested (`R2`).** That those fields would be ignored on
  `PostToolUse` is a fact about the host; it is cited here from the hooks reference and **no mutant
  is built to prove it** — a *deny on `PostToolUse`* variant run in a live session would put a
  throwaway hook in front of a real seat for no evidence the documentation does not already give.
  A5 asserts the hook's own emitted output and nothing about how the host treats it.
- **Pass:** all of the above, with the A1 positive and the A2 negatives in the same test run.
  **Fail:** any blocking field on any payload; a non-zero exit; an empty-but-present
  `additionalContext`; an id or `ACTION` text that does not match entry 299 at the candidate.
  **Untested:** cannot arise — the event is `PostToolUse` only (`R1`) and I invoke it myself.
- **Blind spot:** I invoke the hook the way the documentation says Claude Code does. **That is a
  relay** (the brief says so of its own reading, §7.7). A7 is the only row that observes the real
  host, and it is the reason A5 is not sufficient.

### A6 — three failure shapes fail silent to the model and loud to the log

- **Required (§4 A6, as re-scoped by `R3`):** the brief's row asked for *"the tool call's own result
  … byte-identical to a run with no hook registered"*. **That could not fail and is recorded as
  Planner 52:** on `PostToolUse` the tool has already run, so byte-identity is structurally
  guaranteed — a green A6 would have been a derived value answering its own question, the exact
  class `loop-14-closeout.md` §3 names, inside a brief that cites it. My §9.5 planted-unequal
  payload was aimed at the same row and is **moot**, not adopted. `R3` keeps the same three
  failures and replaces the observables: *store path absent, store locked, hook killed at its
  timeout*, each asserting **(a)** exit code `0`, **(b)** empty stdout — no `additionalContext`, no
  partial, no error string dressed as an entry — and **(c)** one line naming the failure in the log
  file the handoff names. *Fails silent to the model, loud to the log.* "Byte-identical tool result"
  is dropped as an observable.
- **Procedure:** the three shapes — `KNOWLEDGE_V2_DB` at a non-existent path; the store held under
  an exclusive SQLite lock by a second process for longer than the hook's timeout; the hook process
  killed at its configured timeout. For each: exit code captured from the process; stdout captured
  and asserted **empty**, and where non-empty, parsed and asserted to carry no `additionalContext`
  and no error text; **stderr captured and asserted EMPTY**. That observable was mine in the second
  commit and is now **`R15`** (`loop-16-brief-amendment-3.md` at `1051cae`), ruled in as the
  brief's clause and **stricter than I wrote it** — *empty*, not merely free of a stack trace. The
  reason is `R3`'s own: a `PostToolUse` hook that exits `2` has its **stderr shown to the model**,
  so a hook that exits `0` with anything on stderr passes `R3`'s three observables as written and
  still puts text in front of the seat — an injection through the other channel. **Everything the
  hook has to say about a failure goes to the log file and nowhere else.** No longer mine. Then read the named log file: one
  line per shape, naming the shape. **Presence half (`T-156`):** in the same test, a clean
  successful fire must leave the log **empty or absent** and must produce a non-empty stdout — so a
  log written unconditionally cannot pass the three checks by accident, and an always-empty stdout
  cannot pass (b) by accident.
- **Pass:** three shapes; three exits of `0`; three empty stdouts; **three empty stderrs**; three
  log lines naming their shape; clean fire silent in the log and non-empty on stdout. **Fail:** any
  non-zero exit; any stdout content on a failure shape; **any stderr content at all** (`R15`); a
  missing log line; a log file the handoff does not name. **Untested:** if the locked-store shape cannot be
  produced on Windows with the candidate's driver, recorded as untested with the attempt, never
  inferred from the other two.
- **Blind spot:** I observe the hook's output, not the host's handling of it. A crash inside the
  host's own merge of `additionalContext` is not reachable from here, and with byte-identity
  dropped as an observable nothing in this row watches the tool result itself. Named in §10.

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
  **at least two**. **`R16`: the census reads THREE counts, not two** — *not asked*, *asked,
  silent*, *asked, injected*. A7's two commands produce one `asked, injected` (the G-039 pipeline)
  and one `not asked` (`git status --porcelain` recognises no element), so the deltas are checked
  per state and **the `asked, silent` count must not move** from those two commands. A census that
  reports a single fires total, or that folds *not asked* into *asked, silent*, is a fail of this
  row — the three counts are the denominator the whole repair exists to create (brief §2: *fires,
  hits and injections are three different counts and the record can show all three*). `ob_recalled` must name entry 299 as hook-injected and must not name any entry
  from the silent fire. For the third clause — *the rated set at `/end`* — I read what `/end` would
  rate **without running my own `/end` as the instrument**: the rated set is resolved by
  `open-brain/src/pipelines/session-end/recalled-ids.ts`, and I call that resolution directly
  against the live session uuid and record its output. A seat's own `/end` reporting on the
  correctness of its own `/end` is the derived-value defect the developer named in Loop 14, and I
  will not use it as the measurement. **Was `[mine — §9.1]`; RULED `R8`, see below.**
- **Pass:** census delta ≥ 2 on the new value; `ob_recalled` distinguishes hook-injected from
  explicit; the resolved rated set contains 299 and no looked-at-only entry. **Fail:** the census
  showing the fires under `unspecified` or under `explicit` (the brief: *"a hook-fired recall is
  never counted as an `explicit` one"*); any looked-at-only id in the rated set — that writes
  `success_rate` for entries nobody read, the column that gates apoptosis and boosts ranking.
  **Untested:** whatever A7 leaves untested, propagated, not inferred.
- **RULED (`R8`, was my §9.1):** *"A8 is observed by calling the resolution directly, not by running
  QA's `/end` — `getSessionRecalledIds` against the live uuid, in the probe session. QA does not run
  `/end` mid-loop in any case; its `/end` is the roll. **Not both.**"* So the direct call is the
  measurement and the `/end` run is not made. No longer mine.
- **Two more rulings this row observes.** **`R5`:** a silent fire never enters the rated set **by
  construction, not by a filter** — `getSessionRecalledIds` and `recalled-ids.ts` precedence are
  unchanged, so a candidate that reaches the same outcome by filtering looked-at ids out of
  `recall_log` is a fail of this row even though the set looks right. I read the code for which it
  is, not only the result. **`R7`:** injected entries bump `recall_count` and `last_recalled_at`;
  looked-at entries do **not**. Measured on entry 299 and on one looked-at decoy, before and after,
  read from `knowledge_index` directly — both directions, one test.
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
- **RULED (`R10`, was my §9.7):** *"A10 measures the floor, and says so. Fifty or more repetitions
  of one fixed trivial command, with and without the hook, p95 wall time reported with the method
  and the configured `timeout`. That is the hook's cost, and node startup is its floor; if the
  number is mostly interpreter startup the handoff names that and names 'resident process' as the
  out-of-scope way down."* So the fixed trivial command is the ruled shape, not my convenience, and
  the report says in words that it is a floor rather than a realistic mix. I additionally check
  that the **handoff** names the startup share and the resident-process option when the number is
  mostly startup — that is `R10`'s clause on the developer, and a row I would otherwise pass while
  the required sentence is missing.
- **Pass:** the numbers exist, with the method, and the handoff carries `R10`'s sentence where it
  applies. **There is no threshold** — the brief says a number, not a verdict, and I do not invent
  one. **Fail:** the measurement not taken, or taken with the method unstated. **Untested:** no
  registration word from Aaron.
- **Blind spot:** one machine, one store size (599 entries at base, §7.2). Cost is a function of the
  store, and a p95 here says nothing about a store ten times larger.

### A11 — the targeted run is scored; the full suite is reported both ways

- **Required (§4 A11, as re-scoped by `R12`):** the brief's row asked for the suite's *"exit code
  read from the process"*. **The full suite is red at base** — twice, alone, a different single
  victim each time, both victims green in isolation (§7.6). Scoring the row as written would have
  failed a candidate for a condition it inherited. `R12`:
  - **SCORED:** the **targeted run** — the trigger's own tests plus the existing recall tests —
    exits `0` from the process; plus `sync --check` **zero skipped** in this tree;
    `module-boundary` green; and the network test covering the trigger's module.
    **The developer names the targeted set in its handoff; I may add the recall tests if it omits
    them** (the §7.4 enumeration is what I add from).
  - **REPORTED, both ways, not scored:** the full suite run **once, alone** at the candidate —
    files and tests passed and failed, the exit code, the unhandled-errors line, and **every victim
    by file and test name**.
  - **A full-suite failure counts against the candidate only if** the failing test **(i)** fails
    again **alone**, or **(ii)** lives in a file the candidate touched, or **(iii)** is in the
    targeted set. Otherwise it is environment, recorded with the SHA.
  - **`G-042` and `G-016` are not repaired this loop.** The planner amends `G-042` at the close-out
    with my two base runs.
- **Procedure:** targeted run first — `npx vitest run <the named set>`, stdout+stderr to a file,
  `rc=$?` written to a file and read back, exit `0` required. Then `node open-brain/build/cli.js
  sync --check` from the root, full output, **0 skipped** asserted explicitly (a skip is not a
  pass), with `gitnexus-index` reporting the candidate's SHA and `module-boundary` green in that
  run. Then the full suite **once, alone**, nothing else running from this seat, same exit-code
  discipline; every victim named; each victim then re-run **alone** to apply (i), and checked
  against `git diff <base>..<candidate> --name-only` to apply (ii). For the network clause: locate
  the test the developer added, then **validate it against a planted positive** — introduce a
  network call into a scratch copy of the trigger's module and assert the test goes red — before
  believing its green.
- **Pass:** targeted run exit 0; `sync --check` clean, 0 skipped; `module-boundary` green; network
  test red on the planted call and green on the candidate; and no full-suite victim meeting (i),
  (ii) or (iii). **Fail:** any of those; in particular a **targeted** run that prints a green count
  and exits non-zero, recorded with the full worker output. **Untested:** cannot arise.
- **Blind spot:** a green targeted run is evidence about the trigger's own tests, not that nothing
  else broke — and the full suite, which would be that evidence, is exactly the instrument `G-042`
  has made unreliable here. The (i)/(ii)/(iii) filter is a judgement I apply; a real regression in
  a file the candidate did not touch, that happens to pass alone, walks through it. I name that in
  §10 rather than pretend the filter is tight.

## 3. Preservation — what must still be true (brief §3)

Checked at the candidate, each with its own observation, none inferred from a green suite:

1. **`ob_recall` for an explicit caller behaves exactly as at base** — same SQL, same broadening,
   same output. Measured as: the base output captured in §7.1 reproduced byte-for-byte at the
   candidate for the same query and limit against the same store snapshot, plus A9's diff.
2. **The targeted run green with the exit code from the process; `sync --check` clean, zero
   skipped; `module-boundary` green; the full suite reported both ways** — A11 as re-scoped by
   `R12`. **The trigger imports nothing from the harness and the harness imports nothing from it**
   — read from the import graph, not asserted.
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
explicit callers, including applying the new floor to it (`G-026`, not this loop) **or widening its
zod enum with the new trigger value (`R6`)**; adding a second always-loaded curated set; `T-014`
beyond the one constraint in A8; `T-154`/`G-030`; **registering `PreToolUse` (`R1` chose
`PostToolUse` only)**; **repairing `G-042` or `G-016` (`R12`)**; any change to `.claude/commands/`,
to `open-brain/src/harness/`, or to the record schema; Jev, a network call or an API key anywhere in
the trigger's path; `G-045` or slice three's list.

## 5. What I will report as a finding even though no row fails

1. **Entry 299's rank against the live store, not the fixture.** A1 is a fixture measurement. The
   live-store rank at base is in §7.1 (rank 1, *with broadening having fired*); I take the same
   measurement at the candidate through the trigger's precision-only path, and if entry 299 does not
   come back at all — because the precise query underfills below the floor — that is the most
   important number in the report and it is not a row.
2. **What the floor was calibrated against.** A4 tests that it is data. If the developer's stated
   calibration is one query, the report says so.
3. **Where the reminder lands relative to the act.** The event is ruled (`PostToolUse`, `R1`), and
   the ruling's own reason is that *"the damage is done when the seat reads the trimmed output and
   the `0`, and the reminder lands beside that result."* So the reminder arrives **after** the act
   by design. I report what that looked like in A7's transcript — whether the reminder sat beside a
   result the seat had already drawn a conclusion from — as an observation, not a row.
4. **The inherited defects, named:** the trigger runs the main tree's build, so a stale main tree
   serves a stale trigger (`G-034`), and the registration route is `G-030`'s. The brief requires the
   handoff to say so; I check that it does.
5. **Anything in the `G-040` family** — a scan or assertion that matches the sentence forbidding a
   thing as though it were the thing, in either direction.
6. **The size and content of the element table, and what it cannot see.** The derivation recognises
   two elements (`5ab0ac4` §1), each from a real error in this repo, and a command with no
   recognised element never asks the store. That is the right direction for *fails closed on
   nothing* and it also means **the trigger's reach is exactly the table**. I report how many
   commands in A10's fifty derived anything at all — the *not asked* rate on ordinary work — as a
   number, not a row. A channel that is closed for 49 of 50 real commands is working as ruled and
   is still worth knowing before the loop after this one decides what a third element costs.
7. **Whether any mutant the developer declared live is still live at the candidate.** M5 is
   declared at rev 2 (`5ab0ac4` §3) and M4 was declared dead only once `R18`'s assertion existed.
   I run both myself rather than reading the handoff's account of them, and the report says which
   mutants I ran, not which I was told about.

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
6. **The base full suite is RED, twice, alone — taken after `154d1b3` and the reason A11 was
   re-scoped.** Both runs `npx vitest run` in `open-brain/`, nothing else running from this seat,
   exit code written to a file and read back from the file.
   - **Run 1:** exit **1**. Test Files 1 failed | 64 passed (65). Tests 1 failed | 973 passed
     (974). Errors 1. Duration 131.40s. Victim:
     `tests/shared/state-writer.test.ts > applyStateOps (Loop 3 writer) > "ops: [] with render:
     true re-renders the views, leaves revision and state.json bytes unchanged, and runs no
     retention (R3)"` — `EPERM: operation not permitted, rename '…\ob-state-writer-88czyU\.agents\
     SYSTEM\SUMMARY.md.tmp-13832' -> '…SUMMARY.md'` at `atomicWrite src/shared/state-writer.ts:561`.
     **This is `G-016`'s family exactly** (intermittent cross-test failure in that file under the
     full suite, opened session 58).
   - **Run 2:** exit **1**. Test Files 1 failed | 64 passed (65). Tests 1 failed | 973 passed
     (974). Errors 1. Duration 123.61s. Victim:
     `tests/pipelines/session-start/role-files.test.ts > describeRoleFiles > "records
     HEAD-behind-upstream for a role file without calling it stale"` — `Test timed out in 5000ms`
     at `role-files.test.ts:154`. A different file, a different failure mode, Loop 14's own C1 file.
   - **Both victims together, in isolation:** exit **0**, 2 files, 49 tests passed, 9.75s. Neither
     is a defect in the code; both are full-suite-only and load-dependent.
   - **`G-042` fired in BOTH runs:** `[vitest-worker]: Timeout calling "onTaskUpdate"`, raised as an
     Unhandled Error, **alone both times.** The previous QA seat's handoff at `94d3e4e` records
     four clean runs alone and one red under load, and leaves open whether the condition is real
     when nothing else runs. Two for two here at this base.
   - **The honest limit on "alone":** alone means nothing was running from **my** seat. I cannot
     see another session's load on this machine and did not ask anyone to be idle. The previous
     seat's four clean runs were at a different SHA during Loop 14, so *"the base changed"* and
     *"the machine was busier"* are both live and I have not separated them.
   - `sync --check` at base: **27 passed, 0 fixed, 3 warnings, 0 issues, 0 skipped** (warnings:
     `prd-version`, `vault-index-parity`, `spec-provenance` — all pre-existing seat-tree
     conditions).
7. **THE SAME BASE IS GREEN IN THE DEVELOPER'S TREE** (`5ab0ac4` §3, relayed by the planner, **not
   measured by me**): the full suite there ran **986 passed, exit 0, alone**. Mine exited 1 twice,
   alone, at the same base on the same machine — different trees, different times, and a different
   test count (986 vs 974), which is itself unexplained and which I record rather than reconcile.
   **This is the datapoint that moves `G-042` from "is it this machine" to "it is not even this
   machine uniformly"**, and it is one more row for the planner's `G-042` amendment at close-out.
   It does not change `R12`: A11 is still scored on the targeted run, because the condition is
   demonstrably tree- and time-dependent and a candidate cannot be held to it. **Relay discipline:**
   I did not run the developer's tree and will not; the number is cited to `5ab0ac4` in the report,
   never restated as an observation of mine.

## 8. Procedure order on hand-over

1. Record the SHA as given, in writing, with the time. `git cat-file -t`.
2. `git checkout --detach <SHA>`; `git status --porcelain` empty; `git rev-parse HEAD` equal.
3. Build, analyze, `sync --check` (§1). Exit codes into variables, read back from files.
4. **A1's seen-red check first** — the branch's first commit, in a scratch worktree.
5. A9's diff, before running anything, so I know what moved.
6. A1–A4 against the fixture store; A5, A6 against the hook as a process.
7. A11's **targeted** run (scored), then `sync --check`, then the full suite **once, alone**
   (reported both ways); every full-suite victim re-run alone and checked against the candidate's
   changed files, per `R12`'s (i)/(ii)/(iii).
8. Ask for the registration word (§1); on it, A7, then A8 immediately, then A10; then restore the
   registration and read `settings.json` back.
9. Re-check `git rev-parse HEAD` and `git status --porcelain`. If either moved, the evaluation is
   void and says so.
10. Write the report. Verdict, then every row with its observation, then §6's list, then the probe
    shapes, then what the checks cannot see.

## 9. Returned to the planner at `154d1b3` — all seven RULED before any candidate existed

Per Loop 14's A7-style ruling, these were marked as mine in the first commit and returned rather
than silently applied. **All seven were ruled by the planner in `loop-16-brief-amendment-1.md`
(`1453e5f`) before the developer's first commit**, and every clause now carries its ruling inline
in §2. This section is kept so the provenance of each clause is auditable, not as an open list.

| # at `154d1b3` | ruling | outcome |
| --- | --- | --- |
| 1 — A8 without running my own `/end` | **`R8`** | **Adopted, and narrowed to one method:** the direct `getSessionRecalledIds` call **only** — *"not both"*. The `/end` run is not made. |
| 2 — A5: present-but-empty is a fail | **`R2`** | **Adopted as the brief's plain meaning.** No longer mine. |
| 3 — A6's planted-unequal payload | **`R3` + Planner 52** | **Moot, not adopted.** The row it defended could not fail on `PostToolUse`; A6 is re-scoped to exit code, empty stdout and a log line. My instinct is recorded as *"the right instinct against the same row"*, and the row it aimed at is gone. |
| 4 — A1's independent second caller | **`R11`** | **Stays as mine**, explicitly: *"it can fail only on a genuine disagreement, which is a finding either way."* The one clause in this file still marked `[mine]`. |
| 5 — A2: a fire under `unspecified` is a fail | **`R6`** | **Confirmed as the brief's plain meaning.** No longer mine. `R6` also rules the value goes into `RECALL_TRIGGERS` and **not** into `ob_recall`'s zod enum. |
| 6 — must the first commit survive to hand-over? | **`R9`** | **Yes.** No squash, rebase or reorder; the hand-off names that commit's SHA. A rewritten branch is now a **fail** of A1, not an untested row. |
| 7 — A10: generated calls or real work? | **`R10`** | **Generated, fixed, trivial — and the report says it is a floor.** The developer's handoff must name the startup share and the out-of-scope way down when the number is mostly startup. |

**Two planner errors were set in the same file and are recorded here because they changed my rows:**
**Planner 51** (A4 was unbuildable — no floor can promote a row FTS never returns) and **Planner
52** (A6 could not fail on `PostToolUse`). Both were caught by the developer reading the artifact,
independently of my §9.3 aiming at the same row from the other side.

**One clause of mine was ruled in after the second commit.** The stderr observable I added to A6
and returned as my own is now **`R15`** (`loop-16-brief-amendment-3.md`, `1051cae`) — *"it is ruled
here so it is the brief's clause and not QA's"* — and the ruling is **stricter than my version**:
stderr asserted **empty**, not merely free of a stack trace. Unmarked in A6. That is the §9
mechanism running in the direction it is supposed to: a clause I could have applied silently
instead reached the developer as a requirement.

**Four rulings arrived at the developer's boundary 2 (`ee74fd1`, rev 2), in
`loop-16-brief-amendment-4.md` (`5ab0ac4`), and they changed two rows before any freeze.**
**`R16`** — three invocation states, with *not asked* distinguished from *asked, silent*; applied
in §1 and A2 and read as three counts in A8. **`R17`** — a recognised command against a store with
no answer is a **required** test, and it is the only case that shows the channel fails closed
rather than merely fails to understand; applied in A2. **`R18`** — `tail -f file` derives nothing
and the G-039 pipeline derives all three terms, both directions, with the developer's mutant M4 run
by me; applied in A2. **The design fact behind all three** — the query is narrow *by construction*
because ANDing a command's words matches nothing in FTS5 — is in §1 as a fixed condition, because
every row that asserts silence now has to say **which** silence.

**Three later rulings, in `loop-16-brief-amendment-2.md` (`c43a31f`), read from the tracked file
rather than only from the room.** **`R12`** re-scoped A11 after I measured the base suite red twice
(§7.6) — applied in A11. **`R14`** rules the floor's policy pattern is rebuilt trigger-owned with
no edge to `src/harness/` — applied in A4 and checked against §3.2. **`R13`** records that the
developer declined to open this file when the planner's GO named it, on brief §6 (*the developer
does not see the probes*); nothing here changes, and it is noted because it means the probes in
this file are still unseen by the seat being evaluated.

**Still open and not mine to close:** nothing from §4's rows. The two standing acts are Aaron's —
the `settings.json` registration for A7/A10 (§1), and his ruling held at brief §8.1 on building the
deterministic trigger only.

## 10. What these criteria, as a set, cannot see

A green sweep of §2 means: the query ranks one entry first against a small fixture; three commands
never reach the store and one recognised command reaches it and comes back empty, each recorded as
the state it was; the query does not broaden; its floor is data; the hook's JSON is shaped right; three
failure shapes exit 0, say nothing and are logged; one real session shows one injection and one
silence; the census and the rated set agree with that session; nothing existing changed; and there
is a latency number. **It does not mean the store gets used.** It does not mean the entry surfaced
was the useful one, that the floor is set anywhere near right, that the trigger fires for commands
nobody thought to test, or that a seat reads what appears next to its tool result. The loop's own
brief says the last of these outright. The rest are named here so that a pass is read for what it
is.

**Three holes the amendments opened, named rather than left implicit.** (1) `R12`'s (i)/(ii)/(iii)
filter is a judgement I apply: a real regression in a file the candidate did not touch, which
happens to pass when re-run alone, walks through it — and the full suite, the instrument that would
catch it, is the one `G-042` has made unreliable here. (2) With byte-identity dropped from A6
(`R3`, Planner 52), **nothing in §2 watches the tool result itself**; the row now watches the hook
only, which is the correct scope on `PostToolUse` and is still less than the brief originally
asked. (3) `R2` cites the host's handling of `permissionDecision` on `PostToolUse` from the
documentation rather than testing it — a deliberate trade, and a relay.

**A fourth, opened by amendment 4 and not a hole in the rulings but in what any of this can show.**
The trigger's reach is exactly its two-element table (`5ab0ac4` §1), so every row in §2 measures a
channel that is **closed by default**. Nothing here can distinguish *the table is the right size*
from *the table is too small*, and a green sweep is fully compatible with a trigger that never
fires on real work — which is the failure mode `G-039` itself is an instance of, arriving from the
other side. §5.6 reports the *not asked* rate on A10's fifty calls as the only number that speaks
to it, and it is a number, not a verdict.
