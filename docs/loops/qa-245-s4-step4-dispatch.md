# QA 245: Loop 15 slice four, step 4: the live Jev calls and the close-out

**By:** Atlas (planner), 2026-10-01, record session 155. **Code under use:** `origin/master` at or after `17767aac`
(step 2 merged, #254). **Seat:** the QA seat, headless Claude Code on Opus, on the **laptop** (D-074, D-087).
**Launch only after the planner has checked that `TYPESAFE_API_KEY` exists on the laptop.**

This is the **only** step in slice four that calls Jev. Every rule below exists so that the first answer is the
observation, and so that the key goes nowhere except the Jev endpoint.

## What to read

1. `docs/loops/loop-15-slice-4-criteria.md`: the live halves you now score.
   - S4-2, S4-3a.2, S4-3b.2 and S4-7;
   - S4-4.1, S4-4a.6, S4-5a's tables, S4-6b.4 and S4-6c.1 on live records;
   - S4-8 clauses 2 and 4.
2. `docs/loops/loop-15-slice-4-criteria-rulings.md` (D-076): N=5 for 4.4, where records live, F11, and that a 4.2
   reject does not pause step 4.
3. `docs/loops/loop-15-slice-4-step2-developer-handoff.md`: "How to run the new commands".
4. `docs/loops/loop-15-slice-4-reconstruction-map.md` and the eight `D_t` files in
   `docs/loops/loop-15-slice-4-records/`.

## Budget (D-072, D-076): at most 14 calls, plus at most 3 transport retries

| Item | Calls |
|---|---|
| 4.2 `harness plan-gate docs/loops/loop-15-slice-4-brief.D_t.json --mode live` | 1 |
| 4.3 `harness shadow-done … --mode live`, one per diff in the reconstruction map | 8 |
| 4.4 `harness shadow-qa … --mode live`, one per diff that has an `E_t` (C, T-195, T-198, T-196/T-197, T-158) | 5 |
| Retries, only after `transport`, `rate-limited` or `overloaded` | at most 3 |

- **Never re-roll.** A subject that has an answered record is never called again.
- **On `auth`, `request-invalid`, `unexpected-status` or `malformed-response`,** stop that item, record it, and go on
  to the next item.
- **After every call, run `harness count-attempts`.** If the next call would make the total exceed 17, stop and
  write "Open for the planner".

## Order

1. **Preflight. No call is made here.**
   - Build master: `npm ci`, `npm run build`, `tsc --noEmit`.
   - Check that the key exists **without printing it**, by testing that its length is greater than 0.
   - Run every command once with `--mode dry-run` and check that it would reach the gate.
2. **4.2:** one live plan-gate call. Then `harness validate gate-record` on the record. Quote `model_resolved` and the
   verdict. A reject does **not** stop step 4.
3. **4.3:** the eight shadow-done calls.
   - `--scored-sha` is the QA'd SHA, `candidate_git.sha`, from the diff's latest QA `E_t`, as the criteria's Terms
     table gives it.
   - For A, B part 1 and B part 2, which have no `E_t`, use the merged head (`<merge>^2`) and `--checks none`.
   - `--dt` is that diff's reconstructed `D_t`.
4. **4.4:** the five shadow-qa calls, each reading its `E_t` from the `qa/*` branch commit named in the criteria's
   Terms table.
5. **S4-3b.2, the key scan.**
   - Run a committed scan script that reads the key **from the environment** and searches every record, the run's
     captured stdout and stderr, the close-out, and this session's own transcript `.jsonl`.
   - It prints only the count of matches and the files scanned. It first passes a known positive on a temp file,
     which it then deletes.
   - **Pass:** 0 matches, with at least one file scanned in every category.
6. **The close-out:** `docs/loops/loop-15-slice-4-closeout.md`.
   - Put `harness closeout-tables` output first; it is generated, never typed. Then give `harness count-attempts`
     output and every live record by path.
   - **Report 4.3 three ways** (D-076 ruling 1): all eight together; #209, #182, #187 and #195 (reconstructed after
     reading shared code); and #165, #227, #220 and #218.
   - Label everything `PROVISIONAL (N=… seat-built, 0 runtime)`.
   - **Do not use the forbidden word anywhere.**

## Rules (headless Claude Code on the laptop)

- You are **QA 245**, prefix `s4-step4`. Push ONLY `qa/s4-step4-*` branches, and only through
  `node docs/loops/qa-245/push-qa.mjs <branch>`.
- Commit every gate record, the attempts ledger, the close-out, the scan script and your report
  (`docs/loops/loop-15-slice-4-step4-qa-report.md` with its `.E_t.json`) on `qa/s4-step4-report`. The planner opens
  the PR.
- **The key:**
  - Never print it, write it, or pass it to anything except the gate command, which reads it from the environment.
  - Never put it on a command line. Never use a shell `echo`, `set` or `printenv` that would show it.
- Make no other network call. Make no CI run. Never change a policy file or a verdict.
- If the key is absent, or a call fails in a way that is not retryable, stop that item, write it in "Open for the
  planner", and finish the report.
- The last line is exactly `QA-245: REPORT COMPLETE`.
