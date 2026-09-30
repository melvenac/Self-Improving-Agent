# Record 205 r3 (T-178, P0: CI runs automatically on push to seat branches): QA dispatch (record 211)

**By:** Atlas (planner), 2026-09-28. **Headless, Cursor QA driver, Composer 2.5** (Grok built it).

## The candidate

Product **`bc6c6d2`** on `origin/loop/t178-ci-on-push`, tip `6c74a1b` (handoff), base `d1e8674`. Mutants:
`origin/loop/t178-ci-on-push-mut-{paths,concurrency}`. The brief is "Record 205" in
`docs/loops/session-147-dispatches.md`. It was returned twice by the planner (master filtered, master cancel, then a
fail-open skip), and each return is in the same file.

## Score

1. **Seat pushes run CI:** a push to `loop/**` and to `qa/**` triggers.
2. **The skip is proven, never inferred:** tests are skipped only when EVERY changed file (by `git diff before..sha`) is
   under `docs/` or is `README.md`. Code plus docs RUNS; an empty or unreadable list, an all-zero `before`, a
   force-push, or a failed changed-files job RUNS. Look for a path that skips code: a rename, a submodule, or
   `fetch-depth` too shallow to hold `before`.
3. **Master is unchanged:** a docs-only push to master still runs, and a master run is never cancelled.
   `workflow_dispatch` and its inputs are unchanged, and `windows` stays opt-in.
4. **No double run:** a seat push plus its PR share a concurrency group, and the newer cancels the older.
5. **The live test:** push a throwaway `qa/t178-live-*` branch with one code change and confirm a run starts on its
   own, quoting the run id. Push a docs-only `qa/t178-live-docs-*` branch and confirm the test job is skipped. This
   exercises GitHub's trigger, which no unit row can. **This works only if `ci.yml` on the pushed branch is the
   candidate's:** branch from `bc6c6d2`.
6. Your own mutants, at least two, on `qa/t178-mut-*`.

## CI and authority (D-061)

Run the candidate's CI yourself, at most 6 runs, including item 5's pushes. No `windows=true`.

## The report

`docs/loops/t178-ci-on-push-qa-report.md` on `qa/t178-report`.

## Evidence file (C criteria §8 P1)

Beside the report, write `docs/loops/t178-ci-on-push-qa-report.E_t.json` with loop id `205-ci-on-push`, following `EvidenceSchema` (`open-brain/src/harness/schema.ts`): one `acceptance[]` row per item, `order` on every `met` row, `runtime_checks`, and `candidate_git.sha` as the full product SHA. From `open-brain/`, run `node build/harness/cli.js validate evidence <file>` and quote the exit code. A report without a valid evidence file is incomplete.

**The LAST line is exactly `QA-211: REPORT COMPLETE`.** Push only `qa/t178-*`, through `node docs/loops/qa-211/push-qa.mjs`.
