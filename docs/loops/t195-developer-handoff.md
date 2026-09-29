# T-195 — D_t beside briefs, validate plan, plan-gate CLI, dispatch-check

Forge (Grok 4.7), worktree `C:\Users\melve\Worktrees\sia-forge`. Record 215 (+ planner turn 219: red evidence, DT-9, push). Base `origin/master` `8467cb1`. No CI (D-061).

## Product branch

`loop/t195-dt-plan-gate` @ **`98acff5`** (pushed). Base `8467cb1`.

## Mutant branches (pushed)

| Branch | SHA | Kills |
| --- | --- | --- |
| `loop/t195-dt-plan-gate-mut-threshold` | `c5da6ea` | DT-3 / DT-5 |
| `loop/t195-dt-plan-gate-mut-pass-on-error` | `908167a` | DT-6 |
| `loop/t195-dt-plan-gate-mut-dispatch-ok` | `4e0cce9` | DT-7 |

## Red evidence (quoted)

| Row | Red (master or mutant) | Failing line / exit |
| --- | --- | --- |
| DT-1 | `8467cb1` CLI has no `validate plan` | `harness validate plan file.json` → usage exit **2**, unknown subcommand path |
| DT-3 | `c5da6ea` inlined `has_observable_acceptance_min: 0.5` | `npx vitest run … -t "DT-5"` exit **1**: promise resolved instead of rejecting on noul **0.55** |
| DT-6 | `908167a` gate error returns exit 0 | `npx vitest run … -t "DT-6"` exit **1**: `refuses missing TYPESAFE_API_KEY` **did not throw**; `refuses transport` **did not throw** |
| DT-7 | `4e0cce9` dispatch-check always ok | `npx vitest run … -t "DT-7"` exit **1**: `expect(check.ok).toBe(false)` for missing gate record — got **true** |
| DT-9 | `98acff5` before reachability check (hypothetical) / orphan fixture | `checkBriefReachableFromMaster` → `HEAD <sha> is not reachable from origin/master <masterSha>` |

## Green (product `98acff5`)

| Command | Exit |
| --- | --- |
| `npx tsc --noEmit -p .` | 0 |
| `npm run build` | 0, stamped `98acff5` |
| `npx vitest run tests/harness/t195-plan-gate.test.ts` | 0, **12** passed |
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
| DT-9 | `checkBriefReachableFromMaster`; orphan branch refused, names HEAD sha |

## ls-remote (read back)

```
git ls-remote origin loop/t195-dt-plan-gate loop/t195-dt-plan-gate-mut-*
```
