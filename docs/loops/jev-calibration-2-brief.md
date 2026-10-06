# Jev calibration 2: rounds until the gate is useful

**By:** Atlas (planner), 2026-10-05, record session 162.
**Ruling:** Aaron, in the planner's window, 2026-10-05: *"Keep calibrating until jev is useful"*. That was his answer
to whether calibration 2 (T-225) should run at all.
**Read first:** `docs/loops/jev-calibration-1.md` (QA 252, report `d495032c`) and decision D-100. T-225's note in
`.agents/state.json` lists the four prerequisites this brief starts from.

## What calibration 1 found, in one paragraph

On 44 labelled cases, the developer done-gate (`G_done`, `open-brain/src/harness/policies.ts` and
`policies/developer-done.json`) rejected all 44. Jev alone, with the checks set aside, did the same. Its driving
answers scored a Brier of **0.2708**, against **0.25** for always answering 0.5. `diff_matches_plan` ranged 0.17 to 0.71
whatever the verdict was (AUC 0.640 headline, 0.504 leak group), and `diff_matches_plan_min` is 0.7. Cuts fitted to the
set reached balanced accuracy 0.682 where they were fitted, and **0.388** on the leak group. `G_qa` could not be
calibrated: its request carried the requirement statuses it was being scored against.

**What follows from that:** moving thresholds cannot make this gate useful, because the answers do not separate ACCEPT
from REJECT. Each round therefore changes **what Jev is asked and shown**, then measures that change on cases held out
from the change.

## Useful, defined before any data is looked at

The done-gate, with its policy frozen before the held-out run, is **useful** when on the held-out set:

1. **Balanced accuracy is at least 0.75.**
2. **False-accept rate is at most 10%**: a REJECT case gets `proceed` no more than one time in ten.
3. **The driving questions' Brier is at most 0.20**, clearly better than the 0.25 a constant 0.5 scores.
4. **Its confident answers are right:** answers at p ≥ 0.9 are correct at least 90% of the time, over at least 10
   such answers.

All four must hold on one run. A gate that rejects everything fails 1. A gate that waves REJECTs through fails 2.

**If the gate is useful, the change is still not automatic.** It goes from shadow to **advisory**: QA and the planner
see its verdict beside their own. Any role beyond that (D-019's human gate, D-071's runtime-diff requirement) is
Aaron's decision. **Calibrated** in D-071's sense still requires five runtime-produced diffs with plans written before
the work. Seat-built cases are tagged provisional, as in calibration 1.

`G_qa` uses the same four criteria, scored on its own set, once its request no longer carries the answer.

## How a round works

1. **Two sets, split before anything is changed:**
   - a **development set**, where the round's change is designed and may be tried as often as needed;
   - a **held-out set**, at least 30 cases with at least 12 of each verdict. It is frozen by its commit SHA and read
     ONCE per round, after the change and the policy are frozen.
   A held-out case that is used to design a change moves to the development set, and the held-out set is refilled
   from new cases before the next round.
2. **One family of change per round**, named in advance: what Jev is shown (the inputs), what Jev is asked (the
   questions), or how answers are combined (the policy). Thresholds may move only inside a policy change, and only
   on development-set evidence.
3. **A round report**, in the shape of calibration 1's: the four criteria on the held-out set, per-class rates, Brier
   with the constant-0.5 baseline beside it, AUC per driving question, and the leak check (does any input carry the
   verdict wording?).
4. **The planner rules after each round:** useful (stop), or the next round's change family, with the reason. A round
   that makes no progress on any criterion is reported as such and is not repeated unchanged.

## Round 2: what it changes

From T-225, plus the main lesson above:

1. **`G_qa` without the answer:** the request no longer carries the `E_t` requirement statuses (met or unmet).
2. **Real deterministic checks** on the cases that have them, so the gate as built (a) and Jev alone (b) can differ.
3. **`score.mjs` matches the current reason text**, "no deterministic checks were supplied" (T-222 F6), and a test
   proves the drivers count is right on a known positive.
4. **The question change (new):** instead of one whole-diff `diff_matches_plan`, Jev is asked about each requirement
   row: is it met by this diff, with the row text and the relevant hunk shown. The gate combines those per-row answers.
   This is the first change aimed at the separation problem itself. The developer may propose a different question
   shape if reading the calibration 1 answers suggests one, and must say why.

## Cases

- **Source:** every QA report since calibration 1's set was frozen (QA 253 through QA 280 and on). Each report gives
  pinned heads with ACCEPT or REJECT verdicts, a plan or brief written before the build, and rows. These are labelled
  cases that calibration 1 never saw. Rejected-then-fixed pairs (for example #437 r2, r3 and later, and #445 r2, r3,
  r4) are especially useful, because the same task appears under both verdicts.
- **Leak check:** a case whose inputs carry verdict wording goes in a separate leak group, as in calibration 1, and is
  not used for the four criteria.
- **Provenance:** every case is tagged seat-built or runtime-built (D-071).

## Seats and limits

- **Builder:** the code for round 2 items 1 to 4, the case collector for QA 253 onwards, and the scoring. Tests and CI
  as usual. It makes no live Jev call.
- **Planner:** splits and freezes the two sets, and freezes the policy before the held-out run.
- **QA seat:** makes every live Jev call, on the laptop where `TYPESAFE_API_KEY` is set (D-074, D-087), and writes the
  round report. **No cap on live calls** (Aaron, planner window 2026-10-05: *"No cap for jev is needed. The model is
  cheap, do as many calls as you need for calibration."*). Each round report still states how many calls it made,
  including retries, so the spend is visible.
- **The key** is never printed, logged or committed. The key scan from calibration 1 runs on every report.
