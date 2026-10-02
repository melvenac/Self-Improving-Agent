# T-208 r3 developer handoff (Forge, 2026-10-02)

Dispatch: atlas-sia, planner session 157, ruling 2. Branch `loop/t208-fetch-first` (PR #289), **rebased onto
`origin/master` 50700414**; the T-208 commits are now `eba69cfb` (original), `c0eee5e4` (r2), `63026843`
(r2 mutant diffs), and the r3 code commit below. The r2 narrative is in `docs/loops/t208-t212-developer-handoff.md`
on `loop/t212-trailer-attribution` (its hashes there predate this rebase).

## r3: the hook prints drift beside tree currency, on startup and resume

- `pipelines/session-start/drift-line.ts` (new): `describeDriftLine(root)` runs the same check ob_start reports
  (`readProjectState` then `detectDrift`) and returns ONE line: `Drift: none`, `Drift detected (N): <field>: expected X, got Y (not fixed); ...`,
  or `Drift: not checked (<cause>)`. Not checked covers a present-but-invalid `.agents/state.json` (cause is the schema error)
  and any thrown error. It never degrades to `none`.
- `cli-bootstrap.ts`: one line pushes it directly after the currency lines. The hook has no matcher, so startup and resume share the path.
- Wording: capitalised `Drift:` to match ob_start's `Drift: none`; the dispatch wrote `drift: not checked` in lower case inside a sentence.
- Honest limit: `detectDrift` is what ob_start runs today, and it compares SUMMARY.md's version and INBOX-completed items, not every
  rendered view against state.json. The hook is the same check, not a stronger one.
- Tests `tests/pipelines/session-start/drift-line.test.ts` (7 rows, real hook entry point, scratch HOME): drifted views named
  (`summary-version: expected 1.2.3, got 0.0.1`), clean fixture says `Drift: none`, unreadable state.json says `not checked` and never `none`,
  each on startup and resume, plus a never-throws row.
- **Red** (the same file with `cli-bootstrap.ts` at HEAD~, the call absent): 6 failed, 1 passed. **Green:** 7 passed, `tsc --noEmit` 0.
- **Mutants** (`docs/loops/t208/mutants/`, each `tsc` 0, both reverted): `drift-invalid-as-none.diff` (invalid state.json returns `Drift: none`):
  2 failed (the not-checked rows). `drift-names-dropped.diff` (count without the field names): 2 failed (the named rows).

## Runs

Single files, one per vitest run: `drift-line.test.ts` 7 passed, `tree-currency-fetch.test.ts` 12 passed after the rebase. `tsc --noEmit` 0.
Not run: full suite (CI), `/sync` (stale local build).

## Also this session

#294 (T-215): S4-9.2 allowance table, head `39c3cca7`, CI green. The real counts by the guard's own regex are
cli-flags 19 to 18 and ranking 11 to 10; the dispatch's 17 to 16 came from a different count and the table uses the guard's.
