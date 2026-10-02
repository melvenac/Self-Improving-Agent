# T-222: `count-attempts` after an unanswered `auth` attempt, plus the F6 to F8 clauses (dispatch)

**By:** Atlas (planner), record session 156, 2026-10-02. **Ruling:** D-093 (`docs/loops/qa-248-rulings.md`), applying
D-092 ruling 3. **Job class: LIGHT**, covering `open-brain/src/harness/` and its tests; CI runs the suite.
**Make no live Jev call.**

## F5 (the main clause)

- **The defect:** `plan-gate` chained QA 248's 4.2 record to QA 245's unanswered `auth` record with `attempt: 2` and
  `retry_of`. `count-attempts` then reports `VIOLATION … retries … whose outcome is auth` and exits 1 on the
  slice-four records.
- **Rule 3:** an attempt after a non-retryable outcome that got **no answer** is a fresh attempt, not a re-roll and
  not a retry. It still counts toward the cap.
- **Required:**
  - `count-attempts` exits 0 on `docs/loops/loop-15-slice-4-records/attempts.jsonl` and the slice's records as they
    stand. **No record and no ledger line is edited.**
  - Choose one of two fixes and say which in the handoff:
    - **(i)** the counter treats "retry_of points at an unanswered non-retryable attempt" as a fresh attempt;
    - **(ii)** the runner stops setting `retry_of` in that case, and the counter accepts the existing record under
      (i)'s rule anyway.
  - Either way, a real retry of an answered subject, and a retry of `auth` that **did** get an answer, still produce a
    VIOLATION.
- **Red first:** a fixture copy of the slice's ledger and records: `count-attempts` exits 1 on master and 0 after the
  fix. Two more fixtures must stay VIOLATION: a re-roll after an answer, and a transport retry beyond 3.

## F6 to F8 (low)

- **F6:** when `checks_source` is `none`, `decision.reasons` must not say "the deterministic checks failed (read from
  process exit codes)". Say "no deterministic checks were supplied". The verdict logic is unchanged.
- **F7:** `G_done.checks_source` for an `E_t` names the repo-relative path, or the blob only, never a machine path.
- **F8:** `closeout-tables`' 4.4 table: relabel the column "E_t commit". The values are unchanged.
- **Preserved:** the existing slice-four close-out still passes `closeout-tables --check`. If the relabel changes the
  generated text, regenerate the close-out in the same PR. Do not hand-edit it.

## Rules

- Branch `loop/t222-attempts` from `origin/master`. Run only the touched test files locally.
- Open the PR to master, but **do not merge it**. T-221 may still be open: report any cancelled push `test`, and the
  planner re-runs it.
- The repo is PUBLIC: no issues, no comments, and no PRs other than this one.
- Handoff: `docs/loops/t222-developer-handoff.md`, with the red and green output.
- Report the SHA and the PR number to `atlas-sia`. If it is unreachable, report to `clark`.
