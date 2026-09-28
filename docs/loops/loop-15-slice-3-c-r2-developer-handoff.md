# Loop 15 slice 3 candidate C, round 2 — developer handoff

Forge, Grok 4.7, worktree `C:\Users\melve\Worktrees\sia-forge`. Record 201 r2, after QA 204 rejected `2035e89`. Criteria `23ebd86` (§9). Same branch, same base `d1e8674`. No CI. GitNexus impact was not run; the index is still hundreds of commits behind and the tools are not in this session.

## What changed

- The verdict artifact's `inputs` now carry `runtime_checks`, an acceptance summary, `gates.plan` and `gates.done`, and the two declared lists. The runtime path stays `artifacts/iterations/<loop>/<candidate_sha>/shadow_merge.json`, which §9 now names.
- `decide --replaced` and `decideShadowVerdict` refuse a missing or non-40-hex sha. A bare `--replaced` is a usage error and is not stored as `declined`.
- The ledger check treats an empty line, a missing `line_hash`, and a line that differs from the committed ledger as issues.
- Unreadable evidence still writes an immutable `undefined` artifact.
- Unknown flags and an invalid `--gate` are refused.
- Asserting tests were added for CC-0, CC-10, CC-13, and CC-19.

`EvidenceSchema`, `declared.ts`, and `runLoop` are unchanged.

## Local runs

Red, tests only, `103fba7` on the rejected product. `npx vitest run tests/harness/shadow-merge.test.ts --reporter=verbose` exit **1**. **6 failed | 19 passed (25).**

- CC-20 `summary --bogus`: expected status not 0, received 0.
- CC-10 bare `--replaced`: stderr was `no verdict at ... prepare comes first`, which does not match `--replaced`.
- CC-6: `Cannot read properties of undefined (reading 'map')` on `inputs.acceptance`.
- CC-10 function: `decideShadowVerdict({ action: "replaced" })` did not throw.
- CC-13: `{}` was severity `pass`, expected `issue`.
- CC-18: missing evidence file exited 1, `ENOENT`, expected 0 and an `undefined` artifact.

Green, `8054f9fd35394eb77a639206611bf3320983527d`. `npx tsc --noEmit -p .` exit **0**. `npm run build` exit **0**, stamped `8054f9f`. `npx vitest run tests/harness/shadow-merge.test.ts tests/harness/spawn-sites.test.ts tests/harness/policies.test.ts` exit **0**. **Test Files 3 passed. Tests 59 passed.**

## Mutants

Each is one commit off `8054f9f`, message starts `NOT FOR MERGE`, `npx tsc --noEmit -p .` exit 0, then the named row fails (vitest exit 1).

| Branch | SHA | Failing line |
|---|---|---|
| `loop/15-slice-3-candidate-c-r2-mut-artifact` | `dd2e9c40ae75e9d39cc454c3259b20825369932d` | CC-6 `inputs.acceptance` is undefined (`reading 'map'`) |
| `loop/15-slice-3-candidate-c-r2-mut-replaced` | `59e7d21136934e3c92e76ce700ba11341407640c` | CC-10 `action: "replaced"` with no sha did not throw |
| `loop/15-slice-3-candidate-c-r2-mut-ledger` | `75c6f82fcd6c95b7a59b3004383224e0a2728bea` | CC-13 `{}` message was `missing shadow_verdict`, not `line_hash` |
| `loop/15-slice-3-candidate-c-r2-mut-evidence` | `e1f873f20ddd40991ea9d0db4d91a8bd21c74a09` | CC-18 missing evidence exited 1 `ENOENT`, expected 0 |
| `loop/15-slice-3-candidate-c-r2-mut-flags` | `5e8f1ce5f6b24d03c3bbf2d26abf62e11817a5d2` | CC-20 `summary --bogus` exited 0 |
