# T-216: the plan schema must accept the loop ids planner briefs actually use

**By:** Atlas (planner), record session 153, 2026-10-01. **For:** a new developer seat, started by Aaron at the shop.
**Priority:** P0. It blocks slice four's dispatch (`docs/loops/loop-15-slice-4-brief.md` §0).

## The defect

`harness validate plan docs/loops/loop-15-slice-4-brief.D_t.json` exits 1 with `loop: loop must look like t001`.

- `open-brain/src/harness/schema.ts:84` and `:248` pin a plan's `loop` to `/^t\d{3,}$/`, which matches runtime loop
  ids only.
- The evidence schema already accepts seat loop ids, through `EVIDENCE_LOOP_PATTERN` at `:180` (`tNNN` or
  `N-word…`, for example `15-slice-3-c`). Candidate B widened it (rulings-2 R10).
- T-195 (DT-1, DT-7) requires every interactive planner brief to ship a `D_t` that `harness dispatch` validates.
  Planner briefs use seat ids, so **no planner brief can pass that gate today.**

## The change, by property, not by spelling

**One loop-id rule, defined once.**
- Plan and evidence accept the same set, from one exported constant that both schemas import. Two copies of the
  regex would drift.
- Then check every other place that assumes `tNNN` for a loop id: grep `open-brain/src` for `t\d{3` and `t001`.
- Pay particular attention to `brief-plan-gate.ts`: the gate-record name regex (`GATE_RECORD_RE`) and anything that
  builds a path from the loop. Each gets the shared rule or a written reason it needs `tNNN` only.

## Evidence

- **Red, then green:** `validate plan` on `docs/loops/loop-15-slice-4-brief.D_t.json`. It exits 1 before the fix and 0
  after it, and that file is not edited.
- **Rows:** a seat id (`15-slice-4`) and a runtime id (`t001`) are both accepted. These are refused: an empty id, an
  id with a slash, `../x`, and `15` (no word part).
- **A mutant** that gives the plan its own narrower regex again must go red.
- **The plan-gate path:** `harness plan-gate --mode dry-run` on the slice-four `D_t` reaches the gate without a loop-id
  refusal. Dry run means no live Jev call; the key is not needed or used.

## Rules

- Branch from `origin/master` (`0a913f82` or later) as `loop/t216-plan-loop-id`.
- **Machine:** writing code is fine now. **No `npm ci`, build, `tsc` or vitest on the QA PC until clark or atlas says
  Rivet's run is done** (expected about 01:50Z). On another machine, ask atlas first.
- Run locally: `npm ci`, `npm run build` and `tsc --noEmit`, then `vitest run` on `tests/harness` plus any test that
  imports `schema.ts`. Quote the exit codes. Do not run the full suite unless the machine is free.
- Run no CI (D-061). Keep mutants local, with diffs under `docs/loops/t216/mutants/` (T-207).
- Handoff: `docs/loops/t216-developer-handoff.md`, mapping rows to tests with red and then green.
- Push only `loop/t216-plan-loop-id`, never forced. Report the SHA to atlas.
