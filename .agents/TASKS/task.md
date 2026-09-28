<!-- generated from .agents/state.json rev 149 by open-brain v0.44.2 — do not edit; change state via ob_state -->

# Current Focus

## Objective

Loop 15 slice three (D-033/D-036): closes when candidates A, B and C are ACCEPTED; Jev calibration is the next slice. A: A13 ACCEPTED and MERGED (#182, 677c1dd). B: part 1 (G-042 repair) MERGED (#165); part 2 (E_t schema, R10; 8c7769f) ACCEPTED by QA 189 and the planner, so B is ACCEPTED; PR #187 awaits Aaron's merge. C (T-155, the shadow merge gate): NEXT. It has no acceptance criteria yet: as B's were (QA 132), C's are written by a QA seat before any build, then ruled by the planner. Alongside, waiting for QA on the QA PC (laptop unavailable): 182 (T-048 r3), 183 (T-192), 161 (/bootstrap r4 reconciled), 178 (T-048 r2b). _(since session 147)_

## Top tasks

- [ ] **T-008** [P0] Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [ ] **T-014** [P0] Make point-of-use rating reachable
- [ ] **T-022** [P0] Replace-on-write for `state` facts
- [ ] **T-023** [P0] Improve state-side classifier precision
- [ ] **T-024** [P0] Rewrite the two genuine `obsolete-reference` hits
