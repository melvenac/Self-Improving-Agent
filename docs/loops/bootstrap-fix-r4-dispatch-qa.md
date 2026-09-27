# The `/bootstrap` fix round 4: dispatch to a FRESH, HEADLESS QA seat (record session 161)

**By:** Atlas (planner), record session 146 · 2026-09-27. **Runs from** `qa-queue.ps1` via `docs/loops/qa-161/drive.ps1`.
**Record the machine, and whether this process runs elevated.** Nobody is watching live. Use `C:\qa-tmp` and
`C:\qa-scratch`. Never write a live `state.json`. Commit the report from a separate worktree.

## The candidate

- **`7bd47f4`** on `origin/loop/bootstrap-fix-r4`. The handoff is at `dad50d2` (`docs/loops/` only after `7bd47f4`).
- Stacked on r3 `7f4ca74` (via its handoff `ee3acce`), which QA 145 ACCEPTED. **Score only what round 4 adds.**
- **Product:** `cli.ts`, `bootstrap/index.ts`, `shared/repo-root.ts`, the new `shared/state-record.ts`, and
  `bootstrap.md`.
- Built by **Grok 4.7 in Cursor** (`cursor-builder`), record 156.
- **CI on tcm:**
  - r4: red `36292493433`, green `36292685700`; mutants bf17 `36292739711`, bf18 `36292782633`, bf19 `36292811280`,
    bf20 `36292846089`;
  - R-BF-21: red `36294152464`, green `36294196644`, mutant `36294232450`.

## Score against `docs/loops/t171-bootstrap-rulings-qa144-qa145.md` (the QA 145 section) and `bootstrap-r4-amend-and-queue-guard-brief.md` (R-BF-21)

1. **R-BF-17:** re-run QA 145's non-record JSON probe byte-exact. All seven shapes must now be NOT A RECORD, and
   `move-residue` sets them aside.
   - A real v3 record, and an older schema that carries `schema_version`, stay BOOTSTRAPPED.
   - **What does `/start` do on each?** Report it; its fallback is not this round's.
2. **R-BF-18:** a zero-byte `.agents/state.json` between a real project and the cwd no longer wins the walk.
   - SIA's own root resolves unchanged from its root, `open-brain/`, `open-brain/src/` and `docs/`.
   - **`state-record.ts` is now shared by the root walker and bootstrap.** Confirm that every caller of
     `isProjectRoot` (9 call sites at r3) still behaves as at r3 on real records.
3. **R-BF-19:** QA 145's install N now reaches (e) with the step `Next:` names, and no inference. `bootstrap.md`
   step 1 matches.
4. **R-BF-20 and R-BF-21:** the failed-undo path through the CLI never says "refused" (QA 145's P-UNDO).
   - `git grep OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK` finds nothing in `src/`.
   - **No other environment variable or dynamic `import()` in `cli.ts` changes how a mutating command behaves.**
5. **Regressions:** QA 145's rows (`qa/bootstrap-fix-r3-qa-tests` `2c279ad`) and all four installs, re-run with no
   manual fix. The real session-end hook in install (iii) still writes into the child.
6. **Your own mutants,** at least one per ruling.

## CI and authority

tcm, at most 6 runs. **No laptop (`windows=true`) CI.** **Push only `qa/bootstrap-fix-r4-*`, through
`node docs/loops/qa-161/push-qa.mjs`.**

## The report

- **Path:** `docs/loops/bootstrap-fix-r4-qa-report.md`.
- Order: the verdict first, then each item, mutants, CI, what could not be verified, defects, disagreements, error
  entries, and "Open for the planner".
- Commit to `qa/bootstrap-fix-r4-report`. **The LAST line is exactly `QA-161: REPORT COMPLETE`.** No `/end`.
