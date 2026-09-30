# Loop 15 slice 3 candidate C — developer handoff

Forge, Grok 4.7, worktree `C:\Users\melve\Worktrees\sia-forge`. Record 201, T-155. Base `origin/master` `d1e8674`. No `workflow_dispatch` (D-061). GitNexus impact was not run: the index is 465 commits behind `970c1b8` and the GitNexus tools are not in this session. Callers of the new module are `cmdShadow` in `open-brain/src/harness/cli.ts` and `checkShadowMergeLedger` from `open-brain/src/pipelines/sync/index.ts`.

## What changed

- `open-brain/src/harness/shadow-merge.ts` — `computeShadowMergeVerdict`, `prepareShadowVerdict`, `decideShadowVerdict`, `summariseLedger`, `checkShadowMergeLedger`. Git reads go through `git` / `gitTry` / `isAncestor` in `git.ts` (one spawn site).
- `open-brain/src/harness/policies/merge.json` and derived `schemas/policy-merge.schema.json`. `loadMergePolicy` is separate. `loadPolicies` still returns only plan and done.
- `harness shadow-verdict prepare|decide|summary`. The usage line that the runtime never merges, pushes, or touches a remote is still there. `runLoop` does not import this module.
- Ledger check in `/sync`. An absent ledger is a first use.
- `docs/loops/shadow-merge/PROCEDURE.md`.

Human-seat verdicts (loop id starting with a digit) are `docs/loops/shadow-merge/<loop>/<sha>/shadow_merge.json`. Runtime loops are `artifacts/iterations/<loop>/<sha>/shadow_merge.json`. The ledger is `docs/loops/shadow-merge/ledger.jsonl`. The criteria text names one file per loop; a second sha would overwrite it, so the sha is a directory. `git check-ignore` on `docs/loops/shadow-merge/PROCEDURE.md` and `docs/loops/shadow-merge/ledger.jsonl` exits 1 (not ignored). Both paths start with `docs/`.

`EvidenceSchema` and `declared.ts` are unchanged.

## Rows

Red is `970c1b8` (tests only, on `d1e8674`). `npx vitest run tests/harness/shadow-merge.test.ts --reporter=verbose` reported **Test Files 1 failed (1), Tests 17 failed (17)**. Failure 17/17 is CC-20: help stdout does not contain `shadow-verdict`. The other rows call `computeShadowMergeVerdict`, which the base does not export. The shell's exit code was 0 because the command was piped to `tail`; vitest's own summary is the failure.

Green on `2035e89`, same file: **exit 0. Test Files 1 passed (1). Tests 17 passed (17).**

| Row | Result | Observation |
|---|---|---|
| CC-3 | pass | would-merge, reasons contain `A2: met (attributed)` |
| CC-4.1–4.5 | pass | unmet, not_evaluated, partial, failed check, required gate `reject` → would-not-merge |
| CC-5.1–5.5 | pass | pending, invalid E_t, sha mismatch, unreadable criteria, missing required gate → undefined |
| CC-7 | pass | second prepare throws `already exists` and the file bytes are unchanged; human-seat path starts with `docs/` |
| CC-9 | pass | `--merged` of `origin/master` appends a line, `disagreed` false, `decided_at` > `written_at` |
| CC-12 | pass | three ledger lines → disagreements 0, evaluated 2, undefined_count 1, note non-empty |
| CC-15 | pass | A4 out-of-scope `not_evaluated` still would-merge; `unrunnable` `[]`, `outOfScope` `["A4"]` |
| CC-20 | pass | help lists `shadow-verdict`, `prepare`, `decide`, exit 0 |
| CC-30 | pass | `--merged` of a sha not on `origin/master` throws `origin/master` |
| CC-1 | pass in `policies.test.ts` | `merge` schema matches zod; `merge.json` is the data file |
| CC-22 | local | `npx tsc --noEmit -p .` exit 0. `npm run build` exit 0, stamped `2035e89`. No CI dispatched. |

Full `npx vitest run` on this tree before the product commit: **exit 1. Test Files 5 failed | 119 passed | 8 skipped (132). Tests 7 failed | 1749 passed | 78 skipped (1834).** None of the 7 are in `shadow-merge.test.ts`. Five are `Test timed out in 5000ms` (`t048-r3`, `b2-et` BE-1.2, two `state-import-r6`, `role-files`). One is `qa104-a9-probe2` `EPERM` on `symlinkSync` (Windows). Three `onTaskUpdate` timeouts. Re-run of the timeout files alone: **exit 1, 1 failed | 61 passed**. The remaining failure is `state-import-r6` D2, 5699ms against a 5000ms limit. BE-1.2 passed in that re-run (1436ms).

## Preserve

Held: B's `EvidenceSchema` and `declared.ts`; harness `validate evidence`; the runtime-never-merges sentence; `loadPolicies` still plan+done so a temp directory of those two files still loads; git spawn site still `git.ts:spawnGit` (`spawn-sites.test.ts` passed with the gate tests).

## Gaps

- CC-8, CC-10, CC-11, CC-16, CC-18, and CC-19 are implemented and not each a named row in the 17. Decide without a verdict file throws. Declined and replaced set `disagreed` from the original verdict. Summary reads the ledger. A loop mismatch is undefined. `runLoop` does not call prepare.
- CC-5.6 (required gate, mode `skip`, record absent) is the same missing-gate path as CC-5.5, with `gateMode === "skip"`.
- CC-13's check is in `runSync`. The MCP `ob_sync` in this session still runs the main checkout's build, so the new check does not appear there until that build is replaced. Absent ledger passes.
- CC-21 is cut. Not built.
- CC-23 stays unrunnable: the first live episode is this candidate's own merge, which the planner runs.

## Mutants

Each is one commit on its own branch off `2035e89`, message starts `NOT FOR MERGE`, `npx tsc --noEmit -p .` exit 0, then the named row fails (vitest exit 1).

| Branch | SHA | Failing line |
|---|---|---|
| `loop/15-slice-3-candidate-c-mut-undefined` | `9d5848fa7b34563f4383b705cd4cb0710c47ce07` | CC-12 expected evaluated 2, received 3 |
| `loop/15-slice-3-candidate-c-mut-pending` | `73e7779a78e00de72e43f8906f23779157c07594` | CC-5.1 expected `undefined`, received `would-not-merge` |
| `loop/15-slice-3-candidate-c-mut-lists` | `044682f5d7b1a7e7d7106a156980243632e3ea89` | CC-15 expected `unrunnable` `[]`, received `["A4"]` |
| `loop/15-slice-3-candidate-c-mut-overwrite` | `88e9c92983b574fb1264f056001224dd4fd7bae5` | CC-7 expected a throw, the second prepare returned |
| `loop/15-slice-3-candidate-c-mut-merged-sha` | `91e87ae8fc28f41b5e03bf755901ae613b4cee7f` | CC-30 expected a throw matching `origin/master`, decide returned |
