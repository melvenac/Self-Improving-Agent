# Candidate B, part 2 (`E_t`'s schema change, rulings-2 R10): acceptance criteria

**By:** the QA seat, record session 132 · 2026-09-27 (UTC; the run started `2026-09-27T00:29:49Z` per `drive.meta`)
· on the QA PC `DESKTOP-O4EGB1E`, headless, launched by `docs/loops/qa-132/drive.ps1`. **Model:** Opus 5.5
(`claude-opus-5-5`). **Effort:** `high`. Both come from the driver's command line; the model also comes from the
transcript's init record (`%USERPROFILE%\sia-qa132\run-0.jsonl`, session `a3323076-26c4-43aa-8fcc-797068990a24`).
**Dispatch:** `docs/loops/loop-15-slice-3-b-et-criteria-dispatch-qa.md` (`d1c3baf`, read at `2667c6b`).
**Base read:** `origin/master` = `ebda33d` (after a fetch in this run), and A11 = `ef2a8a7`
(`origin/loop/15-slice-3-candidate-a11` is now `bbf9d07`, one docs commit past it).
**Probes:** run against the tree at `2667c6b`, whose `open-brain/src/harness/` and `open-brain/tests/harness/` are
byte-identical to `ebda33d`'s. `git diff 2667c6b origin/master` touches seven files, none of them under either path.
The probe scripts and their output are committed beside this file, in `docs/loops/qa-scripts-qa132/`.

**This is not a scoring run. It writes the criteria that B's `E_t` change is scored against.** B is not accepted
until these criteria pass (`loop-15-slice-3-b-criteria-rulings.md` §7.3). **These criteria are not widened after a
verdict.** Amendments made before a candidate is frozen are new commits that cite this one.

---

## 1. The criteria

### Terms

- **Base:** `origin/master` at the moment B's `E_t` candidate is frozen, named by SHA in the developer's handoff. It is
  `ebda33d` today. If A11 merges first, the base carries A11. §4.1 records what A11 changes here.
- **The validator:** `validateEvidence` in `open-brain/src/harness/schema.ts`, which the runtime calls
  (`runtime.ts`, QA stage). **The JSON file is derived from it** (`jsonSchemas()`; the file says "do not edit by
  hand"). It cannot express zod refinements, and today it already omits one: duplicate acceptance ids. Every
  schema-level row below is therefore judged by `validateEvidence`, and a separate row (BE-5.3) covers the derived
  file.
- **A valid / an invalid document:** a document built from `schema.test.ts`'s `validEvidence()` with one change.
  Each row lists its pair. The candidate carries the pairs as tests, and QA re-runs them with its own script
  (`qa-scripts-qa132/probe.ts`, extended).
- **Red at the base** is shown by `qa-scripts-qa132/probe-e7ea3c7.out` (master's `schema.ts`, blob `e7ea3c7`) and by
  `probe-loopmismatch-2667c6b.out`. A row marked **guard** is green at the base on purpose: it catches a change that
  goes too wide, and it tests no new behaviour.

### BE-0. Scope of the diff (static, checked first)

1. The loop-id widening is in `EvidenceSchema` **only**. `PlanSchema`'s `loop`, the CLI's `--loop` check
   (`cli.ts`, `/^t\d{3,}$/`), and, if A11 is in the base, `DeveloperReportSchema`'s `loop` keep `^t\d{3,}$`. The
   exception is a change the handoff names, with its reason. Those three feed the runtime, which builds paths
   (`artifacts/iterations/<loop>/`) and tag names (`loop-<n>-…`) from the id. A human seat's evidence never passes
   through them.
2. `plan.schema.json` is byte-identical to the base's. `evidence.schema.json` is regenerated with
   `npx tsx src/harness/cli.ts schemas --write`, and it is not edited by hand.
3. Nothing in the diff touches the G-042 repair's files, or B-0's instruments (QA 123's criteria, B-0). This half is
   scored separately, and a change there would reopen B-0.
4. The diff adds no `.skip`, `.todo`, `skipIf` or `runIf`, and deletes no test. The one existing test fixture that
   stops validating (BE-5.2) is **edited**, not removed, and its hunk is named in the handoff.

*Red at the base:* not applicable. This is a guard on the diff.

### BE-1. (a) The loop id admits human-seat ids

1. **Schema.** `validateEvidence` accepts `loop: "t001"` (runtime loops still validate) and `loop: "15-slice-3"`.
   `15-slice-3` is the name the QA seat actually recorded (criteria-a §6). It also accepts at least one id of the
   form the developer documents for a human-seat candidate, and **the handoff gives that form**, because the exact
   form is the developer's (R10(a)). It **refuses** `""`, `" "`, `"a/b"`, `"a\\b"`, `".."`, `"../x"` and an id
   containing a newline. The pattern stays anchored at both ends. This is not a style rule: the id is a ledger key
   for candidate C, and on the runtime side it becomes a path segment, so a value that can climb out of a
   directory must not become valid anywhere.
   *Red at the base:* `15-slice-3` and `loop-15-slice-3-b` are refused, with "loop must look like t001"
   (probe-e7ea3c7.out, lines 2–3). `../x` is refused today (line 4). That half is a guard the widening must keep.
2. **Behaviour: the runtime does not widen with it (guard).** `harness run --loop 15-slice-3` still exits 2 with
   `--loop must look like t001`.
   *Red at the base:* none. It is green today (exit 2, observed in this run), and the row catches a widening that
   reaches the CLI.
3. **Behaviour: a runtime `E_t` cannot name another loop.** Run `t001` with a QA role whose document says
   `loop: "t002"`, or `loop: "15-slice-3"` once that id is valid. The runtime refuses it: the loop does not
   complete, and no `E_t.json` is committed under `artifacts/iterations/t001/`. It either refuses at once, with a
   named code, or counts the document as a schema failure against the retry cap. The handoff says which.
   **This row is QA's addition** (see §7, item 1): widening the id is what makes a mismatched id look plausible,
   and C keys its ledger on it.
   *Red at the base:* `probe-loopmismatch-2667c6b.out`: `status: "completed"`, `exitCode: 0`, and
   `artifacts/iterations/t001/E_t.json` committed with `E_t.loop=t002`. `runtime.ts` never compares `evidence.loop`
   to `config.loop`, at master or at `ef2a8a7` (a grep for `.loop` finds only the preflight messages).

### BE-2. (b) Attribution is a field, `order: shown | attributed`. There is no new status value.

1. **The status enum is exactly five values:** `met`, `unmet`, `partial`, `not_evaluated`, `pending`, on
   `acceptance[].status`. It is asserted by a test that reads the **derived** JSON's `enum`, as well as the zod
   schema. No value expresses attribution. `status: "attributed"` and `status: "met_attributed"` are refused.
   *Red at the base:* the enum has four values (probe line 14), so the row is red through (c)'s `pending`. The
   "no attribution value" half is a guard, refused today (probe line 7).
2. **Schema.** Valid documents: a `met` row with `order: "shown"`, and a `met` row with `order: "attributed"`.
   Invalid: a `met` row with `order: "inferred"` (any other value), and **a `met` row with no `order`**.
   The last is the fail-closed rule, and my reading of R10(b) (§3, Q1): if a missing `order` were read as `shown`,
   a writer who forgets would overclaim silently. That is the widening R10(b) exists to stop.
   *Red at the base:* `order` is refused as an unrecognised key on every row (probe lines 5–6), and a `met` row with
   no `order` is **accepted** (probe line 1, the control).
3. **`order` on the other statuses.** The developer decides whether `order` is required, allowed or refused on
   `partial`, `unmet`, `not_evaluated` and `pending`. The rule is stated in `schema.ts`'s doc comment, and it is
   tested with a valid and an invalid document for each status where it differs from `met`.
   *Red at the base:* as BE-2.2.
4. **Behaviour: the runtime keeps it.** A runtime loop whose QA role returns a `met` row with
   `order: "attributed"` completes, and the committed `E_t.json` carries `"order": "attributed"` on that row. The
   field is neither dropped nor defaulted.
   *Red at the base:* the document is refused (unrecognised key), so the loop fails `schema-cap-exhausted`. This is
   by the code path (`validateEvidence` refuses, then `runtime.ts`'s cap), and was not run in this session.

### BE-3. (c) `pending` is its own status

1. **Schema.** A valid document has an `acceptance[]` row with `status: "pending"`. It validates, and the value
   read back is `"pending"`: not `unmet` and not `not_evaluated`. An invalid document spells `pending` any other way
   (`"Pending"`, `"pending "`). For `requirements[].status`, the developer either adds `pending` or keeps four
   values. The handoff says which, and why.
   *Red at the base:* `status: "pending"` is refused on `acceptance` and on `requirements` (probe lines 8–9).
2. **Behaviour: the runtime passes it through.** A runtime loop whose QA role returns a `pending` row completes, and
   the committed `E_t.json` carries `"status": "pending"` on that row.
   *Red at the base:* refused, then `schema-cap-exhausted` (by the code path, as BE-2.4).
3. **`E_t` carries no verdict (guard).** B adds no field in which the seat writes a merge verdict. R10(c)'s
   "written as `undefined`" is a property of the **verdict row**, and the verdict row is the verdict function's
   output (rulings-1 R3; R5 put the function in T-155, now candidate C). A verdict the seat writes into its own
   evidence is the verdict the shadow gate exists to measure independently. **The behaviour half of (c) is
   BC-1** (§2): out of B's scope, and declared so.
   *Red at the base:* none. `EvidenceSchema` has no verdict field today, and the row catches B adding one.

### BE-4. (d) Out-of-scope ids are declared in the same parseable block as R3's unrunnable ids

1. **The format is written down.** One fenced block per criteria file carries **two separate lists**, unrunnable
   and out-of-scope. It is documented where the parser lives. §2 below is QA's proposal and a live example. The
   developer may choose another form, with three constraints:
   - the lists stay separate. The two claims ("could not run" and "not this candidate's") are never merged into
     one list or one marker (R10(d));
   - **a criteria file frozen before B, which cannot be edited, still parses** (BE-4.3);
   - **absent and present-but-empty are different results.** A file with no block, and a file whose block declares
     nothing, must not return the same value, because to the verdict "nothing was declared" and "no declaration
     was read" mean different things.
   If the developer's form differs from §2, QA amends §2 in a new commit before the candidate is frozen, and
   BE-4.4 then reads the amended file.
2. **A parser exists in B, and it refuses what it cannot read.** It takes a criteria file's text and returns the
   two lists. **It refuses:** an id in both lists; an id twice in one list; a line inside the block that is not
   `ID: text`; and more than one block in a file. The candidate carries one invalid-input test per refusal and one
   valid-input test per list.
   *Why in B and not in C:* the block is read **at the criteria SHA, which is frozen before any candidate**
   (rulings-1 R3 refinement). A criteria file whose block does not parse cannot be repaired after its candidate
   exists without changing criteria after the fact. So "parseable" has to be testable when the criteria are
   committed, and criteria files are committed before C exists.
   *Red at the base:* no parser exists. `qa-unrunnable` occurs nowhere under `open-brain/src` at `ebda33d` or at
   `ef2a8a7` (`git grep` count 0).
3. **Legacy block.** The parser, given `ef2a8a7:docs/loops/loop-15-slice-3-qa-criteria-a.md`, returns unrunnable
   `U1`–`U6` (six ids, in order) and **no** out-of-scope ids. That file's block is the only R3 block frozen so
   far (criteria-a §3, a `qa-unrunnable` fence with lines of the form `Uk: text`).
   *Red at the base:* no parser.
4. **This file.** The parser, given this file at its commit SHA, returns an empty unrunnable list and exactly
   `BC-1`–`BC-5` as out-of-scope ids.
   *Red at the base:* no parser.
5. **`E_t`'s side.** There is no status value for "out of scope" (BE-2.1's five values). The declaration is read
   from the criteria commit, **never from `E_t`** (rulings-1 R3 refinement), so `E_t` is not where an id becomes
   out of scope. If the developer lets `E_t` also carry the seat's copy of either list, as the R3 refinement's
   `invisible[]` implies for unrunnable ids, the lists are **separate fields**. `validateEvidence` refuses a
   document that puts an id in both lists, or that puts an id in a list **and** in `acceptance[]`. If `E_t` carries
   neither list, a document whose `acceptance[]` simply omits the declared ids validates. The handoff says which
   design it is, and the tests cover that one.
   *Red at the base:* `status: "out_of_scope"`, a top-level `out_of_scope[]` and a top-level `invisible[]` are all
   refused (probe lines 10–12). No representation exists today except flattening to `not_evaluated`, which is the
   mismatch R10(d) names.

### BE-5. Backward compatibility

1. **The runtime's own writer is unaffected.** Every test that runs a loop with `StubQa` passes **without edits**
   (`runtime.test.ts`, `cli.test.ts`, `refwatch.test.ts`, `refwatch-stage.test.ts`, `gate-artifacts.test.ts` and
   `policies.test.ts`; 42 construction sites at master and 67 at `ef2a8a7`). `StubQa` is the runtime's only `E_t`
   writer. A11's `ProcessRole` refuses any role but the developer (`roles.ts:419` at `ef2a8a7`). `StubQa` writes
   only `not_evaluated` rows, no `order` and no `pending`. So BE-2.3's rule for `not_evaluated` must admit a row
   with no `order`, **or** `StubQa` changes, in a hunk the handoff names.
   *Red at the base:* none. This is a guard, green today.
2. **The old `met` form is rejected, deliberately, and the one fixture that uses it is updated.**
   `schema.test.ts`'s `validEvidence()` is the only document in the repository with a `met` row (a `git grep` for
   `status: "met"`, `"unmet"` and `"partial"` across `open-brain/src` and `open-brain/tests` finds only it, at
   master and at `ef2a8a7`). It gains `order`, and a new test asserts that the pre-B form (`met` with no `order`)
   is refused, with a message that names `order`.
   *Red at the base:* the pre-B form is accepted (probe line 1).
3. **The derived file stays honest.** `schema.test.ts`'s drift test (`evidence.schema.json matches what the zod
   schema derives`) passes. Every new rule that the derived JSON cannot express is named in
   `evidence.schema.json`'s `description` under its `LIMIT:` sentence, as the plan file already does for its rule.
   Examples are the `order`-on-`met` rule if it is a refinement rather than a union, and the separate-lists rule.
   A test asserts each name is in the file. The duplicate-id refinement, missing from the description today, is
   named too.
   *Red at the base:* `evidence.schema.json`'s description names only the `runtime_checks` limit. The
   duplicate-id rule is enforced (probe line 13) and not stated in the file.
4. **No migration.** **No `E_t.json` has been committed to any ref in this repository.** `git log --all -- '*E_t.json'`
   returned nothing after this run's fetch. `E_t` files exist only in the test suite's scratch repositories, and are
   written fresh on every run. So nothing persisted needs migrating, and rejecting the old `met` form costs one
   fixture edit. **QA re-runs the `git log` at scoring.** If an `E_t.json` has appeared by then, the handoff must
   say whether it validates, and if not, why rejecting it is right.

### BE-6. The fit test R2 asks for: the table that produced R10 validates without flattening

R2: *"The QA seat is asked whether `EvidenceSchema` fits what it actually observes before the obligation binds."*
The table in criteria-a §6 (at `ef2a8a7`, lines 1052–1063) is that observation. The candidate carries one test
document built from it, and it validates:
- `loop: "15-slice-3"` (or the developer's documented form for it);
- `A1` is `met` with `order: "attributed"`, and not `partial`;
- `A8` is `pending`, and neither `unmet` nor `not_evaluated`;
- `A4`–`A7` are out of scope through BE-4.5's mechanism, and **not** `not_evaluated`.

At scoring, QA writes the same document **independently** and validates it with the candidate's validator
(BE-7). A mismatch between the two documents is a finding.
*Red at the base:* each of the four pieces is refused (probe lines 2, 5, 8 and 10–12).

### BE-7. Who writes `E_t`: the QA seat. B supplies the validator it runs, not a writer.

1. **A seat can validate a file with the runtime's own validator.** The candidate adds an entry point, such as
   `harness validate evidence <file>` (the form is the developer's). On a valid file it exits 0. On an invalid one
   it exits non-zero and prints every problem `validateEvidence` returns. It calls `validateEvidence`, **not** a
   JSON-Schema validator over the derived file, which would miss every refinement (BE-5.3). A test covers both
   exits.
   *Red at the base:* `harness validate evidence x.json` → `unknown subcommand "validate"`, exit 2 (observed in this
   run). The CLI has only `run`, `schemas` and `help`. `open-brain` depends on no JSON-Schema validator (no `ajv` in
   `package.json`), so a seat today has no route to "is my `E_t` valid" except a `tsx` one-liner of its own.
2. **No writer is required, and none is scored.** The reasoning is in §3, Q3. If the candidate does add a writer, it
   is scored only by BE-1 to BE-6 applied to its output, and the handoff names it as beyond R10.
   *Red at the base:* not applicable.

### BE-8. The suite

`npm run build`, `npx tsc --noEmit` and `npx vitest run` (from `open-brain/`) are green on the candidate. The CI run
at the candidate's SHA (`ci.yml`, the ordinary jobs) is green. `Test Files` and `Tests` passed are ≥ the base's.
Nothing here is load-sensitive (the dispatch), so no laptop row applies.
*Red at the base:* not applicable. It is a guard.

---

## 2. Declared before any candidate: out of B's scope, and unrunnable (R3, R10(d))

These are the rows that make `E_t` usable by candidate C, and they cannot be tested before C exists. They are
**C's rows, inherited**. They are listed so that C's criteria start from them and so that no green here is read as
covering them. **A verdict on B does not score them.**

- **BC-1. `pending` makes the verdict `undefined`.** A verdict row computed from an `E_t` with any `pending`
  acceptance item is `undefined`, never `would-not-merge` and never `would-merge` (R10(c)).
- **BC-2. Declared ids are excluded from the verdict.** An id in either list of the criteria file's block, **read
  at the criteria SHA**, does not count toward the verdict, and the two lists are reported separately
  (R10(d); R3).
- **BC-3. A seat's claim is not a declaration.** An id the seat lists in `E_t` as unrunnable or out of scope (if
  BE-4.5's design carries such lists) that is **not** in the block counts as `not_evaluated`, and so as
  `would-not-merge` (rulings-1 R3 refinement).
- **BC-4. How `order: attributed` weighs in the verdict.** R10(b) makes attribution visible and does not say
  whether an attributed `met` counts as `met`. This is unruled (§7, item 3).
- **BC-5. Pairing.** C finds each human-seat `E_t` (R2: "beside its prose report"), the criteria SHA it was scored
  against, and Aaron's merge decision, and keys them by the BE-1 loop id without collisions between seats.

```qa-declared
[unrunnable]
[out-of-scope]
BC-1: verdict undefined when any acceptance item is pending (R10(c)); needs C's verdict function
BC-2: declared ids excluded from the verdict, read at the criteria SHA (R10(d), R3); needs C's verdict function
BC-3: an E_t-listed id absent from the block counts not_evaluated (rulings-1 R3 refinement); needs C's verdict function
BC-4: the verdict weight of order: attributed (R10(b) is silent); unruled, and needs C
BC-5: pairing human-seat E_t files with criteria SHAs and Aaron's merges, keyed by loop id; needs C's ledger
```

The empty `[unrunnable]` list is deliberate: **present and empty**. Every B row above can be run on the QA PC.

---

## 3. Reasoning, per question

### Q1. (a)–(d) as testable rows

- **(a)** The schema row is BE-1.1. The only behaviour in B is **negative**: the runtime must not widen with it
  (BE-1.2). BE-1.3 (the mismatch) is behaviour that exists today, and it is wrong today.
- **(b)** BE-2. Making `order` **required on `met`** is my reading, and it binds unless the planner rules otherwise
  (§7, item 2). R10(b)'s reason is "a status that means 'met, sort of' is how a verdict gets widened". A field
  whose absence defaults to `shown` brings the same widening back through the default: the one row that most
  needs the field is the row a hurried writer leaves without it. Requiring it costs one fixture edit (BE-5.2),
  and it ends the only open question the field has: what its absence means.
- **(c)** Schema BE-3.1, runtime pass-through BE-3.2. The behaviour R10(c) names, "a verdict row … is written as
  `undefined`", belongs to C, because the verdict row does: in rulings-1 R3 the verdict row is the verdict
  function's output, and R5 put that function in T-155. So the behaviour row is BC-1, and BE-3.3 keeps B from
  pre-empting it with a seat-written verdict.
- **(d)** R10(d) declares the ids **in the criteria file**, not in `E_t`, so most of (d) is a block and its parser
  (BE-4.1 to 4.4), and only BE-4.5 is `E_t`'s schema. The parser is in B for the reason under BE-4.2: frozen
  criteria cannot be repaired later. The exclusion itself is BC-2.

### Q2. Backward compatibility

The old form is **accepted, except for one case, which is rejected on purpose, and no migration is needed.**
- Accepted: `t001` ids, every status in use today, and every document `StubQa` writes (BE-5.1).
- Rejected: a `met` row without `order` (BE-2.2, BE-5.2), because defaulting it is the widening R10(b) forbids.
- No migration: no `E_t.json` has ever been committed to any ref (BE-5.4). The one affected document is a test
  fixture, and it is edited in a named hunk.

### Q3. Who writes `E_t`

**The QA seat writes it. B must ship the schema and a validator the seat can run, and not a writer.**
- R2: "The QA seat **emits** an `E_t` JSON beside its prose report at each human-seat candidate." The writer is the
  seat. R2 also gives the reason a program should not take that job: "The schema is the runtime's; **the evidence
  is the seat's**."
- R10: "Until then **the QA seat writes prose as before**." "Until then" changes **the form of what the seat
  writes** (prose, then prose plus `E_t`). It does not change who writes it, and it promises no tool.
- A validator is still owed, because the seat must be able to know its document is valid. The only full
  validator is `validateEvidence`: the derived JSON misses the refinements (BE-5.3), and the repository has no
  JSON-Schema validator anyway. The runtime calls `validateEvidence` inside a loop, and a human seat has no loop.
  Hence BE-7.1.
- **When the obligation binds.** R10: "the obligation binds at B's first accepted candidate". By R2's own
  precedent ("from the NEXT candidate, not the one being scored now"), I read it as binding on the **first QA
  report after B is accepted**, not on B's own scoring. B's scoring report stays prose, plus BE-6's fit document,
  which is a test and not the obligation. §7, item 4 asks the planner to confirm.

### Q4. What cannot be tested before C exists

BC-1 to BC-5, declared in §2 in the very block format this candidate must parse (BE-4.4). **That is how the criteria
say so:** out of B's scope, in the parseable list, at this file's SHA, before any candidate. That is the mechanism
R10(d) rules, used on its own criteria. Nothing is declared unrunnable.

---

## 4. Observed in this run

1. **A11 at `ef2a8a7` against `origin/master` `ebda33d`, the three files the dispatch names:**
   - `evidence.schema.json`: **unchanged**;
   - `plan.schema.json`: **unchanged**;
   - `artifacts.ts`: **+3 lines**, `FailureRecord.appendix` and its rendering in `renderFailure`. It touches no
     `E_t` path or renderer. `renderEvidence` and `evidencePath` are unchanged.

   **Also relevant, beyond the three:** A11's `schema.ts` (+41) adds `DeveloperReportSchema` (`R_t`) with **a third
   copy of `^t\d{3,}$`** (BE-0.1 keeps it). `EvidenceSchema` is byte-identical to master's. `roles.ts`'s
   `ProcessRole` refuses any role but the developer, so `StubQa` stays the only runtime `E_t` writer (BE-5.1).
   **Whichever merges first, the `E_t` change starts from the same `EvidenceSchema`.**
2. **Examples of `E_t.json` in the repository: none.** `git log --all -- '*E_t.json'` is empty. The files exist only
   in test scratch repositories (`artifacts/iterations/t001/E_t.json`, written by `StubQa` in `runtime.test.ts`,
   `cli.test.ts` and others). The in-source examples are `schema.test.ts`'s `validEvidence()` and `StubQa.run`.
3. **The red probes** (`probe-e7ea3c7.out`, 14 lines): the control is valid. Everything R10 needs is refused:
   human-seat ids, `order`, `pending` on both arrays, an out-of-scope status, `out_of_scope[]`, `invisible[]`. The
   duplicate-id refinement works. The derived enum has four values.
4. **The runtime mismatch** (`probe-loopmismatch-2667c6b.out`): loop `t001` completed, `exitCode: 0`, and the
   committed `E_t.json` says `loop: "t002"`.
5. **The CLI:** `harness validate …` exits 2 as an unknown subcommand. `harness run --loop 15-slice-3` exits 2 with
   "--loop must look like t001".

## 5. What could not be verified

- **BE-2.4 and BE-3.2's red** is by the code path (`validateEvidence` refuses, then the runtime's
  `schema-cap-exhausted`). The runtime was not run with those documents. The refusal itself was run (probe).
- **Whether the design for R10 exists.** The rulings (§7.3) dispatch QA "once the design for R10 is read". This
  dispatch names no design, and its read list does not include one, so none was read. If a design exists and
  differs from a constraint here, the constraint stands until the planner rules.
- **CI and tcm:** none dispatched (nothing here is load-sensitive, and the rows were shown red locally). tcm
  used: **0 of 3**.
- **Linux:** every probe ran on win32 with Node v22.23.3 and git 2.55.0.windows.5. The rows are pure schema and
  argument checks, and CI's Linux job covers the candidate's tests.

## 6. Error entries

- **E-1 (the dispatch): R2 and R3 are not in rulings-2.** The dispatch says to read "`loop-15-slice-3-rulings-2.md`
  (R2, R3, R10 …)" and "R3 in the same file". Rulings-2 holds R7–R13. **R2 and R3 are in rulings-1**, with the R3
  refinement that makes (d) work ("read from the criteria commit, never from `E_t`"), so I read rulings-1 R1–R5
  and its refinements section.
- **E-2 (my reads beyond the list, named):** `schema.ts`, because both schema files say they are derived from it
  and the validator is there; `roles.ts` `StubQa` and `ProcessRole`; `runtime.ts`'s QA stage; `cli.ts`'s
  subcommands and `--loop` check; `schema.test.ts`; and criteria-a §3 (the only R3 block) and §6 (R10's source
  table) at `ef2a8a7`. None is a design, and each is quoted where it is used.
- **E-3 (my probe):** the mismatch probe failed twice before it ran: top-level `await` in a `.ts` file, then a bare
  `C:/…` path in a dynamic `import()`. Both were fixed in the script (`.mts`, `file:///` URL) before any result was
  read. The committed script is the one that ran.
- **E-4 (the date):** the dispatch is dated 2026-09-26, and this run started at 2026-09-27T00:29Z. The report is
  dated by UTC.

## 7. Open for the planner

None of these blocks the criteria: each row above binds as written unless it is ruled otherwise.

1. **BE-1.3 (the runtime refuses an `E_t` whose `loop` is not the run's) is QA's addition.** It is red today,
   independent of R10, and R10(a) raises its stakes: once the id is widened, a mismatched id can name a human-seat
   loop, and C keys on the id. **Recommendation: keep it in B.** Strike it if the planner rules it is its own
   task.
2. **BE-2.2: `order` is required on `met` rows** (fail-closed). This is my reading of R10(b), and the alternative is
   a default. **Recommendation: keep required.**
3. **BC-4: does an attributed `met` count as `met` in C's verdict?** R10(b) makes attribution visible and is silent
   on its weight. C's criteria will need a ruling.
4. **When R2's obligation binds** (§3, Q3): my reading is the first QA report after B is accepted, not B's own
   scoring. Please confirm.
5. **`runtime_checks` for a human seat is unruled.** Criteria-a §6 rated it a partial fit (peer states, the CI run
   id and `/sync` have no field). R10 ruled four mismatches, not five, so no row here. A human seat must fill
   `build` and `unit` from its own runs, and the description says they are "supplied by the runtime from process
   exit codes". The planner may want a sentence on it before the obligation binds.
6. **The design for R10**, if one exists, was not read (§5).

QA-132: REPORT COMPLETE
