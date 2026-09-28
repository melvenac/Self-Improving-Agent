# T192-D1 + T-048 r3 server rows (`ecd378d`): QA report (QA seat, record session 196)

**By:** the QA seat, record session **196**, headless, launched by `docs/loops/qa-196/drive.ps1` (Cursor,
Composer 2.5). 2026-09-28 (UTC). **Machine:** `DESKTOP-O4EGB1E` (`$env:COMPUTERNAME`). **Elevated: yes.**
`net session` succeeds, and `WindowsPrincipal.IsInRole(Administrator)` is `True` for this process tree.
**Defender exclusions:** `C:\qa-scratch`, `C:\qa-tmp`. Probes and mutants ran with `TEMP=TMP=C:\qa-tmp`.
**Model:** `composer-2.5` (named in `docs/loops/qa-196/drive.ps1`). **Dispatch:**
`docs/loops/t192-d1-dispatch-qa.md`. **Candidate:** `ecd378d` on `origin/loop/t192-d1` (product commit;
tip `9d449f4` adds only the handoff). **Base:** `origin/master` `bf33fe4`. **Brief:** Record 193 in
`docs/loops/session-147-dispatches.md`. **Scripts:** `docs/loops/qa-scripts-t192-d1/`. **Nothing live was
written.**

## Verdict

**ACCEPT `ecd378d`.** After a successful `gh run view`, a missing `test` job names
`failure (steps not read: job test absent in run view)` and a non-array `steps` field names
`failure (steps not read: steps field missing)`. `steps: []` stays `never-started`; real failures and
successes are unchanged. The two new `t048-r3.test.ts` rows on `handleSync` (score) and `handleScore`
assert **missing** and **unreadable** and are real guards — developer `mut-routes` kills exactly those
rows. `invocationLogSuffix` and every other `ci-status` path are unchanged. Product diff is three files
only (`checks-state.ts` plus the two test files).

- **Low (limit, not blocking):** duplicate `test` jobs use `.find()` — first match wins, so order can
  flip `never-started` vs `failure`. A non-empty `steps` array whose entries are unreadable (e.g.
  `[null]`) reports plain `failure` without inspecting step contents. Neither case is in scope for
  record 193; both are documented below.

## The dispatch's checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | **T192-D1:** absent `test` job → `failure (steps not read: job test absent in run view)`; non-array `steps` → `failure (steps not read: steps field missing)`; `steps: []` → `never-started`; real failure and success unchanged; probe odd job shapes | **Holds.** Product adds the two named branches after a successful `run view`. Tests in `checks-state.test.ts` pin absent job (including empty `jobs`), omitted/`null` `steps`, and empty array vs never-started. Edge probes: dual `test` jobs (first wins), `[null]` step entry → plain failure, string `steps` → steps-field-missing. | `tests/pipelines/sync/checks-state.test.ts` r181b block; `qa-scripts-t192-d1/evidence/edge-probes.out`; local mutant `m-d1-absent-only` |
| 2 | **T-048 r3 rows:** `handleSync`/`handleScore` assert missing and unreadable; rows passed on unfixed product; `mut-routes` kills them; would one row pass if a single route dropped the suffix? | **Holds.** Red `6901c1f` failed only the two T192-D1 rows; both new T-048 rows were already green on unfixed `checkCiStatus`. Candidate adds two `it()` blocks mocking `readLastInvocationTs` as `null` and `"unreadable"`. Developer `mut-routes` (`2232d7f`, run `36360002881`) failed exactly those two rows (2 failed, 1801 passed). **No row would pass with only one route broken:** each `it()` asserts both `handleSync` and `handleScore` in the same test. | `tests/t048-r3.test.ts`; developer handoff; run `36360002881` log |
| 3 | **Preserve:** other `ci-status` states and `invocationLogSuffix` unchanged; nothing outside `ci-status` and the two test files changes behaviour | **Holds.** `git diff bf33fe4 ecd378d` touches only `checks-state.ts`, `checks-state.test.ts`, `t048-r3.test.ts`. `score-line.ts` / `invocationLogSuffix` byte-identical between base and candidate. Never-started, run-view error, unparseable list, no-databaseId, and plain-failure paths unchanged in the diff hunks. | `git diff bf33fe4 ecd378d --stat`; `git show` on `score-line.ts` |
| 4 | **My mutants,** at least two on `qa/t192-d1-mut-*` | **Two local, two on tcm** (3 CI runs of 4 budget; one re-run after a bad first push). Both kill on the intended row only after the fix. | Mutants table |

## Mutants

Driver `mutants-qa196.mjs`. Anchors matched once (or `count: 1` for the first server score loop).
`tsc --noEmit` before commit; sources restored after local `run`.

| Row | Mutant | What it breaks | Local kill | tcm run | tcm kill |
|---|---|---|---|---|---|
| T192-D1 absent | `m-d1-absent-only` (**QA**) | `if (!test)` returns plain `failure` again | **yes** — absent-job row only | `36374794252` | 1 failed (`a run view with no test job names that absence`) |
| T192-D1 steps | `m-d1-steps-missing-only` (**QA**) | `!Array.isArray(test.steps)` returns plain `failure` | **yes** — steps-missing row only | `36375259625` (fixed) | 1 failed (`steps field is missing names that`) |
| T192-D1 (both names) | `mut-plain` (developer) | drops both new names | *(developer)* `36359245803` | same | 2 failed, T192-D1 rows only |
| T-048 routes | `mut-routes` (developer) | hides missing/unreadable suffix on both server score loops | *(developer)* local per handoff | `36360002881` | 2 failed, missing + unreadable rows only |

**Note:** first push of `qa/t192-d1-mut-steps-missing-only` (`fd83b52`) accidentally plain-failed the absent
branch too (dirty worktree during `commit`); run `36374796515` showed 2 failed. Fixed at `46d1754` and
re-run `36375259625` — 1 failed as intended. `mut-score` (`36359302570`, 3 failed) is out of scope per
dispatch.

**Branches pushed** (read back via `push-qa.mjs`): `qa/t192-d1-mut-absent-only` `599e954`;
`qa/t192-d1-mut-steps-missing-only` `46d1754`.

## CI

| | SHA | tcm run | Result |
|---|---|---|---|
| Developer red (tests on unfixed check) | `6901c1f` | `36358778248` | **failure.** 2 failed, 1801 passed, 6 skipped (1809). T192-D1 rows only; T-048 rows green. |
| Developer green | `ecd378d` | `36359004908` | **success.** 1803 passed, 6 skipped (1809). 130 files. `test-windows` skipped. |
| Developer `mut-plain` | `ea90542` | `36359245803` | **failure.** 2 failed — T192-D1 only. |
| Developer `mut-routes` | `2232d7f` | `36360002881` | **failure.** 2 failed — missing + unreadable server rows only. |
| QA `m-d1-absent-only` | `599e954` | `36374794252` | **failure.** 1 failed, 1802 passed, 6 skipped. |
| QA `m-d1-steps-missing-only` (fixed) | `46d1754` | `36375259625` | **failure.** 1 failed, 1802 passed, 6 skipped. |

No `windows=true` CI. No run for the candidate itself — developer green is its record.

## Defects

| ID | Severity | Defect | Where |
|---|---|---|---|
| T192-D8 | Low (limit) | Two jobs named `test`: `.find()` takes the first; empty-first → `never-started` even if a later duplicate had steps; steps-first → `failure` even if a later duplicate was empty. | `checkCiStatus` `body.jobs?.find((j) => j.name === "test")` |
| T192-D9 | Low (limit) | A non-empty `steps` array with unreadable entries (e.g. `[null]`) reports plain `failure` without reading step contents. Out of scope for record 193. | `checkCiStatus` length check only |

## Disagreements

None with the developer's CI numbers, mutant kills, or handoff claims.

## Error entries (my own)

- First `commit` on `m-d1-steps-missing-only` landed on a worktree that still carried the absent-only
  edit, so the absent branch was plain-failed too. Recommitted from clean `ecd378d` and re-pushed;
  run `36374796515` is superseded by `36375259625`.

## Open for the planner

None block the merge.

1. **T192-D8 / T192-D9:** if GitHub ever returns duplicate `test` jobs or step entries without names,
   consider `.findLast`, merging, or a dedicated unreadable-steps message — only if a real run appears.

## Reproduce

Scratch root `C:\qa-scratch\qa196`: `cand/` = candidate at `ecd378d`; `mut/` = report worktree on
`qa/t192-d1-report`.

```
cd C:/qa-scratch/qa196/cand/open-brain && npm test -- tests/pipelines/sync/checks-state.test.ts tests/t048-r3.test.ts
node C:/qa-scratch/qa196/mut/docs/loops/qa-scripts-t192-d1/probe-edge.mjs C:/qa-scratch/qa196/cand/open-brain
QA_ROOT=C:/qa-scratch/qa196/cand node C:/qa-scratch/qa196/mut/docs/loops/qa-scripts-t192-d1/mutants-qa196.mjs <name> run
node docs/loops/qa-196/push-qa.mjs qa/t192-d1-mut-<name>
gh workflow run ci.yml --ref qa/t192-d1-mut-<name> -f hosted=false
```

QA-196: REPORT COMPLETE
