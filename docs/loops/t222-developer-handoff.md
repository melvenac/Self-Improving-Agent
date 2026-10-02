# T-222 developer handoff: `count-attempts` after an unanswered `auth` attempt, plus F6 to F8

**By:** Forge (builder), 2026-10-02. **Dispatch:** `docs/loops/t222-dispatch.md` (D-093, D-092 ruling 3).
**Branch:** `loop/t222-attempts` from `origin/master`. No live Jev call was made. No record and no ledger line was edited.

## F5: fix (i), the counter

`countAttempts` (`open-brain/src/harness/gate-records.ts`) treats a record whose `retry_of` names an earlier record for the
same subject as a **fresh attempt** when that parent's outcome is non-retryable AND the parent's own record is readable
with `answer === null`. A fresh attempt is not counted in `retries` and is not a VIOLATION. It is still a live attempt, so
it counts toward the cap. I chose (i) alone. (ii) is not done: the runner still sets `retry_of`.

**Unanswered is proven, not assumed.** A parent record that cannot be read, or whose `answer` is non-null, still gives the
`only transport, rate-limited, overloaded may be retried` VIOLATION.

- **Red (master, new fixtures):** `F5.1` (a copy of the slice-four ledger and the records it names, `count-attempts` via the
  CLI) failed with `VIOLATION: ...G_plan.2026-10-02T04-34-15.660Z.json: retries ...00-47-29.272Z.json, whose outcome is auth`,
  and `F5.2` failed with the same message. 2 failed, 5 passed.
- **Green:** all 7 F5 fixtures pass. The three that must stay VIOLATIONs do: a retry of an `auth` that has an answer
  (`F5.4`), a re-roll after an answer (`F5.6`), and a transport retry beyond 3 (`F5.7`). `F5.5` pins an unreadable parent as
  a VIOLATION.
- **The real records, unedited:** `harness count-attempts` on `docs/loops/loop-15-slice-4-records` exits 0
  (`attempts: 15`, `retries: 0`, `answered: 14`), where master exited 1.

## F6 to F8

- **F6:** `decideDoneGate` takes an optional `checksSource`. When it is `none`, the reason reads "no deterministic checks
  were supplied". The verdict logic is unchanged. `shadow-gates.ts` passes it. The runtime path passes none and keeps the
  old text. `s4-g3-done.test.ts` D3 asserted the old wording for `none` and now asserts the new one.
- **F7:** `checksFromEvidence(path, repoRoot?)`. `checks_source` is `E_t:<repo-relative path>@<blob>`. A file outside the repo
  gives `E_t:@<blob>`, the blob alone. `cmdShadowDone` passes `--repo`. `F7` covers both cases.
- **F8:** the 4.4 table's column is "E_t commit". The 4.3 column keeps "scored SHA". The values are unchanged.
- **Close-out:** `loop-15-slice-4-closeout.md` was **regenerated, not hand-edited**. The old generated block was replaced
  by `harness closeout-tables` output, and the diff is the one header line. `closeout-tables --check` passes.

## Tests run (touched files only, no full suite, no mutants)

`t222-attempts`, `s4-g1-records`, `s4-g3-done`, `s4-g6-closeout`: 4 files, 52 tests, all passing. `tsc --noEmit` is clean.
CI runs the suite.
