# Loop 15 slice four, step 2: developer handoff (sia-builder, Claude Sonnet 5.5)

**By:** Builder (developer seat, `sia-builder` checkout), 2026-10-01. **Branch:** `loop/15-slice-4-step2` from `origin/master`
`2448a6ea`. **Dispatch:** `docs/loops/loop-15-slice-4-step2-dispatch.md` at `c3ba18e4` (PR #249). **Spec:** QA 238's
`docs/loops/loop-15-slice-4-criteria.md` as adopted in the rulings file. **No live Jev call was made at any point.** Every transport
in every test is a fake, every environment is constructed, and every test that could reach a real `fetch` replaces the global one
with a function that fails the test. Aaron approved the heavy runs in this window.

## What was built, by group (commits are red first, then green)

| Group | Red commit | Green commit | What |
|---|---|---|---|
| G1 | `ade186c1` | `c22a51c7` | `gate-records.ts`: strict schemas for `G_done` and `G_qa` with `source` and `plan_provenance`; refusing writer; `harness validate gate-record`; write-ahead attempt ledger; `harness count-attempts`; `runLoop`'s own `G_done` stamped `runtime` / `written-before`; `GateRecordKind` gains `qa` |
| G2 | `17509669` | (source landed in `c22a51c7`, see note) | `jevModelAtLeast` comparator in `gate.ts`; canary tests; `runBriefPlanGate` redacts the record it writes and takes `ledgerPath` and `fetchImpl`; `t195-plan-gate.test.ts`'s helper takes a constructed env |
| G3 | `4f42dee3` | `ab7118d4` | `shadow-gates.ts` and `harness shadow-done`: the 4.3 runner |
| G4 | `1da79279` | `3451588e` | eight `D_t` files in `docs/loops/loop-15-slice-4-records/`; `reconstructed_by` and `reconstructed_from` on the plan schema |
| G5 | `54fba64a` | `7971af81` | `policies/qa-score.json`, `QaScorePolicySchema`, loader, derived schema, `decideQaScore`, `buildQaScoreQuestions`, `shadow-qa.ts` and `harness shadow-qa` |
| G6 | `ac10d368` | `50c0f71b` | `closeout-tables.ts` and `harness closeout-tables [--check <report>]` |
| guards, mutants | | `5b8d0b1a`, `818bef3a` | scope guards by sha; a transport-level canary test; 19 local mutant diffs |

**G2's note.** The comparator was written with G1's source and committed in `c22a51c7`, so G2 has no separate green source commit. Its red
was taken by running its test file against the base's `gate.ts` and `brief-plan-gate.ts`: 3 tests failed (A3 and K1 in both its 200 and
422 forms). The ruling-6 fix is test-side, and its red is E1, which fires on the old `{ ...process.env, ...env }` shape.

## Rows to tests and mutants

Mutants are diffs under `docs/loops/loop-15-slice-4/mutants/`. Each was applied with `git apply`, checked with `tsc --noEmit` (exit 0),
run against the named test files, and reverted. Every one went red. None is committed to source.

| Row | Test | Mutant, and what failed |
|---|---|---|
| S4-3a.1 endpoint, header, one request; deleted variable makes zero | `s4-g2-key` A1, A2 | (green and pair; A2 compares both cases) |
| S4-3a.1 comparator, `jev-1.9.0` fails numerically | `s4-g2-key` A3 | m07 compares each field as a string: A3 red |
| S4-3b.1 canary, `runBriefPlanGate` | `s4-g2-key` K0, K1 (200, 422), K2 (spawned CLI), K3 (transport) | m05 record not redacted: K1 (200) red. m06 transport `redact` dropped: K3 (422) red |
| S4-3b.1 canary, 4.3 runner | `s4-g3-done` K0, K1 (200, 422), K2 | m18 record not redacted: K1 (200) red |
| S4-3b.1 canary, 4.4 runner | `s4-g5-qa` K0, K1 (200, 422), K2 | m19 record not redacted: K1 (200) red |
| ruling 6, t195 helper | `s4-g2-key` E1, E2, E3; every `t195-plan-gate` test passes | E1 shows the scan fires on the old shape and not on the new |
| S4-4a.1, .2 strict schema; writer refuses | `s4-g1-records` P1, P2, P3, P6 | m01 `source` optional: P2, P4, P6 red. m02 `plan_provenance` defaulted: P2, P4, P6 red |
| S4-4a.3 validator | `s4-g1-records` P4 | same m01, m02 |
| S4-4a.4 runtime `G_done` | `s4-g1-records` R1 | |
| S4-4a.5 `source` not inferred from the loop id | `s4-g1-records` P5 | |
| S4-4a.6 all eight and all `G_qa` say `seat` / `reconstructed-after` | `s4-g3-done` D1, `s4-g5-qa` R5 (the runners' defaults) | |
| S4-4 the 4.3 runner, `checks_source`, shadow `runtime_action` | `s4-g3-done` D1 to D4 | m09 diffstat from the merge: D2 red. m10 checks assumed green: D3 red |
| S4-4b mapping, field, seat differs, validates, seat-id loop | `s4-g4-reconstruct` S1 to S3, R0 to R6 | red at base: 11 of 45 fail until the schema carries the fields |
| S4-5a generated tables, N, SHAs, spread, label | `s4-g6-closeout` T1 to T8, C1 | m16 label typed, not computed: T1 red. m17 no-E_t diff reported as scored: T4 red |
| S4-5b forbidden word | `s4-guards` G0, S4-5b (whole diff) and `s4-g4` R5, `s4-g6` T6 | G0 plants the word and shows the scan fires |
| S4-5c threshold files unchanged, `qa-score.json` the one addition | `s4-guards` S4-5c.1, S4-5c.3; `s4-g5-qa` Q4 | |
| S4-6a schema, drift, loader refusals | `s4-g5-qa` Q1 to Q3 | |
| S4-6a threshold-scan guard and planted literal | `s4-g5-qa` Q5, Q6; `policies.test` | m14 literal in the decision code: Q5, Q7 and two `policies.test` tests red. m15 literal in a QA prompt: Q5, Q6 and one `policies.test` test red |
| S4-6a A6 property | `s4-g5-qa` Q7 | |
| S4-6b question kinds on the payload, one batched call | `s4-g5-qa` R1 | |
| S4-6b missing evidence is `untested` by code | `s4-g5-qa` R2 to R4 | m11 takes Jev's choice for a row with no evidence: R1, R2, R4 red |
| S4-6b.4 five diffs only | `s4-g6-closeout` T4 lists A, B part 1 and B part 2 as `not scored: no E_t` (computed from the files present) | |
| S4-6c `G_qa` beside a copy of its `E_t`, written once | `s4-g5-qa` R5, R6 | |
| S4-6d flip test, 4.3 | `s4-g3-done` D5 | m08 exit code on a reject: D5 red |
| S4-6d flip test, 4.4 | `s4-g5-qa` R7 | m12 exit code on a reject: R7 red. m13 a result written into the `E_t` copy's row: R3, R5, R7 red |
| S4-6d.2 `runLoop` does not consult a QA gate | `runtime.test.ts` lines 616 to 629, unchanged and passing | |
| S4-7a write-ahead | `s4-g1-records` W1 | m03 begin line not written: W1 and C1 to C5 red |
| S4-7a count, ceiling, `unavailable` is not a call | `s4-g1-records` C1, C4, C5, C6 | |
| S4-7b retry chain passes, re-roll fails | `s4-g1-records` C1 to C3, C6; `s4-g3-done` D6 | m04 re-roll not flagged: C2 red |
| S4-9.1 no jev-mcp, S4-9.2 no skip or deletion | `s4-guards` | G0 shows each scan fires |
| S4-9.4 C's criteria file, shadow artifact and ledger untouched | `s4-guards` | |
| S4-8.3 the `LOOP_LIMITS` string is byte-identical | `s4-guards` | |

## How to run the new commands (for step 4; all of them also run with `--mode dry-run`, the default for the two shadow runners)

- `harness plan-gate <D_t> --mode live` now writes an attempt line to `docs/loops/loop-15-slice-4-records/attempts.jsonl` before the request leaves (`--ledger` overrides).
- `harness shadow-done --pr N --merge-commit S --scored-sha S [--base-sha S] --dt <D_t> (--checks-e-t <E_t> | --checks none) [--mode live]`
- `harness shadow-qa --pr N --branch qa/... --commit S --path <E_t path> [--mode live]` (the `E_t` is read from its commit)
- `harness count-attempts` (defaults: the ledger above, and `docs/loops/` as the records root), `harness validate gate-record <file>`, `harness closeout-tables [--check <report>]`.

## Decisions and limits, stated rather than left to be found

1. **"From the prose brief only" is not clean for four of the eight, and QA should weigh S4-4b with that in mind (corrected at r2 from QA 240 section 4).** Before I wrote the reconstructions I had read, in this session, code that belongs to four of the diffs: #182 (candidate A): `runtime.ts`, `schema.ts` and `artifacts.ts`; #187 (B part 2): `schema.ts` (`EVIDENCE_LOOP_PATTERN`), `declared.ts`, `cli.ts` and `runtime.ts`; #195 (C): `policies.ts` (`MergePolicySchema`) and `cli.ts`; #209 (T-195): `brief-plan-gate.ts`, `cli.ts` and `t195-plan-gate.test.ts`. (r1 wrongly listed `gate.ts` for #182; it is not one of A's files.) Each `D_t` was still written from its brief's text, and I did not open the diffs themselves or any handoff. The other four were written without having read their code: #165, #227, #220 and #218. The four/four split stands. The tracked mapping file is not in this branch (it is on PR #249), so S4-4b's check against it is the table in `s4-g4-reconstruct.test.ts`, copied from it.
2. **Row ids in the reconstructions.** Where a brief named its own rows (T-195's DT-1 to DT-8, T-198's PR-1 to PR-6, T-196/T-197's HB and CS rows, T-158's TG rows, B part 1's B-1, B-2, B-4, B-5) I used them. Where it did not, I gave rows new ids (`SM-` for C, `R10a` to `R10d` for B part 2, `A1` to `A3` for A) so they do not collide with QA's real criteria ids.
3. **`unavailable` is an outcome class the spec does not list.** A refusal before any request (no key) is recorded `unavailable`, and the count does not treat it as a call. A dry run is also `unavailable`. Without it a missing key would spend budget.
4. **`retry_of` is the repo-relative path of the earlier record.** The ledger and the records both carry it, so the count can be taken from either.
5. **No new threshold-scan target was added.** The QA prompts live in `gate.ts` and the QA decision in `policies.ts` after the marker, both already scanned, so `policies.test.ts` line 298 (the exact list of three files) is unchanged. Q5 shows the scan reads `buildQaScoreQuestions` and `decideQaScore`, and m14 and m15 show a planted literal is caught in each.
6. **Redaction is two layers, and a mutant on one is hidden by the other.** `JevTransport` redacts what it puts in an error, and each record writer redacts the whole record. m06 (transport) survived the record-level tests, so K3 looks at the transport's own output directly. That is why the table has a mutant per layer.
7. **The close-out `Records read` count and every table row is computed from live, answered, schema-valid records.** A dry-run record, a failed attempt, and a refused file are not counted (the last makes the command exit 1).
8. **One existing test file changed.** `t195-plan-gate.test.ts` (the helper's env only, ruling 6). No test was deleted, skipped or weakened, and `s4-guards` checks the count per touched file.
9. **Heavy-run RAM.** Free RAM was 1.29 to 1.54 GB across the mutant runs; several were just under the 1.5 GB bar on a machine shared with Chisel. Every run was sequential and single-file except the full suite below.

## Full-suite and build results

**The full `vitest run` was NOT completed.** I started it in the background to wait for 1.5 GB free RAM; Claude Code stopped it because the machine was critically low on memory (the QA PC is shared with Chisel), before it produced a result. It was not restarted, on the instruction that comes with that stop. So S4-9.3 is open: no full-suite exit code is quoted here.

What did run, all exit 0 unless stated: `npm run build` 0 (stamped 818bef3, the policies directory carries `qa-score.json`); `tsc --noEmit` 0 at every green commit and under every mutant; the existing gate tests after G1 (t195-plan-gate, runtime, gate-live, policies, shadow-merge, cli, schema: 183 passed) and after G5 (policies, cli, schema, spawn-sites, gate-live: 88 passed); and each new test file green on its own (s4-g1 14, s4-g2 12, s4-g3 12, s4-g4 45 with schema, b2-et and t216, s4-g5 19, s4-g6 9, s4-guards 8).

The full suite needs a run when the machine has memory, by whoever has the approval.

## r2 (after QA 240 REJECTED r1 on S4-9.3 only)

Branch `loop/15-slice-4-step2`, from `2d4cd863`. Test-side changes plus two scan targets; No full suite was run on the QA PC (QA runs it on Plumb). Single files only, one at a time, free RAM 1.16 to 1.88 GB (several mutant runs under the 1.5 GB bar).

| r2 item | Change | Evidence |
| --- | --- | --- |
| 1 D1 | `s4-guards` skip scan is now call-position only (modifiers and call arguments allowed between the test function and the skipping modifier). New D1 plants a skip in a COMMITTED file of a temp repo and shows it fires, and shows an untracked one is invisible to `git diff` (why r1 looked green); D1b asserts no untracked file under `open-brain/tests`; G0 shows a test TITLE naming the words is not a hit | `s4-guards` 11 passed |
| 2 D2 | R6 in `s4-g4-reconstruct` has a 120_000 timeout | `s4-g4` 45 passed |
| 3 G3 | `s4-g3-done` D9 and `s4-g5-qa` R9: a `t195`-shaped loop id gives `source: seat` | q05 red on R9; q06 red on D9 |
| 4 G4, G5 | `s4-g1-records` C7 (retry_of naming another subject's record is refused), C8 (a retry after auth, request-invalid, unexpected-status or malformed-response is refused), C9 (the three retryable outcomes still pass, so C8 is not refusing everything) | q10 red on C7; q11 red on C8 (auth) |
| 5 G6 | `shadow-gates.ts` and `shadow-qa.ts` added to `THRESHOLD_SCAN_TARGETS`; `policies.test.ts` file list updated (the one existing assertion changed); `s4-g5-qa` Q8 plants a literal in each and shows the scan reports it | q13 red on Q8, Q5 and a `policies.test` test |
| 6 G7 | `s4-g3-done` D8 and `s4-g5-qa` R10: a rejecting fetch with a key gives `transport`, counts 1 attempt; D7 (no key, unavailable, counts 0) already existed | q12 red on D8 and R10 |
| 7 disclosure | corrected above (item 1 of the decisions list) | |
| Open 4 (optional, S4-6d.3) | `s4-guards`: neither runner imports the shadow-merge verdict, and the CLI's `shadow-verdict prepare` call passes no `doneGate` or `planGate`; the scan is shown to fire on a planted string | passes |

QA 240's six mutants are kept as `docs/loops/loop-15-slice-4/mutants/qa240-q*.diff` (copied from `origin/qa/s4-step2-report`). Each applied cleanly, passed `tsc --noEmit`, and went red on the tests named above. Single-file results: s4-g1 20, s4-g3 14, s4-g4 45, s4-g5 22, s4-guards 11, policies 26, all passed.

## r3 (after QA 242 REJECTED r2 on P4 timing only)

Branch `loop/15-slice-4-step2`, from `779be4d6`. Test-side only: no file under `open-brain/src` changed. Single files, one at a time, no full suite on the QA PC (QA reruns it on Plumb). Free RAM 1.75 to 1.77 GB.

| r3 item | Change | Evidence |
| --- | --- | --- |
| 1 timeouts by class | every top-level `describe` in every `s4-*.test.ts` carries `{ timeout: 120_000 }`. New `s4-timeouts.test.ts`: T0 shows the guard fires on a planted spawn with no timeout and stays quiet with one, or with none; T1 fails if a spawning s4 file has a top-level describe without an explicit timeout, and checks it looked at s4-g1, g2, g3 and g5 | s4-timeouts 2 passed; the other s4 files re-run, all passed |
| 2 behavioural S4-6d.3 | new `s4-g7-merge.test.ts` V1: runs `harness shadow-verdict prepare` before and after a reject G_done and a reject G_qa exist, written where the runners write them, and also copied under the conventional names a reader would try (each with a top-level `verdict`); asserts equal verdict, reasons, gates and artifact bytes (timestamp and candidate sha normalised). V2 shows the baseline is movable by a reject gate through the pure function | QA 242 r03 red on V1 |
| 2 static check | `s4-guards` S4-6d.3 now refuses a spread inside the `prepareShadowVerdict({...})` call, with a planted-spread positive and a clean negative | QA 242 r02 red on it |
| 3 disclosure | `runtime.ts` added to #187's line; the four/four split is unchanged | |
| optional residuals | the skip guard allows the `suite` alias and parentheses nested two deep inside a modifier's arguments (`describe.each([[1, (2)], [fn(3, (4))]]).skip(`), and `it.concurrent.skip(`; G0 plants each | `s4-guards` 11 passed |

QA 242's r02 and r03 are kept as `docs/loops/loop-15-slice-4/mutants/qa242-r0*.diff`; each applied cleanly, passed `tsc --noEmit` and went red as shown. Single-file results: s4-timeouts 2, s4-guards 11, s4-g7 2, s4-g1 20, s4-g2 12, s4-g3 14, s4-g4 45, s4-g5 22, s4-g6 9, all passed.

One limit of V1, said plainly: it can only catch a wiring that reads a record from a place it plants one. The conventional names planted are the records directory (with and without the loop in the name), `artifacts/iterations/<loop>/` and `docs/loops/shadow-merge/<loop>/`; a wiring that reads some other path would not be moved by it.

**r4 (after QA 243 REJECTED r3 on R3-2 only):** V1 in `s4-g7-merge` now commits the planted reject records before the second `prepare`, as QA 243 supplied, so a wiring that reads the slice records from the committed tree (QA 243 s04) is moved by it. Test-side only. V1 green unmutated (2 passed); QA 243 s04 and QA 242 r03 each pass `tsc --noEmit` and are red on V1. s04 is kept as `docs/loops/loop-15-slice-4/mutants/qa243-s04.diff`. Only `s4-g7-merge` and those mutants were run; RAM 1.8 GB.

**r5 (PR #254 CI found S4-5b failing on the merge ref):** `s4-guards` now reads each diff-based guard's paths from one table, `SCOPES`: S4-5b covers `open-brain/`, `docs/loops/loop-15-slice-4-records/` and `docs/loops/loop-15-slice-4-closeout.md` (not planner or QA documents, which may state the rule); S4-9.1 `open-brain/src`; S4-9.2 `open-brain/tests`; S4-5c the policies directory. F1 shows the scope fires on committed plants in `open-brain/`, in the records directory and in the close-out, and does not fire on the word in a `docs/loops/qa-*.md` or a planner dispatch (an unscoped diff does see them, so the quiet result is the scope's doing). F2 asserts every scope sits inside `open-brain/` or the slice's own paths. `s4-guards` 13 passed on the branch, and 13 passed on a scratch merge of the branch into origin/master `ed051380` (merge `a7c4fecd`, scratch worktree removed). Test-side only; the PR's `push` and `pull_request` CI are the check that matters.
