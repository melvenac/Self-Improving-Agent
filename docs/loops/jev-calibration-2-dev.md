# Jev calibration 2, round 2: DEVELOPMENT phase (QA 285)

**By:** QA 285, headless Claude Code (Opus), laptop (Windows), record session 162, 2026-10-06.
**Dispatch:** `docs/loops/qa-285-jev-cal-2-dev-dispatch.md`, prompt `docs/loops/qa-285-headless-prompt.md`, both at
DISPATCH_SHA `d6415f5f5912fdb28af63fd58b6f0500d5c77678`. **Brief:** `docs/loops/jev-calibration-2-brief.md`.
**This is a measurement:** it has no ACCEPT or REJECT. It ran the 33 development rows only. **No held-out row was
called**, and none was read for anything other than the id-set check in step 2.

## Summary

- **The live calls ran, but two of the frozen tools did not work as committed, and I worked around both.** I
  disclose each workaround here and edited no frozen file.
  1. **The frozen CLI cannot send a live request** (F1). `harness shadow-done --request … --mode live` builds
     `FrozenWireTransport` with no `fetchImpl` (`cli.ts:468` → `cal2-frozen.ts:363`), and that class has no default
     (`cal2-frozen.ts:159`). Every live call therefore ends `unavailable`, "no fetch implementation for live frozen
     request", and nothing is sent. The 33 live calls went through a shim (`docs/loops/qa-285/shadow-done-fetch.mts`).
     The shim is `cmdShadowDone`'s frozen branch with the same option object plus `fetchImpl: globalThis.fetch`,
     the default that `JevTransport` already uses (`gate.ts:569`). In dry-run, its record equals the CLI's on all 27
     fields; only timestamps and attempt_id differ.
  2. **`score.mjs` as committed scores 0 of 33 dev rows** (F2). `buildRowsFromRunlist` joins `record.pr === row.case_no`,
     but the runner writes `pr` from `state.scored_diff.pr`, which is the GitHub PR number. I scored with
     `score.mjs`'s own exported `scorePhases`, unedited, over the same records with `pr` set to the row's `case_no`,
     matched by input path (`record.dt.path === row.input`). Both results are below.
- **16 of the 33 dev requests were refused for size:** HTTP 400 `{"detail":{"error_type":"max_tokens_exceeded"}}`.
  As the dispatch rules, they are recorded and not cut. That leaves **17 answered cases: 14 ACCEPT and 3 REJECT.**
  Four of the 7 dev REJECTs were lost to size. Every number below rests on 3 REJECT cases.
- **On the 17 cases, the gate rejected all 17,** in (a) and in (b) alike. Balanced accuracy is 0.50, the false-accept
  rate 0/3, and the driving-question Brier **0.4402 against the 0.25 baseline**. Ten answers had p ≥ 0.9, and **5 of
  those 10 were right**. Under these readings the per-row question does not separate the verdicts on the dev set:
  the combined per-row AUC is 0.238, below chance, with n = 14 v 3.
- Calls: **34 runner invocations, of which 33 sent an HTTP request**. The first went through the frozen CLI and sent
  nothing. There were **0 retries** and no `auth`. Summed usage: **351,446 input tokens and 3,762 output tokens**.

## 1. Trees

| tree | path | SHA (`git log -1 --format=%H`) |
|---|---|---|
| dispatch | `C:/qa-scratch/qa285-wt` | `d6415f5f5912fdb28af63fd58b6f0500d5c77678` |
| run (PR #470 head, `git fetch origin pull/470/head` → `git rev-parse FETCH_HEAD`) | `C:/qa-scratch/qa285-run` | `1e1ca3423bac37bffb7ab04c24bb51ecf3c8624d` |

This report branch, `qa/jev-cal-2-dev-report`, is cut from the run tree's head (`1e1ca342`), because the records name
input paths that exist only there.

## 2. Manifest

- **Independent recompute** (`docs/loops/qa-285/verify-manifest.mjs`, read-only):
  `manifest hashes: 101 match, 0 mismatch`. That covers 4 data files (`collect.json`, `inputs.json`, `runlist.json`,
  `pool.json`), 8 scripts, 87 inputs, 1 policy (`developer-done-cal2-r2.json`) and `score_mjs`. The input files on
  disk are the same 87 as in the manifest.
- **`manifest.mjs` itself** (`node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-2/manifest.mjs`)
  printed `manifest: dev 33, heldout 34, input files 87` and exited 0. It rewrites `runlist.json` and `MANIFEST.json`,
  and afterwards `git status --porcelain` was **empty**, so the regenerated files are byte-identical to the committed
  ones.
- `runlist.phases.heldout` case ids **equal** `split.json`'s `held_out.case_ids` in order and content (34 v 34).
  **0 dev rows are held-out ids.** `jev-calibration-2-split.json` has no diff from `3b122586`.
- Every runlist row names the same policy, `open-brain/src/harness/policies/developer-done-cal2-r2.json`. Dev labels:
  26 ACCEPT and 7 REJECT. `case_no` is unique over all 67 rows.

## 3. Build

`npm ci` and `npm run build` in `open-brain/` of the run tree both exited 0.

## 4. Dry run, every dev row

`docs/loops/qa-285/dry-run.mjs` ran the frozen CLI (`shadow-done --request … --policy … --phase dev --case-id …
--runlist … --mode dry-run`) on each of the 33 rows, with `TYPESAFE_API_KEY` removed from the child's environment
and the records written to `C:/qa-tmp`:

```
dry-run: 33 dev rows, 33 exit 0, 0 refused
dry-run records written: 33; sent=true in any: false; modes: dry-run
```

**Byte-for-byte check, on all 33 rows, not just 3.** I located the input file's `request` bytes independently of the
runner's brace scanner: the shortest substring after `"request": ` that JSON-parses to a value deep-equal to the
parsed `request`. Its sha256 equals the record's `subject.blob`, which is the sha256 of the wire body the transport
sends, and the record's `request` is deep-equal to the file's. Result: **33/33**. The three spot checks:

| row | request bytes | sha256 of the file's `request` bytes | record `subject.blob` |
|---|---|---|---|
| qa250-t-222 | 337130 | `465d93f4dc97309ad24bc53f808ef771f36143818ee8cae070151a939ca84df9` | equal |
| qa264-pr371 | 76955 | `c74dfcd6c17e9abff62943151b72f07fe1ca66087d095baa9da32d6991e0c552` | equal |
| qa279-pr437-r2 | 73098 | `cec1d196a2602b757c63c960edca1116befe77294984eec1aaca7ae7e8b4a1eb` | equal |

## 5. Key

I read `TYPESAFE_API_KEY` from `HKCU\Environment` into the runner process only and passed it to each child in its
environment. Fingerprint, the first 10 hex of its sha256, uppercased: **`728B667EFF`, which matches** (D-087). I did not
print, log or commit it. The scan in §8 checks this.

## 6. Live, development phase

**Runner:** `docs/loops/qa-285/run-live.mjs`. It makes one call per dev row, in runlist order, one process at a time.
Records go to `docs/loops/jev-calibration-2/records` and the ledger to `…/records/attempts.jsonl`. It re-checks each
case_id against `split.json`'s held-out ids before calling, and it skips any row that already has an answered record,
so it never re-asks. It retries on `transport`, `rate-limited` or `overloaded`, up to 3 times per row, but **reads the
HTTP status out of the record's note**, because `FrozenWireTransport` files every non-2xx status as `transport` (F4).
On that reading, 401 or 403 counts as `auth` and stops everything, 413 counts as a size refusal, and any other 4xx is
recorded and not retried. The runner was run in four foreground slices (rows 0, 0–7, 8–19 and 20–32) so each fitted
the tool's time limit.

**The first invocation (row 0, `qa250-t-222`) went through the frozen CLI** and returned exit 1, outcome `unavailable`,
note `no fetch implementation for live frozen request`. **No request was sent.** The ledger entry's outcome is
`unavailable`, which `count-attempts` never counts. Its record stays in `records/`, and that is not a re-ask. Every call
after it went through the shim (F1). For rows 0 to 7 the shim passed `globalThis.fetch` directly. From row 8 on it
passed a wrapper that does the same fetch and, on a non-2xx response, copies the body with the key redacted to
`docs/loops/qa-285/http-bodies/`. The request is untouched either way: same URL, same init, same bytes.

| outcome | rows |
|---|---|
| **answered (17)** | qa255-pr291, qa257-pr301, qa257-pr313, qa264-pr371, qa267-pr388, qa268-pr393-r2, qa269-pr397-r2, qa270-pr412, qa270-pr413, qa272-pr415, qa273-pr424 (R), qa275-pr424-r2, qa275-pr437 (R), qa277-pr441, qa277-pr442, qa277-pr451, qa279-pr437-r2 (R) |
| **HTTP 400, refused for size (16)** | qa250-t-222, qa251-t-164, qa254-t-212, qa255-pr297, qa255-pr312, qa256-pr298 (R), qa256-pr300, qa256-pr306 (R), qa259-pr292, qa259-pr320, qa260-pr298 (R), qa260-pr306, qa261-pr302, qa264-pr373, qa267-pr391, qa267-pr393 (R) |

(R) marks a REJECT label. All the rest are ACCEPT.

- **Size refusals.** For the 9 refusals from row 8 on, the captured body reads, in every case,
  `{"detail":{"error_type":"max_tokens_exceeded"}}`. The 7 refusals in rows 0–7 came before the shim captured bodies,
  so for them only `HTTP 400` is known. They fit the same size pattern. Sizes here are the request as compact JSON;
the wire body is the file's indented bytes, which are slightly larger. The largest answered request was 97,530 bytes
  (`qa257-pr301`, 31,085 input tokens), and the smallest refused one was 134,044 bytes (`qa255-pr312`). Every refused
  request is ≥ 134,044 bytes, and every answered one ≤ 97,530. The status was 400, not 413, so this is the dispatch's
  "413 or similar". **Nothing was cut.**
- **Totals.** Runner invocations: 34. HTTP requests sent: **33**. Retries: **0**, since no row drew a retryable failure.
  `auth`: none. Summed usage over the records: **351,446 input tokens and 3,762 output tokens**. Refused calls report
  no usage. Every answer resolved to model `jev-1.13.0`.
- **`harness count-attempts`** (`--ledger …/records/attempts.jsonl --records …/records --repo <run tree>`):

  ```
  attempts: 33
  retries: 0
  answered: 17
  incomplete: 0
  files scanned: ledger lines 34, records 34
  VIOLATION: 33 live attempts; the ceiling is 20
  ```
  **That run exits 1**, and its only violation is the default ceiling of 20, which is slice four's `MAX_ATTEMPTS_TOTAL`.
  This calibration has **no cap** (Aaron, 2026-10-05), so I re-ran it with `--max 33`, the number of attempts made:
  `attempts: 33, retries: 0, answered: 17, incomplete: 0`, **0 violations, exit 0**. Both outputs are in
  `docs/loops/qa-285/count-attempts*.out`.

## 7. Scores, development phase

**As committed:** `score.mjs --selftest` passes 9 of 9. `score.mjs` (no flags) writes `results/scores.json`, then
throws `TypeError: Cannot convert undefined or null to object` in `markdown()` and exits 1 (F3): `markdown()` reads
`s.headline` and `s.by_source_kind`, which `scorePhases` does not return. Its `scores.json` scores **0 of 33** dev rows,
all of them unscored, because of the join in F2. The file is kept as `docs/loops/qa-285/score-as-committed.scores.json`.

**Joined by input path:** `docs/loops/qa-285/analyse.mts` runs `score.mjs`'s `scorePhases`, unedited, over the
records with `pr` set to the runlist `case_no` matched on `dt.path`. It scores 17 rows and leaves the 16 size refusals
unscored. Held-out phase: n = 0.

### 7.1 The four usefulness criteria (dev, n = 17: 14 ACCEPT, 3 REJECT)

| criterion | target | (a) gate as built | (b) Jev alone, **COUNTERFACTUAL** |
|---|---|---|---|
| balanced accuracy | ≥ 0.75 | **0.50** (ACCEPT 0/14 proceed, REJECT 3/3 reject) | **0.50** (same) |
| false-accept rate | ≤ 10% | **0%** (0/3) | **0%** (0/3) |
| driving-question Brier (baseline 0.25) | ≤ 0.20 | **0.4402** against **0.25** | same answers, same 0.4402 |
| answers at p ≥ 0.9: accuracy and count | ≥ 90% over ≥ 10 | **50%** (5/10) | same |

**(a) and (b) are identical here.** All 17 answered cases carry real checks (`checks.source: ci`, build and unit exit
0), so `hand_to_qa_requires_green_checks` passes in (a), and setting it aside in (b) changes nothing. This is round 2's
item 2 working: the checks are no longer what rejects. Every reject is driven by `plan_row:*` answers below 0.7, plus
`local_tests_support_claim` 0.59 on one case (`qa277-pr442`). `touches_out_of_scope` ran from 0.13 to 0.21 and never
crossed 0.3. On the frozen policy, 1 of 4 criteria holds (false-accept rate), so the gate is not useful on the dev set.

Calibration bands, driving questions (n = 138 answers: 121 `plan_row:*` + 17 `touches_out_of_scope`):

| band | n | fraction correct |
|---|---|---|
| < 0.7 | 40 | 42.5% |
| 0.7 – 0.9 | 88 | 27.3% |
| ≥ 0.9 | 10 | 50.0% |

`score.mjs`'s "all questions" calibration comes out identical (n = 138, Brier 0.4402) because `calibration(rows,
null)` falls back to the driving-question ids (F6).

### 7.2 Per requirement-row answers, by verdict

| label | rows | min | p25 | median | p75 | max | mean | < 0.5 | 0.5–0.7 | ≥ 0.7 |
|---|---|---|---|---|---|---|---|---|---|---|
| ACCEPT (14 cases) | 109 | 0.06 | 0.16 | 0.22 | 0.45 | 0.94 | 0.324 | 85 | 14 | 10 |
| REJECT (3 cases) | 12 | 0.12 | 0.21 | 0.31 | 0.63 | 0.89 | 0.432 | 8 | 2 | 2 |

AUC with ACCEPT as positive and a higher score counted as more acceptable (Mann-Whitney, ties 0.5), over 14 ACCEPT
and 3 REJECT:

- **combined per-row score as the policy combines it (min over rows): 0.2381**
- mean over rows: 0.3333
- all rows pooled: 0.3467
- 1 − `touches_out_of_scope`: 0.2143

All four are below 0.5. On these 17 cases, ACCEPT rows score lower than REJECT rows. With 3 REJECT cases this ordering
is fragile, but nothing here shows separation. Per-case values are in `docs/loops/qa-285/analyse.out`.

### 7.3 Policy cut that maximises balanced accuracy: **FITTED TO THE DEVELOPMENT SET**

I swept `requirement_row_min_noul` with every other frozen term held. The maximum balanced accuracy is **0.5357**, for
any cut in **(0.45, 0.55]**, and it is the same in (a), (b) and for `row_min` alone. At such a cut 1 of 14 ACCEPTs
proceeds (`qa268-pr393-r2`, min row 0.55), 3 of 3 REJECTs are rejected, and the false-accept rate is 0/3. The frozen
value is 0.7. The sweep is in `analysis.json`. **I am not proposing that any threshold be used.**

### 7.4 Confident misses (p ≥ 0.9 and wrong, driving questions)

| case_id | question | p | stance | label |
|---|---|---|---|---|
| qa264-pr371 | plan_row:T4 | 0.07 | REJECT | ACCEPT |
| qa267-pr388 | plan_row:T10 | 0.06 | REJECT | ACCEPT |
| qa267-pr388 | plan_row:T9 | 0.07 | REJECT | ACCEPT |
| qa275-pr424-r2 | plan_row:T2 | 0.09 | REJECT | ACCEPT |
| qa275-pr424-r2 | plan_row:T3 | 0.09 | REJECT | ACCEPT |

All five are requirement rows of ACCEPT cases that Jev scored at or below 0.09. The 5 correct confident answers are
also requirement rows of ACCEPT cases, at p ≥ 0.9: qa255-pr291 T183-5 (0.92), qa264-pr371 T2 (0.90), T3 (0.94) and
T5 (0.92), and qa268-pr393-r2 T3 (0.90).

## 8. Key scan

`docs/loops/qa-285/key-scan.mjs` is QA 248's scan with two differences: it reads the key from `HKCU\Environment`, and
it scans this run's files. It covers every file staged for this commit, all of `C:/qa-tmp/qa285` (logs, dry-run
records, HTTP bodies, build log), and this session's transcript, which it finds by session id plus a marker that only
this session holds. The output is `docs/loops/qa-285/key-scan.out`:

```
known positive: 1 hit(s) on a temp file (expected 1); temp file deleted: true
transcript: session 5f9cfc78-2efb-4a34-9b50-4b92ed2cb01c; expected C:/Users/Aaron/.claude/projects/C--Users-Aaron-Worktrees-sia-qa/5f9cfc78-2efb-4a34-9b50-4b92ed2cb01c.jsonl; exists true
transcript: .jsonl files under C:/Users/Aaron/.claude/projects holding the marker: 1 (…/5f9cfc78-2efb-4a34-9b50-4b92ed2cb01c.jsonl)
transcript: the one marked file is the session's own: true
every file staged for the report commit (records, ledger, report, evidence): files scanned 62, matches 0
the run's logs and scratch outputs (live stdout/stderr, dry-run records, HTTP bodies, build log): files scanned 160, matches 0
this session's transcript (.jsonl): files scanned 1, matches 0
key-scan: total matches 0; every category scanned at least one file: true; PASS
```

**Exit 0, and the known positive was caught.** These lines are from the scan's first run. I re-ran it after inserting
them, and the re-run's output is what is committed. The transcript is scanned as it stood at scan time, so the job's
last few turns fall after it.

## Findings for the planner and builder

- **F1. The frozen CLI cannot make a live cal2 call.** `cmdShadowDone` (`cli.ts:468`) passes no `fetchImpl`, and
  `FrozenWireTransport` (`cal2-frozen.ts:159`) has no `globalThis.fetch` default, unlike `JevTransport` (`gate.ts:569`).
  Tests that inject `fetchImpl` pass, but the shipped command never sends. QA 286 needs this fixed, or the same shim.
- **F2. `score.mjs scorePhases` joins on the wrong key.** It matches `record.pr === row.case_no`, while the runner
  writes `pr` = the GitHub PR number whenever `state.scored_diff.pr` is set, which is every `prNNN` case. PR numbers
  also repeat across cases (pr298, pr306, pr393, pr424 and pr437 each appear under more than one case id), so the PR
  cannot be the key at all. The input path (`dt.path`) is unique.
- **F3. The `score.mjs` CLI crashes after writing `scores.json`.** `markdown()` and the final `console.log` expect
  `score()`'s shape, not `scorePhases()`'s, so `scores.md` is never written.
- **F4. `FrozenWireTransport` files every non-2xx status as `transport` and drops the body.** An HTTP 401 would be
  recorded as `transport`, not `auth`, so a runner that follows "retry on transport, stop on auth" by outcome_class
  would retry a bad key. `max_tokens_exceeded` also looks retryable. The record keeps only `HTTP <status>`.
- **F5. Size: 16 of 33 dev inputs exceed Jev's token limit**, including 4 of 7 REJECTs. The cut-off sits between
  97,530 and 134,044 request bytes, or ≥ 31,085 input tokens answered. The dev evidence rests on 3 REJECT cases.
  The held-out phase will lose the same share unless the inputs change, and this report did not look at held-out sizes.
- **F6.** `count-attempts` defaults to slice four's ceiling of 20 and exits 1 at 33 unless given `--max`. `score.mjs`'s
  "all questions" calibration equals the driving-question one.

## Committed on `qa/jev-cal-2-dev-report`

- `docs/loops/jev-calibration-2/records/`: 34 `cal2-*.G_done.*.json` records (33 live attempts plus the unsent
  `unavailable` one) and `attempts.jsonl`.
- `docs/loops/jev-calibration-2-dev.md` (this report).
- `docs/loops/qa-285/`: the runner, the shim, the dry-run, manifest-check and analysis scripts with their outputs,
  `count-attempts*.out`, `score.out`, `score-as-committed.scores.json`, the run summaries, `http-bodies/`,
  `key-scan.mjs` and `key-scan.out`.
- I did not commit `results/scores.json` in place; its content is the as-committed copy above. I edited no policy,
  input, runlist, `score.mjs` or product file.

QA-285: REPORT COMPLETE
