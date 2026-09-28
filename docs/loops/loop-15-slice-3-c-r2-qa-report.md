# Candidate C r2 (T-155 shadow merge gate) — QA report

## Verdict

**REJECT.** Product `8054f9fd35394eb77a639206611bf3320983527d` closes all five findings from QA 204 and is
green on tcm, but it still violates the frozen CC-6 artifact contract. `prepareShadowVerdict` accepts a non-SHA
candidate id and writes it into both the artifact path and `candidate_sha`; the independent probe wrote
`artifacts/iterations/t001/bad/shadow_merge.json` with `"candidate_sha":"bad"`. CC-6 requires both candidate and
criteria SHAs to be full 40-character hex.

Criteria: `23ebd86` on `origin/docs/session-100-qa99-dispatch`; §8 and §9 override §1. Candidate base:
`d1e86740bd68827979cfbd5757034f849c38ad41`. Red: `103fba7034ecb442c6773299a2f66242b407a65f`.

## Acceptance rows

| Row | Status | Evidence |
|---|---|---|
| CC-0 | met | The 10-file diff is limited to the gate, policy/schema, CLI, sync registration, procedure, handoff, and tests. `schema.ts`, `declared.ts`, and `runtime.ts` are unchanged. No test was deleted and no skip/todo conditional was added. |
| CC-1 | partial | Strict merge-policy/schema and drift test exist; optional gates and all fail-closed flags are present. `merge.json` still does not state that `runtime_checks` and `E_t.acceptance` are required inputs as CC-1.2 requires. |
| CC-2 | partial | The exported type has exactly three outcomes and tests exercise all three, with reasons on non-merge outcomes. CC-2.2 requires named fixture files; the fixtures remain inline. |
| CC-3 | met | Valid evidence with matching SHA, green checks, shown and attributed met rows, and optional absent gates returns `would-merge`. |
| CC-4 | met | Tests assert all five causes: unmet, in-scope not_evaluated, partial, failed check, and required gate reject. |
| CC-5 | partial | Tests assert 5.1–5.5. Code handles 5.6 (required gate, skip mode, absent record) as `undefined`, but the required 5.6 fixture/assertion remains absent. |
| CC-6 | unmet | The §9 path and r2 input summaries are correct, and the artifact is read back in a test. However, no boundary validates `candidateSha` or `criteriaSha`: a probe with `candidateSha: "bad"` wrote `artifacts/iterations/t001/bad/shadow_merge.json` containing `"candidate_sha":"bad","verdict":"undefined"`. This violates the required full-40-hex artifact fields. |
| CC-7 | met | A second prepare for the pair is refused and the test compares complete bytes before/after. |
| CC-8 | met | Decide refuses without an artifact; the ledger time is forced strictly after `written_at`; prepare cannot overwrite before or after decide. |
| CC-9 | met | Merged decisions record action, reachable merge SHA, loop, candidate, and disagreement; undefined maps to null. |
| CC-10 | met | Decline and replacement are tested; bare or non-40-hex replacement SHAs are refused by both CLI and function. |
| CC-11 | met | Summary derives all counts from ledger text and prints the required zero-disagreement disclaimer. |
| CC-12 | met | Undefined writes `disagreed:null` and is excluded from evaluated; the three-line assertion passes. |
| CC-13 | partial | r2 closes QA 204's empty-line, missing-hash, and edited-committed-line holes, and the check runs on sync. The check still walks ledger lines only; it does not enumerate verdict artifacts to detect an artifact with no matching ledger line, as CC-13.2 requires. |
| CC-14 | met | Pending is checked first and returns `undefined`. |
| CC-15 | met | `parseDeclared` supplies separate unrunnable/out-of-scope arrays; both exclude rows and remain separate in the artifact. |
| CC-16 | met | In-scope not_evaluated blocks, declared ids are excluded, and absent declarations leave rows in scope. |
| CC-17 | partial | Attributed met rows count and are named in reasons. The explicitly required all-attributed fixture is absent; the one test mixes one shown and one attributed row. |
| CC-18 | met | Shape, loop/SHA matching, criteria failure, and human-seat paths are supported. r2 now turns an unreadable evidence file into an immutable `undefined` artifact. |
| CC-19 | met | `shadow-verdict prepare` is the only merge point; `runLoop` remains unchanged and the tracked procedure places it in the human merge step. |
| CC-20 | met | Help and success paths exist; r2 refuses unknown flags and invalid gate modes, with assertions. |
| CC-21 | cut | Cut by §8 P2 and declared out of scope; not scored. |
| CC-22 | met | Candidate tcm is green: 132 files, 1836 passed, 6 skipped. Base is green: 131 files, 1810 passed, 6 skipped. No candidate failure is new. Local build, tsc, and 59 targeted tests also exit 0. |
| CC-29 | met | Human-seat artifacts and the ledger are under `docs/loops/shadow-merge/`; `git check-ignore` reports neither path ignored. |
| CC-30 | met | The tracked procedure gives pre-merge prepare and post-merge decide steps; a fixture-repo test refuses a merge SHA not reachable from `origin/master`. |

## Declared rows (reported, not scored)

- Unrunnable: CC-23 live prepare/merge/decide; CC-24 production disagreement evidence; CC-25 historical recovery.
- Out of scope: CC-26 docs-only merges; CC-27 alternate harness; CC-28 Jev calibration; CC-21 backfill (cut).

## QA 204 closure

| QA 204 finding | Status in r2 | Row that fails if it returns |
|---|---|---|
| C-204-1 artifact path/input summaries | closed | CC-6 |
| C-204-2 replacement without SHA | closed | CC-10 |
| C-204-3 bypassable ledger integrity | closed | CC-13 |
| C-204-4 unreadable evidence refuses before artifact | closed | CC-18 |
| C-204-5 permissive flags/gate mode | closed | CC-20 |

Every row QA 204 scored met remains met. Its partial CC-1, CC-2, CC-5, CC-13, and CC-17 gaps remain partial except
the repaired portions described above; CC-6 is unmet for the new invalid-SHA probe.

## Test coverage

Every scored row has at least some asserting evidence when CC-22's tcm run is counted. Distinctive required clauses
still lacking an automated assertion are CC-1.2 (policy names required evidence inputs), CC-2.2 (named fixture files),
CC-5.6 (required live gate skipped), CC-8.1 (direct no-artifact decide assertion), CC-11.3 (CLI reads the ledger),
CC-13.2 (unmatched verdict-file scan), CC-15.2 (unrunnable exclusion), CC-17 (all-attributed fixture), and CC-29
(ignore check). CC-6 has no negative assertion for malformed candidate/criteria SHAs; that omission admitted the
blocking defect.

## Independent mutants

The required two QA mutant branches could not be completed. One isolated local mutant changed the artifact acceptance
summary to `[]`; the targeted suite killed it at CC-6 (1 failed, 24 passed). The subsequent command to commit and push
`qa/c-r2-mut-artifact-input` was denied by the headless permission fence. Per dispatch, that line of work stopped at
the denial: it was not retried or bypassed, and no second mutant or mutant CI run was attempted. GitNexus impact and
`detect_changes()` tools were also unavailable. This is incomplete dispatch evidence, not a pass.

## CI (tcm, no Windows)

Three `ci.yml` workflow-dispatch runs were used (within the six-run cap):

| Purpose | Run | Head SHA | Conclusion |
|---|---:|---|---|
| frozen base/full suite | [36481631024](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36481631024) | `d1e86740bd68827979cfbd5757034f849c38ad41` | success: 131 files, 1810 passed, 6 skipped |
| red | [36481630959](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36481630959) | `103fba7034ecb442c6773299a2f66242b407a65f` | failure: 1 file / 6 tests failed; 131 files / 1830 tests passed, 6 skipped |
| candidate/full green | [36481631065](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36481631065) | `8054f9fd35394eb77a639206611bf3320983527d` | success: 132 files, 1836 passed, 6 skipped |

The candidate adds one passing file and 26 passing tests over base; there is no new full-suite failure. The Windows job
was skipped on every run and no `windows=true` dispatch was made. Local `npm run build`, `npx tsc --noEmit -p .`, and
the 59 gate/spawn/policy tests each exited 0; the build stamped `8054f9f`.

## Defects

1. **C-212-1 / blocker / CC-6:** prepare accepts non-40-hex candidate and criteria SHAs and serializes them into an
   artifact whose path and fields violate the frozen contract. Observed candidate probe: path
   `artifacts/iterations/t001/bad/shadow_merge.json`, `candidate_sha: "bad"`, verdict `undefined`.
2. **C-212-2 / major / CC-13:** the sync check validates only artifacts referenced by ledger lines; it does not scan
   verdict artifacts for a missing matching line.
3. **C-212-3 / major / criteria tests:** CC-1.2, CC-2.2, CC-5.6, and CC-17's all-attributed fixture remain expressly
   required but unasserted.
4. **C-212-4 / evidence:** the QA-mutant requirement is incomplete because the protected push command was denied.

## Open for the planner

- The verdict is already REJECT on CC-6; the incomplete mutant evidence does not change that outcome.
- A repaired candidate should validate loop, candidate SHA, and criteria SHA before choosing a path or writing an
  artifact, and add negative CLI/function tests for malformed values.

## Model

QA seat: GPT-5.6 Sol (`gpt-5.6-sol-medium`), record 212. Criteria author was Composer 2.5; candidate builder was
Grok 4.7.

## Evidence file

`docs/loops/loop-15-slice-3-c-r2-qa-report.E_t.json` contains the full product SHA, one entry for every CC row in
scope (plus cut CC-21), and the QA-run tcm checks. Candidate command
`node build/harness/cli.js validate evidence <file>` exited **0**.

Pre-commit `node build/cli.js sync --check` exited **1** on existing retirements, registered-worktree-layout, and
greeting-size issues. The candidate's `shadow-merge-ledger` check passed its absent-ledger first-use case.

QA-212: REPORT COMPLETE
