# Forge seat handoff (roll, 2026-10-01)

Written by Forge (sia-forge) at Clark's request before the roll. Nothing is uncommitted; every branch below is pushed. Planner names from the restart: **`atlas-sia`** (SIA) and **`relay-a2a`** (A2A); `clark` is the fallback. SIA master has ruleset 24343321 (PR plus CI test required, direct pushes refused), so work reaches master only through a PR.

## State of my branches (all on origin, none merged by me)

| Branch | SHA | What | Status |
|---|---|---|---|
| `loop/t194-planner-hook` | `71ea3101` | T-194 r7, the planner-seat PreToolUse hook (`open-brain/src/planner-hook/`) | **PAUSED per D-089.** Awaiting QA 246. Hook is NOT registered in any settings file. |
| `loop/t204-machine-lease` | `d5b3623f` | T-204 machine lease, built | Accepted for QA (rev 203). Aaron's re-copy of the merge step is still his. |
| `loop/t202-seat-online` | `965a7c53` | T-202 PLAN ONLY (`docs/loops/t202-plan.md`), no code | Atlas told me to push it; pushed. Not built. |

## T-194 r7 in one paragraph

Full account in `docs/loops/t194-r7-developer-handoff.md`. 1101 tests green, build and tsc exit 0, 139 mutants all killed. **The single uninterrupted mutant pass did not happen** (first attempt killed for low memory; the capped retry ran 35 chunks of 4; 123 kills predate the last fix and 16 were re-run). QA 246 runs all 139 in one pass, runs CI on Linux (never run by me), judges the 61-entry allow-list entry by entry, and checks the refusals beyond the dispatch (env vars, quoted non-ASCII targets).

## Open items

- **Hub post as forge**: my classifier denied it. It is Aaron's hand only; I did not retry. I never had its text recorded in a file, so it needs restating if wanted.
- T-202 build waits on a ruling; T-194 waits on D-089 and QA 246.

## Habits that cost time this session

- Heavy runs (npm ci, full vitest, mutants) need Aaron's approval in the window; a peer relaying approval is not his approval.
- Mutant runs on the QA PC: one vitest worker, chunks of 4, skip under 1.2 GB free; the system reaper kills background jobs under memory pressure, and a kill can leave a mutant applied (`git checkout` the file first).
- Anything a later session must read goes in a tracked file before the A2A exchange ends.

## Update at the second roll (2026-10-02)

- **T-221 is DONE and FROZEN** at `9ab021fd` on `loop/t221-ci-concurrency` (PR #274, not merged by me). It goes to QA 250 with T-222. Handoff: `docs/loops/t221-developer-handoff.md`.
- **Queued for me: T-164/T-211 r2 (D-095).** Its DISPATCH_SHA will be PR #280's merge commit; Atlas (`atlas-sia`) sends it after the roll. Do not start it from this note: wait for the dispatch.
- T-194 stays PAUSED (D-089), at `71ea3101`, awaiting QA 246. The hub post stays with Aaron.
- Reports go to `atlas-sia`; `clark` is the fallback. The `ctx_*` (context-mode) tools were NOT available before the roll; check with ToolSearch "ctx_execute" after the restart and tell Clark yes or no.
