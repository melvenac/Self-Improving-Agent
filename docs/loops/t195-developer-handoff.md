# T-195 — D_t beside briefs, validate plan, plan-gate CLI, dispatch-check

Forge (Grok 4.7), worktree `C:\Users\melve\Worktrees\sia-forge`. Record 215. Base `origin/master` `8467cb1`. No CI (D-061). GitNexus impact not run: index stale in this seat.

## Product

- `harness validate plan <file>` — schema validation with exit 0 / 1 / 2 mirroring evidence.
- `harness plan-gate <D_t.json> [--brief path] [--mode live|dry-run]` — runs Jev plan gate; writes append-only `<brief-stem>.G_plan.<iso>.json` beside the brief.
- `harness dispatch-check <brief.md>` — refuses dispatch without valid `<stem>.D_t.json` and a passing **live** gate record (not CI; D-055).

Sidecar convention: `foo-brief.md` → `foo-brief.D_t.json`, `foo-brief.G_plan.*.json`.

## Local runs (green)

| Command | Exit |
| --- | --- |
| `npx tsc --noEmit -p .` | 0 |
| `npm run build` | 0, stamped `8467cb1` |
| `npx vitest run tests/harness/t195-plan-gate.test.ts` | 0, 10 passed |
| `npx vitest run tests/harness/policies.test.ts tests/harness/gate.test.ts tests/harness/b2-et.test.ts tests/harness/cli.test.ts` | 0, 93 passed |

## Rows

| Row | Red | Green |
| --- | --- | --- |
| DT-1 | `t195-plan-gate.test.ts` DT-1 without `validate plan` subcommand (master CLI) | same test, exit 0/1/2 |
| DT-2 | no `brief-plan-gate.ts` | `runBriefPlanGate` prints `source …` lines |
| DT-3 | mutant `loop/t195-dt-plan-gate-mut-threshold` inlines `has_observable_acceptance_min: 0.5` | policy file drives threshold |
| DT-4 | single-record overwrite would fail second-path assertion | two `.G_plan.*.json` files |
| DT-5 | low noul without feedback text | rejection names threshold |
| DT-6 | missing key / stub transport error exits 1 | `t195-plan-gate.test.ts` DT-6 |
| DT-7 | `dispatch-check` before live gate | ok after live proceed record |
| DT-8 | N/A on master paths | policies/gate/b2-et/cli suites unchanged |

## Mutant

Branch `loop/t195-dt-plan-gate-mut-threshold`: hardcodes acceptance min in `runBriefPlanGate` instead of `loadPolicies()`. Vitest DT-3 still passes on product branch; manual diff shows bypass.

## Not pushed

Planner hold per record 215. Post local SHA to hub; push when QA machines clear.
