<!-- generated from .agents/state.json rev 39 by open-brain v0.41.0 — do not edit; change state via ob_state -->

# Current Focus

## Objective

Loop 15 - the HoH runtime, slice one. Build the outer runtime that spawns three isolated role sessions (planner, developer, QA), validates their deliverables against schemas with a capped retry whose exhaustion is a recorded failure, freezes the candidate ref before QA and refuses if the tree moves, refuses developer writes outside the plan's allowlist, and versions each loop in git with loop-<t>-<role> tags. No Jev, no model calls at the gates - the gates are stubbed, and the runtime is what enforces the seat separation that role files could only request. Brief: docs/loops/loop-15-brief.md. Sequenced ahead of Loop 14 by D-019-era ruling; Loop 14 is re-briefed, not deferred. Autonomy boundary ruled (D-019): autonomous inside a branch, Aaron at master. First loop where acceptance is written by a seat (Probe) that neither set the objective nor built the candidate. _(since session 65)_

## Top tasks

- [ ] **T-003** [P0] Session identity is keyed per project, not per session
- [ ] **T-008** [P0] Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [ ] **T-014** [P0] Make point-of-use rating reachable
- [ ] **T-022** [P0] Replace-on-write for `state` facts
- [ ] **T-023** [P0] Improve state-side classifier precision
