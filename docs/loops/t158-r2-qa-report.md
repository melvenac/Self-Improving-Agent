# T-158 r2 QA report — record 220

## Verdict

**ACCEPT.** Candidate `e23e622813a540e18bed0849779040cf181ff9b7` closes both majors from QA 223:
explicit `add_gap` ids receive the citation protection, and a citation scan fails closed on every result except
`git grep` exit 1. All five acceptance rows are met, all four developer mutants and one QA mutant are killed, and
the full-suite failure is identical at base. R28 can be lifted when this candidate merges.

Base: `474b65245b026c8587aa81b60abf81c0c3e76f7f`.

## Acceptance rows

### TG-1 — met

`npx vitest run tests/shared/state-writer.test.ts tests/pipelines/session-start/state-render.test.ts
tests/shared/state-schema.test.ts --testTimeout=60000` passed all 45 writer tests and all 33 greeting-render tests.
The sole failure among 98 tests was the known moving-`origin/master` T-171 r3b assertion, also present at base.

An independent probe copied this checkout's real state into scratch, closed G-001, and observed the retained entry:
`status: closed`, `closed_session: 999`, `closed_rev: 141`, with `removed_gap_ids: []`. Both the greeting and SUMMARY
omitted G-001, and a second close refused `already closed`.

### TG-2 — met

An independent dry-run against the candidate worktree's copy of `.agents/state.json` assigned **G-049**, emitted:

- `add_gap skipped G-046: cited in 15 tracked file(s) ...`
- `add_gap skipped G-047: cited in 15 tracked file(s) ...`
- `add_gap skipped G-048: cited in 5 tracked file(s) ...`

The file remained byte-identical. Separate dry-runs explicitly requested G-046, G-047 and G-048; all three refused
with `gap G-04x is cited ... and cannot be reused`.

For a real scan failure, the probe copied the state into a scratch Git repository and corrupted its index.
`citedGapIds` returned `git grep exited 128: fatal: .git/index: index file smaller than expected`; `add_gap` refused
with the same exit and left the scratch state byte-identical. Exit 1 remains the only no-citations result.

### TG-3 — met

The focused candidate test passed both directions: fixture citation G-040 was skipped and uncited G-041 was assigned.
The repository scan found G-046, G-047 and G-048. G-048 remains discoverable in punctuation-wrapped prose in
`docs/loops/loop-14-closeout.md` and `docs/loops/t158-t164-dispatch.md`; the scanner reported five candidate-tree
files because candidate source, tests and handoff also cite it.

### TG-4 — met

Every mutant was based directly on `e23e622`, completed `npm run build` and `npx tsc --noEmit`, and then went red:

| Mutant | QA branch / SHA | Kill |
| --- | --- | --- |
| restore splice | `qa/t158-r2-mut-splice` `5002bc8f7fa3655a591d1b28aa1043d1e577bfd1` | TG-1: expected `removed_gap_ids` `[]`, received `["G-001"]` |
| drop generated-id scan | `qa/t158-r2-mut-scan` `1a1a7f915bcd04dee25744ca73cc134778117453` | TG-2: generated id was G-046 |
| drop explicit-id check | `qa/t158-r2-mut-explicit` `5aa26e5d705159095c2f206dad48a41254ebc1aa` | explicit cited-id row: expected refusal, received success |
| read all nonzero exits as no citations | `qa/t158-r2-mut-scan-open` `c08aba0abd90195dda21c9f06e4799357fffa8bf` | fail-closed row: expected refusal, received success |
| QA: render closed gaps as open | `qa/t158-r2-mut-render-closed` `cc79ab0cfc1efd5a64fd644b73f65b73e691c6c7` | TG-1 writer and greeting assertions both red |

The r1 scan patch conflicted mechanically with r2's adjacent explicit-id branch. Its resolved one-line mutation still
changes only generated assignment from `ctx.gapScan.cited` to `new Map()`; the explicit path remains intact.
All branches were pushed and read back through `docs/loops/qa-227/push-qa.mjs`.

### TG-5 — met

`GapSchema` keeps schema version 3 and adds optional `status`, `closed_session` and `closed_rev`; absent `status`
still means open. The copied legacy-shaped real record parsed and the independent write produced a valid tombstone.
Focused preservation tests for `close_task`, done-task retention, state rendering and schema behavior passed. The
writer suite was 45/45 and the greeting suite 33/33.

The focused schema run was 19/20 only because its T-171 r3b test reads moving `origin/master`; CI confirmed that
failure is identical at the base. No row that QA 223 scored met regressed.

## CI and full suite

No run used `windows=true`; `test-windows` was skipped by the workflow and is not counted as green.

| Run | Ref | Head SHA | Run conclusion | `test` job |
| --- | --- | --- | --- | --- |
| `36673852699` | `qa/t158-r2-ci-candidate` | `e23e622813a540e18bed0849779040cf181ff9b7` | failure | **failure** |
| `36673856307` | `qa/t158-r2-ci-base` | `474b65245b026c8587aa81b60abf81c0c3e76f7f` | failure | **failure** |

Both `test` jobs executed and Typecheck succeeded. Candidate:
`Test Files 1 failed | 130 passed (131)`; `Tests 1 failed | 1829 passed | 6 skipped (1836)`.
Base: `Test Files 1 failed | 130 passed (131)`; `Tests 1 failed | 1824 passed | 6 skipped (1831)`.

Each failed only `tests/shared/state-schema.test.ts`, “T-171 r3b: origin/master's real state.json parses, and a
missing note_by is null”. The candidate and base predate `3592f11`, while the test reads today's moving
`origin/master`; the identical base failure is the dispatch's named exception. The five extra candidate tests all
passed. No suite failure is new.

## Defects

None.

Evidence validation against the candidate build:
`node C:/qa-scratch/qa227/cand/open-brain/build/harness/cli.js validate evidence
C:/qa-scratch/qa227/report/docs/loops/t158-r2-qa-report.E_t.json` — exit 0.

## Open for the planner

No question blocks disposition. Recommendation: accept `e23e622`, merge it, and lift R28. The two reuse paths that
kept R28 active now refuse with observable reasons.

## Model

QA seat: GPT-5.6 Sol, medium effort. Candidate builder: Composer 2.5 (`cursor-infra`).

QA-227: REPORT COMPLETE
