# T-152 infra seat — PARK handoff (cursor-infra, 2026-10-03)

**Seat:** sia-infra / hub `cursor-infra`, room `k5702788wctxj75begyt4x2k5x8f6mav`.  
**Branch:** `loop/t152-ci-enforce` @ see git tip after this commit.  
**Park reason:** Aaron parking all Cursor devs until hub waker is proven.

## Done

- Detached at fresh `origin/master` (`0fd994e1`, T-152 brief on master).
- `/start`: read state, INBOX, `t152-brief.md`, T-152 note in `state.json`; hub inbox turn 94 = Atlas assignment.
- Hub turn 95: one-line T-152 ack (measure + PR after QA-020 END).
- Branch `loop/t152-ci-enforce` created from that tip; **no product/test/CI edits yet** (QA-020 hold: no full `tsc` / full suite on desktop).

## Next (when unparked)

1. Wait for Atlas **END** on QA-020 (or explicit lift of no-full-tsc hold).
2. `cd open-brain && npm run typecheck:tests` — paste error count/list to hub.
3. Fix remaining test-only type errors (handoff expects 0 or leftover category-B in `ranking.test.ts`, `shadow-strategies.test.ts` after T-215).
4. Add `npm run typecheck:tests` to CI `test` job after existing `npx tsc --noEmit` (~line 133 in `.github/workflows/ci.yml`).
5. Red/green: plant one test type error, capture failing CI run id, revert, capture green run id.
6. `/sync` before each commit; push; open PR; report PR #, head SHA, counts, run ids via hub (file + `--wait --wait-timeout 3500`).

## Watch

- Desktop QA-020: **single vitest file per run** until planner END.
- Shared desktop git: do not push other seats' branches without clearance.
- Cursor: no `ob_set_session` proof — ob_state attributed writes refused (T-003).
