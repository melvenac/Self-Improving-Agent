# QA 236: T-216 report (one loop-id rule for plan and evidence)

**By:** QA 236, record session 236, headless Claude Code on Opus (D-068), laptop DESKTOP-0GV3HAD, 2026-10-01.
**Dispatch:** `docs/loops/qa-236-t216-dispatch.md`, read in a working copy detached at
`0ca2c3b45ec990081c547921f4f7c90ef7a6b278` (`git log -1 --format=%H` in `C:/qa-scratch/qa236-wt`).
**Candidate:** `9a0973f0d330b3b85a4ce5e23f8a0ef583de2070` (`origin/loop/t216-plan-loop-id`); product `ef7a1ce7`.
**Base for red:** `c204d1d4a6eef31aaefe8d607f539e367e5b090c`.
**Evidence:** `docs/loops/t216-qa-report.E_t.json` (`harness validate evidence` exit 0 at the candidate build).

## Verdict

**ACCEPT.** I reproduced every row's red and green myself, not from the handoff. The product does what T-216 asks.
Plan and evidence share one exported constant and agree on all 21 probes, while the base disagrees on 2. The real
slice-four `D_t` goes from exit 1 to exit 0 and is not edited. The JSON schema matches what the generator emits.
The dry-run gate makes zero network attempts under a tripwire.

There is one test-strength defect, D1. A plan-only copy of the regex with the `/i` flag survives every test. It is
not a product defect, and the planner can decide whether it needs a follow-up.

## Trees and times

| Tree | SHA | Use |
|---|---|---|
| `C:/qa-scratch/qa236-wt` | `9a0973f0` (detached), later `qa/t216-report` at `0ca2c3b4` | candidate build, tests, probes; report |
| `C:/qa-scratch/qa236-base` | `c204d1d4` | base red rows |
| `C:/qa-scratch/qa236-mut` | `9a0973f0` + local mutants, restored after each | mutants |

All runs: 2026-10-01 between about 06:40Z and 07:00Z, with TEMP/TMP set to `C:/qa-tmp` (via `docs/loops/qa-236/`
drivers). Node v22.23.2.

**Candidate local checks.** `npm ci` exit 0, `npm run build` exit 0 (stamped `9a0973f`), `tsc --noEmit` exit 0,
`git status` clean after the build. `vitest run tests/harness`: 29 files passed and 7 skipped, 483 tests passed and
75 skipped, 0 failed. This reproduces the handoff's numbers. Vitest exited **1** only because of one unhandled
`[vitest-worker]: Timeout calling "onTaskUpdate"` RPC error, which is laptop load and not a test failure.

## Rows

### T216-1, the real file: PASS

| Tree | Command | Exit | Output |
|---|---|---|---|
| base `c204d1d4` | `npx tsx src/harness/cli.ts validate plan <wt>/docs/loops/loop-15-slice-4-brief.D_t.json` | **1** | `loop: loop must look like t001` |
| candidate `9a0973f0` | same, tsx | **0** | (none) |
| candidate `9a0973f0` | `node build/harness/cli.js validate plan …` | **0** | (none) |

The file is byte-identical: its blob is `21bc448783f319542a915cf3f40a5a2b74945101` at base, candidate and master
`0ca2c3b4` (`git rev-parse <sha>:docs/loops/loop-15-slice-4-brief.D_t.json`).

### T216-2, one rule: PASS (with defect D1 on the tests)

**Probe** (`docs/loops/qa-236/probe-t2.mts`): 21 ids against 5 surfaces. The surfaces are the `PlanSchema.loop` zod
field, full `validatePlan`, the `EvidenceSchema.loop` zod field, the `plan.schema.json` pattern and the
`evidence.schema.json` pattern.

- Accept set: `15-slice-4`, `15-slice-3-c`, `t001`, `t1234`.
- Refuse set: `""`, `15/slice`, `../x`, `15`, `T001`, `15-`, `" 15-slice-4"`, `"15-slice-4\n"`, `15-slice.4`,
  `15\slice`, `t01`, `t001-x`, `15-Slice`, `15--slice`, `"15-slice-4 "`, `..`, `x-1`.

| Tree | Disagreements between the schemas | Off-spec results | `EVIDENCE_LOOP_PATTERN === LOOP_ID_PATTERN` |
|---|---|---|---|
| candidate | **0** | 0 | true; plan JSON pattern === evidence JSON pattern |
| base | **2** (`15-slice-4`, `15-slice-3-c`: plan refuses, evidence accepts) | 2 | false |

**The two schemas agree on every probe at the candidate.** `PlanSchema` and `EvidenceSchema` both call
`.regex(LOOP_ID_PATTERN, LOOP_ID_MESSAGE)`, and `EVIDENCE_LOOP_PATTERN` is an alias of the same object.

**Mutants: the plan gets its own copy of the regex** (`docs/loops/qa-236/mutants.mjs`, diffs in
`docs/loops/qa-236/mutants/`). Each mutant replaces only `PlanSchema`'s `loop` regex. "regen" means the JSON
schemas were then regenerated with the project's own generator, which is what an honest author would do. Target
files: `t216-loop-id`, `b2-et` and `schema` tests (68 tests).

| Mutant | Plan's copy | Regen | Result | Killed by |
|---|---|---|---|---|
| M1 (builder's m1) | `^t\d{3,}$` | no | **killed**, 5 failed | b2-et BE-0.1 plan row; schema.test drift; L1, L5, L6 |
| M2 narrow | `t\d{3,6}` runtime part | no | **killed**, 1 failed | schema.test `plan.schema.json matches what the zod schema derives` |
| M3 narrow | same | yes | **killed**, 2 failed | L3 (JSON pattern equality); b2-et BE-0.1 JSON row |
| M4 widen | `[a-zA-Z0-9]` segments | no | **killed**, 1 failed | schema.test drift |
| M5 widen | same | yes | **killed**, 2 failed | L3; b2-et BE-0.1 JSON row |
| M8 widen | shared source + `/m` flag | yes | **killed**, 1 failed | L2 (`"15-slice-4\n"`) |
| **M7 widen** | shared source + **`/i` flag** | yes | **SURVIVES**, 68/68 green | none, and also none in the full `tests/harness` run (483 passed, 0 failed) |
| M7b | same as M7 | no | **SURVIVES** | none: regeneration produces no diff anyway |
| M6 (equivalent) | identical literal copy | yes | survives | none; no behaviour change |

**Answer to the dispatch's question.** Narrowing or widening the plan's own copy is killed whenever the regex
**source** changes. Without regeneration, the existing drift test `schema.test.ts:198` kills it, not the builder's
L3. With regeneration, L3's JSON-pattern equality and b2-et BE-0.1 kill it.

A change that only adds a **flag** survives. Zod's JSON emission keeps the regex `source` and drops the flags, so
`plan.schema.json` does not move. That leaves the drift test, L3 and BE-0.1 all green, and L2 has no uppercase id.
Under M7 the probe shows the plan accepting `T001` and `15-Slice` while evidence, and the plan's own JSON schema,
refuse them. That is two disagreements, the exact drift T-216 exists to stop. See D1.

The handoff's claims hold as stated. Under m1, L2 and L3 stay green, and L1, L5, L6 and BE-0.1 go red. My M1
adds the `schema.test` drift row because I included that file and the builder did not.

### T216-3, the derived JSON schema: PASS

The project has a generator: `npx tsx src/harness/cli.ts schemas --write` (`cli.ts` `cmdSchemas`). I ran it at the
candidate and it rewrote all five schema files: plan, evidence and the three policy schemas. Afterwards
`git status --porcelain` and `git diff` were **empty**. So the hand-edited `plan.schema.json` is byte-identical to
the generated one, and there is **no drift** between the zod rule and the JSON pattern. The existing drift guard,
`schema.test.ts` "plan.schema.json matches what the zod schema derives", is green at the candidate. One limit: the
JSON pattern cannot carry regex flags (see D1).

### T216-4, the other tNNN assumptions: PASS

`Grep` for `t\d{3`, `t001` and `tNNN` in `open-brain/src` at the candidate:

| Site | Kind | Judgement |
|---|---|---|
| `cli.ts:37,50,142,143` `--loop` | runtime only | Correctly kept. It names the loop the runtime itself runs; `config.loop` feeds `iterationDir(loop)`, roles' `artifacts/iterations/<loop>/`, and `HOH_LOOP`. No planner brief reaches it. |
| `schema.ts:256` `DeveloperReportSchema` | runtime only | Correctly kept. `R_t` is written by the runtime's developer stage, whose loop came from `--loop`. |
| `runtime.ts:162,308-309` `loopNumber` | runtime only | Correctly kept: a tag name from `config.loop`. |
| `schema.ts:43-55` | comment and the shared constant | n/a |
| `brief-plan-gate.ts:64` `GATE_RECORD_RE` | no loop id | Confirmed. It keys on `<stem>.G_plan.<timestamp>.json`, and `allocateBriefGateRecordPath` builds it from the brief stem (`:79-83`). |
| `brief-plan-gate.ts:293,305` | `plan.loop` copied into the payload and record | Confirmed: it is never built into a path. |
| `artifacts.ts:83`, `shadow-merge.ts` | heading text; evidence loop | Unchanged by T-216. The evidence pattern is byte-identical to the base. |

Every planner-reachable path (`validate plan`, `plan-gate`, `brief-plan-gate.ts:236,442`) goes through `validatePlan`,
which now uses the shared rule.

### T216-5, the dry-run plan gate: PASS

Driver `docs/loops/qa-236/t5.mjs` with tripwire `docs/loops/qa-236/nonet.mjs`, loaded by `node --import`. The
tripwire refuses and logs every `net`/`tls` socket connect, `http`/`https` request, `fetch`, `dns` lookup/resolve
and `dgram` socket before any byte leaves; it allows local IPC and logs child processes. The **built** CLI runs in a
single process, so no tsx child escapes the preload. A canary `TYPESAFE_API_KEY=qa236-canary-not-a-key` was set, so
the unset-key argument (G-044) is not what makes this pass.

- **Positive control:** a `net.connect`, a `dns.lookup` and a `fetch` under the tripwire were caught, **3 of 3**.
- **Candidate:** I ran `plan-gate <tmp>/loop-15-slice-4-brief.D_t.json --brief <tmp>/…md --mode dry-run --repo <tmp>` on
  a temp copy in `C:/qa-tmp/qa236-t5-PHIp9u`.
  - It exited **0** and wrote `loop-15-slice-4-brief.G_plan.2026-10-01T06-57-57.295Z.json`.
  - The record has `loop: "15-slice-4"`, `mode: "dry-run"`, `sent: false`, `answer: null` and `decision: null`.
  - Its `runtime_action` is "no decision — dry run or transport did not consult", and the canary does not appear in
    it.
  - The tripwire logged **0 network attempts** and 0 child processes.
- **Base:** the same run exits **1** with `loop: loop must look like t001`, writes no record and makes 0 network attempts.

### Regression: the b2-et BE-0.1 inversion: PASS

The two inverted rows (PlanSchema refuses `15-slice-3`; `plan.schema.json` pattern unchanged) were BE-0, which the
b2 brief calls B's **diff-scope** guard ("BE-0 is checked first: the diff's scope"). They asserted that B did not
widen the plan. They were never an evidence guarantee, and T-216 supersedes them on purpose. What B relied on is
intact:

- `EVIDENCE_LOOP_PATTERN`'s source at the base is `/^(?:t\d{3,}|[0-9]+(?:-[a-z0-9]+)+)$/`, the same as
  `LOOP_ID_PATTERN`.
- `git diff c204d1d4 9a0973f0 -- open-brain/src/harness/schemas/` touches only `plan.schema.json`.
- BE-1.1's evidence accept and refuse rows are unchanged and green.
- The guards that keep the developer report and `--loop` tNNN-only (BE-0.1 developer row, BE-1.2) are unchanged and
  green.

The new BE-0.1 JSON row now compares against `LOOP_ID_PATTERN.source`, which is strictly stronger than a literal.

## CI (tcm, D-061/T-207): 2 runs used, `windows` not set

| Branch | Run id | headSha | Run conclusion | `test` job | Suite |
|---|---|---|---|---|---|
| `qa/t216-ci-candidate` | 36826245143 | `9a0973f0d330b3b85a4ce5e23f8a0ef583de2070` | success | success | 137 files, 1939 passed, 6 skipped |
| `qa/t216-ci-base` | 36826249364 | `c204d1d4a6eef31aaefe8d607f539e367e5b090c` | success | success | 136 files, 1933 passed, 6 skipped |

The +6 tests are `t216-loop-id.test.ts` L1 to L6, all ✓ in the candidate log, and no failure is new. I polled both
runs in the foreground with `gh run watch <id> --exit-status` (exit 0). `test-windows` was skipped on both.

## Defects

- **D1 (test strength, minor): the one-constant property is not guarded at the zod level.** Observation: mutant M7
  gives `PlanSchema.loop` its own copy of the regex with the `/i` flag. It passes all 68 target tests and the full
  `tests/harness` run (483 passed, 0 failed). Under it, the probe shows `T001` and `15-Slice` accepted by
  `validatePlan` but refused by evidence and by `plan.schema.json`. L3 asserts `EVIDENCE_LOOP_PATTERN ===
  LOOP_ID_PATTERN` and JSON-pattern equality, but nothing asserts what `PlanSchema` itself uses, and the JSON drift
  test cannot see flags.
- **D2 (info, equivalent mutant):** an identical literal copy in `PlanSchema` (M6) survives. It changes no
  behaviour, but it is the shape of the next drift. Every later source change to that copy is killed (M2 to M5);
  only a flag change escapes (D1).

## What could not be verified

- **`/sync` was not run** on the candidate, by me or by the builder (the handoff says so).
- **The live plan gate was not exercised** (no live Jev call, by rule). T216-5 proves the dry-run path only.
- **The Windows suite was not run** (`windows=true` is forbidden). The local `tests/harness` run on Windows covers the
  harness directory only.

## What these checks cannot see

- The probe's 21 ids are a sample. Agreement on them does not prove the two regexes are equal. That rests on the
  shared object, which I read in the source.
- The tripwire covers Node's built-in network APIs in the CLI process. A native addon opening a raw socket would
  get past it. None is on the plan-gate path (0 child processes, no addon import seen).
- The drift test and my regeneration both compare `source` strings, so neither sees regex flags (D1).

## Open for the planner

1. **D1.** Is a follow-up wanted? Two cheap kills: add `T001` and `15-Slice-4` to L2's refusals, or assert that
   `PlanSchema.shape.loop`'s regex is `LOOP_ID_PATTERN` by identity. Either kills M7 and M6. This is the planner's
   call; I have not changed the candidate.
2. **Observation outside T-216's scope.** `runtime.ts:1278` validates a runtime planner's `D_t` but never checks
   `plan.loop` against the run's `--loop`. The `E_t` has that check at `:1535`. This predates T-216 (at the base a
   `t002` plan in a `t001` run already passed), but the accepted set is now wider: a runtime planner can label a
   runtime loop with a seat id. `plan.loop` is not used for any path, so it is not a safety issue. It is recorded
   so nobody inherits it as settled.
3. Nothing blocked this run.

## Artifacts

`docs/loops/qa-236/`: `probe-t2.mts` (T216-2 probe), `mutants.mjs` (mutant driver), `mutants/*.diff` (9 diffs) and
`mutants/results*.json`, `nonet.mjs` (tripwire), `t5.mjs` (T216-5 driver), `push-qa.mjs` (the only push route used).
Branches pushed: `qa/t216-ci-candidate`, `qa/t216-ci-base`, `qa/t216-report`.

QA-236: REPORT COMPLETE
