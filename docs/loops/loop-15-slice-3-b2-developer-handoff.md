# Loop 15 slice 3, candidate B part 2 — developer handoff

**Seat:** Forge, Grok 4.7, worktree `C:\Users\melve\Worktrees\sia-forge`, branch `loop/15-slice-3-candidate-b2`.
**Base:** `origin/master` `677c1dd` (A13 merged). **Brief:** `62691a0` (`docs/loops/loop-15-slice-3-b2-brief.md`).
**Criteria:** QA 132, `origin/qa/b-et-criteria-report` `758a255`, BE-0 to BE-8.
**Red commit:** `043fb8b` (tests only, on `677c1dd`). Branch `loop/15-slice-3-candidate-b2-red` points at it.
**No `/end`.** The live `.agents/state.json` was not written.

## What changed

`E_t` can say what QA 132 recorded, and the runtime still only runs `tNNN`.

- **Loop id (R10a).** `EvidenceSchema` only. Pattern `^(?:t\d{3,}|[0-9]+(?:-[a-z0-9]+)+)$`, exported as `EVIDENCE_LOOP_PATTERN`. Human-seat form: digits, then one or more hyphenated lowercase segments. `15-slice-3` and `15-slice-3-b` are that form. Empty, space, slash, backslash, `..`, `../x` and a newline stay refused. `PlanSchema`, `DeveloperReportSchema` and `harness run --loop` keep `^t\d{3,}$`.
- **`order` (R10b).** No new status. On `met`, `order` is required (`shown` | `attributed`). On `partial` it is optional. On `unmet`, `not_evaluated` and `pending` it is refused. The required-on-`met` rule is a zod refinement; the derived JSON names it under `LIMIT`.
- **`pending` (R10c).** An acceptance status, not a requirement status. Requirements stay `met | unmet | partial | not_evaluated`: a requirement nobody looked at is already `not_evaluated`, and the verdict that treats `pending` as `undefined` is candidate C's, on acceptance items.
- **Lists (R10d).** `parseDeclared` in `open-brain/src/harness/declared.ts`. One block per file. `qa-declared` has separate `[unrunnable]` and `[out-of-scope]` lists. `qa-unrunnable` (criteria-a at `ef2a8a7`) is unrunnable only. Absent (`present: false`) and present-but-empty are different results. `E_t` carries neither list. Out-of-scope ids are omitted from `acceptance[]`. `out_of_scope`, `invisible` and status `out_of_scope` are refused.
- **BE-1.3.** After `validateEvidence` succeeds, if `E_t.loop` is not the run's loop the runtime returns `evidence-loop-mismatch` at once (one attempt) and does not write `E_t.json`.
- **BE-7.** `harness validate evidence <file>` calls `validateEvidence` and prints every problem. Exit 0 when valid, 1 when not. No writer was added.

`plan.schema.json` was regenerated with the others and is byte-identical to the base (`git diff` empty). `evidence.schema.json` is the derived file, not hand-edited. The one pre-B `met` fixture is `schema.test.ts`'s `validEvidence()`, which gained `order: "shown"`. `StubQa` is unchanged: it writes `not_evaluated` with no `order`.

## Who reads the new fields

- `runtime.ts` validates with `validateEvidence`, then `renderEvidence` JSON-stringifies the object, so `order` and `pending` are kept. The mismatch check is the new read of `loop`.
- `cli.ts` `validate evidence` calls `validateEvidence`.
- `index.ts` re-exports the schema, `EVIDENCE_LOOP_PATTERN`, `parseDeclared` and `DeclaredParseError`. The runtime does not call `parseDeclared`. The QA seat does.
- `StubQa` does not set `order` or `pending`.

`git log --all -- '*E_t.json'` on this clone is empty (BE-5.4). Nothing persisted needs a migration.

## Evidence so far

Local red, `043fb8b`, `npx vitest run tests/harness/b2-et.test.ts`, exit 1. **23 failed, 18 passed (41).** The failures:

- `15-slice-3` and `15-slice-3-b`: `loop must look like t001`
- `order` on `met` / `partial`: `Unrecognized key: "order"`
- `met` with no `order`: accepted
- `pending`: `Invalid option: expected one of "met"|"unmet"|"partial"|"not_evaluated"`
- parser rows: `no parser: Cannot find module .../declared.js`
- description does not contain `duplicate acceptance`
- BE-6: the same three refusals in one document
- `harness validate`: `unknown subcommand "validate"`
- BE-1.3 `t002`: status `completed`, `E_t.loop=t002`
- BE-2.4 / BE-3.2: `schema-cap-exhausted` for the unrecognized key and the invalid status

Guards that passed on the unfixed product: plan and developer-report loop patterns, `harness run --loop 15-slice-3` exit 2, path-shaped ids refused, no verdict field, requirements still refuse `pending`, BE-4.5 (omission validates; the list keys are refused).

Local green, this tree, before the product commit: `npx tsc --noEmit -p .` exit 0. `b2-et.test.ts` and `schema.test.ts` 62 passed. Full `npx vitest run`: **1626 passed, 78 skipped, 1 failed (1705)**. The failure is `qa104-a9-probe2.test.ts` `symlink` `EPERM` on this Windows checkout (the test's own name says it is not for merge). A vitest `onTaskUpdate` timeout was reported as an unhandled error and did not fail a row. tcm is the suite that counts.

`/sync` (`ob_sync`, check only) at `677c1dd`: 24 passed, 4 warnings, 4 issues, all pre-existing (retirements, build-freshness of this checkout's build, mirror-parity, greeting-size). None are this diff.

GitNexus in this worktree is 395 commits behind (`ob_sync`). Callers above were found by search, not by that index.

## tcm

Seven runs, no `windows=true`. Each is `workflow_dispatch` on the self-hosted linux tcm runner except the green, which is the pull-request run for #187. This handoff commit is the eighth: it is pushed to the same PR and is not dispatched again.

- **Green** `36316975390` success. `loop/15-slice-3-candidate-b2` @ `8c7769ff6c5c16cacdb7b08cd47144af04d15ef0`. Test Files 122 passed. Tests **1699 passed | 6 skipped (1705)**. https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316975390
- **Red** `36316975271` failure. `loop/15-slice-3-candidate-b2-red` @ `043fb8b1a128d66a1061c22cfd0561442a853352`. Test Files 1 failed | 121 passed. Tests **23 failed | 1676 passed | 6 skipped (1705)**. All 23 FAIL lines are `b2-et.test.ts`: human-seat ids refused as `t001`; `order` unrecognized; `met` with no `order` accepted; `pending` an invalid option; parser rows `no parser`; BE-6; `validate` an unknown subcommand; BE-1.3 `t002` completed with `E_t.loop=t002`; BE-1.3 human-seat `schema-cap-exhausted`; BE-2.4 unrecognized `order`; BE-3.2 invalid `pending`. https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316975271
- **mut-a** `36316976945` failure. `loop/15-slice-3-candidate-b2-mut-a` @ `2ae7201f83458d093e6742ca81844f2c460c0457`. Pattern widened to `.+`. **5 failed | 1694 passed | 6 skipped.** FAIL: BE-1.1 `" "`, `a/b`, `a\\b`, `..`, `../x` (accepted). Empty and newline stayed green. https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316976945
- **mut-b** `36316978635` failure. `loop/15-slice-3-candidate-b2-mut-b` @ `594d044ae8fca61d41ae4215a904460ae9a9541a`. The required-on-`met` refinement deleted. **2 failed | 1697 passed | 6 skipped.** FAIL: BE-2.2 `ACCEPTED` (met with no order). Also BE-7.1, whose invalid file is that same met row, so the CLI and the schema fail together. https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316978635
- **mut-c** `36316980342` failure. `loop/15-slice-3-candidate-b2-mut-c` @ `dec9e99c15807c7f38bcc6a167d15f592ebd32b5`. `pending` dropped from the acceptance enum. tsc ran, no TS errors. **5 failed | 1694 passed | 6 skipped.** FAIL: BE-2.1, BE-2.3, BE-3.1 (`expected met|unmet|partial|not_evaluated`), BE-6, BE-3.2. https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316980342
- **mut-d** `36316982075` failure. `loop/15-slice-3-candidate-b2-mut-d` @ `9fe3f5915720d6f01253580bbe37add1f7a855e3`. `parseDeclared` concatenates the two lists into `unrunnable`. **3 failed | 1696 passed | 6 skipped.** FAIL: BE-4.2 (lists not separate), BE-4.4 (empty unrunnable came back as BC-1..BC-5), BE-6. https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316982075
- **mut-loop** `36316983679` failure. `loop/15-slice-3-candidate-b2-mut-loop` @ `0e66f2ca795bb8b8b4c7a8e04aa9773f1b85ee92`. The runtime loop comparison removed. **2 failed | 1697 passed | 6 skipped.** Both BE-1.3: status `completed`, `code=none`, and the t002 row names `E_t.loop=t002`. https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316983679

Mutant branches are product edits off `8c7769f` and are not in this history. They are not for merge. PR: https://github.com/melvenac/Self-Improving-Agent/pull/187
