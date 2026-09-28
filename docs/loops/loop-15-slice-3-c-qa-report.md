# Candidate C (T-155 shadow merge gate) — QA report

## Verdict

**REJECT.** Product `2035e893497cf37f4224835dd95a7d3838e45cca` implements the central three-way verdict and
prepare/decide flow, but it does not satisfy the frozen contract. The blocking failures are the incomplete and
mislocated verdict artifact (CC-6), an accepted replacement with no replacement SHA (CC-10), bypassable ledger
integrity (CC-13), unreadable evidence not becoming an `undefined` artifact (CC-18), and permissive CLI argument
handling (CC-20).

Criteria: `e6b64e9` on `origin/docs/session-100-qa99-dispatch`; §8 overrides §1. Candidate base:
`d1e86740bd68827979cfbd5757034f849c38ad41`. Red: `970c1b8bcc830c3610b6c181a1dd59b4304381d5`.

## Acceptance rows

| Row | Status | Evidence |
|---|---|---|
| CC-0 | met | Diff is limited to the gate, policy/schema, CLI, sync registration, procedure, and tests. No skip/todo conditional was added; `schema.ts`, `declared.ts`, and `runtime.ts` are unchanged. |
| CC-1 | partial | Strict merge-policy schema, derived schema drift test, optional gates, and fail-closed flags exist. `merge.json` does not itself state that `runtime_checks` and `E_t.acceptance` are required inputs as CC-1.2 requires. |
| CC-2 | partial | The exported type and function expose exactly the three outcomes and non-merge reasons. Tests exercise all outcomes, but no named fixture files exist; all fixtures are inline despite CC-2.2. |
| CC-3 | met | Green/attributed evidence, matching SHA, passed checks, and no required gates returns `would-merge`; the attributed row is named in reasons. |
| CC-4 | met | Tests assert 4.1 unmet, 4.2 in-scope not_evaluated, 4.3 partial, 4.4 failed check, and 4.5 required gate reject as `would-not-merge`. |
| CC-5 | partial | Tests assert 5.1–5.5 as `undefined`; code handles 5.6 (`required` + `skip` + absent) as undefined, but the required 5.6 fixture/test is absent. |
| CC-6 | unmet | Runtime artifacts are written to `artifacts/iterations/<loop>/<candidate>/shadow_merge.json`, not the frozen `artifacts/iterations/<loop>/shadow_merge.json`. `inputs` contains only `declared` and `runtime_checks`; it omits the required acceptance and gate summaries. No test reads and validates the artifact schema. |
| CC-7 | met | Second prepare for the same pair throws `already exists`; the test compares the complete file bytes before/after. |
| CC-8 | met | Decide refuses an absent verdict; `decided_at` is forced strictly after `written_at`; prepare never updates an existing artifact and remains refused after decide. CC-7 and CC-9 cover immutability/time. |
| CC-9 | met | Merged decisions record action, merge SHA, candidate, loop, and disagreement. `undefined` uses `null`. A fixture-repo test covers a reachable `origin/master` SHA. |
| CC-10 | unmet | Decline works, but replacement is not safely implemented: direct `decideShadowVerdict({action:"replaced"})` appends `replaced_sha:null`; CLI `--replaced` with no value is parsed as boolean and silently records `declined`. No decline/replacement tests exist. |
| CC-11 | met | Summary derives disagreements/evaluated/undefined only from ledger lines and prints the required disclaimer. |
| CC-12 | met | Undefined produces `disagreed:null`; the three-line test yields disagreements 0, evaluated 2, undefined_count 1. |
| CC-13 | partial | `appendFileSync` is used and the check runs on every `runSync`. Malformed JSON causes `/sync` issue. However `{}` is reported PASS, `line_hash` is optional, and deleting a prior line's hash defeats edit detection; the check only compares committed/current line counts. |
| CC-14 | met | Pending is checked before fail-closed acceptance statuses and returns `undefined`; named test passes. |
| CC-15 | met | Criteria declarations are parsed into separate arrays, both declaration kinds are excluded, and both arrays are recorded in the artifact. The test explicitly covers out-of-scope exclusion and list separation. |
| CC-16 | met | In-scope not_evaluated blocks; criteria declarations alone control exclusions; absent declaration blocks leave all rows in scope. |
| CC-17 | met | Attributed met rows count as met and are named `(attributed)` in reasons; the green fixture includes one. |
| CC-18 | partial | Schema shape, loop/SHA matching, criteria failures, and human-seat evidence paths are supported. A missing/unreadable `--evidence` file exits 1 before prepare instead of writing the required `undefined` verdict artifact. |
| CC-19 | met | `shadow-verdict prepare` is the only merge point. `runLoop` is unchanged and the runtime-never-merges statement remains. The tracked procedure assigns invocation to the human merge step. |
| CC-20 | partial | Help and successful prepare/decide/summary paths exist with non-zero operational refusals. Usage is not strict: `summary --bogus` exits 0, and an invalid `--gate` silently defaults to `skip`; tests cover help only, not usage errors. |
| CC-21 | cut | Cut by §8 P2 and declared out of scope; not scored. |
| CC-22 | met | Candidate tcm is green: 132 files, 1828 passed, 6 skipped. Base is green: 131 files, 1810 passed, 6 skipped. Candidate adds one file and 18 passing tests and no new failure. Local candidate build, tsc, and the 43 gate/policy tests also exit 0. |
| CC-29 | met | Human-seat verdicts and ledger are under `docs/loops/shadow-merge/`; `git check-ignore` exits 1 for procedure and ledger paths. |
| CC-30 | met | Tracked procedure gives pre-merge prepare and post-merge decide steps and names `origin/master`. Fixture-repo test refuses a merged SHA not reachable from `origin/master`. |

## Declared rows (reported, not scored)

- Unrunnable: CC-23 live prepare/merge/decide; CC-24 production disagreement evidence; CC-25 historical recovery.
- Out of scope: CC-26 docs-only merges; CC-27 alternate harness; CC-28 Jev calibration; CC-21 backfill (cut).

## Test coverage by acceptance row

The candidate adds 17 `shadow-merge.test.ts` tests plus one merge-policy drift assertion. Rows with **no automated
assertion of their distinctive requirement** are: **CC-0, CC-10, CC-13, and CC-19**. CC-22 is asserted by tcm rather
than a product unit test. Partial test-only coverage also leaves CC-1.2, CC-2.2, CC-5.6, CC-6's runtime path and
artifact fields, CC-8.1, CC-9's candidate/loop/merge-SHA fields, CC-11's CLI ledger read, CC-15's unrunnable exclusion,
CC-17's all-attributed case, CC-18's unreadable-E_t behavior, CC-20 usage errors, and CC-29's ignore check unasserted.

## Independent mutants

- `qa/c-mut-artifact` at `3ed9681c6bedddc0c8b37b9c253ac2b7ff51904a`: removes `runtime_checks` from
  artifact inputs. **SURVIVED** run 36389073835: success, 132 files and 1828 tests passed, 6 skipped. It proves the
  required CC-6 artifact-schema assertion is absent.
- `qa/c-mut-ledger-scan` at `3f34789650438c3d0efdf896d1ff64115e068b12`: ignores malformed JSON ledger
  lines. **SURVIVED** run 36389076528: success, 132 files and 1828 tests passed, 6 skipped. It proves the CC-13
  sync/integrity test is absent.

GitNexus impact tooling was unavailable in this session, and the developer handoff records its shared index as 465
commits stale. The mutations are one-site changes on isolated `qa/c-mut-*` branches; this limitation is recorded
rather than presenting grep/static caller inspection as graph evidence. `detect_changes()` was likewise unavailable
before the report commit; ordinary git diff verification below is not represented as an equivalent graph check.

## CI (tcm, no Windows)

Five `ci.yml` workflow-dispatch runs were used (within the six-run cap):

| Purpose | Run | Head SHA | Conclusion |
|---|---:|---|---|
| red | 36388785617 | `970c1b8bcc830c3610b6c181a1dd59b4304381d5` | failure: 1 file / 17 tests failed; 131 files / 1810 tests passed, 6 skipped |
| candidate/full green | 36388788476 | `2035e893497cf37f4224835dd95a7d3838e45cca` | success: 132 files / 1828 tests passed, 6 skipped |
| frozen base/full suite | 36388791175 | `d1e86740bd68827979cfbd5757034f849c38ad41` | success: 131 files / 1810 tests passed, 6 skipped |
| QA artifact mutant | 36389073835 | `3ed9681c6bedddc0c8b37b9c253ac2b7ff51904a` | success (survived): 132 files / 1828 tests passed, 6 skipped |
| QA ledger mutant | 36389076528 | `3f34789650438c3d0efdf896d1ff64115e068b12` | success (survived): 132 files / 1828 tests passed, 6 skipped |

The workflow's `test-windows` job was skipped on every run; no `windows=true` dispatch was made.

The developer's local full-suite exit 1 does **not** reproduce on tcm. Both product and frozen base full suites are
green there, so no candidate failure is new. The product has exactly one additional passing test file and 18
additional passing tests (17 gate tests plus the merge-policy assertion).

## Defects

1. **C-204-1 / blocker / CC-6:** artifact path violates the frozen runtime layout, and deterministic inputs omit
   acceptance and gate summaries.
2. **C-204-2 / blocker / CC-10:** replacement can be recorded without its required new SHA; the CLI can misrecord
   `--replaced` as `declined`.
3. **C-204-3 / blocker / CC-13:** ledger integrity accepts structurally empty lines and permits removal of `line_hash`,
   so prior-line editing is not reliably detected.
4. **C-204-4 / major / CC-18:** unreadable evidence refuses the CLI rather than producing an immutable `undefined`
   verdict as specified.
5. **C-204-5 / major / CC-20:** unknown flags and invalid gate modes are accepted on a mutating boundary.
6. **C-204-6 / major / tests:** the required artifact, non-merge decision, sync-integrity, and usage-error rows have
   no assertions; both independent mutants assess this gap below.

## Open for the planner

- CC-6's SHA directory may be a sensible collision design, but it changes a frozen path and needs a criteria
  amendment; the developer handoff cannot amend it.
- Decide whether the artifact/input and replacement failures require a repaired candidate or whether C is abandoned;
  neither decision blocks this report.

## Model

QA seat: GPT-5.6 Sol (`gpt-5.6-sol-medium`), record 204. Criteria author was Composer 2.5; candidate builder was
Grok 4.7.

## Evidence file

`docs/loops/loop-15-slice-3-c-qa-report.E_t.json` has one acceptance entry for every scored row (CC-21 is cut),
full product SHA, and the QA-run tcm checks. Candidate command
`node build/harness/cli.js validate evidence <file>` exited **0**.

Pre-commit `sync --check` was run and exited **1** on the existing retirements, registered-worktree-layout, and
greeting-size issues; its new `shadow-merge-ledger` check passed the absent-ledger first-use case.

QA-204: REPORT COMPLETE
