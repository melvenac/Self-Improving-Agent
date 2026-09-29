# T-195 r2 QA report — record 222

## Verdict

**ACCEPT.** Candidate `647cc74ebb66eae6cd36acc9c09d0804b2972387` closes all four QA-216 findings and
meets DT-1 through DT-8 plus DT-9a through DT-9d. Exact-candidate and exact-base tcm suites both passed, so there is
no new full-suite failure.

Base: `8467cb10837d2da4b13237c22a8be4e8bc5d6a1a`. No live Jev call was made.

## Acceptance rows

### DT-1 — met

The candidate focused run passed 117/117 across `spawn-sites`, `t195-plan-gate`, `policies`, `gate`, `b2-et`, and
`cli`. The DT-1 test showed `validate plan` exits 0 for valid input, exits 1 with every schema problem and field path,
and exits 2 for usage error.

### DT-2 — met

The focused test exercised `runBriefPlanGate` and found the five HOH-JEV fields: `spec_excerpt`, `plan_summary`,
`prior_failures`, `validated_behaviours`, and `changed_area_hints`. Its decision record names each source:
brief markdown, `D_t.objective`, `D_t.repair_targets` plus optional `state.json gaps[]`, `D_t.preserve` plus optional
`state.json verified[]`, and `D_t.tasks + D_t.out_of_scope`.

### DT-3 — met

The focused policy tests passed. Reapplying `c5da6ea` to the r2 candidate typechecked, then the DT-5 test went red:
the inlined 0.5 threshold incorrectly let 0.55 proceed instead of applying `plan-gate.json`'s 0.7.

### DT-4 — met

QA repeated the prior same-timestamp probe independently. Two live-stub calls at
`2026-09-29T01:00:00.000Z` produced:

- `probe.G_plan.2026-09-29T01-00-00.000Z.json`
- `probe.G_plan.2026-09-29T01-00-00.000Z-1.json`

The first file stayed byte-identical after the second call, both records existed, and the second carried its own
note. Source inspection confirmed allocation chooses an unused suffix and creation uses `openSync(path, "wx")`.
QA-owned mutant `55803845` ignored the suffix; it typechecked and the same-timestamp test failed with
`cannot allocate gate record`.

### DT-5 — met

The focused test rejected `has_observable_acceptance = 0.55` against the policy minimum 0.7 and checked actionable
feedback. The threshold mutant above killed this behavior.

### DT-6 — met

`C:\qa-scratch\qa222\t195-r2-probe.mjs` used only fixture environments and stub fetch implementations. Each case
refused with exit 1 and named its cause:

- missing key: `TYPESAFE_API_KEY is not set`;
- transport: `transport (HTTP none)` and `QA transport sentinel`;
- non-2xx: `unexpected-status (HTTP 503)`;
- malformed envelope: `malformed-response (HTTP 200)` and `body has no answers map`.

Reapplying `908167a` typechecked; both focused DT-6 tests went red because failures returned exit 0.

### DT-7 — met

The mechanism is now `harness dispatch <brief> --say <message> --repo <root>`. `runBriefDispatch` calls
`checkBriefDispatchReady` before the only `transport.send` call. With the stub transport, a refused check returned
`ok: false` and left `sent` false. The built command independently exited 1 and emitted zero stdout bytes while
refused.

After a passing live-stub record, the same built command exited 0 and emitted exactly:

`QA hub payload sentinel\n`
`dispatch: sent\n`

Thus the payload that the hub caller would send is absent on refusal and appears only after the check passes. The
default in-repo transport is stdout—the live hub adapter is outside this candidate, as the source itself states—but
the send call is structurally unreachable without the check. Reapplying r2 mutant `b450ad5` typechecked and the
new DT-7 test went red at `expect(blocked.ok).toBe(false)`, received `true`.

### DT-8 — met

`git diff --exit-code` against the base showed no changes to `schema.ts`, `runtime.ts`, `gate.ts`, `policies.ts`,
`policies/plan-gate.json`, or `policies/developer-done.json`. The focused preservation set passed 117/117 and the
exact-candidate full suite passed on tcm.

### DT-9a — met

The focused real-git test refused a brief committed only on a side branch and named its absence on
`origin/master`. The ancestry mutant made this test red.

### DT-9b — met

The focused real-git test put HEAD at the master content, modified the brief in the working tree, and refused it as
different from the named `origin/master` SHA. The ancestry mutant made this test red.

### DT-9c — met

The focused test refused a D_t absent on `origin/master`. The ancestry mutant made this test red.

### DT-9d — met

The focused test passed when brief and D_t disk blobs matched `origin/master`. It remained green under the ancestry
mutant, while DT-9a/b/c went red.

## Mutants

All supplied mutations were reapplied to `647cc74`, not merely run at their old branch bases.

| Mutant | Typecheck | Kill |
| --- | --- | --- |
| `c5da6ea` threshold inline | pass | DT-5 red: 0.55 incorrectly proceeded |
| `908167a` pass on error | pass | two DT-6 tests red: failure resolved at exit 0 |
| `b450ad5` dispatch without check | **pass** | DT-7 red: blocked result was `true` and send became reachable |
| `8d919d7` ancestry-only | pass | DT-9a/b/c red; DT-9d green |
| QA `qa/t195-r2-mut-collision-suffix` `55803845ca57748ae74b8e7c62cf9ab6fa8e1552` | pass | DT-4 same-timestamp test red |

The QA mutant branch was pushed and read back only through `docs/loops/qa-222/push-qa.mjs`.

## CI

No run used `windows=true`.

| Run | Ref | Head SHA | Run conclusion | `test` job |
| --- | --- | --- | --- | --- |
| `36515473117` | `qa/t195-r2-ci-candidate` | `647cc74ebb66eae6cd36acc9c09d0804b2972387` | success | **success** |
| `36515473106` | `qa/t195-r2-ci-base` | `8467cb10837d2da4b13237c22a8be4e8bc5d6a1a` | success | **success** |
| `36516145049` | `qa/t195-r2-mut-collision-suffix` | `55803845ca57748ae74b8e7c62cf9ab6fa8e1552` | failure | **failure** |

Both are SHA-exact push runs whose tcm `test` jobs executed Typecheck and Test. No candidate failure is new because
neither run failed. The candidate's `spawn-sites.test.ts` regression from QA 216 is green within both the full suite
and the local focused run; that focused file also kept all six planted git-spawn forms and its planted
unclassified non-git spawn biting.

The QA mutant run typechecked, then failed the intended DT-4 same-timestamp test with
`cannot allocate gate record beside ...sample-brief.md`. It also hit an unrelated moving-`origin/master`
`state-schema.test.ts` assertion; the target kill is independently isolated by the local one-test mutant run.

Evidence validation against the candidate build:
`node build/harness/cli.js validate evidence C:/qa-scratch/qa222/report/docs/loops/t195-r2-qa-report.E_t.json`
— exit 0.

## Defects

None found in this r2 acceptance scope. All rows that QA 216 scored met remain met, and its four findings are closed.

Pre-commit `sync --check` exited 1 on inherited repository-wide issues: retirements in `ENTITIES.md`, the registered
QA scratch-worktree layout, greeting size, and current master CI status. It named neither report artifact nor a
candidate source change.

## Open for the planner

No question blocks disposition. Recommendation: accept r2. The first real Jev call remains the brief's named
post-merge live observation.

## Model

QA seat: GPT-5.6 Sol, medium effort. The candidate was built by Grok 4.7. No live Jev call was made.

QA-222: REPORT COMPLETE
