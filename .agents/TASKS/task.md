<!-- generated from .agents/state.json rev 59 by open-brain v0.43.0 — do not edit; change state via ob_state -->

# Current Focus

## Objective

NEXT LOOP: the G-039 recall trigger — not yet briefed. Ruled by Aaron 2026-09-20 (D-026) after Loop 14 closed ACCEPTED at v0.43.0 (D-025). Constraint from docs/loops/g-039-ruling.md: the trigger is deterministic, fails closed on nothing, and the loop is handed both fixes (a trigger on a queried store; an unconditional read of a curated set). Problem statement from Loop 14: shared.md is loaded into every session and the seat that quoted its rule broke it the same day — loading a rule and applying it are two different things. Then Loop 15 slice three with G-045 first. Fresh developer and QA sessions on Opus 5; the planner on Fable 5.1; criteria before candidate; frozen SHA; the record moves one seat at a time. _(since session 73)_

## Top tasks

- [ ] **T-003** [P0] Session identity is keyed per project, not per session
- [ ] **T-008** [P0] Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [ ] **T-014** [P0] Make point-of-use rating reachable
- [ ] **T-022** [P0] Replace-on-write for `state` facts
- [ ] **T-023** [P0] Improve state-side classifier precision
