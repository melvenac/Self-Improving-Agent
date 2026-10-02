# T-152: type-checking the tests, MEASURED (stopped above 30), developer handoff

**By:** Forge (developer seat, `sia-forge`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t152-typecheck-tests` from `origin/master` `8b7aa952`. **Dispatch:** atlas-sia, session 157 (LIGHT, measure first).

## Round 1 result: 40 errors, above the 30 you set, so I STOPPED. (Round 2 below: 4 remain.)

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

## Round 2 (planner ruling, session 157): categories A and C fixed in test files only

**40 to 4.** `npm run typecheck:tests` now reports exactly the **4 category-B errors** (`ranking.test.ts:4` and `:32`, `index-upsert.test.ts:126`, `shadow-strategies.test.ts:33`), which wait for #294. 18 test files changed; no `src/` file and no CI change. `tsc --noEmit` on src is still 0, and the 18 touched test files pass (369 tests). The enforcement PR (`typecheck:tests` into CI's test job) comes after B, as ruled.

**`harness/shadow-merge.test.ts:28`: the TEST is wrong, src is fine.** The loader declares each function as taking `Record<string, unknown>`; src takes narrower input objects (`computeShadowMergeVerdict` wants `evidence`, `candidateSha`, `policy` and so on), and a function that needs more cannot be called as one that accepts anything. The test builds its inputs by hand as loose records on purpose, so the fix is one `as unknown as` at the loader's boundary, with a comment. No finding against src.

How each group was fixed. All are behaviour-neutral; where a value had to be chosen it is the one the code already treated the missing field as.

| Files | Fix | Why it changes nothing |
| --- | --- | --- |
| `harness/policies.test.ts` (4) | `hasPriorFailures: false` on the plan-gate contexts | the rule reads `!ctx.hasPriorFailures`; undefined and false are the same |
| `trigger/fires.test.ts` (3) | `deadline_ms: 2000, provenance: 'test fixture'` | `runTrigger` reads only `relevance_floor` and `max_injected` (`run.ts:96-97`) |
| `session-start/state-render.test.ts` (3) | `session_uuid`, `checkout`, `first_rev` set to `null` on the in-memory State literals | the legacy-entry shape the renderer already handles |
| `session-start/handoff-provenance.test.ts` (5) | a cast helper `asCurrent` at the five `findHandoffCommit` calls | the fixtures are also WRITTEN to disk as v2 JSON, so they must not gain v3 fields |
| `session-start/drift-detector.test.ts` (1) | `sizes: []` and `stateJson: { present: false, valid: false }` | `detectDrift` reads neither |
| `state-import.test.ts` (1) | `template_copy: false` | the reader is `if (r.inbox.template_copy)`; undefined and false are the same |
| `sync/scorer.test.ts` (1) | dropped `lastShadowRecall: null` | the field is gone from the type and was never read |
| `harness/gate.test.ts` (1) | dropped `legend: ["no", "yes"]` | see finding 1 |
| `harness/gate-artifacts.test.ts` (1) | `note?: string` on the local `Record_` type | the file already reads `.note` at runtime |
| `rating-method` (4), `relocate` (1), `topics` (1) | `projectDir: undefined` for `null`; pragma results cast to `Array<{ name: string }>` | `indexKnowledge` does `input.projectDir ?? null` |
| `db-v2` (1), `sync/checks.test` (3), `sync/t048-r1b` (3), `harness/s4-g5-qa` (1), `shared/state-schema` (1) | typed casts and annotations; `parseState(...).data!` became a narrowed read that throws if not ok | the runtime values are identical |

**Findings, none fixed here:**

1. `gate.test.ts` sent `legend`, which is the key the RESPONSE returns; the request field is `criteria`. src never read `legend`, so it did nothing, and I removed it. The test may have meant `criteria`, which would change the payload; that is for whoever owns the test.
2. `policies.test.ts` now passes `hasPriorFailures: false` everywhere, so nothing in that file exercises the `true` side of that gate rule. A coverage gap, not a type error.
3. `fires.test.ts` and `ranking.test.ts` still carry present-tense comments about the cut lifecycle (the area of #294).

## Round 1 findings (not fixed, per the brief)

- **No error is confirmed as "the test is right and src is wrong".** I did not open each site. The one worth a look before anyone edits it is `harness/shadow-merge.test.ts:28` (a module namespace where a function-shaped type is expected), which may mean src exports a shape the test cannot call.
- **Category A is the substantive one:** 20 places where a fixture drifted from a type that src changed. Several (handoff-provenance, state-render) sit around the schema v3 handoff fields, so they ran green only because the runtime does not validate the literal.
- **Category B overlaps PR #294 (T-215):** one of the four (`index-upsert.test.ts:126`) is already fixed there; `ranking.test.ts` and `shadow-strategies.test.ts` still carry `successRate`, and `maturityBoost` is imported in `ranking.test.ts` but no longer exists. Fixing B in this task would collide with #294.

## Options for your ruling

1. **Fix all 40 in one PR** (test files only; C is mechanical, A needs the right fields per fixture, B waits for or stacks on #294), then add `npm run typecheck:tests` to CI's test job.
2. **Split:** C and A now (36), B after #294 merges, CI enforcement with the last PR.
3. **Enforce by ratchet:** add the script to CI with an allowed-error count of 40 that may only go down, and fix by file.

I would take 2: A is where the value is, and B is cheap once #294 is in.
