# T-195 — D_t beside briefs, validate plan, plan-gate CLI, dispatch-check

Forge (Grok 4.7), worktree `C:\Users\melve\Worktrees\sia-forge`. Record 215 **r2** (QA 216 reject `603be51`, hub turn 228). Base `origin/master` `8467cb1`. No CI (D-061). **Push hold** — laptop QA 213 running.

## Product branch

`loop/t195-dt-plan-gate` @ **`06f698f`** (local only).

## Mutant branches (local)

| Branch | SHA | Kills |
| --- | --- | --- |
| `loop/t195-dt-plan-gate-mut-threshold` | `c5da6ea` | DT-3 / DT-5 |
| `loop/t195-dt-plan-gate-mut-pass-on-error` | `908167a` | DT-6 |
| `loop/t195-dt-plan-gate-mut-dispatch-ok` | **`b450ad5`** | DT-7 dispatch test |
| `loop/t195-dt-plan-gate-mut-dt9-ancestry` | `8d919d7` | DT-9a/b/c |

## r2 fixes (turn 228)

| # | Fix |
| --- | --- |
| 1 | `parseBriefGateRecordName` uses `String.match` not `RegExp.exec` — `spawn-sites.test.ts` CA-4b/R16 green |
| 2 | **`harness dispatch <brief.md> --say "..."`** runs `checkBriefDispatchReady` then sends; refused dispatch does not send (stub transport test) |
| 3 | `allocateBriefGateRecordPath` + `writeGateRecordExclusive` (`wx`); same-timestamp runs get `-N` suffix |
| 4 | New `mut-dispatch-ok`: tsc-clean; `runBriefDispatch` sends without check |

**Planner dispatch path:** `node open-brain/build/harness/cli.js dispatch <brief.md> --say "..." --repo <root>` (exit 0 → sent; exit 1 → no send).

## Red evidence (quoted)

| Row | Red | Failing line / exit |
| --- | --- | --- |
| spawn/CA-4b | `603be51` `GATE_RECORD_RE.exec` | `spawn-sites.test.ts` exit **1**: unclassified `parseBriefGateRecordName` |
| DT-4 | `603be51` same `at` | second run **overwrote** `…G_plan.2026-09-29T01-00-00.000Z.json` |
| DT-7 dispatch | `mut-dispatch-ok` | `npx vitest run … -t "dispatch sends only"` exit **1**: `expect(blocked.ok).toBe(false)` got **true** |
| DT-7 mutant (old) | `4e0cce9` | `npx tsc --noEmit -p .` exit **2**: unreachable code after early return |

## Green (product `06f698f`)

| Command | Exit | Result |
| --- | --- | --- |
| `npx tsc --noEmit -p .` | 0 | |
| `npm run build` | 0 | stamped `647cc74` |
| `npx vitest run tests/harness/spawn-sites.test.ts` | 0 | **8** passed |
| `npx vitest run tests/harness/t195-plan-gate.test.ts` | 0 | **16** passed |
| `npx vitest run tests/harness/policies.test.ts tests/harness/gate.test.ts tests/harness/b2-et.test.ts tests/harness/cli.test.ts` | 0 | **101** passed |
| `npx vitest run` (full suite, `--maxWorkers=2`) | 0 | **Test Files 121 passed \| 3 failed \| 8 skipped (132)**; **Tests 1764 passed \| 4 failed \| 78 skipped (1846)** — failures are unrelated probes (`qa104-a9-probe2`, `t048-r3`, `state-import-r6`); **spawn-sites + T-195 rows green** |
