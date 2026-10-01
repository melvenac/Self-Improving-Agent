# Loop 15 slice four (Jev scoring on real diffs, in shadow): acceptance criteria

**By:** the QA seat, record session 238 · 2026-10-01 (UTC) · on **Plumb** (the Linux QA seat on the VPS), headless
Claude Code on Opus (D-068). **Dispatch:** `docs/loops/qa-238-s4-criteria-dispatch.md`, read at the worktree commit
below. **Worktree:** `~/qa-scratch/qa238-wt`, detached at `940d17cb067cd8fc9b32f331d639071553765b11`
(`git -C ~/qa-scratch/qa238-wt log -1 --format=%H`). **`origin/master`:** `ec7138bb` after `git fetch origin`. Between
`ec7138bb` and `940d17cb`, `git diff --stat` touches only `.agents/` views, `state.json` and four `docs/loops/` files,
so every `open-brain/` path read here is byte-identical to `origin/master`. **tcm runs:** 0 of 2. `gh` is not
installed on this machine (`gh: command not found`), so every red-at-base claim is shown by `git grep`, `git ls-tree`
or `git show` at `origin/master`, which is how QA 191 did it.

**This is not a scoring run. It writes the criteria that slice four's items 4.2 to 4.5 are scored against.** 4.1
(T-214) has its own rows in `loop-15-slice-4-dispatch.md` and is not covered here, except for this file's own parse
check (S4-1). **These criteria are not widened after a verdict.** Any amendment made before a candidate is frozen is a
new commit that cites this one.

**Row ids follow the planner's `D_t`.** `loop-15-slice-4-brief.D_t.json` already names S4-1 to S4-8, and D-072 cites
"acceptance S4-7" for the budget, so each id keeps the meaning the `D_t` gives it. Sub-rows take a letter (`S4-4a`),
because `parseDeclared`'s id pattern accepts no dot. S4-9 is new and is a guard.

---

## 1. The criteria

### Terms

- **Base:** `origin/master` at the moment a slice-four candidate is frozen, named by SHA in the developer's handoff.
  It is `ec7138bb` today.
- **Step-2 candidate:** sia-builder's branch for 4.4 plus the 4.3 `D_t` reconstructions (dispatch, step 2).
  **Live run:** QA's step 4, the only step that calls Jev. **Close-out:** the slice report that follows the live run.
- **Gate record:** any `G_plan`, `G_done` or `G_qa` JSON file written by slice-four code. **Live record:** a gate record
  with `mode: "live"`.
- **The eight diffs.** Merge commits are read on `origin/master`. The "QA'd SHA" is `candidate_git.sha` from the
  latest QA `E_t` on a `qa/*` branch. In all five diffs that have one, it is an ancestor of the merged head but is not
  the merged head (`git merge-base --is-ancestor`, all five exit 0):

| Diff | PR | Merge | Merged head (`^2`) | QA `E_t` (branch, `candidate_git.sha`) |
|---|---|---|---|---|
| A | #182 | `677c1dd5` | `0d44374e` | none on any `qa/*` branch |
| B part 1 | #165 | `7640b935` | `285a8b2e` | none |
| B part 2 | #187 | `c9a7acc1` | `c1eda2f6` | none |
| C | #195 | `ddd43526` | `fcc31254` | `qa/c-r4-report`, `c3394272` |
| T-195 | #209 | `7fcbfa0e` | `5b3e5257` | `qa/t195-r2-report`, `647cc74e` |
| T-198 | #227 | `c1296f2b` | `304a24ad` | `qa/t198-r2-report`, `f172e280` |
| T-196/T-197 | #220 | `066ed8ca` | `dde3cf5d` | `qa/t196-r2-report`, `3059ca9c` |
| T-158 | #218 | `d5dfa745` | `e0a2e730` | `qa/t158-r2-report`, `e23e6228` |

  Source: `git log --all --name-only -- '*E_t.json'`. **Only 5 of the 8 have an `E_t`**, which matters to 4.4's call
  count (S4-6b, S4-7a, and Open 2).
- **Canary:** a value the test builds itself, at least 32 characters, unique per run (for example `S4CANARY-` followed
  by 24 random hex characters). It is **set** on an environment object the test constructs, and that object is the
  whole environment it passes. Never `{...process.env}`.
- **Red at the base** is shown by `git grep` or `git ls-tree` returning nothing, or by source quoted at a line. A row
  marked **guard** is green at the base on purpose.

### S4-1. This file's declared block parses, with no blank line inside it (guard, own check)

**Pass:**

1. `parseDeclared` from `open-brain/src/harness/declared.ts` **at `origin/master`** (blob unchanged since `ec7138bb`)
   returns `present: true` for this file. The two lists are exactly as written in §2, in that order, and no id is in
   both.
2. After T-214 merges, `parseDeclared` at the new master returns the **same** `DeclaredBlock` for this file at its
   criteria SHA. P-blank says it must, because the block holds no blank line.
3. The file holds exactly one declared fence. A second fence of either kind would make `parseDeclared` throw.

**Observed in this run (§4.3):** the parse succeeded, giving 5 unrunnable and 6 out-of-scope ids.
*Red at the base:* not applicable. Guard. **How checked:** run `parseDeclared` on the file text at the criteria SHA
and compare the result to the lists in §2.

### S4-2. 4.2: exactly one live plan-gate call on this slice's `D_t`, recorded

**Pass:**

1. Exactly **one** live record exists beside `docs/loops/loop-15-slice-4-brief.md`, written by
   `harness plan-gate docs/loops/loop-15-slice-4-brief.D_t.json --mode live` at the step-4 checkout. The record path
   matches `loop-15-slice-4-brief.G_plan.<id>.json` (`brief-plan-gate.ts:64`). Dry-run records may exist beside it and
   are not counted.
2. That record has `sent: true`, a non-null `answered_at`, a non-null `answer` holding all five `PLAN_GATE_QUESTIONS`
   ids, a non-null `usage`, and `model_resolved` that **S4-3a's comparator** places at or above `jev-1.13.0`.
3. The record is committed on a path that reaches `origin/master` (`docs/**`), so it is not ignored by git
   (`git check-ignore` prints nothing). Its `policy_hash` equals the sha256 of `plan-gate.json` at the base.
4. **Whatever the verdict, the first answer is the observation.** A `reject` exits 1 and writes the record with
   `feedback` (`brief-plan-gate.ts:362-367`). That is T-195's existing behaviour, not a new gate, and it is **not** a
   reason to call again (S4-7b). The close-out quotes the verdict as it stands.

*Red at the base:* `git ls-tree origin/master docs/loops/` lists no `loop-15-slice-4-brief.G_plan.*.json`. The
whole tree holds no `G_plan`, `G_done` or `G_qa` file. A grep of `git ls-tree -r --name-only origin/master` for
`G_done|G_qa|G_plan` finds nothing. **When scored:** at the live run, not at the step-2 candidate (Open 1).

### S4-3a. D-071 key property (a): the key reaches the Jev endpoint

**Pass, in two halves, each with its own test:**

1. **Before any live call (the step-2 candidate's own test):**
   - A test calls `JevTransport.dispatch` with a constructed env holding a canary as `TYPESAFE_API_KEY` and a fake
     `fetchImpl`. It asserts the fake saw exactly one request, to `JEV_ENDPOINT` (`https://api.typesafe.ai/v1/systemone`),
     with header `Authorization: Bearer <canary>`.
   - A second case runs with the variable deleted from the constructed env. It asserts the fake saw **zero** requests
     and a `GateUnavailable` was thrown. Comparing the two cases is what proves the deletion changed something
     (G-044).
   - A **version comparator** exists and is unit-tested: `jev-1.13.0` and `jev-1.13.1`, `jev-1.14.0` and
     `jev-2.0.0` pass; `jev-1.12.9` fails; `jev-1.9.0` fails and is compared numerically, not as a string; `null`,
     `"jev-latest"` and a non-matching string all fail.
2. **At the live run:** the S4-2 record is the authenticated response. It needs HTTP 200 (`sent: true` with a
   non-null answer; a 401 lands in the record as an `auth` failure instead), and `model_resolved` must pass the
   comparator. **The same applies to every live `G_done` and `G_qa`.** Each carries its own `model_resolved`, which
   must pass, and if two differ the close-out says so: the models' scores cannot then be compared.

*Red at the base, with one part already green:*

- **Guard, green at base:** `gate-live.test.ts:152-173` already asserts the URL contains `api.typesafe.ai` and that
  `Authorization` is `Bearer ${KEY}` with a constructed env. It must stay. What it lacks, and this row adds, is
  "exactly one request", the URL equal to `JEV_ENDPOINT` (not merely containing the host), and the deleted-variable
  pair asserting zero requests.
- No version comparator exists: `git grep -n -E "1\\.13\\.0" origin/master -- open-brain/src/harness/` matches only
  doc comments (`gate.ts:172`, `artifacts.ts:57`), and no code compares one model version with another.
- No live record exists (S4-2).

### S4-3b. D-071 key property (b): the key reaches nothing else

**Pass, in two halves, each with its own test:**

1. **Before any live call, by construction (required; this is the row D-071 asks for):** one test per writer, covering
   (i) `runBriefPlanGate`, (ii) the new 4.3 done-gate runner and (iii) the new 4.4 QA-score runner. Each test:
   - builds an env object that holds the canary as `TYPESAFE_API_KEY`, plus only what the run needs (for a spawned
     CLI, `PATH` and `HOME`/`USERPROFILE`). It is never spread from `process.env`.
   - installs a **hostile** fake `fetchImpl` that echoes the `Authorization` header back into the response body, in
     one case as a 200 and in another as a 422. Echoing the key is the worst case: it would otherwise flow through
     `answer`, `note` and the error detail.
   - collects every output: every file under the fixture repo or temp dir, by walking it rather than listing expected
     paths; the gate record; the thrown error's `message` and `detail`; the log sink; and the spawned CLI's `stdout`
     and `stderr`.
   - asserts the canary appears in **none** of them, and that each file was in fact read.
   - **Known positive:** the same scan, run on a temp file into which the test writes the canary, reports exactly 1
     hit. Without that, a scan that cannot find the canary proves nothing.
   - **Mutant (local, red):** replacing `redact(raw, this.env)` in `JevTransport.dispatch` (`gate.ts:482`) with
     `raw`, or dropping `redact` from the new runners' record writers, makes at least one of these tests fail.
   - The spawned-CLI case **must not** use `t195-plan-gate.test.ts`'s `harness()` helper as it stands. That helper
     passes `{ ...process.env, ...env }` (`t195-plan-gate.test.ts:80`), which inherits the real key on any machine
     that has one: the exact G-044 shape.
2. **After the live run (QA, step 4):** a committed scan script reads the key from the live seat's environment. This
   is the value it searches for, not an assumption that the key is absent. It scans every gate record from S4-7a, the
   live run's captured stdout and stderr, the close-out, and the QA seat's own session transcript for this run (the
   `.jsonl` under the seat's project slug). It prints only the count of matches and the files scanned, never the
   value. It first passes the same known positive, on a temp file it then deletes. **Pass:** 0 matches, with
   files-scanned > 0 for every category.

*Red at the base:*

- `git grep -n "redact" origin/master -- open-brain/tests/harness/t195-plan-gate.test.ts` returns nothing. The only
  keyed `runBriefPlanGate` test (`:258`) uses a transport that throws, and asserts on the error, not on the record
  file's contents.
- No test walks the outputs of `runBriefPlanGate` for a canary.
- The 4.3 and 4.4 runners do not exist.
- **What exists at base, and this row keeps it:** `gate-live.test.ts:170` and `:187` (the key is in neither the body
  nor the error message) and `process-role.test.ts:159-166` (the role env).

### S4-4. 4.3: eight `G_done` records, one per diff, in shadow

**Pass:**

1. Eight live `G_done` records exist, one per row of the Terms table. None is a duplicate per S4-7b.
2. Each is produced by the developer done-gate through `gate.ts` (`JevTransport`, `DONE_GATE_QUESTIONS`,
   `decideDoneGate` with the **current** `developer-done.json`). jev-mcp is never used (S4-9).
3. Each record names `pr`, `merge_commit`, `scored_sha`, and `base_sha`, the diff's base:
   `git merge-base <scored_sha> <merge_commit>^1`. Each also names the reconstructed `D_t` it was scored against, by
   path and blob SHA.
4. The **diffstat** in the gate's `state` is recomputed from `base_sha..scored_sha`, and the test exit codes come from
   a recorded source (the `E_t`'s `runtime_checks`, or a cited CI run id at `scored_sha`), named in the record as
   `checks_source`. If no exit code is recorded for that SHA, the record says `checks_source: "none"`, and the decision
   is computed with `checksPassed: false`, labelled as such. **Jev is never asked whether tests passed** (HOH-JEV §4).
5. `runtime_action` on every `G_done` says no outcome was changed, for example `"shadow: recorded only"`. It never
   reads "failed the loop" (`runtime.ts:831`).

*Red at the base:* no `G_done` file in the tree (S4-2). The only done-gate caller is `runLoop`
(`runtime.ts:1485`), which fails the loop on a `reject` (`runtime.ts:830-841`). No out-of-loop shadow runner exists:
`cli.ts`'s USAGE (`:35-47`) lists no done-gate subcommand.

### S4-4a. Provenance: `source` and `plan_provenance` on every `G_done` and `G_qa`, or the record is refused

**Pass:**

1. A strict schema (zod `.strict()`, with a derived JSON Schema and a drift test, `D-021`) for `G_done` and `G_qa`
   records requires:
   - `source` ∈ {`seat`, `runtime`};
   - `plan_provenance` ∈ {`reconstructed-after`, `written-before`}.
2. **Refused by the writer:** the runner cannot write a record without both fields. A unit test calls the write path
   with each field missing, and with each field holding an out-of-set value (for example `"Seat"` or
   `"reconstructed"`). All four are refused, and no file is created.
3. **Refused by a validator:** a command (for example `harness validate gate-record <file>`, with the name chosen by
   the developer) exits non-zero on a hand-written record that lacks either field, and exits 0 on a good one. The
   close-out runs it over every slice-four record and quotes the exit codes.
4. **The runtime's own `G_done` writer is covered too.** "Every `G_done`" includes `runLoop`'s. That writer
   (`runtime.ts:674`) emits `source: "runtime"` and `plan_provenance: "written-before"`, and a `runtime.test.ts` case
   with a fake transport asserts it.
5. **`source` is never inferred from the loop id.** T-195's diff is seat-built, but `t195` matches the runtime pattern
   `^t\d{3,}$` (`schema.ts:54`). A test passes a seat record whose `loop` looks like a runtime id and asserts that
   `source` stays `seat`.
6. All eight 4.3 records carry `source: "seat"` and `plan_provenance: "reconstructed-after"`. So do all 4.4 records,
   because their `E_t`s are QA's reports on seat-built diffs.
7. **Mutants (local, red):** make either field `.optional()`, or default it, and the tests in 2 and 3 fail.

*Red at the base:* `git grep -n -E "plan_provenance|reconstructed-after|written-before" origin/master --
open-brain/` returns nothing. `GateRecord` (`artifacts.ts:48-67`) has neither field, and `GateRecordKind` is
`"plan" | "done"` (`artifacts.ts:29`), so it has no `qa`.

### S4-4b. 4.3's independence: no seat reconstructs the `D_t` of a diff it built

**Pass:**

1. A tracked mapping file, written by the planner before step 2 (dispatch, step 2), lists for each of the eight diffs:
   - the **building seat**, citing the diff's developer handoff by path at a SHA (for example
     `docs/loops/t195-developer-handoff.md`); and
   - the **reconstructing seat**.
2. Each reconstructed `D_t` carries `reconstructed_by` (a seat name) and `reconstructed_from` (the prose brief's path
   and blob SHA). Both are checked against the mapping file.
3. **Mechanical check:** for all eight, `reconstructed_by` ≠ building seat. Each reconstruction commit's
   `Co-Authored-By` model line is consistent with the named seat's model. For example, sia-builder is
   `Claude Sonnet 5.5` (D-068). A mismatch fails the row.
4. Each reconstructed `D_t` passes `harness validate plan` (exit 0). Its loop id is a human-seat id, not a runtime-shaped
   `tNNN` (S4-4a.5).
5. **What this does NOT prove:** every commit in this repository is authored as `Aaron Melven`, and the builds carry
   no `Claude-Session` trailer (`git log` over `ddd43526^1..ddd43526^2` and `7640b935^1..7640b935^2`). So seat
   identity rests on the handoff's own statement plus the model line. Proof beyond that is declared unrunnable
   (S4-21).

*Red at the base:* no mapping file and no reconstructed `D_t` for any of the eight. A
`git ls-tree origin/master docs/loops/` lists no `*.D_t.json` except `loop-15-slice-4-brief.D_t.json`.

### S4-5. Honesty

#### S4-5a. Every reported threshold names N, the SHAs and the spread

**Pass:**

1. The close-out's tables are **generated from the gate records** by a committed script or subcommand, never typed by
   hand. QA regenerates them at the close-out SHA and diffs the result against the report. Any difference fails the
   row.
2. For each threshold in `developer-done.json`, and later in `qa-score.json`, the table gives:
   - the threshold's name and value;
   - **N**;
   - the **scored SHAs**;
   - every per-diff value;
   - min, max, and the count on each side of the threshold.
   A threshold reported without all of these fails the row.
3. The label reads exactly `PROVISIONAL (N=8 seat-built, 0 runtime)` for 4.3. For 4.4 it reads
   `PROVISIONAL (N=<k> seat-built, 0 runtime)`, where `<k>` is the number of `G_qa` records (S4-6b). It is computed
   from the records, not written by hand.

#### S4-5b. The word "calibrated" appears nowhere

**Pass:** a case-insensitive whole-word search for `calibrated` returns 0 hits over:

- the added lines of every slice-four candidate diff (`git diff <base>..<candidate>`, lines starting with `+`);
- every gate record;
- the close-out.

**The rule is strict, by design:** "not calibrated" also matches. Write "PROVISIONAL" instead. **Excluded by path
only**, because they state the rule: `loop-15-slice-4-brief.md`, `loop-15-slice-4-brief-draft.md`,
`loop-15-slice-4-brief.D_t.json`, `.agents/state.json`, and this file. Strings at the base (`policies.ts:39`,
`policies.ts:275`) are not added lines, so they are not counted.

#### S4-5c. No threshold file changes in this slice

**Pass:**

1. `git diff --exit-code <base> <candidate> -- open-brain/src/harness/policies/plan-gate.json
   open-brain/src/harness/policies/developer-done.json open-brain/src/harness/policies/merge.json` exits 0 for every
   slice-four candidate. The same holds from `ec7138bb` to the close-out SHA.
2. `qa-score.json` is **added** once, by 4.4. Its blob at the close-out equals its blob at the 4.4 merge. Every `G_qa`
   carries a `policy_hash` equal to the sha256 of that blob, and every `G_done` carries one equal to the sha256 of
   `developer-done.json` at the base.
3. `merge.json` keeps `require_plan_gate: false` and `require_done_gate: false`.

*Red at the base (S4-5a and 5b):* no close-out and no generator exist. *S4-5c is a guard*, green at the base.

### S4-6. 4.4: the QA-score gate, built as data, shadow only

#### S4-6a. `policies/qa-score.json`, its schema, and the threshold-scan guard

**Pass:**

1. `open-brain/src/harness/policies/qa-score.json` exists. A `.strict()` zod schema validates it, and a derived
   `schemas/policy-qa-score.schema.json` is regenerated by `harness schemas --write` and drift-tested like the other
   three. Its `description` states that the values are a starting position chosen without data (the
   `policies.ts:241-279` pattern).
2. The loader refuses each of these, each with a test: a missing file, non-JSON, an unknown key, and an out-of-range
   probability.
3. **Threshold-scan guard:** `THRESHOLD_SCAN_TARGETS` (`tests/harness/threshold-scan.ts:57`) gains each file that
   holds the QA-score question prompts or applies its policy. The scanned-region count assertion
   (`policies.test.ts:334`) still holds. **Mutant (local, red):** a literal such as `0.6` planted in the QA-score
   decision code or in one of its prompts makes `scanThresholds()` report it.
4. A test shows the A6 property for this gate: the same answers give a different decision under a stricter
   `qa-score.json` in a temp dir, with no source change.

*Red at the base:* `git ls-tree origin/master open-brain/src/harness/policies/` lists only `developer-done.json`,
`merge.json` and `plan-gate.json`. `git grep -n "qa-score" origin/master -- open-brain/src` matches only a comment
(`gate.ts:156`) and the NOT CONSULTED log line (`runtime.ts:1572`).

#### S4-6b. The shape HOH-JEV §4 names, with missing evidence as `untested`

**Pass:**

1. For each requirement in the `E_t` (`requirements[]`, plus `acceptance[]` where present), the `G_qa` record holds:
   - one result ∈ {`pass`, `fail`, `untested`}, from a Jev **choice** with exactly those three options;
   - for each `fail`, a `severity` from a Jev **score** with at least two ordered levels.
   The record also holds `regression_of_validated` (a **noul**) and `artifact_complete_enough_to_stop` (a **noul**).
   Question kinds are asserted on the **payload** (`buildJevRequest`), as `gate.ts:65-67` requires.
2. **Missing evidence is `untested`, computed by code, not asked:**
   - A requirement whose `E_t` row is `not_evaluated` or `pending`, or has empty `evidence`, is recorded `untested`
     whatever Jev answers.
   - A requirement Jev did not answer is recorded `untested` and listed under `missing`.
   - A `fail` with no severity answer is listed under `missing`, never given a default.
   - Tests: a fake transport answers `pass` for an evidence-less row, and the record says `untested`. A fake omits one
     requirement, and the record says `untested` with that id in `missing`.
   - **Mutant (local, red):** take Jev's choice for an evidence-less row, and the first test fails.
3. **One call per diff.** All of a diff's questions go in one batched request (`buildJevRequest`). If the API refuses
   the batch (for example a 422 on question count), the item stops and asks the planner. It does not split the batch
   into more calls (S4-7).
4. **Only diffs with an `E_t` are scored.** A diff without an `E_t` on a `qa/*` branch (A, B part 1 and B part 2,
   per the Terms table) gets **no call**. It is listed in the close-out as `not scored: no E_t`. So at the base's
   evidence k = 5, not 8. Calling Jev with nothing to judge would spend a call to record `untested` everywhere, which
   code can compute (Open 2).

#### S4-6c. `G_qa` is written beside the QA's `E_t`, and never changes a verdict

**Pass:**

1. Each `G_qa` sits in the same directory as the `E_t` it scores, named `<E_t path without .E_t.json>.G_qa.<id>.json`.
   It carries `e_t_ref` = {`branch`, `commit`, `path`, `blob`} naming the exact `E_t` blob scored. Where it is
   committed is Open 3.
2. Each `G_qa` is written once (exclusive create, the `brief-plan-gate.ts:95-110` pattern). A second write to the same
   path is refused.
3. The `E_t`'s blob SHA is identical before and after scoring. So is the QA report's `.md`, whose verdict line is
   not edited, and so is `docs/loops/shadow-merge/ledger.jsonl`.
4. `harness validate evidence` on each scored `E_t` gives the same exit code before and after.

*Red at the base:* no `G_qa` writer exists. `GateRecordKind` has no `qa` (`artifacts.ts:29`).

#### S4-6d. Shadow: no new gate changes a runtime outcome, a QA verdict or a merge

**Pass:**

1. **The flip test.** For each new runner (the 4.3 done gate and 4.4 QA score), a test runs it twice in a fixture git
   repo with a fake transport: once with answers that `decide*` turns into `proceed`, and once with answers that it
   turns into `reject`. Between the two runs:
   - the **exit code** is identical, and 0;
   - `git status --porcelain` shows only the new gate record;
   - every `E_t`, every QA report `.md`, `ledger.jsonl`, every `shadow_merge.json` and every policy file is
     byte-identical.
2. `runLoop` still does not consult a QA-score gate. The existing assertions `runtime.test.ts:616-629` ("qa-score gate:
   NOT CONSULTED", and no qa-score payload) pass **unchanged**.
3. `computeShadowMergeVerdict` gives the same verdict on the committed C fixture with and without the new records.
   `require_done_gate` is false, so a `G_done` record must not move it.
4. **The mutant that must go red (local):** in either new runner, after the decision, add
   `if (decision.verdict !== "proceed") process.exitCode = 1;`. That is one line letting a gate decision flow into an
   outcome. The flip test fails on the exit code. **A second mutant:** have the QA-score runner write its per-requirement
   result into the `E_t` row's `status`. The flip test fails on the `E_t` blob. Both go into the handoff with diffs
   under `docs/loops/<item>/mutants/` (T-207).

*Red at the base:* the runners do not exist, so there is nothing to flip. The only live gate path that exists,
`runLoop`, **does** let a decision change an outcome (`runtime.ts:830-841`, `code: "gate-rejected"`). That is the
runtime's ruled behaviour and is not a slice-four gate, but it is exactly the shape the new runners must not copy.

### S4-7. Budget: at most 20 live calls, counted from the gate records

#### S4-7a. The count comes from the records, and every attempt leaves one

**Pass:**

1. **Write-ahead.** Each live attempt writes its record (or an attempt line in an append-only ledger beside the
   records) **before** `fetch` is called, and completes it afterwards.
   - Test: a fake `fetchImpl` that never resolves, with the run aborted by a timeout. The attempt is still on disk,
     marked incomplete.
   - **Red at the base:** `runBriefPlanGate` writes its record only after `transport.dispatch` returns or throws
     (`brief-plan-gate.ts:330-371`). A killed process mid-call leaves no record of a call that may have reached
     Jev and been billed.
2. **The count:** the number of live records (or attempt lines) with a non-null `attempted_at` across 4.2, 4.3 and 4.4,
   **including** failed attempts. `sent` is not used, because a transport failure leaves `sent: false`
   (`brief-plan-gate.ts:333-343`) even when the request may have arrived. The count is **≤ 20**.
3. The close-out lists every live record by path and gives the count from a committed command run at the close-out
   SHA. QA re-runs that command. "From memory" means any number not reproduced that way.
4. Above 20 the slice stops (brief §5). A 21st attempt record, if one exists, fails the row.

#### S4-7b. A transport retry is told apart from a re-roll in the record

**Pass:**

1. Every live record carries:
   - `subject`: (`gate`, `scored_sha` or the `D_t` path, and the `D_t` or `E_t` blob);
   - `attempt` (1, 2, and so on);
   - `retry_of`: the path of the record it retries, or null;
   - `outcome_class`: `answered`, or one of `gate.ts`'s `GateFailureClass` values.
2. **A retry** is a record whose `retry_of` names an earlier record for the **same subject** whose `outcome_class` is
   `transport`, `rate-limited` or `overloaded`, and whose `answer` is null.
3. **A re-roll** is any second live record for a subject that already has a record with a non-null `answer`. It is
   **forbidden**: at most one answered record per subject. `auth` (401), `request-invalid` (422), `unexpected-status`
   and `malformed-response` are not retryable. The item stops and is reported.
4. Retries in total are ≤ 3 (brief §5).
5. **Checked mechanically** by the S4-7a command:
   - group the records by `subject`;
   - assert ≤ 1 answered record per group;
   - assert every non-first record has a valid `retry_of`;
   - assert the retry total is ≤ 3.
   Fixture tests feed it a legal retry chain (it passes) and a re-roll, meaning a second answered record (it fails).

*Red at the base:* `GateRecord` has no `attempt`, `retry_of` or `subject` (`artifacts.ts:48-67`), and no counting
command exists.

### S4-8. 4.5: F11 answered before any green, and bound by a CI run id

**Pass (A7/R7 shape, `loop-15-slice-3-qa-criteria.md:222-228`; both clauses, not either):**

1. The planner commits F11's answer for this slice in a tracked file that says it is F11's answer. The F11 commit is
   an **ancestor** of every slice-four candidate that claims green.
2. The first green CI run on any such candidate has a `head_sha` that descends from the F11 commit. That descent is
   what makes the run postdate the commit. No green CI run with a **lower run id** exists on a slice-four candidate
   that lacks the F11 commit.
3. The F11 file's blob is identical at the F11 commit and at that run's `head_sha`: it was not amended after.
4. The close-out quotes the run id, its `head_sha`, its `created_at`, and the F11 commit.

*Red at the base:* no slice-four F11 answer is committed. The brief draft says F11's drafted text "is NOT on master"
(`loop-15-slice-4-brief-draft.md:91`). `LOOP_LIMITS` (`runtime.ts:226-250`) carries "WHAT A GREEN LOOP MEANS" as
slice three ruled it (CA-11). Whether that already **is** the answer 4.5 asks for is Open 4. **Unrunnable here
without `gh`:** reading run ids. QA reads them at the close-out.

### S4-9. Scope and suite (guard)

**Pass:**

1. No slice-four diff adds a reference to jev-mcp. `git diff <base>..<candidate> -- open-brain/src` has no added line
   matching `jev-mcp|mcp__jev`. All calls go through `JevTransport`.
2. No `.skip`, `.todo`, `skipIf` or `runIf` is added, and no test is deleted. `Tests` passed is at least the base's.
   Every existing `declared`, `shadow-merge`, `t195-plan-gate`, `gate-live`, `policies` and `runtime` test passes
   **unchanged**.
3. Locally, `npm run build`, `tsc --noEmit` and `vitest run` (in `open-brain/`) exit 0, with the exit codes quoted
   (D-061). **QA runs the CI.**
4. `loop-15-slice-3-c-criteria.md`, C's `shadow_merge.json` and `ledger.jsonl` are byte-identical at the base and at
   the close-out (`D_t` preserve).
5. No gate merges, pushes or tags (D-019).

*Red at the base:* not applicable. Guard.

---

## 2. Declared before any candidate: unrunnable and out-of-scope

```qa-declared
[unrunnable]
S4-20: the live halves of S4-2, S4-3a.2, S4-3b.2 and S4-7 at the step-2 candidate - they need the step-4 live run, and QA scores them at the close-out, not at the candidate
S4-21: proof that a reconstructing seat did not build the diff beyond the seat attestation in S4-4b - every commit is authored as Aaron Melven and the builds carry no per-seat signature or session trailer
S4-22: that the key reaches nothing outside the observed outputs - TypeSafe server-side logs, other machines, and transcripts of sessions other than the live QA seat cannot be read from here
S4-23: the live-call count cross-checked against TypeSafe billing or usage - needs Aaron's account; S4-7 counts from the records only
S4-24: whether any Jev answer in this slice is correct - typed output guarantees the interface, not truth; the slice records observations and claims nothing about their accuracy
[out-of-scope]
S4-30: calibration itself and any threshold change justified by it - needs N of 5 or more runtime-produced diffs with pre-work D_t (D-071, brief section 4)
S4-31: turning any gate on, including require_plan_gate or require_done_gate in merge.json (brief section 4)
S4-32: jev-mcp (research/jev-mcp.md:104; all calls go through gate.ts)
S4-33: 4.1 T-214 itself (P-blank, its generator and mutants) - its rows are in loop-15-slice-4-dispatch.md step 1; only this file's own parse check is here (S4-1)
S4-34: T-194, T-213 and T-215, which run alongside this slice
S4-35: re-running or rewriting C's shadow artifact or ledger, and editing loop-15-slice-3-c-criteria.md - immutable (D-075)
```

---

## 3. Reasoning, per question the dispatch says the criteria must settle

1. **Honesty:** S4-5a, 5b and 5c. Each is a command QA re-runs: a regenerated table, a whole-word search, and a
   `git diff --exit-code`. "Calibrated" is forbidden even in a negation. A rule with an allowed phrasing invites
   arguments about the phrasing, and "PROVISIONAL" says the same thing without them.
2. **Provenance:** S4-4a. The record is refused twice, by the writer and by a validator over the files, because a hand
   edit or a later writer would get past the writer alone. The runtime's own `G_done` is included because the dispatch
   says "every". I added the loop-id clause (4a.5) after seeing that `t195` matches the runtime pattern.
3. **Shadow:** S4-6d. "Changes an outcome" is measured as the things an outcome is made of: the exit code, the
   `E_t`, the report, the ledger and the merge verdict, all held fixed across a proceed/reject flip. The mutant
   is the smallest line that breaks that.
4. **Key, D-071:** S4-3a and S4-3b each have their own test.
   - **Testable before any live call:** (a)'s endpoint-and-header test, partly present at base (`gate-live.test.ts:152`),
     and its version comparator; all of (b)'s
     constructed-canary tests, which are the proof D-071 asks for.
   - **Needs the live run:** (a)'s authenticated 200 with a real `model_resolved`, and (b)'s post-run scan for the
     real key value. That scan reads the env for the value it searches for and checks its own known positive. It
     never treats "unset" as proof.
5. **Budget:** S4-7a and 7b. The count includes failed attempts and is write-ahead, because at the base a call that
   dies mid-flight leaves no record. A retry and a re-roll differ by one field: the `outcome_class` of the record it
   follows. That makes "a re-run to get a different score" a property of the record set, not an intention.
6. **Independence (4.3):** S4-4b. The honest answer is that it rests on attestation, because git authorship cannot
   tell the seats apart. So the row checks what can be checked (the mapping, the field, and the model line) and
   declares the rest unrunnable (S4-21).
7. **The QA-score gate (4.4):** S4-6a to 6d. "Missing evidence is `untested`" is computed by code from the `E_t` and
   overrides Jev ("do not ask a model anything code can compute", `policies.ts:327`). Only 5 of the 8 diffs have an
   `E_t`, so the honest N for `G_qa` is 5 unless the planner rules otherwise.
8. **F11:** S4-8. Ancestry makes the run postdate the commit: a run cannot test a tree that contains a commit not yet
   written. Git dates are not used, because R7 calls them rewritable.
9. **Parse check:** S4-1 and §4.3.

---

## 4. Observed in this run

1. `git fetch origin`: `origin/master` = `ec7138bb`. The dispatch exists only on `origin/docs/session-155b`, whose
   tip is `940d17cb` (parent `0394acbf`, the dispatch commit). **The launch line with `<DISPATCH_SHA>` did not reach
   this session**, so the worktree was made at `940d17cb`, the only commit carrying `qa-238-s4-criteria-dispatch.md`
   and `qa-238/push-qa.mjs` (Open 5).
2. Facts at the base, all by `git` at `origin/master`:
   - no `G_plan`, `G_done` or `G_qa` file is tracked;
   - no `qa-score.json`;
   - no `plan_provenance`, `reconstructed-after` or `written-before` anywhere in `open-brain/`;
   - `GateRecordKind = "plan" | "done"`;
   - 5 of the 8 diffs have a QA `E_t`, and in each the QA'd SHA is a strict ancestor of the merged head.
3. **Own parse check.** This machine's Node 22.22.1 has no TypeScript support (`ERR_NO_TYPESCRIPT` under
   `--experimental-strip-types`), and the trees have no `node_modules`. So `typescript@5.9.3` was installed into
   `~/qa-tmp` (`npm install --prefix ~/qa-tmp`). It transpiled `declared.ts` in memory with `transpileModule`, which
   strips types only. That source is blob `58653a1b`, identical at `origin/master` and at `940d17cb`
   (`git rev-parse`). The module was imported from a `data:` URL and run on this file's text. Output, verbatim:
   - `{"present":true,"unrunnable":["S4-20","S4-21","S4-22","S4-23","S4-24"],"outOfScope":["S4-30","S4-31","S4-32","S4-33","S4-34","S4-35"]}`
   - **Known positive, the same run:** with one blank line inserted before `[out-of-scope]`, the result was
     ``DeclaredParseError: line is not `ID: text`: (blank)``. So the instrument can fail, and this file passes because
     its block holds no blank line.

4. tcm: 0 of 2 runs. `gh` is not installed on Plumb.

---

## 5. What could not be verified

- **No suite was run.** The scratch tree has no `node_modules`, and the dispatch forbids laptop runs. Red-at-base claims
  are by source and `git grep`. My first draft of S4-3a claimed that no endpoint-and-header assertion existed. A
  follow-up grep found one (`gate-live.test.ts:168-169`), and the row now records it as a guard.
- **Which `qa/*` report accepted each diff.** The Terms table takes the latest `E_t` per diff. The planner should
  confirm each one against the merge record.
- **Building seats for the eight diffs.** I did not compile them. That is the planner's step-2 mapping (S4-4b).
- **Jev's per-request question limit**, which S4-6b.3 depends on for the larger `E_t`s (C's has many requirements). It
  is not in any file this seat read.

---

## 6. Open for the planner

1. **When live-only rows are scored.** S4-2, S4-3a.2, S4-3b.2 and S4-7 can be scored only after step 4, so I declared
   them unrunnable **at the step-2 candidate** (S4-20). If the shadow merge verdict runs on the step-2 candidate,
   leaving them in scope would make it `would-not-merge` on `not_evaluated`. Confirm that QA scores them at the
   close-out, or split these criteria into two files.
2. **4.4's N.** Only 5 of the 8 diffs have an `E_t` (A, B part 1 and B part 2 have none), so S4-6b.4 gives them **no
   call**, which saves 3. The alternative is to have a QA seat write those three `E_t`s first, which would be a new
   task. Rule which.
3. **Where `G_done` and `G_qa` are committed.** The `E_t`s live on `qa/*` branches, and "beside" would put the `G_qa`
   there. CC-29's precedent says a tracked `docs/**` path that reaches `origin/master`. I recommend that each `G_qa`
   sits beside a copy of its `E_t` under one `docs/loops/` directory for the slice, with `e_t_ref` naming the
   original. The `G_done`s go in the same tree.
4. **F11.** Is `LOOP_LIMITS` (`runtime.ts:231`, slice three's CA-11) already the answer, or does 4.5 need a new
   statement for shadow scoring on real diffs? S4-8 is written for a new commit either way.
5. **The launch line.** The headless prompt has the placeholder `<DISPATCH_SHA>`, and no SHA reached this seat. I used
   `940d17cb`. If the intended SHA was `0394acbf`, nothing changes: the dispatch file and `open-brain/` are identical
   at both.
6. **G-044 in an existing test.** `t195-plan-gate.test.ts:80` spreads `process.env` into the spawned CLI's env. Any
   future `--mode live` case added through that helper would inherit the real key. That is outside slice four's diff
   but is S4-3b's hazard: worth a gap note or a fix in 4.4's candidate.
7. **The 4.2 verdict.** If the live plan gate **rejects** this slice's own `D_t`, `harness plan-gate` exits 1, and
   `dispatch-check` would refuse a brief that has already been dispatched. S4-2.4 says it is an observation, not a
   re-call. Say whether a reject should pause step 4.

QA-238: REPORT COMPLETE
