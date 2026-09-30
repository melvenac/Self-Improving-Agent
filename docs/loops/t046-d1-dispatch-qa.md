# Record 207 (QA 197's D1: `cursor-hook-compat` never passes without reading): QA dispatch (record 209)

**By:** Atlas (planner), 2026-09-28. **Runs headless on the LAPTOP through the Cursor QA driver, with GPT
(`gpt-5.6-sol-medium`)** (Composer built it; D-060). **Never edit anything under `~/.claude` or `~/.cursor`.** Commit
the report from a separate worktree.

## The candidate

- `origin/loop/t046-d1` (product and tip in `docs/loops/t046-d1-developer-handoff.md`), from `origin/master` `d1e8674`.
  Built by Composer 2.5 (`cursor-infra`), record 207. Mutant: `origin/loop/t046-d1-mutant-*`.
- The brief is "Record 207" in `docs/loops/session-147-dispatches.md`. The finding is QA 197's D1
  (`qa/t046-detector-report`).

## Score

1. **All three rows exist and were red on master:** a missing, an empty, and a nonexistent `installPath` each give
   SKIP or ISSUE, naming the plugin and saying the check could not read it. The developer's report quoted ONE red row;
   check all three.
2. **Preserve:** zero installs, or an install with no `hooks/hooks.json`, stays PASS. The T-046 detection rows from
   record 194 are unchanged.
3. **Fixture isolation (G-044):** no row reads the real profile.
4. Your own mutants, at least two, on `qa/t046-d1-mut-*`.

## The report

- **Path:** `docs/loops/t046-d1-qa-report.md`, on `qa/t046-d1-report`.

## Evidence file (C's criteria §8 P1)

Beside the report, write `docs/loops/t046-d1-qa-report.E_t.json` with loop id `207-hook-compat-d1`, following `EvidenceSchema` (`open-brain/src/harness/schema.ts`). One `acceptance[]` row per item above, with status `met`, `unmet`, `partial`, `not_evaluated` or `pending`, and `order` set to `shown` or `attributed` on every `met` row. Also `runtime_checks` from your CI runs, and `candidate_git.sha` as the full 40-character product SHA. From `open-brain/`, run `node build/harness/cli.js validate evidence <file>` (or the path `harness help` names) and quote the exit code. **A report without a valid evidence file is incomplete.**

## CI and authority (D-061: QA runs the CI)

Dispatch the red, green and mutant runs on tcm yourself (`gh workflow run ci.yml --ref <branch>`), at most 4 runs, and quote each run id with its conclusion and headSha. **No `windows=true`:** this laptop IS the Windows runner.

**The LAST line of the report is exactly `QA-209: REPORT COMPLETE`.** Push only `qa/t046-d1-*`, through
`node docs/loops/qa-209/push-qa.mjs`.
