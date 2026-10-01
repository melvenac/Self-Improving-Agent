# Loop 15 slice four, step 2 r2: dispatch to sia-builder

**By:** Atlas (planner), record session 155, 2026-10-01. **Candidate r1:** `2d4cd863` on `origin/loop/15-slice-4-step2`.
**QA 240's report:** `docs/loops/loop-15-slice-4-step2-qa-report.md` on `origin/qa/s4-step2-report` (`aca2f399`),
REJECT, **ruled REJECT** by the planner.

**r1 met every step-2 row except S4-9.3.** That includes the canary walk, all 19 of your mutants and QA's two-layer
redaction mutants, and independence on all eight. **Keep all of it.** r2 is test-side, plus one scan target.

## Required (the REJECT)

1. **D1.** The S4-9.2 guard (`s4-guards.test.ts`) matches its own `it(...)` title. Scan for skips **in call position
   only**, for example `\b(it|test|describe)(\.\w+)*\.(skip|todo|skipIf|runIf)\b`. Show it still fires on a planted
   `it.skip(` **in a committed file**. Untracked files were why r1 looked green.
2. **D2.** R6 in `s4-g4-reconstruct.test.ts` gets an explicit timeout, as the other spawn tests do (`120_000`).

## Required as well (QA 240's gaps; each is a test, or one scan target)

3. **G3.** For each runner, a test whose `D_t`/`E_t` `loop` is shaped like `t195` asserts `source: "seat"`. QA's q05
   and q06 must go red.
4. **G4 and G5.** `countAttempts` fixtures for two cases: a `retry_of` naming another subject's record, which is
   refused; and a retry after `auth`, `request-invalid`, `unexpected-status` or `malformed-response`, which is refused
   because they are not retryable. q10 and q11 must go red.
5. **G6.** Add `shadow-qa.ts` (and `shadow-gates.ts`, which does the same job for the done gate) to
   `THRESHOLD_SCAN_TARGETS`. They assemble what the decision receives, so a literal there is a threshold. Update the
   count in `policies.test.ts`. q13 must go red.
6. **G7.** A runner-level test where `fetch` rejects: the outcome is `transport`, and it is counted as 1 attempt. q12
   must go red on your tests, not only on `gate-live` A3. QA's probe
   `docs/loops/qa-240/qa240-probe-unavailable.test.ts.txt` is a model.
7. **The disclosure (QA 240 §4).** Correct the handoff's list of shared code read before the reconstructions.
   - #182 touches `runtime.ts` and `schema.ts`, **not** `gate.ts`.
   - Add `artifacts.ts` (#182), `cli.ts` (#187, #195, #209) and `t195-plan-gate.test.ts` (#209).
   - The four/four split stands.

## Rulings on QA 240's open items

- **Open 1, S4-9.3 on Plumb.** `tests/trigger/hook.test.ts` fails 9 of 12 identically at base and candidate, because
  Plumb's npm 9.2.0 prints a warning to stderr. **That is environmental.** S4-9.3 is read as "the candidate adds no
  failure over the base on the same machine, **and** the PR's CI on tcm is green". clark has the Plumb npm fix.
- **Open 2.** Confirmed: S4-4.1, S4-4a.6 on live records, S4-5a's actual tables, S4-6b.4/6c.1 on live records, and S4-8
  clauses 2 and 4 are scored by the **step-4 close-out**.
- **Open 4, S4-6d.3.** Optional: a test that `harness shadow-verdict prepare` never passes a `G_done` or `G_qa` record
  as its `doneGate`. Today it rests on construction, and `computeShadowMergeVerdict` would act on one if it were wired
  in. Add the test if it is cheap.

## Rules

- Same branch, `loop/15-slice-4-step2`, from `2d4cd863`, never forced. Red first, then green, for each item.
- **Machine:** the QA PC is short of RAM (1.3 to 1.5 GB free). Run single files and the mutants named above. **Do not
  run the full suite there.** QA runs it on Plumb.
- Heavy runs need Aaron's approval. If you need it, send clark ONE line, `MANUAL MODE → sia-builder: <action> (<why>)`.
- Handoff: append an r2 section to `docs/loops/loop-15-slice-4-step2-developer-handoff.md`. Report the SHA to
  `atlas [f21cf4]`.
