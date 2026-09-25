<!-- generated from .agents/state.json rev 131 by open-brain v0.44.2 — do not edit; change state via ob_state -->

# Current Focus

## Objective

Loop 15 slice three, on master 9bc06e3 (v0.44.2). SCOPE (D-033 as amended by D-036): the slice CLOSES when candidates A, B and C are ACCEPTED; Jev calibration is the next slice. A: A to A9 REJECTED (reports and rulings-1..17 in docs/loops). A10 IN BUILD by Grok 4.7 in Cursor (developer record 107) on loop/15-slice-3-candidate-a10, head fb2fbe9 at 11:53Z: R77 and R82 COMPLETE (every protection red first on tcm and a killed mutant, (a)-(f) and (i)-(iii); the readings are in docs/loops/loop-15-slice-3-rulings-18.md); R78 built and green on tcm (36131825963), its tcm redcheck and mutant OUTSTANDING; R82's ENOENT-is-absence fix OUTSTANDING (a win32-only R35 regression, hub turn 107); then R79, R80, the handoff, freeze. Grok went silent after turn 107 (~11:55Z) and needs Aaron's nudge (T-160). QA of A10 is record 108, headless on the QA PC, launched by Aaron. IMPORTER: round 2 aba35de REJECTED by QA 106 (report 9d50e1f: D6 a refused --commit deletes its snapshot, D5 Windows-1252 past STALE, D7 a failed rollback has deleted live files). Round 3 brief docs/loops/importer-fixes-round-3-brief.md: developer record 110 in ~/Worktrees/sia-infra, QA 111; Aaron starts it. B: Step 0 does NOT wait for A (R81, docs/loops/loop-15-slice-3-b-step0-amendment-1.md): base origin/master at dispatch, in sia-infra after round 3 leaves it, record 112. C (T-155) builds on B. THEN the close-out with T-169. STANDING: D-038, D-039, D-040, D-047; record model AND effort in every report; no add_gap until T-158; no /end until T-163. _(since session 109)_

## Top tasks

- [ ] **T-003** [P0] Session identity is keyed per project, not per session
- [ ] **T-008** [P0] Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [ ] **T-014** [P0] Make point-of-use rating reachable
- [ ] **T-022** [P0] Replace-on-write for `state` facts
- [ ] **T-023** [P0] Improve state-side classifier precision
