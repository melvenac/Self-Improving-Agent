# Loop 15 slice 3 candidate C, round 3 — developer handoff

Forge, Grok 4.7, worktree `C:\Users\melve\Worktrees\sia-forge`. Record 201 r3, after QA 212 rejected `8054f9f` (`qa/c-r2-report` `2ffece8`). Criteria `23ebd86`. Same branch, same base `d1e8674`. No CI. GitNexus impact was not run: the index is 471 commits behind (`6bd97f2`) and the tools are not in this session. Callers of the new check are `cmdShadow` in `open-brain/src/harness/cli.ts`. `runLoop` does not import it.

## What changed

`prepare` and `decide` refuse a sha that is not 40 lowercase hex before they write. That covers `candidate_sha` and `criteria_sha` on prepare, and `--candidate`, `--merged`, and `--replaced` on decide, in the function and in the CLI. A valid sha still writes. `summary` takes no sha and writes nothing; the CLI row checks that a summary call leaves the ledger unchanged.

## Local runs

Red, tests only, `3854b2fc1dde9336cfb4b265b0461f2f053580e2` on `8054f9f`. `npx vitest run tests/harness/shadow-merge.test.ts -t "record 201 r3"` exit **1**. **3 failed | 25 skipped.** The same three rows failed in the unfiltered file (**3 failed | 25 passed**).

- prepare `bad`, 39 chars, 41 chars, and uppercase: `did not throw` and wrote `artifacts/iterations/t001/<id>/shadow_merge.json`. The same four values as `criteria_sha` wrote the valid candidate path.
- CLI prepare exited 0 with empty stderr and wrote those paths. CLI `decide --candidate` exited 0 and changed the ledger. CLI `decide --merged` threw `it is not reachable from origin/master`. CLI `decide --replaced` threw `--replaced requires a 40-character sha`.
- decide `candidate` `did not throw` and the ledger changed. `merged` threw `not reachable`. `replaced` threw `a replacement sha must be 40 hex characters`.

Green, `20c2dfd21fd53cd548ce9a0c8b27d99e45b0e410`. `npx tsc --noEmit -p .` exit **0**. `npm run build` exit **0**, stamped `20c2dfd`. `npx vitest run tests/harness/shadow-merge.test.ts tests/harness/spawn-sites.test.ts tests/harness/policies.test.ts` exit **0**. **Test Files 3 passed. Tests 62 passed.**

## Mutant

`loop/15-slice-3-candidate-c-r3-mut-sha` `5b9eb09a055b8a5d5bfa97c2573f7eb81a38807c`, one commit off `20c2dfd`. Message starts `NOT FOR MERGE`. `npx tsc --noEmit -p .` exit **0**. The r3 vitest filter exit **1**, 3 failed. `candidate bad: did not throw` and wrote `artifacts/iterations/t001/bad/shadow_merge.json`. The CLI row: `prepare --candidate bad: exit 0` and wrote that file.
