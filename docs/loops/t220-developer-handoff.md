# T-220 developer handoff: `closeout-tables` labels and repo-relative `G_plan` paths (D-092 F2, F4)

**By:** Builder (developer seat, `sia-builder`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t220-closeout-labels` from `origin/master` `f13307e1`.
**Dispatch:** `docs/loops/t220-dispatch.md` at `87417288`. Files changed: `open-brain/src/harness/closeout-tables.ts`, `open-brain/src/harness/brief-plan-gate.ts`, and the new `open-brain/tests/harness/t220-closeout-labels.test.ts`. Single files run locally; CI runs the suite.

## F2: the `no E_t` label

**Where the E_t facts come from: the criteria's Terms table** (`docs/loops/loop-15-slice-4-criteria.md`, the "QA `E_t`" column), read by the new `readTermsTable`. The harness did not read any source for this before; the reconstruction map names no E_t, and the records directory only holds a copy after a `G_qa` has run, which was the defect. The criteria path defaults to the file beside the records directory and can be passed as `criteriaPath`.

Labels in the 4.4 column of the diffs table: `scored` when a `G_qa` exists; otherwise, from the Terms table, `not called` (the diff has an E_t) or `not scored: no E_t` (its last cell starts with `none`: #182, #165, #187); `not scored: E_t unknown` for a PR the table does not list. A table that is missing or has no rows is `null`, never read as "no E_t": the output then says `E_t source: none (...)` and falls back to the old copy-presence rule, which keeps the existing `s4-g6-closeout` tests (they build a records directory with no criteria file) unchanged. With the table the output says `E_t source: the criteria Terms table (N rows).`

Also fixed: `No scored records..` (the doubled full stop).

## F4: `G_plan` paths

`brief` and `dt` in a `G_plan` record, and the path inside `sources.spec_excerpt`, are now repo-relative with forward slashes (`repoRelative`). A path outside the repository is reduced to its file name, never written absolute or as `../..`. Nothing in the repo reads those two fields back (grep), and the existing `t195-plan-gate` assertions on `sources` still hold.

## Red then green

- **Red:** the new file against master's source: 7 of 7 failed (L1 to L6 and P1; reasons: `not scored: no E_t` for #195, no `E_t source` line, `records..`, absolute path in `brief`). L2 first failed for a test-helper reason (it read the per-record table row), which I fixed in a second red commit before touching the source.
- **Green:** after the change, `t220-closeout-labels` + `s4-g6-closeout` + `t195-plan-gate`: 32 passed; `b2-et` + `runtime`: 85 passed; `s4-g1-records` + `s4-g2-key`: 32 passed. `tsc --noEmit` 0.
- L6 runs on the real records directory: #195, #209, #218, #220, #227 are not labelled `no E_t`; #182, #165, #187 are.

## Notes

The existing close-out file `docs/loops/loop-15-slice-4-closeout.md` is not touched; regenerate its tables with `harness closeout-tables` after this merges. Free RAM was 1.18 GB at the first run (under 1.5 GB; single files only).
