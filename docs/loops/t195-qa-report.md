# T-195 QA report — record 216

## Verdict

**REJECT / return to Forge.** The candidate implements most of the requested surface, but it is not merge-ready:

1. exact-candidate tcm CI is newly red while the exact base is green;
2. DT-7 is only a standalone checker and is not called by the planner's actual dispatch path; and
3. DT-4's timestamp-only filename can overwrite an existing decision record.

Candidate: `603be51e4c0a639ef08a0d04fc02fce6669aba02` (`origin/loop/t195-dt-plan-gate`). Base:
`8467cb10837d2da4b13237c22a8be4e8bc5d6a1a`.

## Acceptance rows

### DT-1 — met

`npx vitest run tests/harness/t195-plan-gate.test.ts` passed 14/14 on the candidate. Its DT-1 case ran
`harness validate plan`: valid exit 0; invalid exit 1 with the full `validatePlan` problem list and field paths; missing
file argument exit 2.

### DT-2 — met

The focused suite exercised `runBriefPlanGate` and showed the HOH-JEV fields `spec_excerpt`, `plan_summary`,
`prior_failures`, `validated_behaviours` and `changed_area_hints`. The record names each source: brief markdown,
`D_t.objective`, `D_t.repair_targets` plus optional `state.json gaps[]`, `D_t.preserve` plus optional
`state.json verified[]`, and `D_t.tasks + D_t.out_of_scope`.

### DT-3 — met

`npx vitest run tests/harness/policies.test.ts tests/harness/gate.test.ts tests/harness/b2-et.test.ts
tests/harness/cli.test.ts` passed 93/93. Reapplying Forge's threshold mutation to `603be51` produced `aab12f3`;
typecheck passed, and DT-5 failed because 0.55 incorrectly proceeded under the inlined 0.5 threshold. Exit 1.

### DT-4 — partial

Two runs at distinct timestamps produced two records in the focused suite. The record includes verdict, answer,
applied thresholds, policy SHA-256, resolved model and times.

The absolute "never overwritten" requirement is not met. QA ran two passing stub calls with the same injected
`at = 2026-09-29T01:00:00.000Z`. Both resolved to the same path and the second changed that file's content:

`DT-4 same-time collision: OVERWROTE ...\probe.G_plan.2026-09-29T01-00-00.000Z.json`

Allocation needs collision handling, and creation should be exclusive rather than plain `writeFileSync`.

### DT-5 — met

The focused test rejected `has_observable_acceptance = 0.55` against the policy's 0.7 minimum and checked that the
feedback names the question, value and threshold. The threshold mutant above killed this row.

### DT-6 — met

`node docs/loops/qa-216/t195-probe.mjs` used fixture environments and stub transports only—never inherited
`process.env`, and no live Jev request. Every case refused with exit 1 and named its cause:

- missing key: `TYPESAFE_API_KEY is not set`;
- transport: `transport (HTTP none)` and `QA transport sentinel`;
- non-2xx: `unexpected-status (HTTP 503)`;
- malformed envelope: `malformed-response (HTTP 200)` and `body has no answers map`.

Forge's pass-on-error mutation reapplied to `603be51` as `4fa65b3`, typechecked, and made both focused DT-6 tests
resolve at exit 0; the tests killed it with exit 1.

### DT-7 — partial

Forge chose `harness dispatch-check`, backed by `checkBriefDispatchReady`. The focused test showed refusal without a
D_t, without a live passing record, and with an invalid D_t. The command is a tool, not yet a gate: repository search
found no caller outside its own CLI and tests, and nothing in the planner's actual dispatch path invokes it.

The planner driver or hub/A2A dispatch wrapper must call
`node open-brain/build/harness/cli.js dispatch-check <brief.md> --repo <root>` immediately before sending the
dispatch, and must stop on its nonzero exit.

Forge's exact one-line dispatch-ok mutation, reapplied as `cbd7383`, was killed by DT-7, but it did **not** satisfy
the brief's mutant precondition: `npx tsc --noEmit -p .` failed because the unconditional return made the later
validation branch unreachable to TypeScript narrowing.

### DT-8 — met

Diff against `8467cb1` showed no changes to `schema.ts` (`validate evidence`), `runtime.ts` (runtime plan gate),
`gate.ts`, `policies.ts`, `policies/plan-gate.json`, or `policies/developer-done.json`. The unchanged preservation
suites passed 93/93. The candidate's full-suite regression is separately recorded below.

### DT-9a — met

The focused test refused a side-branch-only brief, naming its path and the `origin/master` SHA. The HEAD-ancestry
mutant `8d919d7` typechecked and made DT-9a red.

### DT-9b — met

QA cloned a scratch repository, checked out `603be51`, used the real tracked brief
`docs/loops/session-147-dispatches.md`, committed a valid D_t beside it as scratch `origin/master`, then edited the
brief in the working tree. `dispatch-check` exited 1 and printed:

`docs/loops/session-147-dispatches.md: differs from origin/master <40-character SHA>`

The ancestry mutant made DT-9b red.

### DT-9c — met

The focused test refused a D_t absent on `origin/master`. The ancestry mutant made DT-9c red. QA's independent
`qa/t195-mut-skip-dt-content` mutant also made DT-9c red locally and in tcm.

### DT-9d — met

The focused test passed when the brief and D_t disk blobs exactly matched their blobs on `origin/master`.

## Mutants

### Supplied

| Mutant | Reapplied SHA / source SHA | Typecheck | Kill |
| --- | --- | --- | --- |
| inlined threshold | `aab12f3` from `c5da6ea` | pass | DT-5, focused exit 1 |
| pass on gate error | `4fa65b3` from `908167a` | pass | DT-6, two focused failures, exit 1 |
| dispatch always okay | `cbd7383` from `4e0cce9` | **fail** | DT-7 also failed, but mutant is invalid under the brief's rule |
| HEAD ancestry only | `8d919d7` | pass | DT-9a/b/c failed; DT-9d stayed green |

### QA-owned

| Branch | SHA | Mutation | Evidence |
| --- | --- | --- | --- |
| `qa/t195-mut-record-overwrite` | `ce964097752bceacb557f9af121ca526aa311fed` | force every decision record to `.G_plan.latest.json` | typecheck passed; DT-4 and monotonic-path tests failed locally; tcm run `36506353596`, `test` failure |
| `qa/t195-mut-skip-dt-content` | `9af3250be1a6b81601fac51fed9d6fd80221b651` | check only the brief blob, not D_t | typecheck passed; DT-9c failed locally; tcm run `36506562179`, `test` failure |

Both branches were pushed and read back through `docs/loops/qa-216/push-qa.mjs`.

## CI

No run used `windows=true`.

| Run | Trigger / ref | Head SHA | Run conclusion | `test` job |
| --- | --- | --- | --- | --- |
| `36503607220` | QA push, `qa/t195-ci-candidate` | `603be51e4c0a639ef08a0d04fc02fce6669aba02` | failure | **failure** |
| `36503973763` | QA push, `qa/t195-ci-base` | `8467cb10837d2da4b13237c22a8be4e8bc5d6a1a` | success | **success** |
| `36505511183` | `gh workflow run`, candidate ref | `603be51e4c0a639ef08a0d04fc02fce6669aba02` | skipped | skipped |
| `36505513935` | `gh workflow run`, base ref | `8467cb10837d2da4b13237c22a8be4e8bc5d6a1a` | skipped | skipped |

The SHA-exact QA push runs are the full-suite evidence: each executed the tcm `test` job. The two requested manual
dispatches were attempted, but these old refs predate #200's workflow fix; their `changed` job is skipped on
`workflow_dispatch`, and the dependent `test` job is consequently skipped too. They are not counted as green.

Candidate run `36503607220`: Typecheck succeeded. Test failed with 1 file failed / 131 passed and 2 tests failed /
1836 passed / 6 skipped. Both failures were in `tests/harness/spawn-sites.test.ts`: its AST scanner classifies
`GATE_RECORD_RE.exec(name)` inside `parseBriefGateRecordName` as an unclassified child-process `exec`.

Base run `36503973763`: the `test` job succeeded. Therefore the candidate failure is new.

Evidence validation against the candidate build:
`node build/harness/cli.js validate evidence ../docs/loops/t195-qa-report.E_t.json` — exit 0.

Pre-commit `/sync` fallback, `node open-brain/build/cli.js sync --check`, ran and exited 1 without modifying files.
Its issues were repository-wide and inherited: retired names in `ENTITIES.md`, registered historical QA worktree
folder names, and greeting size. None names either T-195 QA artifact.

## Defects

1. **Blocker — full-suite regression.** `parseBriefGateRecordName` uses `RegExp.exec`; the preserved spawn-site guard
   treats any `.exec(...)` property call as a process spawn. Fix the implementation or improve the guard without
   weakening its planted-positive coverage.
2. **Major — DT-7 is not wired.** `dispatch-check` has no caller in the planner's dispatch route. Wire the last-mile
   dispatch mechanism and test that a refused check prevents the send.
3. **Major — DT-4 can overwrite.** Timestamp-only allocation plus non-exclusive write violates "records are never
   overwritten." Add collision-safe allocation and an exclusive-create test.
4. **Minor — supplied dispatch mutant is invalid.** The required reapplication does not typecheck on `603be51`, so it
   cannot count as mutation evidence under the brief's common rule.

## Open for the planner

No question blocks disposition. Recommendation: return all three merge blockers together; DT-9 itself is sound.

## Model

QA seat: GPT-5.6 Sol, medium effort. No live Jev call was made.

QA-216: REPORT COMPLETE
