# Slice four: threshold tables, generated from the gate records

Records read: 0 live answered record(s).

### 4.3 developer done-gate (developer-done.json) — PROVISIONAL (N=0 seat-built, 0 runtime)

N = 0. No scored records..

| PR | scored SHA | model_resolved |
| --- | --- | --- |

| threshold | value | rejects | N | per-diff values | min | max | reject side | other side |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| diff_matches_plan_min | 0.7 | below | 0 | none | n/a | n/a | 0 | 0 |
| touches_out_of_scope_max | 0.3 | above | 0 | none | n/a | n/a | 0 | 0 |
| local_tests_support_claim_min | 0.6 | below | 0 | none | n/a | n/a | 0 | 0 |
| stuck_repeating_prior_failure_max | 0.6 | above | 0 | none | n/a | n/a | 0 | 0 |
| risk_of_regression_rollback_at_or_above | 1.5 | at-or-above | 0 | none | n/a | n/a | 0 | 0 |

Switches (no per-diff value):

- hand_to_qa_requires_green_checks: true

policy_hash: every G_done carries the sha256 of developer-done.json as it is now.

### 4.4 QA-score gate (qa-score.json) — PROVISIONAL (N=0 seat-built, 0 runtime)

N = 0. No scored records..

| PR | scored SHA | model_resolved |
| --- | --- | --- |

| threshold | value | rejects | N | per-diff values | min | max | reject side | other side |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| regression_of_validated_max | 0.5 | above | 0 | none | n/a | n/a | 0 | 0 |
| artifact_complete_enough_to_stop_min | 0.5 | below | 0 | none | n/a | n/a | 0 | 0 |
| fail_severity_reject_at_or_above | 2 | at-or-above | 0 | none | n/a | n/a | 0 | 0 |

Switches (no per-diff value):

- any_fail_is_reject: true
- untested_is_reject: true

policy_hash: every G_qa carries the sha256 of qa-score.json as it is now.

### Diffs and what was scored

| PR | 4.3 G_done | 4.4 G_qa |
| --- | --- | --- |
| 165 | not scored | not scored: no E_t |
| 182 | not scored | not scored: no E_t |
| 187 | not scored | not scored: no E_t |
| 195 | not scored | not scored: no E_t |
| 209 | not scored | not scored: no E_t |
| 218 | not scored | not scored: no E_t |
| 220 | not scored | not scored: no E_t |
| 227 | not scored | not scored: no E_t |


---

# Loop 15 slice four: close-out of step 4 (the live Jev calls), STOPPED after the first call

**By:** the QA seat, QA 245, record session 245, 2026-10-02 (UTC), headless Claude Code on Opus, on the laptop
(DESKTOP-0GV3HAD). **Code under use:** `c34866d37e3fb54e2a2c78aa0507417911f684da` (`origin/master`, which carries
step 2 at `17767aac`). **Dispatch:** `docs/loops/qa-245-s4-step4-dispatch.md`.

**Everything here is labelled `PROVISIONAL (N=0 seat-built, 0 runtime)`.** No Jev answer was received, so there is
nothing to read a threshold against.

The tables above are the unedited output of `harness closeout-tables`, run in the step-4 worktree after the last call
(exit 0). Re-check them with `harness closeout-tables --check docs/loops/loop-15-slice-4-closeout.md`.

## What happened

1. **4.2: one live plan-gate call.** It returned **HTTP 401, `outcome_class: "auth"`**.
   - The harness's message: `TYPESAFE_API_KEY is set but was rejected. This is a config defect, not a transient
     failure, and retrying it is a loop.`
   - The key was present in the seat's environment. Its length is greater than 0, and that was the only check made on it.
   - `sent: false`, `model_resolved: null`, `answer: null`, `usage: null`, `decision: null`. **There is no verdict to
     quote.**
2. **4.3 and 4.4: no call was made.** `auth` is not retryable (S4-7b.3), and the 401 is a property of the key, not of
   the subject. Every one of the 13 remaining calls would have sent the same key. Each would have been one more
   counted `auth` attempt, 14 in all. Failed attempts count (S4-7a.2), so a re-run with a working key would then need
   14 more calls, 28 against D-072's cap of 20. The seat stopped after one attempt so that the budget is still there
   for that re-run. **That stop goes beyond the dispatch's literal "stop that item and go on to the next item", and
   the planner should rule on it** (see the QA report's "Open for the planner").

## `harness count-attempts`, run after the last call

```
attempts: 1
retries: 0
answered: 0
incomplete: 0
files scanned: ledger lines 1, records 1
  docs/loops/loop-15-slice-4-brief.G_plan.2026-10-02T00-47-29.272Z.json [plan docs/loops/loop-15-slice-4-brief.D_t.json] attempt 1 auth
(exit 0)
```

## Every live record, by path

| Record | Gate | Subject | attempt | outcome_class | sent | model_resolved |
| --- | --- | --- | --- | --- | --- | --- |
| `docs/loops/loop-15-slice-4-brief.G_plan.2026-10-02T00-47-29.272Z.json` | plan | `docs/loops/loop-15-slice-4-brief.D_t.json` @ `21bc4487` | 1 | auth | false | null |

The attempts ledger is `docs/loops/loop-15-slice-4-records/attempts.jsonl`, with one `begin` line and one `end` line for
that attempt. The begin line was written before the request left, at 00:47:29.272Z, and the end at 00:47:29.572Z.

There is no `G_done` and no `G_qa` record.

## 4.3, reported three ways (D-076 ruling 1)

| Grouping | PRs | G_done records | Label |
| --- | --- | --- | --- |
| all eight | #182, #165, #187, #195, #209, #227, #220, #218 | 0 | `PROVISIONAL (N=0 seat-built, 0 runtime)` |
| reconstructed after reading shared code | #209, #182, #187, #195 | 0 | `PROVISIONAL (N=0 seat-built, 0 runtime)` |
| reconstructed without reading their code | #165, #227, #220, #218 | 0 | `PROVISIONAL (N=0 seat-built, 0 runtime)` |

No diff was scored, so there is nothing to compare between the groups.

## 4.4

- **Not called: stopped after the 4.2 `auth`.** #195, #209, #227, #220 and #218. Each has an `E_t` (Terms table).
- **Not scored: no `E_t`** (S4-6b.4, D-076 ruling 2). #182, #165 and #187.

The generated table above prints `not scored: no E_t` for all eight. That is wrong for the five that have an `E_t`.
The generator decides from the `E_t` copies in the records directory, and only a G_qa run writes those copies (see
the QA report, finding F2).

## The rest

- **`model_resolved`:** none was received, so S4-3a.2's comparator has nothing to check.
- **S4-8 clause 4:** no green CI run is quoted. Reading run ids needs a network call, and the dispatch forbids every
  call except the gate's. This seat also made no CI run. The F11 commit is `3b192871` (D-076 ruling 4).
- **The key scan (S4-3b.2):** see the QA report. It covers this file.
