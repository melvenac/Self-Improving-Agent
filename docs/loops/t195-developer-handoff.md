# T-195 — D_t beside briefs, validate plan, plan-gate CLI, dispatch-check

Forge (Grok 4.7), worktree `C:\Users\melve\Worktrees\sia-forge`. Record 215 (+ planner turn 221: DT-9 blob compare fix). Base `origin/master` `8467cb1`. No CI (D-061).

## Product branch

`loop/t195-dt-plan-gate` @ **`603be51`** (pushed). Base `8467cb1`.

## Mutant branches (pushed)

| Branch | SHA | Kills |
| --- | --- | --- |
| `loop/t195-dt-plan-gate-mut-threshold` | `c5da6ea` | DT-3 / DT-5 |
| `loop/t195-dt-plan-gate-mut-pass-on-error` | `908167a` | DT-6 |
| `loop/t195-dt-plan-gate-mut-dispatch-ok` | `4e0cce9` | DT-7 |
| `loop/t195-dt-plan-gate-mut-dt9-ancestry` | `8d919d7` | DT-9a/b/c |

## Red evidence (quoted)

| Row | Red (master or mutant) | Failing line / exit |
| --- | --- | --- |
| DT-1 | `8467cb1` CLI has no `validate plan` | `harness validate plan file.json` → usage exit **2**, unknown subcommand path |
| DT-3 | `c5da6ea` inlined `has_observable_acceptance_min: 0.5` | `npx vitest run … -t "DT-5"` exit **1**: promise resolved instead of rejecting on noul **0.55** |
| DT-6 | `908167a` gate error returns exit 0 | `npx vitest run … -t "DT-6"` exit **1**: `refuses missing TYPESAFE_API_KEY` **did not throw**; `refuses transport` **did not throw** |
| DT-7 | `4e0cce9` dispatch-check always ok | `npx vitest run … -t "DT-7"` exit **1**: `expect(check.ok).toBe(false)` for missing gate record — got **true** |
| DT-9a | `8d919d7` HEAD-ancestry only | `npx vitest run … -t "DT-9a"` exit **1**: brief only on side branch — got **ok: true** |
| DT-9b | `8d919d7` HEAD-ancestry only | `npx vitest run … -t "DT-9b"` exit **1**: working-tree edit — got **ok: true** |
| DT-9c | `8d919d7` HEAD-ancestry only | `npx vitest run … -t "DT-9c"` exit **1**: D_t absent on master — got **ok: true** |

## Green (product `603be51`)

| Command | Exit |
| --- | --- |
| `npx tsc --noEmit -p .` | 0 |
| `npm run build` | 0, stamped `603be51` |
| `npx vitest run tests/harness/t195-plan-gate.test.ts` | 0, **14** passed |
| `npx vitest run tests/harness/policies.test.ts tests/harness/gate.test.ts tests/harness/b2-et.test.ts tests/harness/cli.test.ts` | 0, **93** passed |

## Rows (summary)

| Row | Test / command |
| --- | --- |
| DT-1 | `t195-plan-gate.test.ts` DT-1; `harness validate plan` |
| DT-2 | `runBriefPlanGate` prints `source …` per field |
| DT-3 | `policies.test.ts` A6 + mutant `c5da6ea` red |
| DT-4 | two `.G_plan.*.json` files, no overwrite |
| DT-5 | rejection feedback names threshold |
| DT-6 | missing key / transport error exit 1; mutant `908167a` red |
| DT-7 | `dispatch-check` + `checkBriefDispatchReady`; mutant `4e0cce9` red |
| DT-8 | preserved harness suites unchanged |
| DT-9 | `checkBriefReachableFromMaster` blob compare to `origin/master`; DT-9a–d; mutant `8d919d7` red on 9a/b/c |

## ls-remote (read back)

```
603be51e4c0a639ef08a0d04fc02fce6669aba02	refs/heads/loop/t195-dt-plan-gate
c5da6ea3b2972a6edf1109d9182f9c82a0aa71fa	refs/heads/loop/t195-dt-plan-gate-mut-threshold
908167ad70d5d5c04b27177dddbacaef355f457f	refs/heads/loop/t195-dt-plan-gate-mut-pass-on-error
4e0cce95991722539fc2c4f80736259b6d72c337	refs/heads/loop/t195-dt-plan-gate-mut-dispatch-ok
8d919d75a61045b59a1c048291dc74c9b152dfe4	refs/heads/loop/t195-dt-plan-gate-mut-dt9-ancestry
```
