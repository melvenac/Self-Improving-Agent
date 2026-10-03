# T-152 brief: finish type-checking the test suite, then enforce it in CI

**Planner:** Atlas, session 159, 2026-10-03. **Seat:** sia-infra (Cursor Composer 2.5, **desktop**, hub name
`cursor-infra`, room `k5702788wctxj75begyt4x2k5x8f6mav`). **Authority:** Aaron via clark, 2026-10-03 (dev work
unparked; sia-infra launched as a Cursor seat for T-152).

Read T-152's `note` in `.agents/state.json` first. State at dispatch: `tsconfig.tests.json` and the
`typecheck:tests` script are merged (#305, 8961635d); 36 of 40 errors were fixed there; the 4 "category-B" errors
were to land with #294 (T-215), which is now merged (2026-10-02). CI (`.github/workflows/ci.yml`) runs
`npx tsc --noEmit` (product only) and never `typecheck:tests`.

## The work: one PR

1. **Measure first.** On a fresh `origin/master`, run `npm run typecheck:tests` in `open-brain/` and paste the exact
   error count and list. If it is already 0, say so: then the only change is step 3.
2. **Fix what remains** in test files only, with real types. No `any`, `@ts-ignore` or `@ts-expect-error` added to
   silence an error unless the line is a deliberate type test, and then name why in a comment.
3. **Enforce it in CI:** add a step that runs `npm run typecheck:tests` to the `test` job, next to the existing
   `npx tsc --noEmit` (line ~133). Do the same in the Windows job only if that job already type-checks.
4. **Red first for the CI step:** on your own branch, plant one deliberate type error in a test file, push, and show
   the new CI step failing on it (run id), then remove it and show it green (run id). Do not dispatch Windows or
   tcm runs (`windows=true`/`tcm=true` need the planner).

## Rules for this seat (D-060, Composer)

- No test-only code in product files; no product behaviour change in this PR.
- One vitest FILE per invocation if you run tests at all; `tsc` runs are fine **after the desktop QA ends**
  (atlas posts END in your room); until then single files only.
- `/sync` before each commit. Branch from fresh `origin/master`; push and open the PR; **never merge, never push
  to master.** `.github/workflows/ci.yml` is a CI file: the merge needs Aaron's word, which the planner gets.
- Launch as `cursor-agent`, never bare `agent`. Start every work reply with `TASK: T-152, <what> (<branch>)`.

## Reporting

Hub only, from a file (`--say "$(Get-Content -Raw -Encoding UTF8 <file>)"`), then `--wait --wait-timeout 3500`:
PR number, head SHA, the before/after error counts, both CI run ids from step 4.
