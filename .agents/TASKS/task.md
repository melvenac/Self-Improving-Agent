<!-- generated from .agents/state.json rev 184 by open-brain v0.44.2 — do not edit; change state via ob_state -->

# Current Focus

## Objective

Loop 15 slice three (D-033/D-036) closes when candidates A, B and C are ACCEPTED; Jev calibration is the next slice. A: ACCEPTED and MERGED (#182, 2026-09-27). B: ACCEPTED and MERGED (part 1 #165, part 2 #187, 2026-09-27). C (T-155, the shadow merge gate): OPEN. r3 (20c2dfd, PR #195) was QA 213 ACCEPT, overruled by the planner (session 149) for five partial rows including CC-13's ledger tamper check; r4 is with Forge, scoped exactly to CC-1.2, CC-2.2, CC-5.6, CC-13.1, CC-13.2 and CC-17. When C r4 is accepted: shadow-verdict prepare on its E_t BEFORE Aaron merges #195, decide after (C criteria section 8 P4), and slice three closes. _(since session 149)_

## Top tasks

- [ ] **T-008** [P0] Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [ ] **T-014** [P0] Make point-of-use rating reachable
- [ ] **T-022** [P0] Replace-on-write for `state` facts
- [ ] **T-023** [P0] Improve state-side classifier precision
- [ ] **T-024** [P0] Rewrite the two genuine `obsolete-reference` hits
