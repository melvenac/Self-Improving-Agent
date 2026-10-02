# Jev calibration 1: does the done-gate agree with known outcomes, and does its confidence mean anything?

**By:** Atlas (planner), record session 156, 2026-10-02. **Asked by Aaron**, typed in clark's session and relayed:
"run a calibration check. Take past cases where we already know the right answer."

**Why:** slice four closed "PROVISIONAL, no calibration claimed" (D-093). The done-gate rejected 8 of 8 diffs that QA
had ACCEPTED, which is either a threshold problem or an input problem. This measures that, and it builds a set that
can be reused for later Jev versions.

## What is calibrated, and what is not

- **G_done (the 4.3 developer done-gate): CALIBRATED.** Its label is the QA verdict on the exact candidate SHA.
- **G_qa (the 4.4 QA-score gate): NOT CALIBRATABLE AS BUILT.**
  - The planner checked QA 248's records: the `G_qa` request carries the `E_t`'s own `status: met / unmet` for every
    requirement. Jev is shown the label it is being scored against.
  - So QA 248's five G_qa verdicts are largely an echo of QA's statuses. This is a finding for the report, not a case
    set.
  - A later brief can strip the status from the request and calibrate it then.
- **G_plan: no case set.** Too few plans have a known outcome. The report says so.

## Phase 1, BUILD (a dev seat; LIGHT; no Jev call)

Output: `docs/loops/jev-calibration-1/`, frozen by one commit **before any call**.

1. **`collect.mjs`** enumerates ruled QA reports. Sources:
   - `origin/qa/*` branches: each report's `.E_t.json` gives `candidate_git.sha`;
   - the verdict line or ruling that decided it.

   Output: one row per candidate SHA with `{case_id, pr_or_task, candidate_sha, base_sha, dispatch_path, dispatch_commit, qa_report_ref, ruling_ref}`.
2. **`inputs.mjs`** builds each case's `D_t` **mechanically** from the dispatch file at its dispatch commit, using
   the same derivation the slice-four reconstruction used (`docs/loops/loop-15-slice-4-reconstruction-map.md`).
   **No hand edits.** This script must not read any QA report, verdict or ruling. A case whose dispatch cannot be
   found or parsed is DROPPED, with the reason logged. It is never patched.
3. **`labels.mjs`**, a separate script, writes `labels.json`: `ACCEPT → proceed`, `REJECT → reject`, with the source
   (`QA nnn report sha`, `D-xxx` or `rulings-N`).
   - **Exclusion tags, decided here and before the freeze:** `environmental` (runner, CI or host fault), `unrelated-test`
     (a test outside the diff) and `superseded-unruled`.
   - Excluded cases stay in the file, marked `excluded: <tag>`, and are not scored.
4. **`sample.mjs`** draws the scored set: **at least 50 cases, as close to 50/50 ACCEPT/REJECT as the pool allows**,
   with a fixed seed. Must-includes:
   - every slice-four diff (#165, #182, #187, #195, #209, #218, #220, #227), all ACCEPTED;
   - candidate A's rejected rounds;
   - T-194 r1 to r8.
5. **`MANIFEST.json`**: the seed, the pool size, the scored-set size, the per-label counts, the drop and exclusion
   counts by reason, and sha256 for every input file and script.
   - **Leak check (clark):** for each case, record the dispatch commit's date and the QA report commit's date. A
     case whose `D_t` source was committed AFTER its QA report is excluded as `leak-later-ruling`, because a
     re-dispatch written after a REJECT carries the ruling in its text.
6. **Rows:**
   - **B-1:** `inputs.mjs` contains no read of `qa/*` report files or rulings, shown by a grep in the handoff.
   - **B-2:** running the scripts twice gives an identical manifest.
   - **B-3:** the freeze commit has no gate record under `records/`.
   - **B-4:** the PR touches only `docs/loops/jev-calibration-1/**` and the handoff.

## Phase 2, RUN and SCORE (a different seat from the builder; LIGHT QA job)

1. **Key:** load `TYPESAFE_API_KEY` from `HKCU\Environment` into the job process and check fingerprint
   `728B667EFF`. Never print it.
2. **Base:** start from the freeze commit or a master that contains it, then run `git merge-base --is-ancestor <freeze> HEAD`.
3. **Calls:** one `harness shadow-done … --mode live --records docs/loops/jev-calibration-1/records` per scored case.
   **Never re-ask.** Retries are allowed only on `transport`, `rate-limited` or `overloaded`, at most 3 in total. On
   `auth`, stop everything.
   - **Spend cap: $0.50.** Stop when the summed `usage` reaches it. At QA 248's price, about $0.0001 per call, the set
     costs about $0.01.
   - Slice four's ledger and its cap are not touched.
4. **`score.mjs`** must be committed in the freeze in Phase 1. It computes:
   - accuracy, overall and for the must-include slice-four group on its own;
   - a confusion matrix, with the **false-accept rate as the headline** (proceed on a REJECTED candidate);
   - calibration by Jev's own per-question confidence, in the bands <0.7, 0.7 to 0.9 and ≥0.9: the fraction correct
     and N in each, plus the Brier score;
   - every confident miss (confidence ≥ 0.9 and wrong), listed with its case and question;
   - which done-gate question drove each verdict (`diff_matches_plan_min` or `touches_out_of_scope_max`).
5. **Output:** `docs/loops/jev-calibration-1.md`.
   - **The headline names both results:** the G_done figures, and **"G_qa: uncalibratable as built, because the
     request carries the label"**. The second is not a footnote.
   - The method, the freeze commit and the manifest sha, the results tables (generated, not typed), the G_qa finding,
     and a recommendation: trust as-is, change thresholds (with values shown on THIS set), or human review below a
     stated confidence.
   - **Any threshold proposed is labelled as fitted to this set**, and the report says it needs a held-out set before
     anyone relies on it.
   - Also a key scan, as QA 248's was, naming the transcript by absolute path.

## Rules (both phases)

- The repo is PUBLIC. No issues, no comments, and no PR except each phase's own.
- No policy file and no threshold changes in either phase. This brief measures; it does not tune.
- Each phase's handoff or report goes to `atlas-sia`, or to `clark` if atlas-sia is unreachable.
