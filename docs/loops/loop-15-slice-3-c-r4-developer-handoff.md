# Candidate C r4 (T-155) — developer handoff

Seat: Forge (Claude Code, `sia-forge`). Branch `loop/15-slice-3-candidate-c`, base `5f7c9a0`. Local only: nothing
pushed, no CI run (D-061). Scope is exactly the six rows QA 213 scored partial, per hub turn 234.

## Commits

| SHA | What |
|---|---|
| `d1e973962798810790434e7b9baf8941bc200cde` | tests + five fixtures under `open-brain/tests/harness/fixtures/shadow-merge/` |
| `c33942725c73b1aa91ceb46458e6ea7d11c70dcd` | product: CC-1.2 and CC-13.2 (tip; the candidate) |

## Per row: which red is real

| Row | Change | Red at 5f7c9a0? | The red is |
|---|---|---|---|
| CC-1.2 | `required_inputs` in `merge.json`, strict schema, derived `policy-merge.schema.json`; the verdict reads the list | **True base red** — 2 rows fail | new tests + fixtures run against an archive of the unfixed base |
| CC-13.2 | ledger check walks every `shadow_merge.json`; absent-ledger early return removed | **True base red** — 6 rows fail | same |
| CC-2.2 | three named outcome fixtures | **Mutant only** — product already correct | mutant `cc22` |
| CC-5.6 | skipped-required-live-gate fixture + paired live case | **Mutant only** | mutant `cc56` |
| CC-13.1 | isolated incorrect-`line_hash` row | **Mutant only** | mutant `cc131` (the fd6c310 edit) |
| CC-17 | all-attributed fixture | **Mutant only** | mutant `cc17` |

The base run copied the new test file and fixtures onto `git archive 5f7c9a0` (with `docs/`) — for the two product
rows the failing lines are the old messages, e.g. `expected 'ledger absent — first use, nothing to…' to contain '0
verdict artifacts walked'`. The first archive lacked `docs/`, which produced a spurious CC-19 failure; that one was
an archive defect, not a product red.

## CC-1.2 placement (CC-0.1)

Planner rev 167 asked for `validateEvidence` to read the policy. CC-0.1 says C does not change B's `EvidenceSchema`,
and QA 213 scored CC-0 met on that basis, so `schema.ts` is untouched. The policy-driven check is
`missingRequiredInput` in `shadow-merge.ts`, run on the validated evidence before any outcome is formed. It reads
`policy.required_inputs`. Accepted by the planner at rev 171. `E_t.requirements` is the extra input the vocabulary
allows; an array counts as supplied only when non-empty (zod does not enforce that).

## CC-13.2 rule (ruled at rev 167)

An artifact with no ledger line is an ISSUE when its `candidate_sha` is an ancestor of HEAD; otherwise it is
"pending decide" — severity pass, printed with count and SHAs. A malformed artifact is an issue. The output states its
limit: ancestry is read against this tree's HEAD, so a stale tree under-reports owed decides. Both
`docs/loops/shadow-merge/<loop>/<sha>/` and `artifacts/iterations/<loop>/<sha>/` are walked; the count is printed and
asserted.

## Mutants (each its own branch off c339427, unpushed; tsc 0; edit-landed asserted; vitest exit 1)

| Mutant | Branch tip | Edit | Rows that die |
|---|---|---|---|
| cc12a | `a181331e2a0d2053f99dbdad6f153ff7c1acabf5` | `merge.json` drops `runtime_checks` | CC-1.2 loader row (named) plus 15 others: every prepare loads the policy |
| cc12b | `1fcc296fa428d25bfaa996cc41e1e7ed67392572` | hardcoded list restored | CC-1.2 verdict row (only failure) |
| cc22 | `7b23f663559a00ad17477854e59181cc6ac13139` | pending → would-not-merge | CC-5.1, CC-2.2 `undefined.json` |
| cc56 | `4b522666f4925079f3dcc173a845e7ed89d75b59` | skip mode treated as not required | CC-5.6 fixture row (only failure) |
| cc131 | `088f438824479f68daba121a6a9e8251699e23d8` | hash comparison forced to accept (fd6c310's edit) | CC-13.1 (only failure) |
| cc132 | `b8cb2fea2f031260954de097ae9ce092dae4fc77` | enumeration skipped | five CC-13.2 rows |
| cc17 | `e06c212e19fb2b0253de1042c94063316afd7013` | attributed rows block | CC-17, CC-2.2 would-merge, and older rows |

**cc12a detail.** On cc12a the CC-1.2 *loader* row fails, and the CC-1.2 *verdict* row still passes (it does not read
`merge.json`). Both are listed under CC-1.2; the loader row is the one cc12a targets.

An earlier run of all seven read exit code `null` for every mutant (`npx.cmd` did not spawn) and was discarded; the
recorded results are from the re-run that calls node on the tsc and vitest entry points and refuses a null status.

## Full suite, unpiped, on c339427

`node node_modules/vitest/vitest.mjs run` → **exit 1**. 3 failed, 1779 passed, 78 skipped (132 files: 3 failed, 121
passed, 8 skipped). All three failures are outside C:

1. `tests/harness/qa104-a9-probe2.test.ts` R72-BEFORE-ABSENT-DANGLING — `EPERM … symlink`. **Fails at 5f7c9a0**
   (archive with `docs/`, same EPERM).
2. `tests/shared/state-schema.test.ts` T-171 r3b (reads origin/master's live state.json). **Fails at 5f7c9a0**, but
   with the opposite assertion (`expected false to be true` at base, `true to be false` on the candidate): the test
   reads a moving ref, so this is the same test failing, not proof of the same cause.
3. `tests/pipelines/state-import-leftovers.test.ts` UTF-7 row — `EPERM … rename … SUMMARY.md.tmp`. **Not reproduced**:
   passed at the base run, and 22 of 22 passed twice alone on the candidate. A transient Windows file-lock failure
   under full-suite load; I have not shown it failing at base.

Shown at the base, then: two of the three. The third is unreproduced.
