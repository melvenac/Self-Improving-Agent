# T-152: type-checking the tests, MEASURED (stopped above 30), developer handoff

**By:** Forge (developer seat, `sia-forge`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t152-typecheck-tests` from `origin/master` `8b7aa952`. **Dispatch:** atlas-sia, session 157 (LIGHT, measure first).

## Result: 40 errors, above the 30 you set, so I STOPPED. No test was edited, CI is unchanged, no PR opened.

The branch carries only the measuring instrument and this table, so the numbers are in a tracked file and not only in A2A.

## What was added

- `open-brain/tsconfig.tests.json`: extends `./tsconfig.json`; `noEmit`, `rootDir: "."` (the base's `rootDir: "./src"` makes tests outside it an error, TS6059), `declaration` and `sourceMap` off; `include: ["src/**/*", "tests/**/*"]`.
- `open-brain/package.json`: `"typecheck:tests": "tsc -p tsconfig.tests.json"`. It exits 2 today. It is NOT in CI's test job (CI runs `npx tsc --noEmit`, which never reads `tests/`, T-152's finding). Runtime about 4 seconds.

## Table: 40 errors in 21 files

| Category | Errors | What it is |
| --- | --- | --- |
| **A. Fixture lags a src type** (missing, renamed or removed fields) | 20 | the test builds an object the current type no longer accepts |
| **B. Residue of cut features** (the T-215 family) | 4 | tests still naming `successRate` and `maturityBoost` |
| **C. Test-side typing** (`unknown`, inferred `never[]`, `null` vs `undefined`, mock signatures) | 16 | the test is loosely typed; src is not implicated |

| File | n | Code(s) | Category | Shape |
| --- | --- | --- | --- | --- |
| `session-start/handoff-provenance.test.ts` | 5 | TS2345 | A | `set_handoff` args typed as `seat: string`, not the `SeatName` union (lines 174, 191, 206, 229, 230) |
| `harness/policies.test.ts` | 4 | TS2345 | A | `PlanGateContext` objects missing fields (244, 254, 267, 275) |
| `rating-method.test.ts` | 4 | TS2571, TS2322 | C | `unknown` JSON reads (56, 155, 161); `null` for `string \| undefined` (46) |
| `session-start/state-render.test.ts` | 3 | TS2739 | A | handoff literals missing `session_uuid`, `checkout`, `first_rev` (280, 293, 294) |
| `sync/checks.test.ts` | 3 | TS2322 | C | `allowed_referrers` inferred `never[]` (936, 953, 963) |
| `sync/t048-r1b.test.ts` | 3 | TS2345 | C | `fs` functions passed where `(...a: unknown[]) => unknown` is expected (28-30) |
| `trigger/fires.test.ts` | 3 | TS2739 | A | policy literal missing a property of `TriggerPolicy` (20, 126, 162) |
| `ranking.test.ts` | 2 | TS2305, TS2353 | B | imports `maturityBoost` (no longer exported); `successRate` not in `KnowledgeIndexInput` (4, 32) |
| `db-v2.test.ts` | 1 | TS2571 | C | `unknown` (48) |
| `harness/gate-artifacts.test.ts` | 1 | TS2339 | A | `note` not on `Record_` (231) |
| `harness/gate.test.ts` | 1 | TS2353 | A | `legend` not on `GateQuestion` (16) |
| `harness/s4-g5-qa.test.ts` | 1 | TS2551 | C | key `sev:requirements:R1` not in the literal's type (252) |
| `harness/shadow-merge.test.ts` | 1 | TS2322 | C | a module namespace assigned to a function-shaped type (28) |
| `index-upsert.test.ts` | 1 | TS2353 | B | `successRate` (126); **already removed by T-215 / PR #294** |
| `session-start/drift-detector.test.ts` | 1 | TS2739 | A | state literal missing fields (6) |
| `state-import.test.ts` | 1 | TS2741 | A | `template_copy` missing (52) |
| `sync/scorer.test.ts` | 1 | TS2353 | A | `lastShadowRecall` not in `PipelineHealthInput` (116) |
| `relocate.test.ts` | 1 | TS2322 | C | `null` for `string \| undefined` (147) |
| `shadow-strategies.test.ts` | 1 | TS2353 | B | `successRate` (33) |
| `shared/state-schema.test.ts` | 1 | TS2339 | C | `.data` read without narrowing a `ParseResult` (125) |
| `topics.test.ts` | 1 | TS2322 | C | `string \| null` for `string \| undefined` (41) |

By code: TS2345 12, TS2322 7, TS2739 7, TS2353 5, TS2571 4, TS2339 2, TS2551 1, TS2741 1, TS2305 1.

## Findings (not fixed, per the brief)

- **No error is confirmed as "the test is right and src is wrong".** I did not open each site. The one worth a look before anyone edits it is `harness/shadow-merge.test.ts:28` (a module namespace where a function-shaped type is expected), which may mean src exports a shape the test cannot call.
- **Category A is the substantive one:** 20 places where a fixture drifted from a type that src changed. Several (handoff-provenance, state-render) sit around the schema v3 handoff fields, so they ran green only because the runtime does not validate the literal.
- **Category B overlaps PR #294 (T-215):** one of the four (`index-upsert.test.ts:126`) is already fixed there; `ranking.test.ts` and `shadow-strategies.test.ts` still carry `successRate`, and `maturityBoost` is imported in `ranking.test.ts` but no longer exists. Fixing B in this task would collide with #294.

## Options for your ruling

1. **Fix all 40 in one PR** (test files only; C is mechanical, A needs the right fields per fixture, B waits for or stacks on #294), then add `npm run typecheck:tests` to CI's test job.
2. **Split:** C and A now (36), B after #294 merges, CI enforcement with the last PR.
3. **Enforce by ratchet:** add the script to CI with an allowed-error count of 40 that may only go down, and fix by file.

I would take 2: A is where the value is, and B is cheap once #294 is in.
