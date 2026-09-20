# Loop 14 — QA report 3 (addendum): the version-bump commit `3135da4`

**By:** Probe (QA seat, uuid `53ca3ad9`) · **Date:** 2026-09-20, 21:41–21:45Z · **Scope, by the
planner's ruling:** one commit above the accepted candidate `c7fbdd9`, carrying the minor version
bump to 0.43.0, the CHANGELOG entry and a corrected sentence in the developer handoff, with no record
write. **If the diff touched anything under `open-brain/src` or `tests`, the full table of report 2
re-runs; otherwise: the diff confirmed by hand, the suite once alone with the exit code from a
variable, `sync --check` expecting the one announced issue and the version checks green at 0.43.0,
and the ACCEPTED verdict carried forward with the diff cited.** This is the second path.

## Verdict

**ACCEPTED carries forward from `c7fbdd9` to `3135da414e76b3258e74a82bb685de5a2c52c910`.** The diff
is exactly the ruled scope, the suite is green alone, and the sync gate shows nothing new.

## 1. The diff, confirmed in this tree

`git cat-file -t 3135da4…` → `commit`; parent `c7fbdd9`. Tree detached at `3135da4`, porcelain 0 at
21:41:49Z and again at 21:45:27Z. `git diff --stat c7fbdd9..3135da4`:

```
 .agents/SESSIONS/next-session.md        |  2 +-
 .agents/SYSTEM/SUMMARY.md               |  4 +-
 .agents/TASKS/INBOX.md                  |  2 +-
 .agents/TASKS/task.md                   |  2 +-
 CHANGELOG.md                            | 95 +++++++++++++++++++++++++++++++++
 README.md                               |  2 +-
 docs/loops/loop-14-developer-handoff.md | 16 +++++-
 package.json                            |  2 +-
 8 files changed, 117 insertions(+), 8 deletions(-)
```

- Files under `open-brain/src` or `open-brain/tests`: **0**. So no code or test changed and the
  full table does not re-run.
- `.agents/state.json`: **0 diff lines**; revision **56** stands. The four rendered views changed
  only where they carry the version.
- `package.json`: `0.42.0` → `0.43.0`. `README.md` line 5: `**Latest: v0.43.0**`; the one remaining
  `v0.42.0` in the README is the history-table row for the ref-watch release at line 248, which is
  correct as history. `SUMMARY.md` status line: `v0.43.0`. `CHANGELOG.md`: `## [0.43.0] - 2026-09-20`
  at line 3, 96 lines to the previous entry.
- `docs/loops/loop-14-developer-handoff.md`: §7 now reads *"974 tests pass"* (0 lines say 960), the
  stale sentence report 2 §6 F-C named; the developer set its error entry beside it.

## 2. Suite, alone

Build first: `npm run build` exit 0, `build-info.json` commit `3135da4…`, 21:42:09Z. Then
`npx vitest run > file 2>&1; echo VITEST_RC=$?` in `open-brain/`, 21:42–21:44Z with nothing else
running: **`VITEST_RC=0`, 65 files / 974 tests passed**, 136s, **0** lines matching
`unhandled|vitest-worker|timed out`. Same count as `c7fbdd9`, as it must be for a diff with no test
or source change.

## 3. Sync gate

`node .gitnexus/run.cjs analyze` exit 0 (T-055 did not fire). `node open-brain/build/cli.js sync
--check`: exit 1, **25 passed, 4 warnings, 1 issue, 0 skipped**. The issue is the announced
`mirror-parity: live↔template (.claude): end.md differs` and nothing else. `readme-version`,
`changelog` and `summary-version` appear in neither ISSUES nor WARNINGS — passed, at 0.43.0, which
§1's by-hand reads confirm. `build-freshness [pass]: build matches HEAD 3135da4`. The warnings are the
same four as at `c7fbdd9` (`prd-version`, `vault-index-parity`, `spec-provenance`, `command-parity`).

## 4. What this addendum does not claim

Nothing in report 2's table was re-observed here, because nothing it observes changed: the eight
files above are documents, the version and the rendered views. Report 2 at `667cd9d` remains the
evidence for every row; this file is the bridge from its SHA to the branch tip. The choreography items
in report 2 §11 are unchanged.
