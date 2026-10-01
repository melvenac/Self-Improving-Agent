<!-- generated from .agents/state.json rev 225 by open-brain v0.44.2 — do not edit; change state via ob_state -->

# Current Focus

## Objective

Loop 15 slice FOUR (Jev scoring on real diffs, in shadow, no calibration claimed) is briefed and RULED: docs/loops/loop-15-slice-4-brief.md plus its D_t (D-070, D-071, D-072 with a 20-call cap). It is NOT dispatched. BLOCKER: T-216 (the plan schema accepts only tNNN loop ids, so the slice-four D_t fails `harness validate plan`), being built by sia-builder (loop/t216-plan-loop-id, ef7a1ce7, local runs on the QA PC now). After T-216 is accepted and merged, dispatch slice four. In flight alongside: T-194 r5 (Forge; defined by property, plus a generator), T-215, T-213. Slice three is CLOSED (A #182, B #165/#187, C #195; shadow ledger line 1 undefined). _(since session 153)_

## Top tasks

- [ ] **T-008** [P0] Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [ ] **T-014** [P0] Make point-of-use rating reachable
- [ ] **T-022** [P0] Replace-on-write for `state` facts
- [ ] **T-023** [P0] Improve state-side classifier precision
- [ ] **T-024** [P0] Rewrite the two genuine `obsolete-reference` hits
