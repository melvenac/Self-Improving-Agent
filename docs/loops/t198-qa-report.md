# T-198 QA report — record 225

## Verdict

**REJECT.** Candidate `231f501f99b217fd65ab496139cb0d11feba8eb1` adds the presence block, but its
central label overclaims what the hub observes: `polling` is listener-process activity, not evidence that the
seat has seen a turn. It also lets a structurally malformed 200 body throw instead of printing `UNKNOWN`, the
existing `greeting-size` composition does not measure the new block, and its fixture-server tests add five
failures on tcm.

Base: `a74982101fcfc94bbb5b055dc56c1bf764c0d192`.

## Acceptance rows

### PR-1 — partial

The fixture test passed and `pollingNow: true` prints `grok: polling`. That literal behavior is green, but the
header calls the block `Partner presence` and the row names the seat without saying a listener process is the
thing polling. A planner can reasonably read it as “the seat has seen my turn.” The candidate therefore fails
the dispatched listener-versus-seat wording check.

### PR-2 — partial

The fixture test passed: a non-polling room prints `cursor-infra: not polling, 3 unread since 5m`. Count and age
are present. The same unqualified seat wording makes `polling` / `not polling` look like seat state rather than
listener state, so this row has the same semantic defect as PR-1.

### PR-3 — partial

The candidate tests passed for connection failure, HTTP 503, and invalid JSON. A local fixture that accepted the
connection but never replied returned exactly one line,
`presence: UNKNOWN (timeout after 3000ms)`, in **3,011 ms**.

The body validator checks only that `agents` is an array. A 200 fixture body with
`{"agents":[{"name":"grok","rooms":{}}]}` escaped validation and threw
`agent.rooms?.find is not a function` (probe exit 1), so it produced no `presence: UNKNOWN (...)` line.

### PR-4 — met

`formatPartnerLine` returned `cursor-builder: absent` when the partner was absent, and the focused candidate
suite passed this row.

### PR-5 — met

The developer mutant was reapplied to the exact candidate as `qa/t198-mut-swallow`
`b461300152f7d52c73b250d7c6f3dd02c0d4e9e4`. It was `tsc --noEmit` clean. The three PR-3 tests then failed:
unreachable, HTTP 503, and malformed JSON each returned no line.

### PR-6 — partial

All 13 existing `handleStart` tests passed, and `tests/server.test.ts` is unchanged from the base. The focused
presence suite passed 9/9 and the existing greeting-size suite passed 8/8.

The repository greeting composition measured **48,244 characters without the block**. The representative block
was **180 characters**, for **48,424 with the block** before separator characters. This is QA arithmetic:
`composeGreeting` never calls `describeHubPresence`, so `/sync` still reports 48,244 and does not measure the new
block. The preservation half is met; the required measurement half is not.

## Mutants

| Mutant | Typecheck | Result |
| --- | --- | --- |
| Developer `qa/t198-mut-swallow` `b461300152f7d52c73b250d7c6f3dd02c0d4e9e4` | pass | killed: 3/3 selected PR-3 tests failed |
| QA `qa/t198-mut-seat-seen` `26a467972a60235fae2c2016dbb5e4b707a054e6` | pass | **survived**: all 9 focused tests passed after changing the line to `polling (seat has seen this turn)` |

The surviving QA mutant demonstrates that the tests enforce the word `polling` but do not prevent the exact
listener-versus-seat overclaim the dispatched check names. Both branches were based on the exact candidate,
pushed through `docs/loops/qa-225/push-qa.mjs`, and read back at the SHAs above.

## CI

No run used `windows=true`.

| Run | Ref | Head SHA | Run conclusion | `test` job |
| --- | --- | --- | --- | --- |
| `36518581106` | `qa/t198-ci-candidate` | `231f501f99b217fd65ab496139cb0d11feba8eb1` | failure | **failure** |
| `36518584681` | `qa/t198-ci-base` | `a74982101fcfc94bbb5b055dc56c1bf764c0d192` | failure | **failure** |

Both test jobs passed Typecheck. Base had the known moving-`origin/master`
`tests/shared/state-schema.test.ts:248` failure: 1 failed / 1,824 passed / 6 skipped tests.
Candidate had that same failure plus **five new hub-presence failures**: PR-1, PR-2, PR-3 non-2xx, PR-3
malformed JSON, and the source/caller header test all received `presence: UNKNOWN (fetch failed)` from their
fixture-server request. Candidate total: 6 failed / 1,828 passed / 6 skipped tests. Therefore the full-suite
failure is newly worse in the candidate.

Local `npm run build` and `npx tsc --noEmit -p .` exited 0. The combined local targeted command had 41 passes
and 6 failures, all from unavailable `better-sqlite3` bindings under this machine's Node 24 after an
`--ignore-scripts` install. Isolating the relevant suites produced 9/9 presence, 13/13 `handleStart`, and 8/8
greeting-size passes.

Evidence validation against the candidate build:
`node build/harness/cli.js validate evidence C:/qa-scratch/qa225/docs/loops/t198-qa-report.E_t.json` — exit 0.

Pre-commit `sync --check` exited 1 on inherited issues: retired terms in `ENTITIES.md`, the registered QA
scratch-worktree layout, and greeting size (48,244 over 40,000). It named neither report artifact as a defect.
GitNexus `detect-changes` could not bind this new scratch worktree; `git diff --check` passed and the branch diff
contains only this report and its evidence JSON.

## Defects and requested checks

1. **Major — listener activity is presented as seat presence.** The hub's `pollingNow` says that some listener
   process is polling that room. It does not establish that the agent seat consumed the turn. Name it
   `listener polling`, or add an equally explicit warning in every block.
2. **Major — structurally malformed bodies escape the `UNKNOWN` contract.** Validate every agent and room before
   formatting, and turn schema failures into one visible cause line.
3. **Major — the new block is absent from `greeting-size`.** The check's second assembly of `handleStart` stops
   before presence. The reported 180-character addition is not produced by that check and can drift.
4. **Major — five fixture-server tests fail on tcm.** The egress-isolated CI job turns their local fetches into
   `fetch failed`. Inject a fixture-backed `fetchFn`, or otherwise make the required no-live-hub tests pass in
   the project's mandatory CI environment.
5. **Information — the call is made by the open-brain MCP server.** The header says so. Under G-033, this check
   cannot establish that same server process's own freshness.
6. **Information — live shape matched the fixture.** The one permitted read-only live GET returned 200. Field
   names only: root `owner`, `generatedAt`, `hubStartedAt`, `agents`; agent `name`, `state`, `lastSeen`,
   `lastSeenAgeMs`, `polling`, `rooms`; room `sessionId`, `unread`, `pollingNow`, `pollAgeMs`.
7. **Information — T-196 collision is parser-compatible but merge-conflicting.** Against extended blob
   `344bd46`, `readHubPartnerSeats` returned true, found all three Atlas partners, and formatted all three as
   absent from an empty roster. Extra T-196 fields are ignored. Because both branches add the same path with
   different blobs, either merge order creates an add/add conflict; preserve the T-196 superset blob.

## Open for the planner

No question blocks disposition. Recommendation: repair the listener wording, validate nested body fields, and
put the presence block into the greeting-size measurement before rerunning QA.

## Model

QA seat: GPT-5.6 Sol, medium effort. Candidate built by Grok 4.7 (Forge).

QA-225: REPORT COMPLETE
