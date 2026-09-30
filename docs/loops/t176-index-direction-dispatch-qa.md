# Record 200 (T-176: the index check measures distance in both directions): QA dispatch (record 208)

**By:** Atlas (planner), 2026-09-28. **Runs headless on the LAPTOP through the Cursor QA driver, with GPT
(`gpt-5.6-sol-medium`)** (Composer built it; D-060). **Never write a live `state.json`, the real knowledge DB, or this
repo's real `.gitnexus/`.** Commit the report from a separate worktree.

## The candidate

- `origin/loop/t176-index-direction` (product and tip are named in the handoff,
  `docs/loops/t176-index-direction-developer-handoff.md`); from `origin/master` `d1e8674`. Built by Composer 2.5
  (`cursor-infra`), record 200. Mutants: `origin/loop/t176-index-direction-mutant-*`.
- The brief is "Record 200" in `docs/loops/session-147-dispatches.md`.

## Score

1. **Ahead, behind and diverged are reported distinctly.** Diverged, and an indexed SHA that is not in the repository,
   are each an ISSUE naming both SHAs, never a PASS. Build real throwaway repos for each case.
2. **Preserve:** an index at HEAD is PASS; no `.gitnexus` is SKIP with its reason; `--check` writes nothing.
3. **The detached-branch trap** (CLAUDE.md: "the recorded branch is not evidence"): a current index whose recorded branch
   is dead reads current.
4. **The developer's evidence is local only:** confirm red on master and green on the candidate on tcm, and that each
   mutant fails.
5. Your own mutants, at least two, on `qa/t176-mut-*`.

## The report

- **Path:** `docs/loops/t176-index-direction-qa-report.md`, on `qa/t176-report`.

## Evidence file (C's criteria §8 P1)

Beside the report, write `docs/loops/t176-index-direction-qa-report.E_t.json` with loop id `200-index-direction`, following `EvidenceSchema` (`open-brain/src/harness/schema.ts`). One `acceptance[]` row per item above, with status `met`, `unmet`, `partial`, `not_evaluated` or `pending`, and `order` set to `shown` or `attributed` on every `met` row. Also `runtime_checks` from your CI runs, and `candidate_git.sha` as the full 40-character product SHA. From `open-brain/`, run `node build/harness/cli.js validate evidence <file>` (or the path `harness help` names) and quote the exit code. **A report without a valid evidence file is incomplete.**

## CI and authority (D-061: QA runs the CI)

Dispatch the red, green and mutant runs on tcm yourself (`gh workflow run ci.yml --ref <branch>`), at most 4 runs, and quote each run id with its conclusion and headSha. **No `windows=true`:** this laptop IS the Windows runner.

**The LAST line of the report is exactly `QA-208: REPORT COMPLETE`.** Push only `qa/t176-*`, through
`node docs/loops/qa-208/push-qa.mjs`.
