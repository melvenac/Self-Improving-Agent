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

At most 8 runs, no `windows=true`. Run ids go in the next handoff commit after they exist.

- Red: `loop/15-slice-3-candidate-b2-red` @ `043fb8b`
- Green: `loop/15-slice-3-candidate-b2` at the product commit
- Mutants, each a product edit on its own branch off that commit, not in this history: accept a traversal loop id; accept `met` with no `order`; drop `pending`; merge the two declared lists; skip the loop comparison
