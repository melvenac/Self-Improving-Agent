# Slice four: threshold tables, generated from the gate records

Records read: 13 live answered record(s).

### 4.3 developer done-gate (developer-done.json) — PROVISIONAL (N=8 seat-built, 0 runtime)

N = 8. all records report jev-1.13.0; every one is at or above jev-1.13.0.

| PR | scored SHA | model_resolved |
| --- | --- | --- |
| 165 | 285a8b2e98895bd189e1068135f38a0c899fccfa | jev-1.13.0 |
| 182 | 0d44374e7b1bcaa768c92ac21cd5566e743edf4b | jev-1.13.0 |
| 187 | c1eda2f6fb6e75020d2f7f517d72b33b29026452 | jev-1.13.0 |
| 195 | c33942725c73b1aa91ceb46458e6ea7d11c70dcd | jev-1.13.0 |
| 209 | 647cc74ebb66eae6cd36acc9c09d0804b2972387 | jev-1.13.0 |
| 218 | e23e622813a540e18bed0849779040cf181ff9b7 | jev-1.13.0 |
| 220 | 3059ca9cc5b0cb668216561b7b77c8b0119abad3 | jev-1.13.0 |
| 227 | f172e280aa1532c7a246a9017e1dd79c65e7028a | jev-1.13.0 |

| threshold | value | rejects | N | per-diff values | min | max | reject side | other side |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| diff_matches_plan_min | 0.7 | below | 8 | PR 165: 0.55; PR 182: 0.47; PR 187: 0.49; PR 195: 0.59; PR 209: 0.52; PR 218: 0.29; PR 220: 0.5; PR 227: 0.37 | 0.29 | 0.59 | 8 | 0 |
| touches_out_of_scope_max | 0.3 | above | 8 | PR 165: 0.32; PR 182: 0.54; PR 187: 0.32; PR 195: 0.47; PR 209: 0.33; PR 218: 0.34; PR 220: 0.39; PR 227: 0.43 | 0.32 | 0.54 | 8 | 0 |
| local_tests_support_claim_min | 0.6 | below | 8 | PR 165: 0.56; PR 182: 0.49; PR 187: 0.49; PR 195: 0.63; PR 209: 0.62; PR 218: 0.47; PR 220: 0.53; PR 227: 0.5 | 0.47 | 0.63 | 6 | 2 |
| stuck_repeating_prior_failure_max | 0.6 | above | 8 | PR 165: 0.27; PR 182: 0.24; PR 187: 0.44; PR 195: 0.04; PR 209: 0.15; PR 218: 0.45; PR 220: 0.42; PR 227: 0.24 | 0.04 | 0.45 | 0 | 8 |
| risk_of_regression_rollback_at_or_above | 1.5 | at-or-above | 8 | PR 165: 1.41; PR 182: 1.24; PR 187: 1.44; PR 195: 1.08; PR 209: 0.69; PR 218: 1.43; PR 220: 0.67; PR 227: 1.4 | 0.67 | 1.44 | 0 | 8 |

Switches (no per-diff value):

- hand_to_qa_requires_green_checks: true

policy_hash: every G_done carries the sha256 of developer-done.json as it is now.

### 4.4 QA-score gate (qa-score.json) — PROVISIONAL (N=5 seat-built, 0 runtime)

N = 5. all records report jev-1.13.0; every one is at or above jev-1.13.0.

| PR | E_t commit | model_resolved |
| --- | --- | --- |
| 195 | b43e719b510eeb6fb36ba5cb479d1d0247ff373a | jev-1.13.0 |
| 209 | 08c4e495b770302adb57c61d95439c2a54712030 | jev-1.13.0 |
| 218 | ad20f4d33919be802fd8f5ba556fc3301c4642b7 | jev-1.13.0 |
| 220 | 58a91efa57174be940fc6556934b51739a3d81e2 | jev-1.13.0 |
| 227 | 1cc2fe3807542b65fbe3769415a23e28a14b6a3b | jev-1.13.0 |

| threshold | value | rejects | N | per-diff values | min | max | reject side | other side |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| regression_of_validated_max | 0.5 | above | 5 | PR 195: 0.09; PR 209: 0.04; PR 218: 0.07; PR 220: 0.08; PR 227: 0.1 | 0.04 | 0.1 | 0 | 5 |
| artifact_complete_enough_to_stop_min | 0.5 | below | 5 | PR 195: 0.53; PR 209: 0.75; PR 218: 0.58; PR 220: 0.2; PR 227: 0.43 | 0.2 | 0.75 | 2 | 3 |
| fail_severity_reject_at_or_above | 2 | at-or-above | 3 | PR 195: 0.9; PR 220: 1.83; PR 227: 0.78 | 0.78 | 1.83 | 0 | 3 |

Switches (no per-diff value):

- any_fail_is_reject: true
- untested_is_reject: true

policy_hash: every G_qa carries the sha256 of qa-score.json as it is now.

### Diffs and what was scored

| PR | 4.3 G_done | 4.4 G_qa |
| --- | --- | --- |
| 165 | scored | not scored: no E_t |
| 182 | scored | not scored: no E_t |
| 187 | scored | not scored: no E_t |
| 195 | scored | scored |
| 209 | scored | scored |
| 218 | scored | scored |
| 220 | scored | scored |
| 227 | scored | scored |

E_t source: the criteria Terms table (8 rows).



---

# Loop 15 slice four: close-out of step 4 (the live Jev calls), re-run

**By:** the QA seat, QA 248, session `a35fcfeb-44f5-4cf7-82b7-2674c0869310`, 2026-10-02 (UTC). Headless Claude Code
on Opus, on the laptop. **Code under use:** `460c9a492fe15b88c8cebf845bd99cc322eb519b` (`origin/master` at the #266
T-220 merge). **Dispatch:** `docs/loops/qa-248-s4-step4-rerun-dispatch.md` on top of
`docs/loops/qa-245-s4-step4-dispatch.md`, with the D-092 amendments (`docs/loops/qa-245-rulings.md`). This file
replaces QA 245's close-out in place. QA 245's one record and its ledger lines are kept, unedited.

**Everything here is labelled PROVISIONAL**: `PROVISIONAL (N=8 seat-built, 0 runtime)` for 4.3 and
`PROVISIONAL (N=5 seat-built, 0 runtime)` for 4.4, as the generator computes them. Every number is one answer from
one model version on a seat-built diff. None is a measurement of a runtime loop.

The tables above are the unedited output of `harness closeout-tables`, run in the step-4 worktree after the last call
(exit 0). The last line, `E_t source: the criteria Terms table (8 rows).`, is T-220's. Re-check them with
`harness closeout-tables --check docs/loops/loop-15-slice-4-closeout.md`.

## What happened

13 live calls were made, the 13 the dispatch budgeted. Every one was answered, by `jev-1.13.0`. There were no
transport failures and no retries.

| Item | Calls | Answered | Verdicts (shadow: recorded only) |
| --- | --- | --- | --- |
| 4.2 plan gate on `loop-15-slice-4-brief.D_t.json` | 1 | 1 | reject |
| 4.3 developer done-gate, one per diff | 8 | 8 | 8 reject |
| 4.4 QA-score gate, one per diff with an `E_t` | 5 | 5 | 2 proceed (#209, #218), 3 reject (#195, #220, #227) |

**4.2.** The plan gate's answer is the observation. It is quoted here and is not re-asked:

- `model_resolved: "jev-1.13.0"`, `verdict: "reject"`;
- reason: `scope_size 1.98 at confidence 0.96 is at or above the rejecting score 1.5 at or above confidence 0.7`;
- the other four answers: `plan_mode` `mixed` (0.97), `preserves_validated` 0.78, `addresses_top_failures` 0.67,
  `has_observable_acceptance` 0.77, all on the passing side of their thresholds.

The command exits 1 on a reject (S4-2.4, T-195's behaviour). Under D-076, a 4.2 reject does not stop step 4, and it
did not.

**Usage**, over the 14 answered records: 46,062 input tokens and 5,925 output tokens. The 4.2 call used 4,620 and 129.

## `harness count-attempts`, run after the last call

```
attempts: 15
retries: 1
answered: 14
incomplete: 0
files scanned: ledger lines 15, records 15
  docs/loops/loop-15-slice-4-brief.G_plan.2026-10-02T00-47-29.272Z.json [plan docs/loops/loop-15-slice-4-brief.D_t.json] attempt 1 auth
  docs/loops/loop-15-slice-4-brief.G_plan.2026-10-02T04-34-15.660Z.json [plan docs/loops/loop-15-slice-4-brief.D_t.json] attempt 2 answered
  docs/loops/loop-15-slice-4-records/pr-182.G_done.2026-10-02T04-34-50.770Z.json [developer-done 0d44374e7b1bcaa768c92ac21cd5566e743edf4b] attempt 1 answered
  docs/loops/loop-15-slice-4-records/pr-165.G_done.2026-10-02T04-34-55.855Z.json [developer-done 285a8b2e98895bd189e1068135f38a0c899fccfa] attempt 1 answered
  docs/loops/loop-15-slice-4-records/pr-187.G_done.2026-10-02T04-35-00.118Z.json [developer-done c1eda2f6fb6e75020d2f7f517d72b33b29026452] attempt 1 answered
  docs/loops/loop-15-slice-4-records/pr-195.G_done.2026-10-02T04-35-05.382Z.json [developer-done c33942725c73b1aa91ceb46458e6ea7d11c70dcd] attempt 1 answered
  docs/loops/loop-15-slice-4-records/pr-209.G_done.2026-10-02T04-35-09.575Z.json [developer-done 647cc74ebb66eae6cd36acc9c09d0804b2972387] attempt 1 answered
  docs/loops/loop-15-slice-4-records/pr-227.G_done.2026-10-02T04-35-14.769Z.json [developer-done f172e280aa1532c7a246a9017e1dd79c65e7028a] attempt 1 answered
  docs/loops/loop-15-slice-4-records/pr-220.G_done.2026-10-02T04-35-18.999Z.json [developer-done 3059ca9cc5b0cb668216561b7b77c8b0119abad3] attempt 1 answered
  docs/loops/loop-15-slice-4-records/pr-218.G_done.2026-10-02T04-35-23.862Z.json [developer-done e23e622813a540e18bed0849779040cf181ff9b7] attempt 1 answered
  docs/loops/loop-15-slice-4-records/pr-195.G_qa.2026-10-02T04-35-29.887Z.json [qa-score b43e719b510eeb6fb36ba5cb479d1d0247ff373a:docs/loops/loop-15-slice-3-c-r4-qa-report.E_t.json] attempt 1 answered
  docs/loops/loop-15-slice-4-records/pr-209.G_qa.2026-10-02T04-35-34.366Z.json [qa-score 08c4e495b770302adb57c61d95439c2a54712030:docs/loops/t195-r2-qa-report.E_t.json] attempt 1 answered
  docs/loops/loop-15-slice-4-records/pr-227.G_qa.2026-10-02T04-35-39.376Z.json [qa-score 1cc2fe3807542b65fbe3769415a23e28a14b6a3b:docs/loops/t198-r2-qa-report.E_t.json] attempt 1 answered
  docs/loops/loop-15-slice-4-records/pr-220.G_qa.2026-10-02T04-35-43.393Z.json [qa-score 58a91efa57174be940fc6556934b51739a3d81e2:docs/loops/t196-t197-r2-qa-report.E_t.json] attempt 1 answered
  docs/loops/loop-15-slice-4-records/pr-218.G_qa.2026-10-02T04-35-47.747Z.json [qa-score ad20f4d33919be802fd8f5ba556fc3301c4642b7:docs/loops/t158-r2-qa-report.E_t.json] attempt 1 answered
VIOLATION: docs/loops/loop-15-slice-4-brief.G_plan.2026-10-02T04-34-15.660Z.json: retries docs/loops/loop-15-slice-4-brief.G_plan.2026-10-02T00-47-29.272Z.json, whose outcome is auth; only transport, rate-limited, overloaded may be retried
(exit 1)
```

- **15 attempts, ≤ 17 (this dispatch's ceiling) and ≤ 20 (D-072).** 14 answered, 0 incomplete.
- **The one VIOLATION is the case D-092 ruling 3 decides.** `plan-gate` stamped the new 4.2 record itself with
  `attempt: 2` and `retry_of` = QA 245's `auth` record. The counter then reads it as a retry of an `auth` attempt.
  Ruling 3: QA 245's record holds `answer: null`, so there was no answer to re-roll, and the new attempt counts toward
  the cap. The dispatch expected the flag in another form ("a second record … with no `retry_of`"). The flag that
  came is "retries … whose outcome is auth". The situation is the same, and no record was edited. That one line is
  why the command exits 1. `retries: 1` is this same record. No transport retry was made.

## Every live record, by path

| Record | Gate | PR | attempt | outcome_class | model_resolved | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `docs/loops/loop-15-slice-4-brief.G_plan.2026-10-02T00-47-29.272Z.json` (QA 245) | plan | | 1 | auth | null | none |
| `docs/loops/loop-15-slice-4-brief.G_plan.2026-10-02T04-34-15.660Z.json` | plan | | 2 | answered | jev-1.13.0 | reject |
| `docs/loops/loop-15-slice-4-records/pr-182.G_done.2026-10-02T04-34-50.770Z.json` | developer-done | 182 | 1 | answered | jev-1.13.0 | reject |
| `docs/loops/loop-15-slice-4-records/pr-165.G_done.2026-10-02T04-34-55.855Z.json` | developer-done | 165 | 1 | answered | jev-1.13.0 | reject |
| `docs/loops/loop-15-slice-4-records/pr-187.G_done.2026-10-02T04-35-00.118Z.json` | developer-done | 187 | 1 | answered | jev-1.13.0 | reject |
| `docs/loops/loop-15-slice-4-records/pr-195.G_done.2026-10-02T04-35-05.382Z.json` | developer-done | 195 | 1 | answered | jev-1.13.0 | reject |
| `docs/loops/loop-15-slice-4-records/pr-209.G_done.2026-10-02T04-35-09.575Z.json` | developer-done | 209 | 1 | answered | jev-1.13.0 | reject |
| `docs/loops/loop-15-slice-4-records/pr-227.G_done.2026-10-02T04-35-14.769Z.json` | developer-done | 227 | 1 | answered | jev-1.13.0 | reject |
| `docs/loops/loop-15-slice-4-records/pr-220.G_done.2026-10-02T04-35-18.999Z.json` | developer-done | 220 | 1 | answered | jev-1.13.0 | reject |
| `docs/loops/loop-15-slice-4-records/pr-218.G_done.2026-10-02T04-35-23.862Z.json` | developer-done | 218 | 1 | answered | jev-1.13.0 | reject |
| `docs/loops/loop-15-slice-4-records/pr-195.G_qa.2026-10-02T04-35-29.887Z.json` | qa-score | 195 | 1 | answered | jev-1.13.0 | reject |
| `docs/loops/loop-15-slice-4-records/pr-209.G_qa.2026-10-02T04-35-34.366Z.json` | qa-score | 209 | 1 | answered | jev-1.13.0 | proceed |
| `docs/loops/loop-15-slice-4-records/pr-227.G_qa.2026-10-02T04-35-39.376Z.json` | qa-score | 227 | 1 | answered | jev-1.13.0 | reject |
| `docs/loops/loop-15-slice-4-records/pr-220.G_qa.2026-10-02T04-35-43.393Z.json` | qa-score | 220 | 1 | answered | jev-1.13.0 | reject |
| `docs/loops/loop-15-slice-4-records/pr-218.G_qa.2026-10-02T04-35-47.747Z.json` | qa-score | 218 | 1 | answered | jev-1.13.0 | proceed |

Each `G_qa` sits beside its `E_t` copy, `docs/loops/loop-15-slice-4-records/pr-<N>.E_t.json`. Each copy's blob equals
the `e_t_ref.blob` the record names and the blob at that `qa/*` commit. The attempts ledger is
`docs/loops/loop-15-slice-4-records/attempts.jsonl`, with 30 lines: one `begin` and one `end` per attempt. Every
`begin` precedes its `end` and its record's `answered_at`.

`harness validate gate-record` exits 0 on each of the 13 `G_done` and `G_qa` records. Under D-092 ruling 4 it is not
run on the `G_plan`.

**All 14 answers come from one model, `jev-1.13.0`,** which S4-3a's comparator places at or above `jev-1.13.0`.
So the scores can be compared with each other.

## 4.3, reported three ways (D-076 ruling 1)

**All eight** are the 4.3 table at the top of this file: N = 8, all reject.

**Reconstructed after reading shared code (#209, #182, #187, #195).** Generated by `harness closeout-tables
--records <a scratch dir holding only these four G_done records>`; the 4.3 section, verbatim:

### 4.3 developer done-gate (developer-done.json) — PROVISIONAL (N=4 seat-built, 0 runtime)

N = 4. all records report jev-1.13.0; every one is at or above jev-1.13.0.

| PR | scored SHA | model_resolved |
| --- | --- | --- |
| 182 | 0d44374e7b1bcaa768c92ac21cd5566e743edf4b | jev-1.13.0 |
| 187 | c1eda2f6fb6e75020d2f7f517d72b33b29026452 | jev-1.13.0 |
| 195 | c33942725c73b1aa91ceb46458e6ea7d11c70dcd | jev-1.13.0 |
| 209 | 647cc74ebb66eae6cd36acc9c09d0804b2972387 | jev-1.13.0 |

| threshold | value | rejects | N | per-diff values | min | max | reject side | other side |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| diff_matches_plan_min | 0.7 | below | 4 | PR 182: 0.47; PR 187: 0.49; PR 195: 0.59; PR 209: 0.52 | 0.47 | 0.59 | 4 | 0 |
| touches_out_of_scope_max | 0.3 | above | 4 | PR 182: 0.54; PR 187: 0.32; PR 195: 0.47; PR 209: 0.33 | 0.32 | 0.54 | 4 | 0 |
| local_tests_support_claim_min | 0.6 | below | 4 | PR 182: 0.49; PR 187: 0.49; PR 195: 0.63; PR 209: 0.62 | 0.49 | 0.63 | 2 | 2 |
| stuck_repeating_prior_failure_max | 0.6 | above | 4 | PR 182: 0.24; PR 187: 0.44; PR 195: 0.04; PR 209: 0.15 | 0.04 | 0.44 | 0 | 4 |
| risk_of_regression_rollback_at_or_above | 1.5 | at-or-above | 4 | PR 182: 1.24; PR 187: 1.44; PR 195: 1.08; PR 209: 0.69 | 0.69 | 1.44 | 0 | 4 |

Switches (no per-diff value):

- hand_to_qa_requires_green_checks: true

policy_hash: every G_done carries the sha256 of developer-done.json as it is now.

**Reconstructed without reading their code (#165, #227, #220, #218).** Generated the same way:

### 4.3 developer done-gate (developer-done.json) — PROVISIONAL (N=4 seat-built, 0 runtime)

N = 4. all records report jev-1.13.0; every one is at or above jev-1.13.0.

| PR | scored SHA | model_resolved |
| --- | --- | --- |
| 165 | 285a8b2e98895bd189e1068135f38a0c899fccfa | jev-1.13.0 |
| 218 | e23e622813a540e18bed0849779040cf181ff9b7 | jev-1.13.0 |
| 220 | 3059ca9cc5b0cb668216561b7b77c8b0119abad3 | jev-1.13.0 |
| 227 | f172e280aa1532c7a246a9017e1dd79c65e7028a | jev-1.13.0 |

| threshold | value | rejects | N | per-diff values | min | max | reject side | other side |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| diff_matches_plan_min | 0.7 | below | 4 | PR 165: 0.55; PR 218: 0.29; PR 220: 0.5; PR 227: 0.37 | 0.29 | 0.55 | 4 | 0 |
| touches_out_of_scope_max | 0.3 | above | 4 | PR 165: 0.32; PR 218: 0.34; PR 220: 0.39; PR 227: 0.43 | 0.32 | 0.43 | 4 | 0 |
| local_tests_support_claim_min | 0.6 | below | 4 | PR 165: 0.56; PR 218: 0.47; PR 220: 0.53; PR 227: 0.5 | 0.47 | 0.56 | 4 | 0 |
| stuck_repeating_prior_failure_max | 0.6 | above | 4 | PR 165: 0.27; PR 218: 0.45; PR 220: 0.42; PR 227: 0.24 | 0.24 | 0.45 | 0 | 4 |
| risk_of_regression_rollback_at_or_above | 1.5 | at-or-above | 4 | PR 165: 1.41; PR 218: 1.43; PR 220: 0.67; PR 227: 1.4 | 0.67 | 1.43 | 0 | 4 |

Switches (no per-diff value):

- hand_to_qa_requires_green_checks: true

policy_hash: every G_done carries the sha256 of developer-done.json as it is now.

**What the split shows, and what it does not.** On `diff_matches_plan`, the four reconstructed after reading shared
code run 0.47 to 0.59, and the four reconstructed without reading code run 0.29 to 0.55. On
`local_tests_support_claim`, the only two values on the passing side (#195 0.63, #209 0.62) are both in the first
group. The direction is the one a reconstruction informed by the code would produce. But each group has N = 4, each
from one call, and the two groups are different diffs. So this is not evidence that reading the code moved the
scores. All eight are rejected in both groups.

**Why all eight are rejected.** Every one is below `diff_matches_plan_min` 0.7 and above `touches_out_of_scope_max`
0.3, so every reject stands on Jev's answers alone. Seven of the eight also carry `checks_passed: false`. Four
`E_t`s record `runtime_checks.unit.exit_code: 1`: #195, #227, #220 and #218. Each of those `E_t`s says the failure
was the same at base. The other three, #182, #165 and #187, have `checks_source: "none"`, so the runner applies
`checksPassed: false` (S4-4.4). Only #209 (`E_t` unit exit 0) has green checks. The record labels this with
`checks_source` and `checks_passed`. The reason string, however, reads "the deterministic checks failed (read from
process exit codes, not from the gate)" even where no exit code exists (QA report, finding F6). The checks switch
decides none of the eight verdicts.

## 4.4

| PR | `E_t` (branch, commit) | verdict | results | why |
| --- | --- | --- | --- | --- |
| 195 | `qa/c-r4-report`, `b43e719b` | reject | 30: 28 pass, 1 fail, 1 untested | `qa-mutant-loopkey-survives` fail (severity 0.9; the `E_t` row is `partial`); `CC-21` untested by code (the row is `not_evaluated`) |
| 209 | `qa/t195-r2-report`, `08c4e495` | proceed | 14: 14 pass | |
| 218 | `qa/t158-r2-report`, `ad20f4d3` | proceed | 5: 5 pass | |
| 220 | `qa/t196-r2-report`, `58a91efa` | reject | 11: 5 pass, 2 fail, 4 untested | `artifact_complete_enough_to_stop` 0.2 < 0.5; `full-suite-candidate` (1.83) and `full-suite-base` (0.46) fail, both `unmet` rows; HB-1, HB-2, HB-3, CS-4 untested by code (`not_evaluated`) |
| 227 | `qa/t198-r2-report`, `1cc2fe38` | reject | 16: 13 pass, 3 fail | `artifact_complete_enough_to_stop` 0.43 < 0.5; `full-suite-candidate`, `full-suite-r1`, `full-suite-base` fail (0.74, 0.78, 0.62), all `unmet` rows |

- **Every fail and every untested sits on a row that the `E_t` itself marks `unmet`, `partial` or
  `not_evaluated`.** No row the QA report marked met was failed. Every untested was decided by code, not by Jev
  (S4-6b.2). `missing` is empty on all five.
- **Not scored: no `E_t`** (S4-6b.4): #182, #165 and #187. These three had no call. The generated "Diffs and what
  was scored" table now says so correctly. It says `scored` for the five with an `E_t`, and this is T-220's fix of
  F2.
- No severity reaches `fail_severity_reject_at_or_above` 2; the highest is 1.83 (#220). The three rejects come from
  the `any_fail_is_reject` and `untested_is_reject` switches, and for #220 and #227 also from
  `artifact_complete_enough_to_stop`.
- The QA verdicts of these five diffs are unchanged. Every `E_t`, every QA report and
  `docs/loops/shadow-merge/ledger.jsonl` are untouched (shadow only).

## The rest

- **S4-8 clause 4:** no green CI run id is quoted. Reading run ids needs a network call outside the gate, and the
  dispatch allows none. This seat made no CI run. The F11 commit is `3b192871` (D-076 ruling 4). It is an ancestor of
  the code under use, and `LOOP_LIMITS` is byte-identical at `ec7138bb` and at `460c9a49`.
- **The key scan (S4-3b.2):** see the QA report. It covers this file.
