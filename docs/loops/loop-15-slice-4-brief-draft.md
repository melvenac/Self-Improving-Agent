# Loop 15 slice four (DRAFT): Jev scoring on real diffs, with no calibration claimed

**By:** Atlas (planner), record session 153, 2026-09-30, at record rev 211. **Status: all four questions in section 4 are
RULED (D-070 and D-071, rev 214), but the slice is still NOT DISPATCHED.** D-070 puts the slice-three close-out, with
T-169, first. After it, this draft becomes the final brief, and the rulings below are folded into sections 2 and 3.
Per T-195, the dispatched version ships with a sibling `D_t` JSON and goes through `harness dispatch`.

**Rulings (Aaron, session 153):**
1. The close-out and T-169 come first (D-070).
2. Seat-built diffs are scored, but they are PROVISIONAL only. Each record is tagged with its source (seat or runtime)
   and its plan provenance (reconstructed after the work, or written before it). "Calibrated" needs 5 or more
   runtime-produced diffs whose plans were written before the work (D-071).
3. The TypeSafe key lives only in Aaron's local dev environment, and every project that adopts SIA brings its own
   access. The README says so (D-070). The live-call budget is proposed in the final brief.
4. Both key properties are required, each with its own test: the key reaches the Jev endpoint, and it reaches nothing
   else (D-071).

## 0. Why this slice, and what it cannot yet be

- **D-033** moved "QA scoring through Jev, with thresholds calibrated against real diffs" (slice-three brief §3,
  item 3, `loop-15-slice-3-brief.md:68-70`) to the slice after A, B and C. D-036 added C. All three are merged as of
  2026-09-30 (#182; #165 and #187; #195 = ddd43526).
- **Calibration is not possible today, and this brief does not pretend otherwise.** The data calibration would rest on
  is, read at 96ebd400:
  - **Gate records:** 0 tracked `*.D_t.json`, `G_plan`, `G_done` or `G_qa` files. T-195's plan gate has never judged a
    real brief live.
  - **Live Jev observations:** 1 pair, slice two's (`loop-15-slice-2-qa-report-2.md:133-145`). The plan gate returned
    `proceed`. The done gate returned `reject`: `diff_matches_plan` 0.26 against a minimum of 0.7, and
    `local_tests_support_claim` 0.43 against a minimum of 0.6.
  - **Shadow merge ledger:** 1 line, `undefined`, from T-214's formatting defect. Evaluated 0.
  - **QA-score gate:** not implemented. `gate.ts` names `qa-score`, and `runtime.ts:1572` prints "NOT CONSULTED". There
    is no `policies/qa-score.json`.
- The thresholds in `policies/*.json` say of themselves "a starting position, not a calibration" (`policies.ts:254`),
  and `HOH-JEV.md` §9 says the same.
- **The binding rule is A6/R6** (`loop-15-slice-3-qa-criteria.md:191-215`, `:399`):
  - every threshold comes from real diffs;
  - report **N**, **the diffs by SHA**, and **the observed spread**;
  - **below N=5, write PROVISIONAL**;
  - **the word "calibrated" may not be used below N=5.**

So this slice **collects the first real observations and states them honestly.** It moves no threshold unless N
supports it, and it turns on no gate.

## 1. Before the slice: the slice-three close-out, which D-033 says carries T-169

Slice three is closed only in `state.json`. No `loop-15-slice-3-closeout.md` exists. D-033 puts T-169 into that
close-out:
- rewrite PRD.md and README.md against what ships;
- take PRD.md off `retirements.json`'s historical list;
- add the retired maturity lifecycle;
- append a dated part to the Step-Back artifact at the same URL.

**Recommendation:** the close-out, with T-169, lands BEFORE this slice's first dispatch. Then slice four is briefed
against a PRD that describes the system as it ships (the lesson from Loop 14 and T-169). PRD.md today has no success
metric and does not mention the HoH loop. The nearest measurable target in the record is D-019's exit criterion.

## 2. Items, in order

**4.1. T-214 first: the declared-block parser.** A criteria file whose `qa-declared` block has a blank line makes every
shadow verdict `undefined`, so no disagreement count can accrue.
- Rule (a) or (b) from T-214's note.
- Add a fixture with a blank line.
- Add a `/sync` or authoring-time check that refuses an unparseable block BEFORE a candidate exists.
- Do not touch `loop-15-slice-3-c-criteria.md`; its artifact is immutable.

**4.2. The live-call preconditions, observed once.** T-195's operational consequence is still open: the main checkout
must be rebuilt, and `TYPESAFE_API_KEY` must be present. Slice two's close-out (`:165`) said to rotate the key and
scope it to the QA session.
- **Deliverable:** one live plan-gate call on THIS brief's own `D_t`.
- Record it with the resolved model and a model version ≥ `jev-1.13.0`, and prove the key reached its endpoint
  through the response, never through `process.env` (G-044).
- It is T-195's named first observation.

**4.3. Retrospective done-gate scoring of real merged diffs (the N).**
- Run the **developer-done gate live, in shadow and never gating**, on N ≥ 5 real diffs already merged in Loop 15.
- Candidates, each with its QA'd SHA and plan: A (#182), B part 1 (#165), B part 2 (#187), C (#195), T-195 (#209),
  T-198 (#227), T-196/T-197 (#220) and T-158 (#218).
- Write one `G_done` record per diff with the resolved model, then report N, the SHAs, and each score's spread against
  the current thresholds.
- **Open question, Q2:** A6 says "diffs produced by this loop's real roles". Only candidate A came from the runtime's
  real role; the rest came from developer seats. Do seat-built diffs count as "real" for A6?

**4.4. The QA-score gate, built as data (HOH-JEV §4 "QA scoring", `HOH-JEV.md:248-254`).**
- It records per requirement: pass, fail or untested, with a `severity` per fail, plus
  `regression_of_validated` and `artifact_complete_enough_to_stop`. Missing evidence is `untested`.
- Add `policies/qa-score.json` and its schema, with thresholds as data under the threshold-scan guard.
- **Wire it in SHADOW only.** It writes `G_qa` beside the QA's `E_t` and never changes a verdict.
- Score the same N diffs from 4.3, using their QA reports' `E_t` where it exists.

**4.5. F11, answered before the first green live loop (rulings-1 R6 as amended by rulings-2 R8; A7/R7).**
- F11's drafted text is NOT on master: `loop-15-slice-3-developer-design.md` was never tracked.
- Commit the answer at an ancestor of any candidate that claims green.
- The first green CI run id must postdate that commit.

## 3. Acceptance, in outline (criteria are written separately, before any candidate)

- **Honesty rows:** every reported threshold names N, the SHAs and the spread. "Calibrated" appears nowhere below
  N=5. No threshold file changes unless N ≥ 5 and the change is shown against the spread.
- **Shadow rows:** no gate added in this slice changes a runtime outcome, a QA verdict or a merge. Check this with a
  mutant that makes a gate decision flow into an outcome; it must be red.
- **Live-call rows:** the resolved model and version are recorded, the key is shown to reach its endpoint, the key
  appears in no artifact, and each call goes through `gate.ts` (not jev-mcp; see `research/jev-mcp.md:104`).

## 4. Open questions for Aaron

1. **Order:** the slice-three close-out and T-169 before this slice (recommended), or in parallel?
2. **"Real diffs":** does a developer-seat diff count under A6, or only the runtime's own real-role diffs? If only
   the latter, N is 1 (A), and 4.3 waits for new runtime loops.
3. **The key and the budget:** who provisions `TYPESAFE_API_KEY` for which seat, and what is the cap on live Jev calls
   for 4.2 to 4.4 (at least 1 + 8 + 8)? Rotating and scoping it to QA was slice two's recommendation.
4. **Wording:** the brief says "the key reaching nothing" and A6 says "the key reaching its endpoint". The draft
   uses A6's.
