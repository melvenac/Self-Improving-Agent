# Loop 15 slice four, step 2: QA report (QA 240)

**By:** the QA seat, record session 240, 2026-10-01, on **Plumb** (the Linux QA seat), headless Claude Code on Opus 5.5
(D-068). **Dispatch:** `docs/loops/qa-240-s4-step2-dispatch.md` at the launch-line SHA `90a7282d`.
**Worktree:** `~/qa-scratch/qa240-wt`, detached at `90a7282d505c798f4abaebf0b52e398e27b6cbde`
(`git -C ~/qa-scratch/qa240-wt log -1 --format=%H`). **Candidate:** `2d4cd863ca159d737a1ee2efed02b9b85be26770`
(`origin/loop/15-slice-4-step2`, read back by `git rev-parse`). **Base:** `2448a6ea`. **Scratch trees:**
`~/qa-scratch/qa240-cand` (candidate) and `~/qa-scratch/qa240-base` (base), both detached. `TMPDIR=~/qa-tmp`.

**No live Jev call was made.** Every command ran through `docs/loops/qa-240/tools/qa240-run.mjs` or `qa240-mut.mjs`.
Each builds its child's environment from scratch (`HOME`, `PATH`, `TMPDIR`, `CI`, a scratch `KNOWLEDGE_V2_DB`) and never
spreads `process.env`, so no `TYPESAFE_API_KEY` could reach anything that ran.

## Verdict: REJECT

Every S4 row that can be scored at step 2 is met, except **S4-9 (clause 3)**. The candidate's full `vitest run` exits 1,
and two of its 11 failures were introduced by the candidate. One of the two is deterministic on any checkout, CI
included. Both fixes are small and touch only test code (see "For the builder").

## 1. S4-9.3: the full suite (ruling 2)

Run in `open-brain/` with the constructed env. `npx` was used for the full runs; `hook.test.ts` was re-run with
`node node_modules/vitest/vitest.mjs` directly to rule out `npx`.

| | npm ci | npm run build | tsc --noEmit | vitest run | Test files | Tests |
|---|---|---|---|---|---|---|
| base `2448a6ea` | 0 | 0 | 0 | **1** | 1 failed, 136 passed (137) | 9 failed, **1931 passed**, 5 skipped (1945) |
| candidate `2d4cd863` | 0 | 0 | 0 | **1** | 3 failed, 141 passed (144) | 11 failed, **2048 passed**, 5 skipped (2064) |

Durations: base 454.9 s, candidate 477.8 s. **Passed at the candidate (2048) ≥ base (1931).**

What the failures are:

- **9 × `tests/trigger/hook.test.ts`, at base and candidate alike.** These are environmental. On Plumb, npm prints
  `npm warn Unknown builtin config "globalignorefile"` into the hook's stderr, and the tests assert stderr is `''`.
  Running the file with `node node_modules/vitest/vitest.mjs` gives the same 9 failed, 3 passed in both trees. The
  candidate did not touch the file.
- **D1, deterministic: `s4-guards.test.ts` › "S4-9.2 no skip, todo, skipIf or runIf is added …".**
  - The guard scans the added lines of `git diff 2448a6ea -- open-brain/tests` for `SKIPS`.
  - Its own `it(...)` title at `s4-guards.test.ts:54` contains the words `skipIf` and `runIf`, so the scan matches the
    guard itself:
    `expected [ "  it(\"S4-9.2 no skip, todo, skipIf or runIf is added, and no test file loses a test\", () => {" ] to deeply equal []`.
  - Isolated run: the same 1 failure.
  - This explains why the handoff saw it green. `git diff BASE` does not see untracked files, so the guard passed while
    the file was uncommitted, and has failed on every committed checkout since `5b8d0b1a`.
  - The file's own comment at line 40 names the effect ("once it is committed or staged").
- **D2: `s4-g4-reconstruct.test.ts` › R6 "`harness validate plan` exits 0 on all eight".**
  - The test makes eight sequential `tsx` spawns and has no per-test timeout. `vitest.config.ts` sets none, so the
    default is 5 s.
  - Measured time: 14.2 s in the full run, 12.7 s isolated.
  - With `--testTimeout=120000` it passes in 11.7 s, so all eight `D_t` files do validate (exit 0). The defect is the
    timeout, not the records.

**S4-9.3 is unmet.** The suite does not exit 0. Base also exits 1 on Plumb, but only for the shared environmental
file; the candidate adds two failures of its own.

## 2. Scores, row by row

The S4-20 live halves (S4-2, S4-3a.2, S4-3b.2 and S4-7's live counts) are not scored here.

| Row | Score | Evidence | Red at base |
|---|---|---|---|
| S4-1 | met (guard) | `parseDeclared` from master `8b712591` (`declared.ts` `b40aaa87`, post T-214) on the criteria (blob `416ac134`, same at master and `90a7282d`): `present:true`, S4-20..24 / S4-30..35. Exactly one fence. **Known positive:** a second fence throws `DeclaredParseError: more than one declared block in the file`. A blank line before `[out-of-scope]` now gives the **same** block, which is S4-1.2 after T-214. | guard |
| S4-2 | not scored | S4-20 (rulings 1) | n/a |
| S4-3a | met (step-2 half) | `s4-g2-key` A1 (one request; `url === JEV_ENDPOINT`; `Bearer <canary>`; POST), A2 (variable deleted: 0 requests and `GateUnavailable`, against 1 request with it), A3 (full comparator table, `jev-1.9.0` false). Builder m07 is red. | no comparator at base (criteria) |
| S4-3b | met (step-2 half) | §3 below. The canary walk, the known positives, 4 builder mutants and 4 QA mutants (including the two-layer redaction) are all red. | no canary test at base |
| S4-4 | met (step-2 deliverable) | D1 to D4. m09 (diffstat from the merge) and m10 (checks assumed green) are red. K2 shows `base_sha` computed by merge-base. **S4-4.1** (eight live records) is not in S4-20's list: see Open 2. | no runner at base |
| S4-4a | met | P1 to P6 and R1. m01 and m02 are red. **QA q05 and q06 survive:** gap G3. | no `plan_provenance` at base |
| S4-4b | met | §4 below | no `D_t`s at base |
| S4-5a | met (generator) | T1 to T8 and C1. m16 (typed label) and m17 (no-`E_t` diff reported as scored) are red. The tables themselves are for the close-out. | no generator at base |
| S4-5b | met | QA's own scan: 0 whole-word hits in 5125 added lines (`tools/qa240-guards.mjs`, known positive included). | n/a |
| S4-5c | met (guard) | `git diff --exit-code` on the three policy files is empty. `qa-score.json` is the one added file. Both `require_*` flags stay false. | guard |
| S4-6a | met | Q1 to Q7. m14 and m15 are red. Ruling 4 is verified in §5. **QA q13 survives:** gap G6. | no `qa-score.json` at base |
| S4-6b | met | R1 to R4 and R8. m11 is red. **QA q07** (a `fail`'s severity defaulted) and **q08** (an unanswered row not named under `missing`) are red on R3. | no runner at base |
| S4-6c | met | R5 (the copy is byte-identical by `hash-object`; `e_t_ref`), R6 (exclusive create), R7 (the `E_t` blob is unchanged). m13 is red. Clause .4 holds by implication from the identical blob. | no `G_qa` writer at base |
| S4-6d | met | D5 and R7. m08, m12 and m13 are red. **QA q09** (the QA runner *returns* exit 1 on a reject, the value the CLI passes to `process.exitCode`) is red on R7. `runtime.test.ts` is unchanged and green. Clause .3 holds by construction (see Open 4). | `runLoop` fails on reject |
| S4-7a | met (step-2 half) | W1 and C1 to C6. m03 is red. Ruling 3 is in §6. | records written after dispatch at base |
| S4-7b | met | C1 to C4 and D6. m04 is red. **QA q10 and q11 survive:** gaps G4 and G5. | no `attempt`/`retry_of` at base |
| S4-8 | met (guard, as amended) | `3b192871` is an ancestor of `2d4cd863`. `LOOP_LIMITS` (1862 chars) is byte-identical from base to candidate, by QA's own extract and by `s4-guards`. Clauses 2 and 4 need CI run ids and go to the close-out. | guard |
| **S4-9** | **unmet** | 9.1: 0 `jev-mcp` lines in 2584 added `src` lines. 9.2: the property holds (no skip in call position, no test file deleted, `t195-plan-gate` keeps 16 → 16 tests), but its own test is red (D1). **9.3: exit 1, D1 and D2.** 9.4: C's criteria, `shadow_merge.json` and `ledger.jsonl` are unchanged. 9.5: met by inspection (the runners only write records). | guard |

## 3. S4-3b: the canary walk, in both directions

- **The walk is real.** Every K-test runs `scanForCanary` over directories through `walkFiles` (`readdirSync`
  recursion), never over a list of expected paths, and asserts `filesRead` above a floor:
  - `s4-g2` K1: ≥ 4;
  - `s4-g3` and `s4-g5` K1/K2: > 5;
  - `s4-g2` K2: ≥ 3.
- **K1 also scans** the record and the note (g3, g5), or the thrown error plus the log sink (g2).
- **Known positives.** Each of the three files has a K0 test asserting `scanKnownPositive(...) === 1`. QA q01 also
  confirms the walk from the other side: it writes the *unredacted* record to `<record>.debug.txt`, a file no test
  lists by name, and K1(200) in `s4-g3` goes red. So the walk finds a file it was not told about. D5 also catches q01,
  through `git status`.
- **The hostile fake really echoes.** Every K1 asserts `seen[0].authorization === "Bearer <canary>"` before it
  asserts zero hits.
- **Two-layer redaction (handoff decision 6).** Each row below removes the record-level `redact` in one writer
  **together with** the transport `redact`. Each pair turns a test red that stays green with the record layer
  removed alone:

  | Mutant | Record layer removed in | Red | Newly red, compared with the record mutant alone |
  |---|---|---|---|
  | q02 (m06 + m18) | `shadow-gates` | `s4-g3` K1(**200 and 422**), `s4-g2` K3 | `s4-g3` K1(422) (m18 alone: only K1(200)) |
  | q03 (m06 + m19) | `shadow-qa` | `s4-g5` K1(**200 and 422**), `s4-g2` K3 | `s4-g5` K1(422) (m19 alone: only K1(200)) |
  | q04 (m06 + m05) | `runBriefPlanGate` | `s4-g2` K1(**200 and 422**), K3 | `s4-g2` K1(422) (m05 alone: only K1(200)) |

- **Limit.** The spawned-CLI K2 cases are dry-run only, because the CLI takes no fetch override. So the child-process
  path is covered for the printed payload and the record, not for an echoed response. The handoff says so in the K2
  comment.

## 4. S4-4b: independence (ruling 1)

- **The map copy against master's file.** The `MAP` table in `s4-g4-reconstruct.test.ts` matches
  `docs/loops/loop-15-slice-4-reconstruction-map.md` on master for all eight rows, by checkout and model. No building
  seat is `sia-builder`, and every `reconstructed_by` is `sia-builder`.
- **The model line.** The reconstruction commit `1da79279` (like every commit on the branch) carries
  `Co-Authored-By: Claude Sonnet 5.5`.
- **The handoffs exist.** All eight handoffs the map names exist at `2448a6ea`.
- **The briefs did not move.** Every `reconstructed_from` brief has the same blob at base and candidate.
- **The disclosure.** `tools/qa240-touch*.mjs` checks what the builder could have read:
  - **The four/four split holds.** #165, #227, #220 and #218 touch none of the six files the handoff names. They also
    touch no file the builder had edited before `1da79279` (`git diff --name-only 2448a6ea 1da79279^`).
  - **The list for the other four is accurate in substance but incomplete.**
    - #209 touches `brief-plan-gate.ts`.
    - #182 touches `runtime.ts` and `schema.ts`, **not `gate.ts`**.
    - #187 touches `declared.ts`, `runtime.ts` and `schema.ts`, and its diff names `EVIDENCE_LOOP_PATTERN`.
    - #195 touches `policies.ts`, and its diff names `MergePolicySchema`.
    - Files the builder had edited before the reconstructions that also overlap these diffs: `artifacts.ts` (#182),
      `cli.ts` (#187, #195, #209) and `t195-plan-gate.test.ts` (#209).
- **Score.** S4-4b is met on "reconstructing seat ≠ building seat" for all eight, as ruled. The step-4 close-out
  reports the 4.3 values split four/four, as ruling 1 requires.

## 5. Ruling 4: are the QA-score functions inside scanned regions?

- **Yes, both are** (`tools/qa240-scan.mjs`, which reuses `threshold-scan.ts`'s own regex and region rule).
  - `gate.ts` is scanned whole, so `buildQaScoreQuestions` is inside.
  - `policies.ts` is scanned from the last `Applying a policy` (char 15665, line 336), and `decideQaScore` (line 571)
    and `decideDoneGate` (line 485) sit after it.
  - Both regions hold 0 literals.
- **Builder mutants.** m14 (a literal in `decideQaScore`) and m15 (a literal in a QA prompt) are both red.
- **Residual (G6).** `shadow-qa.ts` assembles what `decideQaScore` receives, and it is not a scan target. QA q13 plants
  `complete < 0.6` there, and all 108 tests stay green. This is consistent with ruling 4 as written, so it is a gap and
  not a defect.

## 6. Ruling 3: can `unavailable` hide a request that reached `fetch`?

- **Not in the candidate as built.**
  - `GateUnavailable` is thrown only before `fetch`: no key (`gate.ts:521-529`) or no fetch implementation (`:530-534`).
  - A rejected `fetch` becomes `GateCallFailed("transport")` (`:549-556`).
  - `outcomeOfError` maps only the name `GateUnavailable` to `unavailable`, and `countAttempts` drops only that class.
- **Shown by a mutant and a test.** QA q12 makes a `fetch` rejection throw `GateUnavailable`.
  - **QA's probe** `docs/loops/qa-240/qa240-probe-unavailable.test.ts.txt`, run locally and then removed from the
    candidate tree, drives `runBriefPlanGate` with a rejecting fetch:
    - **U1** asserts that the fetch was reached once, the ledger outcome is `transport`, and `countAttempts().total`
      is 1. Green at the candidate; **red under q12**.
    - **U2**, the no-key refusal: 0 reached, `unavailable`, 0 counted. Green.
  - q12 is also red on the pre-existing `gate-live.test.ts` A3 (it asserts `classification === "transport"`).
- **Gap G7.** q12 goes green on every one of the 108 `s4-*` and related tests. Only the base-era `gate-live` A3 catches
  it, and no slice-four test drives a `fetch` failure through a runner into the count.

## 7. Mutants

All runs were sequential, each in the candidate tree, using `tools/qa240-mut.mjs`. The steps for each diff:

1. `git apply`;
2. vitest on `s4-g1, s4-g2, s4-g3, s4-g5, s4-g6, policies, t195-plan-gate` (108 tests, 108/108 green unmutated),
   with a 120 s per-test timeout;
3. `git apply -R`;
4. assert that `git status --porcelain` is unchanged. It was for every mutant.

Results are in `docs/loops/qa-240/results/*.json`. `results/qa240-own-mutants-b.json`'s q12 entry is a mis-scoped
first run (`gate-live` only, because of an argument-format slip). `-c` is q12 on the full set, and `-d` is q12 on the
probe.

**Builder's 19 (`docs/loops/loop-15-slice-4/mutants/`): 19/19 red.** Each matches the handoff's table or is a
superset of it:

| Mutant | Red on |
|---|---|
| m01 | P2, P4, P6, and T5 |
| m02 | P2, P4, P6 |
| m03 | W1, C1 to C6, D6, D7 |
| m04 | C2, D6 |
| m05 | `s4-g2` K1(200) |
| m06 | `s4-g2` K3(422) |
| m07 | A3, T7 |
| m08 | D5 |
| m09 | D2 |
| m10 | D3 |
| m11 | R1, R2, R4 |
| m12 | R7 |
| m13 | R3, R5, R7 |
| m14 | Q5, Q7 and two `policies.test` tests |
| m15 | Q5, Q6 and one `policies.test` test |
| m16 | T1 |
| m17 | T4 |
| m18 | `s4-g3` K1(200) |
| m19 | `s4-g5` K1(200) |

**QA 240's own 13 (`docs/loops/qa-240/mutants/`):**

| Mutant | Row | What it does | Result |
|---|---|---|---|
| q01 | S4-3b | the done runner dumps the unredacted record to `<record>.debug.txt` | **red**: D5, `s4-g3` K1(200) |
| q02 | S4-3b, two-layer | transport + `shadow-gates` record redact removed | **red**: `s4-g3` K1(200, 422), `s4-g2` K3 |
| q03 | S4-3b, two-layer | transport + `shadow-qa` record redact removed | **red**: `s4-g5` K1(200, 422), `s4-g2` K3 |
| q04 | S4-3b, two-layer | transport + plan-gate record redact removed | **red**: `s4-g2` K1(200, 422), K3 |
| q05 | S4-4a | `shadow-qa` sets `source` from `/^t\d{3,}$/.test(ev.loop)` | **survives** (G3) |
| q06 | S4-4a | `shadow-gates` sets `source` from `/^t\d{3,}$/.test(plan.loop)` | **survives** (G3) |
| q07 | S4-6b | a `fail` with no severity defaults to 0 and is not named under `missing` | **red**: R3 |
| q08 | S4-6b | an unanswered row is `untested` but not named under `missing` | **red**: R3 |
| q09 | S4-6d | the QA runner returns `exitCode: 1` on a non-proceed decision | **red**: R7 |
| q10 | S4-7b | `retry_of` may name another subject's record | **survives** (G4) |
| q11 | S4-7b | `auth` added to `RETRYABLE_OUTCOMES` | **survives** (G5) |
| q12 | ruling 3 (S4-7a) | a `fetch` rejection is thrown as `GateUnavailable` | **red** on probe U1 and `gate-live` A3; survives the 108 (G7) |
| q13 | S4-6a | literal `0.6` planted in `shadow-qa.ts` | **survives** (G6) |

## 8. CI

**0 runs.** `gh` is not installed on Plumb (`/bin/bash: line 1: gh: command not found`), so no
`qa/s4-step2-ci-*` branch was pushed. The PR's CI will be the first. D1 should make that run red.

## 9. For the builder (the REJECT, and what would turn it)

1. **D1.** Make the S4-9.2 guard unable to match itself. Either scan for skips only in call position (for example
   `\b(it|test|describe)\.(skip|todo|skipIf|runIf)\b`), or exclude `s4-guards.test.ts`'s own title. Show the scan
   still fires on a planted `it.skip(`.
2. **D2.** Give R6 an explicit timeout, as the other spawn tests do (for example `it(..., 120_000)`).
3. Then rerun the full suite. Expected result: only the 9 environmental `hook.test.ts` failures remain, the same as at
   base.

Optional, as gaps rather than blockers:

- **G3.** Add a runner test whose `E_t` / `D_t` loop is `t195`-shaped, asserting `source: "seat"`. Four of the five
  real `E_t`s look like that.
- **G4 and G5.** Add `countAttempts` fixtures for a cross-subject `retry_of`, and for retrying `auth`,
  `unexpected-status` and `malformed-response`.
- **G7.** Add a runner-level test of a `fetch` failure that ends in the count.

## 10. Open for the planner

1. **S4-9.3 baseline on Plumb.** `hook.test.ts` fails 9/12 at base and candidate alike on this machine (npm's
   `globalignorefile` warning reaches stderr). The row as written ("exit 0") cannot pass on Plumb for any candidate
   until that is fixed or ruled environmental. This report treats it as environmental and rejects only on D1 and D2.
2. **Rows with live clauses not named in S4-20.** S4-4.1 (eight live `G_done`), S4-4a.6 (live records carry
   `seat`/`reconstructed-after`), S4-5a's actual tables, S4-6b.4 / S4-6c.1 on live records, and S4-8 clauses 2 and 4
   all need step 4. They are scored here on their step-2 deliverables only. Confirm that the close-out scores the rest.
3. **G6 against ruling 4.** `shadow-qa.ts` is not scanned. Rule whether it should be.
4. **S4-6d.3** is shown by construction, not by a test: `shadow-merge.ts` is unchanged, and `cli.ts` never passes a
   `doneGate` to `prepareShadowVerdict`. Note that `computeShadowMergeVerdict` at base **does** turn a passed-in
   `reject` `doneGate` into `would-not-merge` regardless of `require_done_gate` (`shadow-merge.ts:108-111`), so the
   property rests on nobody wiring the records in.
5. **The handoff's disclosure list** is incomplete in the ways §4 lists. The four/four split is unaffected.

QA-240: REPORT COMPLETE
