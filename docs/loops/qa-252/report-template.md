# Jev calibration 1: does the done-gate agree with known outcomes, and does its confidence mean anything?

**By:** QA 252 (headless Claude Code, Opus, laptop), record session 252, 2026-10-02. Prefix `jev-cal-1`.
**Brief:** `docs/loops/jev-calibration-1-brief.md`, Phase 2 and Rules. **Dispatch:**
`docs/loops/qa-252-jev-calibration-1-phase2-dispatch.md`. **Rulings:** `jev-calibration-1-rulings-1.md` (D-096),
`jev-calibration-1-rulings-2.md` (D-098).
**This seat is not the builder.** It made the calls and ran the scorer. It did not build the set.

## Headline

**G_done (the 4.3 developer done-gate), headline set N = 44 (26 ACCEPT / 18 REJECT; `meets_50` false, so the real N
is reported):**

- **(a) The gate as built rejected all 44.** False-accept rate **0.0%** (0 of 18 REJECTs proceeded). False-reject
  rate **100.0%** (26 of 26 ACCEPTs rejected). Accuracy 40.9%, which is just the REJECT share. **Balanced accuracy
  50.0%.** Per class: proceed on ACCEPT 0.0%, reject on REJECT 100.0%.
- **(b) Jev alone, COUNTERFACTUAL (checks set aside, `checksPassed: true`, same policy): identical. It also rejected
  all 44.** False-accept 0.0%, false-reject 100.0%, balanced accuracy 50.0%. No run produced (b); it is a recomputation
  from the recorded answers.
- The gate cannot proceed on anything in this set, so its 0% false-accept rate measures nothing. **A gate that
  rejects everything has a perfect false-accept rate.**

**G_qa: uncalibratable as built, because the request carries the label.** This is the second headline result, not
a footnote. QA 248's five `G_qa` requests each carry the `E_t`'s own requirement statuses. Counted by this seat in
the `request` field of each record under `docs/loops/loop-15-slice-4-records/`:

| record | `status: met` in the request | `status: unmet` in the request |
|---|---|---|
| pr-195 | 28 | 0 |
| pr-209 | 14 | 0 |
| pr-218 | 5 | 0 |
| pr-220 | 5 | 2 |
| pr-227 | 13 | 3 |

Jev is shown the answer it is scored against, so no G_qa calibration was attempted. **G_plan: no case set.** Too
few plans have a known outcome.

### Why the done-gate rejects everything: two causes, and the second one is new

1. **The checks rule (rulings-1 item 3).** `--checks none` makes every record carry "no deterministic checks were
   supplied" (67 of 67). That is enough to reject on its own.
2. **Jev's answers sit below the thresholds.** This is why (b) is no better than (a).
   - `diff_matches_plan` ranged **0.17 to 0.71** over all 67 answers, and `diff_matches_plan_min` is 0.7. **0 of 36
     ACCEPT cases clear it, and 1 of 31 REJECT cases does.**
   - `local_tests_support_claim` ranged **0.37 to 0.67** against a minimum of 0.6. **2 of 36 ACCEPTs clear it, and 0 of
     31 REJECTs.**
   - Both are in the generated table "How many cases clear each applied threshold" below.
   - **So slice four's 8 of 8 rejects are not explained by the checks rule alone.** Rulings-1 item 3 said it explains
     "much, and perhaps all". On these 8 must-includes, (b) also rejects 8 of 8, with `diff_matches_plan` failing in
     all 8.

### Is the confidence meaningful? Barely

Confidence here is the **builder's operationalisation, not Jev's own probability.** It is the method of record under
rulings-2 call 3, fixed in `score.mjs` at the freeze:

- `p` is `noul` (or `1 - noul` for the out-of-scope and stuck questions, or `1 - score/2` for risk);
- stance is ACCEPT at `p >= 0.5`;
- confidence is `max(p, 1-p)`.

On the two driving questions, headline:

- **No answer reaches confidence 0.9**, so there are **no confident misses** on the driving questions, in any group.
- Fraction correct is **43.6%** in the <0.7 band (n 39) and **59.2%** in 0.7-0.9 (n 49).
- **Brier is 0.2708. A constant p = 0.5 scores 0.25, so on this set the driving answers are slightly worse than no
  information.**
- **Ranking power is weak.** `diff_matches_plan`'s AUC is 0.640 on the headline and 0.504 on the leak group.
  - Two of the five questions rank **backwards** on the headline: `touches_out_of_scope` at AUC 0.303, and
    `risk_of_regression` at 0.396.
  - On those questions, REJECTED candidates looked safer to Jev than ACCEPTED ones.

Over all five questions there **are** confident misses: 32 on the headline and 23 in the leak group, every one of
them on a REJECT case.

- They come only from `stuck_repeating_prior_failure` (`noul` about 0.05, so p about 0.95, for nearly every case) and
  `risk_of_regression` (low scores).
- Those two questions say "fine" almost regardless of the diff, so on this set their high confidence carries no
  information.
- Every one is listed below, generated from `scores.json`.

## Method

- **Base.** DISPATCH_SHA `ada4701a025cce33d742c5ff17715278377e5621`, the worktree's HEAD from
  `git -C C:/qa-scratch/qa252-wt log -1 --format=%H`.
  - `git merge-base --is-ancestor a26e44d0 HEAD` gave **exit 0**.
  - `git diff --quiet a26e44d0 HEAD -- docs/loops/jev-calibration-1/ open-brain/src/harness/policies/` gave exit 0:
    the set and the policy files are byte-identical to the freeze.
- **Freeze** `a26e44d0559b9ad855578d3297c3e61debaee71e`. **`MANIFEST.json` sha256
  `8169ac9b5576b40b9f54d397825453dd486e128eaac860cf529586cbb1bcdd67`**, checked before any call; it matched.
  - `score.mjs` sha256 is `916d8588…0341` in this tree and at `a26e44d0`, so it was **not edited**.
  - Its `--selftest` gave 8 of 8 ok.
- **Build.** `npm ci` (exit 0) and `npm run build` (exit 0, "build stamped ada4701") in
  `C:/qa-scratch/qa252-wt/open-brain`, from HEAD `ada4701a`.
- **Key.** `TYPESAFE_API_KEY` was read from `HKCU\Environment` into the runner process only.
  - Fingerprint, the first 10 hex of its sha256 uppercased: **`728B667EFF`, which matches**.
  - It was passed to each child process through its environment. It was never printed.
- **Calls.** One live `harness shadow-done` per runlist row, in runlist order and one at a time:
  `docs/loops/qa-252/run-calls.mjs`.
  - Each call had `--pr --merge-commit --scored-sha --base-sha --dt --checks none` from `runlist.json`, plus
    `--mode live --records docs/loops/jev-calibration-1/records`.
  - Each call also had `--ledger docs/loops/jev-calibration-1/records/attempts.jsonl`. Without that flag the CLI
    defaults to slice four's ledger, and the brief says slice four's ledger is not touched.
  - Before the live run, one zero-key dry run of row 1 went into `C:/qa-scratch/qa252-dry`, to check the
    arguments. It made no request.
- **Result of the calls.** **67 calls, 67 `answered`, 0 retries, 0 `auth`, 0 other outcomes.** Every record is
  `mode: live` and `sent: true`, answered by `jev-1.13.0`, under policy_hash `91ca0b03c069…` (the same as QA 248's).
  The calls ran from 07:26:50Z to 07:27:32Z.
- **Spend.** The summed usage is 185,764 input and 6,767 output tokens, 192,531 in all.
  - No per-token price is in the repo, so the runner priced every token at **$1e-6**. That is about 20 times the
    brief's "about $0.0001 per call", so the cap would trip early, never late.
  - At that price the run cost **$0.1925 against the $0.50 cap**. At the brief's own figure it is about $0.007.
- **`harness count-attempts`** over this set's ledger and records, with `--max 67`:
  - Output: attempts 67, retries 0, answered 67, incomplete 0; ledger lines 67, records 67; no VIOLATION.
    **Exit 0.**
  - `--max 67` is the number of rows. The default ceiling, 20, is slice four's budget (D-072). It was not changed:
    `--max` is a CLI flag, not a policy or threshold.
- **Score.** `node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-1/score.mjs --records
  docs/loops/jev-calibration-1/records --out docs/loops/jev-calibration-1/results` printed "scored 67 case(s); 0
  unscored".
  - The supplementary tables come from `docs/loops/qa-252/analysis.mjs`. It reads only the records, `labels.json`,
    `sample.json` and `scores.json`.
  - Both outputs are included below **verbatim, by `docs/loops/qa-252/assemble-report.mjs`**. No table in this
    report was typed.

## Findings beyond the brief's list

1. **`score.mjs` under-reports the checks rule as a driver.**
   - What it does: `drivers()` looks for the string "the deterministic checks".
   - What the gate records: under `--checks none`, the reason is "no deterministic checks were supplied".
   - The result: `drivers_a` counts the checks rule **once** (it matches the one `risk_of_regression … AND the
     deterministic checks failed` line), although it fired in **67 of 67** records.
   - The verdicts, rates and calibration are unaffected. Only the driver attribution in (a) is wrong.
   - `score.mjs` is frozen and was **not edited**. The reasons as recorded are tabulated in the generated "Reasons the
     gate recorded" table below.
2. **The done-gate's questions do not separate the classes on this set.** The fitted-cut table below shows it:
   - the two driving cuts that maximise balanced accuracy on the headline (`diff_matches_plan >= 0.37`,
     `local_tests_support_claim >= 0.43`) reach 0.682 on the headline;
   - the same cuts reach **0.388 on the leak group**, worse than chance, with a 92.3% false-accept rate there.
   - The leak group is not a held-out set, but the collapse is large.
   - **Lowering the thresholds would turn a gate that rejects everything into a gate that waves REJECTs through.**

## The leak-wording group against the headline

The leak group is 23 cases (10 ACCEPT / 13 REJECT) whose `D_t` carries verdict wording.

- The gate decisions are the same: (a) and (b) reject all 23.
- **Seeing verdict wording did not help Jev, and if anything it hurt.**

| measure | headline | leak group |
|---|---|---|
| driving-question Brier | 0.2708 | 0.3096 |
| all-question Brier | 0.3143 | 0.3913 |
| `diff_matches_plan` AUC | 0.640 | 0.504 |
| `local_tests_support_claim` AUC | 0.637 | 0.296 |

The detector is broad: "don't accept it" counts as a hit, per the handoff. So this measures "text with those words",
not "text that states the verdict".

## The source_kind split

- 62 `qa-dispatch` cases and 5 `dev-dispatch` cases (2 ACCEPT / 3 REJECT). All of them were rejected under (a) and
  (b).
- The driving-question Brier is 0.2799 for qa-dispatch and 0.3359 for dev-dispatch.
- Five cases are too few to read anything into. The split is generated below, so a reader can drop the five.

## Recommendation

**Do not trust the done-gate as-is, and do not change its thresholds on this evidence. Keep it in shadow, and put
every candidate in front of human review (QA, as now). On this set there is no confidence level above which Jev can
be trusted.**

- **As built it cannot pass anything.** `diff_matches_plan_min` 0.7 sits at the top of Jev's whole answer range:
  0 of 36 ACCEPTs clear it.
- **Thresholds fitted to this set** (`diff_matches_plan >= 0.37`, `local_tests_support_claim >= 0.43`).
  - **These values are fitted to this set; they need a held-out set before anyone relies on them.**
  - They give balanced accuracy 0.682 where they were fitted, and 0.388 on the leak group.
  - That is not a threshold to adopt. It is evidence that the questions as answered do not separate ACCEPT from
    REJECT.
- **Human review below a stated confidence** reduces to human review of everything.
  - No driving answer reached confidence 0.9.
  - Fraction correct is 43.6% in the <0.7 band and 59.2% in 0.7-0.9 (headline).
  - The non-driving questions do reach 0.9, but every confident miss is theirs.
- **What would make a next calibration informative:**
  - a run with real checks, where the evidence exists, so (a) differs from (b);
  - a G_qa request with the statuses stripped, so G_qa can be calibrated;
  - a held-out set for any threshold.
  - The measurement this brief asked for is done; the instrument is what failed it.

## Limitations

- **The exclusion tags were checked by detector only (rulings-2 call 5).** `environmental`, `unrelated-test` and
  `superseded-unruled` were defined and applied to no case. No human read of each report was done. A case that should
  carry one of them is scored.
- **Per-question confidence is the builder's operationalisation (rulings-2 call 3), not Jev's own probability.** The
  `noul` answers carry no confidence field, so `p` and `max(p, 1-p)` are a mapping the builder chose and the planner
  accepted. A different mapping would give different bands. It would not change the decisions, the AUCs or the
  threshold-clearance counts.
- **The headline N is 44, under the brief's 50, and ACCEPT-heavy at 26/18.** That is why the per-class rates and the
  balanced accuracy are reported. Any single AUC or cut on 44 cases has a wide interval.
- **Every case ran with `--checks none`.** (a) is therefore the gate with one rule that cannot be met here.
- **The leak-wording detector is broad**, and the leak group was never meant to be a held-out set.
- **One call per case.** Run-to-run variation in Jev's answers was not measured; the brief forbids re-asking.

## Key scan

Run as QA 248's was, with `docs/loops/qa-252/key-scan.mjs`, an adaptation of `docs/loops/qa-248/key-scan.mjs`.
Only the categories are this job's, and the key is read from `HKCU\Environment`.

- It scanned every file the report commit carries, the captured logs, the dry-run record, and **this session's
  transcript, `C:/Users/Aaron/.claude/projects/C--Users-Aaron-Worktrees-sia-qa/09887ee1-76d1-41ea-9b1a-1f72a7dc0e15.jsonl`**.
  The transcript is identified by session id and by a marker only it holds.
- The full output is `docs/loops/qa-252/key-scan.out`.

<!-- include: key-scan-summary -->

## Files in this commit

- `docs/loops/jev-calibration-1/records/`: 67 `G_done` records and `attempts.jsonl`.
- `docs/loops/jev-calibration-1/results/`: `scores.json` and `scores.md` (from `score.mjs`), and `qa252-analysis.md`.
- `docs/loops/qa-252/`:
  - `run-calls.mjs` and `analysis.mjs`;
  - `key-scan.mjs` and `key-scan.out`;
  - `assemble-report.mjs` and `report-template.md`.
- This report.

## Generated: score.mjs output (`results/scores.md`, verbatim)

<!-- include: jev-calibration-1/results/scores.md -->

## Generated: supplementary tables (`results/qa252-analysis.md`, verbatim)

<!-- include: jev-calibration-1/results/qa252-analysis.md -->

QA-252: REPORT COMPLETE
