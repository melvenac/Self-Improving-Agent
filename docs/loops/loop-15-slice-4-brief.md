# Loop 15 slice four: Jev scoring on real diffs, with no calibration claimed

**By:** Atlas (planner), record session 153, 2026-10-01. **Supersedes** `loop-15-slice-4-brief-draft.md`. All four of
its questions are ruled (D-070, D-071). **Status: FINAL for Aaron's go. Not dispatched until he says so.**
**Plan:** `loop-15-slice-4-brief.D_t.json`, beside this file. It validates with `harness validate plan` (T-195). The
live plan gate runs on it as item 4.2.

## 0. Why, and what this slice is not

- D-033 moved "QA scoring through Jev, with thresholds calibrated against real diffs" here.
- **Calibration is not possible yet**, read at master `717a5509`:
  - 0 tracked `G_plan`, `G_done` or `G_qa` records;
  - 1 live Jev pair ever (slice two);
  - a shadow ledger with 1 row, which is `undefined`;
  - no QA-score gate and no `policies/qa-score.json`.
- So this slice **collects the first real observations and states them honestly** under A6/R6:
  - report N, the diffs by SHA, and the spread;
  - **PROVISIONAL below N=5**;
  - the word "calibrated" is forbidden below N=5.
- **No gate added here changes an outcome.** Everything runs in shadow.
- **Precondition, met:** the slice-three close-out and T-169 landed first (D-070): close-out #236, PRD and README
  #238, the Step-Back Part 6.
- **Precondition, NOT met: T-216.**
  - `harness validate plan` refuses this brief's `D_t`, because the plan schema accepts only runtime loop ids
    (`/^t\d{3,}$/`, `schema.ts:84` and `:248`).
  - The evidence schema already accepts seat loop ids like `15-slice-3-c` (`EVIDENCE_LOOP_PATTERN`, `:180`, widened
    in candidate B).
  - So T-195's rule (every brief ships a `D_t` that `harness dispatch` validates) cannot be met by any planner brief
    today.
  - The `D_t` keeps its true loop id, `15-slice-4`, and this slice is dispatched after T-216 merges. That is a small
    code fix through QA.

## 1. Rulings this brief carries (Aaron, session 153)

- **D-070:**
  - the TypeSafe key lives only in Aaron's local dev environment, as a user env var on his machines;
  - it is never committed, never a CI secret, and never in another person's environment;
  - each SIA-adopting project brings its own key (README, #238).
- **D-071:**
  - Seat-built diffs are scored as **PROVISIONAL** only. Every `G_done` and `G_qa` record carries `source`
    (`seat` | `runtime`) and `plan_provenance` (`reconstructed-after` | `written-before`).
  - "Calibrated", or any threshold change justified as calibration, needs **N ≥ 5 runtime-produced diffs whose
    `D_t` was written before the work**.
  - **Both key properties are required, each with its own test:**
    - (a) the key reaches the Jev endpoint, proved by an authenticated response carrying the resolved model,
      version `jev-1.13.0` or later;
    - (b) the key reaches nothing else: no artifact, log, gate record or transcript contains it, proved by
      constructing the environment and asserting on the outputs, never by reading the inherited `process.env`
      (G-044).

## 2. Items, in order

**4.1. T-214: the declared-block parser (first; no Jev).**
- Choose either rule: (a) tolerate blank lines between sections, or (b) refuse an unparseable `qa-declared` block at
  authoring, from `/sync` or the criteria step, before any candidate exists.
- Add a fixture with a blank line, and a mutant.
- Do not touch `loop-15-slice-3-c-criteria.md`; its shadow artifact is immutable.

**4.2. The live-call preconditions, observed once (1 call).**
- The main checkout is rebuilt at master. `TYPESAFE_API_KEY` is present in Aaron's environment only.
- Run ONE live plan-gate call on `loop-15-slice-4-brief.D_t.json` through `harness plan-gate`. This is T-195's
  named first observation.
- Record the `G_plan` with the resolved model, and prove D-071's properties (a) and (b) for it.

**4.3. Retrospective done-gate scoring, in shadow (8 calls).**
- Run the developer done-gate live, through `gate.ts` and never jev-mcp, on the 8 merged Loop 15 seat-built diffs,
  each at its QA'd SHA:
  - A (#182);
  - B part 1 (#165) and B part 2 (#187);
  - C (#195);
  - T-195 (#209), T-198 (#227), T-196/T-197 (#220) and T-158 (#218).
- Each needs a `D_t`. These are **reconstructed after the work** from the prose brief, so tag them that way. The
  reconstruction is written by a seat that did NOT build that diff.
- Report the per-score spread against the current `developer-done.json` thresholds, labelled **PROVISIONAL (N=8
  seat-built, 0 runtime)**.

**4.4. The QA-score gate, built as data, shadow only (8 calls).**
- It follows HOH-JEV §4 "QA scoring" (`docs/HOH-JEV.md:248-254`): per requirement, pass, fail or untested; a
  `severity` for each fail; `regression_of_validated`; and `artifact_complete_enough_to_stop`. Missing evidence is
  `untested`.
- Add `policies/qa-score.json` and its schema, with thresholds as data under the threshold-scan guard.
- It writes `G_qa` beside the QA's `E_t` and never changes a verdict.
- Score the same 8 diffs using their QA reports' `E_t`, where one exists on a `qa/*` branch.

**4.5. F11, answered before any green live loop (rulings-1 R6, amended by rulings-2 R8; A7/R7).**
- Commit the answer at an ancestor of any candidate that claims green.
- The first green CI run id postdates it.

## 3. Acceptance, in outline

The criteria are written separately, before any candidate, and include a parse check of their own `qa-declared` block
(4.1's rule).

- **Honesty rows:**
  - every reported threshold names N, the SHAs and the spread;
  - "calibrated" appears nowhere;
  - no threshold file changes in this slice.
- **Provenance rows:** every `G_done` and `G_qa` carries `source` and `plan_provenance`, and a record without them is
  refused.
- **Shadow rows:** no new gate changes a runtime outcome, a QA verdict or a merge. A mutant that lets a gate decision
  flow into an outcome must go red.
- **Key rows:** D-071 (a) and (b), each with its own test, and the resolved model ≥ `jev-1.13.0`.
- **Budget row:** live Jev calls ≤ the cap in §5, counted from the gate records, not from memory.

## 4. Out of scope

- Turning any gate on; changing any threshold; calibration itself (that needs N ≥ 5 runtime diffs, so new runtime
  loops).
- jev-mcp (`research/jev-mcp.md:104`: use the plain API through `gate.ts`).
- T-194, T-213 and T-215. They run alongside this slice and are not part of it.

## 5. Live-call budget (proposed for Aaron's ruling)

| Item | Calls |
|---|---|
| 4.2 plan gate on this brief | 1 |
| 4.3 done gate × 8 diffs | 8 |
| 4.4 QA score × 8 diffs | 8 |
| Retries on a transport error only (not to re-roll a score) | 3 |
| **Cap** | **20** |

- A re-run to get a different score is forbidden: the first answer is the observation.
- Every call is made from Aaron's machines, with his key, by the seat Aaron names. Slice two's close-out recommends the
  QA seat.
- Above 20, the slice stops and asks.
