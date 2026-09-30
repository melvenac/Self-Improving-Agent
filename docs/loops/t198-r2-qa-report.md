# T-198 r2 QA report — record 230

## Verdict

**ACCEPT.** Candidate `f172e280aa1532c7a246a9017e1dd79c65e7028a` repairs all five r2 requirements
without regressing the six original PR rows. The mandatory tcm `test` job still concludes `failure`, but its only
failure is the same moving-`origin/master` T-171 state-schema assertion present at both r1 and the base. All five
r1 fixture-server failures pass on the candidate under tcm's egress isolation.

Comparisons: r1 `231f501f99b217fd65ab496139cb0d11feba8eb1`; base
`a74982101fcfc94bbb5b055dc56c1bf764c0d192`.

## R2 requirements

### R1 — met

The header is `Partner presence: hub listener activity, not proof the seat read a turn (...)`. Every live partner
line says `listener polling` or `listener not polling`; an absent partner says `absent`. No printed line claims or
implies that a seat saw a turn. Focused candidate tests passed 26/26. Reapplied seat-seen mutant
`c60d13a6ed7564de6fa019c63124772be8ee1599` typechecked and died on 2 tests, including PR-1 and the dedicated
wording row.

### R2 — met

The parser validates the body, every agent, and every supplied room before formatting. The 26-test focused suite
passed all seven committed malformed-shape rows. An independent QA probe exited 0 and returned exactly one line,
without throwing, for each of:

- QA 225 body: `presence: UNKNOWN (malformed body: agents[0].rooms is not an array)`
- QA 230 negative unread: `presence: UNKNOWN (malformed body: agents[0].rooms[0].unread is not a non-negative integer)`
- QA 230 null room: `presence: UNKNOWN (malformed body: agents[0].rooms[0] is not an object)`

The reapplied array-only mutant `cc114bf88f63bc41ce1a14fa4fb09d8f8f9e2030` typechecked and died on all
7 committed malformed-body tests.

### R3 — met

`greeting-size` uses the deterministic `presenceBlockUpperBound`; it does not fetch the hub, and its own output
labels the term `worst-case upper bound, not fetched`. On one identical Atlas fixture root:

- with block: `greeting is 46139 characters ... presence block 313 (worst-case upper bound, not fetched)`
- without block: `greeting is 45825 characters ... presence block 0 (worst-case upper bound, not fetched)`

The 314-character total delta is the 313-character block plus its separator newline. Reapplied no-bound mutant
`1419350e1e00c302d1aefbb37659dc67dcf67710` typechecked and died on 1 greeting-size test.

### R4 — met

Candidate tcm run [`36681338277`](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36681338277),
head `f172e280aa1532c7a246a9017e1dd79c65e7028a`, concluded **failure**; its `test` job also concluded
**failure**. The sole failure was the inherited moving-`origin/master` T-171 state-schema row: 1 failed, 1,853
passed, 6 skipped. The five fixture-server rows that failed at r1 all passed, and the focused suite's tripwire
proved that neither global `fetch` nor `net.Socket.connect` was used.

### R5 — met

The request reads `<keyDir>/<hub-id>/<identity-lowercased>.key` and sends that value only in `X-Agent-Key`.
Missing, unreadable, and short keys each return one `presence: UNKNOWN (...)` line without calling fetch. Output
never contains key text, `dev-key` is never sent, and Forge does not borrow `grok.key`. Reapplied mutants
`8eb31b7d4b749c54eefa0199df4f6385450909d3` (hard-coded `dev-key`) and
`86b6389f839e05d22a87811f82a0edeffe1315a1` (fallback) typechecked and died on 2 and 4 tests respectively.

## Original acceptance rows

| Row | Score | Evidence |
| --- | --- | --- |
| PR-1 | met | `pollingNow: true` prints `grok: listener polling`; R1 wording mutant dies. |
| PR-2 | met | Non-polling fixture prints `cursor-infra: listener not polling, 3 unread since 5m`. |
| PR-3 | met | Unreachable, 503, 403, invalid JSON, timeout, and all malformed structures print one visible `UNKNOWN` line; timeout test is bounded at 50 ms. |
| PR-4 | met | Missing roster partner prints `grok: absent`, not a skipped line. |
| PR-5 | met | The r1 swallow mutant was semantically reapplied to the exact candidate (`swallowFetchErrors` defaults true), typechecked, and died on 12 error-contract tests. |
| PR-6 | met | Focused run passed 67/67 across presence, greeting-size, and server suites; the deterministic presence bound is now part of the measured greeting. |

## Mutants

Every developer mutant was applied to the exact candidate tree. The five r2 branches have candidate
`f172e28` as their direct parent; the r1 swallow change was reapplied semantically because its old patch no
longer applies after the parser and key changes.

| Mutant | Typecheck | Result |
| --- | --- | --- |
| r1 seat-seen `c60d13a` | pass | killed: 2/26 focused tests failed |
| r2 array-only `cc114bf` | pass | killed: 7/26 focused tests failed |
| r3 no-bound `1419350` | pass | killed: 1/11 greeting-size tests failed |
| r5a dev-key `8eb31b7` | pass | killed: 2/26 focused tests failed |
| r5b fallback `86b6389` | pass | killed: 4/26 focused tests failed |
| r1 swallow `bbf4b78`, semantically reapplied | pass | killed: 12/26 focused tests failed |
| QA negative-unread `00b29fe648c236854b90efbf90a90da8180a9cd0` | pass | killed by the independent negative-unread probe; the original 26 tests survived |

The QA mutant branch was pushed through the QA-230 push guard and read back at the SHA shown.

## CI and local checks

No run used `windows=true`.

| Run | Ref | Head SHA | Run | `test` job | Result |
| --- | --- | --- | --- | --- | --- |
| [`36681338277`](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36681338277) | `qa/t198-r2-ci-candidate` | `f172e280aa1532c7a246a9017e1dd79c65e7028a` | failure | failure | 1 failed / 1,853 passed / 6 skipped |
| [`36681343536`](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36681343536) | `qa/t198-r2-ci-r1` | `231f501f99b217fd65ab496139cb0d11feba8eb1` | failure | failure | 6 failed / 1,828 passed / 6 skipped |
| [`36681349895`](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36681349895) | `qa/t198-r2-ci-base` | `a74982101fcfc94bbb5b055dc56c1bf764c0d192` | failure | failure | 1 failed / 1,824 passed / 6 skipped |

All three `test` jobs passed Typecheck. Base and candidate failed only
`tests/shared/state-schema.test.ts` T-171 r3b, which reads moving `origin/master`. R1 had that same failure plus
the five hub-presence fixture-server failures named by QA 225. Therefore the candidate has **no new full-suite
failure** and specifically repairs all five tcm egress failures.

Locally, build and typecheck exited 0; focused tests passed 67/67. The full Windows run exited 1 with 8 failures,
1,774 passes, 78 skips, and 3 worker RPC errors after 404.73 s. Those failures were environment/load or
moving-ref rows outside T-198; the mandatory same-runner tcm comparison above is dispositive.

The one allowed live GET was skipped: this QA account has no
`~/.a2a-hub/keys/100.124.212.87-4000/cursor-qa2-gpt.key`. No live hub call was made and `dev-key` was never used.

Evidence validation against the candidate build:
`node build/harness/cli.js validate evidence ../docs/loops/t198-r2-qa-report.E_t.json` — exit 0.

Required `sync --check` exited 1 with 27 passes, 3 warnings, 3 inherited/environmental issues, and 1 skip:
retired terms already in `ENTITIES.md`, the registered QA scratch-worktree layout, and the pre-existing
greeting-size excess. It named neither report artifact as a defect. GitNexus change detection reported no changed
symbols because the branch adds only untracked-at-analysis report artifacts.

## G-049 key-file mapping

The candidate carries the exact T-196 superset seat blob `344bd46331ce14e4dd874a93faaf73e127c13bab`.
The developer's table is internally correct against `hubAsForIdentity` and `keyNameForIdentity`: reader lookup
special-cases Forge/developer to `grok`, while key lookup independently lowercases the identity to `forge`.

| Checkout | Declared identity | Reader row | Key file / behavior |
| --- | --- | --- | --- |
| `sia-planner` | Atlas / planner | `atlas` | `atlas.key`; prints block |
| `sia-forge` | Forge / developer | `grok` | `forge.key`; UNKNOWN while absent |
| `sia-builder` | Forge / developer | `grok` | `forge.key`; wrong shared identity |
| `sia-infra` | Forge / developer | `grok` | `forge.key`; wrong shared identity |
| `sia-qa` | Probe / qa | none | no block, so no key lookup |
| `sia-research` | Scout / none | none | no block, so no key lookup |

The shared-identity problem is G-049 and is not scored as a T-198 defect.

## Defects

None against T-198 r2. The candidate's remaining CI failure is inherited and unrelated.

## Open for the planner

No question blocks disposition. Recommendation: accept T-198 r2; continue G-049 separately so builder and infra
resolve their own reader rows and key files.

## Model

QA seat: GPT-5.6 Sol. Candidate r1 was built by Grok; r2 was built by Forge in Claude Code.

QA-230: REPORT COMPLETE
