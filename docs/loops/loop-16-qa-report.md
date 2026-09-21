# Loop 16 — QA report 1: candidate `45ee2ab`

**By:** Probe (QA seat; session uuid `6eab2c5c`) · **Date:** 2026-09-21 ·
**Candidate:** `45ee2ab` (rev 9, tip of `loop/16-recall-trigger`), frozen and handed over by the
planner · **Base:** `origin/master` `4550ee5` (record rev 59, v0.43.0) ·
**Criteria:** `docs/loops/loop-16-qa-criteria.md` at **`a957270`** (seven commits, none amending an
earlier one, all written before the candidate SHA was named) ·
**Brief:** `loop-16-brief.md` `8457600` with amendments `1453e5f` `c43a31f` `1051cae` `5ab0ac4`
`6da5fa9` `f28ed11` `3db1365` `29766dc` (verified complete against the branch: those eight and the
brief are the whole of `4550ee5..docs/loop-16-brief`) ·
**Developer's hand-off:** `docs/loops/loop-16-developer-handoff.md` at the candidate.

---

## VERDICT — NOT ACCEPTED

**On one clause: A11's fourth.** The brief's §3 and row A11 both require *"a test that fails if a
network call is attempted covers the new code."* **No such test exists.** The clause is not
partially met or met elsewhere; there is nothing to run.

**Everything else in §4 that can be run without the hook registered passes**, several of them
against probes built to break them. This is a narrow rejection of a strong candidate, and the row
failed the way a row is supposed to: the brief named the guard, the guard is absent, and no other
observation substitutes for it.

**A7, A8 and A10-live are `untested`** — they need the trigger registered in Aaron's
`settings.json`, which is his act and had not come when this report was written. **No row is
inferred from the others**, and the verdict does not rest on them.

---

## 1. Fixed conditions, as they actually were

| | |
| --- | --- |
| Candidate identity | `git cat-file -t 45ee2ab` → `commit`. Tip of `loop/16-recall-trigger`. Nine commits, unsquashed, first `90e314f`. |
| Evaluation tree | `~/Worktrees/sia-qa`, `git checkout --detach 45ee2ab`. `git status --porcelain` empty and `git rev-parse HEAD` = `45ee2ab...` **before the first observation and again after the last** — both checked, both unchanged. `build-info.json` commit `45ee2ab...` at the end as at the start. **The evaluation is not void.** |
| Made to resemble the main tree | No lockfile change base→candidate, so no `npm ci`. `npm run build` exit 0, stamped `45ee2ab`. `node .gitnexus/run.cjs analyze` exit 0 **first try** (no `T-055` this time). `sync --check` exit 0: **27 passed, 0 fixed, 3 warnings, 0 issues, 0 skipped**; `module-boundary [pass]` 69 files / 48 core; `gitnexus-index [pass]` at HEAD; `build-freshness [pass]`. The three warnings (`prd-version`, `vault-index-parity`, `spec-provenance`) are pre-existing seat-tree conditions, present at base. |
| Main checkout | Not moved, not built, not checked out. Its one unique condition, Aaron's untracked `.agents/SYSTEM/PRD.md`, is **unrun** — not implied green. |
| Read-only | No tracked file at the candidate was edited. Every mutation was made on scratch worktrees of the shared object store, outside the candidate tree. |
| Exit codes | Every one below was written to a file and read back from the file, never from a pipeline's last stage. |

---

## 2. Rows

### A1 — ranks entry 299 first · **PASS**, with a finding against its evidence (F2)

**Seen red first (`R9`).** `git log --reverse 4550ee5..45ee2ab` gives `90e314f` as the first commit.
It contains the A1 test **and** `src/trigger/query.ts`, which on its face is my criteria's *"must
not contain the implementation"*. **It is not the implementation:** `query.ts` at that commit is a
declared skeleton whose header says *"STATUS: skeleton. `deriveQuery` and `queryStore` are stubs so
that A1's test fails on its ASSERTION rather than on module resolution"*, and both functions return
empty. Scored on substance. Run in a scratch worktree at `90e314f`: **exit 1**, failure
`AssertionError: expected 0 to be greater than 0` — an assertion, not a module-resolution error,
which is the better red. The file's second test passes there and correctly so: it is a
fixture-validation guard (*"≥10 decoys really share the command tokens"*), independent of the
implementation by design.

**At the candidate.** The developer's A1 test passes. My independent second caller (`[mine]`, kept
by `R11`) **disagrees** — see **F2**. The row is scored PASS because `R20` rules A1 a test of
ranking *before the floor* against the brief's ten-decoy fixture, and against that fixture entry 299
is rank 1. What the row is evidence *of* is the subject of F2.

`R20` compliance checked: A1's assertions run with the floor out of the path **locally and
deliberately**, not by a suite-wide disabling — which would be mutant M7, and A4 kills it.

### A2 — three negatives, recorded as `not asked` · **PASS**

The three commands derive nothing, the store is never consulted, and each fire is recorded as
**`not-asked`**, asserted apart from `asked, silent` (`R16`). `R17`'s case — a recognised command
against a store with one unrelated entry — is present and records **`asked, silent`**. `R18` is
asserted both ways (single-stage `tail -f` derives nothing; the G-039 pipeline derives all three
terms). Each verified live by mutation, below.

### A3 — no broadening · **PASS**

The underfill fixture returns nothing. **Killed by my own mutant:** changing the conjunctive joiner
to `OR` — the `ob_recall` path ruling 4 forbids, and the module's comment predicts *"a broadening
mutant has to edit this line to exist"* — is `tsc --noEmit` clean and turns **5 tests red**,
including both A3 rows.

### A4 — the floor is data, and the fixture that tests it is protected · **PASS**

The floor is `8.0`, read from `src/trigger/policies/recall-trigger.json`, validated by a zod
contract. `R19`'s provenance is present and names **both** the corpus size (`599`) and the date
(`2026-09-20`), and the contract **requires** it.

**The scale row is real, which is what I checked rather than the distance** (`6da5fa9` makes the
distance true by construction). Shrinking the fixture corpus from 597 fillers to 1 — target asserted
unique first, `tsc` clean — turns the scale row **red**: `expected 0.00000552578837544597 to be
greater than 8`. That is 5.5e-6, the number amendment 5 predicted, and it takes the shipped-floor
injection row red with it. **A shrunk fixture fails loudly rather than going vacuous.**

**M7** (the floor removed from the filter), `tsc` clean: **4 tests red** — A4's two rows, A5's policy
row and A8's. **M5**, declared live at rev 2 and reported dead at rev 3, is dead: it is the same
filter M7 mutates.

### A5 — the emitted JSON, both directions · **PASS**

Positive verified **as built, from the test's code and not its name** (`R20`): 598 filler + entry
299 = **599 documents**, hook **spawned as a child process** through `tsx`, payload built by
`JSON.stringify`, floor loaded from the shipped policy file. `additionalContext` carries entry 299's
id (read from the store, not assumed) and its `ACTION`. `Object.keys(emitted)` is exactly
`['hookSpecificOutput']`; `permissionDecision` and `updatedInput` absent; exit 0; stderr empty.
Negatives emit **no key at all**. `R2`'s cited-not-tested clause is honoured — no "deny on
PostToolUse" variant was built, correctly.

### A6 — fails silent to the model, loud to the log · **PASS**

Four failure shapes present — store path absent, store locked, past its own deadline, **malformed
payload logged and dropped (`R23`)** — plus a positive control in the same file.

**Substitution accepted and recorded:** my criteria said *"hook killed at its timeout"*; the
candidate tests *"past its own deadline"*. The hand-off §9 gives the reason — better-sqlite3 is
synchronous, so nothing can interrupt a query in progress; the host `timeout` (10s) bounds how long
the process may run and `deadline_ms` (2000) bounds what may still be emitted. "Killed at its
timeout" is not producible from inside the hook. Ruled the brief's clause by the planner
(`0c70b52`).

**`R15` — and this is the row I trusted least, so I tested the instrument rather than the code.**
`M18` had found that the first harness hardcoded `stderr: ''` because `execFileSync` returns stdout
only, so every stderr assertion passed without looking. The rewrite is on `spawnSync`. **Verified:**
with a `tsc`-clean plant writing one line to stderr at the hook's entry point, **9 of 12 hook tests
fail with `expected 'PLANTED-STDERR-PROBE\n' to be ''`**. The harness genuinely captures stderr.
`status` and `stdout` come off the same `spawnSync` result object, so this one plant establishes the
capture mechanism for all three channels — stated that way rather than claimed as three proofs.

### A7 — the real session, from the transcript · **UNTESTED**

Needs the trigger registered in `~/.claude/settings.json`, which is Aaron's act for that act. The
exact JSON was posted to the planner with the SHA. **`settings.json` was not touched and not
modified at any point**; it was read once, read-only, to establish that `PostToolUse` is `[]` (it
is) and that one `PreToolUse` entry exists. No row is inferred from the others.

### A8 — the census and the rated set · **UNTESTED (live half)**, with its mechanisms verified

The live half needs A7. What can be checked without registration was:

- **`trigger_fires`' CHECK constraint, tested in SQL against a scratch store rather than through
  the candidate's own helper.** The three legal states insert; **`'asked'`, `''`, `'INJECTED'` and
  `'not_asked'` are all refused by the database** (`CHECK constraint failed: state IN ('not-asked',
  'silent', 'injected')`), and the row count afterwards is 3, so the refusals wrote nothing. The
  case-variant and underscore-variant matter: the TypeScript union is erased at run time and those
  are exactly what would slip past it.
- `R5`'s shape: fires live in a sibling table; a silent fire never enters `recall_log`, by
  construction rather than by a filter.
- `R6`: `hook` is in `RECALL_TRIGGERS` and not in `ob_recall`'s zod enum, asserted **by name** —
  *not explicit* would pass on `unspecified`.

### A9 — existing recall tests untouched · **PASS**

`git diff --name-status 4550ee5..45ee2ab -- open-brain/tests/` is **five files, every one status
`A`**. No `M`, no `D`. No existing recall assertion modified. Verified, not relayed.

### A10 — the cost · **UNTESTED (live)**

Needs registration. The developer's measured numbers are in hand-off §7 and `R22` has already ruled
the disposition; a slow number is not a fail. Not reproduced here because the arms require the hook
registered.

### A11 — **FAIL on clause 4**

| clause | result |
| --- | --- |
| targeted run exits 0 from the process | **PASS** — my enlarged set at the candidate: **14 files, 201 tests, exit 0** |
| `sync --check` clean, **zero skipped** | **PASS** — 27 passed, 0 issues, **0 skipped** |
| `module-boundary` green | **PASS** — 69 files / 48 core |
| **a test that fails on any network attempt covers the trigger's module** | **FAIL — no such test exists** |

**On the counts.** The hand-off §8 says 11 files / 130 tests *at `4a9b056`*; the planner relayed the
developer's 12 files / 143 tests *at `45ee2ab`*. Both are labelled at their own SHAs and both are
consistent with later commits adding a file. Mine is 14 / 201 because `R12` lets me add the two
recall-carrying files the developer's set omits (`index-upsert.test.ts`, `active-session.test.ts`);
the number of record is mine, at the candidate's SHA.

**Full suite, reported both ways and not scored (`R12`).** Run **alone** in this tree at the
candidate: **70 files, 1021 tests, all passed, exit 0**, no unhandled error, 111.48s. **No
`R12`(i)/(ii)/(iii) case arises — there are no victims.**

---

## 3. F1 — the finding that decides the verdict

**Required** (brief §3, repeated in A11): *"No network in the test suite and none in the trigger's
path. A test that fails if a network call is attempted covers the new code."*

**Observed:** `grep -rniE "network|fetch|http|undici|net\.|dns"` over `open-brain/tests/trigger/`
returns **nothing**. The only `setupFiles` entry, `tests/setup-env.ts`, redirects state paths and
does not touch the network. The five repository files that mention *network* are harness and
vault-writer tests; the harness has no edge to the trigger by construction, so none of them covers
it.

**The instrument was validated before its zero was believed.** The same grep over the same paths
returns **120** hits for `expect` and **22** for `import`, and **0** for a nonsense token.

**The property itself holds.** Nothing under `src/trigger/` or `cli-recall-trigger.ts` imports
`fetch`, `node:http(s)`, `node:net`, `node:dns` or `undici` — checked statically. **So this is not a
live defect. It is the missing guard against one becoming live**, and the brief asked for the guard
by name. My A11 pass clause requires the network test red on a planted call and green on the
candidate; there is no test to plant against.

---

## 4. F2 — A1 passes, and its fixture demonstrates less than it reads

Reported both ways under `R11`: the developer's A1 test passes; my independent second caller
disagrees; the disagreement is the finding.

**On the candidate's own A1 fixture.** The derived query is conjunctive — `"tail" "exit" "code"`,
ANDed. **Exactly one of the ten decoys contains all three terms.** The query matches **2 documents
of 11**, and entry 299 wins **1.15 to 0.99** against a single competitor. The test file's own
docstring says the decoys are the point and that *"a query that returns 299 out of a store where
nothing else mentions `tail` or `exit` has demonstrated nothing about ranking"* — the fixture is one
step from exactly that. The cause is visible: the decoys were written against **the brief's** token
list (`exit`, `code`, `tail`, `run`) while the derivation ANDs a narrower three. Nine of ten decoys
are inert.

Per-decoy term presence, measured:

| decoy | tail | exit | code |
| --- | --- | --- | --- |
| `exit-code-from-variable` | ✓ | ✓ | ✓ |
| `echo-debugging`, `gitnexus-analyze-exit`, `shell-pipeline-basics`, `code-review-exit` | – | ✓ | ✓ |
| `vitest-run-alone`, `head-truncation` | – | ✓ | – |
| `tail-follow-logs` | ✓ | – | – |
| `npx-runner-selection`, `run-command-allowlist` | – | – | – |

**On a fixture built to the brief's spec.** 599 documents, ten decoys of comparable length that each
genuinely carry all three terms, written by me as plausible technical prose: **entry 299 ranks
third** (11.43), behind `d-docker-exit` (12.01) and `d-build-tail` (11.87). With `max_injected: 1`,
**the trigger would inject an irrelevant entry** — which is the `g-039-ruling`'s own prohibition:
*"it must never inject a low-relevance entry confidently, because an agent trained by a few wrong
injections to ignore the channel is worse off than one with no channel."*

**The counterweight, and why this is not a defect in shipped behaviour.** §5.1, measured by me
against the **live 599-entry store** through the trigger's own precision-only path at the candidate,
reproduces the developer's numbers exactly: **14.01 / 12.29 / 10.62 / 6.83 / 6.03**, entry 299
**rank 1**, three entries above the floor, and the trigger would inject entry 299. It works today on
the real corpus. What is shown is that it is **not robust to the store acquiring a few documents of
a shape it does not currently hold**, and that A1's fixture cannot see that. It is the ranking
analogue of `R19`: a property measured against one corpus on one day.

Ruled by the planner (`0c70b52`): a limit of the brief's own fixture wording, plus a ranking gap of
`R19`'s kind for the close-out, with this fixture as its evidence. Not repaired under the freeze.

---

## 5. Mutants I ran myself

Every target asserted **unique** before mutating — a runner that silently takes the first of several
matches reports *killed* about a line it never changed. Every mutant `tsc --noEmit` clean before
being counted.

| mutant | tsc | result | killed by |
| --- | --- | --- | --- |
| **M16** — `trigger/` removed from `MEMORY_SIDE` | 0 | **red**, 1 of 12 | `module-boundary.test.ts` |
| **M18b** — one line written to stderr at the hook entry point | 0 | **red**, 9 of 12 | every `expect(stderr).toBe('')` in `hook.test.ts` |
| **M4** — the pipeline requirement dropped | 0 | **red**, 1 | `R18`'s row, and only that row |
| **M7** — the floor removed from the filter | 0 | **red**, 4 | A4 ×2, A5's policy row, A8 |
| **BROADEN** — conjunctive joiner changed to `OR` | 0 | **red**, 5 | A3 ×2, A1, `R17`, `R18` |
| corpus shrunk 597→1 | 0 | **red**, 2 | A4's scale row and its injection row |

**M22 is declared alive with a reason and the declaration is correct.** The query only reads, so
restricting its handle has no behavioural difference to detect; the substitute row asserts the
handle is read-only **in both directions** — the query works through it, and `DELETE` through it
throws `/readonly/`. Checked as the row, not as the mutant, per the planner's instruction. **A
declared-alive mutant is a stated gap and is reported as one**, not folded into "all red".

---

## 6. `R21` / preservation — the boundary

**The `MEMORY_SIDE` declaration is the only change to the check.** `git diff` over
`src/pipelines/sync/checks.ts` is **two array entries** (`cli-recall-trigger.ts`, `trigger/`) plus a
comment. **No loosened predicate, no new ignore, no widened glob**; `isMemorySide` is untouched.
This was the check that mattered: a real declaration and a quiet exemption both turn
`module-boundary` green, and M16 alone does not tell them apart — the diff does.

The other boundary is asserted separately and holds: no edge either way between `src/trigger/` and
`src/harness/`. `R14`'s policy pattern is rebuilt trigger-owned rather than imported.

**`R24`'s fence holds.** The net diff `4550ee5..45ee2ab` touches **no** `CHANGELOG.md`,
`README.md` or `package.json`. `4a9b056` added them and `8851afb` reverted them; the pair against
its parent nets to the hand-off document alone. Additive, not a rebase — the history survives and
the CHANGELOG text is recoverable from `4a9b056` for the bump after acceptance. Checked by path, not
from the hand-off's summary.

**`R24`'s hand-off contract** — checked as procedure step 0, before any row: first commit `90e314f`
(§1, §5), targeted set (§8), floor provenance naming size and date (§2), where the cost goes (§7),
`M22` declared (§6). **All five present.**

---

## 7. `G-042` — a sixth sighting, and it is clean

| run | tree | code state | tests | exit |
| --- | --- | --- | --- | --- |
| mine ×2 | QA | base `4550ee5` | 974 (973 passed, 1 failed, a different victim each) | 1 |
| developer | developer | rev 2 `ee74fd1` | 986 passed | 0 |
| developer | developer | rev 3 `12b5aeb` | 997 passed, 0 failed | 1 |
| developer | developer | rev 4 `405a5e3` | 1008 passed, 0 failed | 1 |
| developer | developer | rev 5 `1afb04c` | 1021 passed | 0 |
| **mine** | **QA** | **candidate `45ee2ab`** | **1021 passed, 70 files** | **0** |

All developer rows are relayed from `5ab0ac4` §3, `6da5fa9` §3 and `3db1365` §2 and are **not**
measured by me. The last row is mine. It is **the first clean full run of rev-5-or-later source in a
second tree**, and it retires the correlation I drew at my sixth criteria commit — that the rising
test count predicted the timeout — which the fifth point had already broken.

---

## 8. What could not be verified, so nobody inherits it as settled

- **A7, A8-live and A10** — no registration word at the time of writing. Not inferred.
- **That a seat *applies* what the trigger surfaces.** Nothing here measures it.
  **And the loop's own premise was demonstrated against it while this candidate was being built:**
  hand-off §5 / amendment 8 §1 record the developer piping to `tail` and reading tail's exit code
  while measuring A10 — against a store containing entry 299, with the hook built and **not
  registered**, so nothing fired. **A trigger built and not registered is exactly as useful as no
  trigger.**
- **That the floor is the right cut on any store but this one, on any day but today** (`R19`).
- **That the ranking is robust to a store that grows into the shape F2 describes.**
- **The main-tree-only condition** — Aaron's untracked `PRD.md` — **unrun**.
- **`G-042` on any machine but this one.** Six sightings, one machine.

## 9. What the checks I ran cannot see

- Every row but A5's positive runs on a fixture. **Exactly one case exercises the whole path at
  corpus scale with the shipped floor**, plus A7's single live session, which is untested. A green
  sweep is narrower than it looks and `R20` made that deliberate.
- With byte-identity dropped from A6 (`R3`, Planner 52), **nothing watches the tool result itself**
  — correct on `PostToolUse`, and still less than the brief first asked.
- `R2`'s claim about how the host treats `permissionDecision` is **cited from documentation, not
  tested**. A relay, deliberately.
- The trigger's reach is exactly its **two-element table**, so every row measures a channel that is
  closed by default. Nothing here distinguishes *the table is the right size* from *the table is too
  small*. §5.6's `not asked` rate over A10's fifty calls was to be the only number speaking to it,
  and A10 is untested.
- `module-boundary` sees value imports only.

## 10. Probe shapes, for rerunning (written after the verdict)

Scripts were scratchpad-only and are **not tracked**; rebuild from these.

1. **Scratch worktrees of the shared object store**, one at `90e314f` and one at `45ee2ab`, created
   with `git worktree add --detach` into the session scratchpad, each given `node_modules` by a
   **PowerShell `New-Item -ItemType Junction`** to the QA tree's copy — `cmd //c mklink /J` mangles
   the switch under MSYS. The candidate tree is never mutated.
2. **Mutation driver:** a Python file (never a heredoc — see §11) that asserts its target string
   occurs **exactly once**, rewrites with `newline="\n"`, reads the file back and prints whether the
   replacement is present. Then `npx tsc --noEmit -p .`, then the targeted vitest file.
3. **A1 second caller:** build a 599-row store with `initSchemaV2` + `indexKnowledge`, 10 decoys
   that each carry `tail`, `exit` and `code` at comparable length to entry 299, call
   `deriveQuery`/`queryStore` from `build/trigger/query.js` directly, print rank and relevance.
4. **Decoy reachability:** the candidate's own ten decoys, same harness, `floor: -Infinity`, print
   how many documents the conjunctive query matches at all and per-decoy term presence.
5. **§5.1 live measurement:** open `~/.claude/open-brain/knowledge-v2.db` with
   `{ readonly: true, fileMustExist: true }`, run the trigger's own path with the shipped policy,
   print all hits and what `max_injected` would inject. Writes nothing.
6. **CHECK constraint:** `initSchemaV2` on `:memory:`, insert each of the three legal states, then
   `'asked'`, `''`, `'INJECTED'`, `'not_asked'`, and assert the row count afterwards is 3.
7. **stderr capture:** plant one `process.stderr.write` at the hook entry point, `tsc` clean, run
   `hook.test.ts`, require red **with the stderr assertion message**, not merely red.

## 11. Two errors of mine during this evaluation

Recorded because a report that hides its own instrument failures is worth less than one that does
not, and both were caught before they reached a finding.

1. **A grep that could not have found what it was looking for.** My first pass at `R24`'s hand-off
   contract used `grep -E` with `\|` alternation, which matches a literal pipe, and returned 0 hits
   for three of the five required items. I was one step from reporting *three required items
   missing* about a hand-off that has all five. Caught by validating the pattern against a known
   positive and a known negative before believing its zeros.
2. **A mutant that broke syntax and went red for the wrong reason.** My first stderr plant was a
   heredoc'd Python one-liner; the backslash-n became a real newline inside a TypeScript string
   literal (`TS1002: Unterminated string literal`), the hook crashed on every invocation, and **all
   twelve** hook tests went red — which looks exactly like the result I wanted. Caught by running
   `tsc` on the mutant with the unmutated tree as a control (rc 0). **The failure mode is verbatim
   in the Loop 14 developer hand-off I read at session start**, and I quoted the family in my own
   criteria hours earlier. Second loaded-not-applied instance of the loop, different seat.

A third, in the transport rather than the evaluation: a hub message sent inline instead of from a
file had a backticked word executed as a command substitution and arrived with the subject of its
clause missing — in a message correcting an overconfident claim. The send reported success. All
three are one class: **a layer between me and the artifact that edits the content while reporting
success.**

---

## 12. What candidate 2 must carry (`R25`)

On top of `45ee2ab`, unsquashed, and nothing else:

1. **The network-attempt test** — red on a planted call, green on the candidate.
2. **A1's fixture rebuilt** so every decoy carries all three derived terms, with the guard asserting
   all ten.
3. **A candidate-2 section appended to the hand-off.**

A7, A8 and A10 run against candidate 2 on Aaron's word.
