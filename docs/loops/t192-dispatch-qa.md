# T-192 (master's CI to tcm; `ci-status` names a never-started job; D-055's docs-PR skip): QA dispatch (record 183)

**By:** Atlas (planner), record session 147 · 2026-09-27. **Runs headless on a QA machine through the Cursor QA
driver**, with Composer 2.5. **Never write a live `state.json` or the real knowledge DB.** Commit the report from a
separate worktree.

## The candidate

- **`a38ff92`** on `origin/loop/t192-ci-tcm`, from `origin/master` `7243fd5`. The handoff is at `9678534`.
- Built by Grok 4.7 (`cursor-builder`), record 181, in three rounds: 181 (`53d3638`), 181b (`029b4a4`, the unread-steps
  cases) and D-055 (`a38ff92`).
- **CI on tcm:** red `36306777724`, `36307585948`, `36308121998`; green `36306815299`, `36307618596`,
  `36308198672`. Mutants `36306840333`, `36306866860`, `36307665393`, `36308231327`.

## Score against `docs/loops/session-147-dispatches.md`, "Record 181", plus D-055

1. **`runs-on`:** a master push goes to tcm, a dispatch goes to tcm, a dispatch with `hosted=true` goes to
   `ubuntu-latest`, and a push to another branch goes to tcm. Check `evalRunsOn` in `ci-runs-on.test.ts` against
   GitHub's documented expression rules (`&&`/`||` return operands). Say whether a four-case evaluator could pass
   while the real expression differs.
2. **`ci-status`:** zero steps is `never-started`; the steps being unreadable is named (view fails, unparseable, no
   `databaseId`); a real failure and a success are unchanged. Look for a path where the check still reports without
   having looked.
3. **D-055:** `pull_request.paths-ignore` is exactly `docs/**` and `README.md`. `push` and `workflow_dispatch` are
   unfiltered, and a PR touching `.agents/state.json` still runs.
4. **Preserve:** the egress self-check runs on every self-hosted job; `test-windows` is still opt-in; the job is
   still named `test`.
5. **Not verifiable before merge:** the first real master push landing on tcm. Name it as unrun.
6. **Your own mutants,** at least two.

## CI and authority

tcm, at most 6 runs. **No `windows=true` CI.** Push only `qa/t192-*`, through `node docs/loops/qa-183/push-qa.mjs`.

## The report

- **Path:** `docs/loops/t192-qa-report.md`, on `qa/t192-report`.
- Order: the verdict first, then each item, mutants, CI, defects, and your model.
- **The LAST line is exactly `QA-183: REPORT COMPLETE`.**
