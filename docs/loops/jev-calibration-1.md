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

```
$ node docs/loops/qa-252/key-scan.mjs --session 09887ee1-76d1-41ea-9b1a-1f72a7dc0e15 --marker <this session's nonce>   (pass 4, exit 0)
known positive: 1 hit(s) on a temp file (expected 1); temp file deleted: true
transcript: session 09887ee1-76d1-41ea-9b1a-1f72a7dc0e15; expected C:/Users/Aaron/.claude/projects/C--Users-Aaron-Worktrees-sia-qa/09887ee1-76d1-41ea-9b1a-1f72a7dc0e15.jsonl; exists true
transcript: .jsonl files under C:/Users/Aaron/.claude/projects holding the marker: 1 (C:/Users/Aaron/.claude/projects/C--Users-Aaron-Worktrees-sia-qa/09887ee1-76d1-41ea-9b1a-1f72a7dc0e15.jsonl)
transcript: the one marked file is the session's own: true
every file the report commit carries (records, attempts ledger, results, report, QA 252 scripts): files scanned 78, matches 0
the run's captured stdout and stderr (npm ci, build, every live call, count-attempts, score): files scanned 215, matches 0
the dry-run record: files scanned 1, matches 0
this session's transcript (.jsonl): files scanned 1, matches 0
key-scan: total matches 0; every category scanned at least one file: true; PASS
```

## Files in this commit

- `docs/loops/jev-calibration-1/records/`: 67 `G_done` records and `attempts.jsonl`.
- `docs/loops/jev-calibration-1/results/`: `scores.json` and `scores.md` (from `score.mjs`), and `qa252-analysis.md`.
- `docs/loops/qa-252/`:
  - `run-calls.mjs` and `analysis.mjs`;
  - `key-scan.mjs` and `key-scan.out`;
  - `assemble-report.mjs` and `report-template.md`.
- This report.

## Generated: score.mjs output (`results/scores.md`, verbatim)

### Jev calibration 1: scores (generated by score.mjs; do not hand-edit)

> (a) is the gate as built. (b) is a COUNTERFACTUAL: the same policy recomputed from the recorded answers with checksPassed true. Neither changes a policy file.

#### Headline set (N = 44)

| decision | n | accuracy | balanced accuracy | proceed on ACCEPT | reject on REJECT | false-accept rate | false-reject rate | TP (A,proceed) | FR (A,reject) | FA (R,proceed) | TR (R,reject) |
|---|---|---|---|---|---|---|---|---|---|---|
| (a) gate as built | 44 | 40.9% | 50.0% | 0.0% | 100.0% | 0.0% | 100.0% | 0 | 26 | 0 | 18 |
| (b) Jev alone, COUNTERFACTUAL | 44 | 40.9% | 50.0% | 0.0% | 100.0% | 0.0% | 100.0% | 0 | 26 | 0 | 18 |

Calibration, driving questions (N = 88, Brier = 0.2708):

| band | n | fraction correct |
|---|---|---|
| <0.7 | 39 | 43.6% |
| 0.7-0.9 | 49 | 59.2% |
| >=0.9 | 0 | n/a |

Confident misses (confidence >= 0.9 and wrong): none

Calibration, all questions (N = 220, Brier = 0.3143):

| band | n | fraction correct |
|---|---|---|
| <0.7 | 94 | 44.7% |
| 0.7-0.9 | 56 | 58.9% |
| >=0.9 | 70 | 54.3% |

Drivers of a reject, (a): {"diff_matches_plan":43,"local_tests_support_claim":42,"touches_out_of_scope":3,"risk_of_regression":1,"the deterministic checks":1}; (b): {"diff_matches_plan":43,"local_tests_support_claim":42,"touches_out_of_scope":3}

#### Leak-wording group (N = 23)

| decision | n | accuracy | balanced accuracy | proceed on ACCEPT | reject on REJECT | false-accept rate | false-reject rate | TP (A,proceed) | FR (A,reject) | FA (R,proceed) | TR (R,reject) |
|---|---|---|---|---|---|---|---|---|---|---|
| (a) gate as built | 23 | 56.5% | 50.0% | 0.0% | 100.0% | 0.0% | 100.0% | 0 | 10 | 0 | 13 |
| (b) Jev alone, COUNTERFACTUAL | 23 | 56.5% | 50.0% | 0.0% | 100.0% | 0.0% | 100.0% | 0 | 10 | 0 | 13 |

Calibration, driving questions (N = 46, Brier = 0.3096):

| band | n | fraction correct |
|---|---|---|
| <0.7 | 22 | 45.5% |
| 0.7-0.9 | 24 | 41.7% |
| >=0.9 | 0 | n/a |

Confident misses (confidence >= 0.9 and wrong): none

Calibration, all questions (N = 115, Brier = 0.3913):

| band | n | fraction correct |
|---|---|---|
| <0.7 | 48 | 35.4% |
| 0.7-0.9 | 29 | 37.9% |
| >=0.9 | 38 | 39.5% |

Drivers of a reject, (a): {"diff_matches_plan":23,"local_tests_support_claim":23,"stuck_repeating_prior_failure":2}; (b): {"diff_matches_plan":23,"local_tests_support_claim":23,"stuck_repeating_prior_failure":2}

#### Slice-four must-includes (N = 8)

| decision | n | accuracy | balanced accuracy | proceed on ACCEPT | reject on REJECT | false-accept rate | false-reject rate | TP (A,proceed) | FR (A,reject) | FA (R,proceed) | TR (R,reject) |
|---|---|---|---|---|---|---|---|---|---|---|
| (a) gate as built | 8 | 0.0% | n/a | 0.0% | n/a | n/a | 100.0% | 0 | 8 | 0 | 0 |
| (b) Jev alone, COUNTERFACTUAL | 8 | 0.0% | n/a | 0.0% | n/a | n/a | 100.0% | 0 | 8 | 0 | 0 |

Calibration, driving questions (N = 16, Brier = 0.2053):

| band | n | fraction correct |
|---|---|---|
| <0.7 | 7 | 14.3% |
| 0.7-0.9 | 9 | 88.9% |
| >=0.9 | 0 | n/a |

Confident misses (confidence >= 0.9 and wrong): none

Calibration, all questions (N = 40, Brier = 0.161):

| band | n | fraction correct |
|---|---|---|
| <0.7 | 16 | 18.8% |
| 0.7-0.9 | 11 | 81.8% |
| >=0.9 | 13 | 100.0% |

Drivers of a reject, (a): {"diff_matches_plan":8,"local_tests_support_claim":7,"stuck_repeating_prior_failure":2}; (b): {"diff_matches_plan":8,"local_tests_support_claim":7,"stuck_repeating_prior_failure":2}

#### All scored (N = 67)

| decision | n | accuracy | balanced accuracy | proceed on ACCEPT | reject on REJECT | false-accept rate | false-reject rate | TP (A,proceed) | FR (A,reject) | FA (R,proceed) | TR (R,reject) |
|---|---|---|---|---|---|---|---|---|---|---|
| (a) gate as built | 67 | 46.3% | 50.0% | 0.0% | 100.0% | 0.0% | 100.0% | 0 | 36 | 0 | 31 |
| (b) Jev alone, COUNTERFACTUAL | 67 | 46.3% | 50.0% | 0.0% | 100.0% | 0.0% | 100.0% | 0 | 36 | 0 | 31 |

Calibration, driving questions (N = 134, Brier = 0.2841):

| band | n | fraction correct |
|---|---|---|
| <0.7 | 61 | 44.3% |
| 0.7-0.9 | 73 | 53.4% |
| >=0.9 | 0 | n/a |

Confident misses (confidence >= 0.9 and wrong): none

Calibration, all questions (N = 335, Brier = 0.3407):

| band | n | fraction correct |
|---|---|---|
| <0.7 | 142 | 41.5% |
| 0.7-0.9 | 85 | 51.8% |
| >=0.9 | 108 | 49.1% |

Drivers of a reject, (a): {"diff_matches_plan":66,"local_tests_support_claim":65,"touches_out_of_scope":3,"risk_of_regression":1,"the deterministic checks":1,"stuck_repeating_prior_failure":2}; (b): {"diff_matches_plan":66,"local_tests_support_claim":65,"touches_out_of_scope":3,"stuck_repeating_prior_failure":2}

#### Source kind: dev-dispatch (N = 5)

| decision | n | accuracy | balanced accuracy | proceed on ACCEPT | reject on REJECT | false-accept rate | false-reject rate | TP (A,proceed) | FR (A,reject) | FA (R,proceed) | TR (R,reject) |
|---|---|---|---|---|---|---|---|---|---|---|
| (a) gate as built | 5 | 60.0% | 50.0% | 0.0% | 100.0% | 0.0% | 100.0% | 0 | 2 | 0 | 3 |
| (b) Jev alone, COUNTERFACTUAL | 5 | 60.0% | 50.0% | 0.0% | 100.0% | 0.0% | 100.0% | 0 | 2 | 0 | 3 |

Calibration, driving questions (N = 10, Brier = 0.3359):

| band | n | fraction correct |
|---|---|---|
| <0.7 | 6 | 33.3% |
| 0.7-0.9 | 4 | 25.0% |
| >=0.9 | 0 | n/a |

Confident misses (confidence >= 0.9 and wrong): none

Calibration, all questions (N = 25, Brier = 0.4049):

| band | n | fraction correct |
|---|---|---|
| <0.7 | 11 | 36.4% |
| 0.7-0.9 | 4 | 25.0% |
| >=0.9 | 10 | 40.0% |

Drivers of a reject, (a): {"diff_matches_plan":5,"touches_out_of_scope":1,"local_tests_support_claim":5}; (b): {"diff_matches_plan":5,"touches_out_of_scope":1,"local_tests_support_claim":5}

#### Source kind: qa-dispatch (N = 62)

| decision | n | accuracy | balanced accuracy | proceed on ACCEPT | reject on REJECT | false-accept rate | false-reject rate | TP (A,proceed) | FR (A,reject) | FA (R,proceed) | TR (R,reject) |
|---|---|---|---|---|---|---|---|---|---|---|
| (a) gate as built | 62 | 45.2% | 50.0% | 0.0% | 100.0% | 0.0% | 100.0% | 0 | 34 | 0 | 28 |
| (b) Jev alone, COUNTERFACTUAL | 62 | 45.2% | 50.0% | 0.0% | 100.0% | 0.0% | 100.0% | 0 | 34 | 0 | 28 |

Calibration, driving questions (N = 124, Brier = 0.2799):

| band | n | fraction correct |
|---|---|---|
| <0.7 | 55 | 45.5% |
| 0.7-0.9 | 69 | 55.1% |
| >=0.9 | 0 | n/a |

Confident misses (confidence >= 0.9 and wrong): none

Calibration, all questions (N = 310, Brier = 0.3355):

| band | n | fraction correct |
|---|---|---|
| <0.7 | 131 | 42.0% |
| 0.7-0.9 | 81 | 53.1% |
| >=0.9 | 98 | 50.0% |

Drivers of a reject, (a): {"diff_matches_plan":61,"local_tests_support_claim":60,"touches_out_of_scope":2,"risk_of_regression":1,"the deterministic checks":1,"stuck_repeating_prior_failure":2}; (b): {"diff_matches_plan":61,"local_tests_support_claim":60,"touches_out_of_scope":2,"stuck_repeating_prior_failure":2}

Spend (summed usage): 185764 input tokens, 6767 output tokens.

## Generated: supplementary tables (`results/qa252-analysis.md`, verbatim)

### Jev calibration 1: supplementary tables (generated by docs/loops/qa-252/analysis.mjs; do not hand-edit)

p = P(diff acceptable) per question, as score.mjs defines it. AUC: the chance a random ACCEPT case gets a higher p than a
random REJECT case (0.5 = no ranking power). The best cut is the p threshold (proceed at p >= cut) that maximises
balanced accuracy for that one question ON THIS SET: **fitted to this set; needs a held-out set**.

#### Headline (N = 44: 26 ACCEPT, 18 REJECT)

| question | raw field | mean raw, ACCEPT | mean raw, REJECT | min-max raw, all | AUC | best cut on p (fitted) | balanced acc. at cut | ACCEPT proceed / REJECT reject at cut |
|---|---|---|---|---|---|---|---|---|
| diff_matches_plan | noul | 0.461 | 0.403 | 0.170-0.710 | 0.640 | 0.370 | 0.712 | 0.923 / 0.500 |
| touches_out_of_scope | noul | 0.261 | 0.226 | 0.170-0.440 | 0.303 | 0.830 | 0.519 | 0.038 / 1.000 |
| local_tests_support_claim | noul | 0.490 | 0.459 | 0.370-0.670 | 0.637 | 0.430 | 0.639 | 1.000 / 0.278 |
| stuck_repeating_prior_failure | noul | 0.048 | 0.046 | 0.040-0.070 | 0.396 | 0.950 | 0.536 | 0.962 / 0.111 |
| risk_of_regression | score | 0.567 | 0.265 | 0.010-1.650 | 0.396 | 0.980 | 0.596 | 0.192 / 1.000 |

#### Leak-wording group (N = 23: 10 ACCEPT, 13 REJECT)

| question | raw field | mean raw, ACCEPT | mean raw, REJECT | min-max raw, all | AUC | best cut on p (fitted) | balanced acc. at cut | ACCEPT proceed / REJECT reject at cut |
|---|---|---|---|---|---|---|---|---|
| diff_matches_plan | noul | 0.456 | 0.475 | 0.260-0.640 | 0.504 | 0.470 | 0.608 | 0.600 / 0.615 |
| touches_out_of_scope | noul | 0.242 | 0.237 | 0.190-0.290 | 0.438 | 0.780 | 0.585 | 0.400 / 0.769 |
| local_tests_support_claim | noul | 0.475 | 0.507 | 0.430-0.560 | 0.296 | 0.430 | 0.500 | 1.000 / 0.000 |
| stuck_repeating_prior_failure | noul | 0.178 | 0.053 | 0.040-0.740 | 0.435 | 0.950 | 0.542 | 0.700 / 0.385 |
| risk_of_regression | score | 0.372 | 0.149 | 0.050-1.310 | 0.412 | 0.940 | 0.546 | 0.400 / 0.692 |

#### All scored (N = 67: 36 ACCEPT, 31 REJECT)

| question | raw field | mean raw, ACCEPT | mean raw, REJECT | min-max raw, all | AUC | best cut on p (fitted) | balanced acc. at cut | ACCEPT proceed / REJECT reject at cut |
|---|---|---|---|---|---|---|---|---|
| diff_matches_plan | noul | 0.460 | 0.433 | 0.170-0.710 | 0.575 | 0.370 | 0.620 | 0.917 / 0.323 |
| touches_out_of_scope | noul | 0.256 | 0.231 | 0.170-0.440 | 0.345 | 0.830 | 0.514 | 0.028 / 1.000 |
| local_tests_support_claim | noul | 0.486 | 0.479 | 0.370-0.670 | 0.509 | 0.430 | 0.581 | 1.000 / 0.161 |
| stuck_repeating_prior_failure | noul | 0.084 | 0.049 | 0.040-0.740 | 0.453 | 0.950 | 0.557 | 0.889 / 0.226 |
| risk_of_regression | score | 0.513 | 0.216 | 0.010-1.650 | 0.389 | 0.980 | 0.569 | 0.139 / 1.000 |

#### How many cases clear each applied threshold (all scored, N = 67)

Applied (from the records, policy_hash 91ca0b03c069): {"diff_matches_plan_min":0.7,"touches_out_of_scope_max":0.3,"local_tests_support_claim_min":0.6,"stuck_repeating_prior_failure_max":0.6,"risk_of_regression_rollback_at_or_above":1.5,"hand_to_qa_requires_green_checks":true}

| rule | ACCEPT cases clearing it | REJECT cases clearing it |
|---|---|---|
| diff_matches_plan >= 0.7 | 0 of 36 | 1 of 31 |
| touches_out_of_scope <= 0.3 | 33 of 36 | 31 of 31 |
| local_tests_support_claim >= 0.6 | 2 of 36 | 0 of 31 |
| stuck_repeating_prior_failure <= 0.6 | 34 of 36 | 31 of 31 |
| risk_of_regression < 1.5 | 35 of 36 | 31 of 31 |

#### A combined gate at cuts fitted on the headline (FITTED TO THIS SET; NEEDS A HELD-OUT SET)

diff_matches_plan >= 0.37 and local_tests_support_claim >= 0.43 (both fitted on the headline), other rules as applied, checks set aside.

| group | n | ACCEPT proceed | REJECT reject | balanced accuracy | false-accept rate |
|---|---|---|---|---|---|
| Headline (fitted here) | 44 | 21 of 26 | 10 of 18 | 0.682 | 0.444 |
| Leak-wording group (not held out) | 23 | 7 of 10 | 1 of 13 | 0.388 | 0.923 |
| All scored | 67 | 28 of 36 | 11 of 31 | 0.566 | 0.645 |

#### Confident misses over all five questions, headline (from scores.json): 32

By question: {"stuck_repeating_prior_failure":18,"risk_of_regression":14}

| case | question | p | said | label |
|---|---|---|---|---|
| bootstrap-fix | stuck_repeating_prior_failure | 0.94 | ACCEPT | REJECT |
| bootstrap-fix | risk_of_regression | 0.925 | ACCEPT | REJECT |
| loop-15-slice-4-step2 | stuck_repeating_prior_failure | 0.96 | ACCEPT | REJECT |
| loop-15-slice-4-step2 | risk_of_regression | 0.945 | ACCEPT | REJECT |
| qa-driver-cursor-r2 | stuck_repeating_prior_failure | 0.95 | ACCEPT | REJECT |
| qa-driver-cursor-r3 | stuck_repeating_prior_failure | 0.94 | ACCEPT | REJECT |
| qa-driver-cursor-r3 | risk_of_regression | 0.95 | ACCEPT | REJECT |
| qa-driver-cursor-r5 | stuck_repeating_prior_failure | 0.95 | ACCEPT | REJECT |
| s3-a10 | stuck_repeating_prior_failure | 0.95 | ACCEPT | REJECT |
| s3-a10 | risk_of_regression | 0.9 | ACCEPT | REJECT |
| s3-a4 | stuck_repeating_prior_failure | 0.95 | ACCEPT | REJECT |
| s3-a4 | risk_of_regression | 0.935 | ACCEPT | REJECT |
| s3-a5 | stuck_repeating_prior_failure | 0.95 | ACCEPT | REJECT |
| s3-a5 | risk_of_regression | 0.905 | ACCEPT | REJECT |
| s3-a6 | stuck_repeating_prior_failure | 0.96 | ACCEPT | REJECT |
| s3-a6 | risk_of_regression | 0.905 | ACCEPT | REJECT |
| s3-a7 | stuck_repeating_prior_failure | 0.96 | ACCEPT | REJECT |
| s3-a9 | stuck_repeating_prior_failure | 0.96 | ACCEPT | REJECT |
| s3-a9 | risk_of_regression | 0.905 | ACCEPT | REJECT |
| s3-c | stuck_repeating_prior_failure | 0.95 | ACCEPT | REJECT |
| s3-c | risk_of_regression | 0.945 | ACCEPT | REJECT |
| s3-c-r2 | stuck_repeating_prior_failure | 0.95 | ACCEPT | REJECT |
| s3-c-r2 | risk_of_regression | 0.94 | ACCEPT | REJECT |
| t194-r2 | stuck_repeating_prior_failure | 0.96 | ACCEPT | REJECT |
| t194-r2 | risk_of_regression | 0.97 | ACCEPT | REJECT |
| t194-r5 | stuck_repeating_prior_failure | 0.96 | ACCEPT | REJECT |
| t194-r5 | risk_of_regression | 0.955 | ACCEPT | REJECT |
| t195 | stuck_repeating_prior_failure | 0.96 | ACCEPT | REJECT |
| t196-t197 | stuck_repeating_prior_failure | 0.96 | ACCEPT | REJECT |
| t196-t197 | risk_of_regression | 0.975 | ACCEPT | REJECT |
| t198 | stuck_repeating_prior_failure | 0.96 | ACCEPT | REJECT |
| t198 | risk_of_regression | 0.965 | ACCEPT | REJECT |

#### Confident misses over all five questions, leak_group (from scores.json): 23

By question: {"stuck_repeating_prior_failure":13,"risk_of_regression":10}

| case | question | p | said | label |
|---|---|---|---|---|
| cal-a12-composer | stuck_repeating_prior_failure | 0.96 | ACCEPT | REJECT |
| cal-a12-composer | risk_of_regression | 0.9299999999999999 | ACCEPT | REJECT |
| loop-15-slice-4-step2-r2 | stuck_repeating_prior_failure | 0.94 | ACCEPT | REJECT |
| loop-15-slice-4-step2-r2 | risk_of_regression | 0.975 | ACCEPT | REJECT |
| loop-15-slice-4-step2-r3 | stuck_repeating_prior_failure | 0.95 | ACCEPT | REJECT |
| loop-15-slice-4-step2-r3 | risk_of_regression | 0.975 | ACCEPT | REJECT |
| s3-a11 | stuck_repeating_prior_failure | 0.95 | ACCEPT | REJECT |
| s3-a12 | stuck_repeating_prior_failure | 0.95 | ACCEPT | REJECT |
| s3-a12 | risk_of_regression | 0.95 | ACCEPT | REJECT |
| s3-a8 | stuck_repeating_prior_failure | 0.96 | ACCEPT | REJECT |
| s3-a8 | risk_of_regression | 0.935 | ACCEPT | REJECT |
| t158 | stuck_repeating_prior_failure | 0.95 | ACCEPT | REJECT |
| t158 | risk_of_regression | 0.915 | ACCEPT | REJECT |
| t164-t211 | stuck_repeating_prior_failure | 0.95 | ACCEPT | REJECT |
| t164-t211 | risk_of_regression | 0.95 | ACCEPT | REJECT |
| t179 | stuck_repeating_prior_failure | 0.95 | ACCEPT | REJECT |
| t194-r3 | stuck_repeating_prior_failure | 0.94 | ACCEPT | REJECT |
| t194-r4 | stuck_repeating_prior_failure | 0.94 | ACCEPT | REJECT |
| t194-r4 | risk_of_regression | 0.935 | ACCEPT | REJECT |
| t194-r6 | stuck_repeating_prior_failure | 0.94 | ACCEPT | REJECT |
| t194-r6 | risk_of_regression | 0.915 | ACCEPT | REJECT |
| t194-r7 | stuck_repeating_prior_failure | 0.9299999999999999 | ACCEPT | REJECT |
| t194-r7 | risk_of_regression | 0.935 | ACCEPT | REJECT |

#### Reasons the gate recorded (all scored; numbers replaced by #)

| reason | records |
|---|---|
| no deterministic checks were supplied | 67 |
| diff_matches_plan # is below the required # | 66 |
| local_tests_support_claim # is below the required # | 65 |
| touches_out_of_scope # is above the permitted # | 3 |
| stuck_repeating_prior_failure # is above the permitted # — roll back rather than retry the same failure | 2 |
| risk_of_regression # is at or above # AND the deterministic checks failed — the score alone would not be enough | 1 |

#### Per case (all scored)

| case | group | label | diff_matches_plan | touches_out_of_scope | local_tests_support_claim | stuck_repeating_prior_failure | risk_of_regression | tokens |
|---|---|---|---|---|---|---|---|---|
| bootstrap-fix-r4 | headline | ACCEPT | 0.46 | 0.25 | 0.51 | 0.07 | 0.26 | 2693 |
| importer-leftovers | headline | ACCEPT | 0.41 | 0.31 | 0.44 | 0.05 | 0.15 | 4572 |
| importer-leftovers-r6 | headline | ACCEPT | 0.4 | 0.27 | 0.46 | 0.05 | 1.24 | 1560 |
| loop-15-slice-3 | headline | ACCEPT | 0.4 | 0.42 | 0.48 | 0.04 | 0.03 | 1781 |
| loop-15-slice-4-step2-r4 | headline | ACCEPT | 0.47 | 0.24 | 0.45 | 0.05 | 0.04 | 1995 |
| qa-probes-on-master | headline | ACCEPT | 0.48 | 0.3 | 0.48 | 0.05 | 1.13 | 1995 |
| s3-a13 | headline | ACCEPT | 0.33 | 0.25 | 0.44 | 0.05 | 0.18 | 2186 |
| s3-b-step1 | headline | ACCEPT | 0.64 | 0.18 | 0.54 | 0.04 | 0.06 | 3948 |
| s3-c-r3 | headline | ACCEPT | 0.45 | 0.23 | 0.48 | 0.05 | 0.16 | 1544 |
| s3-c-r4 | headline | ACCEPT | 0.18 | 0.23 | 0.61 | 0.04 | 0.04 | 1706 |
| t003-r2 | headline | ACCEPT | 0.48 | 0.25 | 0.52 | 0.05 | 0.11 | 2538 |
| t046-d1 | headline | ACCEPT | 0.45 | 0.25 | 0.47 | 0.05 | 1.19 | 1540 |
| t046-detector | headline | ACCEPT | 0.47 | 0.23 | 0.43 | 0.05 | 1.2 | 1883 |
| t048-r1b | headline | ACCEPT | 0.37 | 0.23 | 0.44 | 0.05 | 1.39 | 1788 |
| t048-r2 | headline | ACCEPT | 0.38 | 0.44 | 0.46 | 0.05 | 1.65 | 3482 |
| t048-r3 | headline | ACCEPT | 0.53 | 0.29 | 0.47 | 0.04 | 1.31 | 1796 |
| t171 | headline | ACCEPT | 0.54 | 0.3 | 0.53 | 0.05 | 0.28 | 3679 |
| t171-r2 | headline | ACCEPT | 0.37 | 0.23 | 0.5 | 0.05 | 0.23 | 1910 |
| t176-index-direction | headline | ACCEPT | 0.45 | 0.27 | 0.45 | 0.05 | 1.25 | 1582 |
| t178-ci-on-push | headline | ACCEPT | 0.62 | 0.24 | 0.49 | 0.05 | 0.3 | 1893 |
| t192 | headline | ACCEPT | 0.49 | 0.27 | 0.47 | 0.05 | 1.05 | 1859 |
| t192-d1 | headline | ACCEPT | 0.48 | 0.27 | 0.48 | 0.05 | 1.17 | 1703 |
| t198-r2 | headline | ACCEPT | 0.37 | 0.22 | 0.43 | 0.05 | 0.1 | 2092 |
| t214 | headline | ACCEPT | 0.52 | 0.23 | 0.52 | 0.05 | 0.17 | 2886 |
| t217-t218 | headline | ACCEPT | 0.67 | 0.21 | 0.52 | 0.04 | 0.01 | 2020 |
| t221-t222 | headline | ACCEPT | 0.58 | 0.17 | 0.67 | 0.04 | 0.03 | 3279 |
| bootstrap-fix | headline | REJECT | 0.62 | 0.3 | 0.52 | 0.06 | 0.15 | 3627 |
| loop-15-slice-4-step2 | headline | REJECT | 0.56 | 0.25 | 0.51 | 0.04 | 0.11 | 5686 |
| qa-driver-cursor-r2 | headline | REJECT | 0.25 | 0.29 | 0.37 | 0.05 | 1.04 | 1966 |
| qa-driver-cursor-r3 | headline | REJECT | 0.18 | 0.2 | 0.37 | 0.06 | 0.1 | 1678 |
| qa-driver-cursor-r5 | headline | REJECT | 0.17 | 0.24 | 0.39 | 0.05 | 0.39 | 2100 |
| s3-a10 | headline | REJECT | 0.42 | 0.21 | 0.56 | 0.05 | 0.2 | 3249 |
| s3-a4 | headline | REJECT | 0.27 | 0.25 | 0.42 | 0.05 | 0.13 | 3349 |
| s3-a5 | headline | REJECT | 0.27 | 0.19 | 0.47 | 0.05 | 0.19 | 4251 |
| s3-a6 | headline | REJECT | 0.33 | 0.21 | 0.44 | 0.04 | 0.19 | 3296 |
| s3-a7 | headline | REJECT | 0.47 | 0.2 | 0.53 | 0.04 | 0.25 | 2833 |
| s3-a9 | headline | REJECT | 0.45 | 0.2 | 0.45 | 0.04 | 0.19 | 3798 |
| s3-c | headline | REJECT | 0.42 | 0.24 | 0.42 | 0.05 | 0.11 | 1600 |
| s3-c-r2 | headline | REJECT | 0.33 | 0.21 | 0.46 | 0.05 | 0.12 | 1500 |
| t194-r2 | headline | REJECT | 0.27 | 0.25 | 0.49 | 0.04 | 0.06 | 2100 |
| t194-r5 | headline | REJECT | 0.6 | 0.25 | 0.49 | 0.04 | 0.09 | 4921 |
| t195 | headline | REJECT | 0.36 | 0.21 | 0.44 | 0.04 | 1.33 | 1993 |
| t196-t197 | headline | REJECT | 0.71 | 0.18 | 0.49 | 0.04 | 0.05 | 2929 |
| t198 | headline | REJECT | 0.57 | 0.19 | 0.44 | 0.04 | 0.07 | 2510 |
| bootstrap-fix-r3 | leak_group | ACCEPT | 0.6 | 0.22 | 0.52 | 0.05 | 0.09 | 4566 |
| importer-fixes-r4 | leak_group | ACCEPT | 0.26 | 0.27 | 0.43 | 0.05 | 0.17 | 3607 |
| s3-b2 | leak_group | ACCEPT | 0.39 | 0.26 | 0.45 | 0.05 | 0.26 | 1867 |
| t048-r2b | leak_group | ACCEPT | 0.49 | 0.27 | 0.48 | 0.05 | 1.31 | 1746 |
| t158-r2 | leak_group | ACCEPT | 0.47 | 0.22 | 0.45 | 0.07 | 0.14 | 2389 |
| t171-r3 | leak_group | ACCEPT | 0.43 | 0.29 | 0.46 | 0.05 | 1.25 | 1736 |
| t179-r2 | leak_group | ACCEPT | 0.47 | 0.25 | 0.49 | 0.05 | 0.2 | 3172 |
| t195-r2 | leak_group | ACCEPT | 0.43 | 0.19 | 0.48 | 0.62 | 0.12 | 2691 |
| t196-t197-r2 | leak_group | ACCEPT | 0.48 | 0.2 | 0.46 | 0.74 | 0.06 | 2872 |
| t216 | leak_group | ACCEPT | 0.54 | 0.25 | 0.53 | 0.05 | 0.12 | 2772 |
| cal-a12-composer | leak_group | REJECT | 0.38 | 0.25 | 0.47 | 0.04 | 0.14 | 3811 |
| loop-15-slice-4-step2-r2 | leak_group | REJECT | 0.51 | 0.21 | 0.47 | 0.06 | 0.05 | 3694 |
| loop-15-slice-4-step2-r3 | leak_group | REJECT | 0.42 | 0.26 | 0.45 | 0.05 | 0.05 | 3078 |
| s3-a11 | leak_group | REJECT | 0.45 | 0.23 | 0.51 | 0.05 | 0.24 | 2295 |
| s3-a12 | leak_group | REJECT | 0.35 | 0.28 | 0.46 | 0.05 | 0.1 | 3847 |
| s3-a8 | leak_group | REJECT | 0.41 | 0.2 | 0.56 | 0.04 | 0.13 | 3206 |
| t158 | leak_group | REJECT | 0.54 | 0.22 | 0.5 | 0.05 | 0.17 | 2171 |
| t164-t211 | leak_group | REJECT | 0.43 | 0.23 | 0.55 | 0.05 | 0.1 | 2742 |
| t179 | leak_group | REJECT | 0.64 | 0.24 | 0.56 | 0.05 | 0.24 | 4417 |
| t194-r3 | leak_group | REJECT | 0.56 | 0.23 | 0.54 | 0.06 | 0.29 | 2974 |
| t194-r4 | leak_group | REJECT | 0.62 | 0.25 | 0.56 | 0.06 | 0.13 | 3438 |
| t194-r6 | leak_group | REJECT | 0.42 | 0.25 | 0.44 | 0.06 | 0.17 | 7654 |
| t194-r7 | leak_group | REJECT | 0.45 | 0.23 | 0.52 | 0.07 | 0.13 | 8490 |

QA-252: REPORT COMPLETE
