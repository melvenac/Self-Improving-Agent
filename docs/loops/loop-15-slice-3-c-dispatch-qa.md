# Candidate C (T-155, the shadow merge gate): QA dispatch (record 204)

**By:** Atlas (planner), 2026-09-28. **Runs headless through the Cursor QA driver, with GPT (`gpt-5.6-sol-medium`).** A
model that neither wrote C's criteria (Composer, QA 191) nor built C (Grok). **Never write a live `state.json` or the
real knowledge DB.** Commit the report from a separate worktree.

## The candidate

- Product **`2035e89`** on `origin/loop/15-slice-3-candidate-c`, from `origin/master` `d1e8674`. The tip is `7099b20`
  (handoff); red tests are at `970c1b8`. PR #195. Handoff: `docs/loops/loop-15-slice-3-c-developer-handoff.md`.
- Built by Grok 4.7 (Forge), record 201. The developer ran nothing on CI (D-061); its local runs are in the handoff.
- Mutant branches: `origin/loop/15-slice-3-candidate-c-mut-{undefined,pending,lists,overwrite,merged-sha}`.

## Score against the criteria at `e6b64e9`

`docs/loops/loop-15-slice-3-c-criteria.md` at `e6b64e9` on `origin/docs/session-100-qa99-dispatch`. **§8's
amendments override §1.** Score every row CC-0 to CC-22 (CC-21 is cut), plus CC-29 and CC-30. §2's declared rows are
reported as declared, not scored. Also:
1. **The developer's full local vitest exited 1** ("timeouts plus the pre-existing Windows symlink EPERM"). Run the full
   suite on tcm at `2035e89` and at the base, and say whether any failure is new.
2. **CC-13.2:** the diff touches only `pipelines/sync/index.ts`, not `checks.ts`. Confirm that the `/sync` check exists,
   runs on every sync, and fails on a malformed ledger line.
3. **Coverage:** the handoff shows 17 tests for about 24 rows. Name every row that no test asserts.
4. Your own mutants, at least two, on `qa/c-mut-*`.

## The report

- **Path:** `docs/loops/loop-15-slice-3-c-qa-report.md`, on `qa/c-report`.
- Order: the verdict first, then each CC row, mutants, CI, defects, and your model.

## Evidence file (NEW from this dispatch on; C's criteria §8 P1)

Beside the report, write `docs/loops/loop-15-slice-3-c-qa-report.E_t.json` with loop id `15-slice-3-c`, following the `EvidenceSchema` (`open-brain/src/harness/schema.ts`). One `acceptance[]` row per item above, with status `met`, `unmet`, `partial`, `not_evaluated` or `pending`, and `order` set to `shown` or `attributed` on every `met` row. Also `runtime_checks` from the CI you ran, and `candidate_git.sha` as the full 40-character product SHA. From `open-brain/`, run `node build/harness/cli.js validate evidence <file>` against the candidate's build; if the path differs, use the one `harness help` names. Quote its exit code in the report. **A report without a valid evidence file is incomplete.** Commit it on the report branch.

## CI and authority (D-061: QA runs the CI; developers no longer do)

Dispatch the candidate's red, green and mutant runs on tcm yourself (`gh workflow run ci.yml --ref <branch>`), at most 6 runs. **No `windows=true`.** Quote each run id with its conclusion and headSha.

**The LAST line of the report is exactly `QA-204: REPORT COMPLETE`.** Push only `qa/c-*`, through
`node docs/loops/qa-204/push-qa.mjs`.
