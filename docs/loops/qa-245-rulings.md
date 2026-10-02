# QA 245 rulings: slice four, step 4 (D-092)

**By:** Atlas (planner), record session 156, 2026-10-02. **Report:** `origin/qa/s4-step4-report` at `4cc476f0`,
`docs/loops/loop-15-slice-4-step4-qa-report.md`. **Dispatch:** `docs/loops/qa-245-s4-step4-dispatch.md`.

## Verdict

**The report is ACCEPTED as an accurate record. Step 4 is INCOMPLETE, and slice four is NOT closed.**

- One live call was made: 4.2's plan gate, which got HTTP 401 `auth`.
- 0 answers came back, so S4-2.2, S4-3a.2 and S4-4.1 are unmet. Their evidence does not exist yet; the code was
  not refuted.
- **No release (D-073 holds).** The single release for slices three and four waits for a step-4 run that gets
  answers.

## Open items

1. **The key (Open 1) goes to Aaron.** `TYPESAFE_API_KEY` is set on the laptop, but Jev rejects it. Aaron should
   check whether it has been revoked or rotated, or belongs to the wrong account, and then start a fresh shell before
   the seat is launched. **No seat reads or prints the value.**
2. **Stopping every item after the 401 (Open 2) is RATIFIED.** The same key on every call would have used up the
   budget with 13 `auth` records that carry no information. **Amended rule for every live-gate dispatch:** on `auth`,
   stop ALL items, because `auth` describes the key and not the subject. On `request-invalid`, `unexpected-status` or
   `malformed-response`, stop that item and go on to the next.
3. **Counting the next 4.2 attempt (Open 1, second half).** The "no re-roll" rule forbids calling a subject again
   **after an answer**. The 4.2 record holds `sent: false` and `answer: null`, so no answer exists, and a new attempt
   after the key is fixed is **not** a re-roll. It counts toward D-072's cap: 1 used, 19 left. If `count-attempts`
   flags a second record for the same subject that has no `retry_of`, read that flag against this ruling. Do not
   fix it by editing a record.
4. **F1 (`validate gate-record` refuses `G_plan`).** The re-dispatch drops that step for 4.2. A plan-record
   validator is not needed for slice four.
5. **F2 (`closeout-tables` labels diffs `no E_t` when they have one).** This is a generator defect: the label must
   come from whether the `E_t` exists, and `not called` must be its own label. It has to be fixed before the re-run's
   close-out, because the tables are generated and never typed. **T-220.**
6. **F3 (the forbidden word inside the `G_plan` request).** These are quoted copies of the brief and the `D_t`, which
   S4-5b already excludes by path. **The copy is covered by that exclusion.** The word must not appear in any text the
   seat or the generator writes. Redacting it from the request is not required.
7. **F4 (absolute local paths in `G_plan`).** Harmless. Folded into T-220 as a low-priority clause: write
   repo-relative paths like the shadow runners do.
8. **TEMP/TMP (Open 4).** The launcher sets them before it starts the seat. The seat does not set them itself.

## A finding in the report itself (K1)

The key-scan output reports one transcript file scanned. The prose, however, says "The transcript scanned was
`docs/loops/loop-15-slice-4-records/attempts.jsonl`", and the full path list it refers to was not quoted.
`key-scan.mjs` looks for the transcript under the `C--Users-Aaron-Worktrees-sia-qa` slug, but the run's worktree was
`C:/qa-scratch/qa245-wt`. **S4-3b.2 is ruled met for the gate records, the logs and the close-out. For the transcript
category it is unproven: the instrument may have answered a different question.** For the re-run, the scan must
print the absolute path of the transcript it scanned, and the planner checks that path against the seat's session
id.

## The re-run (after Aaron confirms the key)

- Use the same dispatch, amended by rulings 2, 3, 4 and 8 above and K1, on a master that has T-220 merged.
- Budget: 13 primary calls (4.2 once more, 8 for 4.3 and 5 for 4.4), with ≤3 retries and a total of ≤20 counting
  the existing record.
- **The records PR for this report:** it changes only docs, so it cannot merge until T-219 (D-091) is merged. In the
  meantime it travels with the record write that carries D-092, which does start CI.
