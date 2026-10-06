# Jev calibration 2, round 2: DEVELOPMENT phase rerun (QA 287)

**By:** QA 287, headless Claude Code (Opus), laptop (Windows), record session 163, 2026-10-06.
**Dispatch:** `docs/loops/qa-287-jev-cal-2-dev-r2-dispatch.md` at DISPATCH_SHA `4139aa6d8022be7e393802718a2ce9b4b3b3434e`.
**Brief:** `docs/loops/jev-calibration-2-brief.md`. **Previous run:** QA 285, `origin/qa/jev-cal-2-dev-report` @ `edad72ab`.
**This is a measurement:** it has no ACCEPT or REJECT. It ran the 33 development rows only. **No held-out row was
called or opened.** Held-out ids were read only for the id-set check in step 2, and held-out sizes appear only as the
counts `wire-size-report.mjs` prints.

## Summary

- **F1 is fixed on the real CLI.** All 33 live calls went through `harness shadow-done … --mode live` as built
  (`open-brain/build/harness/cli.js`). There was no shim and no fetch injection.
- **Every dev request was answered.** That is 33 of 33, against 17 of 33 in QA 285. There were **0 size refusals**,
  **0 retries** and no `auth`. Every request body is ≤ 90,000 bytes (max 89,784). All 7 REJECT cases now have answers.
- **On 33 cases, the gate rejected all 33,** in (a) and in (b) alike. Balanced accuracy is **0.50**, and the
  false-accept rate is **0/7**. The driving-question Brier is **0.385**, against the **0.25** baseline. There were 18
  answers at confidence ≥ 0.9, and **6 of the 18 were right (33.3%)**. **1 of the 4 criteria holds** (false-accept
  rate), so the gate is not useful on the dev set.
- **The per-row question does not separate the verdicts on these 33 cases.** For the combined per-row score (min over
  rows), the AUC is **0.385** (26 ACCEPT v 7 REJECT). The mean over rows gives 0.456, the pooled rows 0.482 and
  1 − `touches_out_of_scope` 0.550. The per-row answers for ACCEPT and REJECT look almost the same: median 0.30 v
  0.31, mean 0.355 v 0.360.
- **F2, F3, F4 and F6 are fixed as observed.**
  - `score.mjs`, as committed and with no re-join, scores 33 of 33 and writes both files (exit 0).
  - `count-attempts` exits 0 without `--max`.
  - The all-questions calibration now differs from the driving-question one (n 539 v 440).
  - F4 is shown offline: no live call returned a non-2xx, so §6.2 shows it with a stub fetch and no network.
- **Spend:** 33 HTTP requests in 33 CLI invocations, and 0 retries. Summed usage: **614,789 input tokens and 10,666
  output tokens**. Every answer resolved to `jev-1.13.0`.

## 1. Trees

| tree | path | SHA (`git log -1 --format=%H`) |
|---|---|---|
| dispatch | `C:/qa-scratch/qa287-wt` | `4139aa6d8022be7e393802718a2ce9b4b3b3434e` |
| run (PR #470 head) | `C:/qa-scratch/qa287-run` | `fa8a821361fdd1d534aa8f11639f6e90b914b82c` |

`git fetch origin pull/470/head` → `git rev-parse FETCH_HEAD` = `fa8a821361fdd1d534aa8f11639f6e90b914b82c`. That equals
the frozen SHA, so PR #470 has not moved. The run tree was made with `git worktree add --detach` at that SHA. This
report branch, `qa/jev-cal-2-r2-dev-report`, is cut from the run tree's head (`fa8a8213`), because the records name
input paths that exist only there.

## 2. Manifest and split

- **`manifest.mjs`** (`node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-2/manifest.mjs`)
  printed `manifest: dev 33, heldout 34, input files 87` and exited 0. It regenerates `runlist.json` and
  `MANIFEST.json`. Afterwards `git status --porcelain` was **empty**, so the regenerated files are byte-identical to the
  committed ones.
- **Independent recompute** (`docs/loops/qa-287/verify-manifest.mjs`, read-only), output in `verify-manifest.out`:

  ```
  manifest hashes: 101 match, 0 mismatch
  input files on disk 87, in manifest 87, same set: true
  heldout runlist 34 v split 34; equal in order: true
  dev rows 33; dev rows that are held-out ids: 0
  dev labels: ACCEPT 26, REJECT 7
  policies named: open-brain/src/harness/policies/developer-done-cal2-r2.json
  case_no unique over 67 rows: true
  ```
- `runlist.phases.heldout` **equals** `split.json`'s `held_out.case_ids`, in order and content. **No dev row is a
  held-out id.**

## 3. Build

In `open-brain/` of the run tree, `npm ci` exited 0 and `npm run build` exited 0. The logs are in `C:/qa-tmp`, and the
key scan covers them.

## 4. Sizes

`node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-2/wire-size-report.mjs` exited 0. Ceiling:
`90000` bytes.

| phase | n | min | median | max | over 90 KB |
|---|---|---|---|---|---|
| dev | 33 | 17,655 | 70,888 | **89,784** | **0** |
| held-out | 34 | (not reported) | (not reported) | (not reported) | **0** |

**Every dev request body is ≤ 90,000 bytes.** For held-out, as the dispatch rules, I report only the counts: n = 34 and
0 over the ceiling. The script printed held-out min, median and max as well. I do not repeat them here, and I opened no
held-out input. The full output is in `docs/loops/qa-287/wire-size-report.out`.

## 5. Dry run, every dev row

`docs/loops/qa-287/dry-run.mjs` ran the built CLI on each of the 33 rows:
`shadow-done --request … --policy … --phase dev --case-id … --runlist … --mode dry-run --records
C:/qa-tmp/qa287/dry-records --ledger C:/qa-tmp/qa287/dry-ledger.jsonl`. `TYPESAFE_API_KEY` was removed from the child's
environment.

```
dry-run: 33 dev rows, 33 exit 0, 0 size-refused, 0 other
dry-run records: 33; sent=true in any: false; modes: dry-run; outcome classes: unavailable; size-refusal notes: 0
```

**33 rows, 0 refusals.**

**Byte-for-byte check, on all 33 rows** (`docs/loops/qa-287/byte-check.mjs`, output `byte-check.out`). The check does
not use the runner's slicer. It walks each input file's top-level object with its own string-aware scanner and takes
the raw bytes of the value under `"request"`. It then checks two things:
- their sha256 equals the dry-run record's `subject.blob`, which is the sha256 of the wire body the transport sends;
- the record's `request` is deep-equal to the file's.

Result: **33/33**. Three spot checks:

| row | request bytes | sha256 of the file's `request` bytes | record `subject.blob` |
|---|---|---|---|
| qa250-t-222 | 89784 | `47c8d67e6a21c729e74523ee116f08c4f9e28370c93cd809fde3f68e79155eef` | equal |
| qa264-pr371 | 45892 | `d5f0f76e31921c2d44ca484de0fd1dc76556a4a37dd80402e1161c3184191fdf` | equal |
| qa279-pr437-r2 | 29437 | `f97a1dc4f2c75ce6e640759a6a1e95c97ef99041c7a616b944509632357dead7` | equal |

## 6. Live, development phase

### 6.1 Key

`docs/loops/qa-287/run-live.mjs` reads `TYPESAFE_API_KEY` from `HKCU\Environment` (`reg query`) into its own process
only, and passes it to each CLI child in that child's environment. Its fingerprint is the first 10 hex of its sha256,
uppercased: **`728B667EFF`, which matches** (D-087). Each slice printed
`key: loaded from HKCU\Environment; fingerprint 728B667EFF matches 728B667EFF`. I never printed, logged or committed the
key. §8 checks this.

### 6.2 Calls

**Runner.** `run-live.mjs <from> <to>` makes one `node open-brain/build/harness/cli.js shadow-done --request <row.input>
--policy <row.policy> --phase dev --case-id <id> --runlist …/runlist.json --mode live --records
docs/loops/jev-calibration-2/records-dev-r2 --ledger docs/loops/jev-calibration-2/records-dev-r2/attempts.jsonl` call
per dev row, in runlist order, one process at a time.
- **It never re-asks.** It re-checks each case_id against `split.json`'s held-out ids, and it skips any row that already
  holds a record with a non-retryable outcome.
- **Retries** happen only on `transport`, `rate-limited` or `overloaded`, at most 3 per row.
- **Stops.** `auth` stops everything, and so does `unavailable` on a live call, which would be F1 again.
- **No byte bypass.** The runner sends nothing itself: every byte on the wire comes from the CLI.
- **Slices.** It ran in three foreground slices (rows 0, 1–11 and 12–32). Row 0 was run alone first to confirm that the
  CLI sends.
- **Evidence.** The slice outputs are `docs/loops/qa-287/live-*.out`, with per-row JSON in `run-live.summary.*.json`.

Nothing was written into `records/`, which holds QA 285's evidence.

| outcome class | rows |
|---|---|
| **answered** | **33**: all 26 ACCEPT and all 7 REJECT dev rows |
| request-invalid (size or other 400) | 0 |
| transport / rate-limited / overloaded | 0 |
| auth | 0 |
| unavailable / unexpected-status / malformed-response | 0 |

- **F1:** the first live call (row 0, `qa250-t-222`) returned `answered`, exit 0, in 877 ms. Every call took between
  504 and 877 ms, and every record has `sent: true`.
- **Size refusals: none.** None was expected, and none came.
- **F4.** Only one outcome class was seen live (`answered`), so no live non-2xx exists to show. To check that a
  non-2xx keeps its status and a bounded body, `docs/loops/qa-287/f4-offline.mts` drives `runShadowDoneFrozen`. It
  uses the code as built, a **stub `fetchImpl` and a dummy key**, one dev input and no network, and writes records only
  to `C:/qa-tmp/qa287/f4`. Output (`f4-offline.out`):

  ```
  HTTP 401: outcome_class auth; exit 1; note "auth (HTTP 401): developer-done: HTTP 401 — key rejected or forbidden; not retried"; response_detail 20 chars "{"detail":"bad key"}"
  HTTP 403: outcome_class auth; exit 1; note "auth (HTTP 403): developer-done: HTTP 403 — key rejected or forbidden; not retried"; response_detail 9 chars "forbidden"
  HTTP 400: outcome_class request-invalid; exit 1; note "request-invalid (HTTP 400): developer-done: HTTP 400 max_tokens_exceeded — request too large for the API; not retried"; response_detail 47 chars "{"detail":{"error_type":"max_tokens_exceeded"}}"
  HTTP 429: outcome_class rate-limited; exit 1; note "rate-limited (HTTP 429): developer-done: HTTP 429 — rate limited"; response_detail 9 chars "slow down"
  HTTP 529: outcome_class overloaded; exit 1; note "overloaded (HTTP 529): developer-done: HTTP 529 — overloaded"; response_detail 10 chars "overloaded"
  HTTP 503: outcome_class transport; exit 1; note "transport (HTTP 503): developer-done: HTTP 503 — server error"; response_detail 2000 chars
  HTTP 418: outcome_class unexpected-status; exit 1; note "unexpected-status (HTTP 418): developer-done: HTTP 418"; response_detail 6 chars "teapot"
  ```
  Every class now keeps its HTTP status in `note` and the body in `response_detail`. A 10,000-byte body is cut to
  2,000 characters. 401 and 403 are now `auth`, and `max_tokens_exceeded` is `request-invalid`, which is not
  retryable. **This is offline evidence of the code path. It was not observed on a live non-2xx.**
- **Totals.**

  | item | value |
  |---|---|
  | CLI invocations | **33** |
  | HTTP requests sent | **33** |
  | retries | **0** |
  | `auth` | none |
  | summed `usage` | **614,789 input tokens, 10,666 output tokens** (QA 285: 351,446 / 3,762 over 17 answers) |
  | resolved model | `jev-1.13.0` on every answer |

- **`harness count-attempts`, without `--max` (F6)**: `node open-brain/build/harness/cli.js count-attempts --records
  docs/loops/jev-calibration-2/records-dev-r2 --ledger docs/loops/jev-calibration-2/records-dev-r2/attempts.jsonl
  --runlist docs/loops/jev-calibration-2/runlist.json`

  ```
  attempts: 33
  retries: 0
  answered: 33
  incomplete: 0
  files scanned: ledger lines 33, records 33
  exit=0
  ```
  **Exit 0, with no violation and no `--max` override.** With `--runlist`, the ceiling is now dev + held-out = 67. The
  per-attempt lines are in `count-attempts.out`.

## 7. Scores, development phase

**As committed, unedited and with no re-join:** `score.mjs --selftest` passes 11 of 11 (`score-selftest.out`). Then I
ran `node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-2/score.mjs --records
docs/loops/jev-calibration-2/records-dev-r2 --out C:/qa-tmp/qa287/scores`:

```
scored dev 33 case(s); 34 unscored; wrote C:\qa-tmp\qa287\scores\scores.json and scores.md
score exit=0
```

**It exits 0 and writes both `scores.json` and `scores.md`** (F2, F3). Copies are in `docs/loops/qa-287/scores/`.
- All **33** dev rows are scored, and 0 are unscored.
- The "34 unscored" are the held-out rows, which have no record, and that is expected.
- `docs/loops/qa-287/analyse.mts` also runs `score.mjs`'s exported `scorePhases` over the records as written, with no
  re-join, and gets the same: dev n = 33, 0 unscored. It computes the extra measurements below with QA 285's method,
  and its output is in `analyse.out` and `analysis.json`.

### 7.1 The four usefulness criteria (dev, n = 33: 26 ACCEPT, 7 REJECT)

| criterion | target | (a) gate as built | (b) Jev alone, **COUNTERFACTUAL** |
|---|---|---|---|
| balanced accuracy | ≥ 0.75 | **0.50** (ACCEPT 0/26 proceed, REJECT 7/7 reject) | **0.50** (same) |
| false-accept rate | ≤ 10% | **0%** (0/7) | **0%** (0/7) |
| driving-question Brier (baseline **0.25**) | ≤ 0.20 | **0.385** against **0.25** | same answers, same 0.385 |
| answers at p ≥ 0.9: accuracy and count | ≥ 90% over ≥ 10 | **33.3%** (6/18) | same |

- **Holds:** 1 of 4 (false-accept rate). `usefulness.useful` is `false`.
- **The p ≥ 0.9 row** uses `score.mjs`'s operationalisation, confidence = max(p, 1 − p) ≥ 0.9. Read literally as
  p ≥ 0.9, there are 6 such answers and 5 are right, which is fewer than the 10 the criterion needs.
- **(a) and (b) are identical.** 32 of the 33 cases carry CI checks with build and unit exit 0. The one with no checks
  is `qa254-t-212` (ACCEPT): `checks.source: none`, so (a) adds "no deterministic checks were supplied". Its
  `plan_row:*` answers reject it in (b) as well.
- **What drives the rejects.** In every case they are `plan_row:*` answers below 0.7. `local_tests_support_claim`
  adds 0.58 < 0.6 on `qa264-pr371`. `touches_out_of_scope` ranges 0.13 to 0.22, and `stuck_repeating_prior_failure`
  0.04 to 0.05. `risk_of_regression` is ≤ 0.17 on its 0..2 scale. **None of them crosses its limit.**

### 7.2 Calibration bands

Driving questions: n = 440 (407 `plan_row:*` + 33 `touches_out_of_scope`), Brier **0.385** against the 0.25 baseline
(QA 285: 0.4402 over 138).

| band | n | fraction correct |
|---|---|---|
| < 0.7 | 173 | 41.6% |
| 0.7 – 0.9 | 249 | 32.5% |
| ≥ 0.9 | 18 | 33.3% |

All questions: n = **539**, Brier **0.349**. These are the 440 driving answers plus `local_tests_support_claim`,
`stuck_repeating_prior_failure` and `risk_of_regression`, 33 each.

| band | n | fraction correct |
|---|---|---|
| < 0.7 | 175 | 42.3% |
| 0.7 – 0.9 | 279 | 37.3% |
| ≥ 0.9 | 85 | 69.4% |

**F6 is fixed:** the question sets differ, so the two calibrations now differ (n 539 v 440, Brier 0.349 v 0.385). The
high ≥ 0.9 accuracy among all questions comes from two non-driving questions. `stuck_repeating_prior_failure` sits at
0.04–0.05 on every case, and `risk_of_regression` at ≤ 0.17 on its 0..2 scale. Both read as ≥ 0.9 "acceptable" on all
33 cases, so together they add 66 answers there, plus one `local_tests_support_claim` at 0.90. They are right on ACCEPT
cases and wrong on REJECT ones.

### 7.3 Per requirement-row answers, by verdict

| label | rows | min | p25 | median | p75 | max | mean | < 0.5 | 0.5–0.7 | ≥ 0.7 |
|---|---|---|---|---|---|---|---|---|---|---|
| ACCEPT (26 cases) | 332 | 0.06 | 0.20 | 0.30 | 0.47 | 0.93 | 0.355 | 258 | 50 | 24 |
| REJECT (7 cases) | 75 | 0.10 | 0.19 | 0.31 | 0.46 | 0.90 | 0.360 | 59 | 10 | 6 |

Every case answered every one of its requirement rows: there are 0 missing `plan_row:*` answers.

AUC with ACCEPT as positive and a higher score counted as more acceptable (Mann-Whitney, ties 0.5). Columns: QA 285's
17, QA 287's 33, the same 17 in QA 287, and the 16 QA 285 lost to size.

| score | QA 285 (14 v 3) | **QA 287, all 33 (26 v 7)** | QA 287, same 17 (14 v 3) | QA 287, 16 new (12 v 4) |
|---|---|---|---|---|
| **combined per-row score, min over rows (as the policy combines them)** | 0.2381 | **0.3846** | 0.1905 | 0.5313 |
| mean over rows | 0.3333 | 0.4560 | 0.3571 | 0.5417 |
| all rows pooled | 0.3467 | 0.4819 | 0.3096 | 0.5363 |
| 1 − `touches_out_of_scope` | 0.2143 | 0.5495 | 0.4881 | 0.6458 |

**Every combined per-row AUC is below 0.5 on the full dev set.** The 16 newly answered cases sit near chance
(0.53–0.54). The 17 that QA 285 also answered remain below chance. Per-case values are in `analyse.out`.

### 7.4 Policy cut that maximises balanced accuracy: **FITTED TO THE DEVELOPMENT SET**

I swept `requirement_row_min_noul` with every other frozen term held, over every observed min-row value and just above
it.
- **Best result.** Balanced accuracy peaks at **0.5192**, for any cut in **(0.49, 0.56]**. It is the same in (a), (b)
  and for `row_min` alone.
- **What that cut does.** 1 of 26 ACCEPTs proceeds (`qa268-pr393-r2`, min row 0.56), 7 of 7 REJECTs are rejected, and
  the false-accept rate is 0/7.
- **Why the window is so narrow.** The highest REJECT min row is 0.49 (`qa279-pr437-r2`), and that is above 25 of the
  26 ACCEPT min rows.

The frozen value is 0.7. The full sweep is in `analysis.json` (`fitted_cut_FITTED_TO_THE_DEVELOPMENT_SET`). **I do not
propose that any threshold be used.**

### 7.5 Confident misses (confidence ≥ 0.9 and wrong, driving questions)

| case_id | question | p | stance | label |
|---|---|---|---|---|
| qa255-pr297 | plan_row:T14 | 0.10 | REJECT | ACCEPT |
| qa255-pr312 | plan_row:T14 | 0.08 | REJECT | ACCEPT |
| qa255-pr312 | plan_row:T8 | 0.06 | REJECT | ACCEPT |
| qa256-pr300 | plan_row:T10 | 0.08 | REJECT | ACCEPT |
| qa256-pr300 | plan_row:T11 | 0.10 | REJECT | ACCEPT |
| qa264-pr371 | plan_row:T4 | 0.07 | REJECT | ACCEPT |
| qa267-pr388 | plan_row:T10 | 0.06 | REJECT | ACCEPT |
| qa267-pr388 | plan_row:T9 | 0.06 | REJECT | ACCEPT |
| qa272-pr415 | plan_row:T5 | 0.10 | REJECT | ACCEPT |
| qa275-pr424-r2 | plan_row:T2 | 0.09 | REJECT | ACCEPT |
| qa275-pr424-r2 | plan_row:T3 | 0.08 | REJECT | ACCEPT |
| qa279-pr437-r2 | plan_row:T2 | 0.90 | ACCEPT | REJECT |

There are 12 misses in 8 distinct cases:
- 11 are requirement rows of ACCEPT cases, scored ≤ 0.10;
- 1 is a requirement row of a REJECT case, scored 0.90.

QA 285's five misses (qa264-pr371 T4, qa267-pr388 T9/T10, qa275-pr424-r2 T2/T3) all recur.

### 7.6 Side-by-side with QA 285: the 17 cases both runs answered

**Same verdict count: 17 of 17.** Every one was `reject` then and is `reject` now. Smaller inputs change what Jev sees,
so the differences below are information, not error.

| case_id | label | rows | min row then → now | mean row then → now | input tokens then → now |
|---|---|---|---|---|---|
| qa255-pr291 | ACCEPT | 5 | 0.17 → 0.24 | 0.494 → 0.544 | 22,469 → 15,420 |
| qa257-pr301 | ACCEPT | 24 | 0.11 → 0.12 | 0.253 → 0.258 | 31,085 → 26,357 |
| qa257-pr313 | ACCEPT | 24 | 0.11 → 0.13 | 0.273 → 0.270 | 20,119 → 13,161 |
| qa264-pr371 | ACCEPT | 8 | 0.07 → 0.07 | 0.509 → 0.486 | 23,486 → 14,142 |
| qa267-pr388 | ACCEPT | 11 | 0.06 → 0.06 | 0.186 → 0.179 | 18,190 → 18,190 |
| qa268-pr393-r2 | ACCEPT | 4 | 0.55 → 0.56 | 0.715 → 0.705 | 22,675 → 26,476 |
| qa269-pr397-r2 | ACCEPT | 4 | 0.17 → 0.20 | 0.348 → 0.353 | 16,064 → 8,771 |
| qa270-pr412 | ACCEPT | 4 | 0.21 → 0.15 | 0.335 → 0.260 | 16,532 → 10,080 |
| qa270-pr413 | ACCEPT | 4 | 0.15 → 0.20 | 0.283 → 0.320 | 21,934 → 12,907 |
| qa272-pr415 | ACCEPT | 5 | 0.11 → 0.10 | 0.324 → 0.270 | 15,546 → 12,876 |
| qa273-pr424 | REJECT | 4 | 0.25 → 0.26 | 0.363 → 0.340 | 21,182 → 6,861 |
| qa275-pr424-r2 | ACCEPT | 4 | 0.09 → 0.08 | 0.120 → 0.125 | 21,886 → 11,158 |
| qa275-pr437 | REJECT | 4 | 0.12 → 0.18 | 0.323 → 0.325 | 21,996 → 8,832 |
| qa277-pr441 | ACCEPT | 4 | 0.22 → 0.25 | 0.525 → 0.535 | 6,935 → 5,355 |
| qa277-pr442 | ACCEPT | 4 | 0.13 → 0.25 | 0.320 → 0.463 | 26,220 → 11,639 |
| qa277-pr451 | ACCEPT | 4 | 0.16 → 0.12 | 0.475 → 0.430 | 22,465 → 14,973 |
| qa279-pr437-r2 | REJECT | 4 | 0.45 → 0.49 | 0.610 → 0.648 | 22,662 → 9,070 |

- **Row counts did not change.** Each case has the same number of requirement rows in both runs.
- **The min-row scores moved little.** The median absolute change is 0.03, and the largest is 0.12 (`qa277-pr442`).
- **The order across verdicts did not improve.** On these 17, the min-row AUC is 0.2381 then and **0.1905** now.
- **Input tokens fell** on 15 of the 17 cases. `qa267-pr388` is unchanged, and `qa268-pr393-r2` rose.
- **One measure did change:** `local_tests_support_claim` on `qa277-pr442` went from 0.59 to 0.82, so it no longer
  rejects that case.

## 8. Key scan

`docs/loops/qa-287/key-scan.mjs` is QA 285's `docs/loops/qa-285/key-scan.mjs`, adapted only in its paths: the
temp-probe name, and the scratch category, which is `C:/qa-tmp/qa287` plus the npm ci and build logs. The diff against
QA 285's is three path lines and the header comment. It covers:
- every file staged for this commit;
- all of `C:/qa-tmp/qa287`: live stdout and stderr, dry-run records, F4 offline records and scores;
- the npm and build logs;
- this session's transcript, found by session id plus a marker that only this session holds.

The output is `docs/loops/qa-287/key-scan.out`:

```
known positive: 1 hit(s) on a temp file (expected 1); temp file deleted: true
transcript: session 666b2890-5da3-4bdf-afee-bd33f1a3eb5c; expected C:/Users/Aaron/.claude/projects/C--Users-Aaron-Worktrees-sia-qa/666b2890-5da3-4bdf-afee-bd33f1a3eb5c.jsonl; exists true
transcript: .jsonl files under C:/Users/Aaron/.claude/projects holding the marker: 1 (…/666b2890-5da3-4bdf-afee-bd33f1a3eb5c.jsonl)
transcript: the one marked file is the session's own: true
every file staged for the report commit (records, ledger, report, evidence): files scanned 60, matches 0
the run's logs and scratch outputs (live stdout/stderr, dry-run records, F4 offline records, scores, npm ci and build logs): files scanned 121, matches 0
this session's transcript (.jsonl): files scanned 1, matches 0
key-scan: total matches 0; every category scanned at least one file: true; PASS
```

**Exit 0, and the known positive was caught.** These lines are from the scan's first run. I re-ran it after inserting
them, and the re-run's output is what is committed. The transcript is scanned as it stood at scan time, so the job's
last few turns fall after it.

## Findings for the planner and builder

- **G1. The question still does not separate on the full dev set.** With all 33 cases answered, the combined per-row
  AUC is 0.385, and the per-row distributions for ACCEPT and REJECT match (median 0.30 v 0.31). On the 16 cases QA 285
  lost to size it is 0.53. The fitted cut reaches only 0.519, and only by letting one ACCEPT through. Jev scores most
  requirement rows of merged, QA-accepted work below 0.5: 258 of 332 ACCEPT rows. These are measurements for the
  planner's ruling, not a proposal.
- **G2. F4 is not exercised live.** No non-2xx occurred. The classification and the bounded body are shown only
  offline, with a stub fetch (§6.2).
- **G3. Note on the p ≥ 0.9 criterion.** `score.mjs` counts confidence max(p, 1 − p) ≥ 0.9, which gives 18 answers
  with 6 right. Read literally as p ≥ 0.9, it gives 6 answers with 5 right. The brief's wording ("answers at p ≥ 0.9")
  allows either reading. The planner may want to fix one before QA 286.
- **No size refusal, no retry, no auth, no tool defect found in this run.** F1, F2, F3 and F6 behaved as fixed on the
  real path. F4 is covered offline, as above.

## Committed on `qa/jev-cal-2-r2-dev-report`

- `docs/loops/jev-calibration-2/records-dev-r2/`: 33 `cal2-*.G_done.*.json` live records and `attempts.jsonl`.
- `docs/loops/jev-calibration-2-dev-r2.md`: this report.
- `docs/loops/qa-287/`:
  - the runner (`run-live.mjs`) with its slice outputs and summaries;
  - the dry run, the byte check, the manifest check, the size report, `count-attempts.out`, the `score.mjs` selftest
    and run outputs, and `scores/` (the `scores.json` and `scores.md` that `score.mjs` wrote);
  - `analyse.mts`, `analyse.out`, `analysis.json`, the F4 offline check, `key-scan.mjs` and `key-scan.out`.
- I edited no policy, input, runlist, `score.mjs` or product file. `records/` (QA 285) is untouched.

QA-287: REPORT COMPLETE
