# QA 250 report: T-221 (CI concurrency per event) + T-222 (`count-attempts`, F6 to F8)

**By:** QA 250 (headless Claude Code, Opus 5.5), record session 250, 2026-10-02. **Dispatch:**
`docs/loops/qa-250-t221-t222-dispatch.md`. **Dispatch tree:** `~/qa-scratch/qa250-wt` at
`5b7e034fe505d2995272c4d045968e0a5b65c5c5` (`git -C ~/qa-scratch/qa250-wt log -1 --format=%H`).
**Candidates:** T-221 `9ab021fdd2df605aacdff2de4db4b963f131d32d` (worktree `~/qa-scratch/qa250-t221`), T-222
`7b42ed6fe22539efd48f4ceaa774a0b33e3236c9` (worktree `~/qa-scratch/qa250-t222`). Job class LIGHT: touched test files,
mutants on those files only, `gh` reads. No full suite. **No live Jev call was made** (the one `shadow-done` run was
`--mode dry-run`, env stripped to PATH/HOME/TMPDIR; record says `sent: false`, `outcome_class: unavailable`).
No issue or PR was created, commented on or edited. Pushed only `qa/t221-t222-ci-candidate` and `qa/t221-t222-report`,
both through `push-qa.mjs`.

## Verdicts

- **T-221 (`9ab021fd`): ACCEPT.** One gap, not blocking (row 6).
- **T-222 (`7b42ed6f`): ACCEPT.**
- **Pair: ACCEPT.**

## T-221 rows

### 1. Confined: MET

`git diff --stat origin/master...9ab021fd`:

```
 .github/workflows/ci.yml                           |  9 ++++--
 docs/loops/t221-developer-handoff.md               | 20 ++++++++++++
 open-brain/tests/pipelines/sync/ci-runs-on.test.ts | 37 +++++++++++++++++++++-
```

Commits: `770da4e4` (the change), `1ad2024e` and `4ef8d449` (comment-only, for B), `9ab021fd` (handoff).

### 2. The expression: MET

```yaml
group: "${{ github.event_name == 'workflow_dispatch' && format('ci-dispatch-{0}', github.run_id) || format('ci-{0}-{1}', github.event_name, github.head_ref || github.ref_name) }}"
cancel-in-progress: "${{ github.event_name != 'workflow_dispatch' && github.ref != 'refs/heads/master' }}"
```

Read by hand (`&&` binds tighter than `||`; each returns a value):

| event | context | group | cancel-in-progress |
| --- | --- | --- | --- |
| push to `loop/x` | head_ref `""`, ref_name `loop/x`, ref `refs/heads/loop/x` | `ci-push-loop/x` | `true && true` = **true** |
| PR from `loop/x` | head_ref `loop/x`, ref `refs/pull/N/merge` | `ci-pull_request-loop/x` | **true** |
| push to `master` | ref_name `master`, ref `refs/heads/master` | `ci-push-master` | `true && false` = **false** |
| workflow_dispatch | run_id R | `ci-dispatch-R` (per run) | `false` (first conjunct) |

- Push and PR on `loop/x`: **different** groups (`ci-push-…` vs `ci-pull_request-…`). Each newer run of the same
  event shares its group and cancels the older.
- Master: `cancel-in-progress` is **false**, unchanged from master's expression.
- Dispatch: keeps `ci-dispatch-{run_id}`; the dispatch arm is unchanged.

### 3. The developer's live evidence, re-read: MET

`gh run view <id> --json event,headSha,conclusion,createdAt,updatedAt,jobs`:

| run | event | headSha | conclusion | `test` job | createdAt | updatedAt |
| --- | --- | --- | --- | --- | --- | --- |
| 36967616444 | push | 770da4e4 | success | success | 05:08:35Z | 05:19:49Z |
| 36967619519 | pull_request | 770da4e4 | success | success | 05:08:38Z | 05:16:10Z |
| 36968459049 | push | 1ad2024e | **cancelled** | cancelled | 05:20:03Z | 05:24:51Z |
| 36968462359 | pull_request | 1ad2024e | **cancelled** | cancelled | 05:20:05Z | 05:25:03Z |
| 36968808326 | push | 4ef8d449 | success | success | 05:24:43Z | 05:38:11Z |
| 36968811679 | pull_request | 4ef8d449 | success | success | 05:24:46Z | 05:37:28Z |

(All 2026-10-02, branch `loop/t221-ci-concurrency`.)

- **A:** the push and PR runs on `770da4e4` overlapped (05:08:38 to 05:16:10) and both succeeded: neither cancelled the other.
- **B:** push 36968459049 ended 05:24:51, after its same-event successor 36968808326 was created at 05:24:43. PR
  36968462359 ended 05:25:03, after its same-event successor 36968811679 was created at 05:24:46. Both successors
  succeeded. (Timing alone cannot say which event did the cancelling; the group expression in row 2 does, and row 4
  shows a push and PR on the same commit no longer cancel each other.)

### 4. Own live check, 1 push: MET

`node docs/loops/qa-250/push-qa.mjs qa/t221-t222-ci-candidate` → `pushed and read back: qa/t221-t222-ci-candidate
9ab021fdd2df605aacdff2de4db4b963f131d32d`. Group by row 2: `ci-push-qa/t221-t222-ci-candidate`.

- Run **36970268385**: event push, headSha `9ab021fdd2df605aacdff2de4db4b963f131d32d`, conclusion **success**, jobs
  `changed=success, test-windows=skipped, test=success`. Watched with `gh run watch --exit-status`.

`gh run list --commit 9ab021fd…`:

| run | event | branch | conclusion | createdAt | updatedAt |
| --- | --- | --- | --- | --- | --- |
| 36970268385 | push | qa/t221-t222-ci-candidate | success | 05:44:07Z | 05:51:06Z |
| 36969848539 | pull_request | loop/t221-ci-concurrency | success | 05:38:34Z | 05:46:52Z |
| 36969845163 | push | loop/t221-ci-concurrency | success | 05:38:31Z | 05:42:00Z |

All three completed with success. #274's push and PR runs overlapped (05:38:34 to 05:42:00), and my run overlapped the PR
run (05:44:07 to 05:46:52); none was cancelled.

### 5. Red first: MET

In `qa250-t221/open-brain` (`npm ci`, then `npx vitest run tests/pipelines/sync/ci-runs-on.test.ts`):

- Candidate as is: `Tests 20 passed (20)`.
- `git checkout origin/master -- .github/workflows/ci.yml`: `Tests 1 failed | 19 passed (20)`, failing row "a branch's
  push run and its pull request run are in different concurrency groups…": `AssertionError: loop/t221-x: the push group:
  expected 'ci-loop/t221-x' not to be 'ci-loop/t221-x'`.
- `git checkout 9ab021fd -- .github/workflows/ci.yml`: `Tests 20 passed (20)`. Tree clean after.

### 6. Own mutant: SURVIVED (gap, not blocking)

Mutant M-push-only: the group is
`format('ci-{0}{1}', github.event_name == 'push' && 'push-' || '', github.head_ref || github.ref_name)`, so a push gets
`ci-push-loop/x` and a PR gets `ci-loop/x`. Result: `Tests 20 passed (20)`. **No row catches it.**

- What it costs: almost nothing in practice, since push and PR still separate. Its one defect is a collision: a PR whose
  head branch is `push-foo` lands in `ci-push-foo`, the same group as a push to `foo`, so the two would cancel each other.
  The candidate's `ci-pull_request-push-foo` has no such collision.
- What the row would need: assert the PR group carries the event too, e.g.
  `expect(pr).toBe(\`ci-pull_request-${branch}\`)` (pin the exact strings), or a collision case:
  `grp({event: "pull_request", headRef: "push-x", …})` is not `grp({event: "push", ref: "refs/heads/x"})`.

## T-222 rows

### 7. Confined: MET

`git diff --stat origin/master...7b42ed6f`:

```
 docs/loops/loop-15-slice-4-closeout.md         |   2 +-
 docs/loops/t222-developer-handoff.md           |  39 +++++++
 open-brain/src/harness/cli.ts                  |   2 +-
 open-brain/src/harness/closeout-tables.ts      |   4 +-
 open-brain/src/harness/gate-records.ts         |  17 ++-
 open-brain/src/harness/policies.ts             |   8 +-
 open-brain/src/harness/shadow-gates.ts         |   9 +-
 open-brain/tests/harness/s4-g3-done.test.ts    |   7 +-
 open-brain/tests/harness/t222-attempts.test.ts | 152 +++++++++++++++++++++++++
```

Exactly the five harness sources, two test files, the regenerated close-out and the handoff.

### 8. F5 on the real records: MET

`harness count-attempts --repo ~/qa-scratch/qa250-t222` at the candidate: **exit 0**, `attempts: 15`, `retries: 0`,
`answered: 14`, `incomplete: 0`, `files scanned: ledger lines 15, records 15`. The plan subject lists
`…G_plan.2026-10-02T00-47-29.272Z.json attempt 1 auth` then `…G_plan.2026-10-02T04-34-15.660Z.json attempt 2 answered`,
with no VIOLATION.

`git diff --stat origin/master 7b42ed6f -- docs/loops/loop-15-slice-4-records`: **empty**. No record and no ledger line
differs from master (origin/master `5b7e034f`; merge-base `8961ba1f`).

### 9. F5 still refuses (own fixtures): MET

Hand-written ledgers and records under `~/qa-scratch/qa250-fixtures/<name>/` (generator `~/qa-tmp/mkfix.mjs`), each run
through the CLI: `count-attempts --repo <d> --ledger <d>/attempts.jsonl --records <d>/records`.

| fixture | exit | output |
| --- | --- | --- |
| reroll-after-answer | **1** | `VIOLATION: plan docs/x.D_t.json: 2 answered records; a second answered record is a re-roll` (+ retries … whose outcome is answered) |
| auth-with-answer (`auth` parent, `answer` non-null) | **1** | `VIOLATION: …G_plan.2.json: retries …G_plan.1.json, whose outcome is auth; only transport, rate-limited, overloaded may be retried` |
| four-transport-retries (5 attempts) | **1** | `VIOLATION: 4 retries in total; the ceiling is 3` |
| unreadable-parent (`auth` parent's record file absent) | **1** | `VIOLATION: …G_plan.2.json: retries …G_plan.1.json, whose outcome is auth; only transport…` |
| garbled-parent (parent record not JSON) | **1** | `…: not JSON` and the same `only transport…` VIOLATION |
| control: unanswered `auth`, then a fresh attempt | 0 | `attempts: 2`, `retries: 0` |

### 10. Mutants of my own: BOTH KILLED

Applied to `open-brain/src/harness/gate-records.ts` in `qa250-t222`, restored with `git checkout 7b42ed6f --` after each.

- **(a)** `unansweredParent`'s `catch` returns `true`: `t222-attempts.test.ts` **1 failed | 8 passed**, F5.5
  (`AssertionError: expected '' to contain 'only transport'`). Own fixtures: `unreadable-parent` flips to **exit 0**
  (caught). `garbled-parent` still exits 1, but only through the separate `not JSON` scan, so it does not catch (a).
- **(b)** `return rec.answer === null` replaced by `return true` (the answer check dropped): **1 failed | 8 passed**, F5.4
  (`expected '' to contain 'only transport'`). Own fixtures: `auth-with-answer` flips to **exit 0** (caught).

Clean candidate after: `t222-attempts`, `s4-g3-done`, `s4-g1-records`, `s4-g6-closeout`: `Test Files 4 passed (4)`,
`Tests 52 passed (52)`.

### 11. F6, F7, F8: MET

- **F6:** `policies.ts` `decideDoneGate`: when `ctx.checksSource === "none"` the reason is
  **`no deterministic checks were supplied`**, otherwise the old `the deterministic checks failed (read from process exit
  codes, not from the gate)`. Only the text depends on it; the `hand_to_qa_requires_green_checks && !checksPassed`
  condition is unchanged. `shadow-gates.ts` passes `checksSource: options.checks.source`. `s4-g3-done.test.ts:148` asserts
  the new text.
- **F7:** `~/qa-tmp/f7.mjs`: E_t written OUTSIDE the repo at `~/qa-scratch/qa250-fixtures-f7/et/pr-195.E_t.json`, then
  `harness shadow-done --pr 195 --merge-commit ddd43526… --scored-sha c3394272… --base-sha d1e86740… --dt
  docs/loops/loop-15-slice-4-records/pr-195.D_t.json --checks-e-t <outside> --mode dry-run --records <scratch> --repo
  ~/qa-scratch/qa250-t222`: exit 0. The record has **`checks_source: 'E_t:@a685c193754bf3c20dd30ba6d5444df7a0122e20'`**,
  and `git hash-object` of that file is `a685c193754bf3c20dd30ba6d5444df7a0122e20`. No machine path. (`mode: dry-run`,
  `sent: false`.)
- **F8 / close-out:** `harness closeout-tables --check docs/loops/loop-15-slice-4-closeout.md` at the candidate:
  `the report contains the regenerated tables verbatim`, **exit 0**. Master's close-out checked against the candidate
  generator: `does not contain the regenerated tables verbatim`, exit 1 (so the check sees the relabel). `git diff
  --numstat origin/master 7b42ed6f -- docs/loops/loop-15-slice-4-closeout.md`: `1 1`; the one changed line is
  `| PR | scored SHA | model_resolved |` → `| PR | E_t commit | model_resolved |` under the 4.4 table.

## CI on the heads (read only)

- T-221 `9ab021fd`: 3 runs, all success (row 4).
- T-222 `7b42ed6f`: PR run **36968787919** success (`test=success`); push run **36968774375 cancelled** at 05:24:27Z,
  12 s after it was created, by the PR run (created 05:24:26Z) under master's old shared group. This is the T-221 defect,
  which the dispatch asks to report. The planner may re-run it; the suite itself is green on the PR run.

## Gaps and notes

- T-221 row 6: the new row does not pin the event in the PR group; M-push-only survives. A fix is one assertion (above).
- `garbled-parent` shows an unreadable parent is flagged twice (scan + retry rule). That is correct, not a defect.
- The slice-four `pr-195` G_done on master still carries `E_t:C:/qa-scratch/qa248-et/…`: F7 is forward-only, and the
  dispatch forbids editing records. Not a defect of this candidate.

QA-250: REPORT COMPLETE
