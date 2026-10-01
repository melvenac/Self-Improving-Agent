# Loop 15 slice four, step 2: dispatch to sia-builder

**By:** Atlas (planner), record session 155, 2026-10-01. **For:** sia-builder, Claude Code Sonnet 5.5 (D-068, D-074).
**Scored against:** `docs/loops/loop-15-slice-4-criteria.md` (QA 238, `dd7b1c39`), as adopted in
`loop-15-slice-4-criteria-rulings.md`. **The criteria are the spec.** This file says what to build and in what order.
It does not restate the rows, so read every S4 row it names.

**Make no live Jev call in step 2.** Every test uses a fake transport and a constructed env. The live calls are the QA
seat's, in step 4.

## What to build, grouped so each group can go red and then green on its own

**G1. Records and provenance (S4-4a, S4-7a, S4-7b)**
- A strict schema for `G_done` and `G_qa` records with `source` and `plan_provenance`. Add `GateRecordKind` `"qa"`.
  Derive the JSON Schema and drift-test it.
- The writer refuses a record that lacks either field, and a `harness validate gate-record <file>` command (or a
  name you choose) refuses a hand-written one.
- `runLoop`'s own `G_done` writer emits `source: "runtime"` and `plan_provenance: "written-before"` (S4-4a.4).
- `source` is never inferred from the loop id (S4-4a.5).
- **Write-ahead** attempt records, plus `subject`, `attempt`, `retry_of` and `outcome_class`.
- A committed **counting command** that groups records by subject and enforces three things: at most 1 answered
  record per subject, a valid `retry_of` on every non-first record, and at most 3 retries in total. Write fixture
  tests for a legal retry chain and for a re-roll.

**G2. The key (S4-3a.1, S4-3b.1, ruling 6)**
- The `JEV_ENDPOINT` exactly-one-request test, and its pair with the variable deleted, which must make zero requests.
- The model-version **comparator**, with its unit table. `jev-1.9.0` must fail, compared numerically.
- **Canary tests by construction**, one per writer: `runBriefPlanGate`, the 4.3 runner and the 4.4 runner. Each uses
  the hostile echoing fake (200 and 422), walks every output, and includes the known positive and the `redact`
  mutant.
- **Ruling 6:** `t195-plan-gate.test.ts`'s `harness()` helper takes a constructed env and never spreads
  `process.env`. Every existing test in that file passes.

**G3. The 4.3 done-gate runner, out of loop, in shadow (S4-4, S4-6d)**
- A CLI subcommand that scores one merged diff through `gate.ts`, never jev-mcp. It names `pr`, `merge_commit`,
  `scored_sha` and `base_sha`, and the reconstructed `D_t` by path and blob.
- The diffstat comes from `base_sha..scored_sha`, and `checks_source` is recorded, with `"none"` meaning
  `checksPassed: false`.
- `runtime_action` says no outcome was changed.
- **The flip test** and both outcome mutants (S4-6d.4).

**G4. The 4.3 reconstructions (S4-4b)**
- Eight `D_t` files under `docs/loops/loop-15-slice-4-records/`, one per diff in
  `loop-15-slice-4-reconstruction-map.md`. You reconstruct all eight: none was built in your checkout.
- Each is reconstructed **from the diff's prose brief only**, not from its code, and carries `reconstructed_by` and
  `reconstructed_from` (path plus blob).
- The plan schema needs both fields. Add them so that a `written-before` plan without them still validates.
- Each passes `harness validate plan`. Each loop id is a seat id, not `tNNN`: T-195's becomes, for example,
  `15-t195`.

**G5. The 4.4 QA-score gate as data (S4-6a, S4-6b, S4-6c, S4-6d)**
- `open-brain/src/harness/policies/qa-score.json`, its strict schema, the derived JSON Schema, the loader's four
  refusals, the threshold-scan targets plus a planted-literal mutant, and the A6 temp-dir test.
- One batched request per diff. `untested` is computed by code for missing evidence. Jev's answer to an evidence-less
  row is ignored, and there is a mutant for that.
- `G_qa` is written once, beside a **copy** of its `E_t`, under `docs/loops/loop-15-slice-4-records/` (ruling 3), with
  `e_t_ref`.
- **Five diffs only** (ruling 2). A, B part 1 and B part 2 are `not scored: no E_t`.

**G6. Honesty tooling (S4-5a)**
- A committed generator that builds the close-out tables from the gate records, with N, SHAs, per-diff values,
  min/max, counts either side, and the `PROVISIONAL (N=…)` label computed from the records.

## Guards to keep green (S4-5b, S4-5c, S4-8 as amended, S4-9)

- No added line contains the word "calibrated" (case-insensitive, whole word). Write "PROVISIONAL" instead.
- The three existing policy files are byte-identical. The `LOOP_LIMITS` string is byte-identical (ruling 4).
- No added jev-mcp reference.
- Add no skip or todo, and delete no test.
- `loop-15-slice-3-c-criteria.md`, C's `shadow_merge.json` and `ledger.jsonl` are untouched.

## Rules

- Branch from `origin/master` (`2448a6ea` or later) as `loop/15-slice-4-step2`. The criteria, rulings and map are
  readable at the docs commit named on the dispatch message, before they reach master. Commit red and then green per group (G1 to G6). The handoff maps each S4 row to its test
  and mutant.
- **Machine:** this is the QA PC, which is also Chisel's dev box. Run sequentially, and check for at least 1.5 GB free
  RAM before the mutants. **Heavy runs need Aaron's approval in your window.** A planner "go" is not his approval.
- Locally: `npm ci`, `npm run build` and `tsc --noEmit`, then `vitest run` in `open-brain/` (S4-9.3), with the exit
  codes quoted. Run no CI (D-061). Keep mutants local, with diffs under `docs/loops/loop-15-slice-4/mutants/` (T-207).
- Handoff: `docs/loops/loop-15-slice-4-step2-developer-handoff.md`.
- Push only `loop/15-slice-4-step2`, never forced. Report the SHA to atlas.
- **If a group's size or an open question stalls you, push what is green and ask.** Don't guess across a row.
